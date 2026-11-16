# SCRUM-1637 · Content-Security-Policy — PASO 1: sólo en modo informe

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-02T20:07:24Z

A9: comprobación → `tests/scrum1637-csp-solo-informe.test.mjs`

## 2-nov-2026 · S1 · `Content-Security-Policy-Report-Only` global, sin `'unsafe-inline'`

**Decisión del orquestador (2-nov), que cambia el ticket:** el paso con `'unsafe-inline'` NO entra. Una CSP
con `'unsafe-inline'` no habría parado el XSS de SCRUM-1632c, que era exactamente script en línea
inyectado: sería una cabecera puesta y cero protección contra lo único que nos ha mordido. Entra sólo
`Content-Security-Policy-Report-Only`, con la política ESTRICTA que se quiere aplicar.

**Medido antes (sesión S1 del 29-oct / 2-nov, no repetido):** 24 páginas públicas o servidas con `<script>`
en línea y `style=` (la de firma: 3 scripts y 23 `style=`); CERO scripts de CDN (fuera sólo hay enlaces:
wa.me, mercadopago, aepd). Con `script-src 'self'` aplicada se rompen TODAS.

| qué | dónde |
|---|---|
| la política, la cabecera y el middleware | `src/core/http/csp.ts` (carril S1) |
| montado global, antes de cualquier ruta, junto a `Referrer-Policy` | `src/app.ts` (S1, contenedor) |
| el test, por la ruta de verdad (`dist/app.js` con el doble del banco) | `tests/scrum1637-csp-solo-informe.test.mjs` |

Política: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self';
connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.

**Test:** 2/2 en verde (firma `/albaran/<token falso>`, `/pay/quote/<token falso>`, `/admin/me` sin sesión,
`/login.html`). Mutantes sobre `dist`, restaurados: quitar el `app.use` · añadir `'unsafe-inline'` a
`script-src` · cambiar la cabecera a la que BLOQUEA → los tres lo tumban.

⚠️ **Lo que esto NO es:** no protege de nada. Report-Only sólo hace que el navegador diga en la consola lo
que habría bloqueado. No se puede contar como protección hasta el paso 3.

**Fuera de este tramo, declarado:**
- **El colector (`report-uri`) NO está.** Una ruta pública nueva de POST arrastra la declaración de acceso
  público y el límite de peticiones, y el informe trae `document-uri` con el TOKEN de la página de firma
  dentro: guardarlo tal cual es un secreto en el log. Es el tramo siguiente, con la URL recortada antes de
  escribir nada. Hasta entonces la población de quejas se lee en la consola del navegador.
- **El paso 2 (quitar los `on*=` y los scripts en línea) es su propio ticket**, con el reparto por carril:
  firma y albarán S1; `payBank`/`payBizum`/`payInvoice` J2; `invoicesAdmin` J1; `login.html` J3.
- **Cloudflare:** no se ha mirado si añade o quita cabeceras por delante. Lo dice la aceptación 1
  (`curl -sI` contra yaqu.app) cuando esto entre.
- **Aceptación 3 (recorrido en yaqu.app sin errores de CSP en consola)** no aplica tal cual en Report-Only:
  los informes SALDRÁN (son la medida). Lo que se mira tras el merge es que las páginas siguen funcionando
  y cuántos informes da cada una.
