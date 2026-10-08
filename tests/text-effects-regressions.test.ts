import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatedText } from "../src/AnimatedText";
import { remotionSceneEffects } from "../src/builtin-effects";
import { initialProject, makeLayer, validateProject } from "../src/model";
import { builtinTextSettings } from "../src/text-effects";
import { api } from "../src/media";

const gradient = remotionSceneEffects.find(
  (effect) => effect.id === "text-gradient",
)!;
const title = { ...makeLayer("title", "Title"), text: "Title", duration: 6 };

test("gradient combinations paint glyphs directly without a transparent transformed ancestor", () => {
  for (const kind of ["typewriter", "scramble", "stagger", "wave"]) {
    const motion = remotionSceneEffects.find(
      (effect) => effect.text?.kind === kind,
    )!;
    for (const effects of [
      [gradient, motion],
      [motion, gradient],
    ]) {
      for (const time of [0.6, 2]) {
        const html = renderToStaticMarkup(
          React.createElement(AnimatedText, {
            layer: {
              ...title,
              effects: effects.map((effect) => ({
                effectId: effect.id,
                enabled: true,
                amount: 1,
              })),
            },
            effects,
            time,
          }),
        );
        const run = html.match(/<span[^>]*data-animated-text="run"[^>]*>/)![0];
        assert.doesNotMatch(run, /color:transparent|background-clip/);
        const painted =
          html.match(/<span[^>]*background-clip:text[^>]*>/g) ?? [];
        assert.ok(painted.length >= title.text.length);
        for (const leaf of painted) assert.match(leaf, /data-text-fill/);
        assert.doesNotMatch(html, /NaN|Infinity/);
        if (time === 2 && kind !== "wave")
          assert.doesNotMatch(html, /transform:perspective/);
      }
    }
  }
});

test("known built-in settings stripped by an older service recover without changing custom definitions", () => {
  const stripped = remotionSceneEffects
    .filter((effect) => effect.text)
    .map(({ text: _text, ...effect }) => effect);
  const project = {
    ...initialProject,
    effects: [...initialProject.effects, ...stripped],
  };
  const before = structuredClone(project);
  const recovered = validateProject(project);
  for (const effect of stripped)
    assert.deepEqual(
      recovered.effects.find((item) => item.id === effect.id)!.text,
      builtinTextSettings[effect.id],
    );
  assert.deepEqual(project, before);
  const customized = structuredClone(gradient);
  customized.text!.speed = 7;
  assert.equal(
    validateProject({
      ...initialProject,
      effects: [...initialProject.effects, customized],
    }).effects.at(-1)!.text!.speed,
    7,
  );
  const customWithoutText = { ...stripped[0], id: "user-existing" };
  assert.equal(
    validateProject({
      ...initialProject,
      effects: [...initialProject.effects, customWithoutText],
    }).effects.at(-1)!.text,
    undefined,
  );
});

test("stale services cannot receive and strip text-effect writes; legacy requests still work", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  let current = false;
  globalThis.fetch = (async (url: string | URL | Request) => {
    requests.push(String(url));
    return new Response(
      JSON.stringify(
        String(url) === "/api/health"
          ? {
              ok: true,
              ...(current
                ? {
                    effectEngine: "kamikami-visual-v4",
                    projectVersion: 2,
                    effectLibraryVersion: 2,
                  }
                : {}),
            }
          : { ok: true },
      ),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    const payload = {
      ...initialProject,
      effects: [...initialProject.effects, gradient],
    };
    for (const [url, body] of [
      ["/api/project", payload],
      ["/api/effects/sync", [gradient]],
      ["/api/export", payload],
      ["/api/effects/save", { effect: gradient }],
    ] as const) {
      requests.length = 0;
      await assert.rejects(api(url, "POST", body), /outdated.*Restart/);
      assert.deepEqual(requests, ["/api/health"]);
    }
    current = true;
    requests.length = 0;
    await api("/api/project", "PUT", payload);
    assert.deepEqual(requests, ["/api/health", "/api/project"]);
    current = false;
    requests.length = 0;
    await api("/api/project", "PUT", { ...initialProject, version: 1 });
    assert.deepEqual(requests, ["/api/project"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("effect library requests reject old services and explain missing delete routes", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  let version = 1,
    routeAvailable = false;
  globalThis.fetch = (async (url: string | URL | Request) => {
    requests.push(String(url));
    if (String(url) === "/api/health")
      return Response.json({ effectLibraryVersion: version });
    return routeAvailable
      ? Response.json({ deleted: true })
      : new Response("Cannot POST /api/effects/delete", { status: 404 });
  }) as typeof fetch;
  try {
    for (const [url, method, body] of [
      ["/api/effects", "GET", undefined],
      ["/api/effects/sync", "POST", []],
      ["/api/effects/delete", "POST", { effectId: "user-test" }],
    ] as const) {
      requests.length = 0;
      await assert.rejects(
        api(url, method, body),
        /outdated.*Restart.*npm run desktop/,
      );
      assert.deepEqual(requests, ["/api/health"]);
    }
    version = 2;
    await assert.rejects(
      api("/api/effects/delete", "POST", { effectId: "user-test" }),
      /outdated.*Restart/,
    );
    routeAvailable = true;
    assert.deepEqual(
      await api("/api/effects/delete", "POST", { effectId: "user-test" }),
      { deleted: true },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
