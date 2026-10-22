import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Agent, sleep } from './_base.js';
import { writeArchitecture, writePipeline } from '../scripts/lib/diagrams.js';

const START = '<!-- docs:sync:start -->';
const END = '<!-- docs:sync:end -->';
const IGNORED = /(^|\/)(obj|bin|logs|node_modules|\.git)\//;

export class DocsAgent extends Agent {
  constructor(ctx) {
    super(ctx, 'docs');
  }

  /**
   * agent:docs:sync — analyse what changed, regenerate README block, /docs and the
   * .excalidraw diagrams, then commit and push (real mode only).
   */
  async sync() {
    try {
      await this.setStatus('on execution', 'analysing changes');
      const model = this.analyze();
      await this.emit('docs:analyzed', {
        changedFiles: model.changed.length, projects: model.projects.length, endpoints: model.endpoints.length
      });
      await sleep(this.ctx.config.mode === 'real' ? 0 : this.ctx.config.simulate.delayMs);

      await this.setStatus('on execution', 'writing README, docs and diagrams');
      const written = this.write(model);
      await this.emit('docs:written', { files: written });

      const published = await this.publish(written);
      await this.setStatus('done', published);
      await this.emit('docs:synced', { files: written, published });
    } catch (error) {
      this.ctx.state.docsFailed = true;
      await this.setStatus('blocked', `docs sync failed: ${error.message}`);
      await this.emit('docs:failed', { error: error.message });
    }
  }

  // ---- analysis ---------------------------------------------------------------------------

  git(...args) {
    const r = spawnSync('git', args, { cwd: this.ctx.root, encoding: 'utf8' });
    return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
  }

  /** Files touched by the last commit plus anything uncommitted, minus build output and generated docs. */
  changedFiles() {
    const lists = [
      this.git('diff', '--name-only', 'HEAD~1', 'HEAD'),
      this.git('diff', '--name-only', 'HEAD'),
      this.git('ls-files', '--others', '--exclude-standard')
    ];
    const files = new Set(lists.filter((l) => l.ok).flatMap((l) => l.out.split('\n')).filter(Boolean));
    return [...files].filter((f) => !IGNORED.test(f) && f !== 'README.md' && !f.startsWith('docs/')).sort();
  }

