// SCRUM-911 · entorno de staging para los recorridos. No imprime NUNCA una URL ni un secreto.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 🔴 LA RAÍZ SE DERIVA, NO SE ESCRIBE. La primera versión llevaba `D:/MILLONARIO/cobroFlash/wt-888d`
// a pelo, y eso ata el banco a UN worktree: al moverlo a `tests/` —o al correrlo desde otro árbol,
// que es lo normal— importaría el `dist` de otro sitio y mediría un código que no es el que se cree
// estar midiendo. Dos niveles arriba de este fichero (`tests/banco-scrum911/`) es la raíz.
export const WT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..').replace(/\\/g, '/');
// El fichero de secretos vive FUERA del repositorio, al lado de los worktrees, y ahí sigue.
const SECRETOS = path.resolve(WT, '..', 'e2e-staging-secret.txt');
export const BASE = 'https://yaqu-staging-production.up.railway.app';
export const imp = (rel) => import(pathToFileURL(`${WT}/${rel}`).href);

export function cargarSecretos() {
  const txt = fs.readFileSync(SECRETOS, 'utf8');
  const out = {};
  for (const l of txt.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
    if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

export async function prismaStaging() {
  const s = cargarSecretos();
  const { parseBDSegura, STAGING_HOST } = await imp('scripts/_db-guard.mjs');
  const p = parseBDSegura(s.DATABASE_URL_STAGING);
  if (!p || p.host !== STAGING_HOST) throw new Error(`NO ES STAGING (host=${p?.host ?? 'ilegible'})`);
  const { PrismaClient } = await imp('node_modules/@prisma/client/index.js');
  const db = new PrismaClient({ datasourceUrl: s.DATABASE_URL_STAGING });
  const [{ current_database }] = await db.$queryRaw`select current_database()`;
  return { db, base: current_database, host: p.host };
}

export async function sesionQA() {
  const s = cargarSecretos();
  const r = await fetch(`${BASE}/auth/test-login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'qa@staging.yaqu', secret: s.E2E_TEST_LOGIN_SECRET }),
  });
  if (!r.ok) throw new Error(`test-login ${r.status}`);
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  const api = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: { cookie, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  };
  return { api, cookie };
}
