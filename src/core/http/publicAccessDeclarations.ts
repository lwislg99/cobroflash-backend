// src/core/http/publicAccessDeclarations.ts — SCRUM-98 (Guard A, nace de SCRUM-88 §8)
//
// SCRUM-55 responde "¿quién puede llamar a esta ruta /admin?". Esto responde la
// pregunta que nadie se hacía de forma sistemática en el otro extremo: "¿esta ruta
// PÚBLICA resuelve su recurso por algo verificado, o por un id adivinable?". Las seis
// puertas de la misma fuga (SCRUM-72/74/85/87/90/95) se descubrieron por tropiezo, cada
// fix destapando la siguiente, porque esa pregunta no tenía dueño. Este archivo + el
// test que lo consume (tests/scrum98-public-access-fail-closed.test.mjs) la convierten
// en una comprobación de build: toda ruta bajo PUBLIC_PREFIXES tiene que estar en
// EXACTAMENTE una de PUBLIC_ACCESS_DECLARED / PUBLIC_ACCESS_ROUTER_LEVEL /
// PUBLIC_ACCESS_PENDING, o el test falla nombrándola.
//
// SIN marcador en middleware (a diferencia de requireRole con __requiredRole): no hay
// una comprobación de runtime compartida que 'token' pueda aprovechar — cada handler
// hace su propio findFirst/findUnique. Un marcador ahí sería teatro, no protección; la
// declaración vive SOLO aquí y un humano la revisa en el diff (mismo patrón que
// TECNICO_ALLOWED en adminRouteDeclarations.ts, que tampoco lleva marcador).
//
// LÍMITE HONESTO (igual que SCRUM-55 con la lógica de rol): esto no verifica que un
// handler declarado 'token' valide bien el token, ni que el guard real siga puesto en
// el código. Convierte "nadie se lo planteó" en "alguien lo afirmó y un humano lo
// revisó en el diff". El complemento natural sería un test de comportamiento (GET/POST
// sin token → debe fallar), mismo papel que tenancy-permisos.test.mjs para /admin.

export type PublicAccessKind =
  | 'token'               // resuelve el recurso por un campo opaco único (findFirst/findUnique)
  | 'internal'            // requireInternalSecret, o secreto+allowlist equivalente
  | 'signed-webhook'      // firma/HMAC verificada, FAIL-CLOSED si falta el secreto
  | 'session-gated'       // requireAuth (sesión real) — el problema de id adivinable sin sesión no aplica
  | 'no-sensitive-resource'; // no hay recurso por-tenant detrás, o lo que hay ya está pensado para ser público

export interface PublicAccessDeclaration {
  method: string;
  /** Path relativo al prefijo, tal y como lo registra Express (con sus :params). */
  path: string;
  kind: PublicAccessKind;
  /** Por qué esta categoría es correcta aquí. Una línea. Obligatorio. */
  reason: string;
}

// Prefijos públicos montados en app.ts — antes de requireAuth, o gateados solo por
// requireInternalSecret/firma. ÚNICA fuente de verdad, compartida con
// tests/scrum55-admin-fail-closed.test.mjs (antes vivía duplicada ahí, sin /dev incluido
// porque su 3er test — "todo router montado está identificado" — necesita saber que
// devRouter es un mount público conocido y no un huérfano, ya que se monta también en
// entorno de test vía `if (NODE_ENV !== 'production')`).
//
// /outbox queda FUERA: no es un router con rutas :param, es express.static — lo vigila
// un guard de directorio (SCRUM-96), no este.
export const PUBLIC_PREFIXES = [
  '/pay', '/cliente', '/albaran', '/webhooks/stripe', '/webhooks/stripe-connect',
  '/health', '/auth', '/webhooks/psp', '/charges', '/quote', '/invoice', '/recibo',
  '/webhooks/mp', '/webhooks/whatsapp', '/legal', '/p', '/dev',
] as const;

