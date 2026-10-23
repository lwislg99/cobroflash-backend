# SCRUM-1603 · el banco del medidor de toque no enlaza Inter y mide con Segoe UI (la app sí la carga)

**Medido contra:** `origin/main` = `2c45bf589aeae007eb12ed388b3e0f4d2d8d98ed` · 2026-10-23T20:49:33Z (hora de GitHub al escribir: 2026-10-23T21:01:18Z; los ficheros medidos no cambian hasta `a7855fd70b1bf4a4d6e565fc83c6233df25e9050`)
A9: comprobación → `docs/master/evidencias/SCRUM-1603/sonda-fuente.mjs`

Puesto J3 (`jv-j3ax`) · rama `scrum-1603a-banco-sin-inter`. Encargo del orquestador del equipo de Javier
(`cobroflash-backend-62`): SÓLO MEDIR la frase «Inter no se carga en ningún sitio» de SCRUM-1592 c.20613 (J2,
`jv-j2ap`) y SCRUM-1584 c.20614, y abrir ticket para el equipo de Luis. El hook de arranque dijo «SIN IDENTIDAD»
(SCRUM-1498); el puesto lo da el encargo, y se dice aquí. Este PR es sólo de docs: no toca ningún fichero de
`public/`, `scripts/` ni `src/`. El ticket es del equipo de Luis (`equipo-luis`, `area-s3`); este registro guarda la
evidencia de la medición.

## La premisa era falsa para la app y cierta para el banco

- **Lo que pide el diseño:** `DESIGN.md:139` (Inter, con system-ui de reserva) y `public/dashboard/css/styles.css:108`
  (`--font: 'Inter', system-ui, -apple-system, sans-serif`).
- **Quién la carga:** Inter está autoalojada desde SCRUM-1234 (`public/fonts/inter.css`, 35 `@font-face`, 7
  `.woff2`). La enlazan las 16 superficies: 7 de `public/` (index, login, register, precios, privacidad, terminos,
  `dashboard/index.html:7`) y 9 de `src/` (payBank, payBizum, payInvoice, payMp, receipt, albaranPublic,
  customerPortal, quoteDecisionLanding, publicProfile.service). Producción: `GET https://yaqu.app/fonts/inter-latin.woff2`
  → 200, `Content-Type: font/woff2`, 48.256 B (`Date:` 21:00:02Z).
- **Qué se pinta** (`sonda-fuente.mjs`, Edge 155 headless, Windows, navegador por `scripts/_navegador.mjs`; salida
  entera en `salida-sonda.txt`): la fuente que el motor USÓ (`CSS.getPlatformFontsForNode`) sobre un texto hermano
  del campo `.input`.

| caso | fuente USADA | caja `.input` |
|---|---|---|
| A · banco del guard táctil tal cual (sin `inter.css`) | Segoe UI | 36 px |
| B · banco + `inter.css`, woff2 como `application/octet-stream` (los tipos del guard) | Inter (web) | 34 px |
| C · banco + `inter.css`, woff2 como `font/woff2` [positivo sembrado] | Inter (web) | 34 px |
| F · panel real `public/dashboard/index.html` servido del árbol | Inter (web) | 34 px |
| E · `public/login.html` del árbol | Inter (web) | — |
| G/H · `https://yaqu.app/` y `/login.html` (producción) | Inter (web) | — |

Controles: el positivo sembrado C TIENE que pintar Inter y el negativo A no puede; si falla cualquiera, la sonda
sale con 2 y dice CIEGO. `document.fonts.check('16px Inter')` da `true` en los 8 casos, también en A, que no tiene
ninguna cara Inter: no vale como sonda.

- **Qué bancos están así** (`censo-envoltorios.mjs`, sobre 1.986 ficheros de `scripts/` y `tests/` más una semilla
  que sale; sin semilla dice CIEGO, `salida-censo-sin-semilla.txt`): 5 montan página con `/tokens.css` o
  `/dashboard/css/styles.css`; 2 enlazan también `inter.css`; **3 no**: `scripts/guard-objetivo-tactil.mjs`
  (`PANEL_HTML`, `:190-193`, y `envolver`, `:238-241`), `scripts/censo-objetivo-tactil-panel.mjs` y
  `scripts/_banco-lista.mjs:80`.

## Impacto en la casa

- `guard:objetivo-tactil` (job «guards de navegador»): en Windows mide 2 px de más el campo `.input`. Es el 0 local
  que no predijo el rojo de CI en SCRUM-1584 c.20600. Con Inter, en Windows, la caja da 34, la cifra de CI.
- `censo:tactil-panel` (S3, informativo en cada PR): la misma hoja sin Inter.
- `_banco-lista.mjs`: lo importan, entre otros, `guard-lista-gastos`, `guard-lista-trabajos` y
  `guard-lista-trabajos-917`, que leen geometría. No he medido si alguno cambia de veredicto.
- Contraste: depende del tamaño y del grosor, no de la familia. No lo he medido.

## Dueño

`node scripts/carriles.mjs de …`: `censo-objetivo-tactil-panel.mjs` → S3. `guard-objetivo-tactil.mjs` y
`_banco-lista.mjs` → sin cerradura (fila general de `scripts/`). `inter.css`, `tokens.css` y `styles.css` → S2.
Ticket con `equipo-luis` y `area-s3`; el dueño del guard y de `_banco-lista.mjs` lo decide el orquestador de Luis.

## Salidas (en el ticket, sin elegir)

① cargar Inter en los 3 bancos · ② quitar Inter del token (S2, cambio visual; contradice SCRUM-1234) · ③ dejar la
fuente del sistema y declararlo en los 3 ficheros.

## Errores

- **Míos:** la primera versión de la sonda leía el texto del `input` con un segundo `DOM.getDocument`, que invalida
  los `nodeId` del primero, y daba «(vacío)» en los 8 casos. La cazó su positivo sembrado (CIEGO, salida 2) y no la
  di por buena; ahora mide un `<span>` hermano. La primera versión del censo, sin semilla, salía verde en vez de
  CIEGO; la arreglé antes de subirla. Y la primera llamada a Jira para crear el ticket se colgó 300 s sin crearlo
  (lo comprobé buscando antes de reintentar).
- **De la premisa:** «Inter no se carga en ningún sitio» salió de c.20613 sin medir, y el orquestador la pasó al
  encargo copiada de allí (lo dijo él mismo por mensaje).

## Sin medir

Qué fuente de reserva usa el Chromium de Linux de CI; el guard y el censo reales con `inter.css` añadido (no he
modificado ningún fichero del árbol); los guards de lista; la landing (su campo inyectado heredaba `Arial` de su hoja).
