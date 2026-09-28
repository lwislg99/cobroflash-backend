// tests/scrum1130-demo-llega-a-firmado.test.mjs — SCRUM-1130
//
// LA DEMO «PRUÉBALO TÚ» DE LA LANDING TIENE QUE TERMINAR.
//
// Medido en yaqu.app el 28-sep-2026 (Playwright, 390×844): Enviar por WhatsApp → Abrir y firmar →
// Firmar y aceptar, y a los 3,3 s la demo sigue en la pantalla 2 con el botón deshabilitado. El
// manejador de `[data-sign]` solo dibujaba el trazo y apagaba el botón: ni marcaba el paso 3 como
// hecho ni enseñaba ningún final. Es la primera interacción de un profesional con el producto, y
// el texto de al lado le promete «del presupuesto a la firma».
//
// 🔴 SE EJECUTA EL SCRIPT DE VERDAD, no se lee. El bloque de la demo sale de `public/index.html`
// tal cual se sirve (entre sus dos marcadores) y corre en `node:vm` sobre el marcado real de
// `#probar`, montado con el mini-DOM de `_banco-vistas.mjs`. Los clics se propagan hacia arriba
// como en el navegador, porque el oyente vive en `#iscreen` y no en el botón.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { nodo, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');

const INI_SECCION = '<section id="probar"';
const INI_SCRIPT = '// Interactive playable demo';
const FIN_SCRIPT = '// Founding: contador REAL';

