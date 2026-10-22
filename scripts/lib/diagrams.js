import { COLORS, Diagram } from './excalidraw.js';

const COL_W = 300;
const ROW_H = 130;
const BOX_W = 220;
const BOX_H = 70;

const colorFor = (name) => (/web|ui|front/i.test(name) ? COLORS.green : /gateway|proxy/i.test(name) ? COLORS.yellow : COLORS.blue);
const pretty = (name) => name[0].toUpperCase() + name.slice(1);

/**
 * Architecture diagram generated from the Aspire graph parsed out of AppHost.cs.
 * Resources are laid out in columns by dependency depth (callers left, callees right).
 * graph: { resources: [{ name, project, refs: [resourceName] }], serviceDefaults: boolean }
 */
export function writeArchitecture(graph, file) {
  const { resources } = graph;
  const dependents = new Map(resources.map((r) => [r.name, resources.filter((o) => o.refs.includes(r.name)).map((o) => o.name)]));
  const depthOf = (name, seen = new Set()) => {
    if (seen.has(name)) return 0;
    seen.add(name);
    const ds = dependents.get(name) ?? [];
    return ds.length ? 1 + Math.max(...ds.map((d) => depthOf(d, new Set(seen)))) : 0;
  };

  const columns = new Map();
  for (const r of resources) {
    const depth = depthOf(r.name);
    if (!columns.has(depth)) columns.set(depth, []);
    columns.get(depth).push(r);
  }

  const d = new Diagram();
  d.title(40, 20, 'ECommerce - Aspire microservices architecture');
  d.box('__apphost', 40, 80, 380, 60, 'AppHost (starts & wires every resource)', COLORS.purple, true);

  const place = {};
  let maxRows = 0;
  for (const [depth, rs] of columns) {
    maxRows = Math.max(maxRows, rs.length);
    rs.forEach((r, i) => {
      place[r.name] = { col: depth, x: 40 + depth * COL_W, y: 190 + i * ROW_H };
      d.box(r.name, place[r.name].x, place[r.name].y, BOX_W, BOX_H, `${pretty(r.name)}\n(${r.project})`, colorFor(r.name));
    });
  }

  let lane = 0;
  for (const r of resources) {
    for (const ref of r.refs) {
      if (!place[ref]) continue;
      const gap = place[ref].col - place[r.name].col;
      if (gap === 1) {
        d.arrow(r.name, 'right', ref, 'left');
      } else if (gap > 1) {
        const laneY = Math.min(place[r.name].y, place[ref].y) - 35 - 14 * lane++;
        d.arrow(r.name, 'right', ref, 'left', {
          via: [[place[r.name].x + BOX_W + 20, laneY], [place[ref].x - 20, laneY]], color: '#e8590c'
        });
      } else {
        d.arrow(r.name, 'bottom', ref, 'top', { color: '#e8590c' });
      }
    }
  }

  if (graph.serviceDefaults) {
    d.box('__defaults', 40, 190 + maxRows * ROW_H + 20, 480, 60, 'ServiceDefaults (telemetry, health, discovery)', COLORS.gray, true);
  }
  d.save(file);
}

/** Agent pipeline diagram: the 6 delivery agents plus the post-deploy Docs & Sync agent. */
export function writePipeline(file) {
  const d = new Diagram();
  d.title(40, 20, '7-agent pipeline - feedback loops and docs sync');
  d.box('orch', 40, 100, 200, 70, '1. Orchestrator', COLORS.purple);
  d.box('mon', 760, 100, 200, 70, '2. Monitoring', COLORS.orange);
  d.box('mig', 40, 300, 200, 70, '3. Migration', COLORS.blue);
  d.box('scan', 300, 300, 200, 70, '4. Code Scan', COLORS.yellow);
  d.box('qa', 560, 300, 200, 70, '5. QA (E2E + unit)', COLORS.green);
  d.box('ops', 820, 300, 200, 70, '6. DevOps', COLORS.red);
  d.box('docs', 1080, 300, 220, 70, '7. Docs & Sync', COLORS.purple);

  d.arrow('orch', 'right', 'mon', 'left', { dashed: true });
  d.label(300, 78, 'hook:on-task-dispatch -> monitor:watch');
  d.arrow('orch', 'bottom', 'mig', 'top');
  d.arrow('mig', 'right', 'scan', 'left');
  d.arrow('scan', 'right', 'qa', 'left');
  d.arrow('qa', 'right', 'ops', 'left');
  d.label(250, 275, 'OK');
  d.label(512, 275, '100% OK');

  d.arrow('scan', 'bottom', 'mig', 'bottom', { via: [[400, 440], [140, 440]], color: '#e03131' });
  d.label(160, 448, 'Loop 1 - KO: hook:on-code-rejected', '#e03131');
  d.arrow('qa', 'bottom', 'mig', 'bottom', { via: [[660, 520], [100, 520]], color: '#c2255c' });
  d.label(160, 528, 'Loop 2 - fail: hook:on-qa-failure', '#c2255c');

  d.arrow('ops', 'right', 'docs', 'left', { color: '#2f9e44' });
  d.label(835, 265, 'hook:on-pipeline-success', '#2f9e44');
  d.label(835, 385, '-> hook:on-deploy-validated', '#2f9e44');
  d.arrow('docs', 'top', 'mon', 'right', { color: '#2f9e44', via: [[1190, 135]] });
  d.label(1000, 110, 'commit + push, close mission', '#2f9e44');
  d.save(file);
}
