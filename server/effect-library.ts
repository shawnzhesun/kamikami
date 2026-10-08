import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  EffectBundleSchema,
  effectEngine,
  type UserEffect,
} from "../src/effect-bundle";
import { EffectSchema, type Effect } from "../src/model";
import { allBuiltinEffects, getEffectFamily } from "../src/builtin-effects";

// Retain deleted IDs so project autosync cannot recreate removed personal presets.
type StoredEffect = UserEffect & { deleted?: boolean };

export class EffectLibrary {
  private queue = Promise.resolve();
  constructor(private directory: string) {}
  private async read(): Promise<StoredEffect[]> {
    try {
      const entries: StoredEffect[] = JSON.parse(
        await readFile(path.join(this.directory, "effects.json"), "utf8"),
      );
      // Version-1 saved entries belonged to My effects.
      return entries.map((entry) => ({
        ...entry,
        collection: entry.collection ?? "mine",
      }));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  async list(): Promise<UserEffect[]> {
    await this.queue;
    return (await this.read()).filter((entry) => !entry.deleted);
  }
  private mutate<T>(change: (entries: StoredEffect[]) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const entries = await this.read();
      const before = JSON.stringify(entries);
      const result = change(entries);
      if (entries.filter((entry) => !entry.deleted).length > 500)
        throw new Error("Effect library is full (500 effects).");
      if (JSON.stringify(entries) !== before) {
        const file = path.join(this.directory, `effects-${randomUUID()}.tmp`);
        await writeFile(file, JSON.stringify(entries, null, 2));
        await rename(file, path.join(this.directory, "effects.json"));
      }
      return result;
    });
    this.queue = operation.then(
      () => {},
      () => {},
    );
    return operation;
  }
  async import(input: unknown) {
    const bundle = EffectBundleSchema.parse(input);
    const presetFamilyId =
      bundle.effect.presetFamilyId ?? getEffectFamily(bundle.effect.id)?.id;
    return this.mutate((entries) => {
      const id = randomUUID();
      const entry: UserEffect = {
        id,
        collection: "library",
        savedAt: new Date().toISOString(),
        bundle: {
          ...bundle,
          effect: {
            ...bundle.effect,
            id: "user-" + id,
            ...(presetFamilyId ? { presetFamilyId } : {}),
          },
        },
      };
      entries.push(entry);
      return entry;
    });
  }
  async save(input: unknown) {
    const bundle = EffectBundleSchema.parse(input);
    return this.mutate((entries) => {
      const existing = entries.find(
        (e) => e.bundle.effect.id === bundle.effect.id,
      );
      if (existing?.collection === "mine" && !existing.deleted) {
        existing.bundle = bundle;
        existing.savedAt = new Date().toISOString();
        return existing;
      }
      const id = randomUUID();
      const copy =
        !!existing || allBuiltinEffects.some((e) => e.id === bundle.effect.id);
      const presetFamilyId =
        bundle.effect.presetFamilyId ?? getEffectFamily(bundle.effect.id)?.id;
      const entry: UserEffect = {
        id,
        collection: "mine",
        savedAt: new Date().toISOString(),
        bundle: {
          ...bundle,
          effect: {
            ...bundle.effect,
            id: copy ? "user-" + id : bundle.effect.id,
            ...(presetFamilyId ? { presetFamilyId } : {}),
          },
        },
      };
      entries.push(entry);
      return entry;
    });
  }
  async syncProjectEffects(input: Effect[]) {
    const definitions = EffectSchema.array().max(40).parse(input);
    return this.mutate((entries) => {
      for (const effect of definitions) {
        const existing = entries.find((e) => e.bundle.effect.id === effect.id);
        if (existing?.deleted || existing?.collection === "library") continue;
        if (existing) {
          if (
            JSON.stringify(existing.bundle.effect) !== JSON.stringify(effect)
          ) {
            existing.bundle = {
              ...existing.bundle,
              engine: effectEngine(effect),
              name: effect.name,
              description: effect.description,
              effect,
            };
            existing.savedAt = new Date().toISOString();
          }
        } else if (!allBuiltinEffects.some((e) => e.id === effect.id)) {
          entries.push({
            id: randomUUID(),
            collection: "mine",
            savedAt: new Date().toISOString(),
            bundle: EffectBundleSchema.parse({
              format: "frameforge-effect",
              version: 1,
              engine: effectEngine(effect),
              name: effect.name,
              description: effect.description,
              effect,
            }),
          });
        }
      }
      return entries.filter((entry) => !entry.deleted);
    });
  }

  async delete(effectId: string) {
    if (typeof effectId !== "string" || !effectId)
      throw new Error("Choose an effect from My effects.");
    return this.mutate((entries) => {
      const entry = entries.find((item) => item.bundle.effect.id === effectId);
      if (
        !entry ||
        entry.collection !== "mine" ||
        allBuiltinEffects.some((effect) => effect.id === effectId)
      )
        throw new Error("Only effects in My effects can be deleted.");
      entry.deleted = true;
      return { deleted: true, effectId };
    });
  }
}
