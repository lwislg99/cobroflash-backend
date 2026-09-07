// tests/scrum820-estados-en-castellano.test.mjs — SCRUM-820
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: el fontanero que abre Presupuestos y lee DRAFT, SENT, ACCEPTED y REJECTED.
//
// Doce de doce filas en inglés, y la app contradiciéndose a sí misma: el MISMO presupuesto salía
// «Aceptado» en Inicio y ACCEPTED en la lista. Medido con las dos pantallas pintadas y el mismo
// dato: **discrepaban los SEIS estados**, no cuatro.
//
// ── EL DEFECTO DE FONDO NO ERA LA TRADUCCIÓN QUE FALTABA ─────────────────────────────────────
// `buildStatusPill` traducía DOS estados y dejaba caer los otros cuatro a `st.toUpperCase()`.
// Pero el diccionario español YA EXISTÍA CUATRO VECES en el mismo directorio —`customerDetailView`,
// `globalSearch`, `homeView` y el medio-mapa de `quotesListView`— y cada copia traducía un
// subconjunto distinto. La contradicción no era un olvido: **era que nadie leía del mismo sitio.**
//
// Así que esto no vigila «que haya traducción»: vigila que haya UNA SOLA, y que las pantallas
// lean de ella. Un guard que sólo comprobara los seis rótulos pasaría en verde el día que alguien
// escriba la quinta copia — que es exactamente cómo llegamos aquí.
//
// ── LO QUE ESTE GUARD NO CUBRE, dicho aquí y no en una nota al pie ───────────────────────────
// Los mapas de `customerDetailView.js` y `globalSearch.js` SIGUEN VIVOS y no se tocan en este
// ticket: mezclan estados de presupuesto con estados de FACTURA (`paid`, `pending`) y separarlos
// es otro carril. Están CENSADOS abajo: mientras estén ahí, no pueden crecer ni cambiar de
// número sin que alguien lo afirme.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public', 'dashboard', 'js');

/** La pieza, EJECUTADA. Más fuerte que buscar su forma en el fuente con un regex. */
function pieza() {
  const ctx = cargarDashboard(RAIZ).ctx;
  return ctx.quoteStatusMeta || (ctx.window && ctx.window.quoteStatusMeta);
}

/** Los seis estados del presupuesto, con el rótulo que el fundador tiene firmado o en producción. */
const ESPERADO = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Caducado',
  // El literal que la PROPIA lista usa en su filtro: se filtra y se lee lo mismo.
  pending_approval: 'Pendiente de aprobación',
};

test('SCRUM-820 · SUELO: la pieza existe y se puede ejecutar', () => {
  const f = pieza();
  assert.equal(typeof f, 'function',
    '🔴 CIEGO: no encuentro `quoteStatusMeta` en el dashboard cargado. Sin la pieza, todo lo de '
    + 'abajo pasaría en verde sin haber comprobado nada.');
});

test('SCRUM-820 · los SEIS estados salen en castellano, no en inglés crudo', () => {
  const f = pieza();
  const malos = [];
  for (const [st, label] of Object.entries(ESPERADO)) {
    const meta = f(st);
    if (!meta || meta.label !== label) malos.push(`${st} → ${JSON.stringify(meta && meta.label)} (esperado «${label}»)`);
    // Y el que decide de verdad: que no salga el identificador, en ninguna forma.
    if (meta && String(meta.label).toLowerCase() === st) malos.push(`${st} → devuelve el IDENTIFICADOR`);
  }
  assert.deepEqual(malos, [],
    '🔴 un estado de presupuesto no sale con su rótulo aprobado:\n     ' + malos.join('\n     '));
});

