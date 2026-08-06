// SCRUM-306 (C7) · LA SERIE DE ALBARANES — reutilizando el mecanismo de A4, no escribiendo otro.
//
// Sin gate: todo lo que se prueba es puro y se importa de `dist/`. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE FICHERO PROTEGE, EN ORDEN DE IMPORTANCIA
//
//   1. Que fijar el número sin fijar el año NO reinicie la serie en 1 en silencio.
//   2. Que el detector de huecos del albarán sea EL DE A4, no una copia.
//   3. Que generalizar A4 no haya roto el caso que ya existía (facturas).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveAlbaranSeq, formatAlbaranNumber, AlbaranSerieSinAnioError,
} from '../dist/modules/jobs/domain/albaranNumber.service.js';
import { huecosDeAlbaranes, vistaPreviaAlbaran, componerNumeroAlbaran } from '../dist/modules/jobs/domain/albaranSerie.js';
import { huecosDeLaSerie } from '../dist/modules/invoicing/domain/huecosSerie.js';
import { formatInvoiceNumber } from '../dist/modules/invoicing/domain/invoiceNumber.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// ── 1 · LA TRAMPA HEREDADA ──────────────────────────────────────────────────────────────

test('SCRUM-306 · 🔴 fijar el número SIN el año no reinicia la serie en 1: falla y lo dice', () => {
  // Es el rojo que justifica la tarea entera. Con la forma heredada
  // (`albaranSeriesYear === year ? nextAlbaranNumber : 1`) esto devolvía **1** y el albarán salía
  // como `ALB-2026-001`: o revienta contra el índice único, o duplica una referencia que ya se le
  // enseñó a un cliente y que se cita en la factura recapitulativa.
  assert.throws(
    () => resolveAlbaranSeq({ albaranSeriesYear: null, nextAlbaranNumber: 50 }, 2026),
    (err) => {
      assert.ok(err instanceof AlbaranSerieSinAnioError, `🔴 falla con otro error: ${err && err.name}`);
      assert.match(String(err.message), /se habría reiniciado en 1/i,
        '🔴 el error no NOMBRA lo que se evitó. Un fallo que no dice qué habría pasado se lee como ' +
        'una avería cualquiera y alguien lo «arregla» quitando la comprobación.');
      assert.match(String(err.message), /50/, '🔴 el error no dice en qué número estaba el contador');
      return true;
    },
    '🔴 SE REINICIA LA SERIE EN SILENCIO: el contador está en 50, el año sin fijar, y esto devuelve ' +
      'un número sin protestar.',
  );
});

test('SCRUM-306 · CONTROL NEGATIVO: el reinicio anual LEGÍTIMO sigue funcionando', () => {
  // Si solo se probara el fallo, no se habría probado que no se ha bloqueado todo. El 1 de enero,
  // con la serie del año pasado en el 47, la respuesta correcta ES 1.
  assert.equal(
    resolveAlbaranSeq({ albaranSeriesYear: 2025, nextAlbaranNumber: 47 }, 2026), 1,
    '🔴 el reinicio anual ha dejado de funcionar: un año distinto CON año fijado empieza serie ' +
      'nueva en 1, y eso es correcto — el caso malo es el año SIN FIJAR.',
  );
  // Merchant recién creado: año nulo y contador en 1 → primera emisión, sin drama.
  assert.equal(
    resolveAlbaranSeq({ albaranSeriesYear: null, nextAlbaranNumber: 1 }, 2026), 1,
    '🔴 un merchant nuevo (año nulo, contador 1) no puede fallar: no le han movido nada.',
  );
  // Y el caso normal, que es el 99 % de las veces.
  assert.equal(resolveAlbaranSeq({ albaranSeriesYear: 2026, nextAlbaranNumber: 12 }, 2026), 12);
});

test('SCRUM-306 · la vista previa NO enseña el número reiniciado', () => {
  assert.equal(vistaPreviaAlbaran({ albaranSeriesYear: 2026, nextAlbaranNumber: 12 }, 2026), 'ALB-2026-012');
  // Y con el contador movido sin año, falla en vez de enseñar `ALB-2026-001`: enseñarlo sería
  // confirmarle al profesional el reinicio justo antes de que ocurra.
  assert.throws(
    () => vistaPreviaAlbaran({ albaranSeriesYear: null, nextAlbaranNumber: 50 }, 2026),
    AlbaranSerieSinAnioError,
    '🔴 la vista previa enseña un número que la reserva no va a dar. Calcularla aparte es como se ' +
      'acaba enseñando una cosa y emitiendo otra.',
  );
});

