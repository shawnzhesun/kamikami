import test from "node:test";
import assert from "node:assert/strict";
import { alignLyrics, tokenizeLyrics } from "../server/analysis/align";

test("lyrics align to misheard ASR words, interpolate skipped words and keep lines", () => {
  const lyrics =
    "Hold me closer, tiny dancer\nCount the headlights on the highway";
  // ASR mishears "tiny" as "tony", skips "the" (first), and adds a filler.
  const asr = [
    { t: "hold", s: 1.0, e: 1.3 },
    { t: "me", s: 1.3, e: 1.5 },
    { t: "closer", s: 1.5, e: 2.1 },
    { t: "tony", s: 2.2, e: 2.6 },
    { t: "dancer", s: 2.6, e: 3.4 },
    { t: "uh", s: 3.6, e: 3.7 },
    { t: "count", s: 4.0, e: 4.4 },
    { t: "headlights", s: 4.6, e: 5.4 },
    { t: "on", s: 5.4, e: 5.5 },
    { t: "the", s: 5.5, e: 5.6 },
    { t: "highway", s: 5.6, e: 6.4 },
  ];
  const r = alignLyrics(lyrics, asr, 10);
  assert.deepEqual(
    r.words.map((w) => w.t),
    [
      "Hold",
      "me",
      "closer,",
      "tiny",
      "dancer",
      "Count",
      "the",
      "headlights",
      "on",
      "the",
      "highway",
    ],
  );
  const by = (t: string, i = 0) => r.words.filter((w) => w.t === t)[i];
  assert.equal(by("Hold").s, 1);
  assert.equal(by("closer,").p, 0.95);
  assert.equal(by("tiny").s, 2.2, "fuzzy match keeps ASR timing");
  assert.equal(by("tiny").p, 0.75);
  // The skipped "the" is placed between "Count" and "headlights", low confidence.
  const skipped = by("the", 0);
  assert.ok(skipped.s >= 4.4 && skipped.e <= 4.6, JSON.stringify(skipped));
  assert.equal(skipped.p, 0.4);
  assert.deepEqual(
    r.segments.map((s) => s.text),
    ["Hold me closer, tiny dancer", "Count the headlights on the highway"],
  );
  assert.deepEqual([r.segments[1].start, r.segments[1].end], [4, 6.4]);
  assert.equal(r.matched, 10);
  // Times are monotonic.
  for (let i = 1; i < r.words.length; i++)
    assert.ok(r.words[i].s >= r.words[i - 1].s);
});

test("CJK lyrics align per character and rejoin without spaces", () => {
  const lyrics = "白いイヤホンを\n耳に当て";
  assert.equal(tokenizeLyrics(lyrics).length, 11);
  const asr = [
    { t: "白い", s: 0, e: 0.6 },
    { t: "イヤホン", s: 0.6, e: 1.6 },
    { t: "を", s: 1.6, e: 1.8 },
    { t: "耳に当て", s: 2.5, e: 3.5 },
  ];
  const r = alignLyrics(lyrics, asr, 5);
  assert.deepEqual(
    r.segments.map((s) => s.text),
    ["白いイヤホンを", "耳に当て"],
  );
  assert.equal(r.matched, 11);
  assert.ok(Math.abs(r.segments[1].start - 2.5) < 1e-6);
});

test("with no recognized words, lyrics are spread evenly inside the duration", () => {
  const r = alignLyrics("one two three", [], 3);
  assert.equal(r.matched, 0);
  assert.ok(r.words.every((w) => w.p === 0.4 && w.e <= 3));
});
