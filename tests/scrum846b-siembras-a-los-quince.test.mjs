// tests/scrum846b-siembras-a-los-quince.test.mjs — SCRUM-846b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LOS QUINCE INSTRUMENTOS QUE DABAN UN CERO SIN NINGÚN CASO CONOCIDO DELANTE.
//
// Cada uno recibe aquí una entrada FABRICADA con respuesta sabida en las DOS direcciones: una que
// tiene que dar como SÍ y otra que tiene que dar como NO. Sin la mitad negativa, un instrumento
// que dijera «sí» a todo pasaría; sin la positiva, uno ciego.
//
//     🔒 «Un cero sin ningún caso conocido delante no se puede juzgar.»
//
// 🔴 Y CADA SIEMBRA SE HA VISTO CAER. Una siembra que no has visto fallar no cuenta, así que cada
// instrumento se rompió a propósito en los dos sentidos —«dice que sí a todo» y «dice que no a
// todo»— y su siembra se puso roja. Las roturas no se describen: se REPITEN con
// `node scripts/verificacion-s5/romper-los-quince.mjs`, que rompe, corre, restaura y comprueba que
// el fichero ha vuelto byte a byte.
//
// ── EL ORDEN ES EL DE LO QUE GOBIERNAN, leído en cada instrumento y no en su nombre ─────────
//   tenencia · camino fiscal · barrera de producción · secretos · documento con importes ·
//   veredicto de los guards · privacidad · promesas públicas · corrección · resiliencia · UI.
// Dos viven en su propio fichero porque su instrumento está DENTRO de un `.test.mjs` —importarlo
// desde aquí volvería a registrar todos sus tests—: `scrum245` (tenencia) y `scrum746` (barrera).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { censoCopy } from './_censo-copy-vs-flag.mjs';
import { censarEstrechamientos } from './_censo-estrechamientos-linea.mjs';
import { censoNewUrl } from './_censo-new-url.mjs';
import {
  censarPuertasDelPresupuesto, puertasSinLosCampos, FUENTES_PRESUPUESTO, RUTA_CONSTRUCTOR,
} from './_puertas-del-presupuesto.mjs';
import { clasificarEvento, veredictoDelCenso } from '../scripts/censo-guards-gateados.mjs';
import { censarAlmacenamiento, censarEnlacesAlRegistro } from './_censo-almacenamiento-publico.mjs';
import { censoDeBodies, FORMAS } from './_censo-body-apirequest.mjs';
import { censarPeticiones } from './_censo-peticiones-panel.mjs';
import { inventario } from './_inventario-detalle-trabajo.mjs';
import { censarSuperficies } from './_censo-superficies-configuracion.mjs';
import { censarUsosDeBoton } from './_censo-clases-de-boton.mjs';

const NL = String.fromCharCode(10);
const creados = [];

/** Un árbol de mentira en un directorio temporal. Se borran todos al acabar el fichero. */
function arbolDeMentira(ficheros) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum846b-'));
  creados.push(raiz);
  for (const [rel, texto] of Object.entries(ficheros)) {
    const abs = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, texto);
  }
  return raiz;
}
after(() => { for (const r of creados) fs.rmSync(r, { recursive: true, force: true }); });

// ═══ 2 · CAMINO FISCAL · `_censo-copy-vs-flag` ═══════════════════════════════════════════════
// Decide si un rótulo con «factura» lo ELIGE `INVOICING_ES_ENABLED` o está clavado. Un rótulo
// clavado es un claim fiscal que sale igual con el flag apagado (regla 7).

