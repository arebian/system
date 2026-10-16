import test from "node:test";
import assert from "node:assert/strict";
import { createClassSoundtrack, soundtrackVolume } from "../src/systemMusicCore.js";

const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const tracks = [], statuses = [];
  const controller = createClassSoundtrack({ onStatus: value => statuses.push(value), createAudio: src => {
    const track = { src, paused: true, plays: 0, currentTime: 17, pause() { this.paused = true; }, async play() { this.plays++; this.paused = false; }, addEventListener() {}, removeEventListener() {}, removeAttribute() {}, load() {} };
    tracks.push(track); return track;
  } });
  return { controller, tracks, statuses };
}
test("saved silence remains zero and invalid volumes use the default", () => {
  assert.equal(soundtrackVolume("0"), 0);
  assert.equal(soundtrackVolume(null), 0.3);
  assert.equal(soundtrackVolume("bad"), 0.3);
});
test("class music starts only when enabled, switches without overlap and resumes after visibility changes", async () => {
  const f = fixture();
  f.controller.configure({ enabled: false, path: "MAGE", volume: 0 });
  assert.equal(f.tracks.length, 0);
  f.controller.setEnabled(true); await tick();
  assert.equal(f.tracks[0].volume, 0);
  assert.equal(f.statuses.at(-1), "PLAYING");
  f.controller.configure({ enabled: true, path: "ASSASSIN", volume: 0.4 }); await tick();
  assert.equal(f.tracks[0].paused, true);
  assert.equal(f.tracks[1].src, "/music/assassin.mp3");
  f.controller.setVisible(false); assert.equal(f.tracks[1].paused, true);
  f.controller.setVisible(true); await tick(); assert.equal(f.tracks[1].paused, false);
  assert.equal(f.tracks[1].currentTime, 17);
  f.controller.dispose(); assert.equal(f.tracks[1].paused, true);
});
test("autoplay rejection is visible and an intentional retry recovers", async () => {
  const statuses = []; let blocked = true;
  const audio = { paused: true, pause() { this.paused = true; }, play() { if (blocked) return Promise.reject(Object.assign(new Error(), { name: "NotAllowedError" })); this.paused = false; return Promise.resolve(); } };
  const controller = createClassSoundtrack({ createAudio: () => audio, onStatus: status => statuses.push(status) });
  controller.configure({ enabled: true, path: "RANGER", volume: 0.3 }); await tick();
  assert.equal(statuses.at(-1), "BLOCKED");
  blocked = false; controller.setEnabled(true); await tick();
  assert.equal(statuses.at(-1), "PLAYING"); controller.dispose();
});
test("a delayed play promise cannot restart a stopped or replaced track", async () => {
  const pending = []; const tracks = []; const statuses = [];
  const controller = createClassSoundtrack({ onStatus: s => statuses.push(s), createAudio: () => {
    const audio = { paused: true, pause() { this.paused = true; }, play() { return new Promise(resolve => pending.push(resolve)); } };
    tracks.push(audio); return audio;
  } });
  controller.configure({ enabled: true, path: "MAGE", volume: 0.3 });
  controller.configure({ enabled: true, path: "TANK", volume: 0.3 });
  pending[0](); await tick(); assert.notEqual(statuses.at(-1), "PLAYING");
  controller.setEnabled(false); pending[1](); await tick();
  assert.equal(tracks[1].paused, true); assert.equal(statuses.at(-1), "PAUSED"); controller.dispose();
});
