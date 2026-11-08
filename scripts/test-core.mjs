// Compile les tests du core (TypeScript) avec esbuild puis les lance avec le testeur de Node
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'node_modules', '.core-tests');
fs.rmSync(out, { recursive: true, force: true });
const tests = fs.readdirSync(path.join(root, 'core')).filter((f) => f.endsWith('.test.ts'));
await build({ entryPoints: tests.map((f) => path.join(root, 'core', f)), outdir: out, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const r = spawnSync(process.execPath, ['--test', ...fs.readdirSync(out).map((f) => path.join(out, f))], { stdio: 'inherit' });
process.exit(r.status ?? 1);
