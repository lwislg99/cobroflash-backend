# SCRUM-515 · El aviso de «te falta el móvil», visto funcionar por primera vez

**Fecha:** 19-ago-2026 · **Carril:** Bizum manual / configuración de cobro · **Gate:** el test corre en `npm test`; la medición en navegador va aparte (`npm run guard:aviso-bizum`)

**Medido contra:** `origin/main` = `a241b6e48c6553e453375bf705ca76ac3045ac0d` · 2026-08-19T08:32:40+01:00

**Paso 0 — buscado POR CONTENIDO, no por nombre de fichero.** Barrido de `bizumPhone` sobre todo
el árbol (sin `node_modules`). **SÍ existía** un test del aviso:
`tests/scrum328-aviso-bizum-sin-telefono.test.mjs`, 130 líneas, 7 casos. **No se duplica** — y no
se para, porque **no cumple lo que pedía este encargo**: sus comprobaciones de pantalla son
`assert.match` **sobre el texto del fichero** (`fs.readFileSync` + `soloEjecutable`), es decir,
exactamente el instrumento que dio verde el 13-ago-2026 con el aviso borrado.

> **Sobre `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` — corregido al cerrar, y la ficha tenía razón.**
> Al medir (ancla `a241b6e4`) ese fichero **no existía** en el árbol, ni con ese nombre ni con
> ninguna variante de «microcopy» en `docs/`; lo reporté como ficha equivocada. **No lo era: aún
> no había aterrizado.** Entró en `main` durante esta sesión con el **PR #796** (`65741dea`), y su
> contenido confirma la cita **hasta el número de línea**:
>
> | línea | texto aprobado |
> | --- | --- |
> | `settingsView.js:560` | `Sin este móvil, tu cliente no ve la opción de Bizum.` |
> | `settingsView.js:561` | `No hemos podido comprobar tu móvil de Bizum. Revísalo antes de cobrar por ahí.` |
>
> **Sigue SIN APLICAR y esta sesión no lo aplica** (regla 30): en esta rama el aviso pinta los dos
> marcadores `[PENDIENTE microcopy oficial · …]`. Para quien lo aplique: **los instrumentos de este
> ticket son agnósticos al texto** —ni el guard ni `scrum515` asertan el literal, el guard solo lo
> imprime— así que aplicarlo no los rompe. El que sí caerá, **y a propósito**, es
> `scrum328:126`, que exige exactamente 2 marcadores; ése es su trinquete, y toca actualizarlo en
> el mismo commit que aplique la microcopy.

## 1 · La línea base de `npm test`, medida antes de tocar nada

| | tests | pass | fail | skip |
| --- | --- | --- | --- | --- |
| **Base** (worktree recién creado sobre el ancla) | 3674 | 3597 | **0** | 77 |
| **Al cerrar** | 3676 | 3599 | **0** | 77 |

**El encargo daba por hecho un rojo preexistente de fin de línea (scrum480) y aquí NO lo hay.**
`tests/scrum480-fin-de-linea.test.mjs` pasa sus 8 casos. La diferencia es el árbol, no el repo:
este worktree se creó con `git worktree add` desde el ancla y nunca lo ha tocado un editor, así
que no tiene CRLF que declarar. **No se ha arreglado ni tocado nada de scrum480.**

## 2 · Los cuatro casos, medidos en el DOM RENDERIZADO

Instrumento: `scripts/guard-aviso-bizum.mjs`. Sirve `public/` **desde el disco**, carga los tres
JS que carga `index.html` (`settingsSubmenus.js`, `puertaSerie.js`, `settingsView.js`), llama a
`renderSettingsView(container)` en Edge, y **mide el DOM vivo en dos instantes**: al volver del
render síncrono (T1) y **después de dejar correr todas las tarjetas asíncronas** (T2) —
`loadMerchant`, Connect, readiness, referidos y perfil público—, que es donde vivía el `innerHTML`
del precedente. El veredicto lo dicta `decidirAvisoBizum`, **la misma función que `/admin/me`**
(`app.ts:406`): el guard mide lo que contesta el código de hoy, no una expectativa escrita a mano.

| bizumPhone | whatsappPhone | veredicto del servidor | aviso en T1 | **aviso al FINAL (T2)** |
| --- | --- | --- | --- | --- |
| sin | sin | `falta_telefono` | SÍ | **SÍ** — 19 px, submenú «cobro», dentro del campo |
| sin | **con** | `no_aplica` | no | **no** |
| con | sin | `no_aplica` | no | **no** |
| con | con | `no_aplica` | no | **no** |

**El aviso funciona y sobrevive al render.** Es la primera vez que se ve: el control negativo se
había pedido cinco veces a mano y nunca se hizo. El texto pintado es
`[PENDIENTE microcopy oficial · sin este móvil tu cliente no ve la opción Bizum]`.

