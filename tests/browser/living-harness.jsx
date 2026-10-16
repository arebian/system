import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QuestProofModal } from "../../src/SystemGame.jsx";
import WeeklyBoss from "../../src/WeeklyBoss.jsx";
import AchievementCelebration from "../../src/AchievementCelebration.jsx";
import { achievementEvents } from "../../src/systemAchievementCore.js";
import { normalizeProfile } from "../../src/systemProfileCore.js";
import "../../src/styles/system.css";
window.qaProfile = normalizeProfile({ name: "QA HUNTER", path: "MAGE", age: 25, level: 10, streak: 3, fingerprint: "living-qa" });
window.qaWeeklyState = { has_key: true, can_assign: true, active: null, latest: null, server_now: new Date().toISOString(), next_available_at: new Date().toISOString() };
window.qaCompletions = 0;
function Harness() {
  const [dismissed, setDismissed] = useState(false);
  const mode = new URLSearchParams(location.search).get("mode");
  const event = achievementEvents(window.qaProfile, { ...window.qaProfile, level: 11, attributes: { ...window.qaProfile.attributes, DISCIPLINE: window.qaProfile.attributes.DISCIPLINE + 2 } })[0];
  return <div className="app dark class-mage" style={{ "--accent": "#a855f7", "--app-bg": "#07040d", "--panel-bg": "#13091d", padding: 20 }}>
    <button id="previous-focus">QA FOCUS TARGET</button>
    {mode === "celebration" && !dismissed && <AchievementCelebration event={event} onSound={() => { window.qaSounds = (window.qaSounds || 0) + 1; }} onDismiss={() => setDismissed(true)}/>}
    {mode === "proof" && !dismissed && <QuestProofModal quest={{ name: "READING", task: "Read for 20 minutes" }} proofType="RESULT" assignedFor="2026-10-16" close={() => setDismissed(true)} verified={async proof => { window.qaSubmittedProof = proof; window.qaCompletions++; setDismissed(true); }}/>}
    {mode === "boss" && <WeeklyBoss profile={window.qaProfile} applyAuthoritativeProfile={p => { window.qaAppliedProfile = p; }}/>}
    {dismissed && <p role="status">QA flow complete</p>}
    <div id="system-modal-root"/>
  </div>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><Harness/></React.StrictMode>);
