// tests/scrum564-afirmaciones-publicadas.test.mjs — SCRUM-564
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 DE LOS 148 NODOS DEL COPY PUBLICADO, 28 PUEDEN SER FALSOS. LOS OTROS 120 SÓLO PUEDEN SER FEOS
//
// El criterio es del fundador y es el bueno. Este fichero fija los 28 —ni uno menos, que sería
// mirar a medias, ni uno más sin declararlo— y el veredicto de cada uno, DERIVADO del mecanismo
// que ya existe: `anclaViva()` (SCRUM-551, el símbolo existe) y `alcanzabilidad()` (SCRUM-558, un
// merchant nuevo llega a él). No hay un tercer mecanismo.
//
// ⚠️ Este guard NO está enganchado a `pretest`, por el mismo motivo que el del bloque F: hoy da
// ROJO por diez afirmaciones publicadas, y ese rojo es CORRECTO. Engancharlo bloquearía el CI de
// todo el mundo por un copy que lleva meses vivo y cuya corrección es del fundador. Lo que impide
// que se olvide es que el rojo está MEDIDO, escrito en la entrega, y con trinquete aquí.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as censoF from '../scripts/censo-anclas-bloque-f.mjs';
import {
  SECCIONES_PUBLICADAS, ANCLAS_564, DESCARTADAS, SIN_ANCLA, ANCLA_EN_EL_MARCADO,
  CON_ANCLA, ANCLA_A_DECLARAR, FALSA, DESCARTADA, SIN_DECLARAR,
  censar, unidadesDe, afirmacionesDe, veredictos, leerLanding,
} from '../scripts/_afirmaciones-publicadas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = leerLanding(RAIZ);

/** Lo medido el 20-ago-2026. El trinquete, en las dos direcciones. */
const AFIRMACIONES = 28;
const GRUPOS_HOY = { [CON_ANCLA]: 15, [FALSA]: 10, [ANCLA_A_DECLARAR]: 1, [DESCARTADA]: 2 };

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · contar 28 y medir 12 sería peor que no medir
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SUELO · las cinco secciones existen y ninguna sale vacía', () => {
  const c = censar(html);
  assert.deepEqual(c.ausentes, [],
    '🔴 CIEGO: no se localizan estas secciones publicadas: ' + c.ausentes.join(', ')
    + '. Su cero de afirmaciones no significaría «no afirman nada».');
  for (const id of SECCIONES_PUBLICADAS) {
    assert.ok(c.secciones[id].length > 0, `🔴 CIEGO: cero unidades de texto en #${id}`);
  }
});

test('SUELO · el censo llega a las 28 afirmaciones, ni menos ni más', () => {
  const c = censar(html);
  assert.equal(c.afirman.length, AFIRMACIONES,
    `🔴 el censo encuentra ${c.afirman.length} afirmaciones y se midieron ${AFIRMACIONES}.\n`
    + `      diferencia: ${c.afirman.length - AFIRMACIONES}.\n`
    + '      → si son MENOS, el extractor ha dejado de ver algo y el resto de este fichero mide a '
    + 'medias. Si son MÁS, hay una afirmación nueva en copy publicado y NADIE la ha mirado: '
    + 'decláralas en `ANCLAS_564` o descártala en `DESCARTADAS`, con su motivo.');
});

