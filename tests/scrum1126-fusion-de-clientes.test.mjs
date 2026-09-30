// SCRUM-1126 · FUSIONAR DOS CLIENTES DUPLICADOS DESDE LA FICHA.
//
// `GET /admin/customers/:id/fusion-preview` y `POST /admin/customers/:id/fusionar` (SCRUM-1057)
// estaban construidos y la sonda de SCRUM-1185 los daba SIN consumidor. Aquí se monta la ficha REAL
// (banco de vistas) y se PULSA: «Fusionar con otro cliente» → elegir → previsualización → «Fusionar».
//
// Lo que se mide, con su mitad negativa, que es donde se cae este tipo de pantalla:
//   · sin confirmar NO sale el POST (ni al elegir, ni al cancelar, ni con una previsualización
//     bloqueada), y con confirmar sale UNO con el `con` del elegido;
//   · el 409 `factura_emitida` NO cierra nada, enseña su motivo firmado y no se deja reintentar;
//   · el código crudo del servidor NO se pinta, ni el «Failed to fetch» del navegador;
//   · `nifDistintos` se avisa cuando toca, y sólo entonces;
//   · tras fusionar, la lista se vuelve a pedir al servidor y el fusionado ya no se ofrece.
//
// GO del fundador para la UI: SCRUM-1126 comentario 17572. Textos: SCRUM-1126 comentario 17575
// (registro: docs/microcopy/2026-09-29-SCRUM-1126-fusion-de-clientes.md).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { constaAprobado, aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const espera = () => new Promise((r) => setTimeout(r, 30));

const cliente = (id, name, taxId = null, tags = null) => ({
  id, name, phone: null, mobile: null, email: null, notes: null, portalToken: null,
  createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false, taxId, tags,
});
const ANA = cliente(11260, 'Ana Fusión 1126', 'B12345678', ['vip']);
const ANA_DUP = cliente(11261, 'ANA FUSION 1126', 'B87654321', ['obra']);
const OTRO = cliente(11262, 'Otro Cliente 1126');
const STATS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };

const previaOk = (fusionado, extra = {}) => ({
  bloqueada: null,
  principal: { id: ANA.id, name: ANA.name, taxId: ANA.taxId, tags: ANA.tags },
  fusionado: { id: fusionado.id, name: fusionado.name, taxId: fusionado.taxId, tags: fusionado.tags },
  quotesAMover: 2, jobsAMover: 1, notasAMover: 3,
  etiquetasResultantes: ['vip', 'obra'], nifDistintos: false, ...extra,
});

const json = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: '',
  headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo),
});

/**
 * Monta la ficha de ANA. `previa(con)` devuelve la previsualización; `fusionar` es la respuesta del
 * POST: 'ok' (200 y el servidor BORRA al fusionado de su lista), `{ status, error }`, o 'sin-red'.
 */
