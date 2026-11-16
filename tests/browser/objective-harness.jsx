import React from "react";
import { createRoot } from "react-dom/client";
import QuestObjectivesPanel from "../../src/QuestObjectivesPanel.jsx";
import { normalizeProfile } from "../../src/systemProfileCore.js";
import "../../src/styles/system.css";
import "../../src/styles/stability.css";

const profile = normalizeProfile({ name: "QA HUNTER", path: "MAGE", age: 25, level: 10, streak: 4 });
const identity = { primary: "DISCIPLINE", secondary: ["PHYSICAL", "INTELLECT"] };
function App() {
  return <main className="app dark class-mage" style={{minHeight:"100vh",padding:20,"--accent":"#a855f7","--app-bg":"#07040d","--panel-bg":"#13091d"}}>
    <h1>NO ZERO DAY</h1>
    <QuestObjectivesPanel userQuestId="qa-parent-quest" identity={identity} profile={profile} onProfileUpdated={() => {window.qaProfileRefreshes=(window.qaProfileRefreshes||0)+1;}} />
  </main>;
}
createRoot(document.getElementById("root")).render(<App/>);