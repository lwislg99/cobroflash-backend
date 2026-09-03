# SCRUM-703 · Tecnosel: el tipo de intervención se guarda, y un parte firmado ya se puede valorar

**Medido contra:** `origin/main` = `a5aef1b9bbd2570eccbde82b407c9d3675192c2d` · 2026-09-03T17:40:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-tecnosel-tipo-y-precios`

> ⚠️ **Esta entrada se archivó primero en `docs/master/SCRUM-684.md`, y ese fichero es de OTRO ticket.**
> El trabajo se encargó sin número, así que fue a parar a un nombre ya ocupado y provocó
> conflictos que no eran de contenido: dos tickets peleándose por un nombre de fichero. Se muda
> aquí **entera y sin reescribir** —el ancla y la fecha son las del día en que se midió—; lo
> único que cambia es dónde está archivada.


## PARTE A · el tipo de intervención (la barata)

La columna llegó (`schema.prisma:911`) y **mi propia puerta seguía rechazándola**: la validación
devolvía `tipo_intervencion_sin_columna` incluso para un valor válido, y había un test mío que
EXIGÍA ese rechazo. Abierta: se acepta y **se persiste** (`trabajoDirecto.ts`).

### El guard no se borró: se reapuntó

> **El hecho que vigila ahora, en una frase:** que el tipo que elige el profesional **llegue a la
> fila que se escribe**, y que un valor de fuera del vocabulario cerrado siga sin entrar.

Antes protegía «no ofrezcas un campo que no se puede guardar»; el hecho cambió al llegar la
columna, así que el guard **se reapunta en vez de retirarse**. Las dos mitades importan: sin la
primera vuelve el fallo mudo que el test original evitaba; sin la segunda, el vocabulario deja de
ser cerrado (regla 27).

### El desplegable, y una cosa que destapó otro guard

Sin valor por defecto: la primera opción va vacía. **Elegir por el profesional qué clase de trabajo
hizo acaba impreso en un parte que firma el cliente.**

🔴 **Y lo escribí mal la primera vez.** Puse los tres valores dentro de `jobNuevoModal.js` y **cayó
el guard de fuente única** que yo mismo construí en SCRUM-651 — con razón: eso era una SEGUNDA lista
del vocabulario cerrado. Corregido siguiendo el precedente de la casa (`cobrosCubos`,
`albaranRotulos`): el servidor los deriva y los manda en `/admin/me`; **el navegador no decide qué
tipos existen, los recibe**.

**Y `''` no es un valor inválido: es AUSENTE.** Un `<select>` con la opción vacía manda exactamente
eso, y tratarlo como error bloquearía un envío legítimo. Tres formas de ausente —`undefined`,
`null`, `''`— y las tres dejan el tipo en `null`.

## PARTE B · precios después de firmar (el camino de escritura)

### El defecto, medido en la certificación y confirmado ejecutando

`puedeEditarPrecios` decía lo correcto —en `firmado` **deja**— y **no cerraba ninguna escritura**:
sólo se calculaba y se devolvía. El único `PATCH` se cerraba con `puedeEditarContenido` para la
**petición entera**, y en `firmado` eso es `false`:

    parte firmado + PATCH que sólo toca precios  →  409 `parte_locked`

El técnico firmaba sin importes —que es el diseño— y **el jefe no podía ponerlos nunca**. Sin
valorar no se cobra.

### Lo construido: el permiso se decide POR CAMPO

`permisoDeCampos(estado, campos)` en el dominio, con los dos grupos que fijó el fundador:

| grupo | campos | candado |
|---|---|---|
| contenido | `obra` `referencia` `entrada` `salida` `notas` `tipo` `desplazamientos` `kilometros` `tecnicos` `lineas` | `puedeEditarContenido` — cierra al FIRMAR |
| precios | `precios` | `puedeEditarPrecios` — cierra al FACTURAR (regla 29) |

**Los precios viajan en su PROPIA clave** (`precios: [{indice, precioUnitario, tipoIva}]`) y no
mezclados dentro de `lineas`: mezclarlos haría que «esta petición toca precios» dependiera de mirar
dentro de un array, y entonces **«mixta» sería opinable**.

**Una petición mixta se rechaza ENTERA**, y el permiso se comprueba **antes** de construir el
cambio — hay un test que mide ese orden, porque comprobarlo después dejaría escribir parte de lo
pedido antes de rechazar.

### El control que no puede caer

`serializeParteParaElTecnico` **no se ha tocado**. El `PATCH` sigue respondiendo con él, así que el
dinero no cruza el cable al móvil, y hay un test que lo fija.

## Lo que NO entra, y es deliberado

**La pantalla de oficina no está.** Como avisaste, prefiero la mitad medida: entra el camino de
escritura con sus cuatro controles, y la vista —con **su propio serializador**, nunca el del
técnico— va en la siguiente. Hoy la API responde al PATCH de precios con la serialización del
técnico: es seguro (no lleva dinero) pero **la oficina no ve lo que acaba de escribir**, y ése es
el primer trabajo de la vista.

**Tampoco:** facturar desde el parte (fila 10, decisión del fundador — regla 24), `schema.prisma`,
ni los ficheros del dictado y de las revisiones.

## Microcopy

Los rótulos de los tres tipos y el del desplegable salen con **marcador** (regla 30) y viven junto
al vocabulario, no en el navegador. Se proponen; no se aprueban aquí.


---

# SCRUM-703 · La vista de oficina: donde el jefe valora un parte firmado

**Medido contra:** `origin/main` = `e96ca273cabd4cbbea7f7151ca36d7afca16b4fb` · 2026-09-03T20:10:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-tecnosel-tipo-y-precios`

