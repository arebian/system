import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchQuestTaskLibrary, fetchQuestObjectives, fetchPillarCement, proposeQuestObjectivesOnBackend, decideQuestObjectiveOnBackend, completeQuestObjectiveOnBackend, bootstrapAuthoritativeProfile, fetchQuestObjectiveTimer, startQuestObjectiveTimer, finishQuestObjectiveTimer, uploadProofImage } from "./systemCloud.js";
import { recommendQuestObjectives, objectiveProposalSummary } from "./systemQuestObjectivesCore.js";
import { reviewQuestObjectiveOnBackend } from "./systemLivingApi.js";

export default function QuestObjectivesPanel({ userQuestId, pillar, identity, profile, onProfileUpdated, onParentCompleted }) {
  const [tasks, setTasks] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [status, setStatus] = useState("LOADING");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [completionNotes, setCompletionNotes] = useState({});
  const [reviewResults, setReviewResults] = useState({});
  const [timerSessions, setTimerSessions] = useState({});
  const [photoPaths, setPhotoPaths] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [pillarCement, setPillarCement] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([fetchQuestTaskLibrary(), fetchQuestObjectives(userQuestId)])
      .then(([rows, saved]) => {
        if (active) {
          setTasks(rows);
          setObjectives(saved);
          setStatus("READY");
        }
      })
      .catch(error => { if (active) { setStatus("ERROR"); setMessage(error?.message || "TASK_LIBRARY_UNAVAILABLE"); } });
    return () => { active = false; };
  }, [userQuestId]);


  useEffect(() => {
    let active = true;
    fetchPillarCement(pillar)
      .then(value => { if (active) setPillarCement(value); })
      .catch(error => { if (active) setMessage(error?.message || "PILLAR_PROGRESS_LOAD_FAILED"); });
    return () => { active = false; };
  }, [pillar]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const pending = objectives.filter(item => item.status === "ACCEPTED" && item.proof_type === "TIMER");
    Promise.all(pending.map(async item => [item.id, await fetchQuestObjectiveTimer(item.id)]))
      .then(entries => { if (active) setTimerSessions(current => ({ ...current, ...Object.fromEntries(entries.filter(([,session]) => session)) })); })
      .catch(error => { if (active) setMessage(error?.message || "OBJECTIVE_TIMER_LOAD_FAILED"); });
    return () => { active = false; };
  }, [objectives]);

  const lockedObjectives = objectives.filter(item => item.status === "ACCEPTED" || item.status === "COMPLETED");
  const recommendationLimit = Math.max(0, 3 - lockedObjectives.length);
  const recommendations = useMemo(() => {
    const unavailableTaskIds = new Set(objectives.map(item => item.task_id).filter(Boolean));
    const targetPillar = String(pillar || "").toUpperCase();
    const availableTasks = tasks.filter(task =>
      !unavailableTaskIds.has(task.id) && String(task.pillar || "").toUpperCase() === targetPillar
    );
    return recommendQuestObjectives(availableTasks, identity, profile, recommendationLimit, targetPillar);
  }, [tasks, identity, profile, objectives, recommendationLimit, pillar]);
  const visibleObjectives = objectives.filter(item => item.status !== "REJECTED");
  const summary = objectiveProposalSummary(visibleObjectives);

  const generate = useCallback(async () => {
    if (!userQuestId || recommendationLimit < 1 || recommendations.length !== recommendationLimit || busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await proposeQuestObjectivesOnBackend({
        userQuestId,
        taskIds: recommendations.map(item => item.id),
        reasons: recommendations.map(item => item.recommendationReason),
      });
      setObjectives(result?.objectives || []);
      setMessage("SYSTEM recommendations are ready. Review each objective before accepting.");
    } catch (error) {
      setMessage(error?.message || "OBJECTIVE_PROPOSAL_FAILED");
    } finally { setBusy(false); }
  }, [userQuestId, recommendations, recommendationLimit, busy]);

  // First-time pillar quest setup: generate the initial three recommendations
  // automatically once the task library and saved objective state are loaded.
  // Rejected proposals remain in history, so replacements stay player-initiated.
  const autoGenerationAttemptedForRef = useRef("");
  useEffect(() => {
    if (
      status !== "READY" ||
      !userQuestId ||
      objectives.length !== 0 ||
      recommendationLimit !== 3 ||
      recommendations.length !== 3 ||
      busy ||
      autoGenerationAttemptedForRef.current === userQuestId
    ) return;

    autoGenerationAttemptedForRef.current = userQuestId;
    void generate();
  }, [status, userQuestId, objectives.length, recommendationLimit, recommendations, busy, generate]);

  const decide = useCallback(async (objectiveId, decision) => {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await decideQuestObjectiveOnBackend({ objectiveId, decision });
      setObjectives(current => current.map(item =>
        item.id === objectiveId ? { ...item, ...(result?.objective || {}), status: result?.status || (decision === "ACCEPT" ? "ACCEPTED" : "REJECTED") } : item
      ));
    } catch (error) {
      setMessage(error?.message || "OBJECTIVE_DECISION_FAILED");
    } finally { setBusy(false); }
  }, [busy]);

  const reviewObjective = useCallback(async (objectiveId) => {
    const item = objectives.find(row => row.id === objectiveId);
    const timerSession = timerSessions[objectiveId];
    const isTimer = item?.proof_type === "TIMER";
    const isPhoto = item?.proof_type === "PHOTO";
    const evidence = String(completionNotes[objectiveId] || "").trim();
    if (isTimer && (!timerSession || timerSession.status !== "COMPLETED")) {
      setMessage("Complete the server-verified timer before submitting this objective.");
      return;
    }
    if (!isTimer && evidence.length < 12) {
      setMessage("Describe what you completed and the result (at least 12 characters).");
      return;
    }
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      if (isPhoto && !photoPaths[objectiveId]) {
        setMessage("Attach the original photo required by this objective.");
        setBusy(false);
        return;
      }
      const review = await reviewQuestObjectiveOnBackend({ objectiveId, evidence, timerSessionId: isTimer ? timerSession.id : null, imagePath: isPhoto ? photoPaths[objectiveId] : null });
      setReviewResults(current => ({ ...current, [objectiveId]: review }));
      setMessage(review?.decision === "APPROVE"
        ? "Evidence approved. Review the assessment, then choose whether to claim the objective XP."
        : review?.decision === "CLARIFY"
          ? "The System needs one clarification. Update your evidence and submit it again."
          : "The evidence does not yet meet the objective. Complete the remaining work and retry.");
    } catch (error) {
      setMessage(error?.message || "OBJECTIVE_REVIEW_FAILED");
    } finally { setBusy(false); }
  }, [completionNotes, busy, objectives, timerSessions, photoPaths]);

  const attachPhoto = useCallback(async (objectiveId, file) => {
    if (!file || uploadingPhoto) return;
    if (!["image/jpeg","image/png","image/webp"].includes(String(file.type || "").toLowerCase())) {
      setMessage("Photo proof supports JPG, PNG or WebP.");
      return;
    }
    setUploadingPhoto(true); setMessage("");
    try {
      const uploaded = await uploadProofImage(file);
      setPhotoPaths(current => ({ ...current, [objectiveId]: uploaded.path }));
      setReviewResults(current => ({ ...current, [objectiveId]: null }));
      setMessage("Private photo uploaded. Add your result description and submit for AI review.");
    } catch (error) { setMessage(error?.message || "PHOTO_UPLOAD_FAILED"); }
    finally { setUploadingPhoto(false); }
  }, [uploadingPhoto]);

  const startTimer = useCallback(async (objectiveId) => {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const session = await startQuestObjectiveTimer(objectiveId);
      setTimerSessions(current => ({ ...current, [objectiveId]: session }));
      setMessage("Verified timer started. Keep this objective open until the required duration is complete.");
    } catch (error) { setMessage(error?.message || "OBJECTIVE_TIMER_START_FAILED"); }
    finally { setBusy(false); }
  }, [busy]);

  const finishTimer = useCallback(async (objectiveId) => {
    const session = timerSessions[objectiveId];
    if (!session?.id || busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await finishQuestObjectiveTimer(session.id);
      if (result?.status === "TOO_EARLY") {
        setMessage("The required time has not elapsed yet. Keep the timer running.");
      } else if (result?.session) {
        setTimerSessions(current => ({ ...current, [objectiveId]: result.session }));
        setMessage("Timer duration verified by the server. Submit it for AI review.");
      }
    } catch (error) { setMessage(error?.message || "OBJECTIVE_TIMER_FINISH_FAILED"); }
    finally { setBusy(false); }
  }, [timerSessions, busy]);

  const completeObjective = useCallback(async (objectiveId) => {
    const review = reviewResults[objectiveId];
    if (!review?.id || review.decision !== "APPROVE") {
      setMessage("An approved AI review is required before claiming objective XP.");
      return;
    }
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await completeQuestObjectiveOnBackend({ objectiveId, reviewId: review.id });
      setObjectives(current => current.map(item =>
        item.id === objectiveId ? { ...item, ...(result?.objective || {}), status: "COMPLETED" } : item
      ));
      const cloudProfile = await bootstrapAuthoritativeProfile();
      if (cloudProfile && onProfileUpdated) onProfileUpdated(cloudProfile);
      if (result?.parent_completed && onParentCompleted) onParentCompleted();
      const updatedCement = await fetchPillarCement(pillar);
      setPillarCement(updatedCement);
      setMessage(result?.duplicate
        ? "This objective was already recorded."
        : result?.parent_completed
          ? "Third mission approved. Main quest complete. +1 cement added to the " + String(pillar).toUpperCase() + " pillar."
          : "Objective completed. XP was awarded by the System.");
    } catch (error) {
      setMessage(error?.message || "OBJECTIVE_COMPLETION_FAILED");
    } finally { setBusy(false); }
  }, [reviewResults, busy, onProfileUpdated, onParentCompleted, pillar]);

  if (!userQuestId) return null;

  return (
    <section className="quest-objectives-panel">
      <div className="quest-objectives-head">
        <div><small>{String(pillar || "PILLAR").toUpperCase()} QUEST // TO-DO LIST</small><h4>{String(pillar || "PILLAR").toUpperCase()} TO-DO LIST</h4></div>
        <span>{objectives.length ? `${summary.accepted + summary.completed}/${summary.total} APPROVED` : "3 REQUIRED"} · {pillarCement} CEMENT</span>
      </div>
      <p>Only {String(pillar || "selected").toUpperCase()} missions appear in this list. Complete all three to approve the {String(pillar || "selected").toUpperCase()} daily quest. AI recommends; you decide.</p>
      {!visibleObjectives.length ? (
        <button type="button" className="system-awareness-open" disabled={status !== "READY" || recommendations.length !== recommendationLimit || recommendationLimit < 1 || busy} onClick={generate}>
          {status === "LOADING" ? "LOADING TASK LIBRARY…" : busy ? "GENERATING THREE OBJECTIVES…" : "RETRY GENERATING 3 OBJECTIVES"}
        </button>
      ) : (
        <div className="quest-objectives-list">
          {visibleObjectives.map((item,index) => (
            <article className="quest-objective-item" key={item.id}>
              <div className="quest-objective-item-head">
                <small>MISSION 0{index+1} // {item.pillar} PILLAR</small><strong>+{item.xp_reward} XP</strong>
              </div>
              <h5>{item.title_snapshot}</h5>
              <p>{item.objective_snapshot}</p>
              <div className="quest-objective-meta">{item.difficulty} · {item.duration_minutes} MIN · {item.status}</div>
              {item.status === "PROPOSED" && (
                <div className="quest-objective-actions">
                  <button type="button" disabled={busy} onClick={() => decide(item.id,"ACCEPT")}>ACCEPT</button>
                  <button type="button" disabled={busy} onClick={() => decide(item.id,"REJECT")}>REJECT</button>
                </div>
              )}
              {item.status === "ACCEPTED" && (
                <div className="quest-objective-completion">
                  {item.proof_type === "TIMER" ? (
                    <div className="quest-objective-timer">
                      <textarea
                        value={completionNotes[item.id] || ""}
                        onChange={event => { setCompletionNotes(current => ({ ...current, [item.id]: event.target.value })); setReviewResults(current => ({ ...current, [item.id]: null })); }}
                        placeholder="What did you work on, and what did you achieve during the timer?"
                        rows={2}
                        maxLength={1200}
                        disabled={busy}
                      />
                      {timerSessions[item.id]?.status === "COMPLETED" ? (
                        <small>SERVER TIMER VERIFIED · {Math.floor((timerSessions[item.id].elapsed_seconds || 0) / 60)} MIN</small>
                      ) : timerSessions[item.id]?.status === "RUNNING" ? (
                        <>
                          <strong>{(() => { const remaining = Math.max(0, item.duration_minutes * 60 - Math.floor((clockNow - new Date(timerSessions[item.id].started_at).getTime()) / 1000)); return String(Math.floor(remaining/60)).padStart(2,"0") + ":" + String(remaining%60).padStart(2,"0"); })()}</strong>
                          <button type="button" disabled={busy || clockNow - new Date(timerSessions[item.id].started_at).getTime() < item.duration_minutes * 60000} onClick={() => finishTimer(item.id)}>VERIFY TIMER COMPLETION</button>
                        </>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => startTimer(item.id)}>START {item.duration_minutes}-MIN VERIFIED TIMER</button>
                      )}
                      {timerSessions[item.id]?.status === "COMPLETED" && (
                        <button type="button" disabled={busy || String(completionNotes[item.id] || "").trim().length < 12} onClick={() => reviewObjective(item.id)}>SUBMIT TIMER FOR AI REVIEW</button>
                      )}
                      {reviewResults[item.id] && (
                        <div className={"quest-objective-review is-" + String(reviewResults[item.id].decision || "pending").toLowerCase()}>
                          <strong>{reviewResults[item.id].decision} // SYSTEM REVIEW</strong>
                          <span>{reviewResults[item.id].reason}</span>
                          {reviewResults[item.id].question && <span>{reviewResults[item.id].question}</span>}
                          {Array.isArray(reviewResults[item.id].missing) && reviewResults[item.id].missing.length > 0 && <small>STILL NEEDED: {reviewResults[item.id].missing.join(" · ")}</small>}
                          {reviewResults[item.id].decision === "APPROVE" && (
                            <button type="button" disabled={busy} onClick={() => completeObjective(item.id)}>
                              {busy ? "CLAIMING…" : "CONFIRM & CLAIM +" + item.xp_reward + " XP"}
                            </button>
                          )}
                        </div>
                      )}
                      <small>Timer duration is verified by the server; AI separately reviews the work you describe.</small>
                    </div>
                  ) : (
                  <>
                  {item.proof_type === "PHOTO" && (
                    <label className="quest-objective-photo-upload">
                      <span>{photoPaths[item.id] ? "PHOTO ATTACHED" : "ATTACH REQUIRED PHOTO (JPG / PNG / WEBP)"}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || uploadingPhoto} onChange={event => attachPhoto(item.id, event.target.files?.[0])} />
                    </label>
                  )}
                  <textarea
                    value={completionNotes[item.id] || ""}
                    onChange={event => { setCompletionNotes(current => ({ ...current, [item.id]: event.target.value })); setReviewResults(current => ({ ...current, [item.id]: null })); }}
                    placeholder="Record what you did and the result (minimum 12 characters)…"
                    rows={2}
                    maxLength={1200}
                    disabled={busy}
                  />
                  <button type="button" disabled={busy || uploadingPhoto || String(completionNotes[item.id] || "").trim().length < 12 || (item.proof_type === "PHOTO" && !photoPaths[item.id])} onClick={() => reviewObjective(item.id)}>
                    {busy ? "REVIEWING…" : "SUBMIT EVIDENCE FOR AI REVIEW"}
                  </button>
                  {reviewResults[item.id] && (
                    <div className={"quest-objective-review is-" + String(reviewResults[item.id].decision || "pending").toLowerCase()}>
                      <strong>{reviewResults[item.id].decision} // SYSTEM REVIEW</strong>
                      <span>{reviewResults[item.id].reason}</span>
                      {reviewResults[item.id].question && <span>{reviewResults[item.id].question}</span>}
                      {Array.isArray(reviewResults[item.id].missing) && reviewResults[item.id].missing.length > 0 && (
                        <small>STILL NEEDED: {reviewResults[item.id].missing.join(" · ")}</small>
                      )}
                      {reviewResults[item.id].decision === "APPROVE" && (
                        <button type="button" disabled={busy} onClick={() => completeObjective(item.id)}>
                          {busy ? "CLAIMING…" : "CONFIRM & CLAIM +" + item.xp_reward + " XP"}
                        </button>
                      )}
                    </div>
                  )}
                  <small>AI reviews your evidence and recommends a decision. XP is awarded only after an approved review and your explicit confirmation.</small>
                  </>
                  )}
                </div>
              )}
              {item.status === "COMPLETED" && (
                <small className="quest-objectives-confirmed">COMPLETED · AI REVIEW APPROVED · SERVER XP RECORDED</small>
              )}
            </article>
          ))}
          {recommendationLimit > 0 && summary.proposed === 0 && (
            <button type="button" className="system-awareness-open" disabled={status !== "READY" || recommendations.length !== recommendationLimit || busy} onClick={generate}>
              {busy ? "GENERATING…" : "GENERATE " + recommendationLimit + " REPLACEMENT OBJECTIVE" + (recommendationLimit === 1 ? "" : "S")}
            </button>
          )}
          {summary.proposed === 0 && summary.allAccepted && (
            <small className="quest-objectives-confirmed">ALL THREE MISSIONS ACCEPTED — COMPLETE EACH ONE FOR AUTOMATIC QUEST APPROVAL.</small>
          )}
        </div>
      )}
      {message && <small className="quest-objectives-message">{message}</small>}
      {status === "ERROR" && <small className="quest-objectives-message is-error">{message}</small>}
    </section>
  );
}
