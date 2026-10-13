import {
  clamp01,
  drawn,
  ellipse,
  f,
  line,
  polygon,
  rect,
  smooth,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

export const energyKinds: Partial<Record<OverlayKind, KindSpec>> = {
  speedlines: {
    name: "Speed lines",
    feel: "Energy",
    description: "Comic motion lines stream behind the element.",
    defaults: {
      color: "#f6f2ea",
      strength: 0.8,
      count: 9,
      speed: 1.2,
      angle: 0,
      timing: "constant",
    },
    controls: {
      ...drawn,
      count: "Lines",
      angle: "Travel direction (degrees)",
      speed: "Speed",
      size: "Length",
      weight: "Line weight",
      pad: "Gap",
    },
    strokes: true,
    draw: ({ o, a, p, w, h, W2, H2, P, S, m, rad, r, time, ink }) => {
      const n = Math.max(2, o.count);
      const span = S(1.6, 0.45);
      const thin = o.weight * Math.max(0.03, 0.004 * m);
      // Lines stream away from the direction of travel (`angle`).
      const ux = Math.cos(rad),
        uy = Math.sin(rad);
      return Array.from({ length: n }, (_, i) => {
        const lane = (i + 0.5) / n - 0.5 + (r(i) - 0.5) * (0.6 / n);
        const phase =
          (time * o.speed * (0.8 + r(i + 30) * 0.6) + r(i + 60)) % 1;
        const len = span * (0.3 + r(i + 90) * 0.5);
        const back = Math.abs(ux) * W2 + Math.abs(uy) * H2;
        const d0 = back + P * 0.3 + phase * span;
        const across = lane * (Math.abs(ux) * h + Math.abs(uy) * w) * 1.1;
        const ox = -ux * d0 - uy * across,
          oy = -uy * d0 + ux * across;
        return ink(
          line([
            [ox, oy],
            [ox - ux * len, oy - uy * len],
          ]),
          {
            behind: true,
            width: thin * (0.6 + r(i + 120)),
            opacity: a * p * Math.sin(phase * Math.PI),
          },
          i,
        );
      });
    },
  },
  impact: {
    name: "Impact burst",
    feel: "Energy",
    description: "A spiky comic burst framing the element.",
    defaults: {
      color: "#ffe14d",
      count: 14,
      speed: 1,
      seconds: 0.3,
      timing: "in",
    },
    controls: {
      ...drawn,
      anchor: "Bursts from",
      count: "Rays",
      speed: "Throb speed",
      size: "Reach",
      pad: "Gap",
      variant: "Shape",
    },
    variants: ["Spiky", "Cloud", "Double"],
    fills: true,
    draw: ({ o, a, p, W2, H2, P, S, r, time, solid }) => {
      const n = Math.max(4, o.count);
      const rx = W2 + P * 0.6,
        ry = H2 + P * 0.6;
      const throb = 1 + 0.08 * Math.sin(time * o.speed * Math.PI * 2);
      const ring = (reach: number, k: number) => {
        const pts: P[] = [];
        for (let i = 0; i < n * 2; i++) {
          const t =
            (i / (n * 2)) * Math.PI * 2 +
            (r(i + k) - 0.5) * (Math.PI / n) * 0.5;
          const out =
            o.variant === 1
              ? i % 2
                ? 0.45
                : 0.8 + r(i + 40 + k) * 0.3
              : i % 2
                ? 0.25
                : (0.6 + r(i + 40 + k) * 0.8) * (i % 4 ? 0.75 : 1) * throb;
          pts.push([
            Math.cos(t) * (rx + reach * out),
            Math.sin(t) * (ry + reach * out),
          ]);
        }
        return pts;
      };
      const reach = S(0.6, 0.18) * smooth(p);
      const hole = `M${f(rx)} 0A${f(rx)} ${f(ry)} 0 1 0 ${f(-rx)} 0A${f(rx)} ${f(ry)} 0 1 0 ${f(rx)} 0Z`;
      const shape = (pts: P[]) => {
        if (o.variant !== 1) return line(pts, true);
        // Cloud: round bumps between the outer points.
        let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
        for (let i = 0; i < pts.length; i += 2) {
          const c = pts[(i + 1) % pts.length],
            b = pts[(i + 2) % pts.length];
          d += `Q${f(c[0] * 1.25)} ${f(c[1] * 1.25)} ${f(b[0])} ${f(b[1])}`;
        }
        return d + "Z";
      };
      const parts: OverlayPart[] = [];
      if (o.variant === 2)
        parts.push(
          solid(
            shape(ring(reach * 1.6, 7)) + hole,
            {
              behind: true,
              fill: o.secondary,
              evenodd: true,
              opacity: a * clamp01(p * 3),
              encloses: true,
            },
            1,
          ),
        );
      parts.push(
        solid(shape(ring(reach, 0)) + hole, {
          behind: true,
          evenodd: true,
          opacity: a * clamp01(p * 3),
          encloses: true,
        }),
      );
      return parts;
    },
  },
  sparkle: {
    name: "Sparkles",
    feel: "Energy",
    description: "Four-point glints twinkle around the element.",
    defaults: { color: "#fff7c2", count: 6, speed: 1, timing: "constant" },
    controls: {
      ...drawn,
      anchor: "Around",
      count: "Sparkles",
      speed: "Twinkle speed",
      size: "Size",
      pad: "Gap",
      variant: "Glint",
    },
    variants: ["Four-point", "Six-point", "Plus", "Circle glint"],
    text: true,
    fills: true,
    draw: ({ o, a, p, W2, H2, P, S, r, time, solid, ink, cx, cy, lw }) => {
      const n = Math.max(1, o.count);
      return Array.from({ length: n }, (_, i) => {
        // Seeded spots on a ring just outside the box.
        const t = r(i) * Math.PI * 2;
        const ring = 1 + 0.15 + r(i + 20) * 0.25;
        const x = Math.cos(t) * (W2 + P * 0.5) * ring,
          y = Math.sin(t) * (H2 + P * 0.5) * ring;
        const twinkle = Math.pow(
          Math.abs(
            Math.sin(
              time * o.speed * Math.PI * (0.8 + r(i + 40)) + r(i + 60) * 6,
            ),
          ),
          3,
        );
        const s = S(0.16, 0.035) * (0.6 + r(i + 80) * 0.6) * twinkle * p;
        const k = s * 0.18;
        const at = `translate(${f(cx + x)} ${f(cy + y)})`;
        if (o.variant === 2)
          return ink(
            `M${f(-s)} 0H${f(s)}M0 ${f(-s)}V${f(s)}`,
            { transform: at, width: lw * 0.8 },
            i,
          );
        if (o.variant === 3)
          return ink(
            ellipse(0, 0, s * 0.6),
            { transform: at, width: lw * 0.6, opacity: a * twinkle },
            i,
          );
        if (o.variant === 1) {
          const pts = polygon(0, 0, s, 6, -Math.PI / 2, k);
          return solid(line(pts, true), { transform: at }, i);
        }
        return solid(
          `M0 ${f(-s)}Q${f(k)} ${f(-k)} ${f(s)} 0Q${f(k)} ${f(k)} 0 ${f(s)}Q${f(-k)} ${f(k)} ${f(-s)} 0Q${f(-k)} ${f(-k)} 0 ${f(-s)}Z`,
          { transform: at },
          i,
        );
      });
    },
  },
  shockwave: {
    name: "Shockwave",
    feel: "Energy",
    description:
      "Rings ripple out from the element on every beat, or once as it lands.",
    defaults: {
      color: "#f6f2ea",
      count: 3,
      timing: "constant",
      tempo: 100,
      weight: 1.2,
      size: 1,
    },
    controls: {
      ...drawn,
      anchor: "Ripples from",
      count: "Rings per beat",
      size: "Reach",
      weight: "Line weight",
      tempo: "Tempo (BPM)",
      variant: "Ring",
    },
    variants: ["Rings", "Dashed", "Squares", "Filled pulse"],
    text: true,
    strokes: true,
    draw: ({ o, a, p, W2, H2, P, S, lw, time, ink, solid, thin }) => {
      const beat = 60 / o.tempo;
      const n = Math.max(1, Math.min(6, o.count));
      const reach = S(1.4, 0.4);
      const parts: OverlayPart[] = [];
      for (let k = 0; k < n; k++) {
        // Each ring is born a little after the previous one, every beat.
        const age = ((time - k * beat * 0.18) / beat) % 1;
        if (time < k * beat * 0.18) continue;
        const grow = 1 - Math.pow(1 - age, 2);
        const rx = W2 + P * 0.4 + reach * grow,
          ry = H2 + P * 0.4 + reach * grow;
        const op = a * p * (1 - age);
        const d =
          o.variant === 2 ? rect(-rx, -ry, rx, ry) : ellipse(0, 0, rx, ry);
        parts.push(
          o.variant === 3
            ? solid(d, { behind: true, opacity: op * 0.35 }, k)
            : ink(
                d,
                {
                  behind: true,
                  width: (o.variant === 1 ? thin * 2 : lw) * (1.4 - age),
                  opacity: op,
                  dash: o.variant === 1 ? [lw * 2.5, lw * 2] : undefined,
                  cap: "butt",
                },
                k,
              ),
        );
      }
      return parts;
    },
  },
  zap: {
    name: "Lightning",
    feel: "Energy",
    description:
      "Jagged lightning crackles off the element, re-striking every few frames.",
    defaults: {
      color: "#bfe8ff",
      count: 3,
      boil: 10,
      timing: "constant",
      stroke: "neon",
      weight: 0.9,
    },
    controls: {
      ...drawn,
      count: "Bolts",
      size: "Reach",
      boil: "Strikes per second",
      weight: "Line weight",
      variant: "Bolt",
    },
    variants: ["Bolts", "Crackle", "Single strike"],
    text: true,
    strokes: true,
    draw: ({ o, a, p, W2, H2, P, S, lw, r, ink, time }) => {
      const n = o.variant === 2 ? 1 : Math.max(1, Math.min(12, o.count));
      const reach = S(1.1, 0.3) * (o.variant === 1 ? 0.35 : 1);
      const parts: OverlayPart[] = [];
      for (let i = 0; i < n; i++) {
        const t = o.variant === 2 ? -Math.PI / 2 : r(i) * Math.PI * 2;
        const ux = Math.cos(t),
          uy = Math.sin(t);
        // Start on the box edge (ellipse) and zigzag outwards.
        const sx = ux * (W2 + P * 0.2),
          sy = uy * (H2 + P * 0.2);
        const steps = 6;
        const pts: P[] = [];
        for (let k = 0; k <= steps; k++) {
          const u = k / steps;
          const side = (r(i * 20 + k) - 0.5) * reach * 0.45 * (k ? 1 : 0);
          pts.push([
            sx + ux * reach * u - uy * side,
            sy + uy * reach * u + ux * side,
          ]);
        }
        // Bolts flash: each one shows for part of its strike.
        const on = r(i + 300 + Math.floor(time * 30)) > 0.25 ? 1 : 0.35;
        parts.push(
          ink(
            line(pts),
            { width: lw * (o.variant === 2 ? 1.6 : 1), opacity: a * p * on },
            i,
          ),
        );
      }
      return parts;
    },
  },
};