test('SCRUM-846b · siembra:copy-vs-flag · VE un rótulo elegido por el flag y NO se lo atribuye a uno clavado', () => {
  const raiz = arbolDeMentira({
    'public/js/documento.js': [
      'const INVOICING_ES_ENABLED = window.appFlags.invoicing;',
      "boton.textContent = INVOICING_ES_ENABLED ? 'Emitir factura' : 'Emitir justificante';",
      "enlace.textContent = 'Descargar factura';",
      '// una factura nombrada en un comentario no es copy',
    ].join(NL),
  });
  const { visibles } = censoCopy(raiz, new Map());
  const de = (texto) => visibles.filter((v) => v.texto === texto);

  assert.equal(de('Emitir factura').length, 1,
    `🔴 CIEGO: no ve un rótulo visible con «factura». Vio: ${visibles.map((v) => v.texto).join(' | ')}`);
  assert.equal(de('Emitir factura')[0].dependeDelFlag, true,
    '🔴 un ternario sobre INVOICING_ES_ENABLED elige el texto y el censo no lo ve: todo copy fiscal '
    + 'gateado parecería clavado.');

  assert.equal(de('Descargar factura').length, 1, '🔴 no ve el rótulo escrito a pelo');
  assert.equal(de('Descargar factura')[0].dependeDelFlag, false,
    '🔴 atribuye al flag un rótulo que nada condiciona: taparía justo el claim clavado que este censo busca.');
  assert.equal(visibles.length, 3,
    `🔴 esperaba 3 literales visibles —los dos del ternario y el suelto—, no el comentario; cuenta ${visibles.length}`);
});

// ═══ 3 · FISCAL / DINERO · `_censo-estrechamientos-linea` ════════════════════════════════════
// Decide dónde una línea de factura se rehace con {concept, qty, price, tax} y pierde lo demás.

test('SCRUM-846b · siembra:estrechamientos · VE una línea rehecha con las cuatro claves y NO acusa a la que conserva', () => {
  const raiz = arbolDeMentira({
    'src/modules/inventado/lineas.ts': [
      'export const estrecha = (l: any) => ({ concept: l.concept, qty: l.qty, price: l.price, tax: l.tax });',
      'export const conserva = (l: any) => ({ ...l, concept: l.concept, qty: l.qty, price: l.price, tax: l.tax });',
      'export const incompleta = (l: any) => ({ concept: l.concept, qty: l.qty });',
      'export const otraCosa = (c: any) => ({ nombre: c.nombre, qty: c.qty, price: c.price, tax: c.tax });',
    ].join(NL),
  });
  const r = censarEstrechamientos(raiz);

  assert.deepEqual(r.estrechamientos.map((e) => [e.ruta, e.linea]), [['src/modules/inventado/lineas.ts', 1]],
    '🔴 esperaba UN estrechamiento, el de la línea 1. Si no lo ve, su cero sobre `src/` no dice que '
    + 'ninguna línea pierda datos; si ve más, acusa al spread de la rectificativa, que conserva todo.');
  assert.equal(r.conForma, 3, `🔴 con forma de línea (llevan «concept») hay 3; cuenta ${r.conForma}`);
  assert.equal(r.ficheros, 1);
});

// ═══ 5 · SECRETOS · `_censo-new-url` ═════════════════════════════════════════════════════════
// Decide si el error de un `new URL()` —que lleva la cadena de conexión entera en `e.input`— es
// alcanzable. Una credencial de producción ya se filtró así.

test('SCRUM-846b · siembra:new-url · VE un error de URL alcanzable y NO acusa al catch ciego', () => {
  const raiz = arbolDeMentira({
    'scripts/alcanzable.mjs': 'try { new URL(process.env.DATABASE_URL); } catch (e) { console.log("no se pudo"); }',
    'scripts/ciego.mjs': 'try { new URL(process.env.DATABASE_URL); } catch { process.exitCode = 1; }',
    'scripts/sin-try.mjs': 'const u = new URL(process.env.DATABASE_URL);',
    'scripts/no-es-mjs.txt': 'new URL(process.env.DATABASE_URL)',
  });
  const h = censoNewUrl(raiz);
  const de = (f) => h.find((x) => x.fichero === f);

  assert.equal(h.length, 3, `🔴 esperaba 3 \`new URL\` en los .mjs; cuenta ${h.length}`);
  assert.deepEqual([de('alcanzable.mjs')?.proteccion, de('alcanzable.mjs')?.seguro], ['catch-con-binding', false],
    '🔴 un `catch (e)` deja el error a un `console.error(e)` de publicar la cadena, y el censo lo da por seguro.');
  assert.deepEqual([de('sin-try.mjs')?.proteccion, de('sin-try.mjs')?.seguro], ['sin-try', false]);

  assert.deepEqual([de('ciego.mjs')?.proteccion, de('ciego.mjs')?.seguro], ['catch-ciego', true],
    '🔴 acusa a un `catch {` sin binding, que hace el error inalcanzable por construcción.');
});

