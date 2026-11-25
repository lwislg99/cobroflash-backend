// SCRUM-1842 · `docs/RUNBOOKS.md` no puede tener dos secciones `## R<n>` con el mismo número.
//
// Por qué: hasta el 25-nov-2026 había dos «R14» (la disputa de tarjeta y la restauración de la
// base), y el correo diario del respaldo decía «§R14» a secas: quien buscara con prisa el día en
// que se pierde la base encontraba primero la disputa. La restauración pasó a R28 (SCRUM-1842b):
// el máster (Parte O) llama R14 a la DISPUTA, y el máster no se toca sin un jefe (regla 35). Una
// primera versión (SCRUM-1842) movió la disputa; se dio la vuelta porque dejaba al máster mintiendo.
//
// Población: las cabeceras `## R<n>` del fichero, partido por /\r?\n/ (A23 casilla 3), con SUELO:
// menos de 20 es un fichero que no he sabido leer, no un verde. Y la cita del correo
// (`scripts/respaldo-programado.mjs`) lleva número Y título: el título tiene que ser el de la
// cabecera de ese número, o la cita ha caducado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'docs/RUNBOOKS.md',
    de: '## R28 · Restaurar la base de datos desde un backup lógico\n',
    a: '## R14 · Restaurar la base de datos desde un backup lógico\n',
    cae: 'no hay dos cabeceras',
  },
  {
    fichero: 'docs/RUNBOOKS.md',
    de: '## R14 · Disputa de tarjeta (chargeback)\n',
    a: '## R14 · Disputa (chargeback)\n',
    cae: 'la sección R14 es la disputa',
  },
];

const SUELO = 20;

export function cabeceras(texto) {
  const out = [];
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^## (R\d+) · (.+)$/.exec(linea);
    if (m) out.push({ id: m[1], titulo: m[2] });
  }
  return out;
}

export function repetidas(lista) {
  const vistos = new Set();
  const rep = new Set();
  for (const { id } of lista) (vistos.has(id) ? rep : vistos).add(id);
  return [...rep].sort();
}

const RUNBOOKS = readFileSync(new URL('../docs/RUNBOOKS.md', import.meta.url), 'utf8');
const CORREO = readFileSync(new URL('../scripts/respaldo-programado.mjs', import.meta.url), 'utf8');
const MASTER = readFileSync(new URL('../docs/YAQU_MASTER.md', import.meta.url), 'utf8');

// Lo que el máster llama R14 (Parte O). Se lee del máster, no se copia aquí: si un jefe lo cambia,
// este test lo dice en vez de seguir defendiendo el nombre viejo.
const DISPUTA = 'Disputa de tarjeta';

test('SCRUM-1842 · control positivo: un texto sembrado con dos R14 da [R14]', () => {
  const sembrado = '## R14 · Uno\r\ntexto\n## R15 · Dos\n## R14 · Tres\n';
  assert.deepEqual(repetidas(cabeceras(sembrado)), ['R14']);
});

test('SCRUM-1842 · RUNBOOKS.md: no hay dos cabeceras ## R<n> con el mismo número', () => {
  const lista = cabeceras(RUNBOOKS);
  assert.ok(lista.length >= SUELO, `CIEGO: ${lista.length} cabeceras ## R<n> (suelo ${SUELO})`);
  assert.deepEqual(repetidas(lista), [], `números repetidos sobre ${lista.length} cabeceras`);
});

test('SCRUM-1842 · la cita del correo del respaldo lleva el número y el título de su cabecera', () => {
  const m = /docs\/RUNBOOKS\.md, §(R\d+) · ([^.']+)\./.exec(CORREO);
  assert.ok(m, 'CIEGO: no encuentro la cita «docs/RUNBOOKS.md, §R<n> · <título>.» en el correo');
  const cab = cabeceras(RUNBOOKS).filter((c) => c.id === m[1]);
  assert.equal(cab.length, 1, `§${m[1]}: ${cab.length} cabeceras con ese número`);
  assert.equal(cab[0].titulo, m[2]);
});

test('SCRUM-1842b · la sección R14 es la disputa, como la llama el máster', () => {
  // Pata del máster: si deja de llamar R14 a la disputa, el test no puede seguir defendiéndolo.
  const enMaster = MASTER.split(/\r?\n/).filter((l) => l.includes(`**R14 · ${DISPUTA}`));
  assert.equal(enMaster.length, 1,
    `CIEGO: el máster tiene ${enMaster.length} líneas «**R14 · ${DISPUTA}» (esperaba 1, Parte O). `
    + 'Si un jefe lo ha renumerado, RUNBOOKS.md y este test se mueven con él.');
  const r14 = cabeceras(RUNBOOKS).filter((c) => c.id === 'R14');
  assert.equal(r14.length, 1, `RUNBOOKS.md: ${r14.length} cabeceras ## R14`);
  assert.ok(r14[0].titulo.startsWith(DISPUTA),
    `RUNBOOKS.md §R14 se llama «${r14[0].titulo}», y el máster llama R14 a «${DISPUTA}»`);
});
