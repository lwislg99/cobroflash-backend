// SCRUM-1514c · Lo que cada ruta necesita para pasar lo que la paraba en el censo.
//
// Cada receta sale de LEER la validación de su ruta (`leido`: fichero y línea de src/) y de la
// respuesta que dio en la pasada genérica (`causa`). Una ruta puede llevar varias VARIANTES: con dos
// referencias (un cliente Y unos albaranes, un principal Y un fusionado) el censo sólo probaba una.
//
// Convenio del doble (el del censo): 102 es un recurso del comercio 22 (AJENO); 501 es uno del
// comercio 21, el de la sesión (PROPIO). El comercio de la sesión es el 21.
const AJENO = 102; const PROPIO = 501;

// Stripe doblado: no es el SDK ni lleva clave. Cualquier llamada contesta una fila de laboratorio.
export const llamadasStripe = [];
const dobleStripe = (ruta) => new Proxy(function () {}, {
  get: (_, k) => (k === 'then' ? undefined : dobleStripe(ruta + '.' + String(k))),
  apply: () => { llamadasStripe.push(ruta); return Promise.resolve({ id: 'lab_1514c', url: 'http://127.0.0.1:9/laboratorio', customer: 'cus_lab_1514c', data: [{ id: 'price_lab_1514c' }] }); },
});
const STRIPE = [{ rel: 'integrations/stripe.js', clave: 'stripe', valor: dobleStripe('stripe') }];
// Un texto en memoria, no una clave: con `fetch` y `https` cortados la llamada a la IA no sale.
const IA = { GEMINI_API_KEY: 'texto-de-laboratorio-1514c' };
const b64 = (t) => Buffer.from(t, 'utf8').toString('base64');
const CSV_CLIENTES = b64('nombre;telefono\nAna Laboratorio;600111222\n');
const futuro = new Date(Date.now() + 86_400_000);