// ═══ 6 · DOCUMENTO CON IMPORTES · `_puertas-del-presupuesto` ═════════════════════════════════
// Decide qué campos lleva cada puerta que genera el PDF del presupuesto que ve el cliente.

test('SCRUM-846b · siembra:puertas · VE los campos de las dos formas de puerta y NO calla la que no los lleva', () => {
  const constructor = 'export function paramsDePresupuestoParaPdf(q: any) { return { total: q.total, direccionObra: q.obra }; }';
  const fuentes = {
    [FUENTES_PRESUPUESTO[0]]: "export const r = () => generateQuotePdf({ total: 1, direccionObra: 'Calle Inventada 1' });",
    [FUENTES_PRESUPUESTO[1]]: 'export const r = (q: any) => generateQuotePdf(paramsDePresupuestoParaPdf(q));',
    [RUTA_CONSTRUCTOR]: constructor,
  };
  const puertas = censarPuertasDelPresupuesto(fuentes);

  assert.deepEqual(puertas.map((p) => p.forma), ['literal', 'constructor'],
    `🔴 esperaba una puerta literal y una que delega en el constructor; vio: ${puertas.map((p) => p.forma).join(', ')}`);
  assert.ok(puertas.every((p) => p.props.has('direccionObra')),
    '🔴 las dos puertas llevan `direccionObra` —una escrita, otra heredada del constructor— y no la ve.');
  assert.deepEqual(puertasSinLosCampos(['total', 'direccionObra'], fuentes), [],
    '🔴 acusa de no llevar un campo a una puerta que sí lo lleva.');

  const sinDireccion = {
    [FUENTES_PRESUPUESTO[0]]: 'export const r = () => generateQuotePdf({ total: 1 });',
    [FUENTES_PRESUPUESTO[1]]: 'export const r = (q: any) => generateQuotePdf(paramsDePresupuestoParaPdf(q));',
    [RUTA_CONSTRUCTOR]: constructor,
  };
  assert.deepEqual(puertasSinLosCampos(['direccionObra'], sinDireccion),
    [`${FUENTES_PRESUPUESTO[0]}:1 no conoce: direccionObra`],
    '🔴 una puerta que NO lleva la dirección de la obra no sale acusada: el PDF saldría sin ella y en verde.');
});

// ═══ 7 · VEREDICTO DE LOS GUARDS · `scripts/censo-guards-gateados.mjs` ═══════════════════════
// Decide si un test SALTADO se cuenta como uno que corrió. `node:test` emite `test:pass` para los
// dos; confundirlos es emitir un veredicto sobre un guard que no se ha mirado.

test('SCRUM-846b · siembra:gateados · VE un test saltado y NO confunde con él a uno que corrió', () => {
  assert.equal(clasificarEvento({ type: 'test:pass', data: { name: 'gateado', skip: 'sin QA_DB_TEST' } }), 'saltado',
    '🔴 un `test:pass` con `skip` puesto no sale «saltado»: el meta-guard volvería a juzgar tests que no corrieron.');

  assert.equal(clasificarEvento({ type: 'test:pass', data: { name: 'corrió' } }), 'real',
    '🔴 un test que corrió sale «saltado»: todos los guards parecerían gateados.');
  assert.equal(clasificarEvento({ type: 'test:fail', data: { name: 'cayó' } }), 'caido');
  assert.equal(clasificarEvento({ type: 'test:diagnostic', data: { message: 'tests 1' } }), null);

  const v = veredictoDelCenso(
    new Map([['gateado.test.mjs', { reales: 0, saltados: 3 }], ['mixto.test.mjs', { reales: 2, saltados: 1 }]]),
    new Set(['gateado.test.mjs']),
  );
  assert.deepEqual([v.ok, v.gateados.map((g) => g.fichero), v.expuestos.map((g) => g.fichero)],
    [true, ['gateado.test.mjs'], ['gateado.test.mjs']],
    '🔴 un fichero con un test real y uno saltado NO es gateado; uno con todos saltados SÍ.');
});

