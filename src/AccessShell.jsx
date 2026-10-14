import React from "react";
import "./styles/access.css";
import { AccessClassBackdrop, AccessClassPreview, useAccessClassScene } from "./AccessClassScene.jsx";

export default function AccessShell({ children, foundation = false }) {
  const scene = useAccessClassScene();
  return (
    <main className={`access-screen${foundation ? " access-foundation" : ""}`} style={{ "--scene-accent": scene.current.color }}>
      <AccessClassBackdrop scene={scene} />
      <div className="access-topline">
        <header className="access-brand"><span>S</span><div>THE SYSTEM<small>REAL LIFE / RPG</small></div></header>
      </div>
      <div className="access-layout">
        <aside className="access-story">
          <AccessClassPreview scene={scene} />
          <small className="access-eyebrow">YOUR NEXT LEVEL STARTS HERE</small>
          <h1>Real actions.<br/><em>Lasting growth.</em></h1>
          <p>{foundation ? "Build a starting plan around your life. We suggest a direction. You choose the class and the pace." : "Turn the things you do into the person you become. Train, learn and complete real quests with a plan that fits your day."}</p>
          <div className="access-principles"><span>CHOOSE YOUR PATH</span><span>EARN YOUR PROGRESS</span><span>BUILD YOUR ROUTINE</span></div>
        </aside>
        <div className="access-form-region">{children}</div>
      </div>
      <footer className="access-footer">SMALL ACTIONS. EVERY DAY.</footer>
    </main>
  );
}
