export const CLASS_TRACKS = Object.freeze({ ASSASSIN: "/music/assassin.mp3", TANK: "/music/tank.mp3", MAGE: "/music/mage.mp3", RANGER: "/music/ranger.mp3", COMMANDER: "/music/commander.mp3" });

export function soundtrackVolume(raw, fallback = 0.3) {
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

export function createClassSoundtrack({ createAudio, onStatus = () => {} }) {
  let audio = null, path = null, enabled = false, visible = true, volume = 0.3;
  let generation = 0, pending = false, disposed = false;
  const publish = status => { if (!disposed) onStatus(status); };
  function release() {
    generation++; pending = false;
    if (audio) { audio.pause(); audio.removeEventListener?.("error", audio.systemError); audio.removeAttribute?.("src"); audio.load?.(); }
    audio = null;
  }
  function play() {
    if (audio?.error) release();
    if (!enabled || !visible || disposed || pending) return;
    if (!audio) {
      audio = createAudio(CLASS_TRACKS[path] || CLASS_TRACKS.COMMANDER);
      audio.loop = true; audio.preload = "auto";
      audio.systemError = () => { pending = false; publish("ERROR"); };
      audio.addEventListener?.("error", audio.systemError);
    }
    audio.volume = volume;
    if (!audio.paused) return;
    const track = audio, token = generation;
    pending = true; publish("STARTING");
    let attempt;
    try { attempt = track.play(); } catch (error) { attempt = Promise.reject(error); }
    Promise.resolve(attempt).then(() => {
      if (track !== audio || token !== generation || disposed) return;
      pending = false;
      if (!enabled || !visible) { track.pause(); publish("PAUSED"); }
      else publish("PLAYING");
    }).catch(error => {
      if (track !== audio || token !== generation || disposed) return;
      pending = false;
      publish(!enabled || !visible ? "PAUSED" : error?.name === "NotAllowedError" ? "BLOCKED" : "ERROR");
    });
  }
  return {
    configure(next) {
      if (disposed) return;
      if (next.path !== path) { release(); path = next.path; }
      volume = soundtrackVolume(next.volume);
      enabled = !!next.enabled;
      if (audio) audio.volume = volume;
      if (enabled && visible) play();
      else { audio?.pause(); publish("PAUSED"); }
    },
    setEnabled(value) {
      enabled = !!value;
      if (enabled) play(); else { audio?.pause(); publish("PAUSED"); }
    },
    setVisible(value) {
      visible = !!value;
      if (visible) play(); else { audio?.pause(); publish("PAUSED"); }
    },
    dispose() { disposed = true; release(); },
  };
}
