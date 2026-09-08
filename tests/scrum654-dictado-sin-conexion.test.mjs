// tests/scrum654-dictado-sin-conexion.test.mjs — SCRUM-654. Sin gate.
//
// 🔴 CUANDO EL DICTADO FALLA POR FALTA DE CONEXIÓN, EL TÉCNICO SE ENTERA.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO CIERRA, MEDIDO EN EL PASO 0 DE ESTE MISMO TICKET
//
// `voiceInput.js` avisaba de tres errores —permiso, servicio no disponible, no-speech— y del
// cuarto no: `network` caía en la rama de «cierre limpio» y **se paraba en silencio**. Y es el que
// ocurre SIEMPRE en la obra: el reconocimiento de Chrome es server-based y no funciona sin
// conexión (MDN, citado en `docs/master/SCRUM-654.md`).
//
// El técnico toca el micro en un garaje, no pasa nada, y no sabe por qué. **La segunda vez ya no lo
// toca**, y se pierde la función entera por un aviso que falta.
//
//     El defecto no era que la voz no funcione sin cobertura — eso está decidido y se acepta.
//     Era que no funcionara Y NO LO DIJERA.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 POR QUÉ ESTO EJECUTA EL FICHERO EN VEZ DE LEERLO
//
// Un test que busque la palabra «network» en el `.js` pasaría con el aviso escrito y **nunca
// alcanzado** — un `return` antes, una rama que no entra, un `toast` que se pisa cuatro líneas
// después. Ya pasó en esta casa con un aviso pintado y borrado por un `innerHTML` posterior: el
// test estaba verde porque el texto SÍ estaba en el código.
//
// Así que aquí se monta un DOM falso, se ejecuta `voiceInput.js` de verdad, se le da un
// `SpeechRecognition` de mentira, se dispara el error y **se mira qué toast salió**. Lo que se
// comprueba es el RESULTADO.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/voiceInput.js'), 'utf8');

/**
 * Monta el mundo mínimo que `voiceInput.js` toca y lo EJECUTA.
 *
 * No hay jsdom en el repo y no se añade una dependencia por esto (regla 36): para un botón, un
 * textarea y un reconocedor de mentira no hace falta. Mismo criterio que `domFalso` en
 * `scrum300-direccion-sugerida.test.mjs`.
 */
function montar() {
  const toasts = [];
  const creados = [];

  const nuevoElemento = (tag) => {
    const el = {
      tagName: String(tag).toUpperCase(),
      className: '', textContent: '', value: '', type: '', title: '',
      style: { cssText: '' },
      classList: { _c: new Set(), add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); },
        toggle(c, on) { if (on) this._c.add(c); else this._c.delete(c); },
        contains(c) { return this._c.has(c); } },
      dataset: {},
      hidden: false,
      children: [],
      _oyentes: {},
      setAttribute() {}, removeAttribute() {}, remove() { el._quitado = true; },
      appendChild(h) { el.children.push(h); return h; },
      insertAdjacentElement(_pos, h) { el.children.push(h); return h; },
      addEventListener(ev, fn) { (el._oyentes[ev] ||= []).push(fn); },
      dispatchEvent() { return true; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      closest() { return null; },
      focus() {}, blur() {},
      getBoundingClientRect() { return { width: 100, height: 40, top: 0, left: 0 }; },
      /** Dispara un evento como lo haría el navegador. */
      _click() { for (const fn of el._oyentes.click || []) fn({ preventDefault() {} }); },
    };
    creados.push(el);
    return el;
  };

  /** El reconocedor de mentira. Guarda la última instancia para poder dispararle errores. */
  const reconocedores = [];
  class SRFalso {
    constructor() {
      this.lang = ''; this.continuous = false; this.interimResults = false;
      this.onstart = null; this.onresult = null; this.onerror = null; this.onend = null;
      reconocedores.push(this);
    }
    start() { if (typeof this.onstart === 'function') this.onstart(); }
    stop() { if (typeof this.onend === 'function') this.onend(); }
  }

  const almacen = {};
  const sandbox = {
    window: {
      SpeechRecognition: SRFalso,
      // El gate real de `voiceSupportProbe`: flag ON y contexto seguro. Se ponen porque son
      // PRECONDICIONES del caso que se prueba, no parte de lo que se prueba — sin ellas el micro
      // ni se pinta, y el suelo de abajo lo dice en vez de pasar en vacío.
      appVoiceEnabled: true,
      isSecureContext: true,
      appLocale: { speechLang: 'es-ES' },
      entornoDeLaApp: undefined,
      ENTORNO_INSTALADA: 'instalada',
    },
    document: {
      createElement: nuevoElemento,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 13)', platform: 'Linux', maxTouchPoints: 5, mediaDevices: {} },
    sessionStorage: {
      getItem: (k) => (k in almacen ? almacen[k] : null),
      setItem: (k, v) => { almacen[k] = String(v); },
    },
    showToast: (msg) => { toasts.push(String(msg)); },
    setTimeout: () => 0,
    clearTimeout: () => {},
    Event: class { constructor(t) { this.type = t; } },
    console,
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(FUENTE, sandbox, { filename: 'voiceInput.js' });

  return { sandbox, toasts, creados, reconocedores, nuevoElemento };
}

