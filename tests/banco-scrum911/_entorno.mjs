// SCRUM-911 · entorno de staging para los recorridos. No imprime NUNCA una URL ni un secreto.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exigirDestinoCorrecto } from '../../scripts/_clave-vs-destino.mjs';

// 🔴 LA RAÍZ SE DERIVA, NO SE ESCRIBE. La primera versión llevaba `D:/MILLONARIO/cobroFlash/wt-888d`
// a pelo, y eso ata el banco a UN worktree: al moverlo a `tests/` —o al correrlo desde otro árbol,
// que es lo normal— importaría el `dist` de otro sitio y mediría un código que no es el que se cree
// estar midiendo. Dos niveles arriba de este fichero (`tests/banco-scrum911/`) es la raíz.
export const WT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..').replace(/\\/g, '/');
// El fichero de secretos vive FUERA del repositorio, al lado de los worktrees, y ahí sigue.
// SCRUM-911b: `YAQU_ENV_FILE` manda, como en `scripts/turno-staging.mjs` (SCRUM-932). Los worktrees
// de hoy viven en `.claude/worktrees/`, y desde ahí «al lado» ya no es donde está el fichero.
const SECRETOS = process.env.YAQU_ENV_FILE || path.resolve(WT, '..', 'e2e-staging-secret.txt');
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

// SCRUM-1575d · STAGING SE COMPRUEBA POR DESTINO —host Y base—, ANTES DE ABRIR NADA. Hasta aquí
// cada recorrido comparaba `host !== STAGING_HOST`, y desarrollo vive en el MISMO host (`acela`):
// una `DATABASE_URL_STAGING` que apuntara a `yaqu_dev_javier` pasaba, y `paso3`/`paso4` escribían
// en ella. Lanza con el motivo si no cuadra; devuelve la URL para que quien la usa sea la MISMA.
export function exigirStaging(url) {
  const r = exigirDestinoCorrecto('DATABASE_URL_STAGING', url, WT);
  return { url, host: r.real.host, base: r.real.base };
}

export async function prismaStaging() {
  const s = cargarSecretos();
  const { url, host } = exigirStaging(s.DATABASE_URL_STAGING);
  const { PrismaClient } = await imp('node_modules/@prisma/client/index.js');
  const db = new PrismaClient({ datasourceUrl: url });
  const [{ current_database }] = await db.$queryRaw`select current_database()`;
  return { db, base: current_database, host };
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