  analyze() {
    const { root } = this.ctx;
    const srcDir = join(root, 'src');
    const projects = existsSync(srcDir)
      ? readdirSync(srcDir, { withFileTypes: true }).filter((e) => e.isDirectory()).flatMap((e) => {
          const csproj = join(srcDir, e.name, `${e.name}.csproj`);
          if (!existsSync(csproj)) return [];
          const xml = readFileSync(csproj, 'utf8');
          return [{
            name: e.name,
            kind: xml.includes('Aspire.AppHost') ? 'Aspire AppHost' : xml.includes('Sdk.Web') ? 'ASP.NET Core app' : 'Library',
            references: [...xml.matchAll(/ProjectReference Include="\.\.\\([^\\"]+)\\/g)].map((m) => m[1])
          }];
        })
      : [];

    return {
      projects,
      graph: this.parseAppHost(projects),
      endpoints: this.parseEndpoints(projects),
      routes: this.parseGatewayRoutes(),
      changed: this.changedFiles(),
      commit: this.git('rev-parse', '--short', 'HEAD').out || 'uncommitted'
    };
  }

  /** Reads resource names, project names and WithReference edges from AppHost.cs. */
  parseAppHost(projects) {
    const file = join(this.ctx.root, 'src', 'ECommerce.AppHost', 'AppHost.cs');
    const resources = [];
    if (existsSync(file)) {
      const text = readFileSync(file, 'utf8');
      const statements = [...text.matchAll(/(?:var\s+(\w+)\s*=\s*)?builder\.AddProject<Projects\.(\w+)>\("(\w+)"\)([\s\S]*?);/g)];
      const byVar = new Map(statements.filter((m) => m[1]).map((m) => [m[1], m[3]]));
      for (const m of statements) {
        resources.push({
          name: m[3],
          project: m[2].replaceAll('_', '.'),
          refs: [...m[4].matchAll(/\.WithReference\((\w+)\)/g)].map((r) => byVar.get(r[1]) ?? r[1])
        });
      }
    }
    return { resources, serviceDefaults: projects.some((p) => p.name === 'ECommerce.ServiceDefaults') };
  }

  parseEndpoints(projects) {
    const found = [];
    for (const p of projects) {
      const dir = join(this.ctx.root, 'src', p.name, 'Endpoints');
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.cs'))) {
        const text = readFileSync(join(dir, f), 'utf8');
        const prefix = text.match(/MapGroup\("([^"]*)"\)/)?.[1] ?? '';
        for (const m of text.matchAll(/\.Map(Get|Post|Put|Delete|Patch)\(\s*"([^"]*)"/g)) {
          found.push({ service: p.name, method: m[1].toUpperCase(), path: `${prefix}${m[2] === '/' ? '' : m[2]}` || '/' });
        }
      }
    }
    return found;
  }

  parseGatewayRoutes() {
    const file = join(this.ctx.root, 'src', 'ECommerce.Gateway', 'appsettings.json');
    if (!existsSync(file)) return [];
    const proxy = JSON.parse(readFileSync(file, 'utf8')).ReverseProxy ?? {};
    return Object.entries(proxy.Routes ?? {}).map(([id, r]) => ({
      id,
      path: r.Match?.Path,
      cluster: r.ClusterId,
      target: Object.values(proxy.Clusters?.[r.ClusterId]?.Destinations ?? {})[0]?.Address ?? ''
    }));
  }

  // ---- generation ---------------------------------------------------------------------------

  write(model) {
    const { root } = this.ctx;
    const written = [];
    const put = (rel, content) => {
      const abs = join(root, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, content);
      written.push(rel);
    };

    put('docs/TECHNICAL.md', this.technicalDoc(model));
    this.updateReadme(model);
    written.push('README.md');

    writeArchitecture(model.graph, join(root, 'docs/diagrams/architecture.excalidraw'));
    writePipeline(join(root, 'docs/diagrams/agent-pipeline.excalidraw'));
    written.push('docs/diagrams/architecture.excalidraw', 'docs/diagrams/agent-pipeline.excalidraw');
    return written;
  }

  /** Hand-written playbook kept in config/usage-guide.md, embedded verbatim in TECHNICAL.md. */
  usageGuide() {
    const file = join(this.ctx.root, 'config', 'usage-guide.md');
    return existsSync(file) ? readFileSync(file, 'utf8').trimEnd() + '\n' : '';
  }

  mermaidGraph({ resources }) {
    const lines = ['```mermaid', 'flowchart LR'];
    for (const r of resources) lines.push(`    ${r.name}["${r.name}<br/>${r.project}"]`);
    for (const r of resources) for (const ref of r.refs) lines.push(`    ${r.name} --> ${ref}`);
    lines.push('```');
    return lines.join('\n');
  }

  technicalDoc({ projects, graph, endpoints, routes, changed, commit }) {
    const resourceOf = (p) => graph.resources.find((r) => r.project === p.name)?.name ?? '-';
    const out = [
      '# Technical documentation',
      '',
      '> Generated by the Docs & Sync agent (`agent:docs:sync`). Do not edit by hand — changes are overwritten.',
      '> The usage guide below comes from `config/usage-guide.md`; everything else is derived from the code.',
      '',
      this.usageGuide(),
      '## Projects',
      '',
      '| Project | Kind | Aspire resource | References |',
      '|---|---|---|---|',
      ...projects.map((p) => `| \`${p.name}\` | ${p.kind} | ${resourceOf(p)} | ${p.references.join(', ') || '-'} |`),
      '',
      '## Service dependency graph (from `AppHost.cs`)',
      '',
      this.mermaidGraph(graph),
      '',
      '## HTTP endpoints',
      '',
      endpoints.length ? '| Service | Method | Path |\n|---|---|---|' : '_No endpoints detected._',
      ...endpoints.map((e) => `| \`${e.service}\` | ${e.method} | \`${e.path}\` |`),
      '',
      '## Gateway routes',
      '',
      routes.length ? '| Route | Public path | Cluster | Target |\n|---|---|---|---|' : '_No routes detected._',
      ...routes.map((r) => `| ${r.id} | \`${r.path}\` | ${r.cluster} | \`${r.target}\` |`),
      '',
      '## Delivery agents',
      '',
      '| Agent | Commands | Hooks | Skills |',
      '|---|---|---|---|',
      ...Object.values(this.ctx.agentsConfig).map((a) =>
        `| ${a.label} | ${(a.commands ?? []).map((c) => `\`${c}\``).join(', ')} | ${Object.keys(a.hooks ?? {}).map((h) => `\`${h}\``).join(', ')} | ${(a.skills ?? []).join(', ') || '-'} |`),
      '',
      '## Changes analysed in the last sync',
      '',
      `Base commit: \`${commit}\``,
      ''
    ];
    if (changed.length) {
      const areas = new Map();
      for (const f of changed) {
        const parts = f.split('/');
        const area = parts[0] === 'src' ? parts.slice(0, 2).join('/') : parts[0];
        areas.set(area, [...(areas.get(area) ?? []), f]);
      }
      out.push('| Area | Files |', '|---|---|');
      for (const [area, files] of [...areas].sort()) out.push(`| \`${area}\` | ${files.length} |`);
    } else {
      out.push('_No source changes detected._');
    }
    return out.join('\n') + '\n';
  }

  /** Replaces the auto-generated block of README.md (adds it before "# Diagrams" the first time). */
  updateReadme({ projects, endpoints, routes, commit }) {
    const file = join(this.ctx.root, 'README.md');
    const readme = existsSync(file) ? readFileSync(file, 'utf8') : '# ECommerce\n';
    const block = [
      START,
      '## Project inventory (auto-generated)',
      '',
      `Kept in sync by the Docs & Sync agent after each successful deployment (last base commit: \`${commit}\`). Full details: [docs/TECHNICAL.md](docs/TECHNICAL.md).`,
      '',
      `- **Projects (${projects.length}):** ${projects.map((p) => `\`${p.name.replace('ECommerce.', '')}\``).join(', ')}`,
      `- **Endpoints (${endpoints.length}):** ${endpoints.map((e) => `\`${e.method} ${e.path}\``).join(', ') || '-'}`,
      `- **Gateway routes:** ${routes.map((r) => `\`${r.path}\` → ${r.cluster}`).join(', ') || '-'}`,
      END
    ].join('\n');

    let updated;
    if (readme.includes(START) && readme.includes(END)) {
      updated = readme.replace(new RegExp(`${START}[\\s\\S]*?${END}`), () => block);
    } else if (readme.includes('\n# Diagrams')) {
      updated = readme.replace('\n# Diagrams', () => `\n${block}\n\n---\n\n# Diagrams`);
    } else {
      updated = `${readme.trimEnd()}\n\n${block}\n`;
    }
    writeFileSync(file, updated);
  }

  // ---- publication --------------------------------------------------------------------------

  /** Commit and push the generated files. Simulate mode never touches git history. */
  async publish(files) {
    const { config } = this.ctx;
    if (config.mode !== 'real') return `docs written (${files.length} files); git skipped in simulate mode`;
    if (!config.docs.commit) return `docs written (${files.length} files); commit disabled`;

    const add = this.git('add', '--', ...config.docs.paths);
    if (!add.ok) throw new Error(`git add: ${add.err}`);
    if (this.git('diff', '--cached', '--quiet', '--', ...config.docs.paths).ok) return 'docs already up to date';

    const commit = this.git('commit', '-m', config.docs.message, '--', ...config.docs.paths);
    if (!commit.ok) throw new Error(`git commit: ${commit.err || commit.out}`);
    await this.emit('docs:committed', { message: config.docs.message });

    if (!config.docs.push) return 'docs committed (push disabled)';
    if (!this.git('remote').out) return 'docs committed (no git remote to push to)';
    const push = this.git('push');
    if (!push.ok) throw new Error(`git push: ${push.err}`);
    await this.emit('docs:pushed', {});
    return 'docs committed and pushed';
  }
}
