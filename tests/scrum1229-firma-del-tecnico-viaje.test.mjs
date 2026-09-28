// SCRUM-1229 · LA FIRMA DEL TÉCNICO, MEDIDA POR EL VIAJE Y NO POR EL GESTO.
//
// El defecto (medido por S4 el 28-sep-2026 ejecutando la vista): la pantalla del parte mandaba el
// nombre del técnico como `firmadoPorNombre`, y `POST /admin/partes/:id/firmar-tecnico` lee
// `firmadoTecnicoNombre` → 400 `firma_sin_nombre`, siempre. Nadie lo vio porque los tests del
// servidor (`scrum992`) construyen el cuerpo A MANO con el campo bueno: probaban que la ruta
// funciona cuando se le manda lo que espera, y nadie se lo mandaba.
//
// Por eso aquí NADIE escribe el cuerpo:
//   · se carga el PANEL ENTERO en el banco (`cargarDashboard`): `api.js`, `signaturePad.js`,
//     `colaDeFirmas.js` y `parteDetailView.js` de verdad;
//   · se pinta el parte, se pulsa «Firma del técnico», se escribe el nombre EN EL PAD, se traza y se
//     confirma;
//   · el cuerpo que se mira es el que salió por `fetch`;
//   · y lo que el servidor exige se LEE de `partes.routes.ts` por AST (qué campo pasa a
//     `exigirNombreFirmante` en cada ruta) y se comprueba con la función real del dominio. Si
//     mañana la ruta cambia de campo, este test lo sigue sin que nadie lo reescriba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, todos } from './_banco-vistas.mjs';
import {
  ALBARAN_ROTULOS,
  PARTE_AYUDAS,
  exigirNombreFirmante,
  firmanteCalidadOpciones,
} from '../dist/modules/jobs/domain/albaranFirmante.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = 'src/modules/jobs/app/routes/partes.routes.ts';

// ── EL CONTRATO DEL SERVIDOR, LEÍDO Y NO COPIADO ───────────────────────────────────────────────

/** Para cada ruta de firma del parte: el campo de `req.body` que pasa a `exigirNombreFirmante`. */
function campoDelNombrePorRuta() {
  const src = fs.readFileSync(path.join(RAIZ, RUTAS), 'utf8');
  const sf = ts.createSourceFile(RUTAS, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = {};
  const visitar = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'router.post') {
      const [ruta] = n.arguments;
      if (ruta && ts.isStringLiteral(ruta) && /^\/:id\/firmar/.test(ruta.text)) {
        const buscar = (m) => {
          if (ts.isCallExpression(m) && m.expression.getText(sf) === 'exigirNombreFirmante') {
            const arg = m.arguments[0];
            if (arg && ts.isPropertyAccessExpression(arg)) out[ruta.text] = arg.name.text;
          }
          m.forEachChild(buscar);
        };
        n.arguments.slice(1).forEach(buscar);
      }
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  return out;
}

test('SCRUM-1229 · SUELO: el contrato del servidor se lee de las DOS rutas de firma', () => {
  const c = campoDelNombrePorRuta();
  // Suelo: si el extractor no encuentra las dos rutas, no hay contrato contra el que medir y
  // todo lo de abajo aprobaría por no haber mirado.
  assert.deepEqual(Object.keys(c).sort(), ['/:id/firmar', '/:id/firmar-tecnico'],
    `🔴 CIEGO: no se leyó el campo del nombre de las dos rutas de firma (${JSON.stringify(c)})`);
  // Y los dos campos son DISTINTOS: si fueran el mismo, el defecto no podría existir y este test
  // no probaría nada sobre él.
  assert.notEqual(c['/:id/firmar'], c['/:id/firmar-tecnico']);
});

// ── EL BANCO: el panel entero, con una red que se puede cortar ────────────────────────────────

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'REF-778',
  entrada: '09:15', salida: '12:45', desplazamientos: 1, kilometros: 12.5,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
};

