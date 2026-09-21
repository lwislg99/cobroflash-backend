// tests/scrum917g-el-trabajo-plegable.test.mjs — SCRUM-917g (corte F del detalle del Trabajo)
//
// «EL TRABAJO», PLEGABLE: lo que dice cada línea CERRADA es una DECISIÓN, y se prueba con datos.
//
// Tipo · Nombre y dirección · Quién lo ejecuta · Notas internas · Gastos eran cinco secciones sueltas y
// ahora son cinco líneas de una tarjeta (`public/dashboard/js/jobTrabajoPlegable.js`). «No tienes
// equipo» y «Sin asignar» no son lo mismo, y «Sin gastos» no es «no he podido leer los gastos»: una
// decisión que viviera dentro de la vista de 3.000 líneas sólo se podría probar montando un navegador.
// Por eso son funciones que devuelven texto, y este fichero las corre con datos.
//
// Lo que ve un navegador —alturas, plegado, foco, dos anchuras— lo mide `scripts/guard-detalle-trabajo-
// 917.mjs` (246 comprobaciones); esto es lo que se puede afirmar SIN navegador.
//
// ── LO QUE ESTE FICHERO NO REPITE, A PROPÓSITO ──────────────────────────────────────────────
// La casilla «Incluir precios en el parte» —que 917g saca de la barra de Documentos— tiene ya su dueño:
// SCRUM-319 (una sola aparición, dentro de `buildAlbEditor`, por AST) y SCRUM-817 (nada en la barra al
// cargar, sobre el árbol montado). Una tercera ancla para lo mismo no es redundancia: es la próxima
// contradicción esperando fecha (A10 de las normas comunes).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { soloEjecutable } from './_guard-texto.mjs';
import { aprobacionesDeMicrocopy, constaAprobado } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const MODULO = 'public/dashboard/js/jobTrabajoPlegable.js';
const {
  TEXTOS_EL_TRABAJO, resumenDeNombre, resumenDeQuien, resumenDeGastos,
  construirLineaPlegable, construirBloqueElTrabajo,
} = createRequire(import.meta.url)(path.join(RAIZ, MODULO));

// ═══ 🔒 LOS TEXTOS: LOS FIRMADOS, Y NINGUNO MÁS ═══════════════════════════════════════════

test('SCRUM-917g · los literales de «El trabajo» son EXACTAMENTE los firmados (15881 y 16142)', () => {
  // La segunda copia de cada literal está AQUÍ a propósito: si `TEXTOS_EL_TRABAJO` cambiara una
  // palabra, este test cae — y la regla 30 dice que un texto que ve el usuario no cambia sin firma.
  assert.deepEqual(TEXTOS_EL_TRABAJO, {
    titulo: 'El trabajo',
    rotuloTipo: 'Tipo de trabajo',
    rotuloDatos: 'Nombre y dirección',
    rotuloQuien: 'Quién lo ejecuta',
    rotuloNotas: 'Notas internas',
    rotuloGastos: 'Gastos de este trabajo',
    sinNombre: 'Sin nombre',
    sinAsignar: 'Sin asignar',
    sinEquipo: 'No tienes equipo',
    notasPrivadas: 'Solo tú las ves',
    sinGastos: 'Sin gastos',
    unGasto: '1 gasto',
    marcadorNombre: 'Por ejemplo: cambio de cuadro en el 3º B',
    ayudaNombre: 'El nombre es lo que verás en la lista. Si lo dejas vacío, se usa el del cliente.',
    marcadorNotas: 'Lo que necesites recordar de este trabajo.',
    altaEquipo: 'Dar de alta a alguien',
  }, '🔴 un literal de «El trabajo» ya no es el firmado. Cambiarlo exige una firma NUEVA (regla 30), no '
    + 'editar este test.');
});

