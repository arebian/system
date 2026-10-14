import React, { useEffect, useState } from "react";

const CLASSES = [
  { name: "COMMANDER", image: "/class-emblems/commander.png", color: "#e9b760", detail: "Presence. Leadership. Resolve." },
  { name: "TANK", image: "/class-emblems/tank.png", color: "#c69256", detail: "Strength. Resilience. Endurance." },
  { name: "RANGER", image: "/class-emblems/ranger.png", color: "#68c9a4", detail: "Movement. Adaptability. Stamina." },
  { name: "MAGE", image: "/class-emblems/mage.png", color: "#b595ed", detail: "Knowledge. Focus. Insight." },
  { name: "ASSASSIN", image: "/class-emblems/assassin-crimson.png", color: "#e37c87", detail: "Precision. Speed. Discipline." },
];

export function useAccessClassScene() {
  const [frame, setFrame] = useState({ current: 0, previous: null });
  const [visible, setVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const moving = !reducedMotion && visible;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!moving) return;
    let cancelled = false;
    const next = (frame.current + 1) % CLASSES.length;
    // Load only the next artwork. A slow or missing image never blocks the form.
    const image = new Image();
    let loaded = false;
    let elapsed = false;
    const advance = () => {
      if (!cancelled && loaded && elapsed && !document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) setFrame({ current: next, previous: frame.current });
    };
    const ready = () => { loaded = true; advance(); };
    const prepare = () => {
      image.decode().then(ready, () => {
        if (image.naturalWidth > 0) ready();
      });
    };
    image.onload = prepare;
    image.src = CLASSES[next].image;
    if (image.complete && image.naturalWidth > 0) prepare();
    const timer = window.setTimeout(() => {
      elapsed = true;
      advance();
    }, 9000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      image.onload = null;
    };
  }, [moving, frame.current]);

  useEffect(() => {
    if (frame.previous === null) return;
    const timer = window.setTimeout(() => setFrame(current => ({ ...current, previous: null })), 2400);
    return () => window.clearTimeout(timer);
  }, [frame.current, frame.previous]);

  return {
    current: CLASSES[frame.current],
    index: frame.current,
    layers: [frame.previous, frame.current].filter(index => index !== null).map(index => ({ ...CLASSES[index], leaving: index !== frame.current })),
    moving,
  };
}

function ArtworkLayers({ scene }) {
  return scene.layers.map(layer => (
    <img
      key={layer.name}
      src={layer.image}
      className={`access-class-image${layer.leaving ? " is-leaving" : ""}`}
      alt=""
      width="720"
      height="720"
      decoding="async"
      draggable="false"
    />
  ));
}

export function AccessClassBackdrop({ scene }) {
  return (
    <div className="access-class-backdrop" aria-hidden="true" data-moving={scene.moving} data-background-class={scene.current.name}>
      <div className="access-class-halo">{scene.layers.map(layer => <div key={layer.name} className={`access-class-halo-color${layer.leaving ? " is-leaving" : ""}`} style={{ backgroundColor: layer.color }} />)}</div>
      <div className="access-class-background-art"><ArtworkLayers scene={scene} /></div>
      <div className="access-class-shade" />
    </div>
  );
}

export function AccessClassPreview({ scene }) {
  return (
    <div className="access-class-preview" data-preview-class={scene.current.name}>
      <div className="access-class-mark" aria-hidden="true" data-moving={scene.moving}>
        <div className="access-class-orbit"><i/><i/><i/></div>
        <ArtworkLayers scene={scene} />
      </div>
      <div className="access-class-caption" key={scene.current.name}>
        <small>CLASS PREVIEW · {String(scene.index + 1).padStart(2, "0")} / 05</small>
        <strong>{scene.current.name}</strong>
        <span>{scene.current.detail}</span>
        <div className="access-class-dots" aria-hidden="true">{CLASSES.map(item => <i key={item.name} className={item.name === scene.current.name ? "active" : ""}/>)}</div>
      </div>
    </div>
  );
}

