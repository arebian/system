import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchQuestTaskLibrary, fetchQuestObjectives, proposeQuestObjectivesOnBackend, decideQuestObjectiveOnBackend, completeQuestObjectiveOnBackend, bootstrapAuthoritativeProfile } from "./systemCloud.js";
import { recommendQuestObjectives, objectiveProposalSummary } from "./systemQuestObjectivesCore.js";
import { reviewQuestObjectiveOnBackend } from "./systemLivingApi.js";

export default function QuestObjectivesPanel({ userQuestId, identity, profile, onProfileUpdated }) {
  const [tasks, setTasks] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [status, setStatus] = useState("LOADING");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [completionNotes, setCompletionNotes] = useState({});
  const [reviewResults, setReviewResults] = useState({});

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

  const recommendations = useMemo(
    () => recommendQuestObjectives(tasks, identity, profile, 3),
    [tasks, identity, profile]
  );
  const summary = objectiveProposalSummary(objectives);

  const generate = useCallback(async () => {
    if (!userQuestId || recommendations.length !== 3 || busy) return;
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
  }, [userQuestId, recommendations, busy]);

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
    const evidence = String(completionNotes[objectiveId] || "").trim();
    if (evidence.length < 12) {
      setMessage("Describe what you completed and the result (at least 12 characters).");
      return;
    }
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const review = await reviewQuestObjectiveOnBackend({ objectiveId, evidence });
      setReviewResults(current => ({ ...current, [objectiveId]: review }));
      setMessage(review?.decision === "APPROVE"
        ? "Evidence approved. Review the assessment, then choose whether to claim the objective XP."
        : review?.decision === "CLARIFY"
          ? "The System needs one clarification. Update your evidence and submit it again."
          : "The evidence does not yet meet the objective. Complete the remaining work and retry.");
    } catch (error) {
      setMessage(error?.message || "OBJECTIVE_REVIEW_FAILED");
    } finally { setBusy(false); }
  }, [completionNotes, busy]);

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
      setMessage(result?.duplicate ? "This objective was already recorded." : "Objective completed. XP was awarded by the System.");
    } catch (error) {
      setMessage(error?.message || "OBJECTIVE_COMPLETION_FAILED");
    } finally { setBusy(false); }
  }, [reviewResults, busy, onProfileUpdated]);

  if (!userQuestId) return null;

  return (
    <section className="quest-objectives-panel">
      <div className="quest-objectives-head">
        <div><small>QUEST EXPANSION // SYSTEM AI</small><h4>MINI-QUEST OBJECTIVES</h4></div>
        <span>{objectives.length ? `${summary.accepted + summary.completed}/${summary.total} APPROVED` : "3 REQUIRED"}</span>
      </div>
      <p>Three focused actions: physical development, intellectual development and a task aligned with your identity. AI recommends; you decide.</p>
      {!objectives.length ? (
        <button type="button" className="system-awareness-open" disabled={status !== "READY" || recommendations.length !== 3 || busy} onClick={generate}>
          {status === "LOADING" ? "LOADING TASK LIBRARY…" : busy ? "GENERATING…" : "GENERATE 3 OBJECTIVES"}
        </button>
      ) : (
        <div className="quest-objectives-list">
          {objectives.map((item,index) => (
            <article className="quest-objective-item" key={item.id}>
              <div className="quest-objective-item-head">
                <small>0{index+1} // {item.pillar}</small><strong>+{item.xp_reward} XP</strong>
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
                  <textarea
                    value={completionNotes[item.id] || ""}
                    onChange={event => { setCompletionNotes(current => ({ ...current, [item.id]: event.target.value })); setReviewResults(current => ({ ...current, [item.id]: null })); }}
                    placeholder="Record what you did and the result (minimum 12 characters)…"
                    rows={2}
                    maxLength={1200}
                    disabled={busy}
                  />
                  <button type="button" disabled={busy || String(completionNotes[item.id] || "").trim().length < 12} onClick={() => reviewObjective(item.id)}>
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
                </div>
              )}
              {item.status === "COMPLETED" && (
                <small className="quest-objectives-confirmed">COMPLETED · AI REVIEW APPROVED · SERVER XP RECORDED</small>
              )}
            </article>
          ))}
          {summary.proposed === 0 && summary.allAccepted && (
            <small className="quest-objectives-confirmed">ALL THREE OBJECTIVES APPROVED — COMPLETE EACH ONE TO UNLOCK THE PARENT QUEST.</small>
          )}
        </div>
      )}
      {message && <small className="quest-objectives-message">{message}</small>}
      {status === "ERROR" && <small className="quest-objectives-message is-error">{message}</small>}
    </section>
  );
}
