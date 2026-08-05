// tests/scrum300-microcopy-firmante.test.mjs — SCRUM-300 · guard de microcopy (regla 30)
//
// Las cinco opciones de «en calidad de qué» acaban en un documento que se puede leer en un
// juzgado. Las aprobó el fundador el 5-ago-2026 «tal cual, ni una palabra distinta», y este
// fichero las fija CARÁCTER A CARÁCTER. Molde: `scrum344-cierre-con-saldo.test.mjs`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL RAZONAMIENTO DE LAS CINCO, para que nadie las «mejore» sin saber lo que quita
//
// Se evitan «representante», «autorizado» y «apoderado» porque son AFIRMACIONES JURÍDICAS que
// el profesional NO PUEDE SOSTENER, y meterlas en un documento que él firma lo pone a él en el
// aprieto. «Personal de la obra» describe DÓNDE ESTABA quien firmó, no de quién depende — y eso
// es deliberado: quién es concretamente lo captura el campo NOMBRE, que es un dato y no una
// calificación. Por eso el guard persigue justo esas tres palabras: son el modo plausible de
// equivocarse aquí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// Y POR QUÉ ESTE GUARD VIGILA ADEMÁS QUE NO HAYA UNA SEGUNDA COPIA
//
// Fijar el texto en un sitio no sirve si otro fichero lo reescribe por su cuenta. El dashboard
// es vanilla y no puede importar el módulo de dominio, así que la tentación evidente era copiar
// las cinco cadenas en `signaturePad.js`. Se resolvió SIRVIÉNDOLAS por `/admin/me` (mismo
// criterio de SCRUM-289), y aquí se comprueba que sigue siendo así: divergencia IMPOSIBLE gana
// a divergencia VIGILADA. Es la misma lección que las dos cabeceras de gastos.csv y las tres
// copias del porqué de `borradoMerchant`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALBARAN_ROTULOS,
  ALBARAN_ROTULOS_APROBADOS,
  FIRMANTE_CALIDAD_RANURAS,
  FIRMANTE_CALIDAD_TEXTOS,
  firmanteCalidadOpciones,
  resolverCalidadFirmante,
} from '../dist/modules/jobs/domain/albaranFirmante.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// ── LA MICROCOPY APROBADA, CARÁCTER A CARÁCTER ───────────────────────────────────────────
//
// Aprobada por el fundador el 5-ago-2026. La quinta se aprobó como «Otro + texto libre»:
// «Otro» es el RÓTULO y «+ texto libre» describe el campo que lo acompaña.
const APROBADA = {
  cliente: 'El propio cliente',
  convive: 'Un familiar o alguien que vive en el domicilio',
  obra: 'Personal de la obra',
  porteria: 'Portero o conserje del edificio',
  otro: 'Otro',
};

/** Palabras que serían una «mejora» jurídicamente peligrosa (el modo plausible de fallar aquí). */
const RE_PROHIBIDA = /representante|autorizad|apoderad/i;

function ranurasQueNoCoinciden(textos, ranuras) {
  return ranuras
    .filter((r) => textos[r] !== APROBADA[r])
    .map((r) => `${r}\n       es: «${textos[r]}»\n    debía: «${APROBADA[r]}»`);
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-300 · SUELO: el módulo declara las cinco ranuras (sin esto se compararía vacío)', () => {
  assert.equal(FIRMANTE_CALIDAD_RANURAS.length, 5,
    `🔴 ESCÁNER CIEGO: el módulo declara ${FIRMANTE_CALIDAD_RANURAS.length} ranuras y esperaba 5. ` +
    'Comparar cero contra cero pasa en verde y no significa «todo correcto», sino «no se miró».');
  assert.deepEqual([...FIRMANTE_CALIDAD_RANURAS].sort(), Object.keys(APROBADA).sort(),
    '🔴 el juego de ranuras no es el aprobado: sobra o falta alguna. Las que no están aquí no las ' +
    'ha aprobado nadie.');
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-300 · las cinco ranuras dicen EXACTAMENTE el texto aprobado (regla 30)', () => {
  assert.deepEqual(
    ranurasQueNoCoinciden(FIRMANTE_CALIDAD_TEXTOS, FIRMANTE_CALIDAD_RANURAS), [],
    '🔴 la microcopy de «en calidad de qué» ha cambiado respecto a la APROBADA por el fundador el ' +
    '5-ago-2026 («tal cual, ni una palabra distinta»). Estos textos acaban en un documento que se ' +
    'puede leer en un juzgado. Si el cambio es deliberado, actualiza `APROBADA` en el MISMO commit ' +
    'y que se vea en el diff.');
});

