// tests/scrum332-comparativa-anclas.test.mjs — SCRUM-332 (F5)
//
// CADA FILA DE LA COMPARATIVA TIENE QUE SER VERDAD HOY.
//
// ── POR QUÉ ESTE GUARD, Y POR QUÉ NO ES DE ESTILO ───────────────────────────────────────────
// La tabla "tu método actual vs YaQu" no nombra a ningún competidor, y eso protege de que un
// competidor denuncie (art. 10 LCD). NO protege de nada más: el art. 5 LCD (actos de engaño)
// aplica igual cuando no se nombra a nadie. Una fila que describe algo que el producto todavía
// NO hace es publicidad engañosa aunque esté a dos sprints de ser verdad.
//
// El modo de fallo real no es escribir una mentira a propósito. Es este:
//   ① alguien añade una fila con una función que "está casi";
//   ② alguien borra el mecanismo que respaldaba una fila y la fila se queda;
//   ③ alguien renombra la función y nadie vuelve a la landing.
// Los tres dejan la página diciendo algo falso, y ninguno da error en ningún sitio.
//
// ── CÓMO SE VIGILA ──────────────────────────────────────────────────────────────────────────
// La lista de filas NO se escribe aquí: se DERIVA del HTML (la lección de SCRUM-302 — una lista
// a mano no avisa de lo que le falta). Lo que sí vive aquí es el ANCLA de cada fila, porque
// "esta línea del código demuestra esta frase" es un juicio, no algo que se pueda derivar.
//
// Y la correspondencia se exige EN LAS DOS DIRECCIONES:
//   · fila en el HTML sin ancla aquí  → 🔴 (el caso ① y ③)
//   · ancla aquí sin fila en el HTML  → 🔴 (el caso ②: obliga a retirar el ancla al retirar la
//     fila, así que un ancla nunca queda "cubriendo" una fila que ya no existe)
// Una fila sin `data-fila` no puede colarse: el SUELO cuenta `cmp-row` y `data-fila` por separado
// y exige que cuadren.
//
// ⚠️ El ancla NO vive en el HTML a propósito: `public/index.html` es una página pública y ahí no
// se publican rutas internas del código. Se emparejan por `data-fila`, que no dice nada de nadie.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = path.join(RAIZ, 'public', 'index.html');

/**
 * El ancla de cada fila: `fichero::símbolo`. El fichero tiene que existir Y contener el símbolo.
 *
 * Comprobar sólo que el fichero existe sería un verde hueco: un fichero puede seguir ahí con el
 * mecanismo ya retirado. El símbolo es lo que ata la frase al mecanismo.
 *
 * Cada entrada dice qué frase sostiene, para que quien la toque sepa qué se cae con ella.
 */
const ANCLAS = {
  // "Lo aceptó con su firma y su fecha, y la firma queda dentro del PDF."
  'firma': ['src/modules/quotes/app/routes/quotes.routes.ts::signatureData'],
  // "El recordatorio sale solo." — el cron REAL que lo dispara, no el servicio suelto: que la
  // función exista no prueba que alguien la llame (por eso el ancla apunta al cron).
  'cobro-pendiente': ['src/core/cron/cron.ts::sendInvoicePaymentReminders'],
  // "Se le recuerda solo, y el presupuesto caduca cuando toca." — dos mecanismos, dos anclas.
  'presupuesto-sin-respuesta': [
    'src/core/cron/cron.ts::sendPendingReminders',
    'src/core/cron/cron.ts::expireQuotes',
  ],
  // "Cada movimiento queda en su ficha, con su fecha."
  'historial-cliente': ['src/modules/system/customerEvents.service.ts::recordCustomerEvent'],
  // "Lo que entró menos lo que salió, mes a mes."
  'margen-mes': ['src/modules/reports/app/routes/reports.routes.ts::profit'],
  // "Salen de tu catálogo según escribes."
  'catalogo-precios': ['src/modules/products/app/routes/products.routes.ts::autocomplete'],
};

const html = fs.readFileSync(LANDING, 'utf8');

const contar = (re) => (html.match(re) || []).length;
const filasDelHtml = () => [...html.matchAll(/data-fila="([^"]+)"/g)].map((m) => m[1]);

/** ¿El ancla apunta a algo que existe HOY? Devuelve el motivo del fallo, o null si está viva. */
function motivoAnclaMuerta(ancla, raiz = RAIZ) {
  const [rel, simbolo] = ancla.split('::');
  if (!rel || !simbolo) return `formato inválido (se espera "fichero::símbolo"), llegó "${ancla}"`;
  const abs = path.join(raiz, rel);
  if (!fs.existsSync(abs)) return `el fichero ${rel} NO EXISTE`;
  const texto = fs.readFileSync(abs, 'utf8');
  if (!texto.includes(simbolo)) return `${rel} existe pero NO contiene "${simbolo}"`;
  return null;
}

