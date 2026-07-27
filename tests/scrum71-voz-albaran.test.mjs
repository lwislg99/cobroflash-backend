// SCRUM-71 (VOZ-ALB V1, puntos 1+2+4) — extractor de líneas de albarán por dictado.
// Sin gate: corre en `npm test`, no toca BD ni red (por eso el saneado es una función pura).
//
// ALCANCE: solo VOZ, sin OCR (decisión del fundador). Y sin UI: el punto 3 espera a que la
// matriz de dispositivos de `docs/VOZ_MATRIX.md` deje de estar en ⏳ — hoy el camino feliz del
// dictado **no se ha probado nunca con un micrófono real**, y construir la pantalla encima
// sería levantar sobre algo que nadie ha visto funcionar (incidente #13, un piso más arriba).
// Lo que hay aquí NO depende del micro: es texto → líneas, y se prueba entero sin dictar nada.
//
// EL REQUISITO CENTRAL, y por qué se prueba tanto: `Albaran.modoValoracion` es SIN_VALORAR por
// defecto — albaranes sin precios, a propósito (SCRUM-65). El extractor de PRESUPUESTO devuelve
// siempre `price`; reutilizarlo metería precios inventados en un documento que **firma el
// cliente** y que desde 'emitido' se congela. Por eso el precio no se quita pidiéndoselo al
// modelo (eso es una petición) sino EN CÓDIGO, después de la respuesta (eso es un mecanismo).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sanearLineasAlbaran, normalizarUnidad } from '../dist/modules/ai/domain/ai.service.js';
import { FLAG_DEFAULTS } from '../dist/core/flags.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_AI = path.join(AQUI, '..', 'src', 'modules', 'ai', 'app', 'routes', 'ai.routes.ts');

// ── 1. El requisito: en SIN_VALORAR no sale precio, DIGA LO QUE DIGA EL MODELO ────────────

test('SCRUM-71 · SIN_VALORAR: el precio y el IVA se caen aunque el modelo los devuelva', () => {
  const delModelo = [
    { concepto: 'Sustitución de grifo monomando', cantidad: 2, unidad: 'ud', precioUnitario: 85, tipoIva: 0.21 },
    { concepto: 'Mano de obra', cantidad: 3, unidad: 'h', price: 40, tax: 0.21 }, // por si viniera con las claves de presupuesto
  ];
  const salida = sanearLineasAlbaran(delModelo, 'SIN_VALORAR');

  for (const l of salida) {
    assert.equal(
      'precioUnitario' in l,
      false,
      '🔴 Se ha colado un PRECIO en un albarán SIN_VALORAR. Ese documento lo firma el cliente y ' +
        'desde «emitido» se congela: un precio que el profesional no puso, firmado, no se ' +
        'corrige — se anula. El modelo puede desobedecer el prompt; el saneado no.',
    );
    assert.equal('tipoIva' in l, false, '🔴 idem con el IVA');
  }
  assert.deepEqual(salida.map((l) => l.concepto), ['Sustitución de grifo monomando', 'Mano de obra']);
});

test('SCRUM-71 · VALORADO: el precio SÍ pasa, y saneado', () => {
  const salida = sanearLineasAlbaran(
    [
      { concepto: 'Termo eléctrico 80 l', cantidad: 1, unidad: 'ud', precioUnitario: 320, tipoIva: 0.21 },
      { concepto: 'Precio negativo', cantidad: 1, unidad: 'ud', precioUnitario: -5, tipoIva: 3 },
    ],
    'VALORADO',
  );
  assert.equal(salida[0].precioUnitario, 320);
  assert.equal(salida[0].tipoIva, 0.21);
  assert.equal(salida[1].precioUnitario, 0, 'un precio negativo se corta a 0');
  assert.equal(salida[1].tipoIva, 1, 'el IVA se acota a [0,1]');
});

// ── 2. `unidad`, que hoy no la produce nadie ─────────────────────────────────────────────

test('SCRUM-71 · la unidad se normaliza a la lista cerrada', () => {
  assert.equal(normalizarUnidad('horas'), 'h');
  assert.equal(normalizarUnidad('Hrs.'), 'h');
  assert.equal(normalizarUnidad('unidades'), 'ud');
  assert.equal(normalizarUnidad('Uds.'), 'ud');
  assert.equal(normalizarUnidad('metros cúbicos'), 'm3', 'con tilde y espacio');
  assert.equal(normalizarUnidad('m²'), 'm2');
  assert.equal(normalizarUnidad('kilos'), 'kg');
  assert.equal(normalizarUnidad('litros'), 'l');
});

test('SCRUM-71 · una unidad que no se reconoce cae a `ud`, no se inventa', () => {
  // `unidad` acaba impresa en un documento que se firma: texto libre del modelo ahí produce
  // "unidades", "uds.", "Ud" y "u" en el mismo albarán. Lo desconocido cae al caso mayoritario.
  assert.equal(normalizarUnidad('chorrocientos'), 'ud');
  assert.equal(normalizarUnidad(''), 'ud');
  assert.equal(normalizarUnidad(undefined), 'ud');
  assert.equal(normalizarUnidad(null), 'ud');
});

// ── 3. El dictado llega sucio: basura dentro, líneas válidas fuera ───────────────────────

