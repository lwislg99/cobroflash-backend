# SCRUM-1196 · Censo de terceros que reciben datos del CLIENTE FINAL: medido sobre el HTML servido

**Fecha:** 28-sep-2026 · **Carril:** legal / privacidad · **Puesto:** J4 (jv-j4)
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
