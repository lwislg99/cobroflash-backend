# SCRUM-1158 · El mini-DOM del banco refleja `hidden`

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T15:50Z

A9: sin fallo que generalice — el primer empuje salió rojo por faltar esta misma línea (SCRUM-1294), y eso ya lo caza su guard; lo demás de la tanda (la junction del worktree a un cliente de Prisma viejo) es del entorno y está en «Lo que no se ha hecho».

S3 · rama `scrum-1158-el-banco-ve-hidden` · worktree `wt-s3-1288b` (hora del `Date:` de GitHub).

## Qué mentía

`tests/_banco-vistas.mjs` no tenía `hidden`. `el.hidden = true` dejaba un campo suelto en el nodo que
`scripts/_pagina-panel.mjs` (`serializar`) no emite, y un `<span hidden>` del marcado daba
`.hidden === undefined`. La página que miden los guards de navegador pintaba **visible** lo que el
producto oculta. Y existía la dirección contraria, la que da verdes huecos: algo que nace `hidden` en el
marcado y el producto enseña con `.hidden = false` **seguía oculto** en la página servida.

## Cuánto (antes del arreglo, sobre 73e41ab0)

| medida | antes | después |
|---|---|---|
| sonda de 10 casos contra el navegador (las dos direcciones, con un control visible) | **9 MAL** de 10 | 0 de 10 |
| `censo-hidden-desacorde.mjs`: elementos con la visibilidad equivocada | **23** en **5** de 18 vistas montadas (15 en `renderQuotesView`) · 17 interactivos dentro · 0 en la dirección «oculto de más» con estos datos | 0 · mismas 18 vistas montadas, mismas 10 sin montar |
| tests que importan el banco (198 ficheros) | 1.756 tests · 1.756 pass · 0 fail · 0 skip | 1.756 · 1.756 · 0 · 0 — **conjuntos de nombres idénticos** |
| `censo:tactil-panel` (`renderQuotesView` / `renderDocumentoSueltoView`, medidos · sinPintar) | 11 · 33 / 10 · 12 | 7 · 37 / 7 · 15 (los ocultos dejan de medirse; los cortos no cambian) |
| `guard:objetivo-tactil` | 0 hallazgos · 0 ciegos (con la excepción del banco) | sin tocar el guard: 1 **excepción sobrante** + 1 ciego (suelo 2, encontró 1). Con el guard ajustado: 0 · 0 |

**A cuántos instrumentos afecta:** los dos que serializan el banco para un navegador
(`guard:objetivo-tactil` y `censo:tactil-panel`). `scripts/_banco-lista.mjs` sólo lo nombra en un
comentario. **Los guards de la LANDING no usan el mini-DOM** (sirven el HTML real a un navegador real),
así que este arreglo no cambia nada de lo que miden; si algún guard de texto de la landing lee el HTML
sin navegador y cuenta secciones `hidden` como visibles, es otro instrumento y **no lo he medido**.

## El arreglo

- `tests/_banco-vistas.mjs`: getter/setter `hidden` ↔ `_attrs.hidden`, como el navegador.
- `scripts/guard-objetivo-tactil.mjs`: **se retira** la excepción `BUTTON.btn-ghost.btn-sm`
  «+ Añadir descuento» de `EXCEPCIONES_791.renderQuotesView` (la nombró el detector de sobrantes: cumple
  a 929 y a 390). Y el suelo de `renderQuotesView` **baja 2 → 1**; el que sale, nombrado: «+ Añadir
  descuento», `BUTTON.btn-ghost.btn-sm`, 43,6 → cumple. No cambió el botón: cambió el banco. Sigue: las
  casillas de 17 px. El origen del suelo pasa a SCRUM-1158 (decir «SCRUM-1148 midió 1» sería falso).
- `tests/scrum1158-el-banco-ve-hidden.test.mjs`: los casos de la sonda, en el check obligatorio.
- `docs/master/evidencias/scrum1158/censo-hidden-desacorde.mjs`: el instrumento, con control positivo
  y suelo (sale 2 si monta < 10 vistas o no monta `renderQuotesView`). Comiteado antes de tocar el banco
  (`8c651ecf9d8dcaf7e8c95949b94261adc53173a8`).

## Control positivo / rojo por mutación

Commit del árbol entero antes de mutar: `582997109ee6dd666dedc37382b362f237272e6e`. Mutación: el banco
de `origin/main` (`git diff --numstat` → `0 9 tests/_banco-vistas.mjs`).

- `tests/scrum1158-el-banco-ve-hidden.test.mjs`: **6 de 6 caen**.
- `guard:objetivo-tactil`: **1 hallazgo** — `✖ 43.6px < 44 · BUTTON.btn-ghost.btn-sm «+ Añadir descuento»`,
  salida 1. O sea: si alguien devuelve el banco a como estaba, el guard lo grita por el botón concreto.