async function montarFicha({ rol = 'admin', previa = (con) => previaOk(con === ANA_DUP.id ? ANA_DUP : OTRO), fusionar = 'ok' } = {}) {
  const servidor = { clientes: [ANA, ANA_DUP, OTRO] };
  const peticiones = [];
  const red = {
    fetch: async (url, opts = {}) => {
      const u = String(url);
      const metodo = String(opts.method || 'GET').toUpperCase();
      peticiones.push({ url: u, metodo, cuerpo: opts.body ? JSON.parse(opts.body) : null });
      if (/\/admin\/customers\/\d+\/fusionar$/.test(u)) {
        if (fusionar === 'sin-red') throw new TypeError('Failed to fetch');
        if (fusionar === 'ok') {
          const con = JSON.parse(opts.body).con;
          servidor.clientes = servidor.clientes.filter((c) => c.id !== con);
          return json(200, { principalId: ANA.id, fusionadoId: con, quotesMovidos: 2, jobsMovidos: 1, notasMovidas: 3, nifDistintos: false });
        }
        return json(fusionar.status, { error: fusionar.error });
      }
      const mPrevia = u.match(/\/admin\/customers\/\d+\/fusion-preview\?con=(\d+)$/);
      if (mPrevia) return json(200, previa(Number(mPrevia[1])));
      if (/\/admin\/customers\/\d+\/detail$/.test(u)) return json(200, { customer: ANA, quotes: [], invoices: [], events: [], stats: STATS });
      if (/\/admin\/customers\/\d+\/historial/.test(u)) return json(200, { trabajos: [], partesSueltos: [] });
      if (/\/admin\/customers\/\d+\/whatsapp/.test(u)) return json(200, { waOptOut: false, mensajes: [] });
      if (/\/admin\/customers(\?.*)?$/.test(u)) return json(200, servidor.clientes);
      return json(200, []);
    },
  };
  const banco = cargarDashboard(RAIZ, { rol, red });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const toasts = [];
  banco.ctx.showToast = (msg) => { toasts.push(msg); };
  const r = await pintarVista(banco, 'renderCustomer360View', ANA.id);
  assert.equal(r.error, null, `la ficha no montó: ${r.error && r.error.message}`);
  await espera();
  const c = r.contenedor;
  const cuerpo = banco.ctx.document.body;
  assert.ok(todos(c).some((n) => n.tagName === 'H2' && /Ana Fusión 1126/.test(n.textContent || n._html || '')),
    '🔴 CIEGO: la ficha no pintó ni el nombre del cliente');
  const porId = (id) => todos(cuerpo).find((n) => n.id === id) || null;
  const boton = () => porId('btn-fusionar-360');
  const modal = () => todos(cuerpo).find((n) => String(n.className || '').split(' ')[0] === 'modal-overlay') || null;
  const candidatos = () => (modal() ? todos(modal()).filter((n) => n.tagName === 'BUTTON' && String(n.className).split(' ').includes('fusion-candidato')) : []);
  const visible = (n) => (n ? todos(n).map((x) => x._texto || x.textContent || '').join(' | ') : '');
  const aviso = () => { const a = porId('fusion-alert'); return a ? a.textContent : null; };
  const posts = () => peticiones.filter((p) => /\/fusionar$/.test(p.url));
  const previas = () => peticiones.filter((p) => /\/fusion-preview\?/.test(p.url));
  const listas = () => peticiones.filter((p) => p.metodo === 'GET' && /\/admin\/customers(\?.*)?$/.test(p.url));
  const abrir = async () => { await boton().disparar('click'); await espera(); };
  const elegir = async (id) => {
    const b = candidatos().find((n) => n.dataset.id === String(id));
    assert.ok(b, `🔴 el cliente ${id} no se ofrece para fusionar`);
    await b.disparar('click');
    await espera();
  };
  const confirmar = () => porId('fusion-confirmar');
  const pulsarFusionar = async () => { await confirmar().disparar('click'); await espera(); };
  return { banco, c, cuerpo, peticiones, toasts, servidor, boton, modal, candidatos, visible, aviso, posts, previas, listas, abrir, elegir, confirmar, pulsarFusionar, porId };
}

const F = () => {
  // Las piezas sin DOM, desde el mismo global que usa la pantalla.
  const banco = cargarDashboard(RAIZ, {});
  return { F: banco.ctx.fusionCliente, ctx: banco.ctx };
};

test('SCRUM-1126 · el botón sólo existe para admin (las dos rutas son requireRole admin)', async () => {
  const admin = await montarFicha();
  assert.ok(admin.boton(), '🔴 la ficha no tiene «Fusionar con otro cliente»: las rutas siguen sin consumidor');
  assert.equal(admin.boton().textContent || admin.boton()._texto, 'Fusionar con otro cliente');
  const tecnico = await montarFicha({ rol: 'tecnico' });
  assert.equal(tecnico.boton(), null, 'a un técnico no se le ofrece: sería un 403');
});

