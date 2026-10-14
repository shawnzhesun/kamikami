import type { AudioTempo } from "../../src/asset-analysis";
import { ffmpegPath, run } from "./ffmpeg";

/** Tempo analysis settings; part of the probe cache key through PROBE_PARAMS. */
export const TEMPO_PARAMS = {
  rate: 11025,
  window: 1024,
  hop: 256,
  minBpm: 60,
  maxBpm: 200,
  /** Most music sits near this tempo; it breaks ties between half and double time. */
  preferredBpm: 120,
  maxSeconds: 600,
  /** Below this pulse strength the audio has no steady beat. */
  minConfidence: 0.3,
  /**
   * Where in its analysis window an onset peaks the flux, as a fraction of
   * the window; measured on click tracks.
   */
  onsetPoint: 0.75,
} as const;

/**
 * Estimates a steady tempo and its beat grid from one audio track: spectral
 * flux gives an onset envelope, autocorrelation picks the beat period, and a
 * phase search aligns the grid to the strongest onsets. Returns null when the
 * audio has no clear pulse.
 */
export async function audioTempo(
  file: string,
  duration: number,
  track = 0,
  signal?: AbortSignal,
): Promise<AudioTempo | null> {
  const { rate, maxSeconds } = TEMPO_PARAMS;
  const { bytes } = await run(
    ffmpegPath(),
    [
      "-hide_banner",
      "-nostats",
      "-loglevel",
      "error",
      "-t",
      String(Math.min(duration, maxSeconds)),
      "-i",
      file,
      "-map",
      `0:a:${track}`,
      "-ac",
      "1",
      "-ar",
      String(rate),
      "-f",
      "f32le",
      "-",
    ],
    { signal },
  );
  const samples = new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  );
  return tempoFromSamples(samples, Math.min(duration, maxSeconds));
}

export function tempoFromSamples(
  samples: Float32Array,
  duration: number,
): AudioTempo | null {
  const { rate, hop, minBpm, maxBpm, preferredBpm } = TEMPO_PARAMS;
  // A window of leading silence lets sound at 0 s register as an onset.
  const padded = new Float32Array(samples.length + TEMPO_PARAMS.window);
  padded.set(samples, TEMPO_PARAMS.window);
  const envelope = onsetEnvelope(padded);
  const fps = rate / hop;
  if (envelope.length < fps * 4) return null;
  // Autocorrelation of the centered envelope over the beat periods in range.
  let mean = 0;
  for (const v of envelope) mean += v / envelope.length;
  const centered = envelope.map((v) => v - mean);
  const minLag = Math.floor((60 * fps) / maxBpm);
  const maxLag = Math.ceil((60 * fps) / minBpm);
  let energy = 0;
  for (const v of centered) energy += v * v;
  if (energy <= 0) return null;
  const correlation: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = lag; i < centered.length; i++)
      sum += centered[i] * centered[i - lag];
    correlation.push(sum / energy);
  }
  // A prior toward the preferred tempo breaks ties between half and double time.
  const weighted = correlation.map((r, i) => {
    const bpm = (60 * fps) / (minLag + i);
    return r * Math.exp((-0.5 * Math.log2(bpm / preferredBpm) ** 2) / 0.6);
  });
  let best = 0;
  for (let i = 1; i < weighted.length; i++)
    if (weighted[i] > weighted[best]) best = i;
  // Pulse strength: how strongly the envelope repeats at that period. Noise,
  // speech and steady tones stay low.
  const confidence = Math.max(0, Math.min(1, correlation[best]));
  if (confidence < TEMPO_PARAMS.minConfidence) return null;
  // Parabolic interpolation gives a sub-frame starting period.
  const left = correlation[best - 1] ?? correlation[best];
  const right = correlation[best + 1] ?? correlation[best];
  const bend = left - 2 * correlation[best] + right;
  let period = minLag + best + (bend < 0 ? (0.5 * (left - right)) / bend : 0);
  // Phase: the offset whose grid collects the most onset strength.
  let phase = 0;
  let phaseScore = -1;
  for (let p = 0; p < period; p += 0.25) {
    let sum = 0;
    for (let t = p; t < envelope.length; t += period)
      sum += envelope[Math.round(t)] ?? 0;
    if (sum > phaseScore) {
      phaseScore = sum;
      phase = p;
    }
  }
  // Fit the grid to the onset peak near each beat (weighted least squares).
  // A small period error adds up over a song, so the fit starts on the first
  // few beats and widens as the period sharpens.
  const beatCount = Math.floor((envelope.length - phase) / period) + 1;
  for (let horizon = 8; ; horizon *= 2) {
    const fit = fitGrid(envelope, phase, period, Math.min(horizon, beatCount));
    if (!fit || Math.abs(fit.period - period) > period * 0.05) break;
    ({ period, phase } = fit);
    if (horizon >= beatCount) break;
  }
  // A frame's time is its window start; the onset sits further in, less the padding.
  const onset = ((TEMPO_PARAMS.onsetPoint - 1) * TEMPO_PARAMS.window) / rate;
  const beatSeconds = period / fps;
  // Start at the music, not in a quiet intro: the first beat near a clear onset.
  let peak = 0;
  for (const v of envelope) peak = Math.max(peak, v);
  const startFrame = Math.max(
    0,
    envelope.findIndex((v) => v >= peak * 0.25),
  );
  const start = startFrame / fps + onset - beatSeconds * 0.25;
  const grid = phase / fps + onset;
  // A beat a few milliseconds before 0 s is the downbeat at 0 s.
  const firstBeat = Math.max(
    0,
    grid +
      Math.ceil((Math.max(-0.05, start) - grid) / beatSeconds) * beatSeconds,
  );
  const beats: number[] = [];
  for (let t = firstBeat; t < duration && beats.length < 4000; t += beatSeconds)
    beats.push(Math.round(t * 1000) / 1000);
  return {
    bpm: Math.round((60 / beatSeconds) * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    firstBeat: Math.round(firstBeat * 1000) / 1000,
    beats,
  };
}