test('SCRUM-300 · ninguna ranura usa una calificación jurídica que el profesional no puede sostener', () => {
  const malas = FIRMANTE_CALIDAD_RANURAS
    .filter((r) => RE_PROHIBIDA.test(FIRMANTE_CALIDAD_TEXTOS[r]))
    .map((r) => `${r}: «${FIRMANTE_CALIDAD_TEXTOS[r]}»`);
  assert.deepEqual(malas, [],
    '🔴 hay una ranura que afirma una relación jurídica («representante», «autorizado», ' +
    '«apoderado»). El profesional NO puede sostener esa afirmación, y va en un documento que ' +
    'firma él: le traslada a él el problema. Quién es concretamente lo captura el campo NOMBRE.');
});

// Los rótulos APROBADOS, carácter a carácter. El de la fecha lo aprobó el fundador; los otros
// tres, el asesor el 5-ago-2026 («describen lo que el campo es, y el tercero viene literal del
// enunciado del ticket, así que no es redacción nueva»).
const ROTULOS_APROBADOS = {
  fechaEntrega: 'Fecha de entrega',
  lugarEntrega: 'Lugar de entrega',
  firmadoPorNombre: 'Nombre de quien firma',
  firmadoPorCalidad: 'En calidad de qué',
};

// Los del PDF, PENDIENTES de firma. Se fijan igual —para que no deriven mientras esperan— pero
// se declaran aparte para que el diff diga en qué momento dejan de estar pendientes.
const ROTULOS_PDF_PENDIENTES = {
  pdfFirmadoPor: 'Firmado por: ',
  pdfEnCalidadDe: 'En calidad de: ',
};

test('SCRUM-300 · los rótulos APROBADOS dicen exactamente su texto, y el censo los declara', () => {
  for (const [clave, texto] of Object.entries(ROTULOS_APROBADOS)) {
    assert.equal(ALBARAN_ROTULOS[clave], texto,
      `🔴 el rótulo «${clave}» cambió respecto al APROBADO. Si el cambio es deliberado, que venga ` +
      'con su aprobación y actualiza este fichero en el mismo commit.');
  }
  assert.deepEqual([...ALBARAN_ROTULOS_APROBADOS].sort(), Object.keys(ROTULOS_APROBADOS).sort(),
    '🔴 el censo de rótulos APROBADOS ha cambiado. Si han llegado aprobaciones nuevas, añádelas ' +
    'aquí en el mismo commit; si no, ninguno más está aprobado. Que el guard falle por una ' +
    'aprobación NUEVA es deliberado: obliga a que quede en el diff quién aprobó qué y cuándo.');
});

test('SCRUM-300 · los dos rótulos del PDF siguen PENDIENTES, y su espacio final está intacto', () => {
  for (const [clave, texto] of Object.entries(ROTULOS_PDF_PENDIENTES)) {
    assert.equal(ALBARAN_ROTULOS[clave], texto,
      `🔴 el rótulo «${clave}» del PDF cambió mientras esperaba aprobación.`);
    assert.ok(texto.endsWith(': '),
      `🔴 «${clave}» ha perdido su espacio final. Es PARTE DEL LITERAL: el PDF lo pinta con ` +
      '`continued: true`, así que sin él el dato se pega a los dos puntos («Firmado por:Marta»).');
    assert.equal(ALBARAN_ROTULOS_APROBADOS.includes(clave), false,
      `🔴 «${clave}» aparece como aprobado y el asesor aún no lo ha firmado. Pidió verlos ` +
      'LITERALES antes: en un PDF que puede acabar en un juzgado no se aprueba un rótulo por su ' +
      'descripción.');
  }
});

// ── NI UNA SEGUNDA COPIA: divergencia IMPOSIBLE, no vigilada ─────────────────────────────

/**
 * Los LITERALES DE CADENA de un fuente JS/TS, saltándose los comentarios.
 *
 * ⚠️ Dos defectos MEDIDOS de la versión ingenua (`src.includes(texto)`), y los dos daban ROJO
 * sobre código correcto:
 *
 *   ① **Se cazaba a sí mismo en el comentario** que explica la prohibición — el tropiezo clásico
 *      de los guards de texto en este repo (ha mordido en SCRUM-176/168/3/193/254). El comentario
 *      de la ruta pública dice «la calidad con «El propio cliente»» para explicar la precarga, y
 *      eso NO es una copia: no lo lee ningún usuario.
 *   ② **`'Otro'` mide cuatro caracteres** y casa dentro de «Otros gastos», «Otro concepto»… Una
 *      subcadena no distingue una copia de una coincidencia.
 *
 * Mirar literales resuelve los dos, y además es lo correcto semánticamente: una COPIA de la
 * microcopy es un literal IGUAL a ella, no un fichero que la contenga en algún sitio.
 */
