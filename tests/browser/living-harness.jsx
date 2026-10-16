import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QuestProofModal, Inventory, MusicEngine } from "../../src/SystemGame.jsx";
import WeeklyBoss from "../../src/WeeklyBoss.jsx";
import AchievementCelebration from "../../src/AchievementCelebration.jsx";
import { achievementEvents } from "../../src/systemAchievementCore.js";
import { normalizeProfile } from "../../src/systemProfileCore.js";
import "../../src/styles/system.css";
import "../../src/styles/stability.css";
window.qaProfile = normalizeProfile({ name: "QA HUNTER", path: "MAGE", age: 25, level: 10, streak: 3, fingerprint: "living-qa" });
window.qaWeeklyState = { has_key: true, can_assign: true, active: null, latest: null, server_now: new Date().toISOString(), next_available_at: new Date().toISOString() };
window.qaCompletions = 0;
window.qaProfile.attributes.SPEED = 12;
window.qaProfile.equipment = { bonuses: { SPEED: 0 }, items: [{ id: 101, slug: "runners-edge", name: "RUNNER'S EDGE", type: "GEAR", rarity: "RARE", power: 18, level: 5, bonus: "+5 SPEED", icon: "◈", equipped: false }] };
window.qaSetEquipment = ({ equipped }) => { window.qaProfile.equipment = { ...window.qaProfile.equipment, bonuses: { SPEED: equipped ? 5 : 0 }, items: window.qaProfile.equipment.items.map(item => ({ ...item, equipped })) }; };
function Harness() {
  const [dismissed, setDismissed] = useState(false);
  const [profile, setProfile] = useState(window.qaProfile);
  const [music, setMusic] = useState(false);
  const [musicPath, setMusicPath] = useState("MAGE");
  const [musicStatus, setMusicStatus] = useState("PAUSED");
  const mode = new URLSearchParams(location.search).get("mode");
  const event = achievementEvents(window.qaProfile, { ...window.qaProfile, level: 11, attributes: { ...window.qaProfile.attributes, DISCIPLINE: window.qaProfile.attributes.DISCIPLINE + 2 } })[0];
  return <div className={mode === "appearance" ? "app light class-assassin" : "app dark class-mage"} style={{ "--accent": mode === "appearance" ? "#ef4444" : "#a855f7", "--app-bg": mode === "appearance" ? "#fff4f4" : "#07040d", "--panel-bg": mode === "appearance" ? "#fff8f8" : "#13091d", padding: 20, minHeight: "100vh" }}>
    <button id="previous-focus">QA FOCUS TARGET</button>
    {mode === "celebration" && !dismissed && <AchievementCelebration event={event} onSound={() => { window.qaSounds = (window.qaSounds || 0) + 1; }} onDismiss={() => setDismissed(true)}/>}
    {mode === "proof" && !dismissed && <QuestProofModal quest={{ name: "READING", task: "Read for 20 minutes" }} proofType="RESULT" assignedFor="2026-10-16" close={() => setDismissed(true)} verified={async proof => { window.qaSubmittedProof = proof; window.qaCompletions++; setDismissed(true); }}/>}
    {mode === "boss" && <WeeklyBoss profile={window.qaProfile} applyAuthoritativeProfile={p => { window.qaAppliedProfile = p; }}/>}
    {mode === "inventory" && <Inventory profile={profile} saveProfile={() => {}} applyAuthoritativeProfile={p => { window.qaAppliedProfile = p; setProfile(p); }}/>}
    {mode === "music" && <><MusicEngine enabled={music} volume={0} path={musicPath} onStatus={setMusicStatus}/><p role="status">{musicStatus}</p><button onClick={() => setMusic(true)}>PLAY TEST MUSIC</button><button onClick={() => setMusic(false)}>PAUSE TEST MUSIC</button><button onClick={() => setMusicPath("ASSASSIN")}>ASSASSIN TRACK</button></>}
    {mode === "appearance" && <><div className="class-emblem-atmosphere" aria-hidden="true"/><section className="page"><h1>ASSASSIN</h1><p>LIGHT MODE / PRECISION AND SPEED</p><article className="card3d" style={{ padding: 24, maxWidth: 440 }}><h2>YOUR NEXT QUEST</h2><p>The crimson artwork remains visible while quest text stays clear.</p></article></section></>}
    {dismissed && <p role="status">QA flow complete</p>}
    <div id="system-modal-root"/>
  </div>;
}
createRoot(document.getElementById("root")).render(<React.StrictMode><Harness/></React.StrictMode>);
