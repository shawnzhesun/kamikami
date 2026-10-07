import { FontPicker } from "./editor/FontPicker";
import { Dropdown } from "./editor/Dropdown";
import { ThemePicker } from "./editor/ThemePicker";
import {
  ProjectSettings,
  LayerSettings,
  SettingsDialog,
} from "./editor/SettingsDialogs";
import {
  addTrack,
  updateTrack,
  deleteTrack,
  insertElement,
  moveElementsToTrack,
} from "./editor/tracks";
import { projectTracks, elementTrackId, type TimelineLayer } from "./model";
import React, { useEffect, useId, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Film,
  FolderOpen,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import { Composition } from "./Composition";
import {
  initialProject,
  makeLayer,
  validateProject,
  type Project,
  type Layer,
  type Effect,
} from "./model";

import { validateNumericDraft } from "./editor-utils";
import {
  applyEffectToLayers,
  effectCollections,
  EffectBundleSchema,
  type UserEffect,
  type EffectBundle,
} from "./effect-bundle";
import { EditHistory } from "./history";
import { isGestureActive } from "./editor/gesture";

import {
  api,
  inspectMedia,
  mediaType,
  emptyMetadata,
  type MediaAsset,
} from "./media";
import { CanvasEditor } from "./editor/CanvasEditor";
import { Timeline } from "./editor/Timeline";
import { EffectCard } from "./editor/EffectCard";
import { MediaBrowser } from "./editor/MediaBrowser";
import { AgentsPanel } from "./editor/AgentsPanel";
import { LibraryResize, libraryLimit } from "./editor/LibraryResize";
import {
  AgentCommandSchema,
  applyAgentEdit,
  type EditorRequest,
} from "./agent-protocol";

const timecode = (f: number) =>
  `${Math.floor(f / 24 / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor((f / 24) % 60)
    .toString()
    .padStart(2, "0")}:${(f % 24).toString().padStart(2, "0")}`;
export function App() {
  const [projectSettings, setProjectSettings] = useState(false);
  const [effectModal, setEffectModal] = useState(false);
  const [layerSettings, setLayerSettings] = useState<{
    track: TimelineLayer;
    isNew: boolean;
  } | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [project, setProject] = useState<Project>(() =>
      validateProject(initialProject),
    ),
    [selectedIds, setSelectedIds] = useState<string[]>(["scene"]),
    [frame, setFrame] = useState(0),
    [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<"media" | "effects">("media"),
    [rightTab, setRightTab] = useState<"agent" | "inspector">("inspector");
  const [status, setStatus] = useState("Opening workspace…"),
    [ready, setReady] = useState(false);
  const [libraryWidth, setLibraryWidth] = useState(() => {
    try {
      return Math.min(
        libraryLimit(),
        Math.max(
          220,
          Number(
            localStorage.getItem("kamikami-library-width") ??
              localStorage.getItem("frameforge-library-width"),
          ) || 280,
        ),
      );
    } catch {
      return 280;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("kamikami-library-width", String(libraryWidth));
    } catch {}
  }, [libraryWidth]);
  useEffect(() => {
    const resize = () => setLibraryWidth((n) => Math.min(n, libraryLimit()));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [effectId, setEffectId] = useState<string | null>(null),
    [exportJob, setExportJob] = useState<{
      id: string;
      status: string;
      progress: number;
      error?: string;
    } | null>(null);
  const [frameRender, setFrameRender] = useState<{
    id: string;
    frame: number;
    status: string;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!frameRender || ["done", "error"].includes(frameRender.status)) return;
    const timer = setInterval(() => {
      void api("/api/render/" + frameRender.id)
        .then((job) => {
          setFrameRender(job);
          if (job.status === "done")
            setStatus(`Frame ${job.frame} rendered for agent review`);
          if (job.status === "error")
            setStatus(`Frame render failed: ${job.error}`);
        })
        .catch((e) => {
          setFrameRender({ ...frameRender, status: "error" });
          setStatus(e.message);
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [frameRender?.id, frameRender?.status]);
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [userEffects, setUserEffects] = useState<UserEffect[]>([]);
  const deletedByTransaction = useRef(new WeakMap<Project, string[]>());
  const [mediaTrash, setMediaTrash] = useState<MediaAsset[]>([]);
  const [deleteProposal, setDeleteProposal] = useState<MediaAsset | null>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const effectFile = useRef<HTMLInputElement>(null);
  const [effectAuthor, setEffectAuthor] = useState("");
  const [effectLicense, setEffectLicense] = useState(
    "Unspecified; contact the author before redistribution",
  );
  useEffect(() => {
    if (deleteProposal) deleteDialog.current?.showModal();
    else deleteDialog.current?.close();
  }, [deleteProposal]);
  const effectRefresh = useRef(0);
  async function refreshEffects(definitions?: Effect[]) {
    const sequence = ++effectRefresh.current;
    const entries: UserEffect[] = definitions
      ? await api("/api/effects/sync", "POST", definitions)
      : await api("/api/effects");
    if (sequence !== effectRefresh.current) return entries;
    setUserEffects(entries);
    return entries;
  }
  useEffect(() => {
    void refreshEffects().catch((e) => setStatus(e.message));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void refreshEffects(current.current.effects).catch((e) =>
        setStatus(`Could not save My effects: ${e.message}`),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [project.effects, ready]);
  const { mine: myEffects, library: libraryEffects } = effectCollections(
    project,
    userEffects,
  );

  const importMode = useRef<"add" | "library" | "relink">("add");
  const relinkAsset = useRef<MediaAsset | null>(null);
  const selectedId = selectedIds.at(-1) ?? "";
  const displayProject = previewProject ?? project;
  const libraryAssets = [
    ...assets,
    ...project.layers
      .filter((l) => l.src && !assets.some((a) => a.src === l.src))
      .filter(
        (l, i, all) => all.findIndex((other) => other.src === l.src) === i,
      )
      .map((l) => ({
        ...emptyMetadata,
        src: l.src,
        name: l.name,
        type: mediaType(l.src),
        size: 0,
        missing: true,
      })),
  ];
  const missingSources = libraryAssets
    .filter((a) => a.missing)
    .map((a) => a.src);
  const [effectNavigation, setEffectNavigation] = useState(0);
  const effectEditor = useRef<HTMLDivElement>(null);
  const inspector = useRef<HTMLDivElement>(null);
  const player = useRef<PlayerRef>(null),
    file = useRef<HTMLInputElement>(null),
    projectFile = useRef<HTMLInputElement>(null),
    history = useRef(new EditHistory<Project>()),
    current = useRef(project),
    revision = useRef(0),
    saved = useRef(0),
    saveQueue = useRef(Promise.resolve());
  current.current = project;
  const selected = project.layers.find((l) => l.id === selectedId),
    editingEffect =
      project.effects.find((e) => e.id === effectId) ??
      userEffects.find((e) => e.bundle.effect.id === effectId)?.bundle.effect ??
      initialProject.effects.find((e) => e.id === effectId);
  function commit(next: Project, group?: string) {
    if (!ready) return false;
    try {
      next = validateProject(next);
      if (JSON.stringify(next) === JSON.stringify(current.current)) return true;
      const deletedSources =
        group && history.current.latestGroup === group
          ? deletedByTransaction.current.get(current.current)
          : undefined;
      history.current.record(current.current, group);
      if (deletedSources)
        deletedByTransaction.current.set(next, deletedSources);
      revision.current++;
      current.current = next;
      setProject(next);
      setPreviewProject(null);
      setStatus("Unsaved changes");
      return true;
    } catch (e) {
      setStatus((e as Error).message);
      return false;
    }
  }
  useEffect(() => {
    const refresh = () => void refreshMedia();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const editorId = useRef(crypto.randomUUID());
  const agentHandler = useRef<(request: EditorRequest) => Promise<unknown>>(
    async () => ({}),
  );
  agentHandler.current = async (request) => {
    if (Date.now() > request.expiresAt)
      throw new Error("Request expired. Read the project before retrying.");
    const command = AgentCommandSchema.parse(request.command);
    const group = request.historyGroup;
    const revisionToken = () => `${editorId.current}:${revision.current}`;
    const editing = () =>
      isGestureActive() ||
      !!previewProject ||
      !!deleteProposal ||
      projectSettings ||
      effectModal ||
      !!layerSettings ||
      !!document.querySelector("dialog[open], [popover]:popover-open") ||
      (!(
        request.nativeAssistant &&
        document.activeElement?.closest(".assistant-panel")
      ) &&
        !!document.activeElement?.closest(
          'input,textarea,select,dialog,[contenteditable="true"],.canvas-text-editor',
        ));
    const snapshot = () => ({
      project: current.current,
      revision: revisionToken(),
      selectedLayerIds: selectedIds,
      frame: player.current?.getCurrentFrame() ?? frame,
      saved: revision.current === saved.current,
      playing: player.current?.isPlaying() ?? playing,
      exportJob,
      editing: editing(),
    });
    if (command.action === "get_project") return snapshot();
    if (command.action === "get_media_library") {
      const all: MediaAsset[] = await api("/api/media?includeDeleted=true");
      setAssets(all.filter((a) => !a.deleted));
      setMediaTrash(all.filter((a) => a.deleted));
      return command.includeDeleted ? all : all.filter((a) => !a.deleted);
    }
    if (command.action === "get_effect_library") {
      const entries = await refreshEffects(current.current.effects);
      const collections = effectCollections(current.current, entries);
      return {
        projectEffects: current.current.effects,
        userEffects: collections.mine,
        libraryEffects: collections.library,
        importedEffects: entries.filter((e) => e.collection === "library"),
      };
    }
    if (command.action === "export_effect_bundle") {
      const entry = (await refreshEffects()).find(
        (e) => e.id === command.userEffectId,
      );
      if (!entry) throw new Error("User effect not found.");
      return entry.bundle;
    }
    if (editing())
      throw new Error(
        "Finish or cancel the current field, dialog, or drag before an agent edit.",
      );
    if (
      "expectedRevision" in command &&
      command.expectedRevision !== revisionToken()
    )
      throw new Error(
        "Project changed. Call get_project again and adapt the edit to the new revision.",
      );
    player.current?.pause();
    if (command.action === "refresh_media") {
      await refreshMedia();
      return snapshot();
    }
    if (command.action === "set_playback") {
      command.playing ? player.current?.play() : player.current?.pause();
      return { ...snapshot(), playing: command.playing };
    }
    if (command.action === "restore_media") {
      await api("/api/media/restore", "POST", { src: command.src });
      await refreshMedia();
      setTab("media");
      return snapshot();
    }
    if (command.action === "delete_media") {
      const a = (
        (await api("/api/media?includeDeleted=true")) as MediaAsset[]
      ).find((a) => a.src === command.src);
      if (!a) throw new Error("Media not found.");
      if (revisionToken() !== command.expectedRevision)
        throw new Error("Project changed. Read it again.");
      const result = await deleteMedia(a, command.confirmUsed, group);
      return { ...snapshot(), ...result };
    }
    if (command.action === "analyze_media") {
      if (!assets.some((a) => a.src === command.src))
        throw new Error("Media not found.");
      const response = await fetch(command.src);
      if (!response.ok) throw new Error("Media not found.");
      const blob = await response.blob();
      await api(
        "/api/media/" + command.src.split("/").pop(),
        "PUT",
        await inspectMedia(
          new File([blob], command.src.split("/").pop()!),
          command.src,
        ),
      );
      await refreshMedia();
      return snapshot();
    }
    if (command.action === "relink_media") {
      const base = current.current,
        all: MediaAsset[] = await api("/api/media");
      const old = all.find((a) => a.src === command.src),
        replacement = all.find((a) => a.src === command.replacement);
      if (
        !old?.missing ||
        !replacement ||
        replacement.missing ||
        old.type !== replacement.type
      )
        throw new Error(
          "Choose a missing source and an available replacement of the same type.",
        );
      if (
        replacement.duration &&
        base.layers.some(
          (l) =>
            l.src === old.src &&
            l.offset + l.duration > replacement.duration! + 0.001,
        )
      )
        throw new Error("Replacement is shorter than referenced clips.");
      if (revisionToken() !== command.expectedRevision)
        throw new Error("Project changed. Read it again.");
      if (
        !commit(
          {
            ...base,
            layers: base.layers.map((l) =>
              l.src === old.src ? { ...l, src: replacement.src } : l,
            ),
          },
          group,
        )
      )
        throw new Error("Relink failed.");
      await api("/api/media/relink", "POST", {
        src: old.src,
        replacement: replacement.src,
      });
      await refreshMedia();
      return snapshot();
    }
    if (command.action === "save_user_effect") {
      const effect = current.current.effects.find(
        (e) => e.id === command.effectId,
      );
      if (!effect) throw new Error("Project effect not found.");
      const entry = await persistEffect(
        effect,
        command.author ??
          userEffects.find((e) => e.bundle.effect.id === effect.id)?.bundle
            .author ??
          "",
        command.license ??
          userEffects.find((e) => e.bundle.effect.id === effect.id)?.bundle
            .license ??
          "Unspecified; contact the author before redistribution",
      );
      return { ...snapshot(), userEffect: entry };
    }
    if (command.action === "import_effect_bundle") {
      const entry = await api("/api/effects/import", "POST", command.bundle);
      await refreshEffects();
      setTab("effects");
      return { ...snapshot(), userEffect: entry };
    }
    if (command.action === "render_frame") {
      if (command.frame >= current.current.duration * current.current.fps)
        throw new Error("Frame outside composition.");
      player.current?.seekTo(command.frame);
      setFrame(command.frame);
      setStatus(`Rendering frame ${command.frame} for agent inspection…`);
      const job = await api("/api/render", "POST", {
        project: current.current,
        frame: command.frame,
        revision: revisionToken(),
      });
      setFrameRender(job);
      return job;
    }
    if (command.action === "export_video") {
      const job = await api("/api/export", "POST", current.current);
      setExportJob(job);
      return { ...snapshot(), job };
    }
    if (command.action === "apply_effect") {
      const effect =
        current.current.effects.find((e) => e.id === command.effectId) ??
        (await refreshEffects()).find(
          (e) => e.bundle.effect.id === command.effectId,
        )?.bundle.effect ??
        initialProject.effects.find((e) => e.id === command.effectId);
      if (!effect) throw new Error("Effect not found.");
      if (revisionToken() !== command.expectedRevision)
        throw new Error("Project changed. Read it again.");
      if (
        !commit(
          applyEffectToLayers(current.current, effect, command.layerIds),
          group,
        )
      )
        throw new Error("Could not apply effect.");
      setSelectedIds(command.layerIds);
      setTab("effects");
      setStatus("Effect applied · Undo available");
      return snapshot();
    }
    if (command.action === "select_layers") {
      if (
        command.layerIds.some(
          (id) => !current.current.layers.some((l) => l.id === id),
        )
      )
        throw new Error("Layer not found.");
      setSelectedIds(command.layerIds);
      return { ...snapshot(), selectedLayerIds: command.layerIds };
    }
    if (command.action === "set_playhead") {
      if (
        command.frame >=
        Math.round(current.current.duration * current.current.fps)
      )
        throw new Error("Frame is outside the composition.");
      player.current?.seekTo(command.frame);
      setFrame(command.frame);
      return { ...snapshot(), frame: command.frame };
    }
    if (command.action === "save_project") {
      await save();
      if (saved.current !== revision.current)
        throw new Error("Project was not saved. Check the editor status.");
      return snapshot();
    }
    if (command.action === "undo") {
      if (!history.current.canUndo) throw new Error("Nothing to undo.");
      undo();
    } else if (command.action === "redo") {
      if (!history.current.canRedo) throw new Error("Nothing to redo.");
      redo();
    } else {
      const next = applyAgentEdit(
        current.current,
        command,
        assets.filter((a) => !a.deleted).map((a) => a.src),
        assets,
      );
      if (!commit(next, group))
        throw new Error("Edit could not be applied. Read the project again.");
    }
    if (
      command.action === "create_effect" ||
      command.action === "update_effect"
    ) {
      await refreshEffects(current.current.effects);
      setTab("effects");
      const id =
        command.action === "create_effect"
          ? command.effect.id
          : command.effectId;
      if (request.nativeAssistant) setEffectId(id);
      else editEffect(id);
    }
    setStatus(
      `${request.clientName}: ${command.action.replaceAll("_", " ")} · Undo available`,
    );
    return snapshot();
  };
  useEffect(() => {
    if (!ready) return;
    let alive = true,
      timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await api("/api/editor/poll", "POST", {
          editorId: editorId.current,
        });
        for (const request of response.requests as EditorRequest[]) {
          if (!alive) return;
          let result: unknown, error: string | undefined;
          try {
            result = await agentHandler.current(request);
          } catch (e) {
            error = (e as Error).message;
          }
          await api("/api/editor/reply", "POST", {
            editorId: editorId.current,
            id: request.id,
            result,
            error,
          });
        }
      } catch {
        /* A restarted local service will reconnect on the next poll. */
      } finally {
        if (alive) timer = setTimeout(poll, 500);
      }
    }
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ready]);
  useEffect(() => {
    const element = project.layers.find((e) => e.id === selectedId);
    if (element) setSelectedTrack(elementTrackId(element));
    else
      setSelectedTrack((id) =>
        projectTracks(project).some((t) => t.id === id) ? id : null,
      );
  }, [project, selectedId]);
  function updateLayer(patch: Partial<Layer>, group?: string) {
    return commit(
      {
        ...current.current,
        layers: current.current.layers.map((l) =>
          l.id === selectedId ? { ...l, ...patch } : l,
        ),
      },
      group,
    );
  }
  function updateEffect(patch: Partial<Effect>, group?: string) {
    commit(
      {
        ...current.current,
        effects: (current.current.effects.some((e) => e.id === effectId)
          ? current.current.effects
          : [...current.current.effects, editingEffect!]
        ).map((e) => (e.id === effectId ? { ...e, ...patch } : e)),
      },
      group,
    );
  }
  function undo() {
    const p = history.current.undo(current.current);
    if (p) {
      revision.current++;
      current.current = p;
      setProject(p);
      setSelectedIds((ids) =>
        ids.filter((id) => p.layers.some((layer) => layer.id === id)),
      );
      setPreviewProject(null);
      setStatus("Change undone");
      void refreshMedia();
    }
  }
  function redo() {
    const p = history.current.redo(current.current);
    if (p) {
      revision.current++;
      current.current = p;
      setProject(p);
      setSelectedIds((ids) =>
        ids.filter((id) => p.layers.some((layer) => layer.id === id)),
      );
      setPreviewProject(null);
      setStatus("Change restored");
      const deleted = deletedByTransaction.current.get(p);
      if (deleted)
        void Promise.all(
          deleted.map((src) => api("/api/media/delete", "POST", { src })),
        )
          .then(() => refreshMedia())
          .catch((e) => setStatus(e.message));
      else void refreshMedia();
    }
  }
  function selectLayers(ids: string[]) {
    history.current.endGroup();
    setSelectedIds(ids);
    if (ids.length) {
      const element = current.current.layers.find((e) => e.id === ids.at(-1));
      if (element) setSelectedTrack(elementTrackId(element));
    }
    setEffectId(null);
    if (rightTab !== "agent") setRightTab("inspector");
  }
  function selectLayer(id: string, additive = false) {
    selectLayers(
      additive
        ? selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id]
        : id
          ? [id]
          : [],
    );
  }
  async function refreshMedia() {
    try {
      const all: MediaAsset[] = await api("/api/media?includeDeleted=true");
      for (const a of all)
        if (a.deleted && current.current.layers.some((l) => l.src === a.src)) {
          await api("/api/media/restore", "POST", { src: a.src });
          a.deleted = false;
        }
      setAssets(all.filter((a) => !a.deleted));
      setMediaTrash(all.filter((a) => a.deleted));
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  async function deleteMedia(
    asset: MediaAsset,
    confirmed = false,
    group?: string,
  ) {
    const base = current.current,
      used = base.layers.filter((l) => l.src === asset.src);
    if (used.length && !confirmed)
      return {
        requiresConfirmation: true,
        affectedLayers: used.map((l) => ({ id: l.id, name: l.name })),
      };
    await api("/api/media/delete", "POST", { src: asset.src });
    if (current.current !== base) {
      await api("/api/media/restore", "POST", { src: asset.src });
      throw new Error(
        "Project changed. Review the affected clips and retry deletion.",
      );
    }
    if (
      used.length &&
      !commit(
        {
          ...base,
          layers: base.layers.filter((l) => l.src !== asset.src),
        },
        group,
      )
    ) {
      await api("/api/media/restore", "POST", { src: asset.src });
      throw new Error("Deletion could not be applied.");
    }
    if (used.length)
      deletedByTransaction.current.set(current.current, [
        ...(deletedByTransaction.current.get(current.current) ?? []),
        asset.src,
      ]);
    await refreshMedia();
    setStatus(
      `Deleted ${asset.name}${used.length ? ` and ${used.length} clip(s). Undo restores the clips.` : ". Restore it from Media trash."}`,
    );
    return { deleted: true, removedLayerIds: used.map((l) => l.id) };
  }
  async function requestMediaDelete(asset: MediaAsset) {
    if (current.current.layers.some((l) => l.src === asset.src)) {
      setDeleteProposal(asset);
      return;
    }
    try {
      await deleteMedia(asset);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  async function persistEffect(
    effect: Effect,
    author = effectAuthor,
    license = effectLicense,
  ) {
    const bundle: EffectBundle = {
      format: "frameforge-effect",
      version: 1,
      engine: "frameforge-curves-v1",
      name: effect.name,
      description: effect.description,
      author,
      license,
      effect,
    };
    const entry = await api("/api/effects/save", "POST", bundle);
    await refreshEffects();
    setTab("effects");
    setStatus(`Saved ${effect.name} to My effects`);
    return entry;
  }
  function downloadEffect(effect: Effect) {
    const existing = userEffects.find(
      (e) => e.bundle.effect.id === effect.id,
    )?.bundle;
    const bundle = {
      format: "frameforge-effect",
      version: 1,
      engine: "frameforge-curves-v1",
      author: effectAuthor,
      license: effectLicense,
      ...existing,
      name: effect.name,
      description: effect.description,
      effect,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      effect.name.replace(/[^a-z0-9_-]/gi, "-") + ".kamikami-effect.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function inspectLibraryEffect(id: string) {
    editEffect(id);
    setEffectModal(true);
  }
  function editEffect(id: string) {
    setEffectModal(false);
    const bundle = userEffects.find((e) => e.bundle.effect.id === id)?.bundle;
    setEffectAuthor(bundle?.author ?? "");
    setEffectLicense(
      bundle?.license ??
        "Unspecified; contact the author before redistribution",
    );
    setEffectId(id);
    setRightTab("inspector");
    setEffectNavigation((n) => n + 1);
  }
  useEffect(() => {
    if (rightTab === "inspector" && effectId) {
      effectEditor.current?.scrollIntoView({ block: "start" });
      effectEditor.current?.focus({ preventScroll: true });
    }
  }, [effectId, rightTab, effectNavigation]);
  function save() {
    const snapshot = current.current,
      r = revision.current;
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        await api("/api/project", "PUT", snapshot);
        saved.current = r;
        setStatus(revision.current === r ? "Saved locally" : "Unsaved changes");
      })
      .catch((e) => setStatus(`Save failed: ${e.message}`));
    return saveQueue.current;
  }
  useEffect(() => {
    api("/api/project")
      .then((p) => {
        const loaded = validateProject(p);
        current.current = loaded;
        setProject(loaded);
        setSelectedIds(loaded.layers[0] ? [loaded.layers[0].id] : []);
        void refreshMedia();
        setReady(true);
        setStatus("Saved locally");
      })
      .catch((e) => setStatus(e.message));
  }, []);
  useEffect(() => {
    setSelectedIds((ids) => {
      const valid = ids.filter((id) => project.layers.some((l) => l.id === id));
      return valid.length === ids.length ? ids : valid;
    });
    if (
      effectId &&
      !project.effects.some((e) => e.id === effectId) &&
      !userEffects.some((e) => e.bundle.effect.id === effectId)
    )
      setEffectId(null);
  }, [project, selectedId, effectId]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          'input,textarea,select,[contenteditable="true"],dialog,[data-dropdown],[popover]',
        ) ||
        !ready
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        void save();
      } else if (
        event.key === "Backspace" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.isComposing &&
        !event.defaultPrevented &&
        !isGestureActive() &&
        !document.querySelector("dialog[open]") &&
        selectedIds.length > 0
      ) {
        event.preventDefault();
        if (event.repeat) return;
        player.current?.pause();
        const base = current.current;
        if (
          commit({
            ...base,
            layers: base.layers.filter(
              (element) => !selectedIds.includes(element.id),
            ),
          })
        ) {
          selectLayers([]);
          setStatus("Selected elements deleted · Undo available");
        }
      } else if (event.code === "Space" && !target.closest("button,a")) {
        event.preventDefault();
        player.current?.toggle();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [project, ready, selectedIds]);
  useEffect(() => {
    if (!ready || revision.current === saved.current) return;
    const t = setTimeout(() => void save(), 1000);
    return () => clearTimeout(t);
  }, [project, ready]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (revision.current !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const frameHandler = ({ detail }: { detail: { frame: number } }) =>
        setFrame(detail.frame),
      play = () => setPlaying(true),
      pause = () => setPlaying(false);
    p.addEventListener("frameupdate", frameHandler);
    p.addEventListener("play", play);
    p.addEventListener("pause", pause);
    return () => {
      p.removeEventListener("frameupdate", frameHandler);
      p.removeEventListener("play", play);
      p.removeEventListener("pause", pause);
    };
  }, []);
  useEffect(() => {
    if (frame >= project.duration * 24)
      player.current?.seekTo(
        Math.max(0, Math.round(project.duration * 24) - 1),
      );
  }, [project.duration]);
  useEffect(() => {
    if (!exportJob || ["done", "error"].includes(exportJob.status)) return;
    const timer = setInterval(
      () =>
        api("/api/export/" + exportJob.id)
          .then(setExportJob)
          .catch((e) =>
            setExportJob({ ...exportJob, status: "error", error: e.message }),
          ),
      1000,
    );
    return () => clearInterval(timer);
  }, [exportJob?.id, exportJob?.status]);
  async function addAsset(
    asset: MediaAsset,
    trackId?: string,
    requestedTime = frame / current.current.fps,
  ) {
    if (
      !asset.missing &&
      (asset.type === "audio" || asset.type === "video") &&
      !asset.duration
    ) {
      setMediaBusy(true);
      try {
        const response = await fetch(asset.src);
        if (!response.ok)
          throw new Error(
            "Source is missing. Refresh the library to relink it.",
          );
        const file = new File(
          [await response.blob()],
          asset.src.split("/").pop()!,
        );
        asset = await api(
          "/api/media/" + asset.src.split("/").pop(),
          "PUT",
          await inspectMedia(file, asset.src),
        );
        await refreshMedia();
      } catch (e) {
        setStatus((e as Error).message);
        return;
      } finally {
        setMediaBusy(false);
      }
    }
    if (asset.missing) {
      setStatus("Relink this missing file before adding it.");
      return;
    }
    const base = current.current;
    const start = Math.max(
      0,
      Math.min(
        Math.round(requestedTime * base.fps) / base.fps,
        base.duration - 0.125,
      ),
    );
    const duration = Math.min(
      base.duration - start,
      asset.duration ?? base.duration,
    );
    if (duration < 0.1) {
      setStatus(
        "This source is too short. Use a file at least 0.1 seconds long.",
      );
      return;
    }
    const layer = {
      ...makeLayer(asset.type, asset.name.slice(0, 100)),
      src: asset.src,
      start,
      duration,
    };
    try {
      const next = trackId
        ? insertElement(base, layer, trackId, requestedTime)
        : { ...base, layers: [...base.layers, layer] };
      if (commit(next)) {
        selectLayer(layer.id);
        setRightTab("inspector");
      }
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  function chooseImport(
    mode: "add" | "library" | "relink",
    asset?: MediaAsset,
  ) {
    importMode.current = mode;
    relinkAsset.current = asset ?? null;
    if (file.current) {
      file.current.multiple = mode !== "relink";
      file.current.click();
    }
  }
  async function importMedia(files: FileList | null) {
    if (!files) return;
    const mode = importMode.current,
      replacement = relinkAsset.current;
    setMediaBusy(true);
    for (const f of Array.from(files)) {
      try {
        if (
          mode === "relink" &&
          replacement &&
          mediaType(f.name) !== replacement.type
        )
          throw new Error(
            `Choose a ${replacement.type} file to relink ${replacement.name}.`,
          );
        setStatus(`Importing ${f.name}…`);
        const form = new FormData();
        form.append("file", f);
        let asset: MediaAsset = await api("/api/import", "POST", form);
        asset = await api(
          "/api/media/" + asset.src.split("/").pop(),
          "PUT",
          await inspectMedia(f, asset.src),
        );
        if (mode === "relink" && replacement) {
          const base = current.current;
          const references = base.layers.filter(
            (l) => l.src === replacement.src,
          );
          if (
            asset.duration &&
            references.some(
              (l) => l.offset + l.duration > asset.duration! + 0.001,
            )
          )
            throw new Error(
              "Replacement is shorter than the clips that use it. Choose a longer file. The imported file is still in your library.",
            );
          if (
            commit({
              ...base,
              layers: base.layers.map((l) =>
                l.src === replacement.src ? { ...l, src: asset.src } : l,
              ),
            })
          ) {
            await api("/api/media/relink", "POST", {
              src: replacement.src,
              replacement: asset.src,
            });
            setStatus(
              references.length
                ? `Relinked ${references.length} clip${references.length === 1 ? "" : "s"}`
                : "Replacement added to media library",
            );
          }
        } else if (mode === "add") await addAsset(asset);
        else setStatus(`Added ${f.name} to media library`);
      } catch (e) {
        setStatus((e as Error).message);
      }
    }
    await refreshMedia();
    setMediaBusy(false);
    if (file.current) file.current.value = "";
  }
  function addTitle() {
    const base = current.current;
    const l = {
      ...makeLayer("title", "Text"),
      duration: Math.min(5, base.duration),
    };
    try {
      const trackId =
        selectedTrack && projectTracks(base).some((t) => t.id === selectedTrack)
          ? selectedTrack
          : undefined;
      const next = trackId
        ? insertElement(base, l, trackId, frame / base.fps)
        : {
            ...base,
            layers: [
              ...base.layers,
              {
                ...l,
                start: Math.min(frame / base.fps, base.duration - 0.125),
                duration: Math.min(
                  l.duration,
                  base.duration - frame / base.fps,
                ),
              },
            ],
          };
      if (commit(next)) {
        selectLayer(l.id);
        setRightTab("inspector");
      }
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  function openNewLayer() {
    setLayerSettings({
      track: {
        id: crypto.randomUUID(),
        name: `Layer ${projectTracks(current.current).length + 1}`,
      },
      isNew: true,
    });
  }
  function applyEffect(id: string, layerId?: string) {
    try {
      const effect =
        project.effects.find((e) => e.id === id) ??
        userEffects.find((e) => e.bundle.effect.id === id)?.bundle.effect ??
        initialProject.effects.find((e) => e.id === id);
      if (!effect) throw new Error("Effect not found.");
      const ids = layerId ? [layerId] : selectedIds;
      if (commit(applyEffectToLayers(current.current, effect, ids))) {
        setSelectedIds(ids);
        editEffect(id);
        setStatus(`Applied ${effect.name} · Undo available`);
      }
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  async function exportVideo() {
    try {
      setExportJob(await api("/api/export", "POST", project));
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  function downloadProject() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(project, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "kamikami-project.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const effectControls = editingEffect && (
    <div
      className="effect-editor"
      ref={effectEditor}
      tabIndex={-1}
      role="region"
      aria-label={`${editingEffect.name} effect controls`}
    >
      <div className="section-line">
        <span>EFFECT DEFINITION</span>
        <button
          aria-label="Close effect controls"
          title="Close effect controls"
          onClick={() => {
            setEffectId(null);
            setEffectModal(false);
          }}
        >
          <X size={14} />
        </button>
      </div>
      <p className="muted">
        Editing {editingEffect.name}. Changes affect all{" "}
        {
          project.layers.filter((l) =>
            l.effects.some((i) => i.effectId === editingEffect.id),
          ).length
        }{" "}
        elements using this effect.
      </p>
      <div className="effect-sharing">
        <label>
          Author
          <input
            value={effectAuthor}
            maxLength={100}
            onChange={(e) => setEffectAuthor(e.target.value)}
          />
        </label>
        <label>
          License / sharing terms
          <input
            value={effectLicense}
            maxLength={200}
            onChange={(e) => setEffectLicense(e.target.value)}
          />
        </label>
        <button
          onClick={() =>
            void persistEffect(editingEffect).catch((e) => setStatus(e.message))
          }
        >
          Save to My effects
        </button>
        <button onClick={() => downloadEffect(editingEffect)}>
          Export effect bundle
        </button>
      </div>
      <TextField
        label="Effect name"
        value={editingEffect.name}
        maxLength={80}
        onChange={(name) =>
          updateEffect({ name }, `effect:${editingEffect.id}:name`)
        }
        onEndEdit={() => history.current.endGroup()}
      />
      {editingEffect.channels.map((c, i) => (
        <div className="channel" key={i}>
          <div className="section-line">
            <span>{c.property.toUpperCase()}</span>
            <Dropdown
              label="Curve"
              value={c.curve}
              onChange={(value) =>
                updateEffect({
                  channels: editingEffect.channels.map((v, j) =>
                    j === i
                      ? {
                          ...v,
                          curve: value as typeof c.curve,
                        }
                      : v,
                  ),
                })
              }
              options={["linear", "ease", "sine", "pulse"].map((c) => ({
                value: c,
                label: c,
              }))}
            />
          </div>
          <div className="field-row">
            {(["from", "to"] as const).map((key) => (
              <NumberField
                key={key}
                label={key}
                value={c[key]}
                min={-2000}
                max={2000}
                step={0.1}
                onChange={(n) =>
                  updateEffect({
                    channels: editingEffect.channels.map((v, j) =>
                      j === i ? { ...v, [key]: n } : v,
                    ),
                  })
                }
              />
            ))}
          </div>
          {["sine", "pulse"].includes(c.curve) && (
            <NumberField
              label="Frequency (Hz)"
              value={c.frequency}
              min={0}
              max={20}
              step={0.1}
              onChange={(n) =>
                updateEffect({
                  channels: editingEffect.channels.map((v, j) =>
                    j === i ? { ...v, frequency: n } : v,
                  ),
                })
              }
            />
          )}
        </div>
      ))}
      <div className="field-row">
        <label>
          Tint color
          <input
            type="color"
            value={editingEffect.color}
            onChange={(e) => updateEffect({ color: e.target.value })}
          />
        </label>
        <NumberField
          label="Tint amount"
          value={editingEffect.tint}
          min={0}
          max={1}
          step={0.01}
          onChange={(n) => updateEffect({ tint: n })}
        />
      </div>
    </div>
  );
  return (
    <div className="app">
      {effectModal && editingEffect && (
        <SettingsDialog
          title={`${editingEffect.name} effect`}
          onClose={() => {
            setEffectModal(false);
            setEffectId(null);
          }}
        >
          {effectControls}
        </SettingsDialog>
      )}
      {projectSettings && (
        <ProjectSettings
          project={project}
          onClose={() => setProjectSettings(false)}
          onSave={(next, base) => base === current.current && commit(next)}
        />
      )}
      {layerSettings && (
        <LayerSettings
          project={project}
          track={layerSettings.track}
          isNew={layerSettings.isNew}
          onClose={() => setLayerSettings(null)}
          onSave={(track, base) => {
            if (base !== current.current) return false;
            try {
              const next = layerSettings.isNew
                ? addTrack(base, track)
                : updateTrack(base, track);
              if (!commit(next)) return false;
              if (layerSettings.isNew) selectLayers([]);
              setSelectedTrack(track.id);
              return true;
            } catch (e) {
              setStatus((e as Error).message);
              return false;
            }
          }}
          onDelete={(id, base) => {
            if (base !== current.current) return false;
            try {
              return commit(deleteTrack(base, id));
            } catch (e) {
              setStatus((e as Error).message);
              return false;
            }
          }}
        />
      )}

      <dialog
        ref={deleteDialog}
        className="duration-dialog"
        onCancel={() => setDeleteProposal(null)}
      >
        <h2>Delete media and its clips?</h2>
        <p>{deleteProposal?.name} is used by these timeline layers:</p>
        <ul>
          {project.layers
            .filter((l) => l.src === deleteProposal?.src)
            .map((l) => (
              <li key={l.id}>{l.name}</li>
            ))}
        </ul>
        <p>
          The media will move to Media trash, and these clips will be removed.
          Undo restores the clips and media.
        </p>
        <div className="dialog-actions">
          <button onClick={() => setDeleteProposal(null)}>Cancel</button>
          <button
            className="primary"
            onClick={async () => {
              const a = deleteProposal;
              if (!a) return;
              try {
                await deleteMedia(a, true);
                setDeleteProposal(null);
              } catch (e) {
                setStatus((e as Error).message);
                setDeleteProposal(null);
              }
            }}
          >
            Delete media and clips
          </button>
        </div>
      </dialog>
      <header>
        <div className="brand">
          <img
            className="brand-symbol"
            src="/kamikami-icon-64.png?v=20261007-1332"
            alt=""
            width={32}
            height={32}
            draggable={false}
          />
          KamiKami<span className="version">LOCAL / 0.1</span>
        </div>
        <button
          className="project-name"
          title="Edit project settings"
          disabled={!ready}
          onClick={() => setProjectSettings(true)}
        >
          <span className="status-dot" />
          <span>{project.name}</span>
          <Settings2 size={14} />
        </button>
        <div className="header-actions">
          <ThemePicker />
          <button
            title="Undo (⌘/Ctrl Z)"
            aria-label="Undo"
            onClick={undo}
            disabled={!history.current.canUndo}
          >
            <Undo2 size={17} />
          </button>
          <button
            title="Redo (⌘/Ctrl Shift Z)"
            aria-label="Redo"
            onClick={redo}
            disabled={!history.current.canRedo}
          >
            <Redo2 size={17} />
          </button>
          <span className="divider" />
          <button onClick={() => void save()} disabled={!ready}>
            <Save size={15} />
            Save
          </button>
          <button
            className="export-button"
            onClick={exportVideo}
            disabled={
              !ready ||
              (!!exportJob && !["done", "error"].includes(exportJob.status))
            }
          >
            <ArrowUpFromLine size={15} />
            Export video
          </button>
        </div>
      </header>
      <div
        className="workspace"
        inert={!ready}
        style={
          { "--library-width": `${libraryWidth}px` } as React.CSSProperties
        }
      >
        <aside className="library">
          <input
            ref={file}
            type="file"
            hidden
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mp3,.wav,.m4a,.ogg"
            onChange={(e) => void importMedia(e.target.files)}
          />

          <div className="panel-heading">
            WORKSPACE<span className="small-label">01</span>
          </div>
          <div className="tabs">
            <button
              className={tab === "media" ? "active" : ""}
              aria-pressed={tab === "media"}
              onClick={() => {
                setTab("media");
                void refreshMedia();
              }}
            >
              <Film size={14} />
              Media
            </button>
            <button
              className={tab === "effects" ? "active" : ""}
              aria-pressed={tab === "effects"}
              onClick={() => setTab("effects")}
            >
              <Sparkles size={14} />
              Effects
            </button>
          </div>
          {tab === "media" ? (
            <>
              <div className="library-foot">
                <button onClick={() => projectFile.current?.click()}>
                  <FolderOpen size={14} />
                  Open project
                </button>
                <button onClick={downloadProject}>
                  <ArrowDownToLine size={14} />
                  Download project JSON
                </button>
                <input
                  ref={projectFile}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={async (e) => {
                    try {
                      const f = e.target.files?.[0];
                      if (f)
                        commit(validateProject(JSON.parse(await f.text())));
                    } catch (err) {
                      setStatus((err as Error).message);
                    }
                    e.target.value = "";
                  }}
                />
              </div>

              <MediaBrowser
                assets={libraryAssets}
                busy={mediaBusy}
                onImport={() => chooseImport("library")}
                onRefresh={() => void refreshMedia()}
                onRelink={(a) => chooseImport("relink", a)}
                onDelete={(a) => void requestMediaDelete(a)}
                trash={mediaTrash}
                onRestore={async (a) => {
                  try {
                    await api("/api/media/restore", "POST", { src: a.src });
                    await refreshMedia();
                  } catch (e) {
                    setStatus((e as Error).message);
                  }
                }}
              />
            </>
          ) : (
            <>
              <div className="section-line">
                <span>LOCAL EFFECT LIBRARY</span>
                <span>{libraryEffects.length}</span>
              </div>
              <div className="effect-library-actions">
                <button onClick={() => effectFile.current?.click()}>
                  <FolderOpen size={13} />
                  Import effect bundle
                </button>
                <input
                  hidden
                  type="file"
                  accept="application/json,.json"
                  ref={effectFile}
                  onChange={async (e) => {
                    try {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 1024 * 1024)
                          throw new Error("Effect bundle exceeds 1 MB.");
                        await api(
                          "/api/effects/import",
                          "POST",
                          EffectBundleSchema.parse(JSON.parse(await f.text())),
                        );
                        await refreshEffects();
                        setStatus("Effect imported into the effects library");
                      }
                    } catch (err) {
                      setStatus((err as Error).message);
                    }
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="effects-grid">
                {libraryEffects.map((e) => (
                  <EffectCard
                    key={e.id}
                    effect={e}
                    onApply={() => applyEffect(e.id)}
                    onInspect={() => inspectLibraryEffect(e.id)}
                    onDrop={(layerId) => applyEffect(e.id, layerId)}
                  />
                ))}
              </div>
              <div className="section-line">
                <span>MY EFFECTS</span>
                <span>{myEffects.length}</span>
              </div>
              {!myEffects.length && (
                <p className="effect-library-hint">No saved effects.</p>
              )}
              <div className="effects-grid">
                {myEffects.map((e) => (
                  <EffectCard
                    key={e.id}
                    effect={
                      project.effects.find(
                        (effect) => effect.id === e.bundle.effect.id,
                      ) ?? e.bundle.effect
                    }
                    onApply={() => applyEffect(e.bundle.effect.id)}
                    onInspect={() => inspectLibraryEffect(e.bundle.effect.id)}
                    onDrop={(layerId) =>
                      applyEffect(e.bundle.effect.id, layerId)
                    }
                  />
                ))}
              </div>
            </>
          )}
        </aside>
        <LibraryResize width={libraryWidth} onChange={setLibraryWidth} />
        <main className="editor">
          <div className="preview-toolbar">
            <span>
              <span className="status-dot" />
              COMPOSITION <ChevronRight size={12} /> Scene 01
            </span>
            <span>
              1920 × 1080 <span className="divider" /> 24 FPS
            </span>
          </div>
          <div
            className="preview-area"
            onPointerDown={(event) => {
              if (event.button !== 0 || event.target !== event.currentTarget)
                return;
              if (
                isGestureActive() ||
                event.currentTarget.querySelector(".canvas-text-editor")
              )
                return;
              selectLayers([]);
            }}
          >
            <div className="preview-wrap">
              <Player
                ref={player}
                component={Composition}
                inputProps={{ project: displayProject, missingSources }}
                durationInFrames={Math.round(project.duration * 24)}
                compositionWidth={1920}
                compositionHeight={1080}
                fps={24}
                style={{ width: "100%", aspectRatio: "16/9" }}
                controls={false}
                clickToPlay={false}
                acknowledgeRemotionLicense
              />
              <CanvasEditor
                project={displayProject}
                frame={frame}
                selected={selectedIds}
                assets={assets}
                playing={playing}
                onSelect={selectLayers}
                onPreview={setPreviewProject}
                onCommit={(p, base) => {
                  if (!base || base === current.current) commit(p);
                  else
                    setStatus(
                      "Project changed during the drag. Try the edit again.",
                    );
                }}
                onPause={() => player.current?.pause()}
              />
            </div>
          </div>
          <div className="transport">
            <span className="timecode">
              {timecode(frame)}{" "}
              <span>/ {timecode(Math.round(project.duration * 24))}</span>
            </span>
            <div>
              <button
                title="Back one second"
                onClick={() => player.current?.seekTo(Math.max(0, frame - 24))}
              >
                −1s
              </button>
              <button
                className="play-button"
                aria-label={playing ? "Pause" : "Play"}
                onClick={() => player.current?.toggle()}
              >
                {playing ? (
                  <Pause size={17} />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
              </button>
              <button
                title="Forward one second"
                onClick={() =>
                  player.current?.seekTo(
                    Math.min(Math.round(project.duration * 24) - 1, frame + 24),
                  )
                }
              >
                +1s
              </button>
            </div>
            <span
              className="preview-scale"
              title="Preview automatically fits the available space"
            >
              Fit to window
            </span>
          </div>
          <Timeline
            project={displayProject}
            selected={selectedIds}
            frame={frame}
            assets={assets}
            onSelect={selectLayers}
            onSeek={(f) => {
              player.current?.pause();
              player.current?.seekTo(f);
            }}
            onPreview={setPreviewProject}
            onCommit={(p, base) => {
              if (!base || base === current.current) commit(p);
              else
                setStatus(
                  "Project changed during the drag. Try the edit again.",
                );
            }}
            onStatus={setStatus}
            onPause={() => player.current?.pause()}
            selectedTrack={selectedTrack}
            onSelectTrack={(id) => {
              setSelectedTrack(id);
              selectLayers([]);
            }}
            onAddLayer={openNewLayer}
            onEditLayer={(track) => setLayerSettings({ track, isNew: false })}
            onDropMedia={(src, trackId, time) => {
              const asset = assets.find(
                (a) => a.src === src && !a.deleted && !a.missing,
              );
              if (asset) void addAsset(asset, trackId, time);
              else setStatus("This media is unavailable. Refresh the library.");
            }}
            onAddText={addTitle}
            onApplyEffect={applyEffect}
          />
        </main>
        <aside className="right-panel">
          <div className="tabs">
            <button
              className={rightTab === "inspector" ? "active" : ""}
              aria-pressed={rightTab === "inspector"}
              onClick={() => setRightTab("inspector")}
            >
              <Settings2 size={15} />
              Inspector
            </button>
            <button
              className={rightTab === "agent" ? "active" : ""}
              aria-pressed={rightTab === "agent"}
              onClick={() => setRightTab("agent")}
            >
              <WandSparkles size={15} />
              Assistant
            </button>
          </div>
          <AgentsPanel
            visible={rightTab === "agent"}
            selectedLayers={project.layers.filter((l) =>
              selectedIds.includes(l.id),
            )}
            frame={frame}
            fps={project.fps}
            undoGroup={history.current.latestGroup}
            onUndo={(id) => {
              if (history.current.latestGroup === `assistant:${id}`) undo();
            }}
            onMediaImported={() => void refreshMedia()}
          />
          {rightTab === "inspector" && (
            <div
              className="inspector"
              ref={inspector}
              key={`${selectedId}:${effectId ?? ""}`}
            >
              {!selected && (
                <div className="inspector-empty">
                  <Settings2 size={22} />
                  <p>
                    Select a clip, audio item, or text element to edit its
                    properties and effects.
                  </p>
                </div>
              )}
              {selected && (
                <>
                  <div className="section-line">
                    <span>SELECTED ELEMENT</span>
                    <div>
                      <button
                        aria-label={
                          selected.type === "audio"
                            ? selected.visible
                              ? "Disable audio element"
                              : "Enable audio element"
                            : selected.visible
                              ? "Hide element"
                              : "Show element"
                        }
                        title={
                          selected.type === "audio"
                            ? selected.visible
                              ? "Disable audio element"
                              : "Enable audio element"
                            : selected.visible
                              ? "Hide element"
                              : "Show element"
                        }
                        aria-pressed={!selected.visible}
                        onClick={() =>
                          updateLayer({ visible: !selected.visible })
                        }
                      >
                        {selected.visible ? (
                          <Eye size={14} />
                        ) : (
                          <EyeOff size={14} />
                        )}
                      </button>
                      <button
                        aria-label="Duplicate element"
                        title="Duplicate element"
                        disabled={project.layers.length >= 40}
                        onClick={() => {
                          const l = {
                            ...selected,
                            trackId: undefined,
                            id: crypto.randomUUID(),
                            name: selected.name.slice(0, 95) + " copy",
                          };
                          commit({
                            ...project,
                            layers: [...project.layers, l],
                          });
                          selectLayer(l.id);
                        }}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        aria-label="Delete element"
                        title="Delete element (Undo to restore)"
                        onClick={() => {
                          commit({
                            ...project,
                            layers: project.layers.filter(
                              (l) => l.id !== selectedId,
                            ),
                          });
                          selectLayers(
                            selectedIds.filter((id) => id !== selectedId),
                          );
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {selected.src && missingSources.includes(selected.src) && (
                    <div className="missing-notice">
                      Source file is missing.{" "}
                      <button
                        onClick={() =>
                          chooseImport(
                            "relink",
                            libraryAssets.find((a) => a.src === selected.src)!,
                          )
                        }
                      >
                        Relink file…
                      </button>
                    </div>
                  )}
                  <TextField
                    label="Element name"
                    value={selected.name}
                    maxLength={100}
                    onChange={(name) =>
                      updateLayer({ name }, `layer:${selected.id}:name`)
                    }
                    onEndEdit={() => history.current.endGroup()}
                  />
                  <div className="field-row">
                    <NumberField
                      label="Start (s)"
                      value={selected.start}
                      min={0}
                      max={project.duration - selected.duration}
                      step={0.1}
                      onChange={(n) => updateLayer({ start: n })}
                    />
                    <NumberField
                      label="Length (s)"
                      value={selected.duration}
                      min={0.1}
                      max={Math.max(
                        0.1,
                        Math.min(
                          project.duration - selected.start,
                          assets.find((a) => a.src === selected.src)?.duration
                            ? assets.find((a) => a.src === selected.src)!
                                .duration! - selected.offset
                            : project.duration,
                        ),
                      )}
                      step={0.1}
                      onChange={(n) => updateLayer({ duration: n })}
                    />
                  </div>
                  {["video", "audio"].includes(selected.type) && (
                    <>
                      <NumberField
                        label="Source offset (s)"
                        value={selected.offset}
                        min={0}
                        max={Math.max(
                          0,
                          (assets.find((a) => a.src === selected.src)
                            ?.duration ?? 36000) - selected.duration,
                        )}
                        step={0.1}
                        onChange={(n) => updateLayer({ offset: n })}
                      />
                      <div className="field-row">
                        <button
                          aria-pressed={selected.muted}
                          onClick={() =>
                            updateLayer({ muted: !selected.muted })
                          }
                        >
                          {selected.muted ? "Unmute" : "Mute"}
                        </button>
                        <button
                          aria-pressed={selected.solo}
                          onClick={() => updateLayer({ solo: !selected.solo })}
                        >
                          Solo
                        </button>
                      </div>
                      <NumberField
                        label="Volume"
                        value={selected.volume}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(n) => updateLayer({ volume: n })}
                      />
                    </>
                  )}
                  {selected.type === "title" && (
                    <>
                      <TextField
                        label="Text"
                        value={selected.text}
                        maxLength={2000}
                        multiline
                        onChange={(text) =>
                          updateLayer({ text }, `layer:${selected.id}:text`)
                        }
                        onEndEdit={() => history.current.endGroup()}
                      />
                      <FontPicker
                        layer={selected}
                        project={project}
                        onChange={(patch, font) => {
                          const base = current.current;
                          if (!base.layers.some((l) => l.id === selected.id))
                            return false;
                          return commit({
                            ...base,
                            ...(font?.id.startsWith("custom-")
                              ? {
                                  fonts: [
                                    ...(base.fonts ?? []).filter(
                                      (f) => f.id !== font.id,
                                    ),
                                    font,
                                  ],
                                }
                              : {}),
                            layers: base.layers.map((l) =>
                              l.id === selected.id ? { ...l, ...patch } : l,
                            ),
                          });
                        }}
                      />
                      <div className="field-row">
                        <NumberField
                          label="Font size"
                          value={selected.fontSize}
                          min={12}
                          max={240}
                          onChange={(n) => updateLayer({ fontSize: n })}
                        />
                        <label>
                          Color
                          <input
                            type="color"
                            value={selected.color}
                            onChange={(e) =>
                              updateLayer({ color: e.target.value })
                            }
                          />
                        </label>
                      </div>
                    </>
                  )}
                  {selected.type !== "audio" && (
                    <>
                      <div className="section-line">
                        <span>TRANSFORM</span>
                      </div>
                      <div className="field-row">
                        <NumberField
                          label="X position"
                          value={selected.x}
                          min={-1920}
                          max={1920}
                          onChange={(n) => updateLayer({ x: n })}
                        />
                        <NumberField
                          label="Y position"
                          value={selected.y}
                          min={-1080}
                          max={1080}
                          onChange={(n) => updateLayer({ y: n })}
                        />
                      </div>
                      <div className="field-row">
                        <NumberField
                          label="Scale"
                          value={selected.scale}
                          min={0.05}
                          max={5}
                          step={0.05}
                          onChange={(n) => updateLayer({ scale: n })}
                        />
                        <NumberField
                          label="Rotation"
                          value={selected.rotation}
                          min={-360}
                          max={360}
                          onChange={(n) => updateLayer({ rotation: n })}
                        />
                      </div>
                      <NumberField
                        label="Opacity"
                        value={selected.opacity}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(n) => updateLayer({ opacity: n })}
                      />
                    </>
                  )}
                  <label>
                    Layer
                    <Dropdown
                      label="Element layer"
                      value={elementTrackId(selected)}
                      onChange={(value) => {
                        try {
                          if (
                            commit(
                              moveElementsToTrack(
                                current.current,
                                [selected.id],
                                selected.id,
                                value,
                              ),
                            )
                          )
                            setSelectedTrack(value);
                        } catch (error) {
                          setStatus((error as Error).message);
                        }
                      }}
                      options={projectTracks(project).map((t) => ({
                        value: t.id,
                        label: t.name,
                      }))}
                    />
                  </label>
                  {selected.type !== "audio" && (
                    <>
                      <div className="section-line">
                        <span>APPLIED EFFECTS</span>
                        <button
                          aria-label="Browse effects"
                          title="Browse effects"
                          onClick={() => setTab("effects")}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      {selected.effects.length === 0 && (
                        <p className="muted">No effects applied.</p>
                      )}
                      {selected.effects.map((instance) => (
                        <div className="instance" key={instance.effectId}>
                          <div>
                            <button
                              onClick={() => editEffect(instance.effectId)}
                            >
                              <Sparkles size={13} />
                              {
                                project.effects.find(
                                  (e) => e.id === instance.effectId,
                                )?.name
                              }
                            </button>
                            <button
                              aria-label="Remove effect"
                              title="Remove effect"
                              onClick={() =>
                                updateLayer({
                                  effects: selected.effects.filter(
                                    (e) => e.effectId !== instance.effectId,
                                  ),
                                })
                              }
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <NumberField
                            label="Strength"
                            value={instance.amount}
                            min={0}
                            max={2}
                            step={0.1}
                            onChange={(n) =>
                              updateLayer({
                                effects: selected.effects.map((e) =>
                                  e.effectId === instance.effectId
                                    ? { ...e, amount: n }
                                    : e,
                                ),
                              })
                            }
                          />
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
              {!effectModal &&
                selected?.effects.some((e) => e.effectId === effectId) &&
                effectControls}
            </div>
          )}
        </aside>
      </div>
      <footer>
        <span role="status" aria-live="polite" title={status}>
          <span className="status-dot" />
          {status}
        </span>
        <span>
          KAMIKAMI LAB <span className="divider" /> LOCAL PROTOTYPE
        </span>
      </footer>
      {exportJob && (
        <div className="export-toast">
          <div>
            <strong>
              {exportJob.status === "done"
                ? "Your video is ready"
                : exportJob.status === "error"
                  ? "Export failed"
                  : exportJob.status === "bundling"
                    ? "Preparing renderer…"
                    : `Rendering · ${Math.round(exportJob.progress * 100)}%`}
            </strong>
            {["done", "error"].includes(exportJob.status) && (
              <button
                aria-label="Dismiss export"
                onClick={() => setExportJob(null)}
              >
                <X size={15} />
              </button>
            )}
          </div>
          {exportJob.status === "done" ? (
            <a href={"/api/exports/" + exportJob.id + ".mp4"} download>
              Download MP4 <ArrowDownToLine size={14} />
            </a>
          ) : exportJob.status === "error" ? (
            <p>{exportJob.error}</p>
          ) : (
            <>
              <progress max={1} value={exportJob.progress} />
              <small>
                First export may download a local Chromium renderer.
              </small>
            </>
          )}
        </div>
      )}
    </div>
  );
}
function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void | boolean;
}) {
  const errorId = useId();
  const format = (n: number) => String(Number(n.toFixed(3)));
  const [draft, setDraft] = useState(format(value));
  const [error, setError] = useState("");
  const dirty = useRef(false);
  useEffect(() => {
    setDraft(format(value));
    setError("");
    dirty.current = false;
  }, [value]);
  const apply = () => {
    // Display rounding must never change an untouched, frame-aligned value.
    if (!dirty.current) return;
    const result = validateNumericDraft(draft, min, max);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError("");
    dirty.current = false;
    const n = result.value!;
    if (n !== value && onChange(n) === false) setDraft(format(value));
    else setDraft(format(n));
  };
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          dirty.current = true;
          setDraft(e.target.value);
          setError("");
        }}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const result = validateNumericDraft(draft, min, max);
            if (result.error) setError(result.error);
            else e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            dirty.current = false;
            setDraft(format(value));
            setError("");
          }
        }}
      />
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error} Escape restores {format(value)}.
        </span>
      )}
    </label>
  );
}

function TextField({
  label,
  value,
  maxLength,
  required = false,
  multiline = false,
  onChange,
  onEndEdit,
}: {
  label: string;
  value: string;
  maxLength: number;
  required?: boolean;
  multiline?: boolean;
  onChange: (text: string) => void;
  onEndEdit: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  const errorId = useId();
  useEffect(() => {
    setDraft(value);
    setError("");
  }, [value]);
  const props = {
    value: draft,
    maxLength,
    required,
    "aria-invalid": !!error,
    "aria-describedby": error ? errorId : undefined,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const text = e.target.value;
      setDraft(text);
      setError("");
      if (!required || text.trim()) onChange(text);
    },
    onBlur: () => {
      if (required && !draft.trim()) {
        setDraft(value);
        setError("A project name is required. The previous name was kept.");
      }
      onEndEdit();
    },
    onKeyDown: (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
  };
  return (
    <label>
      {label}
      {multiline ? <textarea {...props} /> : <input {...props} />}
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
