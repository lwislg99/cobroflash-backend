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

---

# SCRUM-703 · el recorrido de Tecnosel, medido de punta a punta

**Medido contra:** `origin/main` = `948e63980491950d313356977e61493f14f9888e` · 2026-09-03T12:15:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-tecnosel-tipo-y-precios`

Se midió **el camino de una persona**, no las filas de un sprint: ocho saltos, y en cada uno las tres
preguntas —¿existe la puerta? ¿llega el dato? ¿responde?—. Entrega: `docs/RECORRIDO-TECNOSEL.md`.

**Cuatro saltos completos** (crear con tipo · el jefe lo encuentra · le pone precios · quedan
guardados y los ve). **Tres sin puerta** (asignar a varios · del trabajo al parte · dictar): el motor
de los tres está escrito, y en dos probado, pero **ninguna pantalla alcanzable llega hasta él**. **Uno
con el motor entero y la puerta ausente** (firmar sin cobertura): 12 controles verdes, y hoy nadie lo
recorre porque se entra por una vista sin llamador.

**Motor entero + pantalla ausente no es medio salto: es cero.** Se cuenta así a propósito, porque el
técnico no llega. Los tres se declaran **sin medir** en vez de suponerlos.

**🔴 El control del dinero no cae en ningún punto de la cadena: 24/24 verdes, ejecutados.** Lo que sale
hacia el técnico no tiene ni una clave de dinero, los precios no cruzan el cable aunque estén en la
fila, y el pad de firma tampoco los lleva. El corte entre técnico y oficina es **de ruta, no de un
`if`**.

**No se afirma el estado de ninguna base de datos: no se miró.** Se nombra de qué DDL depende cada
salto (`jobs.tipo_intervencion`, `JobAssignee`), ya presentes en el esquema de `main` —comprobado con
`git show origin/main:prisma/schema.prisma`—, para que un fallo por columna ausente se lea **«FALTA EL
ALTER»** y no «roto». Los precios **no** dependen de ningún ALTER: viajan dentro de la columna `Json`
`lineas`, que ya existe.

Medición, no arreglo: **no se tocó nada de lo encontrado**.

---

# SCRUM-703 · El tipo de intervención, firmado — y la mudanza, resuelta sumando

**Medido contra:** `origin/main` = `1f03815295aa3ba26920283f5daec16472d03854` · 2026-09-03T12:54:49+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-tecnosel-tipo-y-precios`

**EL CONFLICTO ERA LA MUDANZA.** Mis dos bloques salieron de `SCRUM-684.md` y `SCRUM-685.md` hacia
`SCRUM-703.md`, y `main` recibió esos mismos ficheros de otras sesiones **con mis bloques todavía
dentro**: las otras los conservaron para no tocar trabajo ajeno. Se resolvió **sumando, no
eligiendo**. Antes de borrar nada se verificó que mis dos bloques estaban **enteros** en el destino,
comparándolos línea a línea contra la copia que `main` conserva y con control positivo del
comparador: el segundo es idéntico, y las 10 líneas que `main` tiene de más en el primero son una
nota que escribió **la otra sesión después** de la mudanza —no estaba en mi rama antes—. Esa nota se
queda: es la dirección de reenvío y no es mía. Los 21 addenda de microcopy se conservan **todos**, de
todos, en orden de fecha; el resolutor **para** si un lado viniera sin addendum, para no tirar uno
sin verlo.

**MICROCOPY APROBADA Y APLICADA EN EL MISMO ACTO:** «Tipo de intervención» y los tres literales del
papel de Tecnosel. «Reparación / **Asistencia técnica**» **cambió** lo que había en el código, que
decía «Reparación / asistencia».

**🔴 `MARCA_651` NO se retiró, y es deliberado: sujeta 13 textos y sólo UNO está firmado.** Quitar la
variable habría dado por aprobados los otros doce sin que nadie los firmara. Quedan marcados diez en
el modal y uno en `jobsView.js`. **«Sin especificar» está en el mismo desplegable que se acaba de
firmar y no venía en la lista de cuatro: se queda a la espera.** El censo de `src/` sí baja: la
entrada de `tipoIntervencion.ts` **se BORRA** —no se pone a 0— tal como predijo el comentario que
vivía en ella, y el trinquete de SCRUM-667 aprieta.

**LA REPETICIÓN DEL RECORRIDO NO SE HIZO, y el motivo es medido, no supuesto.** La condición era que
`main` tuviera las dos puertas. **Tiene una.** `scrum-684-cablear-dictado` **ya está en `main`** —su
rama sobrevive sin podar, que es lo que la hace parecer viva—; `scrum-652-puerta-al-parte` **no lo
está**. Comprobado con `git merge-base --is-ancestor` contra las dos puntas, y con suelo: el
comparador responde «sí» cuando algo sí está. Falta la puerta del **salto 3**, del trabajo al parte.