export const RECETAS = {
  'GET /admin/me': {
    causa: 'precondición: la sesión se lee de la cookie, no de req.merchantId', leido: 'src/app.ts:380',
    variantes: [{ nombre: 'con la cookie de una sesión del comercio 21', headers: { cookie: 'pf_session=' + PROPIO },
      filas: { authSession: { type: 'session', expiresAt: futuro, teamMember: null } } }],
  },
  'POST /admin/customers/bulk-tags': {
    causa: 'cuerpo: pide `accion` y `etiqueta`, que el relleno no lleva', leido: 'src/modules/system/app/routes/customersAdmin.routes.ts:126',
    variantes: [
      { nombre: 'etiquetar el cliente ajeno', body: { ids: [AJENO], accion: 'add', etiqueta: 'lab' } },
      { nombre: 'uno propio y uno ajeno en la misma lista', body: { ids: [PROPIO, AJENO], accion: 'add', etiqueta: 'lab' } },
      { nombre: 'quitar la etiqueta al ajeno', body: { ids: [AJENO], accion: 'remove', etiqueta: 'a' } },
    ],
  },
  'POST /admin/customers/import/preparar': {
    causa: 'cuerpo: pide `fichero` en base64', leido: 'src/modules/system/app/routes/customersAdmin.routes.ts:237',
    variantes: [{ nombre: 'un CSV de dos filas', body: { fichero: CSV_CLIENTES } }],
  },
  'POST /admin/customers/import': {
    causa: 'cuerpo: pide `fichero` en base64 y `mapeo`', leido: 'src/modules/system/app/routes/customersAdmin.routes.ts:279',
    variantes: [{ nombre: 'un CSV de dos filas con su mapeo', body: { fichero: CSV_CLIENTES, mapeo: { name: 0, phone: 1 } } }],
  },
  'GET /admin/customers/:id/fusion-preview': {
    causa: 'query: pide `con`, el segundo cliente', leido: 'src/modules/system/app/routes/customersAdmin.routes.ts:634',
    variantes: [
      { nombre: 'principal ajeno, fusionado propio', query: { con: String(PROPIO) } },
      { nombre: 'principal propio, fusionado ajeno', params: { id: String(PROPIO) }, query: { con: String(AJENO) } },
    ],
  },
  'POST /admin/customers/:id/fusionar': {
    causa: 'cuerpo: pide `con`, el segundo cliente', leido: 'src/modules/system/app/routes/customersAdmin.routes.ts:654',
    variantes: [
      { nombre: 'principal ajeno, fusionado propio', body: { con: PROPIO } },
      { nombre: 'principal propio, fusionado ajeno', params: { id: String(PROPIO) }, body: { con: AJENO } },
    ],
  },
  'PATCH /admin/quotes/:id/billing-plan': {
    causa: 'cuerpo: pide `version`, la que leyó la pantalla', leido: 'src/modules/system/app/routes/quotesAdmin.routes.ts:502',
    variantes: [{ nombre: 'el plan del presupuesto ajeno', body: { version: '2026-10-01T00:00:00.000Z', customBillingPlan: [] } }],
  },
  'POST /admin/invoices/:id/annul': {
    causa: 'cuerpo: pide `motivo` de una lista cerrada', leido: 'src/modules/system/app/routes/invoicesAdmin.routes.ts:872',
    variantes: [{ nombre: 'anular la factura ajena', body: { motivo: 'duplicada' } }],
  },
  'POST /admin/products/import': {
    causa: 'cuerpo: pide `csv` como texto', leido: 'src/modules/products/app/routes/products.routes.ts:238',
    variantes: [{ nombre: 'un CSV de catálogo', body: { csv: 'name,price,unit\nTornillo de laboratorio,1.5,ud\n' } }],
  },
  'POST /admin/expenses/leer-ticket': {
    causa: 'precondición: la IA no está configurada en el árbol', leido: 'src/modules/expenses/app/routes/expenses.routes.ts:248',
    variantes: [{ nombre: 'con la IA «configurada» en memoria y la red cortada', config: IA, body: { imagen: 'data:image/jpeg;base64,AAAA' } }],
  },
  'POST /admin/jobs': {
    causa: 'cuerpo: pide `customerId` y los datos del trabajo', leido: 'src/modules/jobs/app/routes/jobs.routes.ts (router.post(\'/\'))',
    variantes: [
      { nombre: 'un trabajo para el cliente ajeno', body: { customerId: AJENO, titulo: 'Trabajo de laboratorio', direccion: 'Calle de prueba 1' } },
      { nombre: 'un trabajo para un cliente propio', body: { customerId: PROPIO, titulo: 'Trabajo de laboratorio', direccion: 'Calle de prueba 1' } },
    ],
  },
  'POST /admin/albaranes/consolidar': {
    causa: 'cuerpo: pide `customerId` y `albaranIds`', leido: 'src/modules/jobs/app/routes/albaranes.routes.ts:443',
    variantes: [
      { nombre: 'cliente ajeno y albarán ajeno', body: { customerId: AJENO, albaranIds: [AJENO] } },
      { nombre: 'cliente PROPIO y albarán ajeno (comercio en modo receipt, como sale del doble)', body: { customerId: PROPIO, albaranIds: [AJENO] } },
      { nombre: 'cliente PROPIO y albarán ajeno, comercio que SÍ puede consolidar', body: { customerId: PROPIO, albaranIds: [AJENO] }, filas: { merchant: { flags: { INVOICING_ES_ENABLED: true }, taxId: 'B00000000' } } },
    ],
  },
  'POST /admin/entorno': {
    causa: 'cuerpo: pide `entorno` de una lista cerrada', leido: 'src/modules/auth/app/routes/entornoAdmin.routes.ts:32',
    variantes: [{ nombre: 'con la sesión que pone requireAuth (propia)', body: { entorno: 'pestana' }, req: { sessionId: PROPIO } }],
  },
  'POST /admin/soporte': {
    causa: 'cuerpo: pide `mensaje`', leido: 'src/modules/system/app/routes/soporteAdmin.routes.ts:24',
    variantes: [{ nombre: 'un mensaje de soporte', body: { mensaje: 'Mensaje de laboratorio para soporte, no se envía.' } }],
  },
  'GET /admin/libros/expedidas.csv': {
    causa: 'query: pide año y trimestre', leido: 'src/modules/fiscal/librosAeat/librosAeat.routes.ts:45',
    variantes: [{ nombre: 'tercer trimestre de 2026', query: { ano: '2026', trimestre: '3' } }],
  },
  'GET /admin/libros/recibidas.csv': {
    causa: 'query: pide año y trimestre', leido: 'src/modules/fiscal/librosAeat/librosAeat.routes.ts:89',
    variantes: [{ nombre: 'tercer trimestre de 2026', query: { ano: '2026', trimestre: '3' } }],
  },
  'GET /admin/libros/recibidas.json': {
    causa: 'query: pide año y trimestre', leido: 'src/modules/fiscal/librosAeat/librosAeat.routes.ts:120',
    variantes: [{ nombre: 'tercer trimestre de 2026', query: { ano: '2026', trimestre: '3' } }],
  },
  'POST /admin/supresion/:merchantId': {
    causa: 'precondición: el flag MERCHANT_DELETE_ENABLED está apagado', leido: 'src/modules/system/app/routes/supresion.routes.ts:29',
    variantes: [
      { nombre: 'flag encendido, suprimir el comercio 22', env: { MERCHANT_DELETE_ENABLED: 'true' }, params: { merchantId: '22' }, body: { confirmacion: 'Negocio' } },
      { nombre: 'flag encendido, el PROPIO con la confirmación mal (¿se abrió la puerta?)', env: { MERCHANT_DELETE_ENABLED: 'true' }, params: { merchantId: '21' }, body: { confirmacion: 'no coincide' } },
    ],
  },
  'POST /admin/billing/checkout': {
    causa: 'precondición: Stripe no está configurado en el árbol', leido: 'src/modules/billing/app/routes/subscriptions.routes.ts:69',
    variantes: [{ nombre: 'con Stripe doblado', modulos: STRIPE, body: { plan: 'pro' }, filas: { merchant: { email: 'sesion@example.invalid' } } }],
  },
  'POST /admin/billing/portal': {
    causa: 'precondición: Stripe no está configurado en el árbol', leido: 'src/modules/billing/app/routes/subscriptions.routes.ts:141',
    variantes: [{ nombre: 'con Stripe doblado', modulos: STRIPE, filas: { merchant: { stripeCustomerId: 'cus_lab_1514c' } } }],
  },
  'POST /admin/team': {
    causa: 'cuerpo: pide `name` y `email`', leido: 'src/modules/team/app/routes/team.routes.ts:50',
    variantes: [
      { nombre: 'invitar a un compañero (plan de 1 usuario, como sale del doble)', body: { name: 'Ana Laboratorio', email: 'ana@example.invalid', role: 'tecnico' } },
      { nombre: 'invitar a un compañero, plan equipo', body: { name: 'Ana Laboratorio', email: 'ana@example.invalid', role: 'tecnico' }, filas: { merchant: { plan: 'equipo' } } },
    ],
  },
  'POST /admin/connect/onboard': {
    causa: 'precondición: Stripe no está configurado en el árbol', leido: 'src/modules/payments/connect/connect.routes.ts:32',
    variantes: [{ nombre: 'con Stripe doblado y el flag de Connect encendido', modulos: STRIPE, env: { PAYMENTS_CONNECT_ENABLED: 'true' } }],
  },
  'POST /admin/ai/suggest-quote': {
    causa: 'precondición: la IA no está configurada en el árbol', leido: 'src/modules/ai/app/routes/ai.routes.ts:45',
    variantes: [{ nombre: 'con la IA «configurada» en memoria y la red cortada', config: IA, body: { description: 'Pintar un salón de 20 metros' } }],
  },
  'POST /admin/ai/quote-message': {
    causa: 'precondición: la IA no está configurada en el árbol', leido: 'src/modules/ai/app/routes/ai.routes.ts:148',
    variantes: [
      { nombre: 'el mensaje del presupuesto ajeno', config: IA, body: { quoteId: AJENO } },
      { nombre: 'sin presupuesto, con los datos en el cuerpo', config: IA, body: { customerName: 'Ana', concept: 'Pintura', total: '100' } },
    ],
  },
  'PATCH /admin/quote-requests/:id': {
    causa: 'cuerpo: pide `status` de una lista cerrada (read, done, pending)', leido: 'src/modules/quoteRequests/app/routes/quoteRequests.routes.ts:48',
    variantes: [{ nombre: 'marcar como leída la solicitud ajena', body: { status: 'read' } }],
  },
};