test('SCRUM-917g · cada texto NUEVO consta aprobado, por quien puede aprobarlo, en la ficha de 917g', () => {
  // `constaAprobado` compara por IDENTIDAD (SCRUM-715) y sólo cuenta la firma del fundador o la
  // delegada completa con la delegación vigente (SCRUM-726/861). Los «ya existía» no se piden aquí.
  const nuevos = [
    'El trabajo', 'Nombre y dirección', 'Quién lo ejecuta', 'Sin nombre', 'Sin gastos', 'No tienes equipo',
    'Por ejemplo: cambio de cuadro en el 3º B',
    'El nombre es lo que verás en la lista. Si lo dejas vacío, se usa el del cliente.',
    'Lo que necesites recordar de este trabajo.', 'Dar de alta a alguien',
    '1 gasto', 'N gastos',
  ];
  const ficha = 'docs/microcopy/2026-09-21-SCRUM-917g-el-trabajo-plegable.md';
  for (const t of nuevos) {
    assert.ok(constaAprobado(t).includes(ficha),
      `🔴 «${t}» NO consta aprobado en ${ficha}: o no se firmó, o la ficha no lo lista con su firma completa.`);
  }
  // SUELO: la ficha es una aprobación que CUENTA (firma delegada con referencia + delegación vigente).
  const a = aprobacionesDeMicrocopy().find((x) => x.ruta === ficha);
  assert.ok(a, `🔴 SUELO: el barrido de microcopy no ve ${ficha}.`);
  assert.equal(a.aprobada, true, '🔴 la ficha de 917g no cuenta como aprobación: falta la firma o la referencia.');
  assert.deepEqual(a.delegacion, { referencia: 'SCRUM-917 comentario 15881' },
    '🔴 la firma de la ficha no remite al comentario 15881 de SCRUM-917.');
});

test('SCRUM-917g · la vista NO reescribe los literales: los lee de la fuente única', () => {
  // Un literal duplicado en `jobDetailView.js` es un texto sin firma esperando fecha: el día que uno
  // de los dos cambie, la pantalla dice una cosa y la ficha otra. Se lee sobre CÓDIGO (sin comentarios)
  // — la prosa que explica por qué se retiró un texto lo contiene, por fuerza (SCRUM-203).
  const vista = soloEjecutable(leer('public/dashboard/js/jobDetailView.js'), { almohadillaEsComentario: false });
  assert.ok(vista.includes('TEXTOS_EL_TRABAJO'),
    '🔴 SUELO: la vista ya no lee `TEXTOS_EL_TRABAJO`; sin eso la negación de abajo no mide nada.');
  for (const t of [
    'Nombre y dirección', 'Quién lo ejecuta', 'No tienes equipo', 'Sin gastos', 'Dar de alta a alguien',
    'Por ejemplo: cambio de cuadro', 'Lo que necesites recordar', 'Si lo dejas vacío, se usa el del cliente',
  ]) {
    assert.ok(!vista.includes(t),
      `🔴 la vista escribe «${t}» por su cuenta. Vive UNA vez, en \`TEXTOS_EL_TRABAJO\`, y la vista lo lee.`);
  }
});

// ═══ 🔴 LO QUE DICE CADA LÍNEA CERRADA ════════════════════════════════════════════════════

test('SCRUM-917g · «Nombre y dirección» cerrada: el nombre, o «Sin nombre»', () => {
  assert.equal(resumenDeNombre('Cambio de cuadro'), 'Cambio de cuadro');
  assert.equal(resumenDeNombre('  Cambio de cuadro  '), 'Cambio de cuadro', '🔴 no recorta los espacios');
  for (const vacio of ['', '   ', null, undefined]) {
    assert.equal(resumenDeNombre(vacio), 'Sin nombre', `🔴 un nombre ${JSON.stringify(vacio)} debe decir «Sin nombre»`);
  }
});

