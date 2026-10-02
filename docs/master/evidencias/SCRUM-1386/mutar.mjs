#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1386/mutar.mjs — SCRUM-1386
//
// ¿EL TEST CAE CUANDO EL DEFECTO VUELVE? Corre SÓLO las mutaciones que declara
// `tests/scrum976-guards-entrada-con-techo.test.mjs`, con el motor de la casa (`correr` y `aplicarUna`
// de `scripts/meta-guard-mutaciones.mjs`): aquí no hay un segundo motor ni una segunda lista. Las
// mutaciones viven en el test, que es de donde las lee el meta-guard en CI; esto las corre a solas
// porque el meta-guard entero son cientos.
//
// El veredicto de cada fila es el de `aplicarUna`, leído en su `return`:
//   { ok: true } VIVA · { mudo } MUDA · { muerto } FICHERO MUERTO · { ciego } CIEGA.
//
// USO:  node docs/master/evidencias/SCRUM-1386/mutar.mjs        (con el árbol COMITEADO)
// No escribe ningún fichero: todo va por stdout.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { correr, aplicarUna, mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const GUARD = 'scrum976-guards-entrada-con-techo.test.mjs';

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
  filas.push({ veredicto, restaurado });
  console.log('  ' + (r.ok ? '✔' : '✖') + ' ' + veredicto.padEnd(15) + (r.ok ? '(' + (1 + (r.colaterales || 0)) + ' caen) ' : '')
    + '· «' + mut.a + '» → ' + mut.cae + (restaurado ? '' : '   🔴 NO RESTAURADO'));
  if (!r.ok) console.log('      ' + String(r.mudo || r.muerto || r.ciego).split('\n').join('\n      '));
}
const vivas = filas.filter((f) => f.veredicto === 'VIVA').length;
const sucios = filas.filter((f) => !f.restaurado).length;
console.log('\nRESULTADO: ' + vivas + ' de ' + filas.length + ' caen · sin restaurar: ' + sucios);
process.exit(vivas === filas.length && sucios === 0 ? 0 : 1);