test('SCRUM-306 · la vista previa usa las MISMAS funciones que la reserva', () => {
  // Si se calculara aparte, podría divergir sin que nada avisara.
  const src = leer('src/modules/jobs/domain/albaranSerie.ts');
  assert.ok(/resolveAlbaranSeq/.test(src) && /formatAlbaranNumber/.test(src),
    '🔴 la vista previa no usa `resolveAlbaranSeq` + `formatAlbaranNumber`');
  const alloc = leer('src/modules/jobs/domain/albaranNumber.service.ts');
  assert.ok(/const seq = resolveAlbaranSeq\(m, year\);/.test(alloc),
    '🔴 ESCÁNER CIEGO: la reserva ya no usa `resolveAlbaranSeq` — la vista previa y la reserva ' +
    'habrían dejado de compartir mecanismo y este test estaría comparando con nada.');
});

// ── 2 · EL DETECTOR ES EL DE A4 ─────────────────────────────────────────────────────────

test('SCRUM-306 · SUELO: el detector encuentra los albaranes que existen', () => {
  const r = huecosDeAlbaranes(['ALB-2026-001', 'ALB-2026-002', 'ALB-2026-003'], 2026);
  assert.equal(
    r.emitidos, 3,
    `🔴 ESCÁNER CIEGO: el detector ve ${r.emitidos} albaranes y se le han dado 3. Un cero de «todo ` +
      'correlativo» y uno de «no supe mirar» son idénticos en pantalla y opuestos en significado.',
  );
  assert.equal(r.ultimoSeq, 3, '🔴 no casa el último: estaría componiendo con otro formato');
  assert.deepEqual(r.ajenos, [], '🔴 no reconoce sus propios números como suyos');
});

test('SCRUM-306 · CONTROL NEGATIVO: una serie sin huecos NO avisa', () => {
  // Si solo se probara el aviso, no se habría probado que no se avisa siempre.
  const r = huecosDeAlbaranes(['ALB-2026-001', 'ALB-2026-002', 'ALB-2026-003'], 2026);
  assert.deepEqual(
    r.huecos, [],
    '🔴 avisa de huecos en una serie perfectamente correlativa. Un detector que avisa siempre es ' +
      'ruido, y el ruido se aprende a ignorar justo antes de que el aviso importe.',
  );
});

test('SCRUM-306 · un hueco real se detecta y se NOMBRA', () => {
  const r = huecosDeAlbaranes(['ALB-2026-001', 'ALB-2026-003', 'ALB-2026-004'], 2026);
  assert.deepEqual(r.huecos, ['ALB-2026-002'], '🔴 no detecta el hueco, o no lo nombra');
  assert.equal(r.emitidos, 3);
  assert.equal(r.ultimoSeq, 4);
  // Lo que falta POR ENCIMA del último no es hueco: la serie aún no ha llegado.
  //
  // ⚠️ SCRUM-237 · esta negación necesita su HERMANO POSITIVO. Sola sería verde permanente: si el
  // detector no compusiera nunca `ALB-2026-005`, el `!includes` pasaría por vacío en vez de por
  // discriminar. Así que primero se comprueba que ESE MISMO número SÍ sale cuando es un hueco real.
  const conHueco005 = huecosDeAlbaranes(['ALB-2026-004', 'ALB-2026-006'], 2026);
  assert.ok(
    conHueco005.huecos.includes('ALB-2026-005'),
    '🔴 ESCÁNER CIEGO: `ALB-2026-005` no sale como hueco ni cuando lo es. La negación de abajo ' +
      'estaría pasando porque ese número no se compone nunca, no porque no sea un hueco.',
  );
  assert.ok(!r.huecos.includes('ALB-2026-005'), '🔴 inventa un hueco en el futuro');
});

