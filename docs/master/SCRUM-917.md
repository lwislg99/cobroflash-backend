# SCRUM-917 · la lista de Trabajos

> Las primeras entregas de SCRUM-917 (prototipo y botones, #1475 y #1477) no dejaron expediente
> aquí. Este fichero empieza con la parte de servidor que pidió la lista nueva (917c, Sesión 2b).

## SCRUM-917d · GET /admin/jobs trae el nombre PROPIO del Trabajo, a secas

**Fecha:** 18-sep-2026 · **Carril:** S1 (servidor) · **Pedido por:** el orquestador, para la S2b (917c)
**Medido contra:** `origin/main` = `27a7fb8b3755b9f00f5bcc74bc48b42ff0ed2037` · 2026-09-18T07:36:42Z
**Tanda:** 7540 tests, 7429 pass, 0 fail, 111 skipped (turno exclusivo de la Sesión 1, 18-sep-2026)

### El defecto, medido antes de escribir (PASO 0, staging, solo lectura)

La lista pinta el cliente en su propia columna. La fila de `GET /admin/jobs` sólo traía `titulo`, que
ya llega DERIVADO por `tituloDeTrabajo`: sin nombre puesto, «Presupuesto #N · cliente». La pantalla
no podía distinguir un nombre escrito de uno fabricado, y repetía el cliente.

```
población: trabajos devueltos = 15   (merchant QA de staging, servido por 27a7fb8b)
claves de la fila: albaranes, asignados, assignedUserId, createdAt, customer, direccion, …, titulo, …
con Job.titulo = 3 · sin Job.titulo = 12
  SIN titulo crudo → la API dice titulo = "Presupuesto #5 · María López" (job 3099)
```

Ninguna clave de la fila llevaba el crudo.

### Lo que se hace

- `tituloPropioDeTrabajo(job)` en `src/modules/jobs/domain/trabajoDirecto.ts`, al lado de
  `tituloDeTrabajo`: `Job.titulo` tal cual, o `null`. **El criterio de «tiene nombre» es el mismo**
  que la primera línea de `tituloDeTrabajo` (`if (entrada.titulo)`): si hay nombre propio, es el título.
- `serializeJob` añade `tituloPropio: tituloPropioDeTrabajo(job)`. **Aditivo**: `titulo` no cambia. Lo
  sirve la lista y también el detalle (`serializeJobDetail` delega en `serializeJob`).
- Sin schema, sin textos nuevos (es un campo de la API, no copy).

### Verificado en rojo

`tests/scrum917d-titulo-propio-en-la-lista.test.mjs`, 3 tests. Cuatro mutaciones sobre el código
arreglado, compilando cada vez:

| mutación | cae |
|---|---|
| `return job.titulo ?? null` (la cadena vacía viajaría como nombre) | 1 (qué devuelve) y 2 (mismo criterio) |
| quitar `tituloPropio` de `serializeJob` | solo 3 |
| `tituloPropio` con el título DERIVADO | solo 3 |
| control: `titulo` deja de salir de `tituloDeTrabajo` | solo 3, **por su control positivo** («el AST no ve…») |

El test 3 lee `serializeJob` por AST (no por texto): la función no se exporta y lee la base, y
exportarla solo para mirarla sería cambiar el código para poder medirlo.

### Lo que NO cubre

- 🔴 **El crudo no siempre lo escribió alguien.** En staging, 3 de los 15 trabajos llevan en
  `Job.titulo` el texto que se autogeneraba antes de SCRUM-317 («Presupuesto #3 · Cliente QA»). Para
  esos, `tituloPropio` devuelve ese texto y la lista repetiría el cliente igual que antes. No se
  limpia aquí: cambiar un dato guardado es otra decisión (y el título entra en el albarán como
  `referenciaTrabajo`, SCRUM-431). Queda dicho para la S2b y el orquestador.
- La pantalla es de la S2b (917c).

### Ficheros

- `src/modules/jobs/domain/trabajoDirecto.ts` — `tituloPropioDeTrabajo`.
- `src/modules/jobs/app/routes/jobs.routes.ts` — el campo en `serializeJob`.
- `tests/scrum917d-titulo-propio-en-la-lista.test.mjs` — los tres, sin base y sin gate.

## SCRUM-917c · la LISTA de Trabajos, construida (primer corte del rediseño aprobado)

**Fecha:** 18-sep-2026 · **Carril:** S2b (front) · **Pedido por:** el orquestador (prototipo aprobado entero por el fundador, comentario 15876)
**Medido contra:** `origin/main` = `e76580b1a4067b95e6b47f93dc43d12cdfa4618b` · 2026-09-18T11:55:05Z
**Rama:** `scrum-917c-lista-trabajos` · sólo `jobsView.js` + su bloque de `styles.css` (el detalle es 917e)

### El compromiso: el inventario cuadra, fila a fila

La condición del fundador es que al final de cada corte el inventario «antes → después» del prototipo
(`docs/prototipos/SCRUM-917/trabajos.html`, grupos A, B, C y G, que son los de la LISTA) cuadre, sin
perder ni una función. No se afirma leyendo: lo mide **`npm run guard:lista-trabajos-917`**, que monta
la pantalla real en Edge con 12 Trabajos (los cinco estados y los cuatro casos de dinero), **pulsa**
cada acción con el ratón y juzga el ESTADO de después: qué petición salió, qué modal se abrió, si navegó.

| inventario (hoy) | después | comprobación del guard |
|---|---|---|
| A.1 «Trabajos» + «Nuevo trabajo» + «Partes por valorar» | igual; pulsados: abre el modal, navega a `partes-oficina` | A.1 |
| A.2 filtros por cobro en CUENTAS | igual, y pulsar «Pendiente» filtra | A.2 |
| A.2 🔴 la lista no dice en euros cuánto falta | «Para hoy · N trabajos» y «Por cobrar · importe» ANTES de la lista; «Por cobrar» no cambia con el filtro | A.2 |
| A.3 filtro por técnico | igual (con equipo) | A.3 |
| B.1 5 columnas (Cliente · Técnicos · Importe · Fecha · Acciones) | 4: Cliente · Importe · Fecha · Acciones | B.1 |
| B.2 «Sin asignar» en 13 de 13 filas con el equipo vacío | el técnico baja a la línea del cliente con el desplegable de SCRUM-816 (candado y vuelta atrás intactos); sin equipo, 0 de 11 filas lo dicen, y los nombres que constan se siguen diciendo | B.2 + `guard:lista-trabajos` (816) en verde |
| B.3 píldora «SIN AGENDAR» repitiendo su cabecera | la fecha, o nada | B.3 |
| B.4 la cifra grande es el total, debajo «0,00 € de X» | la grande es lo que falta, debajo «de X»; «✓ Cobrado» | B.4 |
| B.5 sin presupuesto: «—» | «Sin importe» · «no hay presupuesto aceptado» | B.5 |
| B.6 🔴 cobrado de más, mudo | **como hoy**, sin tocar (espera a la S1; textos NO firmados) | B.6 |
| C.1 doce «Agendar» primarios | una sola primaria, «💰 Cobrar el resto (importe)»; Agendar/▶ Empezar/… en secundaria, y pulsados siguen haciendo lo mismo (modal, PATCH `en_curso`, POST `collect-rest`) | C.1 |
| C.2 «⋯» con sus seis entradas por estado | igual, entero; pulsadas «✅ Marcar terminado» (PATCH) y «Técnicos» (modal) | C.2 |
| C.3 la fila abre el Trabajo, los controles no navegan | igual: abre el Trabajo 4 y no escribe | C.3 |
| C.4 grupos | los mismos + «📅 Hoy» separado de «Esta semana» | C.4 |
| C.5 cabecera de Terminados y su salvedad (SCRUM-428) | igual, + «por cobrar» junto a la suma | C.5 |
| G.2 32 controles por debajo de 44 px | 0 de 86, a 1280 y a 390 | G.2 |
| G (sin scroll horizontal) | ni a 1280 ni a 390 | G |
| — | ningún texto se sale de su caja | G.3 (nuevo, ver errores) |

**Resultado:** 49 de 49 sobre la rama. **El rojo, contra `e76580b1`** (los dos ficheros de la vista de
`main` restaurados en el árbol y el guard final): 24 de 47 — lo que el corte venía a construir. Estable:
tres pasadas seguidas iguales.

**Una fila del inventario NO se construye, y se dice:** la barra fija de abajo en móvil con «Por
cobrar» (G, «la barra de abajo lleva Por cobrar»). Medido en Edge con el `cssText` real de
`tutorial.js`: el botón de ayuda `#tut-help-btn` (48×48, z-index 350) queda encima de la parte derecha
del botón de esa barra, **1.664 px² de solape a 390, 360 y 640 px**. El orquestador la dejó fuera de
917c (SCRUM-917 comentario 15938). «Por cobrar» se ve igualmente arriba, antes de la lista.

### Decisiones de construcción (y por qué)

- **«Por cobrar» = suma de `faltaPorCobrarDe`**, la MISMA función que ya suma la cabecera de Terminados
  (SCRUM-428), sobre los Trabajos sin cerrar. Una definición de «lo que falta», no dos. Sólo front
  (decisión del orquestador): **no se pinta** con 200 filas (el `take` de `GET /admin/jobs`: la suma sería
  de una parte) ni con más de una moneda.
- **«Para hoy» y el grupo «📅 Hoy» salen de la misma función** (`grupoDeTrabajo`): en curso + agendados
  con fecha de hoy, en la hora local de quien mira. Si fueran dos reglas, la cifra y el grupo podrían
  contradecirse.
- **El «de X» de la fila es `importeReferencia`**, el eje del chip de cobro (SCRUM-363), y no
  `quote.total` como antes. Cambia cuando el Trabajo tiene presupuestos adicionales: ahora la fila, la suma
  de arriba y la cabecera de Terminados cuentan contra el mismo número.
- **El nombre propio es `tituloPropio`** (SCRUM-917d), no `titulo`, que cae al cliente y lo repetiría.
- **Las filas de cobrado de más usan `importeComoHoy`**, el código de antes sin tocar.
- **Sin estilos en línea nuevos**; salen dos: el `style="text-align:right"` del `<th>` de Importe y el
  `style.marginLeft` de «Partes por valorar». El `colSpan` de las filas de grupo se CUENTA de la cabecera
  (5 → 4), sin número a mano.
- Se retiran por muertas: `JOB_STATE_META` (su único lector era la píldora) y en la hoja `.jobs-estado-*`
  y `.cell-tecnicos*`.

### Tests y censos cambiados, con su motivo

- `scrum412-primaria-nunca-es-sm`: sale `jobsView.js:bSiguiente` de las declaradas: **ya no es primaria**.
- `scrum522-guards-fuera-de-la-tanda`: por `guard:lista-trabajos-917`. El 18-sep se midió 26; el 20-sep,
  al mergear main (ver «El rescate del 20-sep» al final), el contador estaba ya en 28 y volvió a medirse:
  **29**. Las dos veces corriendo el test, nunca sumando.
- `scripts/guard-lista-trabajos.mjs` (816): su caso «sin equipo» leía `td.cell-tecnicos`, que ya no
  existe, y daba «» como si fuera una respuesta; ahora lee la línea del cliente. Todo lo demás, verde sin
  tocar (candado en las dos direcciones, vuelta atrás, hermanas idénticas por hash).
- Nuevos: `scripts/guard-lista-trabajos-917.mjs`, `scripts/_trabajos-917.mjs` (fixture compartido),
  `scripts/capturas-lista-trabajos-917.mjs` → `docs/capturas/scrum-917c/{antes,despues}/` a 1280 y 390, con
  y sin equipo.
- Microcopy: `docs/microcopy/2026-09-18-SCRUM-917-lista-de-trabajos.md` (comentario 15881) y
  `…-lista-singulares.md` (comentario 15938). Comprobado que el guard 514 las lee: con una cita inventada
  cae en rojo.

### Errores propios

1. **El guard no miraba si un texto se corta, y yo corté uno.** A 390 px, «✅ Terminados — cobra el resto ·
   4 · 740,00 € por cobrar» se salía 84 px de su caja: lo vi en la CAPTURA, no en el guard, que estaba en
   verde. Se añadió G.3 (`scrollWidth > clientWidth` en cada texto), rojo → verde. De paso destapó que la
   salvedad aprobada de SCRUM-428 **ya se cortaba antes de este ticket** a 390 px; mismo arreglo.
2. **Un rojo del instrumento que parecía de la pantalla.** En la segunda pasada, 1 y luego 3 de 4 menús «⋯»
   salían vacíos: el clic de puppeteer desplazaba la página (con `scroll-behavior: smooth`) y el menú se
   cierra con el scroll, a propósito. Arreglado en el guard (el control se lleva a la vista, instantáneo, y
   después se pulsa); la pantalla no se tocó. Tres pasadas seguidas iguales después.
3. **La primera versión del `<thead>` rompió `scrum816`**, que lee la cabecera como texto: la había
   construido nodo a nodo. Se volvió a la cabecera literal y el `colSpan` se cuenta de ella.

### Lo que NO cubre

- 🔴 **Cobrado de más** sigue mudo en la lista (como hoy) hasta que la S1 decida.
- **La barra fija de móvil** (arriba, medida).
- **Títulos heredados:** lo que dijo la S1 en 917d — 3 de 15 Trabajos de staging llevan en `Job.titulo` el
  texto autogenerado antiguo («Presupuesto #3 · Cliente QA»), y la línea del cliente lo enseñará.
- **Con 200 filas «Para hoy» sí se pinta**: la lista llega ordenada por fecha ascendente y lo de hoy entra
  salvo que haya más de 200 agendados antes; no se ha medido con datos reales.
- El técnico (rol) ve las cifras igual que ve hoy los importes de las filas; no se ha probado con su sesión.
- No verificado aún en staging (se hace tras el merge).

## 917c · El rescate del 20-sep-2026

*(Sesión 2b, relevo. La sesión que construyó 917c cerró por fin de uso el 18-sep con la rama
**commiteada en local y sin empujar**, y no hubo tanda el 19. Ocho commits vivieron dos días en un
solo disco. Esto es lo que costó sacarlos, y lo que enseñó.)*

**Punto de partida medido, no heredado** (20-sep-2026 13:05:23Z GitHub · `origin/main`
`f2fa091bfeb8c754ab0dcba5ddb95d0ed3d987d4`): `wt-917c` existía, árbol limpio, head
`bb5b9317850ff74bf2e1342cababadb8c3baa46e`, 8 commits por delante de `origin/main`. Lo primero de la
tanda fue comprobar las cuatro cosas, porque **un traspaso de dos días es una foto vieja**: podía no
estar el worktree, podía estar sucio, podía haberlo empujado alguien.

**El merge.** `git merge origin/main` (nunca rebase). Auto-mergearon `package.json` y
`public/dashboard/css/styles.css`; el único conflicto fue `tests/scrum522-guards-fuera-de-la-tanda.test.mjs`,
que era exactamente lo que el traspaso avisaba.

**La cifra derivada, otra vez.** Es la **séptima** colisión de ese contador y la **segunda** que se lleva
917c: el 18-sep chocó con 915d en el «26», y estos dos días 947 y 937b lo movieron a **28** mientras la
rama estaba parada en local. Resuelto como manda A4 y como ya decía el propio fichero: **los tres
comentarios se quedan —ninguno se tira— y el número NO se suma: se vuelve a MEDIR** corriendo el test
sobre el árbol fusionado. Salió **29**, con el test entero en 26/26 y con su control anti-constante («la
lista sale DERIVADA de `package.json`, no escrita aquí») en verde, que es lo que impide que el trinquete
esté midiendo una constante. La tentación era escribir 28 + 1; el valor de la regla es justo que 28 + 1
y la medición podrían no coincidir y nadie se enteraría.

**Que un merge sin conflictos no pierda trabajo en silencio** (A4): se comprobó a mano que los **tres**
guards conviven en `package.json` tras el auto-merge — `guard:foto-del-gasto` (947), `guard:nif-del-gasto`
(937b) y `guard:lista-trabajos-917` (917c) —, porque un auto-merge de un JSON con entradas nuevas por los
dos lados es donde se cae una.

**Verificación tras el merge.** `npm run build` primero y mirando su código de salida antes que ningún
test (A6: un build roto no es un rojo, es un verde que no vale) → EXIT=0. Después
`npm run guard:lista-trabajos-917`: **49 de 49**, con su población declarada (49 comprobaciones sobre 12
trabajos + 200 + 2 monedas + sin equipo, a 1280 y a 390). Es el mismo 49/49 del 18-sep, ahora contra un
árbol dos días más nuevo: **el rediseño no lo ha roto nada de lo que entró mientras tanto.**

## 917e · El DETALLE, corte D: el dinero se dice una vez

*(Sesión 2b, 20-sep-2026. Primero de los tres cortes del detalle. Partición aprobada por el orquestador por
el canal: **917e** = D, la franja del dinero · **917f** = E, la cabecera y «Lo que falta» · **917g** = F,
«El trabajo» plegable. Las letras continúan las del guard de la lista, donde A, B, C y G estaban usadas y
D/E/F se dejaron libres a propósito para el detalle.)*

### PASO 0 — ¿el defecto existe HOY? (A2)

El inventario del prototipo se midió el 17-sep contra staging. Antes de escribir una línea se comprobó
**corriendo** que sigue ocurriendo sobre este árbol:
`docs/master/evidencias/SCRUM-917/paso0-detalle.mjs` → `…/salida-paso0-detalle.txt`.
Población: 3 casos × 2 anchuras, SUELO 0.

- **«590,00 €» se lee SIETE veces** en el Trabajo pagado. Es el 7 del inventario, reproducido tres días
  después. Éste es el ticket entero.
- **«Qué falta para cobrar» se pinta en un Trabajo PAGADO**, con «Te falta por cobrar 0,00 €». El rótulo
  sigue mintiendo.
- El caso **sin presupuesto no pinta esa sección en absoluto**: hoy ese hueco no se nombra.
- 8 de 14 controles por debajo de 44 px (6 de 9 en el caso pobre).

Lo que **no** se reprodujo, dicho: «María López» sale 3 veces, no las 5 del inventario. La diferencia es de
datos, no de arreglo — aquel Trabajo de staging tenía albaranes y facturas que el fixture no tiene. Y
«Quién ejecuta este trabajo» no sale en el censo de secciones porque su título es un `div.job-asignados-titulo`
y no un `h3` (vive en `jobAsignados.js`): ceguera del selector, declarada.

### Qué entra

La franja `.detail-dinero`: la cifra grande es **lo que falta** —la pregunta del jefe—, con «Te falta por
cobrar» o **«Cobrado del todo»** según el caso; al lado, «Aceptado» y «Cobrado» una vez cada uno; debajo, la
barra **muda**. Y se retira todo lo que repetía esas cifras:

| qué se retira | dónde estaba | por qué |
|---|---|---|
| titular «Total aceptado» a 2,2 rem | `jobDetailView.js`, bloque `sumSec` | la franja ya da el aceptado |
| «Cobrado X de Y» dentro de la barra | `progressBar()` | dos cifras que la franja acaba de dar |
| filas Aceptado / Entregado y firmado / Facturado / Cobrado / Te falta | `pintarQueFaltaParaCobrar` | son la franja |
| bloque DINERO del rail (Cobrado, Pendiente, aviso) | `jobRailBlocks.js` | la misma verdad dicha dos veces |

**No se pierde información, que es la pregunta al borrar filas.** «Facturado» y «Entregado y firmado» no eran
cifras de contexto sino síntomas, y ya se dicen —mejor, porque dicen qué hacer— en los huecos: «X entregados
sin facturar», «X facturados sin cobrar». La salvedad de SCRUM-423 (los albaranes SIN_VALORAR no llevan
importe, así que un 0,00 € ahí sería una afirmación falsa) sigue viva en `huecosDeCobro`, que distingue
ausencia de cero.

**`progressBar()` no se ha tocado**, a propósito: la comparten otras cuatro pantallas y aquí hacía falta la
barra sin su texto. Se pinta la barra, no se cambia la función. El texto que la vista deja de repetir sigue
existiendo para quien no ve la pantalla, en el `aria-label` de la barra.

### Medido

| instrumento | población | antes | después |
|---|---|---|---|
| `guard:detalle-trabajo-917` | 92 comprobaciones · 4 casos × 2 anchuras | **32 de 92** (árbol sin tocar) | **92 de 92** |
| «590,00 €» en el Trabajo pagado | DOM pintado | 7 veces | **4 veces** |
| «417,45 €» en el Trabajo a medias | DOM pintado | 4 veces | **2 veces** |

**La cuarta aparición que queda es del HUECO**, y es del corte E, no un descuido: el prototipo lo dice con
todas las letras — «Lo que falta» no repite la cifra que la franja acaba de decir. El guard lo lleva escrito
en el propio verde (`E lo bajará a 3`) en vez de esconderlo: dejar sólo el objetivo final habría hecho un
guard que no puede estar verde nunca, y dejar sólo el número de hoy habría perdido la meta.

**El control que más importa es D.10**, el de NO PÉRDIDA: al retirar el bloque DINERO del rail se retira
también el aviso de cobro de más que allí se pintaba, y ese literal está FIRMADO desde SCRUM-887. El guard
exige que **siga en pantalla** en el caso «cobrado de más» — y sigue, en «Qué falta para cobrar», que es
donde se explica. `seccionCobroVisible` devuelve `true` cuando hay exceso justamente para eso.

### La firma, y una lectura que había que cerrar

El comentario **15881** firma literal todos los textos del prototipo «salvo dos», y los dos que excluye por su
nombre son los de la **lista**. Leído al pie de la letra, eso firmaría «Se ha cobrado de más» / «El cobro
supera el importe aceptado. Revísalo antes de facturar.» del **detalle** — que el propio documento marca como
«forma propuesta, decisión de la S1». Se aplicó la lectura restrictiva, se reportó, y el orquestador lo
confirmó y lo cerró el 20-sep. **Esos dos no se construyen**, y para ese caso se reutiliza el literal ya
firmado de SCRUM-887. Ficha: `docs/microcopy/2026-09-20-SCRUM-917-franja-del-dinero.md`.

### Deuda declarada, no verde

**G.2 · los 44 px.** El detalle YA incumplía AB6 antes de este ticket: el PASO 0, sobre el árbol sin tocar,
midió los mismos 8 de 14. Este corte no lo arregla. En vez de dejarlo en rojo mudo o taparlo, va en una
**allowlist visible** (`DEUDA_44PX`) con las **dos mitades** del trinquete: no puede subir, y si baja también
falla, porque una mejora que nadie ha hecho es un instrumento roto hasta que se demuestre lo contrario.
Reportado aparte al orquestador.

### Errores propios

Los tres son del instrumento, y los tres tenían forma de resultado bueno.

1. **El banco servía el mismo Trabajo a los tres casos.** Llamaba a `renderJobDetailView(c, {jobId: id})` y la
   firma es `(container, jobId)` con el id **a pelo**; dentro hace `Number(jobId)` → `NaN` → `/admin/jobs/NaN`
   → y mi comodín `/admin/*` lo contestaba con el Trabajo de siempre. **No dio ningún error.** Los tres casos
   salieron idénticos y los que no eran el primero dijeron «0 veces» de sus propios importes — que es
   exactamente lo que diría una pantalla ya arreglada. Lo cazó un **control de discriminación** que no existía
   al principio y que ahora corre ANTES de leer ningún resultado: *cuatro Trabajos distintos tienen que pintar
   cuatro pantallas distintas*. El comodín ya no puede devolver un Trabajo, y un id desconocido da 404.
2. **Al quitar el comodín rompí el arranque, y el síntoma señalaba al sitio equivocado.** El dashboard pide
   `/admin/me`, `/admin/precarga` y `/admin/entorno` al cargar; sin respuesta navega a la pantalla de entrada,
   y como el banco servía los `.html` como `application/javascript`, Chrome los pintaba como texto dentro de
   un `<pre>`. «No existe `#view`» parecía un fallo de la vista y era del banco.
3. **Dos verdes FALSOS en mi propio guard, en la primera pasada.** `Intl.NumberFormat` separa el número del €
   con un espacio fino inseparable (U+202F): normalicé el texto del DOM y no el patrón, y el censo dijo **0
   apariciones** de un importe que sale siete veces. Y `innerText` respeta `text-transform`, así que el rótulo
   «Total aceptado», pintado en versalitas, se leía «TOTAL ACEPTADO» y el guard lo daba por retirado. Los dos
   se cazaron porque **contradecían al PASO 0**: sin esa medición previa, los habría publicado.

### 🔴 917c dejó un guard CIEGO en main, y la lección es A12

El PR #1522 (917c) **entró en `main` con el check «guards de navegador» en FAILURE**, que no bloquea.
`guard:escalera-por-estado` salía **CIEGO (salida 2), no rojo**: «los cinco estados dan 1 rótulo distinto» y
«LISTA: no encuentro el primario que pulsar». No estaba diciendo que el producto fallara — estaba diciendo
que no había mirado nada. Sin su propio SUELO, esto habría pasado por un verde.

**La causa es mía y es exactamente A12: cambié una población y no censé quién medía sobre ella.** Ese guard
buscaba la acción de la fila con `.jobs-acciones > button.btn-primary`, y 917c cambió eso **a propósito**:
una sola primaria en la lista, la del dinero, y la acción repetida del grupo a secundaria, porque doce
«Agendar» verdes idénticos no jerarquizan. Revisé el guard 816, que también lee la lista, y no revisé éste.

**Arreglado aquí, con el criterio que decidió el orquestador:** lo que ese guard defiende es que las dos
pantallas propongan el **MISMO RÓTULO**, no el peso visual del botón — y el peso es justo lo que 917c decidió
cambiar, decisión que se queda. Se reancla a `button:not(.overflow-trigger)` en los **tres** sitios que
pulsaban la fila (no sólo en el que salía en el log; el primero arreglado dejaba el segundo ciego, y se vio
corriendo). Tras el arreglo **mide y está verde**: 5 estados, 4 rótulos distintos, lista y detalle de acuerdo
en los cinco, y «Agendar» y «▶ Empezar» ejecutables en las dos.

    🔒 Un guard anclado al peso visual de un botón se queda ciego el día que alguien reordene la jerarquía
       — y reordenar la jerarquía es cosa que pasa y debe poder pasar.

**Y el hallazgo del arreglo: había TRES anclajes a `.btn-primary`, y el log de CI sólo enseñaba el primero.**
Arreglar ése habría dejado el bloque ② igual de ciego **y el guard en verde**, que es peor que dejarlo roto.
Se vio corriendo el guard, no leyendo su log.

    🔒 Un arreglo guiado por el log arregla lo que el log enseña, no lo que está roto.

De paso, tres cosas medidas: **CIEGO no es ROJO** (distinguirlo es lo que evitó buscar un defecto de producto
que no existía); un comentario con acentos graves **dentro de un template literal** lo cierra — el guard no
compilaba y el `SyntaxError` señalaba a `overflowMenu`, que no tenía nada que ver, o sea que te manda a
investigar el sitio equivocado; y la clase del «⋯» no era la que yo suponía sino `overflow-trigger`, que se
comprobó **leyendo** `api.js:overflowMenu` (que devuelve el propio botón, no un envoltorio).

### La rama mergeada no se vuelve a empujar

Este corte sale en una rama NUEVA, `scrum-917e-franja-del-dinero`, y no en la de 917c. El motivo está
documentado en el equipo y aun así ha mordido varias veces: **el repo borra la rama al mergear**, así que
empujar `scrum-917c-lista-trabajos` otra vez la **recrea** y abre un PR residuo detrás de un PR ya cerrado.
La defensa es `git ls-remote --heads origin <rama>` **justo antes** del push, no al empezar la tarea.

### Hallazgo ajeno, arreglado aquí por orden del orquestador

`scripts/capturar-detalle-trabajo.mjs:69` pasaba `{ jobId: 7 }`, la misma forma equivocada. No se notaba
porque su servidor contesta el mismo Trabajo a todo, pero era **un aparato que fotografiaba una pantalla que
no es la del id que dice**. Arreglado en este corte (una línea) en vez de abrir ticket: dejarlo vivo mientras
se construye con él al lado era el riesgo mayor.

### Tests y censos cambiados, con su motivo

- `scrum522-guards-fuera-de-la-tanda`: **30** por `guard:detalle-trabajo-917`, medido corriendo el test.
  (Al mergear main el 20-sep pasa a **31**; ver «917e · segunda parte».)

### Lo que NO cubre este corte

- El hueco sigue repitiendo la cifra de la franja (−1 aparición pendiente) → **917f (E)**.
- El título sigue siendo el cliente y las migas lo repiten → **917f (E)**.
- Las cinco secciones sueltas y «Incluir precios en el parte» → **917g (F)**.
- Los 8 controles por debajo de 44 px: deuda heredada, declarada y con trinquete.
- El justificante de cobro sigue en el rail (el prototipo lo manda a Documentos); se retiró sólo lo que
  repetía cifras. Con estos cuatro casos el bloque DINERO desaparece entero porque no tienen justificantes,
  así que **D.8 no comprueba «el bloque ya no existe» sino «el rail no repite cifras»**, que es la afirmación
  que sí se sostiene con este fixture.
- Sin verificar en staging todavía (se hace tras el merge).

---

## 917e · segunda parte: los NUEVE contratos que la suite completa cazó

*20-sep-2026, 19:39 GMT (cabecera `Date:` de `gh api -i zen`). Sesión 2b, «s2e-20».*
Commits: `66085437` (817), `b2f92b68` (los cuatro re-anclajes), `74a38f73` (merge de `origin/main`
`8fcfd13fc7e14069bef9ce2b9c3f94fe969f2506`). Evidencias:
`docs/master/evidencias/SCRUM-917/salida-reanclajes-917e.txt`.

**El corte D se dio por bueno con `guard:detalle-trabajo-917` en 92/92 y la suite completa sacó
NUEVE regresiones suyas.** Ésa es la lección entera y va aquí arriba: *un guard nuevo en verde no
dice nada de los contratos viejos; mide lo que tú decidiste mirar*. Tres eran mecánicos y se
arreglaron el mismo día; los seis que quedaban son los de abajo.

### La regla con la que se resolvieron: RE-ANCLAR, no borrar

El rediseño se lleva la SUPERFICIE; el PRINCIPIO se queda y ahora lo tiene que cumplir la franja.
Un contrato que se borra porque su superficie desapareció es **una decisión perdida**; uno
re-anclado sigue vigilando. Cada uno lleva, en el mismo cambio, (a) qué superficie desapareció,
qué principio sobrevive y dónde vive ahora, y (b) **el rojo que demuestra que caza la pérdida**.

| contrato | superficie que desapareció | dónde vive ahora | su rojo |
|---|---|---|---|
| `SCRUM-651` · ausente ≠ cero | el titular «Total aceptado» (`detail-total-label`) | la franja, guardada por `totalAceptado != null`, **medida en el DOM montado** | quitar la guarda → «Aceptado 0,00 € · Cobrado 0,00 €» en un Trabajo sin presupuesto |
| `SCRUM-320` · un cero escrito parece un cero medido | la fila «Entregado y firmado» de «Qué falta para cobrar» | `huecosDeCobro`, que ya distingue ausencia de cero | `> 0` → `>= 0` → aparece «0,00 € entregados sin facturar» |
| `SCRUM-318` · sin eje no se afirma nada | el bloque DINERO del rail con «Cobrado» y «Pendiente» | la franja: el eje manda sobre el **foco** | quitar `if (hayEje)` → la franja afirma sin eje |
| `SCRUM-907` · el aviso **con su importe** | la línea `aviso` del bloque DINERO del rail | «Qué falta para cobrar», medido en el DOM montado | dos: el aviso que no se pinta, **y el aviso que se pinta SIN su importe** |

### 🔴 El re-anclaje de 318 cazó un defecto del corte D

No es teoría: al mudar el principio se midió la franja con `totalAceptado: 0` y 300 € cobrados, y
decía **«Cobrado del todo · 0,00 €» justo encima de «Cobrado 300,00 €»** — la pantalla
contradiciéndose en cuatro centímetros, y es exactamente el defecto que SCRUM-363 quitó del chip de
cobro. Arreglado en el mismo cambio, y el arreglo es el principio, no un parche: **el eje manda
sobre lo DERIVADO (el rótulo y la cifra grande), no sobre lo MEDIDO (los dos lados)**. Ni un rótulo
nuevo: se omite el que había.

### Los dos de SCRUM-817 no eran de orden: la vista NO MONTABA

Nadie los había diagnosticado. `l.append(e, ' ', v)` pasaba una **cadena suelta** al DOM. Es DOM
válido en el navegador —por eso el guard en Chrome salía 92/92— pero el banco de vistas no la
atiende, `renderJobDetailView` reventaba con `Cannot create property '_padre' on string ' '`, y los
dos contratos caían en su **SUELO sin llegar a mirar el orden que vigilan**. Un suelo que salta es
lo contrario de un contrato roto, y distinguirlo ahorró buscar un defecto de producto inexistente.
Arreglado con `document.createTextNode(' ')`, que es el idioma que el propio fichero ya usa en la
casilla de la factura: era la ÚNICA aparición de la forma con cadena en todo `public/`.

**Hallazgo del banco, que NO se arregla aquí** (`tests/_banco-vistas.mjs` es de la S3): su `append`
hace `x._padre = n` sobre cada argumento, así que muere con los strings que `ParentNode.append` sí
acepta. Le pasará a la siguiente vista que use la forma corta. Va al orquestador, no a un ticket
propio.

### Errores propios

1. **Mi primer arreglo del caso sin eje se pasó de largo, y lo tumbó otro contrato.** Condicioné la
   franja entera a `!= null && (hayEje || cobrado > 0)`, y el control positivo de SCRUM-651 saltó:
   *un presupuesto aceptado por 0 € es raro pero CONSTA, y eso lo escondía*. Los dos contratos caben
   a la vez porque hablan de cosas distintas — 651 de si el dato consta (la franja), 318/363 de si
   hay eje para derivar (el foco). **Es el argumento de esta sección entera sucediendo en vivo:** el
   contrato que no borré me corrigió a mí.
2. **La primera pasada de los cinco rojos no midió nada.** Escribí el `.ps1` con caracteres
   no-ASCII; PowerShell 5.1 lee un `.ps1` sin BOM como ANSI, el patrón `^ℹ (tests|pass|fail)` no casó
   NUNCA y la salida vino mojibake. Las cinco inyecciones se aplicaron y se revirtieron bien, pero de
   su resultado no se supo nada. **Un rojo sin población no es un hallazgo: es un instrumento que no
   llegó a arrancar.** Rehecho en ASCII.
3. Un `git commit -m` con un here-string lo bloqueó el hook (`Remove-Item on system path '/'`) por lo
   que llevaba escrito dentro. Se pasó a `-F <fichero>`. Anotado por si le pasa a otra sesión.

### El contador de `scrum522`: la OCTAVA colisión, y la que más engaña

`917e` y `926` escribieron los dos su comentario sobre el mismo «29 → 30». El merge marcó conflicto
en los **comentarios**… y dejó pasar la **cifra** sin conflicto, diciendo 30 cuando ya había 31.
🔒 **El conflicto que sí ves te tapa el que no.** Resuelto como manda el fichero: los dos comentarios
se quedan, ninguno se tira, y el número **se vuelve a medir corriendo el test** sobre el árbol
fusionado — **31**, no «30 + 1».

### Medido, con su población

- Los cinco ficheros de contratos: **55 tests, 49 pass / 6 fail** antes → **55 pass / 0 fail** después.
- Cinco rojos, repetidos ENTEROS tras el merge con conflicto (A23 #11), cada uno con su
  `git diff --numstat` al lado y el árbol limpio después.
- Censos por su nombre: `scrum258` 10/10 · `scrum522` 26/26 (cifra medida: **31**) · `scrum548` 8/8.
- `npm run build` EXIT 0 · `guards:entrada` 4 guards / 26 tests EXIT 0.
- Guards de navegador: `detalle-trabajo-917` **92/92** · `lista-trabajos-917` **49/49** ·
  `escalera-por-estado` verde (el que estaba CIEGO en `main`; ésta es la entrega que lo cura).

### Lo que NO cubre

- **La suite completa no se ha corrido en local**: por la norma nueva del 20-sep, la corre el PR.
  La entrega anterior se cayó justo por ahí, así que el PR se mira antes de darla por buena.
- Sin verificar en staging todavía (se hace tras el merge).
- El hueco del banco de vistas con `append('texto')` sigue vivo: reportado, no arreglado (otro carril).


## 917f · la cabecera y «Lo que falta» (20-sep-2026)

Dos cortes, dos commits, el mismo PR (#1548, apilado sobre el #1541).

| corte | sha completo | hora (Europe/Madrid) |
|---|---|---|
| la cabecera | `7c79b796c1695e503fde7c62624d99a4ab50eb2a` | 2026-09-20 22:19:57 +02:00 |
| «Lo que falta» | `7a8e0c7fd7c9f21f2be1727a44e8cf34ad02ea45` | 2026-09-20 22:36:01 +02:00 |

Hora de GitHub al cerrar la tanda: **dom 20-sep-2026 20:30 GMT**. `origin/main`: `c5d642fe`.

### Corte 1 · el título del detalle es el TRABAJO, no el cliente

Medido en el PASO 0: con el Trabajo #3104 el nombre del cliente salía **CINCO veces** en la
pantalla, **TRES de ellas dentro de los 139 px de la cabecera** (miga, título y subtítulo). El
cliente ya vive entero en el rail, con su teléfono. De qué trabajo era esto no estaba destacado en
ningún sitio.

- Título = nombre del trabajo; si no tiene, el cliente; si tampoco, `Trabajo`.
- Subtítulo = cliente · fecha · `Presupuesto #N`, compuesto con `unirCon` (TRES partes).
- Migas = `Trabajos ›` y se acaban ahí: se retira el elemento `migaActual` entero.
- `headLeft` estrena `.detail-head-izq` con `min-width: 0`.

**CUATRO re-anclajes de `scrum317`**, cada uno con su motivo escrito en el test, más un contrato
nuevo (*el cliente no desaparece de la cabecera: baja al subtítulo*).

El más útil fue el de **NOMBRES LARGOS**: vigilaba `.detail-miga-actual`, y este corte retira esa
miga. Dejarlo habría sido **un verde permanente sobre una regla CSS que ya no pinta nada**. Al
mudar el truncado al `h2` apareció lo que nadie había escrito: **`.detail-head` es flex y un hijo
de flex no encoge por debajo de su contenido**, así que sin `min-width: 0` el `text-overflow:
ellipsis` no llega a actuar NUNCA. El contrato viejo llevaba esa propiedad y nadie sabía por qué;
al mudarlo se supo.

- ROJO: **12 tests, 8 pass, 4 fail** contra el árbol sin tocar. Los cuatro re-anclajes caen.
- VERDE: 12/12. Población: los **72 ficheros** que miden `jobDetailView`/`detail-head`,
  **653 tests, 652 pass, 0 fail**. `guard:detalle-trabajo-917` **92 de 92**.

### Corte 2 · «Lo que falta»

**Defecto 1: el rótulo afirmaba algo falso.** La tarjeta se pinta siempre que haya CUALQUIER hueco
(`seccionCobroVisible`) y de los seis que produce el motor sólo tres son dinero. Un Trabajo
**cobrado del todo** con un albarán sin firmar enseñaba «Qué falta para cobrar» encima de una línea
que no habla de cobrar nada. Pasa a «Lo que falta» (firmado, com. 15881). El id interno
`que-falta-para-cobrar` NO cambia: es clave de reparto, no texto.

**Defecto 2: el caso sin presupuesto era un silencio.** Con `totalAceptado` nulo no salía ningún
hueco, `seccionCobroVisible` daba falso y la tarjeta **no se pintaba en absoluto**.
🔒 **Un silencio se lee igual que «no falta nada», y aquí son cosas opuestas**: no es que no falte,
es que sin importe de referencia no se puede saber cuánto falta. Entra el hueco `sin-presupuesto`
con sus tres literales firmados y «Hacer presupuesto», que navega a `quotes-new` por el camino que
ya usan el detalle de cliente y la lista de facturas. Criterio `== null` — el MISMO que decide la
franja, porque un presupuesto aceptado por 0 € **consta**. Va el primero del orden canónico por la
regla que SCRUM-320 ya tenía escrita, y los cinco de antes **no se reordenan**.

- ROJO: **6 tests, 1 pass, 5 fail**. El único que pasaba es el trinquete *la tarjeta no repite la
  cifra de la franja*, que hoy ya era cierto: es un trinquete, no un arreglo.

### 🔴 CUATRO contratos me corrigieron a mí, y ninguno era cosmético

Es el argumento de «re-anclar, no borrar» ocurriendo cuatro veces seguidas en una tarde.

1. **SCRUM-320** — su censo de IGUALDAD se puso rojo porque el fixture no sabía producir el hueco
   nuevo. Su propio comentario decía que eso era justo para lo que servía. Se le **enseña** con un
   caso propio: `sin-presupuesto` y los otros cinco son **excluyentes por construcción**, así que
   no valía añadir un campo a `todos` — si pudieran salir a la vez, el Trabajo tendría franja Y
   «no tiene presupuesto aceptado», que es una contradicción.
2. **SCRUM-423** — su ancla exigía dos líneas de fuente SEGUIDAS, y este corte mete una rama.
   Re-anclado a la CAUSA en vez de a la forma: la única manera de partir un hueco en dos nodos es
   darle entrada en `SUBTEXTO_HUECO`, así que se prohíbe que `sin-entregar` la tenga. **El ancla
   nuevo defiende más que el viejo**, que se podía cumplir mientras alguien partía el hueco por
   otro camino.
3. **SCRUM-427** — *o se construye lo que falta, o se enmienda el diseño diciendo por qué ya no se
   quiere*. Enmendado `docs/diseno/bloque-g.md` §5 con el motivo entero. Su control positivo nombra
   las cuatro secciones **a mano a propósito**: derivarlas del diseño haría que un renombrado se
   propagara solo y el control dejaría de controlar nada.
4. **SCRUM-651** — el que más enseña. Su red cazaba **PALABRAS** (`aceptado`, `cobrad`) y el
   principio es de **CIFRAS**. Mis dos literales no violan 651: **SON 651 dicho en voz alta** — lo
   que 651 prohíbe es AFIRMAR un importe que no consta, y decir «no consta» es lo contrario.
   Re-anclado en dos mitades: (a) **ni una cifra de dinero**, sin excepciones y sin lista de
   permitidos, porque ésa es la forma pura del principio; (b) la red de palabras sigue cerrada con
   los dos literales firmados exceptuados **por texto exacto**, y con su control de que esas dos
   frases se pintan de verdad. 🔒 *Una red con un agujero con forma de frase concreta no es una red
   rota; una expresión regular más floja, sí.*

### Medido, con su población

- Población del corte 2: **74 ficheros** (`jobDetailView`, `jobCobroHuecos`, `cobro-hueco`,
  `bloque-g`), **668 tests, 667 pass, 0 fail**.
- `guard:detalle-trabajo-917`: **92 de 92**, con población declarada (4 casos × 2 anchuras, 0 no
  medidas), antes y después de los dos cortes.
- Censos por su nombre: `237` `267` `522` `548` `723` `666b` `709` `895b` — **90/90**.
- `npm run build` EXIT 0 · `guards:entrada` 4 guards / 26 tests EXIT 0.

### Y el rescate del #1541, que no era un rojo

El PR de 917e llevaba **una hora sin gate y parecía verde**. Estaba en CONFLICTO con `main`, y con
el PR en conflicto GitHub no fabrica el merge-ref: **el workflow de `pull_request` no arranca**. El
PR se quedó con UN solo check —el armador del automerge— en verde.
🔒 **Un PR conflictivo no es un PR rojo: es un PR SIN MEDIR, y en la lista de checks los dos se
parecen.** Es «una operación que no se ejecutó se lee igual que un éxito», una capa más arriba.

Los conflictos eran `scrum522` y `scrum548`, los dos del tipo *los dos AÑADEN*. Resueltos
conservando los dos comentarios y **re-midiendo** las dos cifras sobre el árbol fusionado: `522` de
31 a **32**, con control en rojo (se puso 33, cayó, y el mensaje enumeró las 32); `548` con los dos
guards nuevos y a **un elemento por línea**, que es lo que evita la siguiente. **Novena colisión
del contador de 522**, y otra vez el conflicto cayó en los comentarios y no en la cifra, que habría
bajado limpia.

Barrido de los 26 PR abiertos al hilo de eso: **cero PR de la tanda en conflicto** salvo el #1541,
y los siete gates rojos que abrí caían **todos por el mismo test** —`scrum804-la-rama-viva`, que no
sabe leer `scrum-915e1-…`—. *La tanda no estaba rota, estaba tapada por un censo.* Diagnóstico
entregado al orquestador; el arreglo lo lleva otro carril.

### Errores propios

1. **Medí con `node -e "…$…"` y PowerShell se comió el ancla de fin de la expresión regular.** El
   `$` dentro de comillas dobles no llega a node, así que `scrum-904` salió `null` y el fallo
   pareció más gordo de lo que era. Repetido desde fichero, quedaron dos nombres. **Un instrumento
   de una línea también miente.**
2. **Escribí un fichero de test con `Set-Content -Encoding utf8` y le metí un BOM** a
   `scrum522`. Lo cacé comparando los cuatro ficheros byte a byte antes de commitear, pero la
   lección es la de siempre: en PowerShell 5.1 `-Encoding utf8` **añade BOM**. Para tocar un fichero
   del árbol, las herramientas de edición; `Set-Content` sólo para ficheros desechables.
3. **Estrené una clase CSS sin regla** (`cobro-hueco__q`) y la habría cazado `scrum666b`. La quité
   antes de correr nada: el subtexto hereda del hueco, que es lo que tiene que hacer.

### Lo que NO cubre

- **La suite completa no se ha corrido en local** (norma del 20-sep: la corre el PR).
- **Sin verificar en staging**: turno pedido al orquestador, pendiente de que el #1541 entre.
- **`917g`** («El trabajo» plegable) no empieza en esta entrega.
- El subtítulo firmado de `sin-entregar` —«Salen en el presupuesto y todavía no están en ningún
  albarán.»— **no se construye**: SCRUM-423 dejó escrito que su número y su salvedad van en UNA
  sola cadena, y partirla en dos nodos lo desharía de rebote. Declarado, no olvidado.
