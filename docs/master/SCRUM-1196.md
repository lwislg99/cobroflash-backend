# SCRUM-1196 · Censo de terceros que reciben datos del CLIENTE FINAL: medido sobre el HTML servido

**Fecha:** 28-sep-2026 · **Carril:** legal / privacidad · **Puesto:** J4 (jv-j4)
**Skill UI:** no cargada · J4 no toca `public/`: lo mide (HTML servido) y propone texto legal sin firmar; quien lo construya (J3) la carga (campo añadido en SCRUM-1196b, cuando `scrum811c` lo pidió por mencionar `public/`)
**Medido contra:** `origin/main` = `c57f745d0f9f8424abc90e8a591d10fd81a00cad` · 2026-09-28T15:08:01Z (capturas hechas sobre `a59dc1e6`; entre los dos solo cambian 3 ficheros de `public/dashboard/js/`, que ve el profesional y no el cliente final, y ninguno añade una URL)

## Encargo

El ticket declara su propio agujero: «no se ha medido si hay más terceros en la misma situación; se
midieron estos dos porque salieron al paso». Esto es ese censo, y **solo el censo**. No redacta la
política (regla 39: la firma Javier) y no toca `public/` ni `src/`.

## Método: tres capas, y lo que cada una ve

1. **Producción, en vivo (`curl`, 28-sep 15:03Z):** cada ruta del cliente final con un token
   inventado, más la raíz y `privacidad.html`. Es el HTML real que sirve Cloudflare, con sus
   cabeceras. Solo ve las páginas de error, porque no hay token válido que usar sin tocar datos de
   clientes.
2. **Los routers REALES de `dist/` (compilado de `a59dc1e6`)**, montados en Express con un doble de
   `prisma` instalado en `require.cache`. Es el mismo patrón de `tests/scrum893`: ni BD, ni red, ni
   credenciales, y ni una línea de `src/` tocada. Así se obtiene el HTML de la página **con datos**.
   El logo del negocio se fija a un centinela, `https://logo-tercero.test/l.png`. `/p/:slug` se
   renderiza llamando a `buildPublicProfileHtml` (exportada), porque su ruta está tras un flag en OFF.
3. **Censo del código**: toda URL `http(s)://` de `src/` que no sea nuestra. Sirve de cota superior,
   para que el HTML capturado no se deje nada que el código pueda emitir.

Cada URL externa del HTML se clasifica en dos grupos:
- **AUTO:** el navegador la pide sola al cargar (`<link>`, `<script>`, `<img>`, `<iframe>`, `url()`
  de CSS).
- **NAV:** solo si el cliente pulsa (`<a>`, `<form>`).

**Control positivo del extractor:** una página fabricada con un `<script>`, un `<iframe>`, un
`url()` de CSS y un `<a>` externos. Salen los cuatro, cada uno en su clase
(`evidencias/scrum1196/control-positivo-extractor.txt`). El centinela del logo también sale en
todas las páginas que lo pintan.

## Resultado: superficies del cliente final

| Superficie | Ruta | Estado del render | AUTO (se pide al cargar) | NAV (al pulsar) |
|---|---|---|---|---|
| Pago por transferencia | `/pay/bank/:token` | 200 | Google Fonts | — (formulario propio) |
| Bizum | `/pay/bizum/:token` | 200 | Google Fonts · **logo** | — |
| Selector de pago / factura | `/pay/invoice/:token` | 200 | Google Fonts · **logo** | — |
| Mercado Pago, resultado | `/pay/mp/:token/result` | 200 | Google Fonts | — |
| Mercado Pago, pago | `/pay/mp/:token` | redirige a Mercado Pago (503 en el arnés, sin credenciales) | — | Mercado Pago (ya en la política) |
| Tarjeta | `/pay/card/:token` | redirige a Stripe Checkout (501 en el arnés, sin Stripe) | — | Stripe (ya en la política) |
| Recibo | `/recibo/:token` | 200 | Google Fonts | — |
| Albarán y firma | `/albaran/:token` | 200 | Google Fonts · **logo** | — |
| Portal del cliente | `/cliente/:token` | 200 | Google Fonts · **logo** | `wa.me` (Meta, ya en la política) |
| Presupuesto (aceptar / rechazar) | `/pay/quote/:token` | 200 | Google Fonts · **logo** | `wa.me` |
| Perfil público (flag `PUBLIC_PROFILE_ENABLED` OFF) | `/p/:slug` | función | Google Fonts · **logo** | `wa.me` |

**Páginas de error**, medidas en producción. `/pay/bank|bizum|invoice|mp`, `/pay/quote`, `/recibo`
y `/albaran` devuelven la misma página genérica de 1.059 B, **sin ningún tercero**. El 404 del
portal (`/cliente/…`, 8.592 B) **sí** carga Google Fonts.

Ningún `<script>` ni `<iframe>` externo en ninguna página. Los dos `fetch` de los scripts en línea
van a rutas propias (`/quote/…/decision`, y `PF_REQUEST_URL` = nuestro `/cliente/…/quote-request`).

## Los terceros, uno por uno (cada uno es una decisión distinta)

### ① Google Fonts, ya conocido y ahora medido entero

- **Una sola URL**, idéntica carácter por carácter en las 28 apariciones del código y de las capturas:
  `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap`.