test('SCRUM-1126 · 🔴 elegir pide la previsualización ANTES, y sin «Fusionar» NO sale el POST (tampoco al cancelar)', async () => {
  const f = await montarFicha();
  const listasAntes = f.listas().length;
  await f.abrir();
  assert.ok(f.modal(), 'el botón no abrió nada');
  assert.equal(f.listas().length, listasAntes + 1, 'al abrir se pide la lista de clientes al servidor');
  const ofrecidos = f.candidatos().map((b) => b.dataset.id);
  assert.deepEqual(ofrecidos.sort(), [String(ANA_DUP.id), String(OTRO.id)], 'se ofrecen todos MENOS el de la ficha');
  assert.equal(f.confirmar().disabled, true, 'sin elegir, «Fusionar» está desactivado');

  await f.elegir(ANA_DUP.id);
  assert.equal(f.previas().length, 1, '🔴 elegir no pidió la previsualización');
  assert.match(f.previas()[0].url, /\/admin\/customers\/11260\/fusion-preview\?con=11261$/, ':id es el de la ficha, con= el elegido');
  assert.equal(f.posts().length, 0, '🔴 elegir ya fusionó: el POST salió sin confirmación');
  assert.equal(f.confirmar().disabled, false, 'con una previsualización buena se puede confirmar');
  const texto = f.visible(f.modal());
  const F_ = f.banco.ctx.fusionCliente;
  for (const esperado of [
    'Revisa la fusión antes de confirmar',
    'Se queda: Ana Fusión 1126 (sus datos no cambian)',
    'Desaparece: ANA FUSION 1126',
    // 30-sep-2026: firmas 17647 (direcciones de obra) y 17580 (singular: «1 trabajo», no «1 trabajos»).
    'Todo lo de ANA FUSION 1126 pasa a Ana Fusión 1126: presupuestos, solicitudes de presupuesto, trabajos, direcciones de obra, notas, cobros, partes de trabajo, mensajes de WhatsApp, correos y mantenimientos.',
    'Contados: 2 presupuestos · 1 trabajo · 3 notas',
    'Las personas de contacto de ANA FUSION 1126 se quedan sin empresa.',
    'Etiquetas tras fusionar: vip, obra',
    'Esta acción no se puede deshacer. ANA FUSION 1126 dejará de existir.',
  ]) assert.ok(texto.includes(esperado), `🔴 la previsualización no dice «${esperado}»\n${texto}`);
  assert.ok(F_, 'CIEGO: la pantalla no publica fusionCliente');

  await f.porId('fusion-cancelar').disparar('click');
  await espera();
  assert.equal(f.modal(), null, '«Cancelar» cierra');
  assert.equal(f.posts().length, 0, '🔴 cancelar fusionó');
});

test('SCRUM-1126 · 🔴 «Fusionar» manda UN POST con el elegido, cierra, avisa, recarga la ficha — y el fusionado desaparece de la lista', async () => {
  const f = await montarFicha();
  await f.abrir();
  await f.elegir(ANA_DUP.id);
  const fichasAntes = f.peticiones.filter((p) => /\/11260\/detail$/.test(p.url)).length;
  await f.pulsarFusionar();
  assert.equal(f.posts().length, 1, '🔴 esperaba exactamente un POST /fusionar');
  assert.equal(f.posts()[0].metodo, 'POST');
  assert.match(f.posts()[0].url, /\/admin\/customers\/11260\/fusionar$/);
  assert.deepEqual(f.posts()[0].cuerpo, { con: ANA_DUP.id });
  assert.equal(f.modal(), null, 'tras fusionar, el modal se cierra');
  assert.deepEqual(f.toasts, ['Clientes fusionados']);
  assert.equal(f.peticiones.filter((p) => /\/11260\/detail$/.test(p.url)).length, fichasAntes + 1, 'la ficha del que se queda se recarga');

  // La lista NO se guarda en el panel: se vuelve a pedir, y lo que dice el servidor manda.
  const listasAntes = f.listas().length;
  await f.abrir();
  assert.equal(f.listas().length, listasAntes + 1, '🔴 la lista no se volvió a pedir: se ofrecería un cliente que ya no existe');
  assert.deepEqual(f.candidatos().map((b) => b.dataset.id), [String(OTRO.id)], '🔴 el fusionado se sigue ofreciendo');
  // Y la lista de Clientes, montada después, tampoco lo trae (la pide al servidor al pintarse).
  const r = await pintarVista(f.banco, 'renderCustomersView');
  assert.equal(r.error, null);
  await espera();
  const nombres = todos(r.contenedor).map((n) => n._texto || '').join(' ');
  assert.ok(nombres.includes('Otro Cliente 1126'), 'CIEGO: la lista no pintó ni al que queda');
  assert.ok(!nombres.includes('ANA FUSION 1126'), '🔴 el fusionado sigue en la lista de Clientes');
});

test('SCRUM-1126 · 🔴 409 factura_emitida: NO se fusiona, se ve el motivo firmado, no se reintenta y el código crudo no sale', async () => {
  const f = await montarFicha({ fusionar: { status: 409, error: 'factura_emitida' } });
  await f.abrir();
  await f.elegir(ANA_DUP.id);
  await f.pulsarFusionar();
  assert.equal(f.posts().length, 1, 'CIEGO: el POST no llegó a salir, así que el 409 no se midió');
  assert.ok(f.modal(), '🔴 el modal se cerró como si hubiera fusionado');
  assert.deepEqual(f.toasts, [], '🔴 se avisó de éxito con un 409');
  assert.equal(f.aviso(), 'No se puede fusionar: uno de los dos tiene una factura emitida, y una factura emitida no se modifica.');
  // POSITIVO con el mismo token (SCRUM-237): el código SÍ vino en la respuesta…
  assert.equal(JSON.stringify({ error: 'factura_emitida' }).includes('factura_emitida'), true);
  // …y NO llega a la pantalla.
  assert.ok(!f.visible(f.modal()).includes('factura_emitida'), '🔴 se pinta el código crudo del servidor');
  await f.pulsarFusionar();
  assert.equal(f.posts().length, 1, '🔴 tras un 409 se puede volver a pulsar y sale otro POST');
});

