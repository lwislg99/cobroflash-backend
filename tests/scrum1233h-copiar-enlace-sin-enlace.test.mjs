// tests/scrum1233h-copiar-enlace-sin-enlace.test.mjs — SCRUM-1233h
//
// «COPIAR ENLACE» COPIABA LA PORTADA DE yaqu.app CUANDO LA FACTURA AÚN NO TENÍA COBRO.
//
// La barra de fallo de WhatsApp (`waFallbackBar`, api.js) recibe `link`. La ficha del Trabajo le
// pasaba `token ? origin + '/pay/invoice/' + token : location.origin`: sin token, la portada. Y el
// botón decía «✓ Enlace copiado — mándaselo por SMS». Medido el 18-oct contra el código servido por
// yaqu.app (build 74e60ebe5), con el POST contestado por la sonda: sin teléfono (400), cobro no
// creado (200 sent:false, pay_token null) y error de red (500) copian los tres `https://yaqu.app`;
// el control con token copia `/pay/invoice/<token>`.
//
// Arreglo: sin `link` la barra NO pinta «Copiar enlace» (email y reintento se quedan), y quien
// llama pasa `null`, nunca la portada.
//
// ① COMPORTAMIENTO: se ejecuta la `waFallbackBar` REAL, recortada de api.js, sobre un DOM mínimo.
//    Control positivo dentro: con enlace, el botón existe y copia ESE enlace — si el recorte o el
//    DOM fallaran, «no hay botón» saldría verde por no haber pintado nada.
// ② CENSO: ningún fichero del panel pasa `location.origin` a pelo como valor de una rama. Techo por
//    fichero, con sus dos mitades: si sube, rojo; si baja, rojo para que se baje el techo.
//    `invoiceDetailView.js` es de J1 y tiene el mismo defecto (:405 y :421) — avisado por el
//    orquestador (para-javier §25.4); cuando lo arreglen, su techo baja a 0 aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RAIZ, 'public/dashboard/js');
const API = fs.readFileSync(path.join(JS, 'api.js'), 'utf8');

/** La `waFallbackBar` de api.js, tal cual, ejecutable sobre un DOM mínimo. */
function cargarBarra() {
  const desde = API.indexOf('function waFallbackBar(');
  const hasta = API.indexOf('window.waFallbackBar = waFallbackBar;');
  assert.ok(desde >= 0 && hasta > desde, 'no encuentro `function waFallbackBar(` … `window.waFallbackBar` en api.js');
  const copiado = [];
  const toasts = [];
  const nodo = (tag) => ({
    tag, className: '', textContent: '', title: '', disabled: false, style: {}, hijos: [], oyentes: {},
    appendChild(h) { this.hijos.push(h); return h; },
    addEventListener(ev, fn) { this.oyentes[ev] = fn; },
    remove() {},
  });
  const document = { createElement: nodo };
  const navigator = { clipboard: { writeText: async (t) => { copiado.push(t); } } };
  const window = { prompt: () => { throw new Error('no debería abrirse el prompt'); } };
  const showToast = (t) => toasts.push(t);
  const waSendFailed = (r) => !!r && r.sent === false;
  const fabrica = new Function('document', 'navigator', 'window', 'showToast', 'waSendFailed',
    `${API.slice(desde, hasta)}\nreturn waFallbackBar;`);
  return { waFallbackBar: fabrica(document, navigator, window, showToast, waSendFailed), copiado, toasts };
}

const rotulos = (bar) => bar.hijos.map((b) => b.textContent);

test('scrum1233h ① CONTROL: con enlace, la barra ofrece «Copiar enlace» y copia ESE enlace', async () => {
  const { waFallbackBar, copiado } = cargarBarra();
  const link = 'https://yaqu.app/pay/invoice/tokPRUEBA';
  const bar = waFallbackBar({ link, onEmail: () => ({ sent: true }), onRetry: () => {} });
  const copiar = bar.hijos.find((b) => /Copiar enlace/.test(b.textContent));
  assert.ok(copiar, `con enlace tiene que haber «Copiar enlace»; hay: ${JSON.stringify(rotulos(bar))}`);
  await copiar.oyentes.click();
  assert.deepEqual(copiado, [link]);
  assert.equal(bar.hijos.length, 3, 'las tres salidas de A20.5');
});

