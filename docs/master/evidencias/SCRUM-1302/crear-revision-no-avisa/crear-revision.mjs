// docs/master/evidencias/SCRUM-1302/crear-revision-no-avisa/crear-revision.mjs — SCRUM-1302
//
// LA CONDICIÓN DE LA FIRMA DEL ENLACE VIEJO (SCRUM-1302, comentario 19454): el enlace de la versión
// anterior deja de servir al CREAR la revisión, SÓLO SI el panel se lo dice al profesional. Antes de
// construir nada hay que saber qué le dice HOY el panel cuando pulsa «Crear revisión».
//
// Monta la ficha real del presupuesto (`public/dashboard/js`, con el banco de `tests/_banco-vistas.mjs`)
// con una versión ENVIADA y sin decidir, pulsa el botón UNA vez y anota todo lo que el profesional
// puede leer o tiene que contestar entre el clic y el final.
// ⛔ Sin red y sin base: el POST lo contesta el guion.
//
// Uso: node docs/master/evidencias/SCRUM-1302/crear-revision-no-avisa/crear-revision.mjs [--escribir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from '../../../../../tests/_banco-vistas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..', '..', '..', '..');

const salida = [];
const decir = (l = '') => { salida.push(l); console.log(l); };
let fallos = 0;
const exigir = (cond, texto) => { if (!cond) { fallos += 1; decir(`   🔴 NO SE CUMPLE: ${texto}`); } };

const presupuesto = {
  id: 1, number: 7, quoteNumber: 7, revision: 0, numeroConRevision: 'P7', vigenteId: 1,
  revisiones: [{ id: 1, revision: 0, numero: 'P7', status: 'sent', firmado: false, total: '121.00', createdAt: '2026-09-20T10:00:00.000Z', vigente: true }],
  status: 'sent', total: '121.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1302', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
};
const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: status >= 400 ? 'Conflict' : 'Created',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});
const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const pausa = (ms = 60) => new Promise((ok) => setTimeout(ok, ms));
const NOMBRA_EL_ENLACE = /enlace|link|deja(r[aá])? de (valer|servir)|ya no (vale|sirve)/i;

/** Monta la ficha. `alPost` contesta el POST; devuelve lo que el guion necesita para mirar. */
async function ficha(alPost) {
  const posts = [];
  const preguntas = [];   // confirm / alert / prompt que el profesional tendría que contestar
  const viajes = [];      // a dónde lleva la pantalla al terminar
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/quotes\/1$/.test(String(url)) ? presupuesto : []),
    red: {
      fetch: async (url, opts) => {
        const u = String(url);
        const metodo = String((opts && opts.method) || 'GET').toUpperCase();
        if (metodo === 'POST' && /\/admin\/quotes\/\d+\/revisiones$/.test(u)) { posts.push(u); return alPost(); }
        return respuesta(200, /\/admin\/quotes\/1$/.test(u) ? presupuesto : []);
      },
    },
  });
  banco.ctx.appUserRole = 'admin';
  banco.ctx.renderAppView = (vista, args) => { viajes.push(`${vista} ${JSON.stringify(args)}`); };
  for (const nombre of ['confirm', 'alert', 'prompt']) {
    banco.ctx[nombre] = (t) => { preguntas.push(`${nombre}: ${t}`); return true; };
  }
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  if (r.error) throw new Error(`CIEGO: la ficha revienta: ${r.error.message}`);
  const seccion = todos(r.contenedor).filter((n) => attr(n, 'data-seccion-revisiones') === '1');
  if (seccion.length !== 1) throw new Error(`CIEGO: se esperaba UNA sección de revisiones; hay ${seccion.length}`);
  const btn = todos(seccion[0]).filter((n) => attr(n, 'data-revision-crear') != null);
  if (btn.length !== 1) throw new Error(`CIEGO: el admin no ve «Crear revisión» (${btn.length})`);
  // El banco NO agrega `textContent` (su cabecera, punto 4): el texto de un bloque es el de TODOS sus nodos.
  const textoDe = (n) => todos(n).map((x) => String(x.textContent || '')).join(' ').replace(/\s+/g, ' ').trim();
  return {
    posts, preguntas, viajes, btn: btn[0],
    seccion: () => textoDe(seccion[0]),
    pagina: () => textoDe(r.contenedor),
  };
}

