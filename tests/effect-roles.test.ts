import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatedText } from "../src/AnimatedText";
import {
  allBuiltinEffects,
  builtinEffects,
  kineticEffects,
  reversedEffects,
} from "../src/builtin-effects";
import {
  effectRole,
  effectRoles,
  effectTarget,
  exitName,
  roleFeels,
  targetMismatch,
} from "../src/effect-roles";
import { phaseLengths, setPhaseLength } from "../src/editor/envelope";
import { kineticFrame, textGeometry } from "../src/kinetic-type";
import { initialProject, makeLayer, validateProject } from "../src/model";
import { TextEffectSchema } from "../src/text-effects";

const card = (id: string) => allBuiltinEffects.find((e) => e.id === id)!;

test("every card has a role and a feel from that role", () => {
  const counts = new Map<string, number>();
  for (const effect of builtinEffects) {
    const { role, feel } = effectRole(effect);
    assert.ok(effectRoles.includes(role), effect.id);
    assert.ok(roleFeels[role].includes(feel), `${effect.id}: ${role}/${feel}`);
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  for (const role of effectRoles) assert.ok(counts.get(role)! > 0, role);
  const role = (id: string) => effectRole(card(id)).role;
  assert.equal(role("kinetic-spring"), "in");
  assert.equal(role("kinetic-lean"), "throughout");
  assert.equal(role("kinetic-burst"), "out");
  assert.equal(role("exit-crossout"), "out");
  assert.equal(role("layout-giant"), "arrange");
  assert.equal(role("look-keyline"), "style");
  assert.equal(role("overlay-circle"), "overlay");
  assert.equal(role("look-burst"), "overlay");
  assert.equal(role("barn-doors"), "between");
  assert.equal(role("memory-grain"), "finish");
  assert.equal(role("art-punch"), "throughout");
  // Forks keep their family's role.
  assert.equal(
    effectRole({
      ...card("barn-doors"),
      id: "mine",
      presetFamilyId: "barn-doors",
    }).role,
    "between",
  );
});

test("reversible entrances also appear as exits that play them backwards", () => {
  assert.equal(reversedEffects.length, 45);
  assert.equal(
    new Set(builtinEffects.map((e) => e.id)).size,
    builtinEffects.length,
  );
  for (const effect of reversedEffects) {
    assert.match(effect.id, /-out$/);
    assert.equal(effect.text!.motion!.direction, "out");
    assert.equal(effectRole(effect).role, "out", effect.id);
    const entrance = card(effect.id.replace(/-out$/, ""));
    assert.equal(effectRole(entrance).role, "in");
    assert.equal(effect.text!.kind, entrance.text!.kind);
  }
  assert.equal(exitName("Hop in"), "Hop out");
  assert.equal(exitName("Flicker on"), "Flicker off");
  assert.equal(exitName("Mask reveal"), "Mask hide");
  assert.equal(exitName("Word slam"), "Word slam out");
  // Holds, exits and sequences are never reversed.
  for (const id of [
    "kinetic-lean-out",
    "kinetic-kick-out",
    "title-karaoke-out",
  ])
    assert.equal(card(id), undefined);
});

test("targets: text cards fit text, copy treatments fit pictures, the rest fit anything", () => {
  assert.equal(effectTarget(card("kinetic-spring")), "text");
  assert.equal(effectTarget(card("art-trail")), "picture");
  assert.equal(effectTarget(card("art-punch")), "any");
  assert.equal(effectTarget(card("overlay-circle")), "any");
  assert.equal(
    targetMismatch(card("kinetic-spring"), "image"),
    "Applies to text only.",
  );
  assert.match(targetMismatch(card("art-trail"), "title")!, /images/);
  assert.equal(targetMismatch(card("overlay-circle"), "title"), null);
  assert.ok(targetMismatch(card("overlay-circle"), "audio"));
});

test("In and Out phases retime a clip's entrances and exits together", () => {
  const spring = card("kinetic-spring");
  const plates = card("kinetic-plates");
  const kick = card("kinetic-kick");
  const base = validateProject(initialProject);
  const layer = {
    ...makeLayer("title", "Line"),
    id: "line",
    text: "Night train",
    duration: 4,
    effects: [spring, plates, kick].map((e) => ({
      effectId: e.id,
      amount: 1,
      enabled: true,
    })),
  };
  const project = validateProject({
    ...base,
    layers: [...base.layers, layer],
    effects: [...base.effects, spring, plates, kick],
  });
  const lengths = phaseLengths(layer, project.effects);
  assert.equal(
    lengths.in,
    Math.max(spring.text!.seconds, plates.text!.seconds),
  );
  assert.equal(lengths.out, kick.text!.seconds);
  const next = setPhaseLength(project, "line", "in", lengths.in! / 2);
  const line = next.layers.find((l) => l.id === "line")!;
  // Both entrances halve; the exit and the shared definitions are untouched.
  assert.equal(
    line.effects[0].settings!.text!.seconds,
    spring.text!.seconds / 2,
  );
  assert.equal(
    line.effects[1].settings!.text!.seconds,
    plates.text!.seconds / 2,
  );
  assert.deepEqual(
    line.effects[2],
    project.layers.find((l) => l.id === "line")!.effects[2],
  );
  assert.deepEqual(next.effects, project.effects);
  assert.deepEqual(validateProject(next), next);
  // The phases share the clip.
  const long = setPhaseLength(project, "line", "in", 60);
  const after = phaseLengths(
    long.layers.find((l) => l.id === "line")!,
    long.effects,
  );
  assert.ok(after.in! + after.out! <= layer.duration + 1e-9);
});

test("new kinetic motions settle, start neutral and keep their copies visible", () => {
  const geometry = textGeometry("Night train");
  const unit = {
    index: 0,
    count: 2,
    x: -1,
    y: 0,
    w: 2,
    line: 0,
    inLine: 0,
    lineLength: 2,
  };
  const frame = (kind: string, time: number, patch = {}) =>
    kineticFrame(
      {
        effect: TextEffectSchema.parse({
          kind,
          seconds: 1,
          stagger: 0,
          ...patch,
        }),
        time,
        duration: 6,
        amount: 1,
        geometry,
        hold: 1,
        color: "#ffffff",
      },
      unit,
    );
  for (const kind of ["gather", "plates", "inkstroke"]) {
    assert.equal(frame(kind, 1.2).copies.length, 0, kind);
    assert.ok(frame(kind, 0.3).clip || frame(kind, 0.3).copies.length, kind);
  }
  for (const kind of [
    "blast",
    "crumble",
    "wipeoff",
    "aperture",
    "channels",
    "melt",
  ]) {
    const before = frame(kind, 4);
    assert.ok(
      !before.clip && !before.copies.length && before.opacity === 1,
      kind,
    );
  }
  // Shards and plates hide the glyphs with a clip, never by opacity, so a
  // word's copies stay visible.
  const shards = frame("gather", 0.4);
  assert.equal(shards.copies.length, 6);
  assert.equal(shards.opacity, 1);
  assert.match(shards.clip!, /inset/);
  assert.equal(frame("blast", 5.5).copies.length, 6);
  assert.equal(frame("channels", 5.6).copies.length, 3);
  assert.equal(frame("aperture", 5.6).marks[0].kind, "ring");
  assert.equal(frame("afterimage", 1.3).copies.length, 4);
  // Every new card renders without invalid values over the whole clip.
  for (const effect of kineticEffects.slice(-12))
    for (const time of [0, 0.3, 1, 3, 5.5, 5.95])
      assert.doesNotMatch(
        renderToStaticMarkup(
          React.createElement(AnimatedText, {
            layer: {
              ...makeLayer("title", "T"),
              text: "Night train\nhome",
              duration: 6,
              effects: [{ effectId: effect.id, amount: 1, enabled: true }],
            },
            effects: [effect],
            time,
          }),
        ),
        /NaN|undefined|Infinity/,
        effect.id,
      );
});