function montar() {
  const envios = [];
  const red = { caida: false };
  const responder = (cuerpo) => ({
    ok: true, status: 200,
    headers: { get: () => 'application/json' },
    json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
  });
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'POST' && /\/admin\/partes\/7\/firmar/.test(u)) {
      if (red.caida) throw new TypeError('Failed to fetch');
      envios.push({ ruta: u.replace(/^https?:\/\/[^/]+/, ''), cuerpo: JSON.parse(opts.body || '{}') });
      return responder({ ...PARTE, id: 7, estado: 'firmado' });
    }
    if (/\/admin\/partes\/7$/.test(u)) return responder(PARTE);
    return responder({});
  };
  const banco = cargarDashboard(RAIZ, {
    red: { fetch, navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } } },
  });
  // El banco no sabe de `<canvas>` (mismo parche acotado que SCRUM-466).
  const crear = banco.ctx.document.createElement;
  banco.ctx.document.createElement = function (tag) {
    const n = crear.call(this, tag);
    if (String(tag).toLowerCase() === 'canvas') {
      n.getContext = () => ({
        scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {},
        set strokeStyle(_) {}, set lineWidth(_) {}, set lineCap(_) {}, set lineJoin(_) {},
      });
      // Un PNG con cuerpo: el suelo del pad (`esTrazoUtil`) rechaza uno vacío.
      n.toDataURL = () => 'data:image/png;base64,' + 'iVBORw0KGgo'.repeat(40);
      n.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 190 });
      n.setPointerCapture = () => {};
    }
    return n;
  };
  // Lo que `/admin/me` sirve en producción (`app.ts`), de su fuente única.
  const w = banco.ctx.window;
  w.appAlbaranRotulos = ALBARAN_ROTULOS;
  w.appAlbaranFirmanteOpciones = firmanteCalidadOpciones();
  w.appParteAyudas = PARTE_AYUDAS;
  // La cola en memoria: el banco no tiene IndexedDB.
  const almacen = new Map();
  w.guardarFirmaPendiente = async (f) => { almacen.set(f.claveIdempotencia, f); return { estado: w.GUARDADO }; };
  w.quitarFirmaPendiente = async (c) => { almacen.delete(c); return { estado: w.GUARDADO }; };
  w.leerFirmasPendientes = async () => ({ estado: w.GUARDADO, firmas: [...almacen.values()] });
  return { banco, envios, red, almacen };
}

const esperar = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

/** El texto de todo el pad abierto (el último `role=dialog` del cuerpo). */
function padAbierto(banco) {
  const pads = todos(banco.ctx.document.body).filter((n) => n.getAttribute && n.getAttribute('role') === 'dialog');
  return pads[pads.length - 1] || null;
}

/** Recorre el viaje: pinta, pulsa la firma de `quien`, escribe el nombre, traza y confirma. */
async function firmarDesdeLaPantalla(m, quien, nombre) {
  const { banco } = m;
  const contenedor = banco.mk('div');
  banco.ctx.document.body.appendChild(contenedor);
  const pintado = await banco.ctx.window.renderParteDetailView(contenedor, 7);
  assert.equal(pintado, true, '🔴 CIEGO: la ficha del parte no se pintó en el banco');
  const selector = quien === 'tecnico' ? '[data-parte-firmar-tecnico]' : '[data-parte-firmar]';
  const boton = contenedor.querySelector(selector);
  assert.ok(boton, `🔴 CIEGO: no está el botón de firma del ${quien}`);
  assert.ok(boton.click() > 0, `🔴 el botón de firma del ${quien} no tiene a nadie escuchando`);
  await esperar();
  const pad = padAbierto(banco);
  assert.ok(pad, `🔴 pulsar la firma del ${quien} no abrió el pad`);
  const campo = pad.querySelector('#sp-nombre');
  assert.ok(campo, '🔴 el pad no pide el nombre de quien firma');
  campo.value = nombre;
  campo.disparar('input');
  const lienzo = pad.querySelector('canvas');
  lienzo.disparar('pointerdown');
  lienzo.disparar('pointermove');
  const ok = todos(pad).find((n) => n.tagName === 'BUTTON' && n.textContent === 'Confirmar firma');
  assert.ok(ok && !ok.disabled, '🔴 con trazo y nombre, «Confirmar firma» sigue bloqueado');
  ok.click();
  await esperar();
  return pad;
}

