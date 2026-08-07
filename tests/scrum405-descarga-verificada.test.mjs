// tests/scrum405-descarga-verificada.test.mjs — SCRUM-405
//
// ESTO NO ARREGLA TRES SITIOS: QUITA LA FORMA DE EN MEDIO.
//
// Tres descargas comprobaban `res.ok` y llamaban a `res.blob()` sin mirar nada más. Un portal
// cautivo —la wifi de cortesía de una obra— responde **200 con el HTML de su login**, así que el
// profesional se guardaba la pantalla de acceso de un router creyendo que llevaba sus datos.
//
// Los tres eran el mismo código copiado, y **el tercero se escribió en SCRUM-325 imitando a los dos
// anteriores**. Ése es el dato que define el alcance: si se arreglan los tres y la forma sigue
// siendo copiable, **el cuarto nace mal**. Por eso el trabajo de este fichero no es comprobar que
// los tres estén bien — es que **no se pueda escribir un cuarto por fuera**.
//
// ⚠️ HASTA DÓNDE LLEGA, declarado: detectar un portal cautivo CON CERTEZA no se puede desde el
// navegador, y `descargarBinario` no lo intenta. Un portal que devolviera `200` con
// `Content-Type: application/zip` y basura dentro pasaría. Lo que sí se garantiza: **no entregar
// como fichero algo que evidentemente no lo es**.
//
// 🔴 Y NO se usa `navigator.onLine` en ninguna parte: miente exactamente en este escenario (el
// móvil está conectadísimo… al router del bar) y hoy tiene CERO usos en el árbol (SCRUM-356).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');
const FORMA_COMUN = 'api.js';

/** Las descargas conocidas. Si alguna deja de estar, el suelo lo dice (R5). */
const DESCARGAS_CONOCIDAS = [
  '/admin/exports/portabilidad.zip',
  '/admin/exports/datos.zip',
  '/admin/libros/expedidas.csv',
];

/**
 * 🔴 LA ÚNICA EXCEPCIÓN, con su motivo y su RECUENTO — la forma de SCRUM-368: una excepción que no
 * dice cuántos nodos ampara es un permiso abierto, y si gana o pierde uno hay que enterarse.
 *
 * `settingsView.js` NO descarga: pinta el QR del perfil en un `<img src=blob:…>`. Con un portal
 * cautivo eso se ve como una imagen rota —visible e inofensivo—, no como un fichero corrupto
 * guardado en el móvil del profesional. Es otra cosa y no cabe en `descargarBinario`, que existe
 * para ENTREGAR ficheros.
 *
 * ⚠️ Si algún día ese `.blob()` acaba en un `<a download>`, esta excepción deja de valer.
 */
const EXCEPCIONES = Object.freeze({ 'settingsView.js': 1 });

/** Llamadas a `.blob()` en un fichero, con su línea. Por AST: un comentario no es una llamada. */
function llamadasBlob(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'blob') {
      out.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

const leer = (f) => fs.readFileSync(path.join(DIR_JS, f), 'utf8');
const exportViewSrc = () => leer('exportView.js');
const vistas = () => fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'));

// ── R5 · SUELO ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-405 · R5 · SUELO: se encuentran la forma común y las TRES descargas conocidas', () => {
  // «Cero descargas por fuera» y «no supe mirar» dan el mismo verde. Si el escáner se queda ciego
  // —porque la vista se renombre, o porque `descargarBinario` cambie de sitio— este fichero
  // pasaría para siempre sobre un producto que volvió a copiar la forma mala.
  const api = leer(FORMA_COMUN);
  assert.match(api, /async function descargarBinario\(/,
    `🔴 ESCÁNER CIEGO: no encuentro \`descargarBinario\` en ${FORMA_COMUN}. Si se movió o se ` +
    'renombró, el guard de abajo dejaría de tener referencia y todo saldría verde. ARREGLA EL ' +
    'ESCÁNER, no el número.');

  const exportView = leer('exportView.js');
  const perdidas = DESCARGAS_CONOCIDAS.filter((u) => !exportView.includes(u));
  assert.deepEqual(perdidas, [],
    `🔴 ESCÁNER CIEGO: no encuentro estas descargas conocidas: ${perdidas.join(', ')}. O se ` +
    'movieron a otra vista —y entonces hay que censarla— o desaparecieron. En los dos casos este ' +
    'fichero deja de vigilar lo que cree.');

  assert.ok(vistas().length >= 20, `🔴 ESCÁNER CIEGO: solo veo ${vistas().length} vistas en ${DIR_JS}`);
});

