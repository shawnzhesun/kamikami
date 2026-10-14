import test from "node:test";
import assert from "node:assert/strict";
import { TEMPO_PARAMS, tempoFromSamples } from "../server/analysis/tempo";

const { rate } = TEMPO_PARAMS;
function clicks(bpm: number, first: number, seconds: number) {
  const samples = new Float32Array(rate * seconds);
  for (let t = first; t < seconds; t += 60 / bpm)
    for (let i = 0; i < rate * 0.02; i++) {
      const n = Math.round(t * rate) + i;
      if (n < samples.length)
        samples[n] = 0.8 * Math.sin((2 * Math.PI * 1000 * i) / rate);
    }
  return samples;
}

test("tempo: steady pulses give their BPM and a grid on the beats", () => {
  for (const [bpm, first, seconds] of [
    [90, 0.1, 20],
    [128, 0.25, 20],
    [174, 0.4, 20],
    // Long enough that a whole-frame period error would drift off the beats.
    [120, 0, 60],
  ]) {
    const tempo = tempoFromSamples(clicks(bpm, first, seconds), seconds);
    assert.ok(tempo, `${bpm} BPM found`);
    assert.ok(Math.abs(tempo.bpm - bpm) <= 0.5, `${tempo.bpm} ≈ ${bpm}`);
    // The grid starts at the music, not in the silent intro.
    assert.ok(
      Math.abs(tempo.firstBeat - first) < 0.02,
      `first beat ${tempo.firstBeat}`,
    );
    const last = tempo.beats.at(-1)!;
    const expected =
      first + Math.round((last - first) / (60 / bpm)) * (60 / bpm);
    assert.ok(Math.abs(last - expected) < 0.03, "no drift by the end");
  }
});

test("tempo: noise and silence have no beat", () => {
  let seed = 1;
  const noise = new Float32Array(rate * 10).map(() => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296 - 0.5;
  });
  assert.equal(tempoFromSamples(noise, 10), null);
  assert.equal(tempoFromSamples(new Float32Array(rate * 10), 10), null);
});