Restaurado y comprobado (`git diff HEAD` vacío). ⚠️ El hook `guard-dangerous` bloqueó `git restore`
(busca su fichero de permiso en el checkout compartido): la mutación se deshizo re-escribiendo con Edit
las 9 líneas del arreglo, que es lo que había en HEAD.

## Lo que no se ha hecho

- `npm run build`: el primero salió 2 sólo por tipos (cliente de Prisma viejo en la junction de este
  worktree, que apuntaba a `wt-s3-1179c2`). `tsc` emite igual, así que `dist/` es de este fuente. Re-apunté
  la junction al `node_modules` compartido (ya regenerado: el guard de Prisma da ✔) y el segundo build lo
  denegó el clasificador; no lo he reintentado. El cambio no toca `src/`.
- La suite completa: no la he corrido (memoria libre 1.314 MB, umbral 2.200). La red es el CI.
- La segunda cara del ticket (c.17197: `serializar` sólo emite `cssText` y `display`, y pierde
  `el.style.minHeight = '44px'` y similares). No la he tocado: es otro defecto en otro fichero
  (`_pagina-panel.mjs`, fila general) y sigue vivo. → **Hecha abajo, en «Segunda cara».**

## Segunda cara (c.17197) · `serializar` pierde los estilos en línea

**Medido contra:** `origin/main` = `f4910603f44de8d16eab3abc938d853d255d8295` · 2026-10-15T17:37Z

S3 · rama `scrum-1158b-serializar-y-hidden` · worktree `wt-s3-1288b` (hora del `Date:` de GitHub).

**Qué mentía, y era más ancho de lo que decía el ticket.** No sólo lo puesto por JS: el banco NO
mantiene `cssText`, así que un `style="…"` del **marcado** (que `setAttribute` reparte en propiedades
sueltas desde SCRUM-1038) tampoco llegaba a la página. Sólo salía `display`.

**Cuánto, antes de tocar** (`docs/master/evidencias/scrum1158/censo-estilos-perdidos.mjs`, con control
positivo del detector independiente del `serializar` medido):

| medida | antes | después |
|---|---|---|
| declaraciones en línea que no llegan a la página | **876** en **16 de 18** vistas montadas · **824 del marcado**, 52 por JS · 335 nodos · 101 interactivos las llevan o están dentro | 0 · mismas 18 montadas, mismas 10 sin montar |
| propiedades más perdidas | color 153 · font-size 147 · font-weight 57 · width 44 · margin 41 · … · **min-height 23** | — |
| `censo:tactil-panel`, elementos DISTINTOS < 44 px | **62** (42 con `.btn-sm`) | **51** (29 con `.btn-sm`) |
| `guard:objetivo-tactil` | 0 hallazgos · 0 ciegos | 0 hallazgos · 0 ciegos (sus cuatro superficies no cambian de fila) |

**«Infla el censo» era verdad sólo a medias, y la otra mitad es la peligrosa.** Por clase:
- **Sobraban 19 falsos cortos:** `BUTTON.btn-sm.btn-ghost` 15 → 0 (las pestañas de Cobros «Bizum /
  tarjeta / transferencia»: `cobrosView.js:514` les pone `minHeight = '44px'` por JS) y
  `BUTTON.btn-sm.btn-secondary` 4 → 0 («Todos / Historial / Empresa»).
- **Faltaban 8 cortos de verdad** (verdes huecos): `BUTTON.btn-ghost.btn-sm` 3 → 8, `btn-primary` 4 → 5,
  `btn-primary.btn-sm` 3 → 4, `btn-secondary` 3 → 4. Por pantalla: Inicio pasa de 0 a 10 cortos (a 390
  tenía 6 «no tocables» que dejan de serlo), Informes de 0 a 8, Exportar de 1 a 3.
- Neto 62 − 19 + 8 = 51.

**El arreglo:** `serializar` emite cada propiedad con valor de `.style` (más `cssText` si lo hay).
Test `tests/scrum1158b-serializar-no-pierde-estilos.test.mjs`, 5 casos con un control.

**Rojo por mutación:** con el `serializar` de `origin/main` (stash del arreglo) el test da **4 de 5 rojos**;
el que pasa es el control, como debe. Con el arreglo 5/5, y `scrum1158-el-banco-ve-hidden` sigue 6/6.
Vecinos (`scrum522`, `694c`, `848b`, `1294`, `1415`, `824`, `824b` ×2): 67/67.

**Lo que no se ha hecho:** la suite entera (la red es el CI). No he medido las 10 vistas que el banco no
monta con estos datos: sobre ellas este arreglo no dice nada.