function sinEnlace(link) {
  const { waFallbackBar } = cargarBarra();
  const bar = waFallbackBar({ link, onEmail: () => ({ sent: true }), onRetry: () => {} });
  const r = rotulos(bar);
  assert.ok(!r.some((t) => /Copiar enlace/.test(t)), `sin enlace no se ofrece copiar; hay: ${JSON.stringify(r)}`);
  assert.ok(r.some((t) => /Enviar por email/.test(t)), `el email tiene que seguir; hay: ${JSON.stringify(r)}`);
  assert.ok(r.some((t) => /Reintentar WhatsApp/.test(t)), `el reintento tiene que seguir; hay: ${JSON.stringify(r)}`);
}
test('scrum1233h ① sin enlace (null): NO hay «Copiar enlace», y el email y el reintento siguen', () => sinEnlace(null));
test('scrum1233h ① sin enlace (undefined): NO hay «Copiar enlace», y el email y el reintento siguen', () => sinEnlace(undefined));
test('scrum1233h ① sin enlace (cadena vacía): NO hay «Copiar enlace», y el email y el reintento siguen', () => sinEnlace(''));

// ② `location.origin` a pelo como valor: tras `?`/`:` de un ternario o tras `link:`, y cerrado por
//    `,` `)` `}` `;` o fin de línea. `location.origin + '/…'` NO casa (lleva ruta detrás).
const PORTADA_A_PELO = /(?:[?:]|\blink\s*:)\s*location\.origin\s*(?=[,)};]|$)/gm;

const TECHO = {
  'invoiceDetailView.js': 2, // J1 · :405 y :421 · para-javier §25.4 — baja a 0 cuando lo arreglen
};

test('scrum1233h ② CONTROL: el patrón caza la forma vieja y no la buena', () => {
  const vieja = "link: token ? location.origin + '/pay/invoice/' + token : location.origin,";
  const buena = "link: token ? location.origin + '/pay/invoice/' + token : null,";
  assert.equal((vieja.match(PORTADA_A_PELO) || []).length, 1);
  assert.equal((buena.match(PORTADA_A_PELO) || []).length, 0);
});

test('scrum1233h ② ningún fichero del panel pasa la portada como enlace por encima de su techo (y el techo no sobra)', () => {
  const cuenta = {};
  for (const f of fs.readdirSync(JS).filter((n) => n.endsWith('.js'))) {
    const n = (soloCodigo(fs.readFileSync(path.join(JS, f), 'utf8'), f).match(PORTADA_A_PELO) || []).length;
    if (n) cuenta[f] = n;
  }
  for (const [f, n] of Object.entries(cuenta)) {
    assert.ok(n <= (TECHO[f] || 0), `${f} pasa \`location.origin\` a pelo ${n} vez/veces (techo ${TECHO[f] || 0}): sin token, pasa \`null\` y la barra no ofrece copiar`);
  }
  for (const [f, techo] of Object.entries(TECHO)) {
    assert.equal(cuenta[f] || 0, techo, `${f}: el techo es ${techo} y hay ${cuenta[f] || 0} — si ha bajado, baja el techo aquí`);
  }
});

// ── SCRUM-1233i · «Enviar por email» SÓLO con algo que hacer ─────────────────────────────────────
// Sin `onEmail` ni `emailDisabledReason`, la barra pintaba un botón ACTIVO y SIN OYENTE: se pulsaba y no
// pasaba nada. Lo pide el llamador del albarán (S4), que no tiene envío por email.
const email = (bar) => bar.hijos.find((b) => /Enviar por email/.test(b.textContent));