test('SCRUM-820 · cada estado trae su clase de píldora, y son las de la casa', () => {
  const f = pieza();
  const CLASES = new Set(['status-pill-draft', 'status-pill-pending', 'status-pill-accepted',
    'status-pill-rejected', 'status-pill-approval']);
  for (const st of Object.keys(ESPERADO)) {
    const c = f(st).pillClass;
    assert.ok(CLASES.has(c),
      `🔴 «${st}» pinta la clase «${c}», que no es ninguna de las cinco de la hoja. El color es el `
      + 'segundo canal de DESIGN.md: una clase inventada no existe en el CSS y la píldora sale desnuda.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL NEGATIVO: lo desconocido no se vuelca crudo
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-820 · 🔴 un estado SIN mapear no le escupe el identificador al usuario', () => {
  const f = pieza();
  // Tres formas del mismo caso: el estado que alguien añada mañana, uno vacío y uno nulo.
  for (const st of ['pending_signature_v2', '', null, undefined]) {
    const meta = f(st);
    assert.ok(meta && typeof meta.label === 'string' && meta.label.length > 0,
      `🔴 «${st}» no devuelve rótulo: la píldora saldría vacía.`);
    assert.equal(String(meta.label).toLowerCase().includes('pending_signature_v2'), false,
      '🔴 SE PINTA EL IDENTIFICADOR INTERNO. Nunca se le vuelca a la cara del usuario un código '
      + 'de la base de datos: no le dice nada y le enseña las tripas del producto.');
    assert.equal(/^[a-z_]+$/.test(String(meta.label)), false,
      '🔴 el rótulo tiene forma de identificador (minúsculas y guiones bajos).');
  }
  // Y lo que la lección de SCRUM-153 exige: que NO se disfrace del más inocente.
  assert.notEqual(f('pending_signature_v2').label, ESPERADO.accepted,
    '🔴 un estado desconocido se está pintando como «Aceptado». Un estado que no se reconoce '
    + 'disfrazado del más favorable es peor que uno crudo: el pro toma decisiones con eso.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA COHERENCIA POR CONSTRUCCIÓN: una sola copia, y censo de las que quedan
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Ficheros del dashboard que traducen ELLOS MISMOS un estado de presupuesto.
 *
 * El barrido busca el par que define un diccionario de estados —una clave `accepted` con un
 * valor de texto en castellano— sobre el código SIN COMENTARIOS: si no, este mismo fichero y los
 * párrafos que explican el defecto contarían como copias. Es la trampa de auto-referencia que en
 * esta casa ya ha mordido cuatro veces.
 */
function copiasDelDiccionario() {
  const fuera = new Set(['api.js']); // la pieza oficial: ahí es donde TIENE que estar
  const copias = [];
  for (const f of fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'))) {
    if (fuera.has(f)) continue;
    const codigo = soloCodigo(fs.readFileSync(path.join(DIR_JS, f), 'utf8'));
    const n = [...codigo.matchAll(/accepted\s*:\s*['"](Aceptad[oa])['"]/g)].length;
    if (n) copias.push([f, n]);
  }
  return copias;
}

// Medido el 7-sep-2026 sobre `origin/main` con este mismo barrido. NO se ponen a 0: la entrada
// se BORRA cuando el fichero deja de traducir por su cuenta (criterio de SCRUM-402/424/405).
const CENSO_DE_COPIAS = Object.freeze({
  // Mezcla estados de presupuesto y de FACTURA (`paid`, `pending`) en el mismo diccionario.
  // Separarlos es otro carril y no se toca aquí (regla 9); queda vigilado para que no crezca.
  'customerDetailView.js': 1,
  // Ídem: el buscador global pinta presupuestos, facturas y trabajos con un solo mapa.
  'globalSearch.js': 1,
  // 🔴 LA QUINTA, y no la contaba nadie — la encontró ESTE barrido, no una lectura. El ticket
  // hablaba de tres mapas; con el de `api.js` eran cuatro, y con éste, cinco.
  //
  // Trae además la TERCERA forma viva de `pending_approval`: «Pendiente de aprobación», frente a
  // «PENDIENTE APROBACIÓN» (lista) y «Pend. aprob.» (ficha del cliente). Tres redacciones del
  // mismo estado, en producción, en tres pantallas. Va reportado para que el fundador firme UNA;
  // aquí no se elige por gusto ni se inventa una cuarta.
  'teamView.js': 1,
});

test('SCRUM-820 · SUELO: el barrido de copias VE las que sabemos que hay', () => {
  const copias = copiasDelDiccionario();
  assert.ok(copias.length >= 3,
    `🔴 CIEGO: el barrido encuentra ${copias.length} copias del diccionario y sabemos que hay al `
    + 'menos tres. Si sale menos, el instrumento está roto — no es que se hayan limpiado solas, y '
    + 'el cero de las demás no significaría nada.');
});

test('SCRUM-820 · 🔴 nadie estrena una copia NUEVA del diccionario de estados', () => {
  const copias = copiasDelDiccionario();
  const problemas = [];
  for (const [f, n] of copias) {
    const techo = CENSO_DE_COPIAS[f];
    if (techo === undefined) {
      problemas.push(`${f} traduce estados por su cuenta y NO estaba en el censo (${n}).\n`
        + '       Lee de `window.quoteStatusMeta` (api.js) en vez de escribir la quinta copia:\n'
        + '       es el defecto que este ticket cierra, no una variante de él.');
    } else if (n > techo) {
      problemas.push(`${f} pasa de ${techo} a ${n} copias. El censo sólo baja.`);
    }
  }
  for (const f of Object.keys(CENSO_DE_COPIAS)) {
    if (!copias.some(([g]) => g === f)) {
      problemas.push(`ENTRADA CADUCA: ${f} ya no traduce por su cuenta. BÓRRALA del censo — no la `
        + 'pongas a 0: mientras esté, ese fichero puede volver a crecer sin caer.');
    }
  }
  assert.deepEqual(problemas, [],
    '🔴 el diccionario de estados vuelve a estar repartido:\n     ' + problemas.join('\n     '));
});

test('SCRUM-820 · 🔴 las pantallas del ticket LEEN de la pieza, no traducen', () => {
  // Éste es el que ata el arreglo: si mañana alguien vuelve a escribir el ternario en la lista,
  // los tests de arriba seguirían verdes (la pieza estaría bien) y la pantalla volvería a mentir.
  for (const f of ['quotesListView.js', 'homeView.js']) {
    const codigo = soloCodigo(fs.readFileSync(path.join(DIR_JS, f), 'utf8'));
    assert.match(codigo, /quoteStatusMeta\s*\(/,
      `🔴 «${f}» ya no lee de \`quoteStatusMeta\`. Si vuelve a decidir el rótulo por su cuenta, `
      + 'vuelve la contradicción entre pantallas — que es el defecto, no la traducción que falta.');
    assert.equal(/toUpperCase\(\)\s*;?\s*\/\/\s*A16\.2/.test(codigo), false,
      `🔴 ha vuelto el volcado en mayúsculas a «${f}».`);
  }
});