test('SCRUM-1126 · 🔴 si la previsualización ya viene bloqueada, se avisa ANTES y «Fusionar» no llama', async () => {
  const f = await montarFicha({ previa: () => ({ ...previaOk(ANA_DUP), bloqueada: 'factura_emitida', etiquetasResultantes: null }) });
  await f.abrir();
  await f.elegir(ANA_DUP.id);
  assert.equal(f.aviso(), 'No se puede fusionar: uno de los dos tiene una factura emitida, y una factura emitida no se modifica.');
  assert.equal(f.confirmar().disabled, true, 'bloqueada: no se ofrece confirmar');
  assert.ok(!f.visible(f.modal()).includes('dejará de existir'), 'bloqueada: no se pinta la confirmación');
  await f.pulsarFusionar();
  assert.equal(f.posts().length, 0, '🔴 un clic en el botón desactivado fusionó igual');
});

test('SCRUM-1126 · los otros dos motivos del 409 llevan su texto; un código desconocido, un 500 y sin red, el genérico', async () => {
  const casos = [
    [{ status: 409, error: 'mismo_cliente' }, 'Elige un cliente distinto.'],
    [{ status: 409, error: 'cliente_no_encontrado' }, 'Uno de los clientes ya no existe. Recarga la lista.'],
    [{ status: 409, error: 'otro_motivo_nuevo' }, 'No se ha podido completar la acción. Vuelve a intentarlo.'],
    [{ status: 500, error: 'internal_error' }, 'No se ha podido completar la acción. Vuelve a intentarlo.'],
    ['sin-red', 'No se ha podido completar la acción. Vuelve a intentarlo.'],
  ];
  for (const [fusionar, esperado] of casos) {
    const f = await montarFicha({ fusionar });
    await f.abrir();
    await f.elegir(ANA_DUP.id);
    await f.pulsarFusionar();
    assert.equal(f.posts().length, 1, `CIEGO (${JSON.stringify(fusionar)}): el POST no salió`);
    assert.equal(f.aviso(), esperado, `con ${JSON.stringify(fusionar)}`);
    assert.ok(f.modal(), 'no se cierra con un error');
    const texto = f.visible(f.modal());
    assert.ok(!/internal_error|otro_motivo_nuevo|Failed to fetch|API \d{3}/.test(texto), `🔴 sale texto crudo: ${texto}`);
  }
});

test('SCRUM-1126 · el aviso de NIF distintos sale cuando nifDistintos, con los dos NIF, y NO cuando no', async () => {
  const con = await montarFicha({ previa: () => previaOk(ANA_DUP, { nifDistintos: true }) });
  await con.abrir();
  await con.elegir(ANA_DUP.id);
  assert.ok(con.visible(con.modal()).includes('Ojo: los NIF no coinciden (B12345678 / B87654321). Comprueba que es el mismo cliente.'),
    '🔴 nifDistintos no se avisa');
  assert.equal(con.confirmar().disabled, false, 'es un aviso, no un bloqueo');

  const sin = await montarFicha();
  await sin.abrir();
  await sin.elegir(ANA_DUP.id);
  assert.ok(sin.visible(sin.modal()).includes('Revisa la fusión'), 'CIEGO: la previsualización no se pintó');
  assert.ok(!sin.visible(sin.modal()).includes('los NIF no coinciden'), '🔴 se avisa de NIF distintos sin que lo sean');
});

