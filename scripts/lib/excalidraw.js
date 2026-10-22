import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const COLORS = {
  blue: '#a5d8ff', green: '#b2f2bb', yellow: '#ffec99', red: '#ffc9c9',
  gray: '#e9ecef', purple: '#d0bfff', orange: '#ffd8a8'
};

let counter = 0;
const next = () => 1000 + counter++;

const base = (type, x, y, w, h, extra = {}) => ({
  id: `e${counter}`, type, x, y, width: w, height: h, angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent',
  fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [], frameId: null,
  roundness: null, seed: next(), version: 1, versionNonce: next(), isDeleted: false, boundElements: [], updated: 1,
  link: null, locked: false, ...extra
});

const textProps = (text, fontSize, extra) => ({
  text, originalText: text, fontSize, fontFamily: 1, lineHeight: 1.25, autoResize: true, ...extra
});

/** Tiny Excalidraw scene builder: bound-text boxes plus arrows bound to them. */
export class Diagram {
  constructor() {
    this.els = [];
    this.boxes = {};
  }

  box(key, x, y, w, h, label, bg = COLORS.blue, dashed = false) {
    const lines = label.split('\n').length;
    const rect = base('rectangle', x, y, w, h, {
      backgroundColor: bg, roundness: { type: 3 }, strokeStyle: dashed ? 'dashed' : 'solid'
    });
    rect.id = `box-${key}`;
    const text = base('text', x + 10, y + h / 2 - 11 * lines, w - 20, 22 * lines, textProps(label, 18, {
      textAlign: 'center', verticalAlign: 'middle', containerId: rect.id
    }));
    text.id = `txt-${key}`;
    rect.boundElements.push({ type: 'text', id: text.id });
    this.els.push(rect, text);
    this.boxes[key] = { rect, x, y, w, h };
  }

  title(x, y, text, size = 28) {
    this.els.push(base('text', x, y, text.length * size * 0.55, size * 1.25, textProps(text, size, {
      textAlign: 'left', verticalAlign: 'top', containerId: null
    })));
  }

  label(x, y, text, color = '#1e1e1e') {
    this.els.push(base('text', x, y, text.length * 9, 22, textProps(text, 16, {
      textAlign: 'left', verticalAlign: 'top', containerId: null, strokeColor: color
    })));
  }

  point(key, side) {
    const { x, y, w, h } = this.boxes[key];
    return { top: [x + w / 2, y], bottom: [x + w / 2, y + h], left: [x, y + h / 2], right: [x + w, y + h / 2] }[side];
  }

  /** Arrow from box `a` (side `sa`) to box `b` (side `sb`), optionally through absolute waypoints. */
  arrow(a, sa, b, sb, { via = [], color = '#1e1e1e', dashed = false } = {}) {
    const pts = [this.point(a, sa), ...via, this.point(b, sb)];
    const [x0, y0] = pts[0];
    const rel = pts.map(([x, y]) => [x - x0, y - y0]);
    const xs = rel.map((p) => p[0]);
    const ys = rel.map((p) => p[1]);
    const el = base('arrow', x0, y0, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), {
      strokeColor: color, strokeStyle: dashed ? 'dashed' : 'solid', roundness: { type: 2 }, points: rel,
      lastCommittedPoint: null, startArrowhead: null, endArrowhead: 'arrow', elbowed: false,
      startBinding: { elementId: `box-${a}`, focus: 0, gap: 4 },
      endBinding: { elementId: `box-${b}`, focus: 0, gap: 4 }
    });
    this.boxes[a].rect.boundElements.push({ type: 'arrow', id: el.id });
    this.boxes[b].rect.boundElements.push({ type: 'arrow', id: el.id });
    this.els.push(el);
  }

  save(file) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({
      type: 'excalidraw', version: 2, source: 'ecommerce-docs-agent', elements: this.els,
      appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {}
    }, null, 2) + '\n');
  }
}
