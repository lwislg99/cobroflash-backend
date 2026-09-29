# SCRUM-1234 — Inter servida desde yaqu.app (fuera Google Fonts)

**Medido contra:** `origin/main` = `29eea3f9baba711eb65a3b6119727ef4777f0159` · 2026-09-28T15:37:32Z

Sale de **SCRUM-1196 ①** (censo de J4, c.17366). Encargo del orquestador a S2 (28-sep): el trabajo
**entero**, incluida la parte de `src/` del equipo de Javier, para que no haya dos PR tocando los mismos
ficheros. **Javier lo ofreció/autorizó** por mensaje al fundador (no hay comentario suyo en Jira): lo
deja escrito el orquestador, con sus palabras, en **SCRUM-1196 c.17378**. J4 lo da por «ya autorizado» en
c.17366.

## Qué había

16 superficies × 3 líneas (2 `preconnect` + la hoja `Inter:wght@400;500;600;700;800&display=swap`) =
**48 líneas** (el encargo decía 32). Cada visita mandaba la IP a `fonts.googleapis.com` (la hoja) y a
`fonts.gstatic.com` (las letras). Nueve de las 16 las ve el **cliente final**.

## Qué se hace

- `public/fonts/`: los **7 `.woff2` que servía Google** (Inter v20, fuente variable, un fichero por
  subconjunto: latin, latin-ext, cyrillic, cyrillic-ext, greek, greek-ext, vietnamese; 218 KB) +
  `inter.css` con las **35 `@font-face` de la hoja de Google copiadas tal cual**, cambiando solo la URL
  (generado, no escrito a mano) + `OFL.txt` (licencia SIL OFL 1.1, obligatoria al redistribuir).
- No se colapsa a `font-weight: 400 800`: con un rango, un grosor intermedio (650) se pintaría tal cual
  en vez de redondearse a 700. Grosores DISCRETOS, como antes.
- Las 3 líneas de cada superficie → `<link rel="stylesheet" href="/fonts/inter.css"/>`.
- Comentarios de `src/app.ts` y `src/core/http/huellaEstaticos.ts` que afirmaban que se cargaba Google
  Fonts: corregidos. `docs/CACHE_POLICY.md`: fila para `/fonts/`.

## Cero cambio visual — MEDIDO, no supuesto

`evidencias/SCRUM-1234/comparar-google-vs-local.mjs`: la misma página (grosores 300, 400, 500, 600,
650, 700, 800, 900; tildes, €, «», griego, cirílico, vietnamita; cursiva sintética) en Edge headless a
390 px @2x, una vez con la hoja de Google y otra con la local. **Las dos capturas salen idénticas byte a
byte** (217.564 bytes cada una), con 20 caras cargadas en ambas. Peticiones a Google: 5 con la de
Google, **0** con la local. Captura: `evidencias/SCRUM-1234/inter-local-390.png`.

## Búsqueda final

Cero `fonts.googleapis.com` / `fonts.gstatic.com` en `public/` y `src/` (también en comentarios). Lo
fija `tests/scrum1234-inter-autoalojada.test.mjs` (suelo: >200 ficheros recorridos). Quedan menciones
en `tests/` (un ejemplo de URL absoluta en `scrum274`, que prueba `esExterna` y no carga nada) y en
evidencias viejas de `docs/`.

## Censos que describían lo que cambia (actualizados a propósito, con su motivo)

- `scrum329` · `sinTercerosEnLaLanding` pasa de `false` a `true`: **mejora**, anotada también en
  `docs/master/SCRUM-329.md`.
- `scrum676` · el índice del panel pasa de 2 hojas locales + 1 remota a **3 locales + 0 remotas**; la
  separación remota/local se sigue probando en corpus con la misma forma de etiqueta; el suelo de
  `<link>` que no son hojas baja de 4 a 3 porque salen los dos `preconnect` (las tres que quedan se
  nombran una a una).

## Tests

Rojo antes (mutación: `payBank.routes.ts` devuelto a `origin/main`) → caen los 2 guards; restaurado →
verde. Vecinos (219 ficheros que cargan alguna de las 16 superficies, el sellado o el SW): verdes salvo
`scrum910d`, ajeno y conocido por carga.

**NO VERIFICADO en yaqu.app** (lectura de producción denegada a S2).

---

## 🟦 BLOQUE PARA REVISIÓN DEL EQUIPO DE JAVIER — su parte, en `src/`

Hecho por S2 por encargo del orquestador, con la autorización que consta arriba. **Único cambio en cada
fichero: las 3 líneas de Google Fonts del `<head>` de la plantilla → 1 línea `/fonts/inter.css`.** Ni
lógica, ni importes, ni estados, ni rutas.

| Fichero | Superficie (cliente final salvo la última) |
|---|---|
| `src/modules/billing/app/routes/payBank.routes.ts` | pago por transferencia |
| `src/modules/billing/app/routes/payBizum.routes.ts` | pago por Bizum |
| `src/modules/billing/app/routes/payInvoice.routes.ts` | selector de pago de factura |
| `src/modules/billing/app/routes/payMp.routes.ts` | Mercado Pago |
| `src/modules/billing/app/routes/receipt.routes.ts` | recibo |
| `src/modules/jobs/app/routes/albaranPublic.routes.ts` | albarán (firma remota) |
| `src/modules/system/app/routes/customerPortal.routes.ts` | portal del cliente |
| `src/modules/system/app/routes/quoteDecisionLanding.routes.ts` | aceptación del presupuesto |
| `src/modules/system/domain/publicProfile.service.ts` | perfil público del negocio |

Más dos comentarios corregidos: `src/app.ts:130` y `src/core/http/huellaEstaticos.ts:39`.