function literalesDe(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      let buf = '';
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') { buf += src[i + 1]; i += 2; continue; }
        buf += src[i];
        i++;
      }
      i++;
      out.push(buf);
      continue;
    }
    i++;
  }
  return out;
}

/** Los ficheros que PINTAN el desplegable, y un literal suyo que el escáner debe encontrar. */
const SUPERFICIES = [
  ['public/dashboard/js/signaturePad.js', 'Confirmar firma'],
  ['public/dashboard/js/jobDetailView.js', 'Guardar cambios'],
  ['public/dashboard/js/app.js', '/admin/me'],
  ['src/modules/jobs/app/routes/albaranPublic.routes.ts', 'firma_invalida'],
];

test('SCRUM-300 · SUELO: el escáner de literales lee de verdad cada superficie', () => {
  for (const [rel, ancla] of SUPERFICIES) {
    const lits = literalesDe(leer(rel));
    assert.ok(lits.length > 5, `🔴 ESCÁNER CIEGO: ${rel} ha dado ${lits.length} literales`);
    assert.ok(lits.some((l) => l.includes(ancla)),
      `🔴 ESCÁNER CIEGO en ${rel}: no encuentro el literal conocido «${ancla}». Sin esto, «no hay ` +
      'copias» y «no sé leer el fichero» son la misma respuesta.');
  }
});

test('SCRUM-300 · ninguna superficie reescribe las cinco: las recibe servidas', () => {
  const aprobadas = new Set(FIRMANTE_CALIDAD_RANURAS.map((r) => APROBADA[r]));
  for (const [rel] of SUPERFICIES) {
    const copias = literalesDe(leer(rel)).filter((l) => aprobadas.has(l.trim()));
    assert.deepEqual(copias, [],
      `🔴 ${rel} escribe la microcopy ${copias.map((c) => `«${c}»`).join(', ')} por su cuenta. Eso es ` +
      'una SEGUNDA COPIA de un texto que acaba en un juzgado, y dos copias divergen en silencio ' +
      '(pasó con las dos cabeceras de gastos.csv y con las tres del porqué de borradoMerchant). ' +
      'Las cinco viajan servidas en `/admin/me` desde `albaranFirmante.ts` — píntalas de ahí.');
  }
});

test('SCRUM-300 · y las superficies siguen pintándolas DESDE la fuente única', () => {
  assert.match(leer('src/modules/jobs/app/routes/albaranPublic.routes.ts'), /firmanteCalidadOpciones/,
    '🔴 la página pública ya no pinta las opciones desde la fuente única — ¿de dónde las saca?');
  assert.match(leer('src/app.ts'), /albaranFirmanteOpciones/,
    '🔴 `/admin/me` ha dejado de servir las opciones: el dashboard se quedaría sin desplegable ' +
    'y la tentación de teclearlas vuelve.');
  assert.match(leer('public/dashboard/js/signaturePad.js'), /appAlbaranFirmanteOpciones/,
    '🔴 el modal de firma ya no lee las opciones servidas');
});

test('SCRUM-300 · INYECCIÓN: una copia de verdad en una vista SÍ se caza', () => {
  const aprobadas = new Set(FIRMANTE_CALIDAD_RANURAS.map((r) => APROBADA[r]));
  const conCopia = "const opciones = ['El propio cliente', 'Personal de la obra'];";
  const cazadas = literalesDe(conCopia).filter((l) => aprobadas.has(l.trim()));
  assert.deepEqual(cazadas, ['El propio cliente', 'Personal de la obra'],
    '🔴 el guard NO ve una copia literal de la microcopy en una vista: sería ciego justo al error ' +
    'que existe (el dashboard es vanilla y no puede importar el módulo — copiar es la tentación).');
});

test('SCRUM-300 · CONTROL NEGATIVO: ni el comentario ni una palabra que empiece igual son copias', () => {
  const aprobadas = new Set(FIRMANTE_CALIDAD_RANURAS.map((r) => APROBADA[r]));
  // ① Un comentario que NOMBRA la microcopy para explicarla no es una copia (defecto ① medido).
  const soloComentario = '// la calidad se precarga con «El propio cliente» porque es lo normal\nconst x = 1;';
  assert.deepEqual(literalesDe(soloComentario).filter((l) => aprobadas.has(l.trim())), [],
    '🔴 el guard se caza a sí mismo en el comentario que explica la prohibición.');
  // ② «Otro» dentro de otra palabra tampoco (defecto ② medido).
  const otrosGastos = "const t = 'Otros gastos'; const u = 'Otro concepto';";
  assert.deepEqual(literalesDe(otrosGastos).filter((l) => aprobadas.has(l.trim())), [],
    '🔴 el guard confunde «Otros gastos» con la ranura «Otro»: una subcadena no es una copia.');
});