// ═══ 8 · PRIVACIDAD · `_censo-almacenamiento-publico` ════════════════════════════════════════
// Decide qué se guarda en el navegador de quien sólo ha visitado la landing, y qué enlaces al
// registro tienen que llevar la atribución.

test('SCRUM-846b · siembra:almacenamiento · VE lo que la landing guarda y enlaza, y NO lo del panel ni lo comentado', () => {
  const raiz = arbolDeMentira({
    'public/index.html': [
      '<!doctype html><html><body>',
      '<a href="/register.html?origen=landing">Empieza gratis</a>',
      '<script>',
      "  // localStorage.setItem('comentario', '1') ya no se usa",
      "  localStorage.setItem('recuerdame', '1');",
      '</script>',
      '</body></html>',
    ].join(NL),
    'public/dashboard/js/panel.js': [
      "localStorage.setItem('vista', 'lista');",
      "const destino = '/register.html';",
    ].join(NL),
  });
  const pub = path.join(raiz, 'public');
  const accesos = censarAlmacenamiento(pub, raiz);

  assert.deepEqual(
    accesos.filter((a) => !a.enElPanel).map((a) => [a.fichero, a.clave, a.escribe]),
    [['public/index.html', 'recuerdame', true]],
    '🔴 esperaba UNA escritura en la superficie pública —la de `recuerdame`—, no la comentada.');
  assert.deepEqual(
    accesos.filter((a) => a.enElPanel).map((a) => [a.fichero, a.clave]),
    [['public/dashboard/js/panel.js', 'vista']],
    '🔴 lo que guarda el PANEL tiene que salir marcado como del panel: es otra conversación, no la landing.');

  assert.deepEqual(censarEnlacesAlRegistro(pub, raiz).map((e) => [e.fichero, e.destino]),
    [['public/index.html', '/register.html?origen=landing']],
    '🔴 esperaba el enlace de la landing y NO el del panel.');
});

// ═══ 10 · CORRECCIÓN · `_censo-body-apirequest` ══════════════════════════════════════════════
// Decide qué forma tiene el `body` de cada `apiRequest`: un objeto viaja como «[object Object]».

test('SCRUM-846b · siembra:body · VE las tres formas de body y NO cuenta un fetch ni un comentario', () => {
  const raiz = arbolDeMentira({
    'public/dashboard/js/guardar.js': [
      "apiRequest('/a', { method: 'POST', body: { nombre: 'x' } });",
      "apiRequest('/b', { method: 'POST', body: JSON.stringify({ nombre: 'x' }) });",
      "apiRequest('/c', { method: 'POST', body: datos });",
      "fetch('/d', { method: 'POST', body: { nombre: 'x' } });",
      "// apiRequest('/e', { body: { comentado: true } });",
    ].join(NL),
  });
  const r = censoDeBodies(raiz);

  assert.deepEqual(r.llamadas.map((l) => [l.linea, l.forma]),
    [[1, FORMAS.OBJETO], [2, FORMAS.STRINGIFY], [3, FORMAS.OTRA]],
    '🔴 esperaba objeto, stringify y otra, en ese orden: si confunde una con otra, el arreglo que decide es el equivocado.');
  assert.equal(r.total, 3, '🔴 cuenta el body de un `fetch` o de una llamada comentada');
  assert.equal(censoDeBodies(arbolDeMentira({ 'src/x.ts': 'export {};' })).sinPublic, true,
    '🔴 sin `public/` tiene que DECIRLO, no devolver un cero que parezca «todo bien».');
});

// ═══ 11 · RESILIENCIA · `_censo-peticiones-panel` ════════════════════════════════════════════
// Decide qué peticiones del panel se saltan `apiRequest`, que es donde vive el plazo de red.