- La hoja de estilos que devuelve pide los ficheros de fuente a **`fonts.gstatic.com`**: 35 URLs,
  bajadas con `curl`. Son **dos** hosts de Google por visita, no uno. El segundo no aparece en el HTML
  como petición (solo como `preconnect`): sale de la hoja en tiempo de ejecución.
- Está en **9 de las 11** superficies de la tabla: en todas las que pintan página. Las dos que no
  la tienen, `/pay/card` y `/pay/mp`, redirigen. Además está en el 404 del portal y en 7 de las 9 páginas de `public/`.

### ② El logo del negocio: un tercero que ELIGE EL PROFESIONAL, sin límite

- `logoUrl` acepta **cualquier URL `http(s)`** (`src/core/validation/schemas.ts:438-441`: `z.string().url()`)
  o un `data:image/…;base64`.
- Si es una URL, el navegador del cliente final la pide al cargar **6 superficies**: Bizum, selector
  de pago, albarán, portal, presupuesto y perfil público. Ese host recibe la IP y el user-agent del cliente, y como
  `Referer` solo el origen `https://yaqu.app`, **nunca la ruta con el token**. Lo garantiza la
  cabecera `Referrer-Policy: strict-origin-when-cross-origin` que pone `src/app.ts:134`, medida en
  las respuestas.
- **El host no lo conoce YaQu:** puede ser el servidor del profesional, un alojamiento de imágenes o
  cualquier otro. Ninguna política puede listarlo. Que el logo subido desde Configuración se guarde
  como `data:` (según el comentario del esquema) no impide que por la API llegue una URL.
- El PDF también lo baja, pero **desde el servidor** (`pdf.service.ts:119-121`, `axios.get(logoUrl)`):
  ahí no sale la IP del cliente. Es otra superficie, de seguridad y no de privacidad, y queda fuera
  de este ticket.

### ③ Cloudflare, ya conocido, más un canal que no se había visto

- `Server: cloudflare` en todas las respuestas. Reescribe el HTML: ofusca los `mailto:` e inyecta
  `/cdn-cgi/scripts/…/email-decode.min.js`, que se sirve desde nuestro propio dominio.
- **Nuevo: NEL (Network Error Logging).** Toda respuesta lleva
  `Report-To: {"group":"cf-nel",…"url":"https://a.nel.cloudflare.com/report/v4?…"}` y
  `Nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}`. El navegador del cliente
  guarda esa orden **7 días**. Si una petición a yaqu.app le falla, **manda él mismo** un informe a
  `a.nel.cloudflare.com`. Con `success_fraction` 0.0 solo informa de los fallos. Es un envío directo
  navegador → Cloudflare, distinto del proxy
  (`evidencias/scrum1196/cabeceras-pay-bank-prod.txt`).
- No hay `Content-Security-Policy`. Nada limita qué orígenes puede pedir la página, y por eso el
  logo del ② carga desde cualquier sitio.

### Terceros que ya están en la política (no se piden cambios aquí)

- Stripe y Mercado Pago (redirecciones de pago).
- Meta (`wa.me`, solo al pulsar).
- Railway: `x-railway-edge: bcn1`, alojamiento, ya listado.

## Lo que este método NO mide (suelo)

- **Peticiones creadas en tiempo de ejecución por JavaScript.** No se ejecutó ningún navegador. Se
  leyeron los scripts en línea: no hay URLs externas literales, y los dos `fetch` son propios. Pero
  una URL construida por concatenación no la vería este método.
- **Lo que Cloudflare inyecte en respuestas 200 con datos.** En producción solo se vieron páginas de
  error y estáticas. Una inyección condicionada (por ejemplo Web Analytics, que va por configuración
  del panel) quedaría fuera. En las páginas medidas no aparece `cloudflareinsights` ni
  `/cdn-cgi/rum`.
- **Estados menos comunes de cada página.** Presupuesto ya aceptado, rechazado o caducado; recibo
  pagado; albarán firmado. Todos comparten el mismo `renderPage`/`page` que la variante medida, pero
  no se renderizaron uno a uno.
- **Correos al cliente final (Resend).** Las plantillas de `src/` no llevan imágenes remotas ni URLs
  externas (0 de 0 en los 5 ficheros de correo). Si Resend tiene **activado el seguimiento de
  aperturas o clics**, eso se configura en su panel y no se ve en el código: **SIN DETERMINAR**.
- **WhatsApp.** Meta ya figura en la política; no se ha re-medido.

## Decisiones que salen del censo (del fundador, regla 39)

1. **Google Fonts:** el remedio autorizado («3-Autorizo») es autoalojar `Inter`. Quita los **dos**
   hosts, `googleapis` y `gstatic`, de golpe. La parte de `public/` y `tokens.css` es del equipo de
   Luis (S2). Las 9 de `src/` las coordina el orquestador.
2. **Logo por URL:** decidir entre aceptar solo `data:` (o servirlo desde nuestro dominio) o
   declararlo en la política. Declararlo no se puede hacer con precisión, porque el host lo elige el
   profesional.
3. **Cloudflare:** declararlo como encargado, y decidir si el NEL se deja como está o se desactiva
   en el panel.
4. **Resend:** que alguien con acceso mire si el seguimiento de aperturas y clics está activado.

## Evidencias

- `evidencias/scrum1196/hosts-por-pagina.txt`: AUTO / NAV / OTRA por cada HTML capturado (producción
  y arnés).
- `evidencias/scrum1196/control-positivo-extractor.txt`.
- `evidencias/scrum1196/cabeceras-pay-bank-prod.txt`: con el parámetro firmado de NEL omitido.

