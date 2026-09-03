# SCRUM-685 · La vista de oficina: donde el jefe valora un parte firmado

**Medido contra:** `origin/main` = `e96ca273cabd4cbbea7f7151ca36d7afca16b4fb` · 2026-09-03T20:10:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-tecnosel-tipo-y-precios`

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
