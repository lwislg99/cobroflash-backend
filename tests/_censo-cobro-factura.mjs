// tests/_censo-cobro-factura.mjs — SCRUM-285 (B4)
//
// CENSO DERIVADO de las acciones que TOCAN EL COBRO desde la vista de factura. La pregunta NO es
// «¿está en la vista?» (eso fue SCRUM-283) sino «¿toca el cobro?», y se responde por el ENDPOINT que
// llama el handler de cada acción — NO por el registro. «Está en el registro» ≠ «toca cobro»: por esa
// vía btnPdf tocaría cobro (lleva un enlace de pago dentro del documento) y eso es señal de criterio
// malo. Se mide lo que la acción HACE (su endpoint), no dónde vive.
//
// POBLACIÓN DECLARADA:
//   · fichero:  public/dashboard/js/invoiceDetailView.js
//   · frontera: la función renderInvoiceDetailView (el cuerpo de la vista)
//   · mido:     el endpoint (fetch / apiRequest / window.open) del handler de cada botón
//   · excluyo:  la carga (fetchInvoiceDetail, no es acción), la navegación (btnBack), y los botones
//               cuyo endpoint no opera sobre el pago o el charge (Abrir PDF, Rectificar, Regenerar,
//               Anular, Reenviar por WhatsApp).
//
// CRITERIO (decisión del asesor, no candidato): una acción TOCA COBRO si su endpoint opera sobre el
// pago o el charge. El DESTINO sale del OBJETO sobre el que actúa el endpoint:
//     /charges/:id/...   → Cobros     · /invoices/:id/(status|payment-anomaly|send-reminder) → Factura
// Divergencia MEDIDA y anotada: btnDispute llama a /invoices/:id/dispute-package (URL bajo /invoices/)
// pero su OBJETO es el charge (un chargeback es el cobro yéndose para atrás, como Bizum) → Cobros. Es
// el ÚNICO caso donde la URL y el objeto divergen; manda el objeto, y queda escrito por qué.
//
// Por qué Bizum-manual y Marcar-pagada van a sitios distintos siendo las dos «registrar un cobro a
// mano»: no es intención, es objeto. En Bizum-manual EXISTE un charge sobre el que actuar (/charges/);
// en transferencia/efectivo NO hay charge y el registro se escribe en la factura (/invoices/status).
import ts from 'typescript';

export const FUNCION_VISTA = 'renderInvoiceDetailView';