## Resend: el SIN DETERMINAR, cerrado hasta donde llega el repositorio

**Medido contra:** `origin/main` = `4583f537880241f948a78c9ee274d1b1a59c59a0` · 2026-09-28T15:24:18Z (encargo del orquestador: sin entrar en ningún panel)

### Qué correos van al CLIENTE FINAL

Todo envío pasa por el único POST a Resend (`src/integrations/enviarCorreo.ts`, `enviarPorResend`).
Destinatarios, llamada por llamada:

| Correo | Disparador | Llamada | Destinatario |
|---|---|---|---|
| **Factura con el PDF adjunto** | el profesional pulsa «enviar» | `invoicesAdmin.routes.ts:691` | `invoice.customer.email` · **cliente final** |
| **Factura con el PDF adjunto** | cobro con tarjeta confirmado (si `AUTO_EMAIL_INVOICE_ON_PAID`) | `psp.routes.ts:78` y `:201` | `customer.email` · **cliente final** |
| **Factura con el PDF adjunto** | cobro de Mercado Pago confirmado (misma condición) | `mpWebhook.routes.ts:145` | `customer.email` · **cliente final** |
| **Presupuesto** | el profesional pulsa «enviar» | `quotesAdmin.routes.ts:747` → `email.service.ts` | `quote.customer.email` · **cliente final** |
| Enlace de acceso, ciclo de vida, resumen semanal, soporte | — | `auth.service`, `lifecycle.service`, `weeklyDigest.service`, `soporteAdmin.routes` | el profesional (`m.email` / `merchant.email`) |
| Pago recibido, presupuesto aceptado, presupuesto aprobado al técnico | — | `merchantNotifications.ts` | el profesional o su técnico |

Al cliente final le llegan **dos clases de correo: la factura (por cuatro caminos) y el presupuesto**.
Las plantillas son HTML nuestro, sin imágenes remotas ni URLs externas (medido en el censo de arriba).

### Qué puede fijar nuestra llamada: NADA sobre el seguimiento

Fuente primaria: la documentación de Resend, bajada con `curl` (sufijo `.md`), el 28-sep-2026.
- **`api-reference/emails/send-email`** (sha256[16] `ff552aa69e2c4151`). Parámetros completos:
  `from to subject bcc cc scheduled_at reply_to html text react headers topic_id attachments tags
  template` más la cabecera `Idempotency-Key`. La palabra «track» aparece **0 veces**: **no existe una
  opción por envío** que encienda o apague el seguimiento.
- **`dashboard/domains/tracking`** (sha256[16] `7679f37bf8cb6bc4`), literal: «Open and click tracking
  is disabled by default for all domains.»
- **`api-reference/domains/update-domain`** (sha256[16] `b34519c1536f862d`): `open_tracking` y
  `click_tracking` son **propiedades del DOMINIO**, y de cada una dice «This setting is only applied if
  a `tracking_subdomain` is configured and verified».

Por tanto:
1. **El seguimiento no se decide en nuestra llamada, sino en el dominio.** «Una opción en nuestra
   llamada» no existe en la API.
2. **Lo más cerca de «un hecho del repositorio»** sería un script que haga `PATCH /domains/:id` con
   `open_tracking: false, click_tracking: false`, o solo `GET /domains/:id` para leer el estado. Los
   dos piden la `RESEND_API_KEY`, que no está en ningún árbol de trabajo: lo corre quien tenga la
   clave. Aun así, el estado vive en Resend, no en git.
3. **Se puede comprobar SIN panel y SIN clave de dos formas:**
   - que el seguimiento exige un **subdominio de seguimiento verificado**, que es un CNAME en el DNS
     del dominio remitente;
   - que cualquiera que haya **recibido** un correo de YaQu puede mirar su código fuente: con el
     seguimiento de clics los enlaces van reescritos a ese subdominio, y con el de aperturas aparece
     una imagen de 1×1 servida desde él.

### El dominio remitente: `presufacil.online` está verificado en Resend, `yaqu.app` no consta (confirma SCRUM-1115)

⚠️ **Corrección del 28-sep, 15:30Z.** La primera versión de este apartado titulaba «no consta que
`yaqu.app` sea dominio remitente» y sacaba la consecuencia de que «la factura no le llega al cliente
final». **Esa consecuencia no se sostiene.** YaQu sí tiene un dominio verificado en Resend, el de la
marca anterior. SCRUM-1115 (abierto el 25-sep) ya lo decía. Lo de abajo lo **mide**.

- **Qué dominio sale del repositorio: ninguno.** `from` es `config.EMAIL_FROM`, variable de Railway.
  En código, el valor por defecto es `YaQu <no-reply@yaqu.local>`. `presufacil` no aparece en `src/`
  ni en `public/` (SCRUM-1115).