test('SCRUM-846b · siembra:peticiones · VE un fetch a pelo y NO acusa al del camino común', () => {
  const raiz = arbolDeMentira({
    'public/dashboard/js/api.js': 'export function apiRequest(url, o) { return fetch(url, o); }',
    'public/dashboard/js/vista.js': ["apiRequest('/x', { method: 'DELETE' });", "fetch('/y');"].join(NL),
  });
  const r = censarPeticiones(raiz);

  assert.deepEqual(r.fetchCrudo, [{ fichero: 'public/dashboard/js/vista.js', linea: 2 }],
    '🔴 esperaba UN fetch a pelo, el de vista.js:2 —el de api.js ES el camino común—.');
  assert.deepEqual([r.leidos, r.apiRequest.length], [2, 1]);
});

// ═══ 12 · UI · `_inventario-detalle-trabajo` ═════════════════════════════════════════════════
// Decide qué acciones ofrece el detalle del trabajo, para que un reorden no pierda ninguna.

test('SCRUM-846b · siembra:inventario · VE las acciones de un DOM fabricado y NO cuenta lo que no se pulsa', () => {
  const nodo = (tagName, attrs, hijos, textContent) => ({
    tagName, hijos, textContent, getAttribute: (a) => (a in attrs ? attrs[a] : null),
  });
  const pantalla = nodo('DIV', { id: 'detalle' }, [
    nodo('BUTTON', { 'data-accion': 'cerrar-trabajo' }, [], 'Cerrar'),
    nodo('SPAN', { 'data-accion': 'decorativo' }, [], 'Adorno'),
    nodo('A', {}, [], 'Ver parte'),
    nodo('INPUT', { type: 'date', name: 'fecha-agenda' }, [], ''),
  ], '');

  assert.deepEqual(inventario(pantalla), ['A:Ver parte', 'data-accion=cerrar-trabajo', 'name=fecha-agenda'],
    '🔴 esperaba las tres acciones —botón, enlace y fecha—, cada una por su gancho, y NO el span decorativo.');
  assert.throws(() => inventario(nodo('DIV', {}, [nodo('SPAN', { 'data-accion': 'x' }, [], 'texto')], '')),
    (e) => e.message.includes('SUELO'),
    '🔴 un árbol sin nada que pulsar tiene que CAER por su suelo, no devolver una lista vacía comparable.');
});

// ═══ 13 · UI · `_censo-superficies-configuracion` ════════════════════════════════════════════
// Decide qué bloques de Configuración son una superficie con título propio.

test('SCRUM-846b · siembra:superficies · VE un bloque con contenedor y título y NO los que no cumplen las dos cosas', () => {
  const fuente = [
    'function renderPaginaPublica(container) { container.innerHTML = `<h2>Tu página pública</h2><p>x</p>`; }',
    'function renderSinContenedor(el) { el.innerHTML = `<h2>Sin contenedor</h2>`; }',
    'function renderSinTitulo(container) { container.innerHTML = `<p>Solo un párrafo</p>`; }',
    'function pintarOtraCosa(container) { container.innerHTML = `<h2>No empieza por render</h2>`; }',
  ].join(NL);
  const r = censarSuperficies(fuente, 'inventado.js');

  assert.deepEqual(r.superficies.map((s) => [s.clave, s.titulo]), [['renderPaginaPublica', 'Tu página pública']],
    '🔴 esperaba UNA superficie: la única que recibe `container` Y abre un <h2>.');
  assert.equal(r.funcionesRender, 3, `🔴 hay tres funciones render…; cuenta ${r.funcionesRender}`);
});

// ═══ 15 · UI, LA ÚLTIMA · `_censo-clases-de-boton` ═══════════════════════════════════════════
// Decide qué sitios escriben una variante de botón sin la base `btn`, que es la que lleva los 44 px.

test('SCRUM-846b · siembra:botones · VE una variante sin la base y NO acusa a la que la lleva', () => {
  const fuentes = [{
    ruta: 'inventado.html',
    texto: '<button class="btn-primary">Guardar</button><button class="btn btn-secondary">Cancelar</button><div class="card">No es botón</div>',
  }];
  const r = censarUsosDeBoton(fuentes, ['btn-primary', 'btn-secondary']);

  assert.deepEqual(r.sinBase.map((c) => c.variantes), [['btn-primary']],
    '🔴 esperaba UN sitio sin la base: el `btn-primary` suelto.');
  assert.deepEqual(r.conBase.map((c) => c.variantes), [['btn-secondary']],
    '🔴 el `btn btn-secondary` lleva la base y no puede salir acusado.');
  assert.equal(r.conjuntos.length, 2, '🔴 la `card` no es un botón');
});