/** Monta `#probar` y corre el script de la demo. `reduce` = prefers-reduced-motion. */
function montarDemo({ reduce = false } = {}) {
  const i = HTML.indexOf(INI_SECCION);
  const f = HTML.indexOf('</section>', i);
  assert.ok(i > 0 && f > i, '🔴 no encuentro la sección #probar en index.html');
  const a = HTML.indexOf(INI_SCRIPT);
  const b = HTML.indexOf(FIN_SCRIPT, a);
  assert.ok(a > 0 && b > a, '🔴 no encuentro el bloque de la demo entre sus dos marcadores');

  const reg = { porId: new Map(), errores: [], idsNoResueltos: [], selectoresNoSoportados: [] };
  const cuerpo = nodo('body', reg);
  cuerpo.innerHTML = HTML.slice(i, f + '</section>'.length);

  // Temporizadores a mano: el final llega tras el trazo animado, y se quiere ver ANTES y DESPUÉS.
  let reloj = 0;
  let ultimoId = 0;
  const pendientes = [];
  const ctx = {
    reduce,
    document: {
      getElementById: (id) => reg.porId.get(id) || null,
      querySelector: (s) => cuerpo.querySelector(s),
      querySelectorAll: (s) => cuerpo.querySelectorAll(s),
    },
    // `clearTimeout` CANCELA de verdad: uno de mentira haría fallar al código que sí cancela, y el
    // rojo se leería como un defecto de la demo que el navegador no tiene.
    setTimeout: (fn, ms) => { const id = ++ultimoId; pendientes.push({ id, fn, en: reloj + (ms || 0) }); return id; },
    clearTimeout: (id) => { const k = pendientes.findIndex((p) => p.id === id); if (k >= 0) pendientes.splice(k, 1); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(a, b), ctx, { filename: 'index.html#demo' });

  const avanzar = (ms) => {
    reloj += ms;
    for (;;) {
      const k = pendientes.findIndex((p) => p.en <= reloj);
      if (k < 0) break;
      pendientes.splice(k, 1)[0].fn();
    }
  };
  /** Un clic que SUBE, como en el navegador: el oyente de la demo está en `#iscreen`. */
  const pulsar = (n) => {
    assert.ok(n, '🔴 se intenta pulsar algo que no existe');
    const ev = { type: 'click', target: n, preventDefault() {}, stopPropagation() {} };
    for (let p = n; p; p = p._padre) for (const fn of p._oyentes.click || []) fn.call(p, ev);
  };
  const q = (s) => cuerpo.querySelector(s);
  const paso = (s) => q(`#trySteps [data-s="${s}"]`);
  const clases = (n) => { assert.ok(n, '🔴 falta un nodo de la demo'); return String(n.className).split(/\s+/); };
  return { reg, cuerpo, q, paso, clases, pulsar, avanzar, ctx };
}

function recorrerHastaFirmar(d) {
  d.pulsar(d.q('[data-go="1"]'));
  d.pulsar(d.q('[data-go="2"]'));
  d.pulsar(d.q('#signBtn'));
}

test('SCRUM-1130 · SUELO: el banco ve la demo y avanza sus pasos (control positivo)', () => {
  const d = montarDemo();
  assert.equal(d.reg.selectoresNoSoportados.length, 0,
    `🔴 el mini-DOM no sabe resolver: ${d.reg.selectoresNoSoportados.join(', ')}`);
  assert.equal(todos(d.cuerpo).filter((n) => n.dataset && n.dataset.scr !== undefined).length, 3,
    '🔴 la demo debería tener sus tres pantallas');
  d.pulsar(d.q('[data-go="1"]'));
  d.pulsar(d.q('[data-go="2"]'));
  // Si esto no se cumple, el banco no ve avanzar la demo y lo que venga después no mide nada.
  assert.ok(d.clases(d.q('[data-scr="2"]')).includes('on'), '🔴 no llega a la pantalla de firma');
  assert.ok(d.clases(d.paso(0)).includes('done') && d.clases(d.paso(1)).includes('done'),
    '🔴 los pasos 1 y 2 deberían quedar hechos al llegar al 3');
  assert.ok(!d.clases(d.paso(2)).includes('done'), 'el paso 3 no está hecho ANTES de firmar');
});

test('SCRUM-1130 · 🔴 tras «Firmar y aceptar», la demo TERMINA: paso 3 hecho y final visible', () => {
  const d = montarDemo();
  recorrerHastaFirmar(d);
  // El clic LLEGA al manejador: el trazo empieza y el botón se apaga, que es lo que ya hacía.
  assert.ok(d.clases(d.q('#ipadSign')).includes('draw') && d.q('#signBtn').disabled === true,
    '🔴 el clic de firmar no llega al manejador de la demo: el banco no mide nada');
  d.avanzar(5000);
  assert.ok(d.clases(d.paso(2)).includes('done'),
    '🔴 el paso 3 («Lo firma desde el móvil») no queda hecho tras firmar: la demo no termina');
  const ok = d.q('#signOk');
  assert.ok(ok, '🔴 no hay estado final de firmado (#signOk) en la pantalla de firma');
  assert.ok(d.clases(ok).includes('on'), '🔴 el estado final existe pero no se enseña tras firmar');
  // El literal FIRMADO (SCRUM-1130 comentario 17403, opción B). No «Firmado · 961,95 €»: ése es el
  // fotograma COBRADO de la cabecera (`.paid`), y en España con la emisión apagada no hay cobro.
  // Del MARCADO de `#signOk` y no de `textContent`: el banco no agrega el texto que va detrás de un
  // hijo (límite 4 declarado en `_banco-vistas.mjs`), y aquí el literal va detrás del `<svg>`.
  const marcado = HTML.match(/id="signOk"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(marcado, '🔴 no encuentro el marcado de #signOk');
  const texto = marcado[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  assert.equal(texto, 'Firmado · Acepto', '🔴 el final de la demo no dice el literal firmado');
  assert.doesNotMatch(texto, /€|cobr|pag|factur/i, '🔴 el final de la firma no puede sugerir cobro ni factura');
  assert.match('Firmado · 961,95 €', /€|cobr|pag|factur/i); // hermano positivo: la regex casa con la A
  assert.ok(d.clases(d.q('#signBtn')).includes('is-hidden'),
    '🔴 el botón deshabilitado sigue ocupando el sitio del final');
});

test('SCRUM-1130 · el final llega CUANDO ACABA EL TRAZO, no antes (y al instante sin animación)', () => {
  const d = montarDemo();
  recorrerHastaFirmar(d);
  d.avanzar(500);
  assert.ok(!d.clases(d.q('#signOk')).includes('on'), 'a los 0,5 s el trazo aún se está dibujando');
  d.avanzar(1000);
  assert.ok(d.clases(d.q('#signOk')).includes('on'), 'a los 1,5 s el trazo (1,1 s) ya acabó');

  const r = montarDemo({ reduce: true });
  recorrerHastaFirmar(r);
  assert.ok(r.clases(r.q('#signOk')).includes('on') && r.clases(r.paso(2)).includes('done'),
    '🔴 con movimiento reducido no hay trazo que esperar: el final tiene que salir al momento');
});

test('SCRUM-1130 · «Volver a empezar» deja la demo como al principio, también a mitad del trazo', () => {
  const d = montarDemo();
  recorrerHastaFirmar(d);
  d.avanzar(5000);
  d.pulsar(d.q('#tryReset'));
  assert.ok(d.clases(d.q('[data-scr="0"]')).includes('on'), 'vuelve a la pantalla 0');
  assert.ok(!d.clases(d.q('#signOk')).includes('on'), 'el final se esconde');
  assert.ok(!d.clases(d.q('#signBtn')).includes('is-hidden') && d.q('#signBtn').disabled === false,
    'el botón de firmar vuelve, activo');
  assert.ok(!d.clases(d.paso(2)).includes('done'), 'el paso 3 deja de estar hecho');

  // Reiniciar A MITAD del trazo: el temporizador pendiente no puede pintar el final después.
  const m = montarDemo();
  recorrerHastaFirmar(m);
  m.avanzar(300);
  m.pulsar(m.q('#tryReset'));
  m.avanzar(5000);
  assert.ok(!m.clases(m.q('#signOk')).includes('on') && !m.clases(m.paso(2)).includes('done'),
    '🔴 un reinicio a mitad del trazo acaba enseñando «firmado» en la pantalla 0');
});
