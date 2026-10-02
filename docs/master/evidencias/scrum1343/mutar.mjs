#!/usr/bin/env node
// docs/master/evidencias/scrum1343/mutar.mjs — SCRUM-1343
//
// ¿EL TEST CAE CUANDO EL DEFECTO VUELVE? Corre SÓLO las mutaciones que declara
// `tests/scrum1343-un-hijo-que-no-arranca-es-ciego.test.mjs`, con el motor de la casa
// (`correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`): no hay un segundo motor aquí.
// El meta-guard entero son 365 declaraciones; esto son las de un fichero.
//
// El veredicto de cada fila es el de `aplicarUna`, leído en su `return`:
//   { ok: true } VIVA · { mudo } MUDA · { muerto } FICHERO MUERTO · { ciego } CIEGA.
//
// USO:  node docs/master/evidencias/scrum1343/mutar.mjs <salida.json>      (con el árbol COMITEADO)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { correr, aplicarUna, mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const GUARD = 'scrum1343-un-hijo-que-no-arranca-es-ciego.test.mjs';
const SALIDA = process.argv[2];
if (!SALIDA) { console.error('uso: node mutar.mjs <salida.json>'); process.exit(2); }

const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, rel))).digest('hex');
const declaradas = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, 'tests', GUARD), 'utf8'), GUARD);
const mutaciones = Array.isArray(declaradas) ? declaradas : (declaradas.mutaciones || []);
console.log('POBLACIÓN: ' + mutaciones.length + ' mutaciones declaradas en tests/' + GUARD);
if (mutaciones.length === 0) { console.error('🔴 CIEGO: no he leído ninguna declaración.'); process.exit(2); }

// La BASE sin mutar, primero (A3): si no está entera en verde, no se muta nada.
const limpia = await correr(GUARD);
console.log('BASE: ' + limpia.pasados.length + ' pasan · ' + limpia.caidos.length + ' caen · ' + limpia.saltados.length + ' saltan');
if (limpia.caidos.length || limpia.pasados.length === 0) { console.error('🔴 CIEGO: la base no está en verde: ' + JSON.stringify(limpia.caidos)); process.exit(2); }

const filas = [];
for (const mut of mutaciones) {
  const antes = sha(mut.fichero);
  const r = await aplicarUna(mut, GUARD, limpia);
  const veredicto = r.ok ? 'VIVA' : (r.mudo ? 'MUDA' : (r.muerto ? 'FICHERO MUERTO' : 'CIEGA'));
  const restaurado = sha(mut.fichero) === antes;
  const caidos = r.ok ? 1 + (r.colaterales || 0) : null;
  filas.push({ cae: mut.cae, a: mut.a, veredicto, caidos, restaurado, detalle: r.ok ? null : (r.mudo || r.muerto || r.ciego) });
  console.log('  ' + (r.ok ? '✔' : '✖') + ' ' + veredicto.padEnd(15) + (caidos === null ? '' : '(' + caidos + ' caen) ') + '· ' + mut.cae + (restaurado ? '' : '   🔴 NO RESTAURADO'));
  if (!r.ok) console.log('      ' + String(r.mudo || r.muerto || r.ciego).split('\n').join('\n      '));
}
const vivas = filas.filter((f) => f.veredicto === 'VIVA').length;
const sucios = filas.filter((f) => !f.restaurado).length;
fs.writeFileSync(SALIDA, JSON.stringify({ guard: GUARD, poblacion: filas.length, vivas, sinRestaurar: sucios, filas }, null, 2) + '\n');
console.log('\nRESULTADO: ' + vivas + ' de ' + filas.length + ' caen · sin restaurar: ' + sucios);
process.exit(vivas === filas.length && sucios === 0 ? 0 : 1);
