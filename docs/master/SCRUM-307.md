# SCRUM-307 · Censo del bloque H sin iPhone — **SUELO DISPARADO: no he podido leer los tres tickets**

**Fecha:** 10-ago-2026 · **Carril:** H (albarán sin red) · **Gate:** sin gate — esta tarea **solo lee**

**Medido contra:** `origin/main` = `8159ee4a200c1623493402ecca0bff57b0ca814c` · 2026-08-10T15:06:10+02:00

> **NO SE HA CONSTRUIDO NADA.** Ni cola, ni almacenamiento, ni hash de navegador. No se ha tocado el
> mecanismo de firma, ni `prisma/schema.prisma`, ni el camino de emisión. **No se ha consultado
> ninguna base de datos.**

---

# 🔴 EL SUELO, PRIMERO: EL ENCARGO NO SE PUEDE CONTESTAR COMO SE PIDIÓ

Se pidió leer **enteros** SCRUM-358 (H3), SCRUM-359 (H4) y SCRUM-361 (H6) y contestar cuatro
preguntas por cada uno **con la cita del ticket que lo sostiene**.

**Los tres tickets no están en este repositorio.** Buscados por **cuatro vías**, todas vacías:

| # | Búsqueda | Resultado |
| --- | --- | --- |
| 1 | `docs/master/SCRUM-{358,359,361}.md` | **no existen** (sí existen 355 y 356) |
| 2 | La cadena `SCRUM-358` / `SCRUM-359` / `SCRUM-361` en **todo el árbol**, sin filtro de extensión | **0 ficheros** |
| 3 | Commits que las citen en **cualquier ref** (`git log --all --grep`) | **0** |
| 4 | Ficheros con esos nombres **añadidos en cualquier commit de la historia** (`--diff-filter=A`) | **0 — nunca existieron** |

Viven **solo en Jira**, y esta sesión no tiene acceso. **Es exactamente el caso que el suelo del
encargo anticipaba:** *«no depende de nada» y «no pude leerlo» dan el mismo veredicto optimista*.

**Por tanto NO se emiten los tres veredictos como respuesta al ticket.** Lo que sigue es lo que sí
se ha podido medir —que no es poco— **etiquetado por su procedencia**, y al final unos veredictos
**PROVISIONALES** que dicen de qué cuelgan.

> **Los dos documentos de máster SÍ se leyeron enteros:** `docs/master/SCRUM-355.md` (H0, 221
> líneas) y `docs/master/SCRUM-356.md` (H2, 212 líneas). El suelo se dispara **solo** por los tres
> tickets.

---

# 1 · LOS DOS PRERREQUISITOS — **verificados contra el main de ahora, los dos SIGUEN VIVOS**

No se ha dado por bueno lo que dijo H0: se ha vuelto a medir sobre `8159ee4a`.

## ① No hay clave de idempotencia en el cliente — **SIGUE SIENDO CIERTO**

| Qué | Dónde, hoy |
| --- | --- |
| `crypto.randomUUID`, `uuid`, `idempotenc*` en **todo `public/`** | **cero**, salvo un comentario |
| La única mención de `uuid` | `public/dashboard/js/semaforoFiscal.js:21` — *«Un uuid aquí obligaría a una migración de datos el día del cableado; un nombre, no»*. **Explica por qué NO se usó uno** |
| El número lo reserva el servidor **dentro de la transacción** | `albaranes.routes.ts:627` y `jobs.routes.ts:733` — `allocateAlbaranNumber(tx, req.merchantId!)` |
| Clave de reconciliación en el **servidor** | **no existe** para el alta de albarán |

⚠️ **Deriva de anclaje que conviene anotar:** H0 citaba `jobs.routes.ts:681`; hoy es **`:733`**. El
fichero se movió (SCRUM-347 y SCRUM-372 lo tocaron). **El hecho aguanta; la línea no.**

⚠️ **Y un falso amigo que hay que descartar por su nombre:** existe
`src/modules/jobs/domain/albaranDuplicado.ts`, pero **no es idempotencia**: es la clasificación de
qué campos viajan al **duplicar** un albarán a mano (SCRUM-302). Su propio comentario `:82` lo
confirma — *«El `numero` NO sale de aquí: lo reserva `allocateAlbaranNumber` DENTRO de la
transacción»*. **Parecerse no es serlo.**