test('SCRUM-1229 · 🔴 EL VIAJE DEL TÉCNICO: lo que sale por la red es lo que `/firmar-tecnico` acepta', async () => {
  const m = montar();
  await firmarDesdeLaPantalla(m, 'tecnico', 'Israel Gómez');
  const contrato = campoDelNombrePorRuta()['/:id/firmar-tecnico'];

  assert.equal(m.envios.length, 1, `🔴 no salió UNA petición de firma: ${JSON.stringify(m.envios)}`);
  const { ruta, cuerpo } = m.envios[0];
  assert.equal(ruta, '/admin/partes/7/firmar-tecnico', '🔴 la firma del técnico fue a otra ruta');
  const r = exigirNombreFirmante(cuerpo[contrato]);
  assert.ok(r.ok,
    `🔴 EL SERVIDOR LA RECHAZARÍA (400 firma_sin_nombre): la ruta lee «${contrato}» y la pantalla ` +
    `mandó ${JSON.stringify(Object.keys(cuerpo))}. Es SCRUM-1229: el técnico no puede firmar nunca.`);
  assert.equal(r.nombre, 'Israel Gómez', '🔴 llegó un nombre que no es el que se escribió');
});

test('SCRUM-1229 · el pad del TÉCNICO no le habla del cliente ni le pregunta «en calidad de qué»', async () => {
  const m = montar();
  const contenedor = m.banco.mk('div');
  m.banco.ctx.document.body.appendChild(contenedor);
  await m.banco.ctx.window.renderParteDetailView(contenedor, 7);
  contenedor.querySelector('[data-parte-firmar-tecnico]').click();
  await esperar();
  const pad = padAbierto(m.banco);
  assert.ok(pad, '🔴 CIEGO: el pad no se abrió');
  const texto = todos(pad).map((n) => `${n.textContent || ''} ${n.innerHTML || ''}`).join(' ');
  assert.ok(texto.includes('Firma del técnico'), '🔴 CIEGO: este no es el pad del técnico');
  assert.ok(!/Pide al cliente/.test(texto), '🔴 el pad le dice al técnico «Pide al cliente que firme…»');
  const radios = todos(pad).filter((n) => n.tagName === 'INPUT' && n.type === 'radio');
  assert.equal(radios.length, 0,
    '🔴 al técnico se le pregunta «en calidad de qué»: SCRUM-653 c.14494 lo dejó fuera a propósito');
});

test('SCRUM-1229 · ✅ CONTROL POSITIVO: el cliente sigue firmando igual, con su «en calidad de qué»', async () => {
  const m = montar();
  const pad = await firmarDesdeLaPantalla(m, 'cliente', 'Ana Ruiz');
  const contrato = campoDelNombrePorRuta()['/:id/firmar'];
  assert.equal(m.envios.length, 1);
  assert.equal(m.envios[0].ruta, '/admin/partes/7/firmar');
  assert.ok(exigirNombreFirmante(m.envios[0].cuerpo[contrato]).ok, '🔴 la firma del CLIENTE se ha roto');
  const radios = todos(pad).filter((n) => n.tagName === 'INPUT' && n.type === 'radio');
  assert.ok(radios.length > 0, '🔴 al cliente se le ha quitado el «en calidad de qué»');
});

test('SCRUM-1229 · 🔴 SIN RED: la firma del técnico se encola y, al volver la red, sube con SU nombre', async () => {
  const m = montar();
  m.red.caida = true;
  await firmarDesdeLaPantalla(m, 'tecnico', 'Israel Gómez');
  assert.equal(m.envios.length, 0, 'sin red no puede haber salido nada');
  assert.equal(m.almacen.size, 1, `🔴 sin red la firma del técnico no quedó en la cola (${m.almacen.size})`);

  m.red.caida = false;
  const w = m.banco.ctx.window;
  const res = await w.drenarFirmasPendientes(w.subirFirmaDeLaCola);
  assert.equal(res.subidas, 1, `🔴 al volver la red no subió: ${JSON.stringify(res.fallidas)}`);
  const contrato = campoDelNombrePorRuta()['/:id/firmar-tecnico'];
  const { ruta, cuerpo } = m.envios[0];
  assert.equal(ruta, '/admin/partes/7/firmar-tecnico');
  assert.ok(exigirNombreFirmante(cuerpo[contrato]).ok,
    `🔴 la COLA la sube sin «${contrato}» (${JSON.stringify(Object.keys(cuerpo))}): el servidor la ` +
    'rechazaría, y además la sacaría de la cola como rechazada — la firma se perdería.');
});