/** Arranca un dictado de verdad y devuelve el reconocedor vivo. */
function dictando(m) {
  const textarea = m.nuevoElemento('textarea');
  const ok = m.sandbox.window.attachVoiceInput(textarea, {});
  assert.ok(ok !== false, '🔴 CIEGO: `attachVoiceInput` no ha montado el micro sobre el DOM falso.');

  const boton = m.creados.find((e) => (e._oyentes.click || []).length && e.tagName === 'BUTTON');
  assert.ok(boton, '🔴 CIEGO: no se encuentra el botón del micro. Sin él no se puede dictar y todo ' +
    'lo de abajo pasaría sin ejercer nada.');
  boton._click();

  const rec = m.reconocedores[m.reconocedores.length - 1];
  assert.ok(rec, '🔴 CIEGO: al pulsar el micro no se creó ningún reconocedor.');
  return rec;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-654 · SUELO: el fichero se EJECUTA y expone su superficie', () => {
  const m = montar();
  assert.equal(typeof m.sandbox.window.attachVoiceInput, 'function',
    '🔴 CIEGO: `voiceInput.js` no expone `attachVoiceInput` al ejecutarse. Si el montaje se rompe, ' +
    'todos los tests de abajo pasarían sin haber ejercido nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-654 · 🔴 EL QUE DECIDE: al fallar por RED, el técnico recibe un aviso', () => {
  const m = montar();
  const rec = dictando(m);
  const antes = m.toasts.length;

  rec.onerror({ error: 'network' });

  assert.ok(m.toasts.length > antes,
    '🔴 EL DICTADO SE HA PARADO EN SILENCIO POR FALTA DE CONEXIÓN.\n\n' +
    '  Es el defecto entero de SCRUM-654: los otros tres errores avisan y éste no, y es el que\n' +
    '  ocurre SIEMPRE en la obra (el reconocimiento de Chrome no funciona sin conexión).\n\n' +
    '  El técnico toca el micro en un garaje, no pasa nada, y no sabe por qué. La segunda vez ya\n' +
    '  no lo toca — y se pierde la función entera por un aviso que falta.');

  const aviso = m.toasts[m.toasts.length - 1];
  assert.match(aviso, /conexión/i,
    `🔴 el aviso no dice que falta CONEXIÓN, que es la causa. Dice: «${aviso}»`);
  assert.match(aviso, /escribe/i,
    `🔴 el aviso da la mala noticia y no la salida. El técnico se queda parado delante de un ` +
    `micro que no va. Dice: «${aviso}»`);
});

// SCRUM-674 (2-sep-2026) · ESTE TEST NO SE RELAJA, SE ACTUALIZA AL HECHO.
//
// Vigilaba que el aviso saliera con marcador PORQUE el texto no estaba firmado. El fundador lo
// aprobó, así que la marca desapareció — y ahí es donde un guard se muere en silencio: se borra
// el test «que ya no aplica» y con él la única atadura entre el texto que se pinta y el que se
// aprobó. Lo que protegía sigue vivo y es MÁS fuerte ahora: que el aviso sea EXACTAMENTE el texto
// firmado, letra por letra, y que ese texto CONSTE en la fuente única de microcopy aprobada.
//
// Si mañana alguien lo retoca «de paso», esto se pone rojo: retocar un texto aprobado es reabrir
// una aprobación sin que nadie se entere.
const AVISO_APROBADO = 'El dictado necesita conexión — escribe el trabajo y listo';

test('SCRUM-674 · el aviso es LITERALMENTE el texto aprobado (regla 30)', () => {
  const m = montar();
  const rec = dictando(m);
  rec.onerror({ error: 'network' });
  const aviso = m.toasts[m.toasts.length - 1];

  assert.equal(aviso, AVISO_APROBADO,
    `🔴 el aviso NO es el texto que aprobó el fundador. Se pinta: «${aviso}». Aprobado: ` +
    `«${AVISO_APROBADO}». Un retoque «de paso» reabre una aprobación en silencio (regla 30).`);

  assert.doesNotMatch(aviso, /PENDIENTE/,
    '🔴 el aviso ha vuelto a salir con marcador. El texto está aprobado desde SCRUM-674.');
});

test('SCRUM-674 · el texto aprobado CONSTA en la fuente única de microcopy', () => {
  // El código y el documento tienen que decir lo mismo. Si el texto vive solo en el .js, mañana
  // nadie puede comprobar que se aprobó: la aprobación deja de ser verificable.
  const doc = path.join(RAIZ, 'docs', 'MICROCOPY_APROBADA_SIN_APLICAR.md');
  assert.ok(fs.existsSync(doc), `🔴 no existe la fuente única de microcopy: ${doc}`);

  const texto = fs.readFileSync(doc, 'utf8');
  assert.ok(texto.includes(AVISO_APROBADO),
    '🔴 el aviso está APLICADO en el código pero NO consta en ' +
    'docs/MICROCOPY_APROBADA_SIN_APLICAR.md. Aplicar sin anotar deja una aprobación que nadie ' +
    'puede verificar: el texto queda en producción sin rastro de quién lo firmó.');
});

test('SCRUM-654 · 🔴 quedarse sin cobertura NO retira el micro: es temporal', () => {
  // Permiso y servicio sí lo retiran, y con razón: no van a volver en esta sesión. La cobertura sí
  // vuelve al salir del sótano, y un micro retirado castigaría al técnico por haber entrado.
  const m = montar();
  const rec = dictando(m);
  rec.onerror({ error: 'network' });
  assert.notEqual(m.sandbox.sessionStorage.getItem('voiceUnsupported'), '1',
    '🔴 el fallo de red ha marcado el dictado como no soportado para toda la sesión. La cobertura ' +
    'vuelve; el micro tiene que volver con ella.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO · los que YA hablaban siguen hablando
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-654 · CONTROL POSITIVO: los otros tres errores avisan exactamente como hoy', () => {
  // Sin esto, «arreglé el mudo» y «rompí los que hablaban» dan el mismo verde.
  for (const [code, esperado] of [
    ['not-allowed', /permiso de micrófono/i],
    ['service-not-allowed', /no está disponible en este navegador/i],
    ['no-speech', /no te he oído/i],
  ]) {
    const m = montar();
    const rec = dictando(m);
    const antes = m.toasts.length;
    rec.onerror({ error: code });
    assert.ok(m.toasts.length > antes, `🔴 «${code}» ha dejado de avisar: era de los que hablaban.`);
    assert.match(m.toasts[m.toasts.length - 1], esperado,
      `🔴 el aviso de «${code}» ha cambiado de texto: «${m.toasts[m.toasts.length - 1]}»`);
  }
});

test('SCRUM-654 · los dos que retiran el micro lo siguen retirando', () => {
  for (const code of ['not-allowed', 'service-not-allowed']) {
    const m = montar();
    const rec = dictando(m);
    rec.onerror({ error: code });
    assert.equal(m.sandbox.sessionStorage.getItem('voiceUnsupported'), '1',
      `🔴 «${code}» ya no retira el micro de la sesión, y sí debe: no va a volver.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · con red no aparece ningún aviso
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-654 · 🔴 CONTROL NEGATIVO: con red, el dictado funciona y NO sale ningún aviso', () => {
  // Un aviso que sale siempre es tan inútil como uno que no sale nunca.
  const m = montar();
  const rec = dictando(m);

  // Camino feliz: el navegador reconoce y devuelve texto final.
  rec.onresult({
    resultIndex: 0,
    results: Object.assign([[Object.assign({ transcript: 'dos cámaras y sesenta metros de cable' })]], {
      length: 1, 0: Object.assign([{ transcript: 'dos cámaras y sesenta metros de cable' }], { isFinal: true, length: 1 }),
    }),
  });
  rec.onend();

  assert.deepEqual(m.toasts, [],
    `🔴 el dictado ha avisado de algo SIN que fallara nada: ${JSON.stringify(m.toasts)}. Un aviso ` +
    'que sale siempre deja de leerse, y entonces el de la obra tampoco se lee.');
});

test('SCRUM-654 · CONTROL NEGATIVO: `aborted` sigue sin avisar, y es correcto', () => {
  // Lo provoca el propio usuario al parar el dictado. Avisar ahí sería contarle lo que acaba de
  // hacer, que es el ruido que hace que nadie lea los avisos de verdad.
  const m = montar();
  const rec = dictando(m);
  rec.onerror({ error: 'aborted' });
  assert.deepEqual(m.toasts, [],
    `🔴 «aborted» ha empezado a avisar: ${JSON.stringify(m.toasts)}. Lo provoca el propio técnico.`);
});
