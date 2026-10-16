import React, { useCallback, useEffect, useRef, useState } from "react";
import { canReuseApprovedReview } from "./systemReviewCore.js";
import { livingSystemAction } from "./systemLivingApi.js";
import { bootstrapAuthoritativeProfile, hydrateStructuredProfile } from "./systemCloud.js";
import { normalizeProfile } from "./systemProfileCore.js";
import { WEEKLY_BOSS_OPTIONS } from "../supabase/functions/_shared/weeklyBossCore.js";
import "./styles/weeklyBoss.css";

export default function WeeklyBoss({ profile, applyAuthoritativeProfile }) {
  const [state, setState] = useState(null);
  const [intake, setIntake] = useState({ need: "BREAKFAST", days: 7, people: 1, storage: "FREEZER", avoids: "", available: "", budget: "Use supplies I already have" });
  const [draft, setDraft] = useState(null);
  const [result, setResult] = useState("");
  const [answer, setAnswer] = useState("");
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const alive = useRef(true);
  const approved = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const refresh = useCallback(async () => {
    const next = await livingSystemAction("weekly_boss_status");
    if (alive.current) setState(next);
    return next;
  }, []);
  useEffect(() => {
    let active = true;
    refresh().catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [refresh, profile.fingerprint]);

  async function run(label, task) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(label); setError(""); setNotice("");
    try { await task(); }
    catch (err) { if (alive.current) setError(err.message || "The action could not be confirmed. Please retry."); }
    finally { inFlight.current = false; if (alive.current) setBusy(""); }
  }
  async function refreshPlayer() {
    const cloud = await bootstrapAuthoritativeProfile();
    if (!cloud) throw new Error("Progress was submitted, but the player refresh failed. Refresh status before trying again.");
    const hydrated = await hydrateStructuredProfile(cloud);
    applyAuthoritativeProfile(normalizeProfile(hydrated));
  }
  const boss = state?.active?.metadata?.kind === "WEEKLY_PREPARATION" ? state.active : null;
  const plan = boss?.metadata?.weekly_plan || draft?.plan;
  const completed = boss?.objectives?.filter(o => o.is_complete).length || 0;
  const covered = boss ? completed / Math.max(1, boss.objectives.length) * 100 : 0;
  const canCreate = state?.can_assign;
  function change(field, value) { setIntake(current => ({ ...current, [field]: value })); setDraft(null); }

  return <section className="weekly-boss" aria-labelledby="weekly-boss-title" aria-busy={!!busy}>
    <header className="weekly-boss-header">
      <div><small>WEEKLY BOSS / REAL-WORLD ADVANTAGE</small><h2 id="weekly-boss-title">CONQUER THE WORK. FREE YOUR WEEK.</h2>
        <p>A concentrated preparation session. A finished supply for the coming days. One major reward per seven-day window.</p></div>
      <span className="weekly-boss-badge">{!state ? "CHECKING GATE" : boss ? "BOSS ACTIVE" : state.has_key ? "RAID KEY DETECTED" : "RAID KEY REQUIRED"}</span>
    </header>
    {error && <div className="weekly-boss-error" role="alert">{error}</div>}
    {notice && <p role="status" className="weekly-boss-notice">{notice}</p>}
    <button type="button" className="weekly-boss-refresh" disabled={!!busy} onClick={() => run("Refreshing", refresh)}>REFRESH STATUS</button>
    {!state && <p role="status">Connecting to your Boss Gate…</p>}
    {state && !state.has_key && <p>Unlock the Raid Entry Key at Level 5 with a three-day daily streak. Your weekly boss will then be available here.</p>}
    {state?.active && !boss && <p>Your existing raid is still active. Finish it before starting a weekly preparation boss.</p>}
    {!state?.active && state?.has_key && !canCreate && <p>Your next boss opens {new Date(state.next_available_at).toLocaleString()}. This week's preparation continues to work for you.</p>}
    {canCreate && !draft && <form className="weekly-boss-intake" onSubmit={e => { e.preventDefault(); run("Preparing your mission", async () => {
      const next = await livingSystemAction("prepare_weekly_boss", { intake });
      if (alive.current) setDraft(next);
    }); }}>
      <label>WHAT WOULD MAKE YOUR WEEK EASIER?<select value={intake.need} onChange={e => change("need", e.target.value)}>
        {WEEKLY_BOSS_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select></label>
      <div className="weekly-boss-fields"><label>DAYS TO COVER<select value={intake.days} onChange={e => change("days", Number(e.target.value))}>{[5, 6, 7].map(n => <option key={n}>{n}</option>)}</select></label>
        <label>PEOPLE<select value={intake.people} onChange={e => change("people", Number(e.target.value))}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></label></div>
      {intake.need !== "OUTFITS" && <>
        <label>FOOD STORAGE<select value={intake.storage} onChange={e => change("storage", e.target.value)}><option value="FREEZER">Fridge and freezer</option><option value="FRIDGE">Fridge only</option><option value="PANTRY">Dry pantry only</option></select></label>
        <label>ALLERGIES OR DIETARY RESTRICTIONS<textarea maxLength={400} value={intake.avoids} onChange={e => change("avoids", e.target.value)} placeholder="Leave blank only if none apply. A recipe must fit your restrictions."/></label>
      </>}
      <label>WHAT DO YOU ALREADY HAVE?<textarea maxLength={600} value={intake.available} onChange={e => change("available", e.target.value)} placeholder="Ingredients, containers, equipment or clothing you can use."/></label>
      <label>SPENDING LIMIT / CURRENCY<input maxLength={120} value={intake.budget} onChange={e => change("budget", e.target.value)} placeholder="Use what I have, or enter your own limit."/></label>
      <button type="submit" disabled={!!busy}>{busy || "PREPARE MY WEEKLY BOSS"}</button>
    </form>}
    {plan && <div className="weekly-boss-plan">
      <small>{plan.coverage_days} DAYS COVERED · {plan.estimated_minutes.join("–")} MIN ACTIVE PREPARATION</small>
      <h3>{plan.title}</h3><p className="weekly-boss-objective">{plan.objective}</p>
      <p className="weekly-boss-benefit">{plan.benefit}</p>
      <div className="weekly-boss-reward"><strong>+{boss?.xp_reward || plan.reward.xp} XP</strong>
        {Object.entries(plan.reward.attributes).map(([name, amount]) => <span key={name}>+{amount} {name}</span>)}</div>
      <h4>YOUR SUPPLIES</h4><ul>{plan.supplies.map(item => <li key={item}>{item}</li>)}</ul>
      {plan.intake.available && <p><strong>YOUR AVAILABLE SUPPLIES:</strong> {plan.intake.available}</p>}
      <p><strong>YOUR LIMIT:</strong> {plan.intake.budget}. Use what you have and check the cost of any missing supplies before starting.</p>
      {boss && <><div className="weekly-boss-progress" role="progressbar" aria-label="Preparation checkpoints" aria-valuemin={0} aria-valuemax={boss.objectives.length} aria-valuenow={completed}><i style={{ width: `${covered}%` }}/></div><p>{completed}/{boss.objectives.length} preparation checkpoints complete</p></>}
      <ol className="weekly-boss-steps">{plan.steps.map((step, index) => {
        const objective = boss?.objectives?.find(o => o.position === index + 1);
        return <li key={index}><div><strong>{step.title}</strong><p>{step.detail}</p></div>
          {objective && <label className="weekly-check"><input type="checkbox" checked={objective.is_complete} disabled={!!busy} onChange={e => {
            const complete = e.target.checked;
            run("Saving checkpoint", async () => {
              await livingSystemAction("weekly_boss_checkpoint", { objective_id: objective.id, complete }); await refresh();
            });
          }}/><span>Completed: {step.title}</span></label>}</li>;
      })}</ol>
      {plan.notes.map(note => <p key={note} className="weekly-boss-note">{note}</p>)}
      {plan.sources.map(source => <a key={source} href={source} target="_blank" rel="noreferrer">Food preparation and storage guidance ↗</a>)}
      {!boss && <div className="weekly-boss-actions">
        <button type="button" disabled={!!busy} onClick={() => setDraft(null)}>ADJUST MY SITUATION</button>
        <button type="button" disabled={!!busy} onClick={() => run("Opening your boss", async () => {
          await livingSystemAction("accept_weekly_boss", { plan_id: draft.id }); setDraft(null); await refresh(); await refreshPlayer();
        })}>{busy || "ACCEPT THIS BOSS"}</button>
      </div>}
      {boss && <form className="weekly-boss-proof" onSubmit={e => { e.preventDefault(); run("Reviewing your finished result", async () => {
        const proof = { type: "RESULT", detail: result.trim() + (answer.trim() ? `\nAdditional detail: ${answer.trim()}` : "") };
        const key = JSON.stringify(proof);
        const reviewTarget = String(boss.id);
        const assessment = canReuseApprovedReview(approved.current, key, reviewTarget) ? approved.current.review : await livingSystemAction("review_weekly_boss", { boss_id: boss.id, proof });
        setReview(assessment);
        if (assessment.decision !== "APPROVE") return;
        approved.current = { key, target: reviewTarget, review: assessment };
        const victory = await livingSystemAction("complete_weekly_boss", { boss_id: boss.id, review_id: assessment.id });
        // Refresh the character before dismissing the active boss, so a refresh failure is retryable.
        await refreshPlayer(); await refresh();
        setNotice(victory.duplicate ? "This victory is already recorded." : "Boss defeated. Your preparation and rewards are recorded.");
        setResult(""); setAnswer(""); setReview(null); approved.current = null;
      }); }}>
        <h4>SHOW THE FINISHED RESULT</h4><p>Tell THE SYSTEM what is ready, how many finished items you prepared, and how they are stored. Spelling does not need to be perfect.</p>
        <label>YOUR RESULT<textarea required maxLength={4500} value={result} onChange={e => setResult(e.target.value)} placeholder={`Example: ${plan.target_count} ${plan.unit} finished and stored. Explain the actual result.`}/></label>
        {review && <div className={`weekly-review review-${review.decision.toLowerCase()}`} role="status"><strong>{review.decision === "APPROVE" ? "RESULT ACCEPTED" : "SYSTEM REVIEW"}</strong><p>{review.reason}</p>{review.question && <p>{review.question}</p>}</div>}
        {review && review.decision !== "APPROVE" && <label>ADDITIONAL DETAIL<textarea maxLength={1000} value={answer} onChange={e => setAnswer(e.target.value)}/></label>}
        <button type="submit" disabled={!!busy || completed !== boss.objectives.length}>{busy || "SUBMIT FINISHED RESULT"}</button>
        {completed !== boss.objectives.length && <p>Complete your preparation checkpoints before submitting the final result.</p>}
        <button type="button" className="weekly-boss-retire" disabled={!!busy} onClick={() => run("Retiring this boss", async () => {
          await livingSystemAction("retire_weekly_boss", { boss_id: boss.id }); await refresh(); await refreshPlayer();
          setNotice("Boss retired without an XP penalty. The original seven-day window still applies.");
        })}>RETIRE THIS BOSS WITHOUT A PENALTY</button>
      </form>}
    </div>}
    {!boss && state?.latest?.status === "COMPLETE" && <div className="weekly-boss-last"><small>LAST WEEKLY VICTORY</small><h3>{state.latest.title}</h3><p>{state.latest.metadata?.weekly_plan?.benefit}</p></div>}
  </section>;
}
