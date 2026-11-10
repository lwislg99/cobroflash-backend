// Preview SOLO LECTURA de prisma/schema.prisma (worktree j5n-dev = origin/main) contra DATABASE_URL_DEV.
// Usa previewMigracion() de la casa; el único cambio es el ejecutor: el CLI fijado del checkout
// compartido (el árbol anidado no tiene node_modules propio). No imprime la URL.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const WT = 'C:/Users/Javier Pereira/cobroflash-backend/.claude/worktrees/j5n-dev';
const COMPARTIDO = 'C:/Users/Javier Pereira/cobroflash-backend';
const mod = (p) => import(pathToFileURL(path.join(WT, p)).href);
const { previewMigracion, sentenciasDestructivas } = await mod('scripts/preview-migracion.mjs');
const { comprobarClaveVsDestino, comprobarCredencialDeProduccion, OK } = await mod('scripts/_clave-vs-destino.mjs');

const env = fs.readFileSync(path.join(COMPARTIDO, '.env'), 'utf8');
const linea = env.split(/\r?\n/).find((l) => /^DATABASE_URL_DEV\s*=/.test(l));
if (!linea) { console.error('sin DATABASE_URL_DEV'); process.exit(3); }
const url = linea.replace(/^DATABASE_URL_DEV\s*=\s*/, '').trim().replace(/^['"]|['"]$/g, '');

const a = comprobarClaveVsDestino('DATABASE_URL_DEV', url, COMPARTIDO);
const b = comprobarCredencialDeProduccion('DATABASE_URL_DEV', url, COMPARTIDO);
console.log(a.mensaje); console.log(b.mensaje);
if (a.veredicto !== OK || b.veredicto !== OK) { console.error('PARO: el destino no es DEV declarado'); process.exit(4); }

const bin = path.join(COMPARTIDO, 'node_modules', 'prisma', 'build', 'index.js');
const ejecutor = (args) => {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd: WT, encoding: 'utf8', env: { ...process.env, DATABASE_URL: url } });
  if (r.error) return { ok: false, salida: '', error: r.error.message };
  return { ok: r.status === 0, salida: r.stdout || '', error: (r.stderr || '').trim().split(url).join('<URL>') };
};
const schema = path.join(WT, 'prisma', 'schema.prisma');
const r = previewMigracion({ ejecutor, schema });
if (!r.ok) { console.error(r.control.ok ? `diff falló: ${r.error}` : r.control.motivo); process.exit(1); }
console.log(`control positivo: ${r.control.tablas} CREATE TABLE (schema entero contra vacío)`);
console.log(`clase: ${r.clase} · bytes del diff: ${r.sql.length}`);
console.log('──────── SQL (DEV → schema de origin/main) ────────');
console.log(r.sql);
const malas = sentenciasDestructivas(r.sql);
console.log('──────── destructivas: ' + malas.length);
for (const l of malas) console.log('   ' + l.trim());
