// tests/scrum1807c-capitulos.test.mjs — SCRUM-1807 (tramo c, S1)
//
// `capitulos()` (src/modules/quotes/domain/apartados.ts) es el recorrido cabecera → subpartidas que
// antes hacían, cada uno por su cuenta, el PDF del presupuesto (SCRUM-1786f1) y el portal del
// cliente (SCRUM-1786g, que lo copió del PDF). Es un REFACTOR: lo que sale tiene que ser lo mismo
// que salía.
//
// ── EL ORÁCULO ───────────────────────────────────────────────────────────────────────────
// `recorridoViejo` es el bucle de `filasConTotalDelApartado` tal y como estaba en `origin/main`
// `77c000dea` (customerPortal.routes.ts:131-146), copiado letra a letra salvo la cifra: en vez de
// `calcTotal(abierto)` guarda la LISTA de líneas que se habría sumado, que es lo que decide el
// recorrido (la cifra la pone cada consumidor). El PDF hacía el mismo recorrido con un `forEach`.
// Del nuevo se saca la misma secuencia de pasos y se comparan por IDENTIDAD de referencia:
// una línea copiada o reordenada se vería.
//
// La comparación del PDF y del HTML del portal, byte a byte entre el `dist` de main y el nuevo, se
// hizo una vez: guion y hashes en `docs/master/evidencias/SCRUM-1807/`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { capitulos, lineasQueSuman } = require('../dist/modules/quotes/domain/apartados.js');

/** Mutaciones que este test tiene que tumbar (se aplican con `aplicarUna`, scripts/meta-guard-mutaciones.mjs). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Se pierden las líneas de antes de la primera cabecera.
    fichero: 'src/modules/quotes/domain/apartados.ts',
    de: '      abierto = { cabecera: null, lineas: [l] };\n      salida.push(abierto);',
    a: '      abierto = { cabecera: null, lineas: [l] };',
    cae: 'SCRUM-1807c · capitulos() da el MISMO recorrido que el bucle viejo, en los casos escritos',
  },
  {
    // Una cabecera nueva no cierra la anterior: sus líneas se arrastran.
    fichero: 'src/modules/quotes/domain/apartados.ts',
    de: '      abierto = { cabecera: l, lineas: [] };',
    a: '      abierto = { cabecera: l, lineas: abierto ? [...abierto.lineas] : [] };',
    cae: 'SCRUM-1807c · capitulos() da el MISMO recorrido que el bucle viejo, en los casos escritos',
  },
];

/** El bucle de main (customerPortal.routes.ts:131-146 en 77c000dea), con la cifra cambiada por su lista. */
function recorridoViejo(lineas) {
  const suman = new Set(lineasQueSuman(lineas));
  const filas = [];
  let abierto = null;
  for (const l of lineas) {
    if (!suman.has(l)) {
      if (abierto) filas.push({ totalDelApartado: abierto });
      abierto = [];
    } else if (abierto) {
      abierto.push(l);
    }
    filas.push({ linea: l });
  }
  if (abierto) filas.push({ totalDelApartado: abierto });
  return filas;
}

/** La misma secuencia, sacada de `capitulos()` como la recorren ahora el PDF y el portal. */
function recorridoNuevo(lineas) {
  const filas = [];
  for (const { cabecera, lineas: delApartado } of capitulos(lineas)) {
    if (cabecera) filas.push({ linea: cabecera });
    for (const l of delApartado) filas.push({ linea: l });
    if (cabecera) filas.push({ totalDelApartado: delApartado });
  }
  return filas;
}

/** Cada paso como texto, con la POSICIÓN de cada línea en la entrada: compara identidad, no forma. */
function firma(filas, lineas) {
  const pos = (l) => {
    const i = lineas.indexOf(l);
    assert.ok(i >= 0, '🔴 una línea de la salida no es ninguna de las que entraron (se copió)');
    return i;
  };
  return filas.map((f) => ('linea' in f ? `L${pos(f.linea)}` : `T[${f.totalDelApartado.map(pos).join(',')}]`));
}

