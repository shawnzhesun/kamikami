import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  installSkill,
  readSkill,
  skillFile,
  skillStatus,
} from "../server/editor-skill";

test("the editing skill installs into agent apps' skill folders and reports its version", async () => {
  // From source, the skill is the repo's copy.
  assert.match(skillFile(), /\.agents\/skills\/kamikami-editor\/SKILL\.md$/);
  const skill = await readSkill();
  assert.match(skill, /^---\nname: kamikami-editor\n/);

  const home = await mkdtemp(path.join(tmpdir(), "kamikami-skill-home-"));
  try {
    const states = async () =>
      Object.fromEntries((await skillStatus(home)).map((t) => [t.id, t.state]));
    assert.deepEqual(await states(), { claude: "missing", agents: "missing" });

    const claude = await installSkill("claude", home);
    assert.equal(claude.state, "current");
    assert.equal(
      claude.path,
      path.join(home, ".claude/skills/kamikami-editor/SKILL.md"),
    );
    assert.equal(await readFile(claude.path, "utf8"), skill);
    assert.deepEqual(await states(), { claude: "current", agents: "missing" });
    // No temporary file is left behind.
    assert.deepEqual(await readdir(path.dirname(claude.path)), ["SKILL.md"]);

    // An older or edited copy is reported, and installing replaces it.
    await writeFile(claude.path, "old");
    assert.equal((await states()).claude, "outdated");
    await installSkill("claude", home);
    assert.equal((await states()).claude, "current");

    const agents = await installSkill("agents", home);
    assert.equal(
      agents.path,
      path.join(home, ".agents/skills/kamikami-editor/SKILL.md"),
    );
    await assert.rejects(installSkill("../../etc", home), /Choose/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
