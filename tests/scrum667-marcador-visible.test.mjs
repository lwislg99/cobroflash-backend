// tests/scrum667-marcador-visible.test.mjs — SCRUM-667
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN MARCADOR QUE LLEGA A UNA SUPERFICIE NO PUEDE DEPENDER DE QUE ALGUIEN MIRE
//
// Producción llevaba NUEVE DÍAS sin desplegar por una deriva de esquema. Se arregló, y con ella
// desapareció el hueco entre mergear y desplegar que hacía inofensivo un marcador: **desde ahora
// cada merge sale a producción**. Un `[PENDIENTE microcopy oficial]` dejó de ser una nota para el
// equipo y es texto que lee un profesional que paga.
//
// 🔴 Y LOS TRES QUE LO DESTAPARON SE ENCONTRARON MIRANDO UNA PANTALLA, por casualidad. No los
// encontró ningún mecanismo. El siguiente no va a venir acompañado de una captura.
//
// ── LO QUE YA HABÍA, Y POR QUÉ NO BASTABA ────────────────────────────────────────────────
//
//   · `scripts/censo-marcadores.mjs` — SÍ barre `public/`, `public/dashboard/js` y `src/`.
//     (La premisa de que «`src/` no lo mira nadie» es falsa para el CENSO. Medido.)
//   · `tests/scrum402-marcador-no-se-pinta.test.mjs` — el TRINQUETE, y sólo lee
//     `public/dashboard/js`. **Las marcas de `src/` las ve el censo y NO LAS CONGELA NADIE.**
//     Ése es el hueco de verdad, y de `src/` salen las que se imprimen en PDF.
//
// ── LAS TRES PREGUNTAS, EN ORDEN DE COSTE ────────────────────────────────────────────────
//
//   ① ¿cuántos hay?          → lo contesta el censo. 25 marcas hoy (panel 16 · público 1 · servidor 8).
//   ② ¿cuántos VE alguien?   → un marcador en un camino inalcanzable no cuesta nada.
//   ③ ¿cuál llega al PDF DEL CLIENTE? → ésos son los caros: los ve el cliente de nuestro cliente.
//
// Este fichero vigila ② y ③, que es lo que no vigilaba nadie.
//
// ⛔ `pdf.service.ts` NO se toca: aquí se LEE su salida, con `lineasDePdf` (SCRUM-659). Que un
// texto no esté en la plantilla no prueba que no salga; que salga en el papel sí prueba que sale.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censar, MARCA } from '../scripts/censo-marcadores.mjs';
import { lineasDePdf, extraerTextoPdf, vecesEnPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL CENSO DE `src/`, CONGELADO — el hueco que este ticket cierra
//
// Por fichero y no un total: mover un marcador de un módulo a otro no puede pasar por «igual».
// Medido el 2-sep-2026 sobre `main`. **Sólo puede BAJAR**, y cuando baje hay que actualizarlo aquí
// — un trinquete que no se aprieta al arreglarlo deja de apretar.
// ═════════════════════════════════════════════════════════════════════════════════════════
const CENSO_SERVIDOR = Object.freeze({
  // Sprint Tecnosel · `tipoIntervencion.ts` ESTUVO aquí con 1 y SALIÓ el 3-sep-2026: el fundador
  // firmó «Tipo de intervención» y los tres valores del papel («Reparación / Asistencia técnica»,
  // «Mantenimiento», «Instalación»). Los tres salían de una sola constante, así que se apagaron de
  // golpe, tal como predijo el comentario que vivía aquí. La entrada se BORRA y no baja a 0: este
  // censo sólo lista ficheros CON marcador. El trinquete APRIETA (SCRUM-703).
  // El rótulo de la columna de bases del desglose. 🔴 ES EL ÚNICO QUE SE IMPRIME EN EL PDF, y el
  // PDF de la factura lo ve el CLIENTE del profesional. Medido leyendo el papel, no la plantilla.
  'src/modules/invoicing/infra/pdf/pdf.service.ts': 1,
  // Aviso del criterio de caja y resumen del modelo 303: los ve el profesional en su pantalla.
  'src/modules/invoicing/domain/criterioCaja.ts': 1,
  'src/modules/fiscal/modelo303/modelo303.ts': 1,
  'src/modules/fiscal/librosAeat/librosAeat.ts': 1,
  // ── SCRUM-684 · 4-sep-2026 · ENTRA A CONCIENCIA CON 1 ──────────────────────────────────
  //
  // El rechazo de una línea que dice venir de un presupuesto inexistente. Lo ve el PROFESIONAL
  // en un toast del panel, no el cliente: NO va a `EN_EL_PAPEL`.
  //
  // 🔴 Y NO SE PUDO REUTILIZAR EL TEXTO APROBADO, que es el motivo de que esto entre: el de
  // SCRUM-257 decía «Este trabajo no tiene presupuesto; NO SE PUEDE CREAR UN ALBARÁN», y desde
  // que el guard se acota eso es FALSO — sí se puede, salvo para esa línea. Un mensaje aprobado
  // que ha dejado de ser verdad es peor que uno con marcador.
  //
  // El día que el asesor firme el texto, esta entrada se BORRA, no se pone a 0.
  'src/modules/jobs/domain/albaranSinPresupuesto.ts': 1,
  // ── SCRUM-607 (ALB-02) · 4-sep-2026 · ENTRA A CONCIENCIA CON 1 ─────────────────────────
  //
  // 🔴 SE IMPRIME EN EL PAPEL QUE RECIBE EL CLIENTE — el pie del albarán, diciendo de qué
  // presupuesto sale. Y es incómodo a propósito: la alternativa es inventarme el literal, que
  // es justo lo que la regla 30 prohíbe.
  //
  // No se puede no pintar la superficie y esperar: sin la referencia, un albarán sin precios
  // deja de ser comprobable —una lista de cosas sin nada que la ate a lo que el cliente
  // aceptó—, y eso es peor que el marcador. Los DOS textos de la casilla que lo enciende viven
  // en  y están declarados en el censo de SCRUM-402.
  //
  // El asesor firma con las cajas ya medidas (929 y 390 px, en ). Ese
  // día la entrada se BORRA, no se pone a 0.
  'src/modules/jobs/domain/albaranPrecios.ts': 1,
  // Mensajes de error de API (409): los lee el profesional en un aviso del panel.
  'src/modules/jobs/app/routes/albaranes.routes.ts': 1,
  'src/modules/system/app/routes/invoicesAdmin.routes.ts': 1,
  // Etiqueta de la calidad del firmante y aviso de dirección del trabajo.
  'src/modules/jobs/domain/albaranFirmante.ts': 1,
  'src/modules/jobs/domain/jobDireccion.ts': 1,
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② LOS QUE LLEGAN AL PAPEL DEL CLIENTE — la lista más cara del repo
//
// Se declara ENTERA y con su condición: un marcador nuevo en un PDF no puede entrar en silencio.
// `MARCADOR_MICROCOPY_CABECERA_DOC` era otro y se resolvió; éste es el que queda.
// ═════════════════════════════════════════════════════════════════════════════════════════
const EN_EL_PAPEL = Object.freeze({
  'MARCADOR_MICROCOPY_DESGLOSE': 'factura con MÁS DE UN tipo de IVA — el rótulo de la columna de bases',
  // SCRUM-607 (ALB-02): el pie del ALBARÁN, con el presupuesto de origen. Se imprime siempre que
  // el Trabajo venga de un presupuesto — con precios y sin ellos.
  'ROTULO_PRESUPUESTO_ORIGEN': 'albarán cuyo Trabajo viene de un presupuesto — el pie con su número',
});

/** Una factura de prueba. Los campos son `qty`/`price`/`tax` (fracción), que es lo que lee el generador. */
async function pdfDeFactura(sufijo, lines) {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA667${sufijo}`,
    merchant: { name: 'QA Fontaneria', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '302.50', qrData: 'x', type: 'F1', lines,
  });
  try { return fs.readFileSync(outPath); } finally { fs.rmSync(outPath, { force: true }); }
}

const UN_TIPO = [
  { description: 'Mano de obra', qty: 1, price: 100, tax: 0.21 },
  { description: 'Desplazamiento', qty: 1, price: 50, tax: 0.21 },
];
const DOS_TIPOS = [
  { description: 'Mano de obra', qty: 1, price: 100, tax: 0.21 },
  { description: 'Material reducido', qty: 1, price: 50, tax: 0.10 },
];

// ═══ SUELOS ══════════════════════════════════════════════════════════════════════════════
//
// «No hay marcadores visibles» y «no supe mirar» son el mismo número con significados opuestos, y
// en este ticket ese error ya está documentado: los tres del catálogo llevaban semanas a la vista.

test('SCRUM-667 · 🔴 SUELO: el censo LEE el árbol antes de dar un número', () => {
  const r = censar(RAIZ);
  assert.ok(r.ficherosLeidos >= 100,
    `🔴 CIEGO: sólo ${r.ficherosLeidos} ficheros leídos. El barrido no encuentra el árbol, y ` +
    'entonces «cero marcadores» significa «no supe mirar», no «está todo aprobado».');
  assert.ok(r.marcas.length > 0,
    '🔴 CIEGO: CERO marcas en todo el repo. Imposible — hay 25 medidas el 2-sep-2026 y el fundador ' +
    'acaba de ver tres con sus propios ojos. Arregla el barrido antes de creerte el cero.');
  assert.equal(MARCA, '[PENDIENTE',
    '🔴 la marca que se busca ha cambiado: todo lo de abajo estaría contando otra cosa.');
});

test('SCRUM-667 · 🔴 SUELO: el censo ve las TRES poblaciones, no sólo el panel', () => {
  // Si `src/` dejara de barrerse, su trinquete de abajo pasaría en verde sobre un conjunto vacío —
  // que es exactamente el estado del que sale este ticket.
  const porAmbito = {};
  for (const m of censar(RAIZ).marcas) porAmbito[m.ambito] = (porAmbito[m.ambito] || 0) + 1;
  assert.ok((porAmbito.servidor || 0) > 0,
    '🔴 CIEGO EN `src/`: cero marcas de servidor. De ahí salen las que se imprimen en PDF, y el ' +
    'trinquete de SCRUM-402 no mira esa carpeta — si este barrido se queda ciego, no queda nadie.');
  assert.ok((porAmbito.panel || 0) > 0, '🔴 CIEGO EN el panel.');
});

// ═══ ① EL TRINQUETE DE `src/` ════════════════════════════════════════════════════════════

test('SCRUM-667 · ningún marcador NUEVO en `src/` (y los que hay no crecen)', () => {
  const cuenta = {};
  for (const m of censar(RAIZ).marcas.filter((m) => m.ambito === 'servidor')) {
    cuenta[m.fichero] = (cuenta[m.fichero] || 0) + 1;
  }
  const nuevos = [];
  const subidas = [];
  for (const [f, n] of Object.entries(cuenta)) {
    if (!(f in CENSO_SERVIDOR)) nuevos.push(`${f} (+${n})`);
    else if (n > CENSO_SERVIDOR[f]) subidas.push(`${f}: ${CENSO_SERVIDOR[f]} → ${n}`);
  }
  assert.deepEqual([...nuevos, ...subidas], [],
    '🔴 HAY MARCADORES NUEVOS EN `src/`:\n    ' + [...nuevos, ...subidas].join('\n    ') +
    '\n\n  De `src/` salen los textos que acaban en un PDF, en un correo y en un aviso del panel.\n' +
    '  Desde que producción despliega con cada merge, esto lo lee un profesional que paga.\n' +
    '  Si el texto tiene que salir con marcador, súbelo a `CENSO_SERVIDOR` A CONCIENCIA y di por\n' +
    '  qué en el commit. Y si llega al PDF, decláralo además en `EN_EL_PAPEL`.');
});

test('SCRUM-667 · 🔴 y si BAJA, se aprieta: el censo de `src/` no se queda viejo', () => {
  const cuenta = {};
  for (const m of censar(RAIZ).marcas.filter((m) => m.ambito === 'servidor')) {
    cuenta[m.fichero] = (cuenta[m.fichero] || 0) + 1;
  }
  const bajadas = Object.entries(CENSO_SERVIDOR)
    .filter(([f, n]) => (cuenta[f] || 0) < n)
    .map(([f, n]) => `${f}: ${n} → ${cuenta[f] || 0}`);
  assert.deepEqual(bajadas, [],
    '✅ han bajado, que es la dirección buena:\n    ' + bajadas.join('\n    ') +
    '\n\n  Actualiza `CENSO_SERVIDOR` en este mismo commit. Un trinquete que sólo sabe subir deja\n' +
    '  de significar algo el día que algo se cierra — y hoy se ha cerrado uno.');
});

// ═══ ② EL PAPEL DEL CLIENTE ══════════════════════════════════════════════════════════════

test('SCRUM-667 · 🔴 SUELO: el lector VE el PDF antes de afirmar nada sobre él', async () => {
  const buf = await pdfDeFactura('S', DOS_TIPOS);
  const r = lineasDePdf(buf);
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un lector que no lee diría que no ` +
    'hay marcadores por el mismo motivo por el que no ve nada.');
  assert.ok(r.lineas.length > 5, `🔴 LECTOR CIEGO: sólo ${r.lineas.length} líneas.`);
  assert.equal(vecesEnPdf(extraerTextoPdf(buf).texto, 'QA SL'), 1,
    '🔴 el lector no encuentra ni el nombre del emisor: lo de abajo sería cierto sobre un texto vacío.');
});

test('SCRUM-667 · 🔴 CONTROL NEGATIVO: una factura de UN tipo de IVA NO lleva marcador', async () => {
  // La mitad que impide que este guard sea un rojo permanente — y además prueba que el marcador
  // del desglose está donde dice estar, no en toda factura.
  const texto = extraerTextoPdf(await pdfDeFactura('N', UN_TIPO)).texto;
  assert.equal(vecesEnPdf(texto, MARCA), 0,
    '🔴 una factura con un solo tipo de IVA está imprimiendo un marcador. El desglose sólo aparece ' +
    'con MÁS de un tipo; si sale aquí, se ha movido de sitio y lo ve todo cliente.');
});

/**
 * El PAPEL DEL ALBARÁN. 🔴 SCRUM-607 · 4-sep-2026 · ESTE GENERADOR NO ESTABA, Y POR ESO ESTE
 * GUARD NO PODÍA CRECER: contaba los marcadores de UNA factura contra el TOTAL de declarados,
 * o sea que daba por supuesto que todo lo declarado sale en ese único papel. En cuanto un
 * segundo documento gana un marcador —el pie del albarán con su presupuesto de origen— la
 * cuenta deja de cuadrar, y la salida fácil habría sido no declararlo: dejar sin declarar
 * justo el marcador que ve el cliente. Se amplía la POBLACIÓN, no se relaja el criterio.
 */
async function pdfDeAlbaran() {
  const { generateAlbaranPdf } = await import('../dist/modules/jobs/infra/albaranPdf.service.js');
  const { referenciaPresupuesto } = await import(
    '../dist/modules/jobs/domain/albaranPrecios.js');
  const { outPath } = await generateAlbaranPdf({
    merchantId: 9667, numero: 'ALB-2026-QA667', version: 1,
    fecha: new Date(2026, 8, 4), emisionAt: new Date(2026, 8, 4),
    modoValoracion: 'SIN_VALORAR',
    merchant: { address: 'C/ Mayor 1' }, customer: { taxId: null },
    emisor: 'QA SL', emisorNif: 'B00000000', cliente: 'Cliente QA',
    obra: 'Obra QA', referenciaTrabajo: 'Trabajo QA',
    lineas: [{ concepto: 'Material', cantidad: 1, unidad: 'ud' }],
    totales: null, notas: null, signatureData: null, firmadoAt: null,
    firmadoPorNombre: null, firmadoPorCalidad: null, evidencia: null,
    // Con presupuesto de origen: es la condición en la que se imprime el pie.
    presupuestoRef: referenciaPresupuesto({ id: 41, number: 7 }),
  });
  try { return fs.readFileSync(outPath); } finally { fs.rmSync(outPath, { force: true }); }
}

test('SCRUM-667 · 🔴 al PAPEL del cliente no llega ningún marcador que no esté DECLARADO', async () => {
  const buf = await pdfDeFactura('P', DOS_TIPOS);
  const r = lineasDePdf(buf);
  assert.equal(r.ok, true, 'suelo: sin lector no hay veredicto');

  // Los DOS papeles que hoy pueden llevar marcador: la factura y el albarán.
  const rAlb = lineasDePdf(await pdfDeAlbaran());
  assert.equal(rAlb.ok, true, 'suelo: sin lector del albarán tampoco hay veredicto');

  const impresas = [...r.lineas, ...rAlb.lineas]
    .map((l) => String(l.texto || '')).filter((t) => t.includes(MARCA));
  const declarados = Object.keys(EN_EL_PAPEL).length;

  // 🔴 SUELO DEL CONTROL POSITIVO: hoy SÍ hay uno declarado, así que el papel TIENE que traerlo.
  // Si dejara de salir sin que nadie actualice `EN_EL_PAPEL`, este test pasaría a ser cierto sobre
  // un conjunto vacío y no volvería a proteger nada.
  assert.equal(impresas.length, declarados,
    `🔴 EL PAPEL DEL CLIENTE TRAE ${impresas.length} MARCADOR(ES) Y HAY ${declarados} DECLARADO(S):\n    ` +
    impresas.join('\n    ') +
    '\n\n  Éstos son los caros: no los ve el profesional, los ve SU CLIENTE.\n' +
    `  Declarados hoy: ${Object.entries(EN_EL_PAPEL).map(([k, v]) => `${k} (${v})`).join(', ')}.\n` +
    '  Si SOBRAN, un texto sin aprobar se está imprimiendo en un documento fiscal.\n' +
    '  Si FALTAN, alguien lo apagó y hay que retirarlo de `EN_EL_PAPEL` en ese mismo commit.');
});

// ═══ ③ CONTROLES NEGATIVOS DEL PROPIO CENSO ══════════════════════════════════════════════
//
// Si el censo contara comentarios o tests, este guard sería ruidoso y acabaría desactivado — que
// es como muere un guard. Se comprueba sobre el árbol REAL, no sobre un corpus: hay marcadores en
// comentarios de verdad y el censo tiene que seguir sin verlos.

test('SCRUM-667 · 🔴 NEGATIVO: un marcador en un COMENTARIO no cuenta', () => {
  const censados = new Set(censar(RAIZ).marcas.map((m) => m.fichero));

  // `api.js` menciona la marca dentro de un comentario y NO declara ninguna. Se comprueban las dos
  // mitades para que la negación signifique algo: que el texto está, y que el censo no lo cuenta.
  const rel = 'public/dashboard/js/api.js';
  const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  assert.ok(fuente.includes('PENDIENTE microcopy oficial'),
    `🔴 ${rel} ya no menciona la marca en un comentario: este control estaría pasando por vacío. ` +
    'Busca otro fichero que sí la mencione y cámbialo aquí.');
  assert.ok(!censados.has(rel),
    `🔴 el censo cuenta un marcador que sólo vive en un COMENTARIO de ${rel}. Un guard que acusa ` +
    'por un comentario es ruidoso, y un guard ruidoso acaba desactivado.');
});

test('SCRUM-667 · 🔴 NEGATIVO: los ficheros de tests NO entran en el censo', () => {
  const censados = censar(RAIZ).marcas.map((m) => m.fichero);
  const deTests = censados.filter((f) => f.startsWith('tests/'));
  assert.deepEqual(deTests, [],
    '🔴 el censo está contando marcadores de `tests/`:\n    ' + deTests.join('\n    ') +
    '\n\n  Los tests NOMBRAN la marca para comprobarla — este fichero mismo lo hace. Contarlos ' +
    'haría subir el censo cada vez que alguien escribe un guard, que es lo contrario de lo que se ' +
    'quiere.');

  // Y el suelo del negativo: que este fichero, que menciona la marca, exista y la mencione.
  const yo = fs.readFileSync(path.join(RAIZ, 'tests/scrum667-marcador-visible.test.mjs'), 'utf8');
  assert.ok(yo.includes('PENDIENTE microcopy oficial') || yo.includes(MARCA),
    '🔴 este mismo test ya no menciona la marca: el negativo de arriba sería cierto por vacío.');
});

// ═══ ④ LO QUE SE CERRÓ HOY, FIJADO ═══════════════════════════════════════════════════════

test('SCRUM-667 · los tres textos del catálogo están APROBADOS y sin marcador', () => {
  // El control positivo del censo era esta semilla: se censó CON ellos puestos (aparecían), y sólo
  // entonces se retiraron. Al revés no habría habido con qué comprobar el instrumento.
  const rel = 'public/dashboard/js/switchTipoArticulo.js';
  const censados = new Set(censar(RAIZ).marcas.map((m) => m.fichero));
  assert.ok(!censados.has(rel),
    `🔴 ha vuelto un marcador a ${rel}. Sus tres textos están aprobados desde el 2-sep-2026.`);

  const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  // El texto APROBADO, literal. No se abrevia, no se reordena, no se le añade puntuación (regla 30).
  assert.match(src, /leyenda\.textContent = 'Esto es';/);
  assert.match(src, /ETIQUETA = \{ PRODUCTO: 'Producto', SERVICIO: 'Servicio' \}/);
});
