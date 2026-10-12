/**
 * Align user-supplied lyrics (or a script) to recognized words. ASR on sung
 * vocals is unreliable, but its timings are good anchors: a global sequence
 * alignment matches lyric tokens to recognized tokens, matched tokens take the
 * recognized times, and the rest are spread between anchors by length.
 */
export type TimedWord = { t: string; s: number; e: number; p?: number };

// Han, kana, Hangul and similar scripts have no spaces: align per character there.
const cjk =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯]/u;
const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

/** Split text into display tokens, keeping the line each token came from. */
export function tokenizeLyrics(text: string) {
  const tokens: { text: string; key: string; line: number }[] = [];
  text.split(/\r?\n/).forEach((line, lineIndex) => {
    for (const word of line.split(/\s+/).filter(Boolean)) {
      if (cjk.test(word)) {
        for (const ch of Array.from(word)) {
          const key = normalize(ch);
          if (key) tokens.push({ text: ch, key, line: lineIndex });
          else if (tokens.length) tokens[tokens.length - 1].text += ch; // punctuation joins the previous glyph
        }
      } else {
        const key = normalize(word);
        if (key) tokens.push({ text: word, key, line: lineIndex });
      }
    }
  });
  return tokens;
}

/** Recognized words → comparable tokens (CJK words split into timed characters). */
function tokenizeRecognized(words: TimedWord[]) {
  const out: { key: string; s: number; e: number }[] = [];
  for (const w of words) {
    if (cjk.test(w.t)) {
      const chars = Array.from(w.t).filter((c) => normalize(c));
      chars.forEach((c, i) => {
        const span = (w.e - w.s) / Math.max(1, chars.length);
        out.push({
          key: normalize(c),
          s: w.s + span * i,
          e: w.s + span * (i + 1),
        });
      });
    } else {
      const key = normalize(w.t);
      if (key) out.push({ key, s: w.s, e: w.e });
    }
  }
  return out;
}

function similarity(a: string, b: string) {
  if (a === b) return 1;
  const m = a.length,
    n = b.length;
  if (!m || !n) return 0;
  let previous = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const current = [i];
    for (let j = 1; j <= n; j++)
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return 1 - previous[n] / Math.max(m, n);
}

export function alignLyrics(
  lyrics: string,
  recognized: TimedWord[],
  duration: number,
) {
  const lyric = tokenizeLyrics(lyrics);
  const asr = tokenizeRecognized(recognized);
  const n = lyric.length,
    m = asr.length;
  const GAP = -0.6;
  // Needleman–Wunsch over tokens; score rewards exact and near matches.
  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 1 diag, 2 up, 3 left
  for (let i = 1; i <= n; i++) {
    score[i][0] = i * GAP;
    move[i][0] = 2;
  }
  for (let j = 1; j <= m; j++) {
    score[0][j] = j * GAP;
    move[0][j] = 3;
  }
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const sim = similarity(lyric[i - 1].key, asr[j - 1].key);
      const pair = sim === 1 ? 2 : sim >= 0.6 ? sim * 1.5 : -1;
      const diag = score[i - 1][j - 1] + pair,
        up = score[i - 1][j] + GAP,
        left = score[i][j - 1] + GAP;
      if (diag >= up && diag >= left) {
        score[i][j] = diag;
        move[i][j] = 1;
      } else if (up >= left) {
        score[i][j] = up;
        move[i][j] = 2;
      } else {
        score[i][j] = left;
        move[i][j] = 3;
      }
    }
  const anchor: ({ s: number; e: number; p: number } | null)[] = new Array(
    n,
  ).fill(null);
  for (let i = n, j = m; i > 0 || j > 0;) {
    const step = move[i][j];
    if (step === 1) {
      const sim = similarity(lyric[i - 1].key, asr[j - 1].key);
      if (sim >= 0.6)
        anchor[i - 1] = {
          s: asr[j - 1].s,
          e: asr[j - 1].e,
          p: sim === 1 ? 0.95 : 0.75,
        };
      i--;
      j--;
    } else if (step === 2) i--;
    else j--;
  }
  // Spread unmatched tokens between neighbouring anchors, weighted by length.
  const words: TimedWord[] = [];
  const average =
    asr.length > 0
      ? Math.max(
          0.15,
          asr.reduce((sum, w) => sum + (w.e - w.s), 0) / asr.length,
        )
      : 0.4;
  let k = 0;
  while (k < n) {
    if (anchor[k]) {
      words.push({
        t: lyric[k].text,
        s: anchor[k]!.s,
        e: anchor[k]!.e,
        p: anchor[k]!.p,
      });
      k++;
      continue;
    }
    let end = k;
    while (end < n && !anchor[end]) end++;
    const before = k > 0 ? (anchor[k - 1]?.e ?? words.at(-1)?.e ?? 0) : null;
    const after = end < n ? anchor[end]!.s : null;
    const weights = lyric.slice(k, end).map((t) => Math.max(1, t.key.length));
    const total = weights.reduce((a, b) => a + b, 0);
    const span = (end - k) * average;
    const from = before ?? Math.max(0, (after ?? 0) - span);
    const to = after ?? Math.min(duration, from + span);
    let cursor = from;
    for (let i = k; i < end; i++) {
      const length = ((to - from) * weights[i - k]) / total;
      words.push({ t: lyric[i].text, s: cursor, e: cursor + length, p: 0.4 });
      cursor += length;
    }
    k = end;
  }
  const round = (v: number) =>
    Math.round(Math.max(0, Math.min(duration || v, v)) * 1000) / 1000;
  const timed = words.map((w) => ({
    ...w,
    s: round(w.s),
    e: round(Math.max(w.s, w.e)),
  }));
  // One segment per lyric line, so captions can follow the user's line breaks.
  const segments: { start: number; end: number; text: string }[] = [];
  lyric.forEach((token, i) => {
    const w = timed[i];
    const last = segments.at(-1);
    if (last && lyric[i - 1]?.line === token.line) {
      last.end = Math.max(last.end, w.e);
      last.text +=
        cjk.test(token.text) && cjk.test(lyric[i - 1].text)
          ? token.text
          : ` ${token.text}`;
    } else segments.push({ start: w.s, end: w.e, text: token.text });
  });
  const matched = anchor.filter(Boolean).length;
  return { words: timed, segments, matched, total: n };
}
