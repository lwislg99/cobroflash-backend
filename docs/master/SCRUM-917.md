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
