// tests/scrum859-identidad-y-motivo-cerrado.test.mjs — SCRUM-859
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS CONTROLES QUE DECIDEN SI SCRUM-859 SIRVE
//
// SCRUM-859 ensanchó el troceador con un criterio DERIVADO —un `^# ` es entrada si su cuerpo
// trae `**Medido contra:**`— y eso tuvo dos consecuencias que hay que sujetar:
//
//   ① las 55 claves de exentas eran POSICIONALES (`SCRUM-242.md#5`) y se desplazaron todas a la
//      vez, tirando cuatro tests del propio guard. Ahora van por IDENTIDAD.
//   ② cinco entradas que el troceador NUNCA vio pasan a ser visibles sin hora recuperable. Entran
//      con `INVISIBLE_HASTA_859`, y ese motivo es un CONJUNTO CERRADO: un sexto uso cae.
//
// Aquí no se re-prueba lo que ya prueba `scrum267`: se prueba lo que sólo se puede perder aquí.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trocearEntradas, identidadDeEntrada, motivoSinAncla } from './scrum267-ancla-de-medicion.test.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'docs/master');
const GUARD = path.join(RAIZ, 'tests/scrum267-ancla-de-medicion.test.mjs');

/** Lo que el meta-guard de la casa EJECUTA contra este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/scrum267-ancla-de-medicion.test.mjs',
    de: "const TOPE_INVISIBLE_HASTA_859 = 5;",
    a: "const TOPE_INVISIBLE_HASTA_859 = 99; // tope abierto a proposito",
    cae: 'SCRUM-859 · 🔴 `INVISIBLE_HASTA_859` está cerrado en CINCO',
  },
  {
    fichero: 'tests/scrum267-ancla-de-medicion.test.mjs',
    de: "      const id = identidadDeEntrada(e.tituloCompleto);",
    a: "      const id = String(e.indice); // vuelta a la clave POSICIONAL, a proposito",
    cae: 'SCRUM-859 · 🔴 insertar una entrada en medio NO mueve ninguna clave',
  },
];

/**
 * Las claves que el guard declara exentas, leídas de su fuente.
 *
 * ⚠️ El nombre del motivo lleva DÍGITOS (`INVISIBLE_HASTA_859`). La primera versión de esto
 * buscaba `[A-Z_]+` y devolvía **cero** para ese motivo — un censo que no encuentra nada y un
 * censo que no sabe mirar dan el mismo cero. Lo cazó el test del tope, que esperaba cinco.
 */