- **DNS público**, medido con DNS sobre HTTPS (`cloudflare-dns.com`) el 28-sep entre 15:20 y 15:30Z.
  Por defecto, la Return-Path de Resend es un MX en `send.<dominio>` (`add-a-domain`, sha256[16]
  `95fca8253c336e03`).

  | Dominio | `send.` MX | `send.` SPF | `resend._domainkey` TXT |
  |---|---|---|---|
  | `resend.com` (**control positivo**) | `feedback-smtp.us-east-1.amazonses.com` | — | `p=…` |
  | **`presufacil.online`** | **`feedback-smtp.eu-west-1.amazonses.com`** | **`v=spf1 include:amazonses.com ~all`** | **`p=…`** |
  | `yaqu.app` (raíz) y 14 subdominios comunes¹ | NXDOMAIN | NXDOMAIN | NXDOMAIN |

  ¹ `notifications`, `updates`, `mail`, `email`, `correo`, `facturas`, `no-reply`, `noreply`,
  `envios`, `notificaciones`, `hola`, `app`, `m`, `info`. Los MX y el SPF de `yaqu.app` son solo de
  Cloudflare Email Routing (`route*.mx.cloudflare.net`, `include:_spf.mx.cloudflare.net`).
- **Lo que queda probado:** `presufacil.online` tiene los registros de un dominio verificado en
  Resend, y `yaqu.app` no los tiene en ningún nombre de los probados. **Suelo:** un subdominio de
  `yaqu.app` con otro nombre, o una Return-Path personalizada, no se ven con este sondeo. Lo probado
  es que `yaqu.app` **no consta** verificado, no que sea imposible.
- **Lo que NO queda probado, y es la pregunta abierta de SCRUM-1115:** qué vale `EMAIL_FROM` en el
  servicio del **backend**, que es el que escribe al cliente final. El correo de PresuFácil que se
  observó el 25-sep venía del **servicio cron de acreditación** (así lo dice 1115). Con esta medición:
  - si el backend usa `presufacil.online` → la factura sale, con la marca vieja (escenario (b) de 1115);
  - si usa `yaqu.app` → sale desde un dominio que no consta verificado. La documentación de Resend
    dice, literal, «You must add and verify at least one domain to send emails with Resend»
    (`dashboard/domains/introduction`, sha256[16] `cf63c0f716a4899f`).
- **Seguimiento en el dominio que sí envía:** en `presufacil.online` no responde ningún CNAME en 15
  nombres típicos de subdominio de seguimiento (`links`, `track`, `tracking`, `click`, `clicks`,
  `email`, `mail`, `e`, `r`, `t`, `go`, `l`, `link`, `lnk`, más la comprobación de `_dmarc`, que
  tampoco existe). Mismo suelo: un nombre distinto no se ve. Recordatorio de la fuente: sin un
  subdominio de seguimiento verificado, el seguimiento no se aplica.

### Qué queda, y quién lo mira (sin panel no se puede cerrar más)

1. **Luis, o quien tenga la cuenta:** qué vale `EMAIL_FROM` en el servicio del **backend** (la pregunta
   de SCRUM-1115), y si **`presufacil.online`** —el dominio que sí está verificado, no `yaqu.app`—
   tiene `open_tracking`/`click_tracking` encendidos con un subdominio verificado. Con la clave, basta
   un `GET /domains`.
2. **Sin cuenta:** cualquiera que tenga una factura o presupuesto recibidos de YaQu puede abrir el
   código fuente del correo y mirar los hosts de los enlaces y si hay una imagen de 1×1.
3. Mientras tanto, lo que dice la documentación es que, **sin subdominio de seguimiento verificado,
   el seguimiento no se aplica** aunque esté encendido.

### Si Resend RECHAZA, ¿lo ve alguien? (leído sin tocar `src/`)

**Medido contra:** `origin/main` = `eedd7805c45f554bc29ccc3204f6dd09f61862e6` · 2026-09-28T15:32:28Z (pregunta del orquestador; solo lectura, nada construido)

Una aclaración antes: `crearTransportadorResend` **no existe** en `main` (0 apariciones en `src/`).
El camino real es este:

1. **`enviarPorResend` no lanza.** Si el POST falla, registra el error y escribe una fila de fallo en
   `emailMessage` (SCRUM-501). Después devuelve `{ enviado: false, motivo: 'fallo_envio' }`
   (`src/integrations/enviarCorreo.ts`, su `catch`).
2. **`sendInvoiceEmail` y `sendQuoteEmail` sí lanzan** cuando `!r.enviado`: «no se pudo enviar la
   factura por email» y lo mismo con el presupuesto (`email.service.ts`, justo tras cada
   `enviarPorResend`).
3. Qué hace con esa excepción cada uno de los cinco caminos que llegan al cliente final:

| Camino | Qué hace con la excepción | ¿Lo ve el profesional? |
|---|---|---|
| Botón «enviar factura» (`invoicesAdmin.routes.ts:691`) | `catch` → `200` + `sendFailureBody('email_send_failed')` = `{ sent: false, … }` | **SÍ.** `waFallbackBar` (`api.js`) comprueba `waSendFailed(result)` y enseña «Email falló: …» (SCRUM-115/126) |
| Botón «enviar presupuesto» (`quotesAdmin.routes.ts:747`) | `catch` → `200` + `sent: false` con «No se pudo enviar el email. El presupuesto quedó guardado; puedes reintentarlo.» | **SÍ.** `quotesDetailView.js` comprueba `waSendFailed(data)` y pinta el error |
| Factura automática tras cobro, reintento del proveedor (`psp.routes.ts:78`) | `catch` → `console.error('auto-invoice/error duplicate', …)` | **NO** |
| Factura automática tras cobro (`psp.routes.ts:201`) | `catch` → `console.error('auto-email error', …)`. El webhook responde igual `200 {status:'paid'}` (`:341`) | **NO** |
| Factura automática tras cobro de Mercado Pago (`mpWebhook.routes.ts:145`) | `.catch((e) => console.error('[mpWebhook] email error:', e))` | **NO** |

