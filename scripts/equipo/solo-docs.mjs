// scripts/equipo/solo-docs.mjs — SCRUM-1284 (R1) · ¿este PR toca SOLO documentación?
//
//   git diff --name-only origin/main...HEAD > cambiados.txt
//   node scripts/equipo/solo-docs.mjs cambiados.txt   → imprime `solo_docs=true|false` (para $GITHUB_OUTPUT)
//
// Lo usa el job «guards de navegador» para no arrancar un navegador sobre un PR que solo trae prosa:
// en los 493 PR del 22–28 sep, 156 corridas (32%) eran solo `docs/`/`.md`, y cada una pagaba ~9 min.
//
// 🔴 SOLO VALE PARA ESE JOB, y está MEDIDO por qué (SCRUM-1284, 29-sep-2026):
//   · los 38 guards de navegador (`guard:*` de package.json) no nombran ninguna ruta de `docs/`;
//   · el META-GUARD SÍ depende de docs: 2 de sus 127 ficheros objetivo están en `docs/`
//     (scrum758 → MIGRATIONS_PENDING.md, scrum769 → un fichero de microcopy) y 30 guards leen docs;
//   · el TRINQUETE corre la tanda entera, y 193 ficheros de test leen `docs/`.
// Así que meta-guard, trinquete y `build + tests` corren SIEMPRE. No reutilices esto para ellos.
//
// FAIL-CLOSED: una lista vacía o ilegible NO es «solo docs» — es «no sé qué trae», y entonces se
// corre todo. Saltarse los guards por no haber podido leer el diff es el «no pude mirar» que se lee
// como «no hay nada» (la familia de SCRUM-1153).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Una ruta es documentación si vive en `docs/`, o es un `.md` fuera de las carpetas con código. */
export function esDocumentacion(ruta) {
  const r = String(ruta).trim().replace(/\\/g, '/');
  if (!r) return false;
  if (r.startsWith('docs/')) return true;
  return /\.md$/i.test(r) && !/^(public|src|scripts|tests|prisma|\.github|\.claude)\//.test(r);
}

/** true SOLO si hay al menos un fichero y todos son documentación. */
export function soloDocs(ficheros) {
  const lista = (ficheros ?? []).map((f) => String(f).trim()).filter(Boolean);
  return lista.length > 0 && lista.every(esDocumentacion);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let lista = [];
  try {
    lista = fs.readFileSync(process.argv[2], 'utf8').split('\n');
  } catch (e) {
    console.error(`no pude leer la lista de cambios (${e.message}): se corre todo`);
  }
  const si = soloDocs(lista);
  console.error(`${lista.filter((l) => l.trim()).length} fichero(s) cambiados · solo documentación: ${si ? 'SÍ' : 'NO'}`);
  console.log(`solo_docs=${si}`);
}