test('SCRUM-1126 · buscar filtra por nombre o NIF (lo que promete el placeholder), sin acentos ni mayúsculas', async () => {
  const f = await montarFicha();
  await f.abrir();
  const buscar = f.porId('fusion-buscar');
  assert.equal(buscar.placeholder, 'Busca por nombre o NIF');
  buscar.value = 'b8765';
  await buscar.disparar('input');
  assert.deepEqual(f.candidatos().map((b) => b.dataset.id), [String(ANA_DUP.id)], 'por NIF');
  buscar.value = 'otro cliente';
  await buscar.disparar('input');
  assert.deepEqual(f.candidatos().map((b) => b.dataset.id), [String(OTRO.id)], 'por nombre');
  buscar.value = 'ana fusion';
  await buscar.disparar('input');
  assert.deepEqual(f.candidatos().map((b) => b.dataset.id), [String(ANA_DUP.id)], 'el de la ficha NO se ofrece aunque case');
  buscar.value = 'zzz-nadie';
  await buscar.disparar('input');
  assert.equal(f.candidatos().length, 0);
  assert.ok(f.visible(f.modal()).includes('Sin resultados para tu búsqueda'));
});

test('SCRUM-1126 · textos: cada uno consta firmado en SCRUM-1126, y los reusados son byte a byte los de su origen', () => {
  const { F: FC, ctx } = F();
  assert.ok(FC, 'CIEGO: fusionCliente no se publica');
  const T = FC.TEXTOS;
  const firmados = [
    T.boton, T.selector, T.placeholder, T.tituloPrevia, T.sinEtiquetas, T.confirmar, T.exito,
    ...Object.values(T.MOTIVOS),
    FC.seQueda('{principal}'), FC.desaparece('{fusionado}'), FC.todoPasa('{fusionado}', '{principal}'),
    FC.contados('{n}', '{n}', '{n}'), FC.sinEmpresa('{fusionado}'), FC.etiquetas(['{lista}']),
    FC.avisoNif('{nif1}', '{nif2}'), FC.confirmacion('{fusionado}'),
  ];
  for (const t of firmados) {
    assert.ok(constaAprobado(t).some((f) => f.includes('SCRUM-1126')), `🔴 «${t}» no consta firmado en SCRUM-1126`);
  }
  assert.deepEqual(constaAprobado('Pasan a {principal}: {n} presupuestos · {n} trabajos · {n} notas'), [],
    'CONTROL NEGATIVO: la línea que la firma rechazó no consta');
  assert.equal(T.generico, ctx.TEXTO_ERROR_GENERICO, 'el genérico es el de patronDetalleAcciones.js (SCRUM-1124)');
  assert.equal(T.sinResultados, ctx.buscadorDeClientes.TEXTOS.sinResultados, 'el vacío es el del buscador de la lista');
  assert.deepEqual(Object.keys(T.MOTIVOS).sort(), ['cliente_no_encontrado', 'factura_emitida', 'mismo_cliente'],
    'un texto por cada motivo del 409, y ni uno más');
  // Los tres motivos son EXACTAMENTE los del servidor: si mañana añade uno, esto lo dice.
  const dominio = fs.readFileSync(path.join(RAIZ, 'src/modules/system/domain/fusionClientes.ts'), 'utf8');
  const tipo = dominio.match(/export type MotivoRechazoFusion = ([^;]+);/);
  assert.ok(tipo, 'CIEGO: no encuentro MotivoRechazoFusion en el dominio');
  assert.deepEqual([...tipo[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort(), Object.keys(T.MOTIVOS).sort());
});

// ── 30-sep-2026 · los dos textos firmados después de la entrega ──────────────────────────────
// `todoPasa` nombra las direcciones de obra (firma del FUNDADOR, c.17647: SCRUM-1291 hizo que la
// fusión las moviera) y el singular de `contados` (c.17580). Los literales se LEEN de su registro
// de aprobación, no se teclean aquí: si alguien reescribe la pantalla —aunque sea para mejorarla—
// deja de coincidir y cae (patrón de scrum1154).

/** El registro de aprobación de SCRUM-1126 cuyo nombre lleva `ranura`, y que cuenta como aprobado. */
function registro1126(ranura) {
  const r = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1126' && a.ranura === ranura);
  assert.ok(r, `🔴 no existe el registro docs/microcopy/…-SCRUM-1126-${ranura}.md`);
  assert.equal(r.aprobada, true, `🔴 el registro de ${ranura} no cuenta como aprobado (firmante: ${r.firmante})`);
  return r;
}
const TODO_PASA_FIRMADO = () => {
  const r = registro1126('fusion-direcciones-de-obra');
  assert.equal(r.firmante, 'fundador', '🔴 la firma de 17647 es del fundador');
  const l = r.literales.filter((x) => x.startsWith('Todo lo de {fusionado} pasa a {principal}:'));
  assert.equal(l.length, 1, `🔴 el registro de 17647 debe tener UN literal de todoPasa, tiene ${l.length}`);
  return l[0];
};
const rellenar = (t, fusionado, principal) => t.split('{fusionado}').join(fusionado).split('{principal}').join(principal);

test('SCRUM-1126 · 🔴 «Todo lo de… pasa a…» es, carácter a carácter, el firmado el 30-sep (nombra las direcciones de obra)', async () => {
  const firmado = TODO_PASA_FIRMADO();
  assert.ok(firmado.includes('direcciones de obra'), 'el literal leído es el de 17647, no el de 17575');
  const { F: FC } = F();
  assert.equal(FC.todoPasa('{fusionado}', '{principal}'), firmado, '🔴 FUSION_CLIENTE.todoPasa no es el literal firmado');

  // Y en la pantalla montada, con los nombres de verdad.
  const f = await montarFicha();
  await f.abrir();
  await f.elegir(ANA_DUP.id);
  const texto = f.visible(f.modal());
  // CONTROL: el detector ve un texto firmado que SÍ está, para que su «no está» valga algo.
  assert.ok(texto.includes(FC.seQueda(ANA.name)), 'CIEGO: la previsualización no pinta ni «Se queda»');
  assert.ok(texto.includes(rellenar(firmado, ANA_DUP.name, ANA.name)), '🔴 la previsualización no pinta el texto firmado de 17647');
  // Y el de 17575, que sustituye, ya no se pinta.
  const viejo = registro1126('fusion-de-clientes').literales.find((x) => x.startsWith('Todo lo de {fusionado}'));
  assert.ok(viejo && !viejo.includes('direcciones de obra'), 'CIEGO: no encuentro el todoPasa de 17575');
  assert.ok(!texto.includes(rellenar(viejo, ANA_DUP.name, ANA.name)), '🔴 se sigue pintando el todoPasa de 17575, sin direcciones de obra');
});

test('SCRUM-1126 · 🔴 «Contados» en singular con UNO y en plural con 0 y con 2+, POR ELEMENTO (c.17580)', async () => {
  const lits = registro1126('fusion-singular-contados').literales;
  const [p1, t1, n1, pN, tN, nN] = ['1 presupuesto', '1 trabajo', '1 nota', '{n} presupuestos', '{n} trabajos', '{n} notas']
    .map((x) => { assert.ok(lits.includes(x), `🔴 el registro de 17580 no firma «${x}»`); return x; });
  // El molde de la línea, del registro de 17575: «Contados: » y « · » no se teclean aquí.
  const molde = registro1126('fusion-de-clientes').literales.find((x) => x.startsWith('Contados:'));
  assert.equal(molde, ['Contados: ' + pN, tN, nN].join(' · '), 'CIEGO: el molde de 17575 no es el esperado');
  const linea = (a, b, c) => 'Contados: ' + [a, b, c].join(' · ');
  const n = (t, k) => t.replace('{n}', String(k));

  const { F: FC } = F();
  const casos = [
    [[1, 1, 1], linea(p1, t1, n1)],                  // singular en los tres
    [[2, 2, 2], linea(n(pN, 2), n(tN, 2), n(nN, 2))], // plural en los tres: poner SIEMPRE el singular cae aquí
    [[0, 0, 0], linea(n(pN, 0), n(tN, 0), n(nN, 0))], // con 0, plural
    [[1, 4, 0], linea(p1, n(tN, 4), n(nN, 0))],       // por elemento, no por la línea
    [[3, 1, 1], linea(n(pN, 3), t1, n1)],             // y no mirando sólo el primero
  ];
  for (const [[a, b, c], esperado] of casos) assert.equal(FC.contados(a, b, c), esperado, `🔴 contados(${a}, ${b}, ${c})`);

  // Y pintado: una previsualización con 1 presupuesto, 4 trabajos y 1 nota.
  const f = await montarFicha({ previa: () => previaOk(ANA_DUP, { quotesAMover: 1, jobsAMover: 4, notasAMover: 1 }) });
  await f.abrir();
  await f.elegir(ANA_DUP.id);
  const texto = f.visible(f.modal());
  assert.ok(texto.includes(linea(p1, n(tN, 4), n1)), `🔴 la previsualización no dice «${linea(p1, n(tN, 4), n1)}»`);
  assert.ok(!texto.includes('1 presupuestos'), '🔴 la pantalla sigue diciendo «1 presupuestos»');
});