**En los tres caminos automáticos, el rechazo se traga.** Lo único que queda:
- una línea en los logs de Railway;
- una fila de fallo en `emailMessage`, que **ninguna pantalla ni ruta lee**. Su único lector en
  `src/` es `aplicarAvisoDeProveedor` (`registroDeEnvios.ts:310`), que actualiza la fila con el
  webhook de Resend.

Tampoco hay reintento:
- `marcarCorreoEnviado` no se escribe si el envío falla. Eso está bien, pero el reintento de
  `psp.routes.ts:78` solo corre si el proveedor **re-entrega** el evento, y no lo hace, porque el
  webhook contestó `200`.
- Ningún cron llama a `sendInvoiceEmail`.

Resultado: el cobro queda `paid`, el cliente final no recibe su factura, y **nadie se entera** salvo
quien lea los logs.

Es la misma familia de defecto que SCRUM-1161/1162/1200, un fallo que se traga en silencio. **Aquí no
se construye nada:** tocar esos `catch` es modificar el camino de cobro y de emisión (regla 38/40:
STOP).

**Suelo:**
- los caminos automáticos solo corren con `AUTO_EMAIL_INVOICE_ON_PAID` activo y con cobros reales
  por YaQu. Qué vale la variable en producción no está en el repo, y en España el cobro por YaQu
  está condicionado a la regla 24;
- esto mide qué pasa **si** Resend rechaza, no que esté rechazando hoy. Con `presufacil.online`
  verificado, un rechazo por dominio solo llegaría si alguien cambiara `EMAIL_FROM` a un dominio sin
  verificar antes de verificarlo (SCRUM-1115).

## Estado de las cuatro decisiones tras la respuesta de Luis (28-sep)

**Medido contra:** `origin/main` = `44dd30659ce983dd646f35da0ee582860877a9bb` · 2026-09-28T16:08:06Z

| Decisión | Estado | Dónde |
|---|---|---|
| Logo por URL | ✅ decidido por Javier: solo a nuestro servidor | SCRUM-1231 (S1) |
| Google Fonts (los dos hosts) | ✅ **hecho** por el equipo de Luis. No lo he medido yo | SCRUM-1234 · autorización en el comentario 17378 |
| Cloudflare: proxy | ⏳ **abierto**. Se declara como encargado (texto sin autorizar) | — |
| Cloudflare: NEL (`Report-To` → `a.nel.cloudflare.com`) | ⏳ **abierto, PENDIENTE DE LUIS**. Nadie ha mirado si se apaga desde su panel | — |
| Resend: seguimiento de clics **y** de aperturas | ✅ **resuelto con fuente + informe de Luis** (ver abajo) | — |

### Aperturas: la condición de la fuente cubre LAS DOS, leída y no deducida

Relectura literal de la misma descarga del 28-sep (`api-reference/domains/update-domain`, sha256[16]
`b34519c1536f862d`). La frase aparece **dos veces, una en cada parámetro**, no una sola para los dos:

- `click_tracking`: «Track clicks within the body of each HTML email.» → *Info:* «This setting is only
  applied if a `tracking_subdomain` is configured and verified.»
- `open_tracking`: «Track the open rate of each email.» → *Info:* «This setting is only applied if a
  `tracking_subdomain` is configured and verified.»

Luis informa de que **no existe ningún subdominio de seguimiento**. Con la fuente, eso deja **sin
aplicar** el seguimiento de clics **y** el de aperturas.

**Suelo:**
- «no existe subdominio» es el informe de Luis desde el panel, no una medición mía. Lo que medí yo
  (15 nombres típicos en `presufacil.online`, 11 en `yaqu.app`, todos sin CNAME) es compatible con él,
  pero no lo prueba;
- la fuente es la versión de la documentación bajada hoy.

### `yaqu.app` verificado en Resend: confirmado por DNS

Nueva medición, 28-sep 16:08Z:
- `resend._domainkey.yaqu.app TXT p=…` **existe**. A las 15:20Z era NXDOMAIN, lo que cuadra con el
  alta de hoy que cuenta Luis.
- `send.yaqu.app`: MX `feedback.forge.rmta.net`, más un CNAME a `send.forge.rmta.net` y SPF con IPs
  propias.
- **Anotado sin interpretarlo:** la Return-Path de `yaqu.app` no apunta a Amazon SES, como la de
  `presufacil.online` (`feedback-smtp.eu-west-1.amazonses.com`), sino a `forge.rmta.net`. La
  documentación dice que los registros son los que Resend genera. Lo que significa esa diferencia no
  está medido.
- Que el backend ya **envíe** desde `yaqu.app` depende de `EMAIL_FROM` (SCRUM-1115). Esto solo mide
  que el dominio está verificado.

## SCRUM-1196b · Propuesta de política de privacidad: todos los terceros en un solo texto

**Medido contra:** `origin/main` = `0afa87cd95645317226f59bc379edae59a7bea44` · 2026-09-28T18:36:58Z (hora de GitHub; la política servida se bajó a las 18:34:38 GMT)

**Carril:** J4 (jv-j4). **Estado del texto: PROPUESTO, SIN FIRMAR.** Regla 39: lo firma el fundador.
Aquí no se toca `public/` ni `src/`, y nada de esto se publica. Cuando esté firmado, lo construye J3.