// Guard A (este archivo) SÍ excluye /dev de la exigencia de declarar categoría de
// acceso, a diferencia de SCRUM-55 que solo necesita saber que el router existe. Motivo:
// /dev solo se monta si NODE_ENV!=='production' (app.ts) — no es superficie alcanzable
// en producción, así que el problema que ataca este guard (id adivinable en producción)
// no le aplica. Sigue en PUBLIC_PREFIXES arriba porque scrum55 lo necesita para no
// marcarlo huérfano.
export const GUARD_A_EXCLUDED_PREFIXES: ReadonlySet<string> = new Set(['/dev']);

// Rutas registradas directo en `app` (app.get/app.post), no bajo ningún router de
// PUBLIC_PREFIXES — hay que decírselo al enumerador explícitamente.
export const PUBLIC_TOP_LEVEL_PATHS: readonly string[] = [
  '/version', '/privacidad', '/terminos', '/precios', '/public/founding-status',
];

// Prefijos declarados EN BLOQUE (una entrada cubre todo el router, no ruta a ruta).
// Ver PUBLIC_ACCESS_ROUTER_LEVEL más abajo para el motivo y la limitación conocida.
export const ROUTER_LEVEL_PREFIXES: ReadonlySet<string> = new Set(['/webhooks/psp', '/charges', '/invoice']);

