import {
  arc,
  backOut,
  drawn,
  ellipse,
  f,
  hand,
  line,
  polygon,
  stage,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

export const comicKinds: Partial<Record<OverlayKind, KindSpec>> = {
  focuslines: {
    name: "Focus lines",
    feel: "Comic",
    description:
      "Manga focus lines rush in from the frame edge and converge on the element.",
    defaults: {
      color: "#f6f2ea",
      strength: 0.85,
      count: 16,
      seconds: 0.35,
      timing: "in",
      boil: 8,
      pad: 1.2,
    },
    controls: {
      ...drawn,
      count: "Density",
      pad: "Clear space",
      size: "Reach",
      boil: "Redraws per second",
      variant: "Lines",
    },
    variants: ["Wedges", "Hairlines", "Short ring"],
    fills: true,
    draw: ({ o, a, p, W2, H2, P, S, r, solid, ink, thin }) => {
      const n = Math.max(8, Math.min(72, o.count * 3));
      const rin = 1 + (P * 0.25) / Math.max(0.1, Math.min(W2, H2));
      const far = Math.max(W2, H2) * 2.2 + S(3, 0.8);
      const outer = o.variant === 2 ? 1.6 : far / Math.max(W2, H2);
      let d = "";
      for (let i = 0; i < n; i++) {
        const t = ((i + r(i) * 0.6) / n) * Math.PI * 2;
        const ux = Math.cos(t),
          uy = Math.sin(t);
        // Inner tips land on an ellipse around the box, a little ragged.
        const k = rin * (1 + r(i + 100) * 0.35);
        const ix = ux * W2 * k,
          iy = uy * H2 * k;
        // The lines rush inward as they draw on.
        const reach = o.variant === 2 ? outer : outer + (1 - p) * 0.8;
        const ox = ux * Math.max(W2, H2) * reach,
          oy = uy * Math.max(W2, H2) * reach;
        const tipx = ox + (ix - ox) * p,
          tipy = oy + (iy - oy) * p;
        if (o.variant === 1) {
          d += `M${f(ox)} ${f(oy)}L${f(tipx)} ${f(tipy)}`;
          continue;
        }
        const spread = (Math.PI / n) * (0.25 + r(i + 200) * 0.5);
        const R = Math.hypot(ox, oy);
        d += `M${f(Math.cos(t - spread) * R)} ${f(Math.sin(t - spread) * R)}L${f(tipx)} ${f(tipy)}L${f(Math.cos(t + spread) * R)} ${f(Math.sin(t + spread) * R)}Z`;
      }
      return [
        o.variant === 1
          ? ink(d, { behind: true, width: thin * 1.5, cap: "butt", opacity: a })
          : solid(d, { behind: true, opacity: a }),
      ];
    },
  },
  shake: {
    name: "Shake marks",
    feel: "Comic",
    description:
      "Vibration marks either side — arcs, ticks or zigzags that jump between frames.",
    defaults: {
      color: "#f6f2ea",
      count: 2,
      speed: 8,
      timing: "constant",
      weight: 1.2,
    },
    controls: {
      ...hand,
      count: "Marks per side",
      speed: "Shakes per second",
      pad: "Gap",
      size: "Size",
      weight: "Line weight",
      variant: "Mark",
    },
    variants: ["Arcs", "Ticks", "Zigzag"],
    text: true,
    strokes: true,
    draw: ({ o, a, p, W2, H2, P, S, lw, ink, time }) => {
      const n = Math.max(1, Math.min(4, o.count));
      const flip = Math.floor(time * o.speed) % 2;
      const parts: OverlayPart[] = [];
      for (const sx of [-1, 1])
        for (let i = 0; i < n; i++) {
          const gap =
            P * 0.5 + S(0.12, 0.03) * (i + 1) + (flip ? S(0.05, 0.01) : 0);
          const x = sx * (W2 + gap);
          const hh = H2 * (0.55 - i * 0.1);
          let d: string;
          if (o.variant === 1)
            d =
              line([
                [x, -hh * 0.6 + (flip ? hh * 0.15 : 0)],
                [x + sx * S(0.12, 0.03), -hh],
              ]) +
              line([
                [x, hh * 0.6],
                [x + sx * S(0.12, 0.03), hh],
              ]);
          else if (o.variant === 2) {
            const pts: P[] = Array.from({ length: 7 }, (_, k) => [
              x + (k % 2 ? sx * S(0.06, 0.012) : 0),
              -hh + (hh * 2 * k) / 6,
            ]);
            d = line(pts);
          } else {
            const R = hh * 1.6;
            d =
              sx > 0
                ? arc(x - R * 0.85, 0, R, -0.55, 0.55)
                : arc(x + R * 0.85, 0, R, Math.PI - 0.55, Math.PI + 0.55);
          }
          parts.push(ink(d, { width: lw, opacity: a * p }, (sx + 1) * 5 + i));
        }
      return parts;
    },
  },
  balloon: {
    name: "Speech balloon",
    feel: "Comic",
    description:
      "A comic balloon pops up beside the element with your words: speech, thought, shout or whisper.",
    defaults: {
      color: "#141414",
      secondary: "#ffffff",
      seconds: 0.35,
      timing: "in",
      label: "Wow!",
      placement: "top",
      weight: 0.9,
      font: "hand",
    },
    controls: {
      ...drawn,
      label: "Words",
      placement: "Side",
      size: "Size",
      pad: "Gap",
      weight: "Outline",
      variant: "Balloon",
    },
    variants: ["Speech", "Thought", "Shout", "Whisper"],
    text: true,
    draw: (c) => {
      const { o, a, p, W2, H2, P, S, lw, ink, solid, text } = c;
      const words = c.label("Wow!");
      const size = S(0.42, 0.07);
      const tw = Math.max(
        size * 2.6,
        [...words].length * size * 0.58 + size * 1.6,
      );
      const th = size * 2.3;
      const at = c.side("top");
      const tail = size * 1.1;
      const bx =
        at === "left"
          ? -W2 - P - tw / 2 - tail * 0.4
          : at === "right"
            ? W2 + P + tw / 2 + tail * 0.4
            : W2 * 0.35;
      const by =
        at === "top"
          ? -H2 - P - th / 2 - tail
          : at === "bottom"
            ? H2 + P + th / 2 + tail
            : -H2 * 0.4;
      // Pops up from the tail.
      c.pivot = [bx, by];
      const k = backOut(stage(p, 0, 0.8));
      const sc = `translate(${f(c.cx + bx)} ${f(c.cy + by)}) scale(${f(k)})`;
      // The tail points from the balloon to the nearest edge of the box.
      const tip: P = [
        (at === "left"
          ? -W2 - P * 0.3
          : at === "right"
            ? W2 + P * 0.3
            : W2 * 0.15) - bx,
        (at === "top"
          ? -H2 - P * 0.3
          : at === "bottom"
            ? H2 + P * 0.3
            : -H2 * 0.1) - by,
      ];
      const tl = Math.hypot(tip[0], tip[1]) || 1;
      const nx = -tip[1] / tl,
        ny = tip[0] / tl;
      const base = size * 0.35;
      const rx = tw / 2,
        ry = th / 2;
      const root: P = [(tip[0] / tl) * rx * 0.7, (tip[1] / tl) * ry * 0.7];
      const parts: OverlayPart[] = [];
      const fill = { fill: o.secondary, transform: sc };
      const edge = { stroke: o.color, width: lw, transform: sc };
      if (o.variant === 2) {
        // Shout: a jagged burst with one long spike at the box.
        const pts = polygon(0, 0, 1, 12, 0, 0.72).map(([x, y]): P => [
          x * rx * 1.25,
          y * ry * 1.35,
        ]);
        const ti = pts.reduce(
          (best, pt, i) =>
            i % 2 === 0 &&
            pt[0] * tip[0] + pt[1] * tip[1] >
              pts[best][0] * tip[0] + pts[best][1] * tip[1]
              ? i
              : best,
          0,
        );
        pts[ti] = [tip[0] * 0.85, tip[1] * 0.85];
        const d = line(pts, true);
        parts.push(solid(d, { ...fill, ...edge }, 0));
      } else if (o.variant === 1) {
        // Thought: a cloud with a trail of bubbles.
        const n = 9;
        let d = "";
        for (let i = 0; i < n; i++) {
          const t = (i / n) * Math.PI * 2;
          const t2 = ((i + 1) / n) * Math.PI * 2;
          const a0: P = [Math.cos(t) * rx, Math.sin(t) * ry];
          const a1: P = [Math.cos(t2) * rx, Math.sin(t2) * ry];
          const mid = (t + t2) / 2;
          d += `${i ? "" : `M${f(a0[0])} ${f(a0[1])}`}Q${f(Math.cos(mid) * rx * 1.32)} ${f(Math.sin(mid) * ry * 1.4)} ${f(a1[0])} ${f(a1[1])}`;
        }
        parts.push(solid(d + "Z", { ...fill, ...edge }, 0));
        [0.55, 0.78, 0.95].forEach((u, i) =>
          parts.push(
            solid(
              ellipse(tip[0] * u, tip[1] * u, size * (0.32 - i * 0.08)),
              { ...fill, ...edge },
              i + 1,
            ),
          ),
        );
      } else {
        parts.push(
          solid(
            ellipse(0, 0, rx, ry),
            {
              ...fill,
              ...edge,
              dash: o.variant === 3 ? [lw * 3, lw * 2.5] : undefined,
            },
            0,
          ),
        );
        const a0: P = [root[0] + nx * base, root[1] + ny * base];
        const a1: P = [root[0] - nx * base, root[1] - ny * base];
        // Fill over the outline where the tail joins, then outline the tail.
        parts.push(solid(line([a0, tip, a1], true), { ...fill }, 1));
        parts.push(
          ink(
            line([a0, tip, a1]),
            {
              ...edge,
              cap: "round",
              dash: o.variant === 3 ? [lw * 3, lw * 2.5] : undefined,
            },
            2,
          ),
        );
      }
      parts.push(
        text(words, bx, by + size * 0.36, size, {
          fill: o.color,
          bold: true,
          mono: false,
          font: o.font === "auto" ? "hand" : o.font,
          opacity: a * stage(p, 0.4, 0.9),
          spacing: 0.02,
        }),
      );
      return parts;
    },
  },
  badge: {
    name: "Spiky badge",
    feel: "Comic",
    description:
      "A starburst, seal, ribbon or roundel badge on the corner with a short word.",
    defaults: {
      color: "#ffd23f",
      secondary: "#141414",
      seconds: 0.35,
      timing: "in",
      label: "NEW!",
      speed: 0.04,
      angle: 12,
      count: 16,
    },
    controls: {
      ...drawn,
      color: "Badge",
      secondary: "Text",
      label: "Words",
      placement: "Corner",
      size: "Size",
      speed: "Spin speed",
      angle: "Tilt (degrees)",
      count: "Points",
      variant: "Shape",
    },
    variants: ["Starburst", "Seal", "Ribbon", "Roundel"],
    fills: true,
    text: true,
    draw: (c) => {
      const { o, a, p, W2, H2, S, solid, ink, text, time, lw } = c;
      const words = c.label("NEW!");
      const R = S(0.6, 0.13) * Math.max(1, [...words].length / 5);
      const left = o.placement === "left";
      const below = o.placement === "bottom";
      const x = (left ? -1 : 1) * (W2 - R * 0.2),
        y = below ? H2 - R * 0.2 : -H2 + R * 0.2;
      c.pivot = [x, y];
      const k = backOut(stage(p, 0, 0.9));
      const spin = o.variant === 2 ? 0 : time * o.speed * 360;
      const t = `translate(${f(c.cx + x)} ${f(c.cy + y)}) rotate(${f(o.angle + spin)}) scale(${f(k)})`;
      // The word stays upright while the shape turns.
      const upright = `translate(${f(c.cx + x)} ${f(c.cy + y)}) rotate(${f(o.angle)}) scale(${f(k)})`;
      const pts = Math.max(6, Math.min(24, o.count));
      const parts: OverlayPart[] = [];
      if (o.variant === 2) {
        const w = R * 1.6,
          h = R * 0.55;
        const notch = h * 0.5;
        parts.push(
          solid(
            line(
              [
                [-w - notch, -h],
                [w + notch, -h],
                [w, 0],
                [w + notch, h],
                [-w - notch, h],
                [-w, 0],
              ],
              true,
            ),
            { transform: t },
            0,
          ),
        );
      } else if (o.variant === 1) {
        let d = "";
        const n = pts;
        for (let i = 0; i <= n; i++) {
          const th = (i / n) * Math.PI * 2;
          const mid = th - Math.PI / n;
          d += i
            ? `Q${f(Math.cos(mid) * R * 1.12)} ${f(Math.sin(mid) * R * 1.12)} ${f(Math.cos(th) * R)} ${f(Math.sin(th) * R)}`
            : `M${f(R)} 0`;
        }
        parts.push(solid(d + "Z", { transform: t }, 0));
        parts.push(
          ink(
            ellipse(0, 0, R * 0.78),
            {
              stroke: o.secondary,
              width: lw * 0.5,
              transform: t,
              dash: [lw * 1.2, lw],
            },
            1,
          ),
        );
      } else if (o.variant === 3) {
        parts.push(solid(ellipse(0, 0, R), { transform: t }, 0));
        parts.push(
          ink(
            ellipse(0, 0, R * 0.84),
            { stroke: o.secondary, width: lw * 0.6, transform: t },
            1,
          ),
        );
      } else {
        parts.push(
          solid(
            line(polygon(0, 0, R * 1.15, pts, 0, R * 0.82), true),
            { transform: t },
            0,
          ),
        );
      }
      const size =
        R *
        (o.variant === 2 ? 0.6 : 0.52) *
        Math.min(1, 5 / Math.max(3, [...words].length));
      parts.push(
        text(words, 0, size * 0.36, size, {
          fill: o.secondary,
          bold: true,
          mono: false,
          font: o.font === "auto" ? "sans" : o.font,
          transform: upright,
          x: 0,
          y: size * 0.36,
          opacity: a,
        }),
      );
      return parts;
    },
  },
};