test('SCRUM-306 · es EL MISMO detector que A4, no una copia', () => {
  // El guard que evita SCRUM-240 otra vez. Estructural: el módulo del albarán IMPORTA el de A4.
  const src = leer('src/modules/jobs/domain/albaranSerie.ts');
  assert.ok(
    /import \{ huecosDeLaSerie[\s\S]{0,80}\} from '\.\.\/\.\.\/invoicing\/domain\/huecosSerie'/.test(src),
    '🔴 el módulo de la serie de albaranes NO importa `huecosDeLaSerie`: se ha escrito un segundo ' +
      'detector. Es exactamente el defecto de SCRUM-240 — no dos constructores, uno escrito dos veces.',
  );
  // Y no reimplementa el barrido: nada de bucles propios ni de expresiones que parseen el número.
  assert.ok(!/for \(let seq/.test(src), '🔴 el módulo del albarán tiene su propio barrido');
  assert.ok(
    !/\\d\{3\}|match\(|\.split\('-'\)/.test(src),
    '🔴 el módulo del albarán PARSEA el número. A4 compone a propósito: una expresión que parsea es ' +
      'una copia del formato, y una copia se queda vieja sin avisar.',
  );

  // Y de verdad: el resultado del atajo es idéntico al de llamar a A4 a mano con el compositor.
  const numeros = ['ALB-2026-001', 'ALB-2026-003'];
  assert.deepEqual(
    huecosDeAlbaranes(numeros, 2026),
    huecosDeLaSerie(numeros, null, 2026, false, componerNumeroAlbaran),
    '🔴 `huecosDeAlbaranes` no es un atajo de `huecosDeLaSerie`: hace otra cosa.',
  );
});

// ── 3 · LA GENERALIZACIÓN NO ROMPE EL CASO VIEJO ────────────────────────────────────────

test('SCRUM-306 · CONTROL POSITIVO con FACTURAS: el uso que ya existía sigue igual', () => {
  // Si al generalizar se rompiera el caso viejo, lo habría hecho mal. Se llama SIN el parámetro
  // nuevo, exactamente como lo llamaba A4.
  const r = huecosDeLaSerie(['2026-CF-001', '2026-CF-003'], 'CF', 2026);
  assert.equal(r.emitidos, 2, '🔴 el detector de facturas ha dejado de ver sus números');
  assert.deepEqual(r.huecos, ['2026-CF-002'], '🔴 el detector de facturas ha dejado de detectar su hueco');
  assert.equal(r.ultimoSeq, 3);
  assert.deepEqual(r.ajenos, []);

  // La rectificativa, que lleva contador propio.
  const rr = huecosDeLaSerie(['2026-CF-R-001', '2026-CF-R-002'], 'CF', 2026, true);
  assert.equal(rr.emitidos, 2, '🔴 la serie de rectificativas se ha roto al generalizar');
  assert.deepEqual(rr.huecos, []);

  // Y el prefijo ajeno, que era un hallazgo de A4 y tiene que seguir saliendo.
  const aj = huecosDeLaSerie(['2026-XX-001'], 'CF', 2026);
  assert.deepEqual(aj.ajenos, ['2026-XX-001'], '🔴 los `ajenos` han dejado de reportarse');

  // Y que el DEFECTO del parámetro es el de siempre: pasarlo explícito da lo mismo que omitirlo.
  assert.deepEqual(
    huecosDeLaSerie(['2026-CF-001'], 'CF', 2026),
    huecosDeLaSerie(['2026-CF-001'], 'CF', 2026, false, formatInvoiceNumber),
    '🔴 el valor por defecto del parámetro nuevo NO es el comportamiento de antes.',
  );
});

test('SCRUM-306 · las dos series no se mezclan', () => {
  // Un albarán no casa como factura ni al revés: mezclarlas inventaría huecos que no existen.
  assert.equal(formatAlbaranNumber(2026, 1), 'ALB-2026-001');
  assert.notEqual(formatAlbaranNumber(2026, 1), formatInvoiceNumber('CF', 2026, 1, false));
  const r = huecosDeAlbaranes(['2026-CF-001'], 2026);
  assert.deepEqual(
    r.ajenos, ['2026-CF-001'],
    '🔴 un número de FACTURA cuela como albarán. Las dos series son independientes (Parte L) y ' +
      'mezclarlas inventaría huecos que no existen.',
  );
});

// ── EL CERROJO SIGUE AHÍ ────────────────────────────────────────────────────────────────

test('SCRUM-306 · la reserva conserva el cerrojo y NO lo reescribe', () => {
  const src = leer('src/modules/jobs/domain/albaranNumber.service.ts');
  assert.ok(
    /pg_advisory_xact_lock\(\$\{SERIE_LOCK_NS\}::int, \$\{merchantId\}::int\)/.test(src),
    '🔴 el cerrojo de la reserva de albaranes ha desaparecido o ha cambiado de forma. Sin él, dos ' +
      'albaranes creados a la vez leen el MISMO número (SCRUM-234).',
  );
  assert.ok(
    /import \{ SERIE_LOCK_NS \} from '\.\.\/\.\.\/invoicing\/domain\/invoiceNumber\.service'/.test(src),
    '🔴 `SERIE_LOCK_NS` ha dejado de IMPORTARSE: si se declara aquí una constante propia, los dos ' +
      'cerrojos dejan de serializar entre sí sin que nada avise.',
  );
  // Y que este ticket no ha tocado el generador de facturas (regla 38).
  const inv = leer('src/modules/invoicing/domain/invoiceNumber.service.ts');
  assert.ok(
    /export const SERIE_LOCK_NS/.test(inv) && /allocateInvoiceNumber/.test(inv),
    '🔴 ESCÁNER CIEGO: el generador de facturas ya no está donde este guard lo busca.',
  );
});