export const PUBLIC_ACCESS_DECLARED: ReadonlyArray<PublicAccessDeclaration> = [
  // ── Páginas sin recurso sensible detrás ──
  { method: 'GET', path: '/privacidad', kind: 'no-sensitive-resource', reason: 'HTML legal estático' },
  { method: 'GET', path: '/terminos', kind: 'no-sensitive-resource', reason: 'HTML legal estático' },
  { method: 'GET', path: '/precios', kind: 'no-sensitive-resource', reason: 'HTML de landing estático' },
  { method: 'GET', path: '/public/founding-status', kind: 'no-sensitive-resource', reason: 'contador agregado de plazas, sin PII' },
  { method: 'GET', path: '/version', kind: 'no-sensitive-resource', reason: 'build id, sin caché, sin PII' },
  { method: 'GET', path: '/health', kind: 'no-sensitive-resource', reason: 'ok/service/version/db, cero PII' },
  { method: 'GET', path: '/legal/alcance-beta', kind: 'no-sensitive-resource', reason: 'markdown legal estático' },
  {
    method: 'GET',
    path: '/p/:slug',
    kind: 'no-sensitive-resource',
    reason: 'slug elegido por el propio merchant para ser público (A14.1); respuesta ya acotada a campos pensados para publicarse',
  },
  {
    method: 'GET',
    path: '/webhooks/whatsapp',
    kind: 'no-sensitive-resource',
    reason: 'handshake de configuración con Meta (compara verify_token), no el POST de mensajes — no expone datos',
  },

  // ── /auth ──
  {
    method: 'POST',
    path: '/auth/login',
    kind: 'no-sensitive-resource',
    reason: 'diseño anti-enumeración propio: 200 idéntico exista o no el email; no hay :id en la URL',
  },
  {
    method: 'POST',
    path: '/auth/register',
    kind: 'no-sensitive-resource',
    reason: 'mismo diseño anti-enumeración que /auth/login',
  },
  { method: 'GET', path: '/auth/verify', kind: 'token', reason: 'AuthSession.token, 256 bits, un solo uso' },
  {
    method: 'POST',
    path: '/auth/test-login',
    kind: 'internal',
    reason: 'triple cerradura: flag E2E_TEST_LOGIN_ENABLED + secreto timing-safe + allowlist de emails',
  },
  { method: 'POST', path: '/auth/logout', kind: 'no-sensitive-resource', reason: 'revoca solo la cookie propia del llamante' },

  // ── /quote — única ruta pública con sesión real (el resto del router, ver PENDING) ──
  {
    method: 'POST',
    path: '/quote/create',
    kind: 'session-gated',
    reason: 'requireAuth + requireActivePlan en app.ts antes del router — el problema de id adivinable sin sesión no aplica',
  },

  // ── /cliente — portal de autoservicio del cliente final ──
  { method: 'GET', path: '/cliente/:token', kind: 'token', reason: 'Customer.portalToken, opaco 128 bits' },
  { method: 'POST', path: '/cliente/:token/quote-request', kind: 'token', reason: 'Customer.portalToken' },

  // ── /albaran — firma remota del parte de trabajo (SCRUM-49) ──
  { method: 'GET', path: '/albaran/:token', kind: 'token', reason: 'Albaran.firmaToken, opaco 128 bits' },
  { method: 'POST', path: '/albaran/:token/firmar', kind: 'token', reason: 'Albaran.firmaToken + rate-limit adicional' },

  // ── /recibo — justificante de cobro (SCRUM-74) ──
  { method: 'GET', path: '/recibo/:token', kind: 'token', reason: 'Charge.receiptToken, opaco 128 bits' },
  { method: 'GET', path: '/recibo/:token/pdf', kind: 'token', reason: 'Charge.receiptToken' },
  { method: 'POST', path: '/recibo/:token/feedback', kind: 'token', reason: 'Charge.receiptToken' },

  // ── /pay — cobro (SCRUM-74/85/90), todos por Charge.receiptToken. OJO: el router
  // quoteDecisionLandingRouter TAMBIÉN cuelga de /pay pero es Quote.id crudo — ver PENDING.
  { method: 'GET', path: '/pay/invoice/:token', kind: 'token', reason: 'Charge.receiptToken' },
  {
    method: 'GET',
    path: '/pay/bank/:token',
    kind: 'token',
    reason: 'Charge.receiptToken — expone IBAN/CLABE del profesional, imprescindible tras el token',
  },
  { method: 'GET', path: '/pay/card/:token', kind: 'token', reason: 'Charge.receiptToken' },
  { method: 'GET', path: '/pay/bizum/:token', kind: 'token', reason: 'Charge.receiptToken' },
  { method: 'POST', path: '/pay/bizum/:token/claimed', kind: 'token', reason: 'Charge.receiptToken' },
  { method: 'GET', path: '/pay/mp/:token', kind: 'token', reason: 'Charge.receiptToken' },
  { method: 'GET', path: '/pay/mp/:token/result', kind: 'token', reason: 'Charge.receiptToken' },

  // ── Webhooks firmados, fail-closed si falta el secreto (500, nunca "sin validar") ──
  {
    method: 'POST',
    path: '/webhooks/stripe',
    kind: 'signed-webhook',
    reason: 'stripe.webhooks.constructEvent obligatorio; sin STRIPE_WEBHOOK_SECRET → 500',
  },
  {
    method: 'POST',
    path: '/webhooks/stripe-connect',
    kind: 'signed-webhook',
    reason: 'firma propia obligatoria; sin STRIPE_CONNECT_WEBHOOK_SECRET → 500',
  },
];

export interface PublicAccessRouterLevel {
  prefix: string;
  kind: PublicAccessKind;
  reason: string;
}

// Declaradas EN BLOQUE: una entrada cubre TODO el router, no ruta a ruta — porque
// requireInternalSecret se aplica en el `app.use(prefix, requireInternalSecret, router)`
// de app.ts, antes de que la petición llegue a ninguna ruta interna.
//
// ⚠️ LIMITACIÓN CONOCIDA (mismo nivel de honestidad que el resto de este archivo): esta
// declaración CONFÍA en que app.ts sigue aplicando requireInternalSecret al montaje. Si
// algún día alguien quita ese guard del `app.use(...)` correspondiente, esta declaración
// pasa a MENTIR y nada aquí lo detecta — no hay (todavía) un test que cruce esta lista
// contra el código real de app.ts. Igual que SCRUM-55 no verifica que la lógica de rol
// sea correcta, esto no verifica que el guard de montaje siga puesto.
export const PUBLIC_ACCESS_ROUTER_LEVEL: ReadonlyArray<PublicAccessRouterLevel> = [
  { prefix: '/webhooks/psp', kind: 'internal', reason: 'requireInternalSecret en el montaje (app.ts) — ver limitación conocida arriba' },
  { prefix: '/charges', kind: 'internal', reason: 'requireInternalSecret en el montaje (app.ts) — ver limitación conocida arriba' },
  { prefix: '/invoice', kind: 'internal', reason: 'requireInternalSecret en el montaje (app.ts) — ver limitación conocida arriba' },
];