> **Consecuencia, en los términos de H0 (`SCRUM-355.md:88-90`):** *«el albarán **no existe hasta que
> el servidor le da número**, y no hay clave con la que reconciliar un envío repetido. **H3 no es
> ejecutable hasta que se decida de dónde sale esa clave**»*.
>
> **Esto es un PRERREQUISITO, no un detalle.** Y es el dato que más pesa de todo este censo, por el
> motivo del §4.

## ② `computeAlbaranContentHash` no es ejecutable en navegador — **SIGUE SIENDO CIERTO**

* Definición: `src/modules/jobs/domain/albaran.service.ts:459`.
* Implementación: `crypto.createHash('sha256').update(JSON.stringify(contenidoCanonico(…)), 'utf8').digest('hex')`.
* **Imports del fichero, `:6-11`:** `path`, `fs`, `crypto` (Node), `prisma`, `albaranesDir`,
  `generateAlbaranPdf`. Con **frontend vanilla sin bundler (regla 4)** no se importa en el navegador.
* El equivalente de navegador sería `crypto.subtle.digest`: **otra API y además asíncrona** — no es
  copiar y pegar.

> **Consecuencia, en los términos de H0 (`SCRUM-355.md:104-106`):** habría que **duplicar** la
> función, *«y dos implementaciones del mismo hash que deriven en silencio producen conflictos falsos
> o —peor— conflictos **no detectados**, en el mecanismo que existe precisamente para detectarlos»*.
>
> **PRERREQUISITO, y con nombre propio: es la familia de SCRUM-372 (un dato, un nombre) aplicada a
> un algoritmo.** Dos implementaciones del mismo sello divergen igual que dos nombres del mismo dato.

---

# 2 · 🔴 TRES MEDIDAS DE H0/H2 QUE **YA NO SON CIERTAS** — y las tres mueven el bloque H

Esto no se pidió, pero sale de comprobar lo que sí se pidió, y **cambia el mapa**: H0 se midió contra
`572c9414` (7-ago) y en tres días entraron cambios **sobre la zona exacta del bloque H**.

| | H0/H2 decía (7-ago) | Hoy, sobre `8159ee4a` | Quién lo movió |
| --- | --- | --- | --- |
| **A** | 🔴 *«El trazo se pierde»*: `signaturePad.js` hacía `close(); onConfirm(…)` — el modal se cerraba **antes** de enviar, y si fallaba había que pedirle la firma al cliente otra vez (`SCRUM-355.md:146-149`) | **ARREGLADO.** `signaturePad.js:317` **espera** al llamador (`await onConfirm(...)`) y `:327` hace `close(); // ← LO ÚLTIMO, y solo si el envío fue bien` | **SCRUM-404** (`fe05fb30`) |
| **B** | *«`api.js:17` hace `await fetch(...)` **sin try/catch** … el profesional lee "No se pudo firmar: Failed to fetch"»* (`SCRUM-355.md:142-145`) | **OBSOLETO.** `api.js:25-32` envuelve el `fetch` y marca **`e.sinRed = true`**, conservando el `message` para no romper llamadores | **SCRUM-404** |
| **C** | 🔴 H2 reportaba como defecto vivo las **tres descargas de `exportView.js`** que tratan un 200 por éxito sin mirar el cuerpo (portal cautivo) — `SCRUM-356.md:80-92` | **CERRADO.** `api.js:67-105` es ahora la única forma de descargar, con guard (`tests/scrum405-descarga-verificada.test.mjs`) | **SCRUM-405** (`7b322a9f`) |

**La B es la que más importa para este bloque, y conviene decir por qué:** una cola de
sincronización tiene que decidir **«reintentar» frente a «no reintentar»**, y esa decisión es
justamente *fallo de red* contra *rechazo del servidor*. El 7-ago esa distinción **no existía en
código**. Hoy existe, tiene nombre (`sinRed`) y está en el único sitio por el que pasan todas las
peticiones. **Es el primer ladrillo de H3, y se puso sin que H3 lo pidiera.**

Y su comentario (`api.js:89-91`) cierra por adelantado la tentación obvia: **`navigator.onLine` no
se usa a propósito** porque *«miente exactamente en este escenario —el móvil está conectadísimo… al
router del bar»*. Coincide con lo que H2 midió (cero usos en el árbol) y **sigue siendo cero**.

---

# 3 · EL ESTADO DE LOS PRIMITIVOS, hoy — [MEDIDO]

Todo re-derivado sobre `8159ee4a`, no heredado.