// ── R3/R4 · EL GUARD DEL CUARTO ──────────────────────────────────────────────────────────────

test('SCRUM-405 · 🔴 R3: NADIE llama a `.blob()` fuera de la forma común', () => {
  // El corazón del ticket. No se prohíbe descargar: se prohíbe descargar POR FUERA.
  const fuera = [];
  const porFichero = {};
  for (const f of vistas()) {
    if (f === FORMA_COMUN) continue;
    const lineas = llamadasBlob(leer(f), f);
    if (lineas.length) porFichero[f] = lineas.length;
    const amparadas = EXCEPCIONES[f] ?? 0;
    // Se amparan las N declaradas; la N+1 del mismo fichero cae igual.
    for (const linea of lineas.slice(amparadas)) fuera.push(`${f}:${linea}`);
  }

  // Y la excepción CADUCA: si el `.blob()` amparado desaparece, hay que borrarla de la lista. Una
  // excepción que sobrevive a su causa deja de ser una nota y pasa a ser un permiso (SCRUM-368).
  const caducadas = Object.entries(EXCEPCIONES)
    .filter(([f, n]) => (porFichero[f] ?? 0) < n)
    .map(([f, n]) => `${f}: declaradas ${n}, quedan ${porFichero[f] ?? 0}`);
  assert.deepEqual(caducadas, [],
    `🔴 hay excepciones que ya no amparan nada:\n    ${caducadas.join('\n    ')}\n\n` +
    '  Bórralas de `EXCEPCIONES`.');

  assert.deepEqual(fuera, [],
    `🔴 HAY DESCARGAS QUE NO PASAN POR LA FORMA COMÚN:\n    ${fuera.join('\n    ')}\n\n` +
    `  Un \`.blob()\` suelto entrega al profesional lo que venga en la respuesta, sin comprobar que\n` +
    '  sea un fichero. Con un portal cautivo eso es la página de login de un router guardada como\n' +
    '  si fueran sus datos.\n\n' +
    `  Usa \`descargarBinario(url, { tipoEsperado, nombrePorDefecto })\` de \`${FORMA_COMUN}\`. Si tu\n` +
    '  caso no cabe en ella, AMPLÍALA — no la esquives: esa es exactamente la copia que este guard\n' +
    '  existe para impedir (el tercer sitio nació así, imitando a los dos anteriores).');
});

test('SCRUM-405 · 🔴 R4: una descarga que SÍ pasa por la forma común NO lo pone rojo', () => {
  // Sin esto, el guard vigilaría la palabra `blob` y acabaría desactivado por molesto. Se comprueba
  // sobre el fichero REAL: las tres descargas de exportView pasan por la forma y ese fichero no
  // tiene ni un `.blob()`.
  assert.deepEqual(llamadasBlob(leer('exportView.js'), 'exportView.js'), [],
    '🔴 exportView.js todavía llama a `.blob()` por su cuenta: las tres descargas no están pasando ' +
    'por la forma común.');

  // Y la prueba de que van por la forma: en esa vista NO queda ni un `await fetch(`. Es más
  // robusto que mirar una ventana de caracteres alrededor de la URL —la llamada puede partirse en
  // varias líneas— y dice exactamente lo que importa: ahí ya no se pide nada a pelo.
  assert.doesNotMatch(exportViewSrc(), /await fetch\(/,
    '🔴 exportView.js todavía tiene un `await fetch(` suelto: alguna descarga no pasa por la forma ' +
    'común.');
  const sinPasar = DESCARGAS_CONOCIDAS.filter((u) => !exportViewSrc().includes(`descargarBinario(`) || !exportViewSrc().includes(u));
  assert.deepEqual(sinPasar, [],
    `🔴 estas descargas no van por \`descargarBinario\`: ${sinPasar.join(', ')}`);

  // Y el CONTROL que impide que este test pase por ceguera: un `.blob()` sintético SÍ se detecta.
  assert.deepEqual(llamadasBlob('const b = await res.blob();\n', 'x.js'), [1],
    '🔴 el detector no ve un `.blob()` evidente: R3 sería un verde vacío.');
});

// ── R1 · LA COMPROBACIÓN, EJERCITADA DE VERDAD ───────────────────────────────────────────────
//
// `descargarBinario` toca el DOM (crea un <a> y lo pulsa), así que se ejercita con un `fetch` y un
// `document` falsos. Lo que se prueba es la DECISIÓN —entregar o no entregar—, que es lo que
// distingue este ticket, no el cableado del <a>.

/** Carga `descargarBinario` con un entorno de navegador mínimo y controlado. */
function cargarDescargarBinario({ status = 200, headers = {}, cuerpo = 'x' }) {
  const codigo = leer(FORMA_COMUN);
  const inicio = codigo.indexOf('const ERROR_NO_ES_FICHERO');
  const fin = codigo.indexOf('// -------- UI helpers compartidos');
  assert.ok(inicio > 0 && fin > inicio,
    '🔴 ESCÁNER CIEGO: no encuentro el bloque de `descargarBinario` en api.js para ejercitarlo.');
  const fuente = codigo.slice(inicio, fin);

  const descargas = [];
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const ctx = {
    fetch: async () => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k) => h.get(String(k).toLowerCase()) ?? null },
      blob: async () => cuerpo,
    }),
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
    document: {
      createElement: () => ({ click() { descargas.push(this.download); }, remove() {} }),
      body: { appendChild: () => {} },
    },
    setTimeout: () => {},
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('fetch', 'URL', 'document', 'setTimeout', `${fuente}\nreturn descargarBinario;`);
  return { descargar: fn(ctx.fetch, ctx.URL, ctx.document, ctx.setTimeout), descargas };
}