test('SCRUM-917g · 🔴 «Quién lo ejecuta» cerrada: TRES cosas que no se mezclan', () => {
  // hay nombres → los nombres
  assert.equal(resumenDeQuien({ nombres: 'Javier P., Ana R.' }), 'Javier P., Ana R.');
  assert.equal(resumenDeQuien({ nombres: 'Javier P.', sinEquipo: true }), 'Javier P.',
    '🔴 con nombres asignados no se dice «No tienes equipo»: los nombres mandan.');
  // no hay, y SE SABE que no hay a quién asignar → «No tienes equipo»
  assert.equal(resumenDeQuien({ nombres: '', sinEquipo: true }), 'No tienes equipo');
  // no hay, y sí hay equipo (o no se sabe) → «Sin asignar»
  assert.equal(resumenDeQuien({ nombres: '' }), 'Sin asignar');
  assert.equal(resumenDeQuien({}), 'Sin asignar');
  assert.equal(resumenDeQuien(undefined), 'Sin asignar');
  assert.equal(resumenDeQuien(null), 'Sin asignar');
  assert.equal(resumenDeQuien({ nombres: '   ' }), 'Sin asignar', '🔴 unos espacios no son un nombre');
  // 🔒 «No tienes equipo» SÓLO con `sinEquipo === true`: un cero de equipo es «no he leído nada»
  // (SCRUM-650), y decirlo por defecto afirmaría lo que no se sabe.
  for (const noEsTrue of [1, 'true', {}, [], 'sí']) {
    assert.equal(resumenDeQuien({ nombres: '', sinEquipo: noEsTrue }), 'Sin asignar',
      `🔴 «No tienes equipo» se dice con sinEquipo=${JSON.stringify(noEsTrue)}: sólo vale \`true\`.`);
  }
});

test('SCRUM-917g · 🔴 «Gastos» cerrada: 0 · 1 · N — y SIN DATO no dice nada, ni una suma', () => {
  assert.equal(resumenDeGastos(0), 'Sin gastos');
  assert.equal(resumenDeGastos(1), '1 gasto', '🔴 el singular es «1 gasto» (com. 16142), no «1 gastos»');
  assert.equal(resumenDeGastos(2), '2 gastos');
  assert.equal(resumenDeGastos(12), '12 gastos');
  // Sin dato: una lista que no se pudo leer y una vacía se leen IGUAL en pantalla, y una de las dos
  // manda al profesional a meter otra vez un gasto que ya está guardado (SCRUM-370).
  for (const sinDato of [NaN, undefined, null, '3', -1, Infinity, -Infinity, {}, []]) {
    assert.equal(resumenDeGastos(sinDato), '',
      `🔴 con ${String(sinDato)} la línea debe callar (cadena vacía), no decir «Sin gastos» ni un número.`);
  }
  // Y NUNCA una suma de importes (SCRUM-370/403): no consta si lo guardado es base o con IVA.
  for (const n of [0, 1, 2, 7, 100]) {
    assert.ok(!/€|EUR|\d[.,]\d/.test(resumenDeGastos(n)), `🔴 la línea de gastos (${n}) menciona un importe.`);
  }
});

// ═══ LA LÍNEA PLEGABLE, CON UN DOM DE JUGUETE ═════════════════════════════════════════════

/**
 * Un `document` de juguete con lo MÍNIMO que usa el módulo. No es el banco de vistas: aquí se prueba el
 * constructor solo, con un nodo que registra lo que se le hace.
 */
function domDeJuguete() {
  const nodo = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), className: '', id: '', textContent: '', dataset: {}, hijos: [],
      tabIndex: 0, open: false, quitado: false, escuchas: {},
      appendChild(h) { this.hijos.push(h); h.padre = this; return h; },
      remove() { this.quitado = true; if (this.padre) this.padre.hijos = this.padre.hijos.filter((x) => x !== this); },
      addEventListener(ev, fn) { (this.escuchas[ev] = this.escuchas[ev] || []).push(fn); },
      classList: { _c: new Set(), add(c) { this._c.add(c); }, contains(c) { return this._c.has(c); } },
    };
    return n;
  };
  return { createElement: nodo };
}