| Primitivo | Estado hoy | ¿Cambió desde H0? |
| --- | --- | --- |
| **IndexedDB** | **CERO** en `public/` y `src/` | no |
| **Background Sync / Periodic Sync** | **CERO** usos. Y H2 midió que Safari **no lo soporta en ninguna versión** (`SCRUM-356.md:101-106`) | no |
| **Service worker: precache** | **51 rutas** (48 `.js`, 2 `.css`, 1 sin extensión) · **0 rutas de datos** | **+1 `.js`** (H0 midió 50) |
| **SW y datos autenticados** | `sw.js:93-97`: `/admin/`, `/auth/`, `/quote`, `/webhooks/`, `/version`, `/health` van **a red directa, sin caché** | no |
| **Los dos relojes (H4)** | **Hoy solo hay UNO: el del servidor.** `firmadoAt = new Date()` en `albaranes.routes.ts:673` y `albaranPublic.routes.ts:340`. **Cero `new Date()`** para fechas de documento en `albaranDetailView.js` / `signaturePad.js` | no |

> **Nota de método, porque estuvo a punto de colarse un número falso.** La primera derivación del
> precache partía el array por comas y devolvió **41**. Se detectó porque **no cuadraba con el 50 de
> H0** habiendo un diff de `+1` línea en `sw.js`. Re-derivado extrayendo las cadenas entrecomilladas:
> **51**, que sí cuadra. El derivador lleva suelo (falla si no encuentra el array o si sale vacío);
> lo que no llevaba era **contraste con la medición anterior**, y es lo que lo cazó.

---

# 4 · VEREDICTOS **PROVISIONALES** — y de qué cuelga cada uno

**Ninguno de estos tres es la respuesta al ticket**, porque el ticket no se ha podido leer. Son lo
que se deduce de **H0, H2 y el código**, y cada uno dice de dónde sale.

**Sobre qué es cada bloque, y con qué apoyo:**

* **H3 = la cola de sincronización** — **corroborado en el repo**: H2 la nombra así cuatro veces
  (*«Necesita: la cola (H3) y el almacenamiento (H5)»*, `SCRUM-356.md:118` y `:139`).
* **H5 = el almacenamiento** — corroborado igual, mismas líneas.
* **H4 = «los dos relojes»** y **H6 = «conflictos»** — **solo por el título del encargo.** No hay ni
  una línea en el repo que describa su contenido. Los veredictos de abajo valen para *la capacidad
  que ese título nombra*, no para lo que el ticket pida.

| | Veredicto provisional | Por qué, y con qué cita |
| --- | --- | --- |
| **H3 · la cola** | 🔴 **BLOQUEADO POR OTRA COSA — la clave de idempotencia** | H0 lo dice literal: *«H3 no es ejecutable hasta que se decida de dónde sale esa clave»* (`SCRUM-355.md:90`). **No es iOS.** Además necesita almacén (IndexedDB = cero) |
| **H4 · los dos relojes** | 🔴 **BLOQUEADO POR OTRA COSA — por H3** | Hoy **no hay dos relojes**: `firmadoAt` lo pone el servidor en los dos caminos de firma. El segundo reloj **nace con la cola**; sin H3 no hay nada que reconciliar. **No es iOS** |
| **H6 · conflictos** | 🔴 **BLOQUEADO POR OTRA COSA — el hash de navegador, y H3** | Detectar un conflicto exige comparar contenido, y el hash **no corre en navegador** (§1②). Duplicarlo es el riesgo que H0 marcó como *«crítico»* (`SCRUM-355.md:104-106`). **No es iOS** |

## 🔴 LA RESPUESTA A LA PREGUNTA QUE DE VERDAD SE HACÍA

El encargo preguntaba: **¿qué parte del bloque H no depende de la respuesta de iOS?**

> **Ninguno de los tres está bloqueado por iOS — y eso no significa que sean construibles hoy.**
>
> **Lo que iOS bloquea es H5** (los 7 días de borrado del origen, imposible de probar sin conservar
> un aparato una semana) **y la opción B de H2** (push, que en iOS exige la PWA instalada,
> `SCRUM-356.md:126-128`).
>
> **Lo que bloquea a H3, H4 y H6 son cosas NUESTRAS**: una clave de idempotencia que nadie ha
> decidido, un hash que no corre en el navegador, y un almacén que no existe. **El iPhone que no
> tenemos no es lo que los tiene parados.**