test('scrum1233i ① sin `onEmail` ni `emailDisabledReason`: NO hay «Enviar por email», y copiar y reintentar siguen', () => {
  const { waFallbackBar } = cargarBarra();
  const bar = waFallbackBar({ link: 'https://yaqu.app/pay/invoice/tokPRUEBA', onRetry: () => {} });
  assert.equal(email(bar), undefined, `sin acción de email no se pinta el botón; hay: ${JSON.stringify(rotulos(bar))}`);
  assert.deepEqual(rotulos(bar), ['📋 Copiar enlace', '↻ Reintentar WhatsApp']);
});

test('scrum1233i ① CONTROL: con `onEmail` el botón está y ENVÍA; con `emailDisabledReason`, está desactivado y dice por qué', async () => {
  const { waFallbackBar, toasts } = cargarBarra();
  let enviado = 0;
  const activo = email(waFallbackBar({ link: null, onEmail: () => { enviado++; return { sent: true }; }, onRetry: () => {} }));
  assert.ok(activo && typeof activo.oyentes.click === 'function', 'con `onEmail` tiene que haber botón CON oyente');
  await activo.oyentes.click();
  assert.equal(enviado, 1);
  assert.ok(toasts.includes('✓ Enviado por email'));
  const motivo = 'Este cliente no tiene email guardado';
  const off = email(waFallbackBar({ link: null, emailDisabledReason: motivo, onRetry: () => {} }));
  assert.ok(off, 'con `emailDisabledReason` el botón sigue (desactivado): el profesional ve por qué no puede');
  assert.equal(off.disabled, true);
  assert.equal(off.title, motivo);
});

/** Los objetos literales que el panel pasa a `waFallbackBar({ … })`, por llaves emparejadas. */
function llamadasALaBarra(codigo) {
  const out = [];
  const re = /\bwaFallbackBar\(\s*\{/g;
  let m;
  while ((m = re.exec(codigo))) {
    let i = m.index + m[0].length - 1;
    let prof = 0;
    const ini = i;
    for (; i < codigo.length; i++) {
      if (codigo[i] === '{') prof++;
      else if (codigo[i] === '}' && --prof === 0) break;
    }
    out.push(codigo.slice(ini, i + 1));
  }
  return out;
}
const pasaEmail = (obj) => /\b(onEmail|emailDisabledReason)\s*:/.test(obj);

test('scrum1233i ② CONTROL: el lector de llamadas ve un objeto con llaves dentro y distingue con y sin email', () => {
  const con = llamadasALaBarra("x(waFallbackBar({ link: a ? `${b}/x` : null, onEmail: () => f({ m: 1 }), onRetry }));");
  const sin = llamadasALaBarra('x(waFallbackBar({ link: null, onRetry }));');
  assert.equal(con.length, 1);
  assert.ok(con[0].endsWith('onRetry }'), `el objeto se corta mal: ${con[0]}`);
  assert.equal(pasaEmail(con[0]), true);
  assert.equal(pasaEmail(sin[0]), false);
});

test('scrum1233i ② los llamadores del panel de hoy pasan `onEmail` o `emailDisabledReason`: ninguno pierde el botón', () => {
  const llamadas = [];
  for (const f of fs.readdirSync(JS).filter((n) => n.endsWith('.js') && n !== 'api.js')) {
    for (const obj of llamadasALaBarra(soloCodigo(fs.readFileSync(path.join(JS, f), 'utf8'), f))) llamadas.push({ f, obj });
  }
  // Población medida el 19-oct: invoiceDetailView ×2, jobDetailView ×1, quotesDetailView ×1.
  assert.ok(llamadas.length >= 4, `CIEGO: sólo ${llamadas.length} llamadas a waFallbackBar({…}) en el panel (eran 4)`);
  const sinEmail = llamadas.filter((l) => !pasaEmail(l.obj)).map((l) => l.f);
  // Una pantalla CON envío por email que deje de pasarlo se quedaría sin botón. Una SIN envío por
  // email (el albarán) entra aquí a propósito: se añade a esta lista con su motivo.
  const SIN_EMAIL_A_PROPOSITO = [];
  assert.deepEqual(sinEmail.filter((f) => !SIN_EMAIL_A_PROPOSITO.includes(f)), [],
    'estas pantallas llaman a la barra sin `onEmail` ni `emailDisabledReason`: ya no pintan «Enviar por email»');
});
