import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The editing skill (`.agents/skills/kamikami-editor/SKILL.md`): served to
 * MCP clients as a resource and a prompt, and installed into agent apps'
 * personal skill folders so they load it on their own.
 */
export const skillName = "kamikami-editor";

/**
 * The skill file. The app ships `.agents/skills` next to `desktop-build`
 * (see electron-builder.yml), so the same path works from the bundled
 * service and MCP server and from the source checkout.
 */
export function skillFile() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", ".agents", "skills", skillName, "SKILL.md");
}

export const readSkill = () =>
  readFile(skillFile(), "utf8").catch(() => {
    throw new Error("The KamiKami editing skill is missing from this install.");
  });

/** Where agent apps look for personal skills. */
export const skillTargets = [
  {
    id: "claude",
    label: "Claude Code",
    folder: [".claude", "skills"],
  },
  {
    // The shared Agent Skills location, which Codex reads.
    id: "agents",
    label: "Codex and other Agent Skills apps",
    folder: [".agents", "skills"],
  },
] as const;
export type SkillTarget = (typeof skillTargets)[number]["id"];

const installedPath = (target: (typeof skillTargets)[number], home: string) =>
  path.join(home, ...target.folder, skillName, "SKILL.md");

/** Each target's state: missing, current, or an older (or edited) copy. */
export async function skillStatus(home = homedir()) {
  const skill = await readSkill();
  return Promise.all(
    skillTargets.map(async (target) => {
      const file = installedPath(target, home);
      const installed = await readFile(file, "utf8").catch(() => null);
      return {
        id: target.id,
        label: target.label,
        path: file,
        state:
          installed === null
            ? ("missing" as const)
            : installed === skill
              ? ("current" as const)
              : ("outdated" as const),
      };
    }),
  );
}

/** Writes this version's skill into one agent app's skill folder. */
export async function installSkill(target: unknown, home = homedir()) {
  const spec = skillTargets.find((t) => t.id === target);
  if (!spec) throw new Error("Choose Claude Code or Codex.");
  const file = installedPath(spec, home);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, await readSkill());
  await rename(temporary, file);
  return (await skillStatus(home)).find((t) => t.id === spec.id)!;
}
