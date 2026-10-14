import fs from "node:fs";
import path from "node:path";

const sampleRate = 44100;
const outputDir = path.resolve("public/sfx");
fs.mkdirSync(outputDir, { recursive: true });

function envelope(t, duration, attack = 0.008, release = 0.16) {
  const inRamp = Math.min(1, t / attack);
  const outRamp = Math.min(1, (duration - t) / release);
  return Math.max(0, Math.min(inRamp, outRamp));
}

function sine(frequency, time) {
  return Math.sin(Math.PI * 2 * frequency * time);
}

function writeWav(fileName, duration, render) {
  const frames = Math.ceil(sampleRate * duration);
  const pcm = Buffer.alloc(frames * 2);

  for (let index = 0; index < frames; index += 1) {
    const time = index / sampleRate;
    const sample = Math.max(-1, Math.min(1, render(time, duration)));
    pcm.writeInt16LE(Math.round(sample * 0x7fff), index * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  fs.writeFileSync(path.join(outputDir, fileName), Buffer.concat([header, pcm]));
}

writeWav("click.wav", 0.09, (t, duration) => {
  const gain = envelope(t, duration, 0.002, 0.06);
  return gain * (0.46 * sine(880, t) + 0.16 * sine(1760, t));
});

writeWav("success.wav", 0.56, (t, duration) => {
  const first = t < 0.26 ? 640 : 0;
  const second = t >= 0.08 ? 960 : 0;
  const firstGain = first ? envelope(t, 0.27, 0.008, 0.15) : 0;
  const secondGain = second ? envelope(Math.max(0, t - 0.08), 0.48, 0.008, 0.23) : 0;
  return 0.36 * firstGain * sine(first, t) + 0.32 * secondGain * sine(second, t);
});

writeWav("impact.wav", 0.5, (t, duration) => {
  const gain = envelope(t, duration, 0.003, 0.28);
  const frequency = 104 - Math.min(62, t * 170);
  const noise = Math.sin(t * 9127.13) * Math.sin(t * 1731.77);
  return gain * (0.65 * sine(frequency, t) + 0.12 * noise);
});

writeWav("levelup.wav", 1.0, (t, duration) => {
  const notes = [260, 390, 520, 780];
  let signal = 0;

  notes.forEach((frequency, index) => {
    const start = index * 0.16;
    if (t < start) return;
    const local = t - start;
    const gain = envelope(local, 0.62, 0.01, 0.3) * (0.26 - index * 0.025);
    signal += gain * (sine(frequency, local) + 0.24 * sine(frequency * 2, local));
  });

  return signal;
});

