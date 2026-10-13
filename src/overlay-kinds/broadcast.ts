import {
  drawn,
  ellipse,
  f,
  line,
  pad2,
  rect,
  roundRect,
  smooth,
  stage,
  timecode,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

const corners: P[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

export const broadcastKinds: Partial<Record<OverlayKind, KindSpec>> = {
  viewfinder: {
    name: "REC viewfinder",
    feel: "Broadcast",
    description:
      "A camcorder viewfinder around the element: corners, a blinking REC dot, running timecode and battery.",
    defaults: {
      color: "#f6f2ea",
      secondary: "#ff3b30",
      seconds: 0.4,
      timing: "in",
      pad: 1.2,
      speed: 1,
    },
    controls: {
      ...drawn,
      secondary: "REC dot",
      label: "Corner text",
      pad: "Gap",
      size: "Size",
      speed: "Blink speed",
      variant: "Camera",
    },
    variants: ["Camcorder", "Minimal", "Cinema"],
    draw: ({ o, a, p, W2, H2, P, S, thin, ink, solid, text, time }) => {
      const x = W2 + P,
        y = H2 + P;
      const len = S(0.35, 0.09) * smooth(p);
      const parts: OverlayPart[] = corners.map(([sx, sy], i) =>
        ink(
          line([
            [sx * x, sy * (y - len)],
            [sx * x, sy * y],
            [sx * (x - len), sy * y],
          ]),
          { width: thin * 2, cap: "square" },
          i,
        ),
      );
      const size = S(0.17, 0.028);
      const inset = size * 1.2;
      const on = Math.floor(time * o.speed * 2) % 2 === 0;
      const show = a * stage(p, 0.5, 1);
      parts.push(
        solid(
          ellipse(-x + inset + size * 0.35, -y + inset, size * 0.32),
          {
            fill: o.secondary,
            opacity: on ? show : 0,
          },
          10,
        ),
        text(
          o.label?.trim() || "REC",
          -x + inset + size * 0.95,
          -y + inset + size * 0.36,
          size,
          {
            align: "start",
            bold: true,
            opacity: show,
          },
          0,
        ),
      );
      if (o.variant === 1) return parts;
      parts.push(
        text(
          timecode(time),
          x - inset,
          -y + inset + size * 0.36,
          size,
          { align: "end", opacity: show },
          1,
        ),
      );
      if (o.variant === 2) {
        const bar = S(0.12, 0.04);
        parts.push(
          solid(
            rect(-x, -y - bar * 2.2, x, -y - bar * 1.2),
            { opacity: show * 0.8 },
            11,
          ),
          solid(
            rect(-x, y + bar * 1.2, x, y + bar * 2.2),
            { opacity: show * 0.8 },
            12,
          ),
          text(
            "4K · 24 FPS · ISO 800",
            -x + inset,
            y - inset + size * 0.2,
            size * 0.85,
            { align: "start", opacity: show },
            2,
          ),
        );
        return parts;
      }
      // Battery, bottom right.
      const bw = size * 1.8,
        bh = size * 0.85;
      const bx = x - inset - bw,
        by = y - inset - bh;
      parts.push(
        ink(
          rect(bx, by, bx + bw, by + bh),
          { width: thin * 1.4, cap: "butt", opacity: show },
          13,
        ),
        solid(
          rect(bx + bw, by + bh * 0.3, bx + bw + bh * 0.18, by + bh * 0.7),
          { opacity: show },
          14,
        ),
      );
      for (let i = 0; i < 3; i++)
        parts.push(
          solid(
            rect(
              bx + bw * (0.1 + i * 0.29),
              by + bh * 0.2,
              bx + bw * (0.33 + i * 0.29),
              by + bh * 0.8,
            ),
            { opacity: show },
            15 + i,
          ),
        );
      const c = size * 0.6;
      parts.push(
        ink(
          `M${f(-c)} 0H${f(c)}M0 ${f(-c)}V${f(c)}`,
          { width: thin, opacity: show, cap: "butt" },
          20,
        ),
      );
      return parts;
    },
  },
  safearea: {
    name: "Safe area",
    feel: "Broadcast",
    description:
      "Broadcast safe-area guides: action-safe and title-safe frames with a center cross.",
    defaults: {
      color: "#ffd166",
      strength: 0.8,
      seconds: 0.6,
      timing: "in",
      pad: 0.7,
    },
    controls: {
      ...drawn,
      pad: "Gap",
      size: "Label size",
      weight: "Line weight",
      variant: "Guides",
    },
    variants: ["Action + title", "Title safe", "Center cross"],
    draw: ({ o, a, p, W2, H2, P, S, thin, ink, text }) => {
      const parts: OverlayPart[] = [];
      const size = S(0.12, 0.02);
      const frame = (k: number, name: string, n: number, dash: boolean) => {
        const x = W2 + P * k,
          y = H2 + P * k;
        parts.push(
          ink(
            rect(-x, -y, x, y),
            {
              width: thin,
              cap: "butt",
              draw: p,
              dash: dash ? [thin * 6, thin * 4] : undefined,
            },
            n,
          ),
          text(
            name,
            -x + size * 0.4,
            -y - size * 0.5,
            size,
            { align: "start", opacity: a * stage(p, 0.6, 1) },
            n,
          ),
        );
      };
      if (o.variant !== 2) frame(0.6, "TITLE SAFE", 0, false);
      if (o.variant === 0) frame(1.8, "ACTION SAFE", 1, true);
      const c = S(0.25, 0.05) * smooth(p);
      parts.push(
        ink(
          `M${f(-c)} 0H${f(c)}M0 ${f(-c)}V${f(c)}`,
          { width: thin, cap: "butt" },
          5,
        ),
      );
      if (o.variant === 2)
        parts.push(ink(ellipse(0, 0, c * 0.45), { width: thin }, 6));
      return parts;
    },
  },
  sprockets: {
    name: "Film sprockets",
    feel: "Broadcast",
    description:
      "Film-strip bands with sprocket holes run above and below the element, rolling past.",
    defaults: {
      color: "#141414",
      seconds: 0.5,
      timing: "in",
      speed: 0.6,
      pad: 0.6,
    },
    controls: {
      ...drawn,
      color: "Film",
      speed: "Roll speed",
      pad: "Gap",
      size: "Band size",
      variant: "Stock",
    },
    variants: ["35 mm", "Super 8", "Contact sheet"],
    fills: true,
    draw: ({ o, a, p, W2, H2, P, S, solid, text, time }) => {
      const band = S(0.4, 0.1);
      const hole = band * 0.42;
      const step = hole * 1.9;
      const x = (W2 + P) * stage(p, 0, 0.8);
      const roll = (((time * o.speed * step * 4) % step) + step) % step;
      const rows = o.variant === 1 ? [-1] : [-1, 1];
      const parts: OverlayPart[] = [];
      rows.forEach((sy, ri) => {
        const y0 = sy < 0 ? -H2 - P * 0.6 - band : H2 + P * 0.6;
        let d = rect(-x, y0, x, y0 + band);
        const n = Math.ceil((x * 2) / step) + 1;
        for (let i = -1; i < n; i++) {
          const hx = -x + i * step + roll;
          if (hx - hole * 0.4 < -x || hx + hole * 0.4 > x) continue;
          const hh = o.variant === 1 ? hole * 1.1 : hole * 0.7;
          d += roundRect(
            hx - hole * 0.4,
            y0 + (band - hh) / 2,
            hx + hole * 0.4,
            y0 + (band + hh) / 2,
            hole * 0.12,
          );
        }
        parts.push(solid(d, { behind: true, evenodd: true }, ri));
        if (o.variant === 2)
          parts.push(
            text(
              `${pad2(12 + ri)} ▸ ${pad2(12 + ri)}A`,
              -x + band * 0.4,
              y0 + band * 0.68,
              band * 0.42,
              {
                fill: "#f6c445",
                align: "start",
                opacity: a * stage(p, 0.6, 1),
              },
              ri,
            ),
          );
      });
      return parts;
    },
  },
  slate: {
    name: "Slate tag",
    feel: "Broadcast",
    description:
      "A clapperboard slate claps shut beside the element — or a hanging tag or a strip of camera tape — with scene and take.",
    defaults: {
      color: "#f6f2ea",
      secondary: "#141414",
      seconds: 0.5,
      timing: "in",
      count: 1,
      placement: "left",
    },
    controls: {
      ...drawn,
      color: "Board",
      secondary: "Ink",
      label: "Title",
      count: "Scene",
      placement: "Side",
      size: "Size",
      variant: "Slate",
    },
    variants: ["Clapper", "Hanging tag", "Camera tape"],
    fills: true,
    draw: (c) => {
      const { o, a, p, W2, H2, P, S, solid, ink, text, cx, cy, thin, target } =
        c;
      const s = S(0.42, 0.1);
      const bw = s * 3.2,
        bh = s * 2;
      const at = c.side("left");
      const x =
        at === "right" ? W2 + P + bw / 2 : at === "left" ? -W2 - P - bw / 2 : 0;
      const y =
        at === "top"
          ? -H2 - P - bh / 2 - s * 0.5
          : at === "bottom"
            ? H2 + P + bh / 2
            : 0;
      c.pivot = [x, y];
      const t = `translate(${f(cx + x)} ${f(cy + y)})`;
      const title = (o.label?.trim() || "KAMIKAMI").toUpperCase();
      const size = s * 0.32;
      const rows = [
        title,
        `SCENE ${pad2(o.count)}   TAKE ${1 + (o.seed % 9)}`,
        `ROLL A   ${timecode(target.start).slice(0, 5)}`,
      ];
      const parts: OverlayPart[] = [];
      const ink2 = {
        fill: o.secondary,
        mono: true,
        align: "start" as const,
        transform: t,
        x: 0,
        y: 0,
      };
      if (o.variant === 2) {
        parts.push(
          solid(
            rect(-bw / 2, -s * 0.45, bw / 2, s * 0.45),
            {
              transform: `${t} rotate(-3)`,
              opacity: a * 0.92 * stage(p, 0, 0.4),
              fill: "#e9dfc4",
            },
            0,
          ),
          text(
            `${title} · SC ${pad2(o.count)} · TK ${1 + (o.seed % 9)}`,
            0,
            0,
            size * 1.1,
            {
              ...ink2,
              align: "middle",
              mono: false,
              font: "hand",
              transform: `${t} rotate(-3)`,
              y: size * 0.4,
              opacity: a * stage(p, 0.3, 0.8),
            },
          ),
        );
        return parts;
      }
      if (o.variant === 1) {
        const swing = Math.sin(c.time * 2.2) * 4 * (1 - stage(p, 0.9, 1) * 0.5);
        const tt = `${t} rotate(${f(swing)})`;
        parts.push(
          ink(
            line([
              [0, -bh / 2 - s * 0.9],
              [0, -bh / 2 + s * 0.15],
            ]),
            { width: thin * 1.5, transform: tt, draw: stage(p, 0, 0.3) },
            1,
          ),
          solid(
            line(
              [
                [-bw / 2 + s * 0.4, -bh / 2],
                [bw / 2 - s * 0.4, -bh / 2],
                [bw / 2, -bh / 2 + s * 0.4],
                [bw / 2, bh / 2],
                [-bw / 2, bh / 2],
                [-bw / 2, -bh / 2 + s * 0.4],
              ],
              true,
            ),
            { transform: tt, opacity: a * stage(p, 0.2, 0.5) },
            0,
          ),
          solid(
            ellipse(0, -bh / 2 + s * 0.3, s * 0.1),
            {
              fill: o.secondary,
              transform: tt,
              opacity: a * stage(p, 0.2, 0.5),
            },
            2,
          ),
        );
        rows.forEach((row, i) =>
          parts.push(
            text(
              row,
              0,
              0,
              size,
              {
                ...ink2,
                transform: tt,
                x: -bw / 2 + s * 0.3,
                y: -bh / 2 + s * (0.95 + i * 0.42),
                opacity: a * stage(p, 0.4, 0.9),
              },
              i,
            ),
          ),
        );
        return parts;
      }
      // Clapper: the striped bar swings shut as the slate lands.
      const open = (1 - smooth(stage(p, 0.3, 1))) * -28;
      const stripes = (y0: number, rot: string, n: number) => {
        const h = s * 0.45;
        const parts2: OverlayPart[] = [
          solid(
            rect(-bw / 2, y0, bw / 2, y0 + h),
            { fill: o.secondary, transform: rot },
            n,
          ),
        ];
        let d = "";
        for (let i = 0; i < 6; i++) {
          const x0 = -bw / 2 + (i * bw) / 6;
          d += line(
            [
              [x0, y0 + h],
              [x0 + bw / 12, y0],
              [x0 + bw / 6, y0],
              [x0 + bw / 12, y0 + h],
            ],
            true,
          );
        }
        parts2.push(solid(d, { transform: rot }, n + 1));
        return parts2;
      };
      parts.push(
        solid(
          rect(-bw / 2, -bh / 2, bw / 2, bh / 2),
          { fill: o.secondary, opacity: a * stage(p, 0, 0.3), transform: t },
          0,
        ),
        ...stripes(-bh / 2 - s * 0.05, t, 10),
        ...stripes(
          -bh / 2 - s * 0.5,
          `${t} translate(${f(-bw / 2)} ${f(-bh / 2)}) rotate(${f(open)}) translate(${f(bw / 2)} ${f(bh / 2)})`,
          20,
        ),
      );
      rows.forEach((row, i) =>
        parts.push(
          text(
            row,
            0,
            0,
            size,
            {
              fill: o.color,
              align: "start",
              transform: t,
              x: -bw / 2 + s * 0.25,
              y: -bh / 2 + s * (0.9 + i * 0.45),
              opacity: a * stage(p, 0.3, 0.8),
            },
            i,
          ),
        ),
      );
      return parts;
    },
  },
  lowerthird: {
    name: "Lower third",
    feel: "Broadcast",
    description:
      "A news-style lower third under the element: an accent bar with a kicker, an underline with a tag, or a box.",
    defaults: {
      color: "#f2765e",
      secondary: "#f6f2ea",
      seconds: 0.5,
      timing: "in",
      label: "LIVE",
      pad: 0.5,
    },
    controls: {
      ...drawn,
      color: "Accent",
      secondary: "Kicker text",
      label: "Kicker",
      pad: "Gap",
      size: "Size",
      variant: "Layout",
    },
    variants: ["Bar + kicker", "Underline + tag", "Box"],
    fills: true,
    text: true,
    draw: ({ o, a, p, W2, H2, P, S, solid, text, lw }) => {
      const kicker = (o.label?.trim() || "LIVE").toUpperCase();
      const size = S(0.2, 0.035);
      const kw = [...kicker].length * size * 0.72 + size * 1.1;
      const kh = size * 1.6;
      const slide = smooth(stage(p, 0, 0.7));
      const x0 = -W2 - P * 0.5,
        x1 = W2 + P * 0.5;
      const parts: OverlayPart[] = [];
      if (o.variant === 2) {
        parts.push(
          solid(
            rect(x0, -H2 - P * 0.3, x0 + (x1 - x0) * slide, H2 + P * 0.3),
            { behind: true, opacity: a * 0.85, encloses: true },
            0,
          ),
        );
      } else {
        const y = H2 + P * 0.4;
        const bh = o.variant === 1 ? lw * 1.2 : size * 0.5;
        parts.push(
          solid(
            rect(x0, y, x0 + (x1 - x0) * slide, y + bh),
            { behind: o.variant !== 1 },
            0,
          ),
        );
      }
      const ky = -H2 - P * 0.3 - kh;
      const kx = x0;
      const pop = stage(p, 0.4, 0.9);
      parts.push(
        solid(
          o.variant === 1
            ? roundRect(kx, ky, kx + kw * pop, ky + kh, kh / 2)
            : rect(kx, ky, kx + kw * pop, ky + kh),
          { fill: o.variant === 2 ? o.secondary : o.color },
          1,
        ),
        text(kicker, kx + kw / 2, ky + kh * 0.68, size, {
          fill: o.variant === 2 ? o.color : o.secondary,
          bold: true,
          opacity: a * stage(p, 0.6, 1),
        }),
      );
      return parts;
    },
  },
};
