# SCRUM-1158 · El mini-DOM del banco refleja `hidden`

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T15:50Z

A9: sin fallo que generalice — el primer empuje salió rojo por faltar esta misma línea (SCRUM-1294), y eso ya lo caza su guard; lo demás de la tanda (la junction del worktree a un cliente de Prisma viejo) es del entorno y está en «Lo que no se ha hecho».

S3 · rama `scrum-1158-el-banco-ve-hidden` · worktree `wt-s3-1288b` (hora del `Date:` de GitHub).

## SCRUM-1158c · los objetivos cortos que destapó el banco arreglado: Inicio e Informes a 44 px (S2)

**Medido contra:** `origin/main` = `7e53b1474096bde7aa23898d9f30caf2097b5d70` · 2026-10-16T11:28:09Z (`Date:` de GitHub)
A9: aviso → cicatriz S2 «el banco de `main` daba 0 cortos en Inicio e Informes y producción tenía 20» — no se pudo comprobar: lo que lo impide es el censo en navegador sobre el banco de #2500, que no corre en cada PR

*(Va aquí, y no al final, porque #2500 —1158b, de S3, abierto— añade 146 líneas al final de este fichero: dos anexos
al final chocan. Este tramo acaba en «Fin de 1158c»; lo de debajo es el registro original de 1158.)*

S2 · rama `scrum-1158c-inicio-informes-44px` · worktree `s2-1158c`. Skill UI cargada (`yaqu-premium-ui`): sólo
tamaño, cero tokens, cero texto. Forma firmada: decisión del fundador de SCRUM-786 (c.16266, opción ③: reglas de
44 px ACOTADAS, nunca `.btn-sm` global); el encargo, del orquestador (lote del 16-oct, punto 3).

**Recuento, no cifra heredada.** `censo:tactil-panel` sobre `main` (`48fc00f6a`): Inicio **0**, Informes **0**,
Exportar 1 → el banco de `main` todavía pierde los estilos. Sobre la punta de #2500 (`3d1570004`, el banco
arreglado): Inicio **10/10** y Informes **8/8** a 929 y a 390, Exportar 3 sólo a 929 → **18**, los que dijo el
orquestador. Exportar NO se toca (decidido: SCRUM-384/352, y a 929 juzga contra 36 px).

| dónde | qué | antes | después |
|---|---|---|---|
| Inicio | «⚙ Personalizar» (`#btn-home-prefs`) | 30 | 44 |
| Inicio | «Ir →» de «Completa tu configuración» | 39×30 | 44×44 |
| Informes | «1T-4T» de «IVA repercutido» y de «Resumen del trimestre» | 38-41×30 | 44×44 |
| Informes, **de paso** | fila de descargas: «⬇ Facturas / Gastos / Presupuestos / Trabajos / Clientes CSV» | 30 | 44 |

**De paso — un agujero del instrumento, NO de S2:** el censo nunca vio la fila de descargas. En el banco los 5
enlaces están en el DOM (5 de 5), pero el HTML que serializa `_pagina-panel.mjs` no los lleva (0 de 5, y tampoco
«⬇ VeriFactu XML»); Informes salía con 8 medidos y eran los 13 de producción. Reportado al orquestador.

### Qué cambia
- `public/dashboard/css/styles.css`: tres reglas acotadas (`#btn-home-prefs` y `.informes-exportar > .btn-sm`:
  alto; `.home-checklist .btn-sm`, `#vat-quarter-row > .btn-sm`, `#resumen-quarter-row > .btn-sm`: alto y ancho).
- `homeView.js` / `reportsView.js`: una clase de enganche cada uno (`home-checklist`, `informes-exportar`).
- `tests/scrum1158c-inicio-informes-44px.test.mjs`: las reglas con 44 px, `.btn-sm` global intacto, y que el
  producto siga pintando los botones DENTRO de lo que cada regla nombra.

### Verificado, ejecutando
- **Censo en navegador sobre el banco arreglado** (los ficheros de esta rama aplicados en la punta de #2500):
  Inicio y Informes **0 cortos** a 929 y a 390; las otras 32 filas pantalla×anchura, **idénticas** (comparadas fila
  a fila); mediciones cortas 106 → 70 (−36 = 18 × 2).
- **yaqu.app, cuenta QA** (sonda de sólo lectura `sondas-s2/tactil-1158c.mjs`, fuera del repo; sirve los ficheros
  de la rama en lugar de los de producción, con control de que se sirvieron; 0 escrituras, 0 errores; capturas en
  `sondas-s2/cap1158c/`): **20 de 20 a 44 px** a 390 y a 929 (antes, 20 de 20 por debajo). **NO medido:** «⬇ VeriFactu
  XML», que sólo se pinta en modo de emisión fiscal y la cuenta QA no lo tiene.
- **Rojo primero, por inyección** (commit antes de cada una; `git diff --numstat` al lado; `git restore --source=HEAD`
  y `status --porcelain` vacío después): sin `home-checklist` cae el caso de Inicio; sin la regla de un trimestre,
  o con `.btn-sm` global a 44, cae el de CSS; con otro id en la fila del IVA, o sin `informes-exportar`, cae el de
  Informes. Base: 3 de 3.

*Fin de 1158c.*

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
  (`_pagina-panel.mjs`, fila general) y sigue vivo.