const cab = (concept) => ({ concept, apartado: true });
const L = (concept) => ({ concept, qty: 1, price: 10, tax: 0.21 });

const ESCRITOS = {
  'sin líneas': [],
  'sin cabeceras': [L('a'), L('b'), L('c')],
  'una cabecera y sus líneas': [cab('Salón'), L('a'), L('b')],
  'líneas antes de la primera cabecera': [L('suelta'), cab('Salón'), L('a')],
  'dos cabeceras seguidas (apartado vacío)': [cab('Salón'), cab('Cocina'), L('a')],
  'cabecera al final': [L('a'), cab('Salón')],
  'sólo cabeceras': [cab('Salón'), cab('Cocina')],
  'el caso de 1786f1/g: dos apartados × 3 y 2': [cab('Salón'), L('a'), L('b'), L('c'), cab('Cocina'), L('d'), L('e')],
  // La marca es SÓLO el booleano `true` (esApartado): ninguna de éstas abre capítulo.
  'marcas que no son `true`': [{ concept: 'x', apartado: 'true' }, { concept: 'y', apartado: 1 }, L('a'), { concept: 'z', apartado: false }],
  'líneas raras (null, sin objeto)': [null, cab('Salón'), 7, L('a')],
};

test('SCRUM-1807c · capitulos() da el MISMO recorrido que el bucle viejo, en los casos escritos', () => {
  for (const [que, lineas] of Object.entries(ESCRITOS)) {
    assert.deepEqual(firma(recorridoNuevo(lineas), lineas), firma(recorridoViejo(lineas), lineas), `🔴 ${que}`);
  }
  // Control: el oráculo no es trivial. En el caso de 1786f1/g hay dos totales y no son iguales.
  const caso = ESCRITOS['el caso de 1786f1/g: dos apartados × 3 y 2'];
  assert.deepEqual(firma(recorridoViejo(caso), caso), ['L0', 'L1', 'L2', 'L3', 'T[1,2,3]', 'L4', 'L5', 'L6', 'T[5,6]']);
});

test('SCRUM-1807c · capitulos() da el MISMO recorrido que el bucle viejo, en 500 secuencias generadas', () => {
  // PRNG con semilla fija (mulberry32): si cae, se puede repetir el caso exacto.
  let s = 18070;
  const azar = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let conCabecera = 0;
  for (let n = 0; n < 500; n++) {
    const lineas = Array.from({ length: Math.floor(azar() * 13) }, (_, i) => (azar() < 0.3 ? cab(`C${i}`) : L(`l${i}`)));
    if (lineas.some((l) => l.apartado)) conCabecera++;
    assert.deepEqual(firma(recorridoNuevo(lineas), lineas), firma(recorridoViejo(lineas), lineas), `🔴 secuencia ${n}: ${JSON.stringify(lineas.map((l) => l.concept))}`);
  }
  assert.ok(conCabecera > 300, `🔴 CIEGO: sólo ${conCabecera} de 500 secuencias llevan cabecera; el barrido no mide apartados`);
});

test('SCRUM-1807c · capitulos() con entrada que no es lista devuelve ninguno, como el filtro de `lineasQueSuman`', () => {
  assert.deepEqual(capitulos(null), []);
  assert.deepEqual(capitulos(undefined), []);
  assert.deepEqual(capitulos({}), []);
});

test('SCRUM-1807c · la forma: cabecera null sólo para lo de antes de la primera, y las mismas referencias', () => {
  const lineas = ESCRITOS['líneas antes de la primera cabecera'];
  const c = capitulos(lineas);
  assert.equal(c.length, 2);
  assert.equal(c[0].cabecera, null);
  assert.equal(c[0].lineas[0], lineas[0]);
  assert.equal(c[1].cabecera, lineas[1]);
  assert.equal(c[1].lineas[0], lineas[2]);
});