/** Weighted line through the onset peaks nearest the first `beats` grid points. */
function fitGrid(
  envelope: Float32Array,
  phase: number,
  period: number,
  beats: number,
) {
  let sw = 0,
    sk = 0,
    st = 0,
    skk = 0,
    skt = 0;
  const reach = Math.max(1, Math.round(period * 0.15));
  for (let k = 0; k < beats; k++) {
    const center = Math.round(phase + k * period);
    let peak = center;
    for (let i = center - reach; i <= center + reach; i++)
      if ((envelope[i] ?? -1) > (envelope[peak] ?? -1)) peak = i;
    const w = envelope[peak] ?? 0;
    if (w <= 0) continue;
    // Sub-frame peak position from its neighbours.
    const l = envelope[peak - 1] ?? w;
    const r = envelope[peak + 1] ?? w;
    const bend = l - 2 * w + r;
    const t = peak + (bend < 0 ? (0.5 * (l - r)) / bend : 0);
    sw += w;
    sk += w * k;
    st += w * t;
    skk += w * k * k;
    skt += w * k * t;
  }
  const det = sw * skk - sk * sk;
  if (sw <= 0 || det <= 0) return null;
  const slope = (sw * skt - sk * st) / det;
  return { period: slope, phase: (st - slope * sk) / sw };
}

/** Half-wave rectified log-spectral flux, with its local mean removed. */
function onsetEnvelope(samples: Float32Array): Float32Array {
  const { window, hop } = TEMPO_PARAMS;
  const frames = Math.max(0, Math.floor((samples.length - window) / hop) + 1);
  const flux = new Float32Array(frames);
  const hann = new Float32Array(window);
  for (let i = 0; i < window; i++)
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / window);
  const re = new Float32Array(window);
  const im = new Float32Array(window);
  let previous = new Float32Array(window / 2);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < window; i++) {
      re[i] = samples[f * hop + i] * hann[i];
      im[i] = 0;
    }
    fft(re, im);
    const magnitude = new Float32Array(window / 2);
    let sum = 0;
    for (let k = 0; k < window / 2; k++) {
      magnitude[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
      sum += Math.max(0, magnitude[k] - previous[k]);
    }
    flux[f] = sum;
    previous = magnitude;
  }
  // Removing a ~0.5 s moving average keeps sustained loud passages from dominating.
  const radius = Math.round((0.25 * TEMPO_PARAMS.rate) / hop);
  const out = new Float32Array(frames);
  let running = 0;
  for (let i = 0; i < Math.min(frames, radius); i++) running += flux[i];
  for (let i = 0; i < frames; i++) {
    if (i + radius < frames) running += flux[i + radius];
    if (i - radius - 1 >= 0) running -= flux[i - radius - 1];
    const count =
      Math.min(frames - 1, i + radius) - Math.max(0, i - radius) + 1;
    out[i] = Math.max(0, flux[i] - running / count);
  }
  return out;
}

/** In-place radix-2 FFT; length must be a power of two. */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}