test('SCRUM-405 · 🔴 R1: un 200 con `text/html` (portal cautivo) NO produce descarga', () => {
  const { descargar, descargas } = cargarDescargarBinario({
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    cuerpo: '<html><body><h1>Conéctate a la wifi</h1></body></html>',
  });

  return descargar('/admin/exports/datos.zip', { tipoEsperado: 'zip', nombrePorDefecto: 'x.zip' }).then(
    () => assert.fail(
      '🔴 UN 200 CON HTML SE HA ENTREGADO COMO FICHERO. Es el defecto entero: el profesional se ' +
      'guarda la página de login del router creyendo que son sus datos.'),
    (e) => {
      assert.equal(e.code, 'respuesta_no_es_fichero',
        `🔴 falla, pero no NOMBRA lo que pasó (code=${e.code}). Sin código, la vista no puede decirle ` +
        'al profesional que el problema es la red y no él.');
      assert.match(e.message, /text\/html/, '🔴 el error no dice qué llegó en su lugar');
      assert.deepEqual(descargas, [], '🔴 se ha pulsado el <a>: se descargó algo igualmente');
    },
  );
});

test('SCRUM-405 · 🔴 R2 · CONTROL POSITIVO: las tres descargas legítimas siguen funcionando', () => {
  // Una por una, con su tipo y su nombre. Probar solo el bloqueo no demuestra que no se haya
  // bloqueado todo.
  const casos = [
    { nombre: 'portabilidad.zip', tipo: 'application/zip', esperado: 'zip', cd: 'attachment; filename="portabilidad-2026-08-07.zip"' },
    { nombre: 'datos.zip', tipo: 'application/zip', esperado: 'zip', cd: 'attachment; filename="yaqu-datos-INCOMPLETO-2026-08-07.zip"' },
    { nombre: 'expedidas.csv', tipo: 'text/csv; charset=utf-8', esperado: 'csv', cd: 'attachment; filename="yaqu-emitidas-2026-T3.csv"' },
  ];
  return Promise.all(casos.map(async (c) => {
    const { descargar, descargas } = cargarDescargarBinario({
      status: 200,
      headers: { 'content-type': c.tipo, 'content-disposition': c.cd },
      cuerpo: 'contenido',
    });
    const { nombre } = await descargar('/x', { tipoEsperado: c.esperado, nombrePorDefecto: 'por-defecto' });
    const esperado = /filename="([^"]+)"/.exec(c.cd)[1];
    assert.equal(nombre, esperado, `🔴 ${c.nombre}: el nombre del servidor no llega al fichero`);
    assert.deepEqual(descargas, [esperado], `🔴 ${c.nombre}: no se ha entregado el fichero`);
  }));
});

test('SCRUM-405 · el nombre por defecto solo entra si el servidor NO manda uno', () => {
  const { descargar } = cargarDescargarBinario({
    status: 200, headers: { 'content-type': 'application/zip' }, cuerpo: 'x',
  });
  return descargar('/x', { tipoEsperado: 'zip', nombrePorDefecto: 'de-reserva.zip' })
    .then(({ nombre }) => assert.equal(nombre, 'de-reserva.zip'));
});
