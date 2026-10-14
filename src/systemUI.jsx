import React from "react";
import { createPortal } from "react-dom";

export function SectionLabel({
  number,
  title,
  danger,
}) {
  return (
    <div
      className={
        danger
          ? "section-label danger"
          : "section-label"
      }
    >
      <span>
        {number}
      </span>

      {title}
    </div>
  );
}

export function SystemField({
  label,
  children,
}) {
  return (
    <label className="system-field">
      <span>
        {label}
      </span>

      {children}
    </label>
  );
}

export function SystemModalPortal({
  children,
}) {
  const portalRoot =
    typeof document ===
    "undefined"
      ? null
      : document.getElementById(
          "system-modal-root"
        );

  return portalRoot
    ? createPortal(
        children,
        portalRoot
      )
    : children;
}

export function PageHero({
  eyebrow,
  title,
  text,
}) {
  return (
    <div className="page-hero card3d">
      <small>
        {eyebrow}
      </small>

      <h1>
        {title}
      </h1>

      <p>
        {text}
      </p>
    </div>
  );
}