### La fila 2 — la respuesta de HOY, medida y NO cambiada

**`whatsappPhone` SÍ cuenta como móvil de Bizum: no se avisa.** Y es coherente con lo que ve el
cliente, que es lo que hace que la respuesta sea defendible y no un descuido:

- `payInvoice.routes.ts:69` — `const bizumPhone = m?.bizumPhone || m?.whatsappPhone || null;`
- `payBizum.routes.ts:145` — `const phone = m?.bizumPhone || m?.whatsappPhone;`

Con solo `whatsappPhone`, **el cliente sí ve y sí puede pagar por Bizum**. Avisar ahí sería avisar
a un merchant que está bien, y un aviso que sale cuando no toca se aprende a ignorar. **No se
toca** — si el fundador quiere otra cosa, es otro ticket.

### El `||` aguas arriba: buscado explícitamente, y la guarda está VIVA

`app.ts:410-411` pasa **los dos teléfonos crudos y por separado** (`merchantFull?.bizumPhone`,
`merchantFull?.whatsappPhone`). El fallback vive **dentro del dominio**, que es donde sabe
distinguir «ausente» de «ilegible». Los tres `||` del árbol están **aguas abajo** (las páginas de
pago del cliente), no delante de la guarda.

**Pero el riesgo es real y es invisible.** Medido:

| | fila 1 | fila 2 | fila 3 | fila 4 | `bizumPhone: 0` + wa válido |
| --- | --- | --- | --- | --- | --- |
| hoy | `falta_telefono` | `no_aplica` | `no_aplica` | `no_aplica` | `no_se_pudo_leer` → **avisa** |
| con `\|\|` | `falta_telefono` | `no_aplica` | `no_aplica` | `no_aplica` | `no_aplica` → **calla** |

Un colapso aguas arriba **da exactamente el mismo resultado en las cuatro filas**. Solo diverge en
el suelo, donde convierte `no_se_pudo_leer` en «tiene teléfono» y **apaga el aviso**.

**🔴 Y ésa es LA RAZÓN de que la comprobación tuviera que ser estructural, y no una manía de
estilo:** como las cuatro filas coinciden, **ningún test de comportamiento puede cazar el
colapso** — ni los cuatro casos del ticket, ni el guard del navegador que los mide sobre el DOM.
Está medido arriba y comprobado con la inyección 3: con el `||` puesto en `app.ts`, `scrum328` y el
guard de navegador siguen **los dos en verde**. Un fallo que ningún observador del comportamiento
puede ver **solo se puede vigilar por la forma de la llamada**. Por eso el test mira que los dos
teléfonos lleguen crudos, y **lo demuestra antes de exigirlo**: sin esa demostración, el assert
parecería una preferencia de estilo y la primera sesión que le estorbe lo relajará.

## 3 · El rojo, visto fallar por el mecanismo

**SHA del commit previo a la inyección: `8dd291340befcab01f67e39b1ffb876c74497f80`.**
Las tres inyecciones se revirtieron con `git stash` y el árbol volvió a ese commit.

| # | Inyección | `scrum328` (lee el fuente) | Guard de DOM | Test `scrum515` |
| --- | --- | --- | --- | --- |
| 1 | quitar el `appendChild` del aviso | 🔴 rojo | **🔴 rojo** | verde |
| 2a | **el precedente exacto**: dejar el `appendChild` y barrerlo con un `innerHTML` posterior | **✅ VERDE (7/7)** | **🔴 rojo** | verde |
| 2b | borrado tardío desde una tarjeta asíncrona | ✅ verde | **🔴 rojo** (`render=SÍ final=no`) | verde |
| 3 | colapsar los dos teléfonos con `\|\|` en `app.ts` | ✅ verde | ✅ verde | **🔴 rojo** |

**La fila 2a es el ticket entero.** El aviso desaparece de la pantalla, `scrum328` sigue dando
**7 pass / 0 fail**, y solo el guard que mide el DOM lo caza:

```
🔴 [sin bizumPhone · sin whatsappPhone] EL AVISO NO SE PINTA en «Configuración › Cobro»,
   campo «Móvil de Bizum». El servidor dictó «falta_telefono» y la pantalla no pintó nada.
   Con BIZUM_MANUAL_ENABLED encendido, SIETE de los 13 merchants reales están en este caso.
```

Y la 3 es su espejo: el único fallo que el navegador **no** puede ver, y que solo caza el test
estructural. Ninguno de los dos instrumentos sobra.

### 🔴 LO QUE HAY QUE LEER DE LA FILA 2a, Y ES EL HALLAZGO DE ESTE TICKET

`scrum328` no es un test flojo: son **7 casos, bien escritos, con sus rojos redactados**. Y ante el
fallo exacto del 13-ago-2026 —el aviso desaparecido de la pantalla— **los siete siguen en verde**.