// El criterio, declarado: qué endpoints tocan cobro y a qué objeto pertenecen. La CLASIFICACIÓN de
// cada acción se DERIVA midiendo su endpoint en el árbol y casándolo aquí; esto es el criterio, no la
// lista de acciones (esa se deriva).
const REGLAS_COBRO = [
  { re: /\/charges\/[^/`'"]+\//,                    destino: 'Cobros',  objeto: 'charge' },
  { re: /\/invoices\/[^/`'"]+\/dispute-package/,    destino: 'Cobros',  objeto: 'charge (chargeback; URL bajo /invoices/, objeto = charge)' },
  { re: /\/invoices\/[^/`'"]+\/status/,             destino: 'Factura', objeto: 'invoice (estado de pago)' },
  { re: /\/invoices\/[^/`'"]+\/payment-anomaly/,    destino: 'Factura', objeto: 'invoice (importe del pago)' },
  { re: /\/invoices\/[^/`'"]+\/send-reminder/,      destino: 'Factura', objeto: 'invoice (deuda a perseguir)' },
];

// Señal AMPLIA de «toca cobro», más ancha que las REGLAS con destino: sirve para el guard de
// huérfanas. Si un endpoint la dispara pero NINGUNA regla le da destino, esa acción quedó huérfana
// (toca cobro y no sabemos dónde va) — que es justo el fallo mudo que B4 existe para cazar.
const TOKENS_COBRO_AMPLIO = /\/charges\/|confirm-bizum|\/status\b|payment-anomaly|\bpaid\b|send-reminder|dispute-package|collect-rest|\/cobro/i;

const t = (n) => n.getText();

/**
 * Extrae, por cada botón de la vista, el/los endpoint(s) que llama su handler, y clasifica si TOCA
 * COBRO (con su destino) según REGLAS_COBRO. Devuelve { cobro:[...], noCobro:[...], vistaEncontrada }.
 */
export function censarCobroFactura(codigo) {
  const sf = ts.createSourceFile('invoiceDetailView.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  let vista = null;
  (function buscar(n) {
    if (!vista && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) && n.name && n.name.text === FUNCION_VISTA) { vista = n; return; }
    if (!vista) ts.forEachChild(n, buscar);
  })(sf);
  if (!vista) return { vistaEncontrada: false, cobro: [], noCobro: [] };

  const ini = vista.getStart(sf), fin = vista.getEnd();
  const dentro = (n) => n.getStart(sf) >= ini && n.getEnd() <= fin;
  const lineaDe = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // 1 · botones de la vista (createElement('button') → var)
  const botones = new Map(); // var -> { id, linea }
  const esCreateButton = (init) =>
    init && ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression)
    && init.expression.name.text === 'createElement' && init.arguments.length === 1
    && ts.isStringLiteralLike(init.arguments[0]) && init.arguments[0].text === 'button';

  // 2 · llamadas a endpoint (fetch / apiRequest / window.open) con su URL y su posición
  const llamadas = []; // { url, pos }
  const esLlamadaEndpoint = (n) => {
    if (!ts.isCallExpression(n) || n.arguments.length === 0) return null;
    const e = n.expression;
    const nombre = ts.isIdentifier(e) ? e.text
      : (ts.isPropertyAccessExpression(e) ? `${ts.isIdentifier(e.expression) ? e.expression.text + '.' : ''}${e.name.text}` : '');
    if (!['fetch', 'apiRequest', 'window.open', 'open'].includes(nombre)) return null;
    const arg0 = n.arguments[0];
    if (!(ts.isStringLiteralLike(arg0) || ts.isTemplateExpression(arg0) || ts.isBinaryExpression(arg0))) return null;
    return t(arg0);
  };

  (function visitar(n) {
    if (!dentro(n)) return;
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && esCreateButton(n.initializer)) {
      botones.set(n.name.text, { id: n.name.text, linea: lineaDe(n) });
    }
    const url = esLlamadaEndpoint(n);
    if (url) llamadas.push({ url, pos: n.getStart(sf) });
    ts.forEachChild(n, visitar);
  })(vista);

  // 3 · atribuir cada endpoint al botón cuyo handler lo contiene. El handler es
  //     `btnX.addEventListener('click', fn)`; la llamada cae dentro del rango de fn.
  const endpointsDe = new Map(); // var -> [urls]
  (function handlers(n) {
    if (!dentro(n)) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'addEventListener' && ts.isIdentifier(n.expression.expression)
        && botones.has(n.expression.expression.text) && n.arguments.length >= 2) {
      const btn = n.expression.expression.text;
      const fn = n.arguments[1];
      const a = fn.getStart(sf), b = fn.getEnd();
      const urls = llamadas.filter((l) => l.pos >= a && l.pos <= b).map((l) => l.url);
      if (urls.length) endpointsDe.set(btn, (endpointsDe.get(btn) || []).concat(urls));
    }
    ts.forEachChild(n, handlers);
  })(vista);

  // 4 · clasificar cada botón por su endpoint
  const cobro = [], noCobro = [], orfanas = [];
  for (const [v, info] of botones) {
    const urls = endpointsDe.get(v) || [];
    let regla = null, urlCobro = null;
    for (const u of urls) { const r = REGLAS_COBRO.find((x) => x.re.test(u)); if (r) { regla = r; urlCobro = u; break; } }
    const entrada = { id: v, linea: info.linea, endpoints: urls.map((u) => u.replace(/\s+/g, ' ')) };
    if (regla) {
      cobro.push({ ...entrada, endpoint: urlCobro.replace(/\s+/g, ' '), destino: regla.destino, objeto: regla.objeto });
    } else if (urls.some((u) => TOKENS_COBRO_AMPLIO.test(u))) {
      // toca cobro (señal amplia) pero ninguna regla le da destino → HUÉRFANA
      orfanas.push({ ...entrada, motivo: 'toca cobro pero ninguna regla le asigna destino' });
    } else {
      noCobro.push(entrada);
    }
  }
  cobro.sort((a, b) => a.linea - b.linea);
  noCobro.sort((a, b) => a.linea - b.linea);
  orfanas.sort((a, b) => a.linea - b.linea);
  return { vistaEncontrada: true, cobro, noCobro, orfanas, rangoVista: { desde: lineaDe(vista), hasta: sf.getLineAndCharacterOfPosition(fin).line + 1 } };
}