export interface PublicAccessPending {
  method: string;
  path: string;
  /** Qué falta y por qué no se puede declarar 'segura' todavía. */
  duda: string;
  /** Ticket que lo rastrea. Obligatorio — nada se aparca sin dueño. */
  ticket: string;
}

export const PUBLIC_ACCESS_PENDING: ReadonlyArray<PublicAccessPending> = [
  // Familia Quote: nunca migró a un token opaco (a diferencia de Charge/Albaran) — seis
  // generadores de enlace y estas cuatro rutas de lectura/decisión siguen resolviendo por
  // Quote.id autoincremental. Rate-limit (decisionLimiter en accept/reject) NO cuenta como
  // categoría segura: acota la velocidad, no cierra el IDOR.
  { method: 'GET', path: '/pay/quote/:id', duda: 'Quote.id crudo, sin token opaco — scraping público sin rate-limit', ticket: 'SCRUM-88 §9 (Quote.decisionToken, sin ticket propio aún)' },
  { method: 'GET', path: '/pay/quote/:id/accept', duda: 'mismo motivo (alias de la ruta anterior)', ticket: 'SCRUM-88 §9 (Quote.decisionToken, sin ticket propio aún)' },
  { method: 'GET', path: '/pay/quote/:id/reject', duda: 'mismo motivo', ticket: 'SCRUM-88 §9 (Quote.decisionToken, sin ticket propio aún)' },
  { method: 'POST', path: '/pay/quote/:id/reject', duda: 'mismo motivo (reenvía a /quote/:id/decision)', ticket: 'SCRUM-88 §9 (Quote.decisionToken, sin ticket propio aún)' },
  { method: 'POST', path: '/quote/:id/accept', duda: 'Quote.id crudo; solo mitigado por decisionLimiter (rate-limit no es categoría segura)', ticket: 'SCRUM-88 §9 (Quote.decisionToken, sin ticket propio aún)' },
  { method: 'POST', path: '/quote/:id/reject', duda: 'mismo motivo', ticket: 'SCRUM-88 §9 (Quote.decisionToken, sin ticket propio aún)' },
  { method: 'POST', path: '/quote/:id/decision', duda: 'Quote.id crudo, SIN rate-limit ni auth — lee PII y muta estado (la sexta puerta)', ticket: 'SCRUM-95' },

  // Webhooks fail-open si falta el secreto de firma (a diferencia de Stripe, fail-closed).
  { method: 'POST', path: '/webhooks/mp', duda: 'fail-open: sin MP_WEBHOOK_SECRET no se valida ninguna firma', ticket: 'SCRUM-99' },
  { method: 'POST', path: '/webhooks/whatsapp', duda: 'fail-open: sin WHATSAPP_APP_SECRET acepta cualquier payload sin firma', ticket: 'SCRUM-99' },
];

/** Tope del ratchet: la lista puede menguar, JAMÁS crecer. Bajarlo al cerrar cada ticket. */
export const PUBLIC_ACCESS_PENDING_MAX = 9;

/**
 * Fecha límite. Pasada esta fecha el test FALLA mientras queden aparcadas.
 * Mover esta fecha requiere OK del fundador y queda en el diff — mismo mecanismo que
 * REVISAR_ANTES_DE en adminRouteDeclarations.ts.
 */
export const PUBLIC_ACCESS_REVISAR_ANTES_DE = '2026-09-30';