> ⚠️ **Esta entrada se archivó primero en `docs/master/SCRUM-685.md`, y ese fichero es de OTRO ticket.**
> El trabajo se encargó sin número, así que fue a parar a un nombre ya ocupado y provocó
> conflictos que no eran de contenido: dos tickets peleándose por un nombre de fichero. Se muda
> aquí **entera y sin reescribir** —el ancla y la fecha son las del día en que se midió—; lo
> único que cambia es dónde está archivada.


## 1 · Su PROPIO serializador, y la separación es de RUTA

`serializeParteParaLaOficina` se escribe **campo a campo**, igual que el del técnico y por el mismo
motivo: extendiendo la fila, la columna de dinero que se añada mañana saldría sin que nadie lo
decidiera. `serializeParteParaElTecnico` **no se ha tocado**.

Y la separación no es un `if` dentro de un serializador: son **rutas distintas**.

| puerta | quién | qué devuelve |
|---|---|---|
| `GET /admin/partes/:id` | cualquiera | vista del técnico (sin un solo importe) |
| `GET /admin/partes/:id/oficina` | **`requireRole('admin')`** | vista de oficina (con importes) |
| `GET /admin/partes/oficina/pendientes` | **`requireRole('admin')`** | lo que falta por valorar |
| `PATCH /admin/partes/:id` | según **rol** | oficina si ve todo; si no, técnico |

⚠️ **La condición del PATCH es el ROL y no «si la petición traía precios»**, y la diferencia
importa: lo segundo lo decide quien llama, así que un técnico que mandara `precios` en un borrador
recibiría importes en el móvil. El rol no lo elige él.

⚠️ Y `/oficina/pendientes` va declarada **antes** de `/:id`: Express casa por orden, y declarada
después, «oficina» entraría como `:id` y esa ruta no existiría nunca.

## 2 · 🔴 CÓMO SE ENCUENTRA EL TRABAJO — tu punto 4

**La pantalla abre por la lista de pendientes, no por un buscador.** Si el jefe no puede saber
cuáles le faltan, la pantalla no sirve.

`GET /oficina/pendientes` devuelve los partes **firmados** con alguna línea **sin precio**. Dos
decisiones que merecen leerse:

* **«Sin valorar» es POR LÍNEA, no por parte.** Un parte de tres líneas con dos precios está sin
  valorar; contando «tiene algún precio» desaparecería de la lista a medias.
