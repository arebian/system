import React, { useEffect, useRef } from "react";
import { SystemModalPortal } from "./systemUI.jsx";
import "./styles/achievements.css";

export default function AchievementCelebration({ event, onDismiss, onSound, path = "COMMANDER" }) {
  const dialog = useRef(null);
  const played = useRef(new Set());
  useEffect(() => {
    if (!event) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector("button")?.focus();
    if (!played.current.has(event.id)) {
      played.current.add(event.id);
      onSound?.(event.kind === "BOSS" ? "success" : "levelup");
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    };
  }, [event?.id]);
  if (!event) return null;
  const major = event.kind !== "LEVEL";
  return <SystemModalPortal>
    <div className={`achievement-overlay achievement-path-${String(path || "COMMANDER").toLowerCase()} ${major ? "achievement-major" : ""}`} data-player-class={String(path || "COMMANDER").toUpperCase()}>
      <section ref={dialog} className="achievement-dialog" role="dialog" aria-modal="true" aria-labelledby="achievement-heading"
        onKeyDown={e => {
          if (e.key === "Escape") { e.stopPropagation(); onDismiss(); }
          if (e.key === "Tab") { e.preventDefault(); dialog.current?.querySelector("button")?.focus(); }
        }}>
        <small>THE SYSTEM / ACHIEVEMENT RECORDED</small>
        <div className="achievement-emblem" aria-hidden="true">
          <svg viewBox="0 0 160 160"><path d="M80 8 142 44v72l-62 36-62-36V44Z"/><path d="m80 27 45 26v54l-45 26-45-26V53Z"/><path d="m49 83 21 21 43-48"/></svg>
        </div>
        <h2 id="achievement-heading">{event.title}</h2>
        <strong className="achievement-name">{event.name}</strong>
        {event.kind === "RANK" && <p className="achievement-level">LEVEL {event.level} REACHED</p>}
        <p>{event.description}</p>
        {event.xp > 0 && <div className="achievement-xp">+{event.xp} XP RECORDED</div>}
        {!!event.gains?.length && <ul className="achievement-gains">{event.gains.map(gain =>
          <li key={gain.name}><span>{gain.name}</span><b>+{gain.delta}</b></li>)}</ul>}
        <button type="button" onClick={onDismiss}>CONTINUE <span aria-hidden="true">→</span></button>
        <small>YOUR PROGRESS IS SAVED</small>
      </section>
    </div>
  </SystemModalPortal>;
}
