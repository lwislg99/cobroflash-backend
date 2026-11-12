# SCRUM-1646 · CSP paso 2 (S1): sacar el script en línea de la página de firma y del albarán público

Sale de SCRUM-1637 (paso 1 = `Content-Security-Policy-Report-Only`). Sprint PILOTO-1 (SCRUM-1656).
El tramo del albarán público vive en el PR #3048 (rama `scrum-1646-csp-albaran-publico`); si este
fichero choca al unir, se conservan LAS DOS secciones.

## 2026-11-12 · Tramo avisos públicos (`publicNotFound.ts`) + medida de la firma del presupuesto

**Medido contra:** `origin/main` = `03645d4e46cae5e035db5fd51612ecce61377658` · 2026-11-12T15:14:47Z (hora de GitHub, `gh api -i zen`)

A9: comprobación → `tests/scrum1646-avisos-sin-estilo-en-linea.test.mjs`

### ① Medida en el HTML GENERADO (banco doblado de `tests/_envio-doblado.mjs`; control positivo: el censo ve lo sembrado)

| cara | `<script>` en línea | `on*=` | `<style>` | `style=` | `style=` dentro de cadenas JS | `innerHTML` |
|---|---|---|---|---|---|---|
| presupuesto · para firmar | 3 | 0 | 3 | 9 | 4 | 1 |
| presupuesto · para firmar con opciones | 3 | 2 | 3 | 12 | 4 | 1 |
| presupuesto · caducado | 0 | 0 | 2 | 2 | 0 | 0 |
| presupuesto · aceptado | 0 | 0 | 2 | 1 | 0 | 0 |
| presupuesto · rechazado | 0 | 0 | 2 | 2 | 0 | 0 |
| presupuesto · formulario de rechazo | 0 | 0 | 2 | 7 | 0 | 0 |
| `documentNotFoundHtml` (404 del token) | 0 | 0 | **1** | 0 | 0 | 0 |
| `notFoundPageHtml` (404 genérico) | 0 | 0 | **1** | 0 | 0 | 0 |
| `documentoEnRegistroHtml` (factura en proceso) | 0 | 0 | **1** | 0 | 0 | 0 |

(Las caras del presupuesto, con `brandColor` puesto: uno de sus `<style>` es `brandOverrideCss`, que lleva el color del negocio DENTRO.)

### ② Lo que queda para el relevo: la firma del presupuesto (`quoteDecisionLanding.routes.ts`) — partido en 1646c y 1646d

Decisión del orquestador (12-nov): no se empieza a medias entre relevos. Punto de partida medido:

- **Script (1646c).** Tres `<script>`: `TIER_JS` (no interpola nada: el parámetro `token` no se usa), `SIG_JS` (constante) y el del botón, que interpola el token en la ruta del POST, `locale.quote`/`quoteVerb`/`qg`, `esc(shareName)`, `sinBotonDePago`, `shareTextEnc`, los dos códigos de 409 y `COPY_RESPUESTA_SIN_CONFIRMAR`, y monta la tarjeta del éxito con `innerHTML` (4 `style=` dentro). Más `onclick="selectTier(…)"` en cada opción. `TIER_JS` se exporta (lo lee SCRUM-212).
- **Estilo (1646d).** El `<style>` de `renderPage`, `<style>${TIER_CSS}</style>` en el cuerpo y `brandOverrideCss(brandColor)`: el color de marca es DINÁMICO → una hoja servida por ruta con el color validado (`^#[0-9a-fA-F]{6}$`, el mismo filtro de hoy), no una cadena constante.
- **Acoplamiento: 30 ficheros de `tests/` leen esta página** — `banco-scrum1325/mutar.mjs`, 1001, 1234, 1273, 1276, 1279, 1302d, 1302r, 1302p, 1302t, 1325b, 1431 (×2), 1442b, 1444, 1476, 1636c, 212, 243, 264, 389, 596, 633, 762, 806, 888d, 888g, 987, `_expresiones-de-texto.json`, `_sonda-fecha-impresa.mjs`. Varios EJECUTAN el `<script>` en línea (1302t, 1302d, 264, 1001, 1276), llevan `MUTACIONES_QUE_ME_TUMBAN` con cadenas del fuente (`de:`), y 888d guarda la página «byte a byte».

### ③ Qué se ha construido (los tres avisos)

- Cada `<style>` pasa **tal cual** (mismas reglas, mismo orden) a `AVISOS_CSS` en `publicNotFound.ts`, y la página enlaza su hoja en el MISMO sitio de la cabecera: `/avisos/css/<hoja>.css?v=<huella>`. Tres hojas y no una: las tres dan reglas DISTINTAS a `h1` y `p`.
- Servidas desde `app.ts` (bloque S1, antes de cualquier ruta con auth y del 404), `immutable` SÓLO con la huella buena (SCRUM-274); si no, `no-cache`. Declaradas `no-sensitive-resource` y `/avisos` añadido a `PUBLIC_PREFIXES`: sin eso SCRUM-98 no las enumeraba y daba la declaración por huérfana (se arregló el censo de rutas públicas, no el guard).
- **Ningún texto tocado** (regla 39).

### ④ Pruebas

- Test nuevo (4 casos): control · las tres páginas sin `<style>`/`style=`/`<script>` en línea, con una sola hoja, suya, desde `'self'`, huella = sha1 del contenido y en el sitio del `<style>` · `immutable` sólo con la huella · las hojas sin marcado ni plantilla.
- **Rojo visto (mutantes declarados):** M1 (vuelve el `<style>` al 404 genérico) → caen 2 de 4; M2 (`immutable` siempre) → cae 1 de 4. Restaurado: 4/4.
- Relacionados: 1646, 98, 55, 1404g, 1573b, 924 → **108/108**. `npm run guards:entrada` → 15 guards, **170/170**.

### ⑤ Cero cambios visibles: capturas con la CSP APLICADA

Chromium (Playwright). **Antes** = HTML del fuente de `origin/main` (transpilado tal cual), **sin** CSP. **Después** = HTML de esta rama con `Content-Security-Policy` (la `POLITICA_CSP` entera de `csp.ts`) **aplicada**. Tres caras a 390 y 1280 px.

- **6 de 6 capturas IGUALES byte a byte**; mismas reglas cargadas (5 / 7 / 4) y mismo fondo calculado.
- **0 violaciones de CSP** en las de después.
- **Control positivo:** la página de antes CON la CSP aplicada sale **DISTINTA** en las 6 (sin hojas, fondo transparente) y con 6 violaciones `style-src 'self'` en consola: el instrumento ve.

Scripts en `docs/master/evidencias/SCRUM-1646/`. ⚠️ Banco local, NO un recorrido en yaqu.app: se recorre tras el merge.

### ⑥ Lo que falta

- 1646c y 1646d (arriba), al relevo.
- Recorrido en yaqu.app de los tres avisos tras el merge, con la CSP aplicada por Playwright.