**Por qué va en 1196b y no en 1154.** SCRUM-1154 pide solo el §5 de la IA (Google). Lo que queda
abierto de 1196 es el texto de TODOS los terceros: Cloudflare (proxy, NEL y correo), Google, Anthropic
y el logo. Son cuatro parches sobre la misma lista del §5, y el encargo pide uno. Esta propuesta
**incluye** la parte de 1154 (la fila de Google). Si se firma, 1154 queda cubierto por el mismo PR de
J3 y no hace falta un texto aparte.

### 1. Lo que dice la política publicada HOY, medido en producción

`curl https://yaqu.app/privacidad.html` → `200`, 9.394 B, sha256[16] `36a987715e61f891`.
`origin/main:public/privacidad.html` → 8.917 B, sha256[16] `1b62f11bb6244042`.

**Difieren, y la diferencia NO es de texto: la pone Cloudflare al servir.**
- Tres `mailto:hola@yaqu.app` (§1, §7 y §10) salen reescritos a `/cdn-cgi/l/email-protection#…`. En
  el HTML, la dirección se ve como `[email protected]`.
- Se inyecta `<script … src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js">`.
- Aparte de esas 4 líneas, el texto es idéntico (diff de 17 líneas en
  `evidencias/scrum1196/privacidad-main-vs-servida.diff`). La copia servida está en
  `evidencias/scrum1196/privacidad-servida-2026-09-28.html`.
- Dos descargas seguidas dan hashes distintos, porque la ofuscación cambia en cada respuesta. **El
  hash de la página servida no sirve de ancla.**

🔴 **Hallazgo legal aparte del texto.** La dirección para ejercer los derechos (§7) y la de contacto
(§1 y §10) **solo se ven si el navegador ejecuta JavaScript**. Sin JS, o en un lector que no lo
ejecute, se lee `[email protected]`. Esto se arregla en el panel de Cloudflare (la ofuscación de
correos), **no** en el texto. Es del fundador, igual que el NEL: aquí solo se declara.

**Ya no se carga Google Fonts.** Hoy no hay ningún host de Google en `privacidad.html`, ni en la raíz,
ni en `/pay/bank/<inventado>`, ni en `/cliente/<inventado>`. Control positivo: el mismo extractor ve
`https://yaqu.app`, `https://schema.org` y `https://www.aepd.es`. Es SCRUM-1234, mergeado en #1908.
**Por eso Google Fonts no entra en la propuesta.** Esto lo he medido yo en esas 4 URLs, no en las 16
superficies.

### 2. Los terceros, uno por fila

Leído en `origin/main` @ `0afa87cd`: `package.json` (SDKs), URLs de `src/` y llamadas a la IA. En
producción: cabeceras y DNS.

| Tercero | Qué dato del cliente final recibe | Por qué | ¿Nombrado hoy? |
|---|---|---|---|
| **Cloudflare, proxy** | Todo el tráfico de yaqu.app: IP, navegador y la URL completa, incluidos los tokens de `/pay/…`, `/cliente/…`, `/recibo/…` y `/albaran/…`. Además reescribe el HTML (§1) | `Server: cloudflare` y `CF-RAY …-MAD` en todas las respuestas | **NO** |
| **Cloudflare, NEL** | Si una petición a yaqu.app falla, **el propio navegador** manda un informe a `a.nel.cloudflare.com` con la URL (sin el fragmento), el `referrer`, la IP del servidor, el método y el código de estado. Si el fallo es de DNS o de conexión, se quitan la ruta y la query; si es de la aplicación (un 5xx, por ejemplo), **la ruta con el token va dentro**. Dura 7 días | Cabeceras `Nel`/`Report-To` medidas hoy. Norma W3C *Network Error Logging* bajada con curl (sha256[16] `21bb87666c969f00`): «Clear url's fragment. If report body's phase property is dns or connection: Clear url's path and query.» | **NO** |
| **Cloudflare, correo entrante** | Los correos que escribe cualquiera a `hola@yaqu.app`, **incluidas las solicitudes de derechos del §7** | MX de `yaqu.app` = `route1/2/3.mx.cloudflare.net` (DoH, 28-sep). Es Cloudflare Email Routing | **NO** |
| **Google (Gemini)** | Al redactar el mensaje del presupuesto: **el nombre del cliente final**, el concepto y el total (`generateQuoteMessage`, `ai.routes.ts:191`). La descripción del trabajo y el dictado del parte (texto libre que puede llevar datos del cliente) | Proveedor por defecto de `aiComplete` (`ai.service.ts:39`); en exclusiva para leer tickets de gasto (`expenses.routes.ts:238`, sin flag) | **NO** (SCRUM-1154) |
| **Anthropic (Claude)** | Lo mismo que Google, solo si Gemini no está configurado | Respaldo vivo: `anthropic.messages.create` (`ai.service.ts:43`) | Sí, pero **como único proveedor de IA**, y eso ya no es verdad |
| **Logo por URL** (el host lo elige el profesional) | IP y navegador, en 6 superficies. El token **no** va: `Referrer-Policy: strict-origin-when-cross-origin` | `schemas.ts:438-441`: la rama `z.string().url()` **sigue en main** | **NO**, y no se puede nombrar |
| Meta (WhatsApp) | Teléfono y contenido del mensaje | `graph.facebook.com` | Sí (§4 y §5) |
| Stripe · Mercado Pago | Datos de pago (redirección) | SDK `stripe`; `api.mercadopago.com` | Sí |
| Resend | Correo del cliente final, factura en PDF y presupuesto | `api.resend.com` | Sí |
| Railway | Todo (alojamiento y base de datos) | `x-railway-edge` | Sí |

