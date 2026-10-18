import React, { useEffect, useRef } from "react";
import { SystemModalPortal } from "./systemUI.jsx";
import "./styles/achievements.css";

const PATH_MARKS = {
  ASSASSIN: "✕",
  TANK: "⬟",
  MAGE: "✧",
  RANGER: "➶",
  COMMANDER: "✥",
};

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
  const playerClass = String(path || "COMMANDER").toUpperCase();
  const kind = String(event.kind || "LEVEL").toUpperCase();
  const level = Number(event.level);
  const levelLabel = Number.isFinite(level) && level > 0 ? String(level).padStart(2, "0") : "UP";
  const gains = Array.isArray(event.gains) ? event.gains : [];
  const hasGains = gains.length > 0;
  const status = kind === "BOSS"
    ? "BOSS CLEAR // CONFIRMED"
    : kind === "ASCENSION"
      ? "ASCENSION // UNLOCKED"
      : kind === "RANK"
        ? "RANK PROMOTION // CONFIRMED"
        : "LEVEL UP // CONFIRMED";
  const progressValue = Number(event.xp) > 0
    ? `+${Number(event.xp)} XP`
    : kind === "BOSS"
      ? "VICTORY"
      : `LVL ${levelLabel}`;

  return (
    <SystemModalPortal>
      <div
        className={`achievement-overlay achievement-path-${playerClass.toLowerCase()} achievement-kind-${kind.toLowerCase()}`}
        data-player-class={playerClass}
        data-kind={kind}
      >
        <section
          ref={dialog}
          className="achievement-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="achievement-heading"
          onKeyDown={e => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onDismiss();
            }
            if (e.key === "Tab") {
              e.preventDefault();
              dialog.current?.querySelector("button")?.focus();
            }
          }}
        >
          <header className="achievement-topline">
            <span className="achievement-signal"><i aria-hidden="true" /> SYSTEM SIGNAL</span>
            <span className="achievement-path-label">{playerClass} PATH</span>
          </header>

          <div className="achievement-divider" aria-hidden="true"><span /></div>

          <div className="achievement-hero">
            <div className="achievement-emblem" aria-hidden="true">
              <svg viewBox="0 0 120 120">
                <path className="achievement-emblem-outer" d="M60 5 108 32v56l-48 27L12 88V32Z" />
                <path className="achievement-emblem-inner" d="M60 17 97 38v44l-37 21L23 82V38Z" />
                <path className="achievement-emblem-orbit" d="M17 60h14M89 60h14M60 17v12M60 91v12" />
              </svg>
              <span>{PATH_MARKS[playerClass] || PATH_MARKS.COMMANDER}</span>
            </div>

            <div className="achievement-heading-group">
              <p className="achievement-kicker">{status}</p>
              <h2 id="achievement-heading">{event.title}</h2>
              <span className="achievement-verified"><span aria-hidden="true">✓</span> RECORD VERIFIED</span>
            </div>

            <div className="achievement-level-stamp" aria-label={`Level ${levelLabel}`}>
              <small>LEVEL</small>
              <strong>{levelLabel}</strong>
              <span>PLAYER</span>
            </div>
          </div>

          <div className="achievement-name-panel">
            <div className="achievement-panel-label"><span>01</span> // MILESTONE ACQUIRED</div>
            <strong className="achievement-name">{event.name}</strong>
            <p>{event.description || "Your effort has been recorded. Keep moving forward."}</p>
          </div>

          <div className="achievement-metrics">
            <div className="achievement-metric achievement-metric-primary">
              <span className="achievement-metric-label">{Number(event.xp) > 0 ? "EXPERIENCE EARNED" : "PROGRESSION STATUS"}</span>
              <strong>{progressValue}</strong>
              <small>{Number(event.xp) > 0 ? "ADDED TO YOUR RECORD" : "MILESTONE RECORDED"}</small>
            </div>
            <div className="achievement-metric">
              <span className="achievement-metric-label">{hasGains ? "ATTRIBUTE GAINS" : "SYSTEM RECORD"}</span>
              <strong>{hasGains ? `${gains.length} UPDATE${gains.length === 1 ? "" : "S"}` : "CONFIRMED"}</strong>
              <small>{hasGains ? "CHARACTER PROFILE" : "PLAYER PROFILE"}</small>
            </div>
          </div>

          {hasGains && (
            <div className="achievement-gains-wrap">
              <div className="achievement-panel-label"><span>02</span> // ATTRIBUTE CHANGES</div>
              <ul className="achievement-gains">
                {gains.map(gain => (
                  <li key={gain.name}>
                    <span>{gain.name}</span>
                    <b>+{gain.delta}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button className="achievement-continue" type="button" onClick={onDismiss}>
            <span>CONTINUE</span>
            <span className="achievement-continue-arrow" aria-hidden="true">↗</span>
          </button>

          <footer className="achievement-footer">
            <span><i aria-hidden="true" /> PROGRESS RECORD UPDATED</span>
            <span>THE SYSTEM / {kind}</span>
          </footer>
        </section>
      </div>
    </SystemModalPortal>
  );
}