---

# SCRUM-703 · Segunda medición del recorrido: siete de ocho, y un botón muerto

**Medido contra:** `origin/main` = `4e9e114d1620386c76982efbc4eeae1e9d55fc06` · 2026-09-03T13:39:45+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-tecnosel-tipo-y-precios`

Con las ocho puertas dentro por primera vez —y con los seis ALTER de SCRUM-674 aplicados por Javier
en dev, staging y producción, así que «falta el ALTER» ya no es una respuesta posible— se repitió el
recorrido entero. **Siete de ocho, recorridos.** La primera medición daba cuatro: la diferencia
entre las dos es lo que desbloqueó cada merge, y por eso la anterior no se reescribió.

**🔴 EL SALTO 4 ESTÁ PINTADO Y MUERTO.** El botón del dictado se pinta en `parteDetailView.js:240` y
**no aparece en ningún otro sitio del árbol**; no hay delegación en el fichero. La ruta existe, la
función que la llama existe y está entera, el botón existe: **lo único que falta es el cable entre
los dos**. `ordenarElDictado` sólo se cuelga de `window.parteOrdenarDictado` (`:469`), que es como
lo alcanzan los tests — **y por eso la suite está verde**. Medido con suelo: el mismo buscador sí
encuentra el cable de la firma, así que su silencio no es ceguera. No se arregló: era medición.

**MI PROPIO MEDIDOR MINTIÓ PRIMERO, y quedó escrito porque es la lección.** Dio por muertas tres
pantallas vivas: buscaba el listener en UNA sola forma (`addEventListener`) cuando el botón de
guardar precios usa `onclick`, y lo buscaba dentro de una **ventana fija** alrededor del ancla. Una
ventana fija es una tolerancia disfrazada. Se verificó cada veredicto a mano antes de creerlo.

**EL DINERO NO CAE EN NINGUNO DE LOS OCHO PUNTOS.** Y una corrección de la misma pasada: el único
«importe» de la pantalla del técnico está **en un comentario** que dice justamente que lo que ve el
firmante se arma sin importes. La primera lectura lo contó como código.

**LOS RÓTULOS FIRMADOS, YA SUJETOS.** Hasta hoy ningún test llamaba a `tiposIntervencionParaUI()`:
«cae con el mecanismo viejo» estaba garantizado porque **no caía nada**. Cinco controles nuevos, con
`===`. El rojo se probó cambiando **una letra** («técnica» → «Técnica») y cae nombrando el tipo, el
firmado y el de ahora. Commit en verde antes del rojo: `8ef07024df28b27d527f8bf57bf73f6408403635`.
Dos guards de la casa corrigieron el guard nuevo: SCRUM-651 porque la primera versión declaraba una
**segunda lista** del vocabulario cerrado, y SCRUM-553 porque pegaba un `>` a la etiqueta.

**LOS DIEZ TEXTOS QUE SIGUEN SIN FIRMAR**, literales y con su línea, para que se firmen leyendo el
árbol y no un resumen:

| # | Fichero:línea | Texto exacto |
|---|---|---|
| 1 | `public/dashboard/js/jobNuevoModal.js:39` | Cliente |
| 2 | `public/dashboard/js/jobNuevoModal.js:55` | Dirección de la obra |
| 3 | `public/dashboard/js/jobNuevoModal.js:59` | Qué hay que hacer |
| 4 | `public/dashboard/js/jobNuevoModal.js:62` | Abrir trabajo |
| 5 | `public/dashboard/js/jobNuevoModal.js:66` | Trabajo nuevo |
| 6 | `public/dashboard/js/jobNuevoModal.js:90` | Primero necesitas un cliente. |
| 7 | `public/dashboard/js/jobNuevoModal.js:98` | No hemos podido cargar tus clientes. |
| 8 | `public/dashboard/js/jobNuevoModal.js:103` | Elige un cliente. |
| 9 | `public/dashboard/js/jobNuevoModal.js:120` | No se ha podido abrir el trabajo. |
| 10 | `public/dashboard/js/jobsView.js:52` | Trabajo nuevo |

Los cuatro primeros y el quinto van pegados a su etiqueta de cierre en el código (`Cliente</label>`,
`Abrir trabajo</button>`): lo visible es lo de la tabla. El 7 dice «No hemos podido», que es la voz
que el fundador ya corrigió en otra pantalla.