decir('SCRUM-1302 · qué le dice el panel al profesional al pulsar «Crear revisión»');
decir('pieza medida: public/dashboard/js/quoteRevisiones.js + quotesDetailView.js (la ficha real, montada entera)');
decir('caso: P7, versión única, ENVIADA y sin decidir (el cliente tiene su enlace vivo)');
decir();

// ── 0 · CONTROL POSITIVO: la sonda VE un texto que aparece tras el clic ─────────────────────────
{
  const f = await ficha(() => respuesta(500, { error: 'internal_error' }));
  const antes = f.seccion();
  f.btn.click(); await pausa();
  const despues = f.seccion();
  decir('0 · control · el POST falla: la sonda tiene que ver el aviso que aparece');
  decir(`   sección antes : «${antes}»`);
  decir(`   sección después: «${despues}»`);
  exigir(f.posts.length === 1, 'el clic no llegó a hacer el POST: no hay viaje que medir');
  exigir(despues !== antes && /No se ha podido crear la revisión/.test(despues), 'la sonda no ve un texto nuevo tras el clic: está ciega');
  exigir(NOMBRA_EL_ENLACE.test('Ese enlace dejará de servir'), 'el patrón que busca el aviso no casa con un aviso de ejemplo');
  decir();
}

// ── 1 · EL VIAJE: un clic, el POST sale bien ─────────────────────────────────────────────────────
{
  let soltar;
  const enVuelo = new Promise((ok) => { soltar = ok; });
  const f = await ficha(async () => { await enVuelo; return respuesta(201, { ok: true, id: 2, revision: 1, numero: 'P7' }); });
  const paginaAntes = f.pagina();
  const antes = f.seccion();
  f.btn.click(); await pausa();
  const durante = f.seccion();
  const postsDurante = f.posts.length;
  const preguntasDurante = f.preguntas.length;
  soltar(); await pausa();
  const despues = f.seccion();

  decir('1 · un clic en «Crear revisión», el servidor contesta 201');
  decir(`   la ficha entera, antes del clic, ¿nombra el enlace del cliente junto a la revisión? sección: «${antes}»`);
  decir(`   preguntas antes del POST (confirm / alert / prompt): ${preguntasDurante}`);
  decir(`   POST hechos con UN clic, sin contestar nada: ${postsDurante}`);
  decir(`   sección con el POST en vuelo : «${durante}»`);
  decir(`   sección al terminar          : «${despues}»`);
  decir(`   preguntas en total: ${f.preguntas.length}${f.preguntas.length ? ` → ${f.preguntas.join(' | ')}` : ''}`);
  decir(`   a dónde lleva: ${f.viajes.join(' | ') || 'a ninguna parte'}`);
  const nombra = [antes, durante, despues].filter((t) => NOMBRA_EL_ENLACE.test(t)).length;
  decir(`   textos de la sección de revisiones que nombran el enlace o que deja de valer: ${nombra} de 3`);
  decir(`   (la ficha entera mide ${paginaAntes.length} caracteres; fuera de la sección sí habla de enlaces: ${NOMBRA_EL_ENLACE.test(paginaAntes.replace(antes, '')) ? 'sí' : 'no'})`);
  decir();
  decir(`VEREDICTO: ${postsDurante === 1 && f.preguntas.length === 0 && nombra === 0
    ? 'HOY NO AVISA. Un clic crea la revisión sin preguntar y sin nombrar el enlace anterior, ni antes ni después.'
    : 'HOY SÍ dice algo: leer las líneas de arriba.'}`);
}

decir(`EXIT=${fallos === 0 ? 0 : 1} · controles que no se cumplen: ${fallos}`);
if (process.argv.includes('--escribir')) {
  fs.writeFileSync(path.join(AQUI, 'crear-revision.txt'), salida.join('\n') + '\n');
}
process.exit(fallos === 0 ? 0 : 1);