test('SCRUM-917g · la línea plegable: <details> nativo con su cabecera, su valor y su cuerpo', () => {
  const doc = domDeJuguete();
  const l = construirLineaPlegable(doc, { clave: 'notas', rotulo: 'Notas internas', valor: 'Solo tú las ves' });
  const det = l.elemento;
  assert.equal(det.tagName, 'DETAILS', '🔴 no es un <details> nativo: se pierde teclado y lector de pantalla gratis.');
  assert.equal(det.className, 'detail-plega');
  assert.equal(det.dataset.linea, 'notas');
  const [cab, cuerpo] = det.hijos;
  assert.equal(cab.tagName, 'SUMMARY');
  assert.equal(cab.className, 'detail-plega-cab');
  assert.equal(cuerpo, l.cuerpo, '🔴 el cuerpo devuelto no es el que cuelga del <details>');
  assert.equal(cuerpo.className, 'detail-plega-cuerpo');
  const [rotulo, valor] = cab.hijos;
  assert.equal(rotulo.textContent, 'Notas internas');
  assert.equal(rotulo.id, 'job-plega-rotulo-notas', '🔴 el rótulo pierde el id con el que el campo de dentro se nombra');
  assert.equal(valor.textContent, 'Solo tú las ves');
  assert.equal(valor.className, 'detail-plega-valor');
});

test('SCRUM-917g · la línea: `poner` cambia lo que dice cerrada, `cerrar` la recoge, sin dato calla', () => {
  const doc = domDeJuguete();
  const l = construirLineaPlegable(doc, { clave: 'gastos', rotulo: 'Gastos de este trabajo' });
  assert.equal(l.valor.textContent, '', '🔴 sin valor inicial la línea debe estar en blanco, no decir «undefined»');
  l.poner('2 gastos');
  assert.equal(l.valor.textContent, '2 gastos');
  l.poner(null);
  assert.equal(l.valor.textContent, '', '🔴 `poner(null)` pinta «null»');
  l.elemento.open = true;
  l.cerrar();
  assert.equal(l.elemento.open, false, '🔴 `cerrar` no vuelve a plegar la línea');
  // Sin clave ni rótulo: no revienta ni pinta «undefined».
  const raro = construirLineaPlegable(doc, {});
  assert.equal(raro.elemento.dataset.linea, '');
  assert.equal(raro.rotulo.textContent, '');
});

test('SCRUM-917g · 🔴 `sinCuerpo`: la línea sigue diciendo su valor pero deja de ser un control', () => {
  // «Un control que no se puede usar y no puede explicar por qué, no se deshabilita: se quita» (A10).
  // Caso real: no se pudo leer el equipo. La línea dice su valor, sin galón, sin foco y sin abrirse.
  const doc = domDeJuguete();
  const l = construirLineaPlegable(doc, { clave: 'quien', rotulo: 'Quién lo ejecuta', valor: 'Sin asignar' });
  l.sinCuerpo();
  assert.ok(l.elemento.classList.contains('detail-plega--fija'), '🔴 la línea no se marca como fija (sin galón)');
  const cab = l.elemento.hijos[0];
  assert.equal(cab.tabIndex, -1, '🔴 la cabecera sigue siendo alcanzable con el teclado');
  assert.equal(l.cuerpo.quitado, true, '🔴 el cuerpo sigue en el DOM: hay algo que abrir');
  assert.equal(l.elemento.hijos.includes(l.cuerpo), false);
  // Y el clic no la abre: el `<details>` nativo se abre con el `click` del <summary>, y hay que cancelarlo.
  let cancelado = false;
  for (const fn of (cab.escuchas.click || [])) fn({ preventDefault() { cancelado = true; } });
  assert.equal(cancelado, true, '🔴 el clic sobre la cabecera fija NO se cancela: el <details> se abriría vacío');
  assert.equal(l.valor.textContent, 'Sin asignar', '🔴 al quitarle el cuerpo la línea deja de decir su valor');
});