// ═══ 9 · PROMESAS PÚBLICAS · `scripts/_texto-fuera-del-censo.mjs` ═══════════════════════════
// Decide qué frases de la columna de YaQu en `#comparativa` prometen una capacidad y cuáles se le
// escapan al detector. El registro de anclas es el de verdad y cambia, así que el caso es
// DIFERENCIAL: se mide la diferencia que produce UNA celda fabricada, no un total.

test('SCRUM-846b · siembra:texto-fuera · VE una promesa de YaQu, cuenta la que se escapa y NO acusa a la de otra columna', async () => {
  const { medirDetector } = await import('../scripts/_texto-fuera-del-censo.mjs');
  const celda = (clase, texto) => `<div class="cmp-cell ${clase}"><p>${texto}</p></div>`;
  const seccion = (celdas) => '<section id="comparativa"><div class="cmp-row">'
    + '<p class="cmp-sit">Cuando el cliente dice que sí</p>' + celdas + '</div></section>';

  const base = medirDetector(seccion(celda('cmp-otro', 'Lo apuntas en una libreta')));
  const vista = medirDetector(seccion(celda('cmp-otro', 'Lo apuntas en una libreta') + celda('cmp-yaqu', 'Te paga con tarjeta')));
  const escapada = medirDetector(seccion(celda('cmp-otro', 'Lo apuntas en una libreta') + celda('cmp-yaqu', 'Lo tienes todo en orden')));
  const ajena = medirDetector(seccion(celda('cmp-otro', 'Lo apuntas en una libreta') + celda('cmp-otro', 'Te paga con tarjeta')));

  assert.equal(base.ciego, false, `🔴 CIEGO sobre una #comparativa fabricada: ${base.motivo}`);
  assert.deepEqual([vista.promesas - base.promesas, vista.detectadas - base.detectadas, vista.escapes - base.escapes], [1, 1, 0],
    '🔴 una celda de YaQu que dice «te paga con tarjeta» es UNA promesa y la tiene que detectar.');
  assert.deepEqual([escapada.promesas - base.promesas, escapada.escapes - base.escapes], [1, 1],
    '🔴 una celda de YaQu sin vocabulario de capacidad es una promesa que se le ESCAPA, y tiene que contarla así.');
  assert.ok(escapada.listaEscapes.includes('Lo tienes todo en orden'));

  assert.deepEqual([ajena.promesas - base.promesas, ajena.falsosPositivos - base.falsosPositivos], [0, 1],
    '🔴 la misma frase en la columna de OTRO no es una promesa de YaQu: es un falso positivo del detector.');
  assert.equal(medirDetector('<section id="otra"></section>').ciego, true,
    '🔴 sin #comparativa tiene que declararse CIEGO, no devolver ceros.');
});

// ═══ 14 · UI · `_censo-modal-footer` ═════════════════════════════════════════════════════════
// Decide qué pies de modal hay y cuántos botones y caracteres llevan, que es lo que desborda.

test('SCRUM-846b · siembra:modal-footer · VE un pie de modal con sus botones y NO inventa uno donde no lo hay', async () => {
  const { censarPiesDeModal } = await import('./_censo-modal-footer.mjs');
  const r = censarPiesDeModal([
    {
      ruta: 'inventado.html',
      texto: '<div class="modal ajustes-modal"><div class="modal-footer"><button class="btn btn-primary">Guardar cambios</button><button class="btn">Cancelar</button></div></div>',
    },
    {
      ruta: 'sin-pie.html',
      texto: '<div class="modal"><div class="modal-body"><button class="btn">Hola</button></div></div>',
    },
  ]);

  assert.deepEqual(r.pies.map((p) => [p.fichero, p.nBotones, p.rotuloMasLargo]), [['inventado.html', 2, 'Guardar cambios']],
    '🔴 esperaba UN pie, con sus dos botones, y ninguno en el fichero que sólo tiene `modal-body`.');
  assert.equal(r.ficheros, 2);
});
