import React, { useCallback, useEffect, useRef, useState } from "react";
import { SystemModalPortal } from "./systemUI.jsx";
import {
  allocateAttributeCreditOnBackend,
  bootstrapAuthoritativeProfile,
  hydrateStructuredProfile,
  loadAttributeCredits,
} from "./systemCloud.js";
import { normalizeProfile } from "./systemProfileCore.js";
import { getAttributeTier, normalizeAttributeCredit } from "./systemAttributesCore.js";
import "./styles/achievements.css";

export default function AchievementCelebration({
  event,
  onDismiss,
  onSound,
  profile,
  applyAuthoritativeProfile,
}) {
  const dialog = useRef(null);
  const played = useRef(new Set());
  const [credits, setCredits] = useState([]);
  const [ledgerStatus, setLedgerStatus] = useState("IDLE");
  const [ledgerError, setLedgerError] = useState("");
  const [ledgerNotice, setLedgerNotice] = useState("");
  const [allocatingKey, setAllocatingKey] = useState("");

  const path = String(profile?.path || "COMMANDER").toUpperCase();
  const pendingCredits = credits.filter((credit) => credit.available > 0);
  const availableCreditTotal = pendingCredits.reduce(
    (sum, credit) => sum + credit.available,
    0
  );

  const refreshCredits = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLedgerStatus("LOADING");
    setLedgerError("");

    try {
      const rows = await loadAttributeCredits();
      setCredits(rows.map(normalizeAttributeCredit));
      setLedgerStatus("READY");
      return true;
    } catch (error) {
      console.warn("ATTRIBUTE CREDIT LEDGER DEFERRED:", error);
      setLedgerStatus("DEGRADED");
      setLedgerError(
        error?.message || "ATTRIBUTE_CREDIT_LEDGER_UNAVAILABLE"
      );
      return false;
    }
  }, []);

  useEffect(() => {
    if (!event) {
      setCredits([]);
      setLedgerStatus("IDLE");
      setLedgerError("");
      setLedgerNotice("");
      setAllocatingKey("");
      return undefined;
    }

    let active = true;
    setLedgerStatus("LOADING");
    setLedgerError("");
    setLedgerNotice("");

    loadAttributeCredits()
      .then((rows) => {
        if (!active) return;
        setCredits(rows.map(normalizeAttributeCredit));
        setLedgerStatus("READY");
      })
      .catch((error) => {
        if (!active) return;
        console.warn("ATTRIBUTE CREDIT LEDGER DEFERRED:", error);
        setLedgerStatus("DEGRADED");
        setLedgerError(
          error?.message || "ATTRIBUTE_CREDIT_LEDGER_UNAVAILABLE"
        );
      });

    return () => {
      active = false;
    };
  }, [event?.id]);

  useEffect(() => {
    if (!event) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      dialog.current?.querySelector("[data-initial-focus]")?.focus();
    });

    if (!played.current.has(event.id)) {
      played.current.add(event.id);
      onSound?.(event.kind === "BOSS" ? "success" : "levelup");
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) {
        previousFocus.focus?.({ preventScroll: true });
      }
    };
  }, [event?.id, onSound]);

  async function allocateCredit(credit, attribute) {
    const actionKey = credit.id + ":" + attribute;
    if (allocatingKey) return;

    setAllocatingKey(actionKey);
    setLedgerError("");
    setLedgerNotice("");

    try {
      await allocateAttributeCreditOnBackend({
        creditId: credit.id,
        attribute,
        amount: 1,
      });

      const cloud = await bootstrapAuthoritativeProfile();
      if (!cloud) {
        throw new Error("AUTHORITATIVE_REFRESH_FAILED");
      }

      const hydrated = await hydrateStructuredProfile(cloud);
      applyAuthoritativeProfile?.(normalizeProfile(hydrated));

      const refreshed = await refreshCredits({ silent: true });
      if (!refreshed) {
        setLedgerNotice("ALLOCATION SAVED • CREDIT BALANCE NEEDS SYNC");
      } else {
        setLedgerNotice("+1 " + attribute + " • ALLOCATION CONFIRMED");
      }
    } catch (error) {
      console.error("ATTRIBUTE CREDIT ALLOCATION FAILED:", error);
      setLedgerError(
        error?.message || "ATTRIBUTE_CREDIT_ALLOCATION_FAILED"
      );
    } finally {
      setAllocatingKey("");
    }
  }

  if (!event) return null;

  return (
    <SystemModalPortal>
      <div className="achievement-overlay" data-class={path}>
        <section
          ref={dialog}
          className="achievement-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="achievement-heading"
          aria-describedby="achievement-description"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !allocatingKey) {
              e.stopPropagation();
              onDismiss();
            }

            if (e.key === "Tab") {
              const focusable = Array.from(
                dialog.current?.querySelectorAll(
                  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                ) || []
              );
              if (!focusable.length) {
                e.preventDefault();
                return;
              }

              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
        >
          <div className="achievement-hud-top">
            <span className="achievement-live-dot" />
            <span>THE SYSTEM</span>
            <span className="achievement-hud-divider">/</span>
            <span>CHARACTER GROWTH PROTOCOL</span>
            <span className="achievement-hud-status">ONLINE</span>
          </div>

          <div className="achievement-layout">
            <aside className="achievement-side-rail" aria-label="Character status">
              <div className="achievement-emblem" aria-hidden="true">
                <svg viewBox="0 0 160 160">
                  <path d="M80 8 142 44v72l-62 36-62-36V44Z" />
                  <path d="M80 27 125 53v54l-45 26-45-26V53Z" />
                  <path d="m49 83 21 21 43-48" />
                </svg>
              </div>
              <span className="achievement-rail-label">ACTIVE CLASS</span>
              <strong className="achievement-class-name">{path}</strong>
              <div className="achievement-rail-rule" />
              <span className="achievement-rail-label">CURRENT LEVEL</span>
              <strong className="achievement-level-number">
                {Number(event.level || profile?.level) > 0
                  ? Number(event.level || profile?.level)
                  : "—"}
              </strong>
              <span className="achievement-rank-label">
                {event.rank || "SYSTEM VERIFIED"}
              </span>
              <div className="achievement-rail-footer">
                <span>SYNC</span>
                <span className="achievement-rail-status">
                  {ledgerStatus === "READY"
                    ? "LINKED"
                    : ledgerStatus === "DEGRADED"
                      ? "RETRY"
                      : "CONNECTING"}
                </span>
              </div>
            </aside>

            <div className="achievement-main">
              <div className="achievement-event-label">
                <span>▸</span> {event.title || "PROGRESSION UPDATED"}
              </div>
              <h2 id="achievement-heading" className="achievement-name">
                {event.name || "CHARACTER ADVANCED"}
              </h2>
              <p id="achievement-description" className="achievement-description">
                {event.description || "Your next step starts with the points you choose."}
              </p>

              <section className="achievement-credit-console" aria-label="Attribute credit allocation">
                <div className="achievement-credit-heading">
                  <div>
                    <span className="achievement-section-kicker">GROWTH INTERFACE / 01</span>
                    <h3>ALLOCATE CREDITS</h3>
                  </div>
                  <div className="achievement-credit-count" aria-live="polite">
                    <strong>{ledgerStatus === "LOADING" ? "…" : availableCreditTotal}</strong>
                    <span>AVAILABLE</span>
                  </div>
                </div>

                {ledgerNotice && (
                  <div className="achievement-credit-feedback success" role="status">
                    <span aria-hidden="true">✓</span> {ledgerNotice}
                  </div>
                )}

                {ledgerError && (
                  <div className="achievement-credit-feedback error" role="alert">
                    <span aria-hidden="true">!</span>
                    <span>{String(ledgerError).replace(/_/g, " ").toUpperCase()}</span>
                    <button
                      type="button"
                      className="achievement-retry"
                      onClick={() => refreshCredits()}
                      disabled={ledgerStatus === "LOADING" || Boolean(allocatingKey)}
                    >
                      RETRY
                    </button>
                  </div>
                )}

                {ledgerStatus === "LOADING" && (
                  <div className="achievement-credit-empty" role="status">
                    <span className="achievement-loader" />
                    <div>
                      <strong>SYNCING CREDIT LEDGER</strong>
                      <p>Checking verified, unspent attribute credits…</p>
                    </div>
                  </div>
                )}

                {ledgerStatus !== "LOADING" && ledgerStatus !== "DEGRADED" &&
                  pendingCredits.length === 0 && (
                    <div className="achievement-credit-empty">
                      <span className="achievement-empty-symbol" aria-hidden="true">◇</span>
                      <div>
                        <strong>NO UNSPENT CREDITS</strong>
                        <p>Credits earned from verified quests will appear here. Nothing is spent until you choose an attribute.</p>
                      </div>
                    </div>
                  )}

                <div className="achievement-credit-list">
                  {pendingCredits.map((credit) => (
                    <article key={credit.id} className="achievement-credit-card">
                      <div className="achievement-credit-card-head">
                        <div>
                          <span className="achievement-credit-source">VERIFIED QUEST CREDIT</span>
                          <h4>{credit.sourceTitle}</h4>
                          <p>{credit.sourceCategory} DIRECTIVE</p>
                        </div>
                        <div className="achievement-credit-remaining">
                          <strong>{credit.available}</strong>
                          <span>LEFT</span>
                        </div>
                      </div>

                      <div className="achievement-credit-options">
                        {credit.eligibleAttributes.map((attribute) => {
                          const tier = getAttributeTier(path, attribute);
                          const actionKey = credit.id + ":" + attribute;
                          const busy = allocatingKey === actionKey;

                          return (
                            <button
                              key={attribute}
                              type="button"
                              className={"achievement-credit-option is-" + tier.toLowerCase()}
                              disabled={Boolean(allocatingKey) || ledgerStatus !== "READY"}
                              onClick={() => allocateCredit(credit, attribute)}
                              aria-label={"Allocate one credit to " + attribute}
                            >
                              <span className="achievement-option-tier">{tier}</span>
                              <strong>{busy ? "ALLOCATING…" : attribute}</strong>
                              <span className="achievement-option-action">
                                {busy ? "SYNCING" : "+1 POINT"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {!credit.eligibleAttributes.length && (
                        <p className="achievement-credit-no-options">
                          No eligible attributes are available for this credit.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <div className="achievement-bottom-row">
                <span className="achievement-save-state">
                  <span aria-hidden="true">◆</span> ALLOCATIONS ARE SERVER-VERIFIED
                </span>
                <button
                  type="button"
                  className="achievement-dismiss"
                  onClick={onDismiss}
                  disabled={Boolean(allocatingKey)}
                  data-initial-focus
                >
                  {availableCreditTotal > 0 ? "LATER" : "RETURN TO SYSTEM"}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SystemModalPortal>
  );
}