test('SCRUM-917g · la tarjeta «El trabajo»: su título y las líneas EN EL ORDEN QUE SE LE PASA', () => {
  const doc = domDeJuguete();
  const a = construirLineaPlegable(doc, { clave: 'a', rotulo: 'A' });
  const b = construirLineaPlegable(doc, { clave: 'b', rotulo: 'B' });
  const c = construirLineaPlegable(doc, { clave: 'c', rotulo: 'C' });
  const sec = construirBloqueElTrabajo(doc, [c, null, a, undefined, {}, b]);
  assert.equal(sec.className, 'detail-section detail-trabajo');
  assert.equal(sec.dataset.seccion, 'el-trabajo');
  const [h3, ...lineas] = sec.hijos;
  assert.equal(h3.tagName, 'H3');
  assert.equal(h3.className, 'detail-section-title');
  assert.equal(h3.textContent, 'El trabajo');
  assert.deepEqual(lineas.map((x) => x.dataset.linea), ['c', 'a', 'b'],
    '🔴 la tarjeta no respeta el orden de las líneas (o cuela las que no son línea).');
  assert.deepEqual(construirBloqueElTrabajo(doc, 'no es una lista').hijos.length, 1,
    '🔴 sin lista de líneas la tarjeta debe quedarse en su título, no reventar.');
});

// ═══ EL REGISTRO: SI EL SCRIPT NO CARGA ANTES QUE SU CONSUMIDOR, LA FICHA NO SE PINTA ═════

test('SCRUM-917g · el módulo está en el índice UNA vez, ANTES de jobDetailView.js, y sin `defer`', () => {
  const html = leer('public/dashboard/index.html');
  const tags = [...html.matchAll(/<script\b[^>]*\bsrc="\.\/js\/([^"?]+)[^"]*"[^>]*>/g)];
  const nombres = tags.map((m) => m[1]);
  assert.ok(nombres.length > 40, `🔴 SUELO: el índice sólo declara ${nombres.length} scripts; el extractor está ciego.`);
  const iMod = nombres.indexOf('jobTrabajoPlegable.js');
  const iVista = nombres.indexOf('jobDetailView.js');
  assert.ok(iMod >= 0, '🔴 `jobTrabajoPlegable.js` no está en el índice: la vista no encuentra `construirLineaPlegable`.');
  assert.equal(nombres.filter((n) => n === 'jobTrabajoPlegable.js').length, 1, '🔴 el módulo se carga más de una vez');
  assert.ok(iVista >= 0 && iMod < iVista,
    '🔴 `jobTrabajoPlegable.js` carga DESPUÉS de `jobDetailView.js`: `window.construirLineaPlegable` no existe al montar y la ficha del Trabajo no se pinta.');
  assert.ok(!/defer|async/.test(tags[iMod][0]), '🔴 el módulo se carga con defer/async: el orden ya no está garantizado.');
});

test('SCRUM-917g · el módulo está en el SHELL del service worker (la ficha funciona sin red)', () => {
  const sw = leer('public/sw.js');
  const rutas = [...sw.matchAll(/'(\/dashboard\/js\/[^']+)'/g)].map((m) => m[1]);
  assert.ok(rutas.length > 40, `🔴 SUELO: el SHELL sólo lista ${rutas.length} scripts; el extractor está ciego.`);
  assert.equal(rutas.filter((r) => r === '/dashboard/js/jobTrabajoPlegable.js').length, 1,
    '🔴 `jobTrabajoPlegable.js` no está (o está repetido) en el SHELL de `sw.js`: sin red la ficha del Trabajo se pinta sin sus líneas.');
});

// ═══ REGLA 4: NI UN ESTILO EN LÍNEA NUEVO ═════════════════════════════════════════════════

test('SCRUM-917g · el módulo NO escribe estilos en línea: las clases viven en styles.css', () => {
  const codigo = soloEjecutable(leer(MODULO), { almohadillaEsComentario: false });
  assert.ok(codigo.includes('construirLineaPlegable'), '🔴 SUELO: el recorte de comentarios se comió el módulo.');
  assert.ok(!/\.style\b|cssText|style\s*=|setAttribute\(\s*['"]style/.test(codigo),
    '🔴 el módulo escribe un estilo en línea. La regla 4 dice «ni uno»; el aspecto de las líneas vive en `.detail-plega*` de styles.css.');
  const css = leer('public/dashboard/css/styles.css');
  for (const clase of ['.detail-trabajo', '.detail-plega', '.detail-plega-cab', '.detail-plega-valor', '.detail-plega-cuerpo', '.detail-plega--fija']) {
    assert.ok(css.includes('\n' + clase), `🔴 la clase ${clase} que usa el módulo no está definida en styles.css.`);
  }
});
