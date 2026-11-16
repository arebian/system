import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchQuestTaskLibrary, fetchQuestObjectives, proposeQuestObjectivesOnBackend, decideQuestObjectiveOnBackend, completeQuestObjectiveOnBackend } from "./systemCloud.js";
import { recommendQuestObjectives, objectiveProposalSummary } from "./systemQuestObjectivesCore.js";

export default function QuestObjectivesPanel({ userQuestId, identity, profile }) {
  const [tasks, setTasks] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [status, setStatus] = useState("LOADING");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [completionNotes, setCompletionNotes] = useState({});

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

  const completeObjective = useCallback(async (objectiveId) => {
    const note = String(completionNotes[objectiveId] || "").trim();
    if (note.length < 12) {
      setMessage("Add a short completion note (at least 12 characters) before recording this objective.");
      return;
    }
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await completeQuestObjectiveOnBackend({ objectiveId, completionNote: note });
      setObjectives(current => current.map(item =>
        item.id === objectiveId ? { ...item, ...(result?.objective || {}), status: "COMPLETED" } : item
      ));
      setMessage(result?.duplicate ? "This objective was already recorded." : "Objective recorded. XP was awarded by the System.");
    } catch (error) {
      setMessage(error?.message || "OBJECTIVE_COMPLETION_FAILED");
    } finally { setBusy(false); }
  }, [completionNotes, busy]);

  if (!userQuestId) return null;

  return (
    <section className="quest-objectives-panel">
      <div className="quest-objectives-head">
        <div><small>QUEST EXPANSION // SYSTEM AI</small><h4>MINI-QUEST OBJECTIVES</h4></div>
        <span>{objectives.length ? `${summary.accepted}/${summary.total} ACCEPTED` : "3 REQUIRED"}</span>
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
                    onChange={event => setCompletionNotes(current => ({ ...current, [item.id]: event.target.value }))}
                    placeholder="Record what you did and the result (minimum 12 characters)…"
                    rows={2}
                    maxLength={1200}
                    disabled={busy}
                  />
                  <button type="button" disabled={busy || String(completionNotes[item.id] || "").trim().length < 12} onClick={() => completeObjective(item.id)}>
                    {busy ? "RECORDING…" : "RECORD COMPLETION"}
                  </button>
                  <small>Player attestation is recorded with your note. The System awards XP only after the backend accepts it.</small>
                </div>
              )}
              {item.status === "COMPLETED" && (
                <small className="quest-objectives-confirmed">COMPLETED · SERVER XP RECORDED</small>
              )}
            </article>
          ))}
          {summary.proposed === 0 && summary.accepted === summary.total && (
            <small className="quest-objectives-confirmed">ALL THREE OBJECTIVES APPROVED — COMPLETE EACH ONE TO UNLOCK THE PARENT QUEST.</small>
          )}
        </div>
      )}
      {message && <small className="quest-objectives-message">{message}</small>}
      {status === "ERROR" && <small className="quest-objectives-message is-error">{message}</small>}
    </section>
  );
}