// ── AUTOPRUEBAS: que el guard sepa fallar ────────────────────────────────────────────────

test('SCRUM-300 · INYECCIÓN: cambiar UN carácter de una ranura la señala a ella', () => {
  const uno = FIRMANTE_CALIDAD_TEXTOS.obra.replace('obra', 'Obra');
  assert.notEqual(uno, FIRMANTE_CALIDAD_TEXTOS.obra, '🔴 la inyección no encontró dónde cambiar');
  const malas = ranurasQueNoCoinciden({ ...FIRMANTE_CALIDAD_TEXTOS, obra: uno }, FIRMANTE_CALIDAD_RANURAS);
  assert.equal(malas.length, 1, `🔴 debía señalar UNA ranura y señaló ${malas.length}`);
  assert.ok(malas[0].startsWith('obra'), `🔴 señala la ranura equivocada: ${malas[0]}`);
});

test('SCRUM-300 · INYECCIÓN: una «mejora» con calificación jurídica se caza', () => {
  const inyectado = { ...FIRMANTE_CALIDAD_TEXTOS, obra: 'Encargado o representante de la obra' };
  const malas = FIRMANTE_CALIDAD_RANURAS.filter((r) => RE_PROHIBIDA.test(inyectado[r]));
  assert.deepEqual(malas, ['obra'],
    '🔴 el guard NO distingue una calificación jurídica colada: sería ciego justo al error que existe.');
});

test('SCRUM-300 · CONTROL NEGATIVO: un cambio ajeno a las ranuras no tumba el guard', () => {
  const ajeno = { ...FIRMANTE_CALIDAD_TEXTOS };
  assert.deepEqual(ranurasQueNoCoinciden(ajeno, FIRMANTE_CALIDAD_RANURAS), [],
    'un juego intacto debe quedar en verde');
  // Y tocar OTRO rótulo (no una ranura) tampoco debe afectar a este veredicto.
  assert.deepEqual(ranurasQueNoCoinciden({ ...ajeno, noEsUnaRanura: 'lo que sea' }, FIRMANTE_CALIDAD_RANURAS), [],
    '🔴 el guard reacciona a claves que no son ranuras: vigila más de lo que dice vigilar');
});

// ── LA RESOLUCIÓN: lo que se GUARDA es lo que el documento DICE ───────────────────────────

test('SCRUM-300 · resolverCalidadFirmante guarda el TEXTO impreso, no la clave de la ranura', () => {
  assert.deepEqual(resolverCalidadFirmante({ ranura: 'obra' }), { ok: true, texto: 'Personal de la obra' });
  assert.deepEqual(resolverCalidadFirmante({ ranura: 'cliente' }), { ok: true, texto: 'El propio cliente' });
  // Ausente = null sin error: los tres campos son opcionales, y así son TODOS los ya firmados.
  assert.deepEqual(resolverCalidadFirmante({}), { ok: true, texto: null });
  assert.deepEqual(resolverCalidadFirmante({ ranura: '' }), { ok: true, texto: null });
});

test('SCRUM-300 · la ranura «otro» exige su texto, y una ranura inventada se rechaza', () => {
  assert.deepEqual(resolverCalidadFirmante({ ranura: 'otro', textoLibre: 'Vecino del 3º' }),
    { ok: true, texto: 'Vecino del 3º' });

  const vacio = resolverCalidadFirmante({ ranura: 'otro', textoLibre: '   ' });
  assert.equal(vacio.ok, false, '🔴 «Otro» sin texto se está guardando: el documento diría «Otro» y nada más');
  assert.equal(vacio.error, 'calidad_firmante_otro_vacio');

  const inventada = resolverCalidadFirmante({ ranura: 'apoderado' });
  assert.equal(inventada.ok, false, '🔴 una ranura que nadie aprobó entra al documento por la API');
  assert.equal(inventada.error, 'calidad_firmante_invalida');
});

test('SCRUM-300 · lo que se sirve al navegador son las cinco, con la libre marcada', () => {
  const ops = firmanteCalidadOpciones();
  assert.equal(ops.length, 5, '🔴 no se sirven las cinco opciones');
  assert.deepEqual(ops.map((o) => o.texto), FIRMANTE_CALIDAD_RANURAS.map((r) => APROBADA[r]),
    '🔴 lo servido al navegador no es, palabra por palabra, lo aprobado');
  assert.deepEqual(ops.filter((o) => o.libre).map((o) => o.ranura), ['otro'],
    '🔴 la ranura con texto libre debe ser exactamente «otro»');
});