**Y el orden importa: la clave de idempotencia está AGUAS ARRIBA de la pregunta de iOS.** Aunque
mañana apareciera un iPhone y contestara H5 entera, **H3 seguiría sin poder construirse**. Por eso
el prerrequisito se nombra como prerrequisito y no como detalle: **es lo único de esta lista que se
puede desbloquear hoy, sin aparato y sin usuarios.**

---

# 5 · RECOMENDACIÓN DE ORDEN

**Ninguno de los tres va primero. Primero va la decisión que los desbloquea a los tres.**

1. **La clave de idempotencia** — decisión de diseño, cero aparatos, cero usuarios, cero iOS. Es
   prerrequisito **declarado** de H3 (H0/P3) y, por la cadena del §4, de H4 y H6 detrás. **Sin
   ella, empezar por cualquiera de los tres es empezar por el tejado.**
2. **El hash ejecutable en navegador** — segundo, y **no como copia**. Es un problema de *un
   algoritmo, una implementación*, hermano de SCRUM-372. Decidir esto mal una vez es indetectable
   después: un conflicto no detectado no avisa.
3. **Y solo entonces H3**, que es el que H2 señala como el único camino barato: *«A · Solo al abrir
   la app … Cero dependencias nuevas … es el único que hoy es construible»* (`SCRUM-356.md:116-122`).

**Si hubiera que mover algo hoy y no fuera ninguno de los tres**, H2 ya dejó identificado lo que sí
es construible sin aparato ni permiso: **la salida C** (*decir en pantalla que hay algo sin enviar*),
que **no necesita iOS ni push** — solo cola, almacén y **microcopy del fundador** (regla 30). Pero
cuelga de H3 igual que los demás, así que no altera el orden.

---

# 6 · LO QUE HAY QUE HACER ANTES DE FIARSE DE ESTE DOCUMENTO

**Leer los tres tickets.** Este censo dice qué hay en el código y qué dicen H0 y H2; **no dice qué
piden SCRUM-358, SCRUM-359 y SCRUM-361**, y cualquiera de los tres puede exigir algo que cambie su
veredicto. La acción concreta: **pegar los tres enunciados en `docs/master/`** —como se hizo con H0 y
H2— o pasarlos en el encargo. Mientras no estén, los veredictos del §4 son **provisionales por
construcción**, no por prudencia.

# 7 · LO QUE NO SE HA TOCADO

`prisma/schema.prisma` · el mecanismo de firma · el camino de emisión (regla 38) · el service worker
· `public/**` · `src/**` · ninguna base de datos. **Cero construcción.** El único fichero de este
commit es este documento.

# 8 · EL GATE DE CIERRE DEL BLOQUE H — añadido el 12-ago-2026 por SCRUM-362 (residuales)

Este censo no decía **cómo se cierra** el bloque, y hasta hoy no lo decía nadie: `docs/master/SCRUM-362.md`
existía desde el 10-ago y este documento **no lo mencionaba ni a él ni a «H7»**.

**El gate de cierre de SCRUM-307 es la pasada humana en iPhone de H7 (SCRUM-362), no la tanda.**

La tanda cubre lo que se puede automatizar, y desde hoy son **los cinco escenarios** —el censo y qué
los cubre está en `docs/master/SCRUM-362.md`—. Lo que **no** puede cubrir, y por eso el gate es
humano:

* el **desalojo de WebKit a los 7 días** sin abrir la aplicación (H0 lo midió; no hay forma de
  simularlo en la tanda);
* **Background Sync al 0 %** en Safari: la cola sólo se mueve al abrir la app, y cuándo el sistema
  despierta la pestaña no lo decide el producto;
* que el **sistema operativo mate la app** a media escritura. La tanda prueba la mitad de al lado
  —que el almacén sobrevive a una carga nueva sin apagado limpio—, que no es lo mismo;
* **modo avión real**, instalación en pantalla de inicio, y el iPhone en general.

🔸 **El documento de esa pasada NO EXISTE todavía.** Se comprobó el 12-ago-2026: no hay
`docs/PRUEBA-IPHONE-BLOQUE-H.md` en `main` ni en ninguna rama remota, y **no se nombra aquí a
propósito** — el guard de SCRUM-242 rechaza una entrada que cite un documento inexistente, que es
justo la protección que impide convertir una promesa en una referencia. Cuando el fundador lo
commitee, el mapa bloque→escenario va en `docs/master/SCRUM-362.md`.