test('SUELO · el extractor alcanza donde el esquema del bloque F es ciego', () => {
  // La razón de no reutilizar `h1|h2|h3|p|li`: `#faq` guarda sus preguntas en `<details>` y sus
  // respuestas en `<div>`. Si este extractor volviera a mirar sólo cinco etiquetas, las cinco
  // afirmaciones de `#faq` y las nueve de `#probar` desaparecerían y el fichero saldría verde.
  const faq = unidadesDe(html, 'faq');
  assert.ok(faq.length > 0, '🔴 CIEGO: cero unidades en #faq');
  const etiquetas = new Set(faq.map((u) => u.etiqueta));
  assert.ok(!etiquetas.has('p') || etiquetas.size > 1,
    '🔴 CIEGO: en #faq sólo se ven `p`; el extractor ha vuelto al esquema de cinco etiquetas');
  const afirmanEnFaq = faq.filter((u) => afirmacionesDe(u.texto).length);
  assert.ok(afirmanEnFaq.length > 0,
    '🔴 CIEGO: cero afirmaciones en #faq. Se midieron cinco, y ninguna vive en `h1|h2|h3|p|li`.');
  const conEsquemaViejo = afirmanEnFaq.filter((u) => ['h1', 'h2', 'h3', 'p', 'li'].includes(u.etiqueta));
  assert.equal(conEsquemaViejo.length, 0,
    '🔴 si ahora las afirmaciones de #faq caben en el esquema viejo, el marcado ha cambiado y hay '
    + 'que volver a mirar por qué se amplió el extractor');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO · si el mecanismo deja de reconocer lo que ya reconocía, se ha roto
// ═════════════════════════════════════════════════════════════════════════════════════════
test('CONTROL POSITIVO · una afirmación del bloque F con ancla viva sigue saliendo con ancla', () => {
  const conAncla = Object.entries(censoF.ANCLAS_F)
    .filter(([, r]) => Array.isArray(r.anclas) && r.anclas.length > 0);
  assert.ok(conAncla.length > 0, '🔴 CIEGO: el registro del bloque F no tiene ninguna entrada anclada');
  for (const [id, reg] of conAncla) {
    for (const a of reg.anclas) {
      assert.equal(censoF.anclaViva(a, RAIZ).viva, true,
        `🔴 ${id}: el ancla «${a}» estaba viva y ahora no. O se movió el símbolo, o el mecanismo `
        + 'que este fichero reutiliza se ha roto — y entonces sus 15 «con ancla» no valen nada.');
    }
  }
});

test('CONTROL POSITIVO · el mecanismo distingue un ancla viva de una inventada', () => {
  assert.equal(censoF.anclaViva('src/no/existe.ts::nada', RAIZ).viva, false,
    '🔴 da por viva un ancla inventada: entonces «con ancla» no significa nada');
  assert.equal(censoF.anclaViva('src/core/flags.ts::estoNoEstaAhi', RAIZ).viva, false,
    '🔴 le basta con que exista el fichero: no está comprobando el símbolo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES GRUPOS · derivados, no declarados
// ═════════════════════════════════════════════════════════════════════════════════════════
test('cada una de las 28 tiene veredicto, y ninguna se queda sin declarar', () => {
  const r = veredictos(html, RAIZ, censoF);
  assert.equal(r.total, AFIRMACIONES, '🔴 el total de afirmaciones no es el medido');
  const sinDeclarar = r.veredictos.filter((v) => v.grupo === SIN_DECLARAR);
  assert.deepEqual(sinDeclarar.map((v) => v.id), [],
    '🔴 hay afirmaciones publicadas sin declarar en `ANCLAS_564`. Una afirmación sin declarar y '
    + 'una verdadera se leen igual: ' + JSON.stringify(sinDeclarar.map((v) => [v.id, v.texto])));
});

test('el reparto en grupos es el medido — y el tercero es el que va delante del fundador', () => {
  const r = veredictos(html, RAIZ, censoF);
  const cuenta = {};
  for (const v of r.veredictos) cuenta[v.grupo] = (cuenta[v.grupo] || 0) + 1;
  assert.deepEqual(cuenta, GRUPOS_HOY,
    '🔴 el reparto cambió. Si han BAJADO las falsas, di qué se arregló y actualiza el trinquete; '
    + 'si han SUBIDO, hay copy publicado nuevo que promete algo que el producto no da.\n'
    + '      hoy: ' + JSON.stringify(cuenta));
});

test('🔴 las diez FALSAS lo son por la misma puerta, y se nombra cuál', () => {
  const r = veredictos(html, RAIZ, censoF);
  const falsas = r.veredictos.filter((v) => v.grupo === FALSA);
  assert.equal(falsas.length, 10, '🔴 ya no son diez');
  for (const v of falsas) {
    // El motivo puede venir de dos sitios, y desde SCRUM-568 casi siempre del segundo:
    //   · `promete` — lo escribió una persona al declarar la entrada `SIN_ANCLA`;
    //   · `problemas` — lo DERIVA `alcanzabilidad()` (SCRUM-558) del valor de hoy del flag.
    // Se exige lo mismo que antes o más: que el rojo diga por qué. Y cuando viene derivado, se
    // exige además que NOMBRE EL FLAG — un rojo que no dice qué puerta está cerrada se archiva.
    const derivado = Array.isArray(v.problemas) && v.problemas.length > 0;
    assert.ok((v.promete && v.promete.length > 20) || derivado,
      `🔴 ${v.id} sale como falsa y no dice QUÉ promete que no existe. Un rojo sin motivo se archiva.`);
    if (derivado) {
      assert.match(v.problemas.join(' '), /PAYMENTS_CONNECT_ENABLED|BIZUM_MANUAL_ENABLED/,
        `🔴 ${v.id}: el veredicto es derivado y no nombra la puerta que lo hace falso`);
    }
  }
  // Las dos puertas están APAGADAS por defecto, que es lo que hace falsas a las diez.
  const tablaP = censoF.defaultsDeLaTablaP(RAIZ);
  assert.equal(tablaP.ok, true, `🔴 CIEGO: no se ha podido leer la tabla P — ${tablaP.motivo}`);
  assert.equal(tablaP.tabla.PAYMENTS_CONNECT_ENABLED, false,
    '🔴 `PAYMENTS_CONNECT_ENABLED` ya no está apagada por defecto: vuelve a mirar las diez, '
    + 'porque puede que varias hayan dejado de ser falsas.');
  assert.equal(tablaP.tabla.BIZUM_MANUAL_ENABLED, false,
    '🔴 `BIZUM_MANUAL_ENABLED` ya no está apagada por defecto: vuelve a mirar las diez.');
});

test('la cifra acoplada de #todo sigue cuadrando', () => {
  const r = veredictos(html, RAIZ, censoF);
  const v = r.veredictos.find((x) => x.id === 'todo/h2#1');
  assert.ok(v, '🔴 CIEGO: no se encuentra «Seis herramientas. Una sola app.»');
  assert.equal(v.grupo, ANCLA_A_DECLARAR,
    `🔴 «${v.texto}» ya no cuadra con el marcado: ${v.recuento}`);
  assert.equal(v.recuento, 'dice 6, hay 6 .prod');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TEXTO LITERAL · citar mal es peor que no citar
// ═════════════════════════════════════════════════════════════════════════════════════════
test('cada texto declarado es el del marcado, byte a byte', () => {
  const c = censar(html);
  const porId = new Map(c.todas.map((u) => [u.id, u.texto]));
  for (const [id, reg] of Object.entries(ANCLAS_564)) {
    const ahora = porId.get(id);
    assert.ok(ahora !== undefined, `🔴 ${id}: declarado y no existe en el marcado`);
    assert.equal(ahora, reg.texto, `🔴 ${id}: el texto declarado no es el del marcado`);
    assert.equal(Buffer.compare(Buffer.from(ahora, 'utf8'), Buffer.from(reg.texto, 'utf8')), 0,
      `🔴 ${id}: coincide como cadena y no byte a byte`);
  }
  for (const [id, d] of Object.entries(DESCARTADAS)) {
    assert.equal(porId.get(id), d.texto, `🔴 ${id}: el texto descartado no es el del marcado`);
    assert.equal(Buffer.compare(Buffer.from(porId.get(id), 'utf8'), Buffer.from(d.texto, 'utf8')), 0,
      `🔴 ${id}: coincide como cadena y no byte a byte`);
    assert.ok(d.motivo && d.motivo.length > 40, `🔴 ${id}: descartada sin motivo escrito`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// AUTOPRUEBA · el mecanismo tiene que ver una afirmación nueva
// ═════════════════════════════════════════════════════════════════════════════════════════
test('AUTOPRUEBA · una afirmación nueva en copy publicado sale SIN DECLARAR', () => {
  const ANCLA = '<span class="eyebrow">Todo en uno</span>';
  const INTRUSO = '<span>Cobra con tarjeta desde hoy</span>';
  assert.ok(html.includes(ANCLA), '🔴 CIEGO: no se encuentra el punto de inyección');
  const r = veredictos(html.replace(ANCLA, ANCLA + INTRUSO), RAIZ, censoF);
  assert.equal(r.total, AFIRMACIONES + 1, '🔴 el censo no ve la afirmación nueva');
  const nueva = r.veredictos.find((v) => v.texto === 'Cobra con tarjeta desde hoy');
  assert.ok(nueva, '🔴 la ve pero no la nombra');
  assert.equal(nueva.grupo, SIN_DECLARAR,
    '🔴 una afirmación que nadie ha declarado sale como si estuviera revisada');
  assert.equal(nueva.seccion, 'todo', '🔴 no dice en qué sección está');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE QUEDA FUERA · declarado, no callado
// ═════════════════════════════════════════════════════════════════════════════════════════
test('los que NO afirman quedan contados y declarados fuera de alcance', () => {
  const c = censar(html);
  const noAfirman = c.todas.length - c.afirman.length;
  assert.ok(noAfirman > 0, '🔴 CIEGO: todas las unidades afirman algo, lo que no puede ser');
  // No se revisan, y por eso se cuentan: «no revisado» y «no existe» no pueden leerse igual.
  assert.equal(noAfirman, c.todas.length - AFIRMACIONES,
    '🔴 la cuenta de lo que queda fuera de alcance no cuadra con el total');
  const cabecera = fs.readFileSync(path.join(RAIZ, 'scripts/_afirmaciones-publicadas.mjs'), 'utf8');
  assert.ok(/fuera de alcance/i.test(cabecera),
    '🔴 el módulo no declara por escrito que esos textos quedan fuera de alcance');
});