* **El suelo viaja con el dato:** la respuesta lleva `firmadosLeidos`. Así **«0 de 12» y «0 de 0»
  dejan de ser el mismo número**, y la pantalla distingue *no te queda ninguno* (✅) de *no he
  podido leerlos* (⚠️). Un cero de un lector roto no se pinta como una buena noticia.

## 3 · La pantalla

Dos bloques —**mano de obra ‖ materiales**—, una casilla de precio por línea, el importe de cada
una y el **total**, que se repinta al teclear. Al guardar, **se repinta con lo que devuelve el
servidor**, no con lo que había en pantalla: es la única forma de que el jefe vea *lo que se
guardó*. Si el parte está facturado, no se ofrece tocar nada: el candado viaja resuelto desde el
servidor y la pantalla **no vuelve a decidir la regla**.

## 4 · ⛔ MICROCOPY — los rótulos exactos, para que los apruebes

Todos salen de **una sola constante** (`MARCA_OFICINA`), así que aprobarlos es tocar un sitio.
Esta pantalla la usa tu padre todos los días:

| dónde | texto propuesto |
|---|---|
| título de la sección | **Partes por valorar** |
| subtítulo | **Los partes que tu equipo ya ha firmado y todavía no tienen precios.** |
| vacío · no queda ninguno | **No te queda ningún parte por valorar.** |
| vacío · no se pudieron leer | **No hemos podido leer tus partes firmados. Vuelve a intentarlo.** |
| bloque 1 | **Mano de obra** |
| bloque 2 | **Materiales** |
| casilla de precio (aria) | **Precio por unidad** |
| botón | **Guardar precios** |
| parte ya facturado | **Este parte ya está facturado: sus precios no se tocan.** |
| error al cargar | **No hemos podido cargar los partes.** |
| error al guardar | **No se han podido guardar los precios.** |
| botón en Trabajos | **Partes por valorar** |

## 5 · 🔴 LA BARRA LATERAL SE QUEDA LIMPIA, y lo decidió un guard

Puse la entrada en la barra y **cayó SCRUM-420 ④**: *«queda microcopy sin aprobar en la barra; es
lo primero que ve el profesional cada día»*. Tiene razón, así que **la entrada NO va a la barra
todavía**: se entra desde **Trabajos**, y la vista queda declarada en `VISTAS_SIN_ENTRADA` con su
motivo y con la instrucción de borrar esa línea el día que apruebes el rótulo.

**Y el guard me enseñó el tercer sitio:** una sección son TRES —el `case`, la entrada y
`HASH_VIEWS`— y el tercero es el que se olvida. Sin él, quien recargue estando ahí pierde la vista.
(Al añadirlo rompí `app.js` con una coma y **el banco que EJECUTA los scripts lo cazó**: un script
clásico que lanza se pierde entero, y con él todas las pantallas que publicaba.)

## 6 · El control que no puede caer, REAPUNTADO

Antes el PATCH contestaba siempre con la vista del técnico y bastaba con exigir eso. Ahora contesta
a cada público con la suya, así que ese aserto dejaría de describir el hecho.

> **El hecho que vigila ahora:** la vista de OFICINA sólo se alcanza detrás de un gate de rol —
> ninguna salida la devuelve sin comprobar antes que quien pregunta lo ve todo.

Se comprueba en dos mitades: dentro del bloque del PATCH, y **toda aparición** del serializador de
oficina en el fichero tiene `requireRole('admin')` o `seesAllJobs` en su contexto.

## Censos tocados, con su motivo

`scrum402` (marcadores pintables: `parteOficinaView.js` 1, `app.js` 1 por el título) ·
`_barra-lateral` (`VISTAS_SIN_ENTRADA`) · `_banco-vistas` (la lista de scripts) · `sw.js` (el
shell) · `scrum627`/`627b` (la aritmética: veredicto **DOCUMENTO** — da la BASE de una línea,
`precio × unds`, y **no deriva IVA**: `tipoIva` se copia sin entrar en ninguna multiplicación).