**Siete verdes sobre el FUENTE no valen uno sobre el DOM.** No es una cuestión de grado ni de
cobertura: un test que lee el fichero contesta «¿está escrito?», y la pregunta que importa es
«¿está en la pantalla?». Son preguntas distintas, y la primera no aproxima a la segunda — puede dar
verde con el usuario mirando un campo vacío. Añadir un octavo caso a `scrum328` no habría cambiado
nada; **el instrumento estaba midiendo otra cosa**.

Por eso este ticket no añadió casos: añadió un **árbitro distinto**. Quien vaya a escribir el
próximo guard de una pantalla, que empiece por aquí: **si el test puede pasar leyendo el `.js`, no
está vigilando la pantalla.** Esta tabla existe para que eso no haya que volver a aprenderlo con un
aviso apagado en producción.

## 4 · El suelo

- **Si no encuentra la ranura** (`input[name="bizumPhone"]`), el guard **no da cero**: sale por
  «🔴 EL ESCÁNER NO SUPO MIRAR». Un cero aquí se leería como «ningún merchant desprotegido», y son
  siete.
- **Calibración en los cuatro casos, en las dos direcciones.** Donde hay aviso se le **quita del
  DOM vivo** y el detector tiene que pasar a «ausente»; donde no lo hay se **inyecta un señuelo** y
  tiene que verlo. Sin esto, los tres casos «sin aviso» pasarían gratis con un detector averiado
  que siempre contesta «ausente».
- Comprobado a mano: con el selector del aviso roto a propósito, el guard sale **exit 1**; sano,
  **exit 0**.
- Se verifica además que **se sirvió lo del árbol** (los tres JS y los dos CSS) y que el render no
  lanzó.

## 5 · Lo que entra

| Fichero | Qué hace |
| --- | --- |
| `scripts/guard-aviso-bizum.mjs` | El control negativo, en navegador, sobre el DOM vivo. Fuera de `npm test` (la suite no arranca navegador), como `guard:contraste` y `guard:caja-avisos`. |
| `tests/scrum515-aviso-bizum-render.test.mjs` | La red que sí corre siempre: el `||` aguas arriba y que la medición no desaparezca en silencio. |
| `package.json` | `npm run guard:aviso-bizum`, con su nota de por qué existe. |
| `tests/_huerfanos-declarados.mjs` | `hayQueAvisar` **sigue declarado**; se amplía el motivo (ver abajo). |

**Nada del producto se ha tocado.** Ni la bandera, ni el backend de `confirm-bizum`, ni el texto
del aviso, ni `prisma/schema.prisma`, ni el camino de emisión.

### La copia acotada del predicado, y por qué

El guard necesita `hayQueAvisar`, pero **importarlo desde `scripts/` lo rompía todo**: un
`scripts/*.mjs` declarado en `package.json` **es entrada viva** para los dos censos de alcance
(SCRUM-411/493), así que el import sacaba a `hayQueAvisar` de los huérfanos declarados y abría una
discrepancia entre los dos instrumentos (`①=SÍ ②=NO`) **que su comparador no sabe clasificar** —
3 tests en rojo, ninguno de este ticket. Arreglar ese comparador es **su** ticket (regla 9).

Solución: el guard lleva **su propia copia acotada** (`veredicto !== 'no_aplica'`) y
`tests/scrum515-aviso-bizum-render.test.mjs` **la pincha contra `hayQueAvisar`** para todos los
estados del dominio, más tres inventados. Si el dominio cambia la regla, ese test cae **nombrando
el fichero del guard**. Una copia sin vigilar es cómo dos reglas del mismo hecho acaban
discrepando; ésta no queda sin vigilar.

## 6 · Hallazgos fuera de carril (no arreglados, no abro ticket)

1. **`quienLoImporta` (`tests/_alcance-desde-entradas.mjs:222`) devuelve `[]` siempre en Windows**:
   compara `imp.modulo` (barras `/`, normalizado) con `path.join(raiz, moduloRel)` (barras `\`), y
   nunca casan. Lo encontré al diagnosticar la discrepancia de arriba.
2. **`renderReadinessCard` (`settingsView.js:990`) da el paso de cobro por hecho con
   `!!(m.iban || m.bizumPhone)`** — el mismo `iban || bizumPhone` que `homeView.js:309` y que
   `scrum328` ya señaló: **quien puso solo el IBAN ve un ✅** aunque no pueda cobrar por Bizum. No
   mira `whatsappPhone`, así que además discrepa del criterio del aviso.
3. **`npm test` está verde en un worktree limpio**, contra lo que da por hecho el encargo. Si la
   otra sesión está arreglando scrum480 guiándose por «no puede estar verde en local», conviene que
   sepa que el rojo depende del árbol (CRLF de editor), no del repo.