**Censo sin aparición:** ninguna analítica ni monitorización externa. Se buscaron `sentry`, `posthog`,
`mixpanel`, `segment`, `datadog`, `logtail`, `twilio`, `openai`, `cloudinary`, `amazonaws`,
`plausible`, `hotjar`, `gtag` y `googletagmanager` en `src/` y `public/`: solo salen falsos positivos
de CSS (`.segmented`). Dependencias de terceros en `package.json`: `@anthropic-ai/sdk`, `stripe` y
`nodemailer` (solo en desarrollo o con `SMTP_URL`; en producción va Resend).

**Fuera a propósito:** la AEAT. Mencionarla sería un claim fiscal (regla 7), y el envío no está
activo antes de SIF-1.

### 3. El texto propuesto (literales para firmar)

Todos van en `public/privacidad.html`. **Se localizan por contenido, no por número de línea:** la
fila de Anthropic era la `:81` en SCRUM-950 y hoy es la `:79`, porque SCRUM-1234 la movió.

| # | Dónde | Acción | Literal propuesto |
|---|---|---|---|
| **L1** | §5, `<li>` que empieza por `<strong>Anthropic</strong>` | **sustituye** esa fila por L1 + L2 | `<li><strong>Google (Gemini)</strong> — asistencia de IA para redactar presupuestos, partes de trabajo y el mensaje que acompaña a un presupuesto (puede recibir el nombre de tu cliente y la descripción del trabajo), y para leer el texto de las fotos de tickets de gasto que subes; es el proveedor de IA por defecto (transferencia internacional).</li>` |
| **L2** | §5, justo después de L1 | nueva | `<li><strong>Anthropic (Claude)</strong> — la misma asistencia de IA para presupuestos, partes y mensajes, solo como proveedor de respaldo si Google no está disponible (transferencia internacional).</li>` |
| **L3** | §5, después de la fila de Railway | nueva | `<li><strong>Cloudflare</strong> — red de entrega y seguridad por la que pasa todo el tráfico de yaqu.app, incluidas las páginas de presupuesto, firma y pago que abren tus clientes (dirección IP, navegador y dirección de la página); también gestiona el correo que se recibe en las direcciones @yaqu.app (transferencia internacional).</li>` |
| **L4** | §5, justo después de L3. **Solo si el NEL sigue encendido** | nueva | `<li>Si una página de yaqu.app no carga, tu navegador puede enviar directamente a Cloudflare, durante los 7 días siguientes a tu última visita, un informe técnico del error (la dirección de la página, el tipo de error y la dirección del servidor).</li>` |
| **L5** | §5, al final de la lista. **Solo si se publica ANTES de que SCRUM-1231 esté en main** | nueva, **provisional** | `<li>Si un profesional configura su logo como un enlace a una imagen alojada fuera de YaQu, al abrir sus presupuestos y páginas de pago tu navegador descarga esa imagen del servidor que él haya elegido, que recibe tu dirección IP y tu navegador.</li>` |
| **L6** | cabecera, `Última actualización: 23 de julio de 2026` | sustituye la fecha | `Última actualización: <día> de <mes> de 2026` (el día en que J3 lo publique; no se inventa aquí) |

**Diferencias con el literal 16198 de SCRUM-950, y por qué:**
1. **Google recibe también el nombre del cliente final.** La llamada es `generateQuoteMessage`
   (`customerName`) y hace falta decirlo. Añado además partes de trabajo, porque `suggestLineasDeParte`
   y `suggestAlbaranLines` también pasan por `aiComplete`.
2. **Retiro «sin uso de tus datos para entrenar modelos» de Anthropic.** Estaba en el texto publicado,
   pero nunca lo he medido contra las condiciones de Anthropic. Una afirmación que no puedo sostener no
   la propongo. Si el fundador la quiere, se mide antes (ver §4).
3. **Retiro «desde el 6-jul-2026».** Una fecha interna no le sirve al lector y caduca.
4. **Para Google no afirmo nada de entrenamiento.** Es lo que avisaba el comentario 17317 de 1154.

**Recomendación:** publicar **después** de SCRUM-1231 y sin L5. Un texto que tiene que decir «un
servidor que no sabemos cuál es» es justo lo que la decisión del fundador de 1231 quiso quitar.

### 4. SIN DETERMINAR (no lo puedo sostener, y lo digo)

