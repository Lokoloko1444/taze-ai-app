/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const sampleRate = 44100;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function writeWav16Mono(filePath, floatSamples) {
  const numSamples = floatSamples.length;
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM
  buffer.writeUInt16LE(1, 20); // format
  buffer.writeUInt16LE(1, 22); // channels
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i += 1) {
    const s = Math.max(-1, Math.min(1, floatSamples[i]));
    const int16 = Math.round(s * 32767);
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

function renderSequence(sequence, { volume = 0.35 } = {}) {
  const vol = clamp01(volume);
  const samples = [];

  sequence.forEach((step) => {
    const toneSamples = Math.floor((step.durationMs / 1000) * sampleRate);
    const silenceSamples = Math.floor(((step.silenceAfterMs ?? 0) / 1000) * sampleRate);
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.01), Math.floor(toneSamples / 4));

    for (let i = 0; i < toneSamples; i += 1) {
      const t = i / sampleRate;
      const raw = step.freq > 0 ? Math.sin(2 * Math.PI * step.freq * t) : 0;
      const fadeIn = fadeSamples > 0 ? Math.min(1, i / fadeSamples) : 1;
      const fadeOut = fadeSamples > 0 ? Math.min(1, (toneSamples - i) / fadeSamples) : 1;
      const env = Math.max(0, Math.min(1, fadeIn * fadeOut));
      samples.push(raw * env * vol);
    }

    for (let i = 0; i < silenceSamples; i += 1) {
      samples.push(0);
    }
  });

  return samples;
}

function buildPresets() {
  return {
    beep: renderSequence([{ freq: 880, durationMs: 120 }]),
    double: renderSequence([
      { freq: 740, durationMs: 90, silenceAfterMs: 40 },
      { freq: 980, durationMs: 90 },
    ]),
    success: renderSequence([
      { freq: 660, durationMs: 90, silenceAfterMs: 20 },
      { freq: 880, durationMs: 90, silenceAfterMs: 20 },
      { freq: 1040, durationMs: 120 },
    ]),
    warning: renderSequence([
      { freq: 520, durationMs: 140, silenceAfterMs: 30 },
      { freq: 520, durationMs: 140 },
    ]),
    error: renderSequence([
      { freq: 220, durationMs: 140, silenceAfterMs: 30 },
      { freq: 196, durationMs: 180 },
    ]),
  };
}

function main() {
  const outDir = path.join(__dirname, '..', 'assets', 'sounds');
  const presets = buildPresets();
  Object.entries(presets).forEach(([name, samples]) => {
    const filePath = path.join(outDir, `${name}.wav`);
    writeWav16Mono(filePath, samples);
    console.log(`Wrote ${filePath} (${samples.length} samples)`);
  });
}

main();