// ── ① EL SUELO ──────────────────────────────────────────────────────────────────────────────
// Sin esto, todo lo de abajo pasaría en verde con la sección borrada: cero filas sin ancla y
// cero filas son la misma respuesta. "Todas las filas están respaldadas" y "no supe mirar" no
// se pueden parecer, porque aquí la consecuencia de confundirlos es publicidad engañosa.
test('SCRUM-332 · SUELO: el extractor encuentra las filas de la comparativa', () => {
  const nRow = contar(/class="cmp-row"/g);
  const nFila = contar(/data-fila="/g);

  assert.ok(nRow > 0,
    '🔴 CIEGO: no se ha encontrado NINGUNA fila `cmp-row` en public/index.html. El verde de los ' +
    'tests de abajo no significaría «todas las filas están respaldadas», sino «no se miró». Si la ' +
    'sección se retiró a propósito, hay que retirar también este guard y el registro de ANCLAS.');

  assert.equal(nFila, nRow,
    `🔴 hay ${nRow} filas y ${nFila} atributos \`data-fila\`: alguna fila NO lo lleva.\n\n` +
    '  Una fila sin `data-fila` es una fila que este guard NO PUEDE emparejar con su ancla, así ' +
    'que pasaría sin que nadie compruebe si lo que dice es verdad. Que es exactamente el agujero ' +
    'que este fichero existe para tapar.');
});

// ── ② AUTOPRUEBA DEL COMPROBADOR ────────────────────────────────────────────────────────────
// El test ③ se cree lo que diga `motivoAnclaMuerta`. Antes de creérselo, se comprueba que sabe
// decir que NO sobre fuente sintética: si el comprobador devolviera siempre `null`, ③ daría
// verde con las seis anclas inventadas y este fichero entero sería decorativo.
test('SCRUM-332 · el comprobador de anclas SABE FALLAR (control positivo y negativo)', (t) => {
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'scrum332-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'src', 'existe.ts'), 'export const simboloQueExiste = 1;\n');

  // Positivo: un ancla buena tiene que dar null.
  assert.equal(motivoAnclaMuerta('src/existe.ts::simboloQueExiste', tmp), null,
    '🔴 el comprobador rechaza un ancla VIVA: daría rojos falsos y acabaría desactivado.');

  // Negativos: las tres formas de estar muerta.
  assert.match(motivoAnclaMuerta('src/no-existe.ts::loQueSea', tmp) || '', /NO EXISTE/,
    '🔴 el comprobador no detecta un fichero inexistente.');
  assert.match(motivoAnclaMuerta('src/existe.ts::simboloInventado', tmp) || '', /NO contiene/,
    '🔴 el comprobador no detecta un símbolo que no está en el fichero: es el caso del RENOMBRADO, ' +
    'el más probable de los tres, y el que deja la landing afirmando algo que ya no pasa.');
  assert.match(motivoAnclaMuerta('sin-separador', tmp) || '', /formato inválido/,
    '🔴 el comprobador acepta un ancla con formato roto.');
});

// ── ③ EL GUARD ──────────────────────────────────────────────────────────────────────────────
test('SCRUM-332 · toda fila de la comparativa tiene un ancla VIVA en el código', () => {
  const muertas = [];
  for (const [fila, anclas] of Object.entries(ANCLAS)) {
    for (const ancla of anclas) {
      const motivo = motivoAnclaMuerta(ancla);
      if (motivo) muertas.push(`fila "${fila}" → ${ancla}: ${motivo}`);
    }
  }

  assert.deepEqual(muertas, [],
    '🔴 HAY FILAS DE LA COMPARATIVA CUYO MECANISMO YA NO EXISTE:\n    ' + muertas.join('\n    ') +
    '\n\n  La landing sigue afirmándolo. Art. 5 LCD: es engaño aunque no se nombre a nadie.\n' +
    '  Las salidas son DOS, y ninguna es tocar este guard:\n' +
    '    · si el mecanismo se movió → actualizar el ancla en ANCLAS (arriba);\n' +
    '    · si el mecanismo se retiró → RETIRAR LA FILA de public/index.html y su ancla.');
});

// ── ④ LA CORRESPONDENCIA, EN LAS DOS DIRECCIONES ────────────────────────────────────────────
test('SCRUM-332 · ninguna fila se queda sin ancla y ningún ancla se queda sin fila', () => {
  const enHtml = filasDelHtml().sort();
  const enRegistro = Object.keys(ANCLAS).sort();

  const sinAncla = enHtml.filter((f) => !enRegistro.includes(f));
  const sinFila = enRegistro.filter((f) => !enHtml.includes(f));

  assert.deepEqual(sinAncla, [],
    `🔴 FILAS EN LA LANDING SIN ANCLA QUE LAS RESPALDE: ${sinAncla.join(', ')}\n\n` +
    '  UNA FILA SIN ANCLA NO SE ESCRIBE. Antes de añadirla, hay que poder señalar el fichero y el ' +
    'símbolo que demuestran que el producto YA hace eso HOY. "Está casi" no es una ancla.');

  assert.deepEqual(sinFila, [],
    `🔴 ANCLAS SIN FILA: ${sinFila.join(', ')}\n\n` +
    '  Se ha retirado la fila y se ha dejado el ancla. No es inofensivo: el registro de arriba es ' +
    'lo que alguien lee para saber qué afirma la landing, y un ancla huérfana dice que se afirma ' +
    'algo que ya no se afirma. Se retiran las dos, en el mismo commit.');
});

// ── ⑤ REGLA 30 · EL TEXTO NO APROBADO NO SE PUBLICA ─────────────────────────────────────────
test('SCRUM-332 · mientras el microcopy sea PROPUESTA, la sección no se publica', () => {
  const seccion = /<section id="comparativa"[^>]*>/.exec(html);
  assert.ok(seccion, '🔴 CIEGO: no se encuentra la sección `#comparativa` en public/index.html.');

  const etiqueta = seccion[0];
  if (etiqueta.includes('data-propuesta')) {
    assert.match(etiqueta, /\shidden(\s|>|=)/,
      '🔴 la sección lleva `data-propuesta` (su texto NO está aprobado, regla 30) pero ha perdido ' +
      'el `hidden`: se publicaría microcopy que el fundador no ha visto, en la página pública.\n\n' +
      '  Al aprobar los textos se quitan LOS DOS a la vez, en el mismo commit. Quitar sólo el ' +
      '`hidden` es publicar una propuesta; quitar sólo `data-propuesta` es perder el aviso.');
  }
});