| Qué | Por qué no se sabe desde aquí | Quién lo mira |
|---|---|---|
| **¿Se apaga el NEL?** Decide si va L4 | Es un ajuste del panel de Cloudflare, no del código | **Fundador** (panel). No es mío |
| **¿Se quita la ofuscación de correos?** | Lo mismo: panel de Cloudflare | **Fundador** (panel) |
| **¿El proyecto de Google de producción tiene facturación activa?** | Las condiciones de Gemini solo permiten servicios de pago con usuarios del EEE (comentario 17317). Si no la tiene, **ningún texto lo arregla**, y L1 describiría un uso que las condiciones no permiten | Quien tenga la consola de Google (SCRUM-1154) |
| **Seguimiento de clics y aperturas de Resend** | Luis informa de que no hay subdominio de seguimiento, y sin él la fuente dice que no se aplica. Es su informe desde el panel, no una medición mía. Si alguien lo activa, habría que añadirlo | Quien tenga el panel de Resend. No es mío |
| **¿A qué buzón reenvía Cloudflare `hola@yaqu.app`?** | Email Routing reenvía a un destino que se configura en el panel. Ese destino es **otro encargado** que L3 no puede nombrar | Fundador (panel) |
| **¿En qué región están Railway y la base de datos?** | `x-railway-edge: bcn1` es el borde, no la región del servicio. De eso depende si la fila de Railway tiene que decir «transferencia internacional», y hoy no lo dice | Quien tenga el panel de Railway |
| **«Sin uso para entrenar» (Anthropic)** | No medido contra sus condiciones | J4, si el fundador quiere mantener la frase |
| **Garantía de cada transferencia internacional** (cláusulas tipo, marco UE-EE. UU.) | La política solo la da para Meta; para el resto no la he medido | Asesor (`docs/legal/PREGUNTAS_ASESOR.md`) |

### 5. Hallazgo de otro carril (se reporta, no se arregla)

`public/dashboard/js/aiQuoteAssistant.js:190` le dice al profesional «Claude redactará un mensaje
personalizado…». Por defecto lo redacta Gemini (`ai.service.ts:39`). Es microcopy de producto (J3,
con firma), no texto legal: aquí solo queda anotado.

### Suelo

- La tabla sale del código de `main` y de lo que sirve producción. **No se ejecutó ningún navegador.**
  Lo que un script pida en tiempo de ejecución queda con el mismo suelo que el censo de 1196.
- Google Fonts: ausencia comprobada en 4 URLs servidas, no en las 16 superficies (eso lo midió 1234).
- El resto de la política (§1–§4 y §6–§10) no se ha re-auditado, salvo el hallazgo de la ofuscación
  de correos del §1.

---

# APÉNDICE · 30-sep-2026 · L6 aplicado: la fecha de la política

**Medido contra:** `origin/main` = `b6243e1c9f22e23b5a48332acc30ef533e55589f` · 2026-09-30T21:56:55+01:00
(orquestador del equipo de Javier, `cobroflash-backend-47`)

A9: comprobación → `tests/scrum1196-fecha-de-la-politica.test.mjs`

## Qué se aplica, y por qué lo aplico yo

**L6, firmado el 29-sep** (SCRUM-1196, comentario 17453): la cabecera pasa de «Última actualización:
23 de julio de 2026» a **«30 de septiembre de 2026»**, el día en que se publicó el cambio.

El literal firmado dice `Última actualización: <día> de <mes> de 2026` y añade, con estas palabras:
«el día en que J3 lo publique; **no se inventa aquí**». Así que la forma está firmada y el día lo
pone quien publica. No hay texto nuevo.

🔴 **Esto es un defecto MÍO, y lo arreglo por eso.** El 30-sep publiqué SCRUM-1154 —la política pasó a
nombrar a Google y dejó de nombrar a Anthropic— **y dejé la cabecera con la fecha de julio**. No es
cosmético: el **§9 de la propia página** promete, literalmente, «Publicaremos cualquier cambio en
esta misma página, **indicando la fecha de la última actualización**».

Durante un día, un documento legal publicado ha estado incumpliendo una promesa suya.

**Lo cazó J4 censando**, no yo revisando lo que acababa de publicar. Y el literal llevaba firmado
desde el día anterior: no faltaba una decisión, faltaba aplicarla.

## El guard, y por qué no lleva la fecha escrita dentro

Un guard que dijera «la fecha es el 30 de septiembre» **caducaría en cuanto alguien vuelva a tocar la
página**: pasaría a exigir una fecha vieja, y para arreglarlo habría que editar el guard. Eso lo
convierte en una nota.

El invariante de verdad es otro: **la fecha que la página DICE no puede ser anterior al último cambio
que la página TUVO**. Eso se le pregunta a `git`, que es quien lo sabe. Así el guard **no caduca**, y
el día que alguien cambie el §5 sin tocar la cabecera, cae solo.

| Caso | Qué sujeta |
|---|---|
| **SUELO** | la página dice su fecha en la forma firmada, y el §9 sigue prometiendo indicarla |
| **EL QUE DECIDE** | la fecha dicha ≥ el último cambio según `git`. Y si `git` no puede contestar, **se declara CIEGO**: no es un aprobado |
| **CONTROL** | el lector de fechas lee dos fechas distintas de verdad, y devuelve `null` con un mes que no existe y con un texto sin fecha |

**Interrogado, y las dos mutaciones caen donde deben:** con la fecha de julio cae «EL QUE DECIDE»;
con un mes inventado caen el SUELO y el que decide. Post-condición de contenido: la página quedó con
el mismo sha256.

⚠️ **Lo que este guard NO distingue, dicho a propósito:** un cambio de contenido de uno de formato. Si
alguien reindenta el fichero, exigirá mover la fecha igual. Para una página legal me parece el lado
bueno del error, pero que no lo descubra nadie creyendo que es un fallo.

## Lo que este apéndice NO aplica de SCRUM-1196

- **L3 (Cloudflare)**, firmado en el mismo comentario 17453 y **sin publicar**: `privacidad.html`
  sigue con Cloudflare = 0. Es de J3 y sigue pendiente.
- **L1/L2**: superados por el texto de SCRUM-1154, ya publicado.
- **L4 (NEL)**: espera al panel del fundador. **L5**: no se publica.