// Este caso destapó una incoherencia REAL heredada del extractor de presupuesto
// (`Math.max(0.01, Number(x) || 1)`): un 0 acababa en 1 —porque 0 es falsy— pero un -4 acababa
// en **0,01**, o sea "0,01 unidades" de algo impreso en un documento que se firma. Cero y
// negativo son la misma clase de basura de dictado; ahora los dos caen a 1, que es la regla que
// ya se le pide al modelo ("si no se dice, 1").
test('SCRUM-71 · cantidades imposibles y conceptos vacíos', () => {
  const salida = sanearLineasAlbaran(
    [
      { concepto: '  ', cantidad: 1, unidad: 'ud' },           // sin concepto → fuera
      { concepto: 'Desatasco', cantidad: 0, unidad: 'ud' },     // 0 → 1
      { concepto: 'Tubería', cantidad: 'tres', unidad: 'm' },   // no numérico → 1
      { concepto: 'Fuga', cantidad: -4, unidad: 'ud' },         // negativo → 1, no 0,01
      { concepto: 'Pintura', cantidad: 2.5, unidad: 'm2' },     // fraccionario legítimo: intacto
    ],
    'SIN_VALORAR',
  );
  assert.deepEqual(
    salida.map((l) => l.concepto),
    ['Desatasco', 'Tubería', 'Fuga', 'Pintura'],
    'la línea sin concepto se cae',
  );
  assert.equal(salida[0].cantidad, 1, '0 dictado no es "cero de algo": es que no se dijo');
  assert.equal(salida[1].cantidad, 1, '"tres" no es un número: la IA debía convertirlo, y si no, 1');
  assert.equal(
    salida[2].cantidad,
    1,
    '🔴 una cantidad negativa NO puede acabar como 0,01 unidades en un albarán que se firma',
  );
  assert.equal(salida[3].cantidad, 2.5, 'las unidades de obra se sirven fraccionadas: no se toca');
});

test('SCRUM-71 · si la respuesta no es un array, se falla claro', () => {
  assert.throws(() => sanearLineasAlbaran({ concepto: 'x' }, 'SIN_VALORAR'), /ai_invalid_format/);
  assert.throws(() => sanearLineasAlbaran(null, 'SIN_VALORAR'), /ai_invalid_format/);
});

// ── 4. El flag es PROPIO y nace apagado ──────────────────────────────────────────────────

test('SCRUM-71 · VOICE_ALBARAN_ENABLED existe, es propio y arranca OFF', () => {
  assert.equal(
    FLAG_DEFAULTS.VOICE_ALBARAN_ENABLED,
    false,
    '🔴 un flag de voz que nace encendido suelta la función antes de que nadie la haya probado',
  );
  assert.ok(
    'VOICE_QUOTE_ENABLED' in FLAG_DEFAULTS,
    'el del presupuesto sigue existiendo: son dos, a propósito',
  );
});

// ── 5. El gate vive en el endpoint, no solo en la UI ─────────────────────────────────────

test('SCRUM-71 · el endpoint está cerrado por flag y lee el modo de la BD', () => {
  const fuente = fs.readFileSync(RUTA_AI, 'utf8');
  const bloque = fuente.slice(fuente.indexOf("router.post('/suggest-albaran-lines'"));

  assert.ok(
    bloque.includes("isFlagEnabled('VOICE_ALBARAN_ENABLED'"),
    '🔴 el endpoint no comprueba el flag. Si el flag solo escondiera el botón, apagarlo no ' +
      'apagaría la función: quedaría abierta para quien conozca la ruta. Un flag que no cierra ' +
      'el mecanismo es una prohibición sin mecanismo.',
  );
  assert.ok(
    !/modoValoracion.*req\.body|req\.body.*modoValoracion/.test(bloque),
    '🔴 `modoValoracion` NO puede venir del cuerpo de la petición: mandando "VALORADO" se ' +
      'saltaría entera la regla de que un albarán SIN_VALORAR no lleva precios.',
  );
  assert.ok(
    /findFirst\(\{[\s\S]{0,120}merchantId: req\.merchantId/.test(bloque),
    '🔴 el albarán se busca sin filtrar por merchantId (regla 2, multi-tenant)',
  );
  assert.ok(
    bloque.includes("estado !== 'borrador'"),
    '🔴 falta el candado de borrador: sugerir líneas para un albarán emitido es ofrecer algo ' +
      'que no se puede aplicar (SCRUM-65 congela las líneas desde «emitido»)',
  );
});

// ── 6. Lo que NO se construye todavía, y por qué queda escrito ───────────────────────────

test('SCRUM-71 · el punto 3 (UI) NO está: la matriz de dispositivos sigue pendiente', () => {
  const matriz = fs.readFileSync(path.join(AQUI, '..', 'docs', 'VOZ_MATRIX.md'), 'utf8');
  const pendiente = /⏳\s*(HUMANO|pendiente)/.test(matriz);
  if (pendiente) {
    // Es un recordatorio ejecutable, no un fallo: mientras la matriz siga en ⏳, el camino
    // feliz del dictado no lo ha visto nadie y la UI del albarán no debe construirse encima.
    assert.ok(true);
  } else {
    assert.fail(
      'La matriz de VOZ_MATRIX.md ya no tiene pendientes: toca construir el punto 3 (UI) — y va ' +
        'como HOJA INFERIOR con el patrón de AB3 (SCRUM-31 F2), NO como modal. Un modal de ' +
        'escritorio con checkboxes pequeños no vale para una mano a pleno sol en obra. ' +
        'Borra este test al hacerlo.',
    );
  }
});
