# Keyframes

Added October 9, 2026.

## How the reference editors do it

| Editor | Model | What we took |
| --- | --- | --- |
| After Effects | Each property has a **stopwatch**. Once it is on, the static value is gone and every change at the current time creates or updates a keyframe (auto-key). Interpolation is set per keyframe: Linear, Bézier/Easy Ease (F9), Hold. The Graph Editor exposes influence and speed. | The stopwatch/auto-key model, per-keyframe interpolation, Easy Ease as a 33% cubic-Bézier, Hold, and turning animation off while keeping the current value. |
| Premiere Pro | Effect Controls lists every effect parameter with a stopwatch, plus ◀ ◆ ▶ (previous / add-remove / next). Keyframes are attached to the clip and travel with it. | Effect parameters are keyframeable like transforms. The ◀ ◆ ▶ navigator. Keyframes are clip-attached. |
| Final Cut Pro | Keyframe button in the Inspector at the playhead. Keyframes show as diamonds on the clip in the timeline (Video Animation), can be dragged to retime and clicked to jump. | Timeline diamonds on clips, click to seek, drag to retime. |

The result is a compact hybrid that fits the existing Inspector and declarative effect model. There is no separate panel, and the timeline stays uncluttered.

## Data model

```ts
// Element (timeline element; legacy name Layer)
keyframes?: { x?, y?, scale?, rotation?, opacity?, volume?: Keyframe[] }
// Applied effect instance
keyframes?: { amount?: Keyframe[]; parameters?: Record<path, Keyframe[]> }

type Keyframe = {
  time: number;          // animation seconds
  value: number;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "hold" | "bezier";
  bezier?: [x1, y1, x2, y2]; // CSS cubic-bezier, when easing is "bezier"
};
```

- **Time base.** A keyframe's time is the clip's *animation clock*: clip-local seconds plus `effectOffset`, the same clock effects already use. So keyframes move with the clip, stay on their source frame through left trims, and continue seamlessly across splits (both halves keep the full track).
- **Static vs. animated.** An empty or absent track means the static field (`x`, `amount`, `passes.0.size`, …) is used. A track replaces the static value entirely. Effect channels, passes and depth still apply on top of the keyframed base, so a keyframed position plus a "Held-frame jitter" effect shakes around the animated path.
- **Interpolation.** A key's easing shapes the segment that *leaves* it. Before the first key and after the last key the value holds. Keys snap to frames, and a key written onto an existing frame replaces it.
- **Effect parameters.** Paths address numeric leaves in the instance's settings snapshot, for example `passes.0.size`, `channels.1.to`, `text.distance`, `depth.from`, `passes.0.particles.velocity` or `tint`. Ranges come from the Zod schema. `count` values are rounded and seeds are excluded. When a settings edit removes the target (for example after choosing another variation), that parameter track is pruned and strength keyframes are kept.
- **Validation.** Values must stay inside the property's schema range. Volume is only valid on audio/video elements, and transforms are not valid on audio. Tracks are sorted and de-duplicated per frame.
- **Compatibility.** Projects with any keyframes are written as **version 3**. Older apps reject them instead of silently dropping the animation, and the client refuses to save them through a service older than `projectVersion: 3`. Projects without keyframes remain version 2.

## Editing

- **Inspector.** X, Y, Scale, Rotation, Opacity and Volume each have a stopwatch, ◀ ◆ ▶ buttons, and an interpolation menu when the playhead is on a keyframe that has a following segment. Each applied effect has a keyframeable **Strength**, plus **Animate parameter…** for any numeric setting.
- **Canvas.** Moving, scaling, rotating, nudging and centering are all keyframe-aware: animated properties receive a key at the playhead, while static ones change as before.
- **Timeline.** Diamonds on each clip show its keys inside the visible range. Click to seek (selecting the clip). Drag to retime every key at that frame across all properties. Each drag is one Undo step, and Escape cancels.
- **Agents.** `set_keyframes { layerId, property | effectId [+ parameter], keyframes | null }` takes clip-local times. Full tracks are also accepted through `update_layer` / `apply_project` on the animation clock.

## Not yet

- A graph editor with Bézier handles, spatial (curved) motion paths, roving keyframes and keyframe copy/paste.
- Keyframing colors, text, font size or the depth/particle sub-objects' booleans and enums. Only numbers are interpolated.
