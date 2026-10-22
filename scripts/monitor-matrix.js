import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RESET = '\x1b[0m';
const COLORS = {
  'on execution': '\x1b[1;33m', // yellow
  'on hold': '\x1b[1;34m',      // blue
  done: '\x1b[1;32m',           // green
  blocked: '\x1b[1;31m',        // red
  waiting: '\x1b[90m'           // gray
};
const DOTS = { 'on execution': '▶', 'on hold': '⏸', done: '✔', blocked: '✖', waiting: '…' };

const pad = (text, width) => String(text).padEnd(width).slice(0, width);

/** Builds the status matrix as an array of lines (ANSI-coloured). */
export function renderMatrix(snapshot) {
  const { agents, loops, lastEvent } = snapshot;
  const line = '─'.repeat(78);
  const out = [`\x1b[1m${line}\x1b[0m`, `\x1b[1m ${pad('AGENT', 16)}${pad('STATUS', 18)}DETAIL\x1b[0m`, line];
  for (const a of agents) {
    const color = COLORS[a.status] ?? '';
    out.push(` ${pad(a.label, 16)}${color}${pad(`${DOTS[a.status] ?? '?'} ${a.status}`, 18)}${RESET}${pad(a.detail, 42)}`);
  }
  out.push(line);
  out.push(` Loop 1 (Migration⇄CodeScan): ${loops.scan}   Loop 2 (QA→Migration): ${loops.qa}`);
  out.push(` Last event: ${lastEvent ?? '-'}`);
  out.push(line);
  return out;
}

/** Redraws the matrix in place on a TTY, otherwise prints a fresh block. */
export function createPrinter(stream = process.stdout) {
  let previousHeight = 0;
  return (lines) => {
    if (stream.isTTY && previousHeight) stream.write(`\x1b[${previousHeight}A\x1b[0J`);
    stream.write(lines.join('\n') + '\n');
    previousHeight = lines.length;
  };
}

// Standalone: `node scripts/monitor-matrix.js` follows logs/status.json written by Monitoring.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'logs', 'status.json');
  const print = createPrinter();
  let last = '';
  setInterval(() => {
    if (!existsSync(file)) return;
    const raw = readFileSync(file, 'utf8');
    if (raw === last) return;
    last = raw;
    try {
      print(renderMatrix(JSON.parse(raw)));
    } catch {
      /* file being rewritten — retry on next tick */
    }
  }, 250);
}