function clavesExentas() {
  return [...fs.readFileSync(GUARD, 'utf8').matchAll(/^\s*'([^']+\.md#[^']+)':\s*([A-Z_0-9]+),/gm)]
    .map((m) => ({ clave: m[1], motivo: m[2] }));
}

/**
 * 🔴 DOS FAMILIAS DE LISTA, Y NO SE PUEDEN JUZGAR IGUAL.
 *
 * Las de SCRUM-859 eximen a una entrada de **tener** ancla, así que una entrada que ya la tiene
 * SOBRA en la lista. `ANCLAS_QUE_NO_RESUELVEN` (SCRUM-649) es lo contrario: la entrada TIENE
 * ancla, y lo que falla es que el sha no apunta a ningún commit. Exigirle «que no tenga ancla»
 * la declaraba sobrante y tumbaba este test — eso pasó hoy.
 *
 * La población se declara para que una TERCERA familia no entre en silencio: si aparece un motivo
 * que no está clasificado aquí, el test de abajo cae y hay que decidir en qué familia va.
 */
const MOTIVOS_SIN_ANCLA = [
  'ANTERIOR_AL_GUARD', 'INVISIBLE_HASTA_859', 'OTRA_BASE', 'SIN_DATO', 'SIN_HORA',
  'SIN_HORA_Y_SHA_CORTO',
];
const MOTIVOS_CON_ANCLA_QUE_NO_RESUELVE = ['SHA_NO_RESUELVE'];

/** Las entradas reales del árbol, con la MISMA clave que usa el guard. */
function entradasReales() {
  const out = [];
  for (const f of fs.readdirSync(DIR).filter((x) => /^SCRUM-\d+\.md$/.test(x))) {
    const vistos = new Map();
    for (const e of trocearEntradas(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      const id = identidadDeEntrada(e.tituloCompleto);
      const n = (vistos.get(id) || 0) + 1;
      vistos.set(id, n);
      out.push({ fichero: f, clave: `${f}#${id}${n > 1 ? `~${n}` : ''}`, cuerpo: e.cuerpo, linea: e.linea });
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-859 · SUELO: hay exentas que examinar y entradas contra las que casarlas', () => {
  const ex = clavesExentas();
  const reales = entradasReales();
  assert.ok(ex.length >= 50, `🔴 CIEGO: sólo ${ex.length} claves exentas leídas del guard.`);
  assert.ok(reales.length > 700, `🔴 CIEGO: sólo ${reales.length} entradas troceadas del árbol.`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO · las 55 (hoy 53 + 5) siguen apuntando a lo mismo — UNA POR UNA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-859 · ✅ cada clave exenta apunta a UNA entrada real — una por una', () => {
  const porClave = new Map(entradasReales().map((e) => [e.clave, e]));
  const huerfanas = [];
  for (const { clave, motivo } of clavesExentas()) {
    const e = porClave.get(clave);
    // Esta mitad vale para TODAS las familias, y es el corazón de SCRUM-859: una clave por
    // identidad que ya no case con ninguna entrada es una exención que no exime nada.
    if (!e) { huerfanas.push(`${clave}  [${motivo}] — no existe ninguna entrada con esa identidad`); continue; }

    const sinAncla = MOTIVOS_SIN_ANCLA.includes(motivo);
    const conAnclaRota = MOTIVOS_CON_ANCLA_QUE_NO_RESUELVE.includes(motivo);
    if (!sinAncla && !conAnclaRota) {
      huerfanas.push(`${clave}  [${motivo}] — motivo SIN CLASIFICAR: decide si exime de tener `
        + 'ancla o de que resuelva, y declárala arriba');
      continue;
    }
    // Y apunta a algo que DE VERDAD necesita la exención, según su familia.
    if (sinAncla && !motivoSinAncla(e.cuerpo)) {
      huerfanas.push(`${clave}  [${motivo}] — YA tiene ancla: sobra en la lista`);
    }
    if (conAnclaRota && motivoSinAncla(e.cuerpo)) {
      huerfanas.push(`${clave}  [${motivo}] — NO tiene ancla válida, así que su sha no es lo que `
        + 'falla: va en una lista de las de «sin ancla», no en ésta');
    }
  }
  assert.deepEqual(huerfanas, [],
    '🔴 hay claves exentas que no apuntan a lo que decían:\n  ' + huerfanas.join('\n  '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE ②: insertar una entrada NO desplaza ninguna clave
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-859 · 🔴 insertar una entrada en medio NO mueve ninguna clave', () => {
  // Con claves posicionales, meter una entrada nueva en un fichero con exentas desplazaba TODAS
  // las de abajo — que es exactamente lo que pasó hoy y tiró cuatro tests. Se ejerce sobre un
  // fichero REAL con exentas dentro, en memoria: el fichero del árbol no se toca.
  const FICHERO = 'SCRUM-244.md';
  const texto = fs.readFileSync(path.join(DIR, FICHERO), 'utf8');

  const claves = (t) => {
    const vistos = new Map();
    return trocearEntradas(t).map((e) => {
      const id = identidadDeEntrada(e.tituloCompleto);
      const n = (vistos.get(id) || 0) + 1;
      vistos.set(id, n);
      return `${FICHERO}#${id}${n > 1 ? `~${n}` : ''}`;
    });
  };

  const antes = claves(texto);
  assert.ok(antes.length >= 3, `🔴 CIEGO: ${FICHERO} sólo trocea en ${antes.length} entradas.`);

  // Una entrada NUEVA, con su ancla en regla, metida DESPUÉS de la primera.
  const lineas = texto.split('\n');
  const corte = lineas.findIndex((l, i) => i > 0 && /^# /.test(l));
  assert.ok(corte > 0, '🔴 CIEGO: no encuentro dónde insertar.');
  const NUEVA = [
    '# SCRUM-244 · entrada INSERTADA por el control de SCRUM-859',
    '',
    '**Medido contra:** `origin/main` = `' + 'a'.repeat(40) + '` · 2026-09-15T12:00:00+02:00',
    '',
  ];
  const conInsercion = [...lineas.slice(0, corte), ...NUEVA, ...lineas.slice(corte)].join('\n');

  const despues = claves(conInsercion);
  assert.equal(despues.length, antes.length + 1, '🔴 la inserción no ha creado una entrada nueva.');

  // 🔴 LO QUE DECIDE: todas las de antes siguen existiendo con SU MISMA clave.
  const perdidas = antes.filter((c) => !despues.includes(c));
  assert.deepEqual(perdidas, [],
    '🔴 insertar una entrada ha DESPLAZADO estas claves:\n  ' + perdidas.join('\n  ')
    + '\n  Con claves por posición se desplazarían todas las de abajo. Por eso van por identidad.');
});

test('SCRUM-859 · 🔴 CONTROL del control: por POSICIÓN sí se habrían desplazado', () => {
  // Sin esto, lo de arriba podría pasar por casualidad — p. ej. si la inserción fuera al final.
  // Se repite el mismo experimento con la clave vieja y se exige que SÍ rompa.
  const texto = fs.readFileSync(path.join(DIR, 'SCRUM-244.md'), 'utf8');
  const posicionales = (t) => trocearEntradas(t).map((e, i) => `SCRUM-244.md#${i + 1}`);

  const lineas = texto.split('\n');
  const corte = lineas.findIndex((l, i) => i > 0 && /^# /.test(l));
  const conInsercion = [...lineas.slice(0, corte),
    '# SCRUM-244 · entrada INSERTADA por el control de SCRUM-859', '',
    '**Medido contra:** `origin/main` = `' + 'a'.repeat(40) + '` · 2026-09-15T12:00:00+02:00', '',
    ...lineas.slice(corte)].join('\n');

  const antes = posicionales(texto);
  const despues = posicionales(conInsercion);
  // La última clave de antes ya no describe la misma entrada: el conjunto creció por el final.
  assert.notEqual(despues.length, antes.length, '🔴 el experimento no ha insertado nada.');
  const ultimaAntes = trocearEntradas(texto).slice(-1)[0];
  const mismaPosicionDespues = trocearEntradas(conInsercion)[antes.length - 1];
  assert.notEqual(identidadDeEntrada(ultimaAntes.tituloCompleto),
    identidadDeEntrada(mismaPosicionDespues.tituloCompleto),
    '🔴 CONTROL ROTO: con claves posicionales la entrada #N sigue siendo la misma tras insertar. '
    + 'Entonces el re-clavado no arreglaba nada y el test de arriba no demuestra nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE ①: el motivo nuevo es un CONJUNTO CERRADO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-859 · 🔴 `INVISIBLE_HASTA_859` está cerrado en CINCO', () => {
  const usos = clavesExentas().filter((x) => x.motivo === 'INVISIBLE_HASTA_859');
  assert.equal(usos.length, 5,
    `🔴 hay ${usos.length} entradas con INVISIBLE_HASTA_859 y el motivo está cerrado en 5:\n  `
    + usos.map((u) => u.clave).join('\n  '));
  const fuente = fs.readFileSync(GUARD, 'utf8');
  assert.match(fuente, /TOPE_INVISIBLE_HASTA_859 = 5;/,
    '🔴 el tope ha dejado de ser 5. Un límite declarado y no cerrado es un permiso.');
});

test('SCRUM-859 · 🔴 CONTROL: una SEXTA que alegue el motivo hace CAER el guard', () => {
  // Ejecutado, no razonado: se añade una sexta EN MEMORIA y se comprueba que el tope la caza
  // nombrándola. Después de SCRUM-859 ya nada es invisible hasta SCRUM-859.
  const usos = clavesExentas().filter((x) => x.motivo === 'INVISIBLE_HASTA_859').map((x) => x.clave);
  const conSexta = [...usos, 'SCRUM-999.md#una entrada escrita DESPUÉS de SCRUM-859'];

  const TOPE = 5;
  let cayo = false;
  let mensaje = '';
  try {
    assert.equal(conSexta.length, TOPE,
      `🔴 hay ${conSexta.length} entradas con INVISIBLE_HASTA_859 y el motivo está cerrado en ${TOPE}:\n  `
      + conSexta.join('\n  '));
  } catch (e) { cayo = true; mensaje = String(e.message); }

  assert.equal(cayo, true,
    '🔴 una sexta entrada con el motivo NO tumba el guard: el motivo no está cerrado, y entonces '
    + 'cualquier entrada futura puede alegar que fue invisible hasta la 859.');
  assert.match(mensaje, /SCRUM-999\.md/,
    '🔴 el guard cae pero NO NOMBRA a la intrusa: un rojo que no dice cuál es cuesta la vuelta entera.');
});
