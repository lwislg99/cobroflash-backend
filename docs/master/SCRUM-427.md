# SCRUM-427 · G4: la nota del Trabajo se ve donde se trabaja

**Medido contra:** `origin/main` = `74dbd20ab9308ff9cf980a1cdf29bf8d19e3adc6` · 2026-08-10T17:05:51+02:00
**Rama:** `scrum-427-notas-internas`

**10-ago-2026, 17:05 CEST (UTC+0200)** · commit `d3222b98ce10a9971be09da4a8ef9cfb148048a9`

## PASO 0 — y reencuadra el ticket

### (1) Entrada: qué ve hoy el profesional

Abre el detalle del Trabajo y encuentra seis secciones: **Qué falta para cobrar · Datos · Tipo de
trabajo · Albaranes · Gastos de este trabajo · Facturas**. Ninguna es notas. Lo que ve, sobre notas,
es **nada**.

### (2) Mecanismo: había DOS almacenamientos, y no hacía falta ninguno nuevo

| campo | estado medido |
|---|---|
| **`Job.notes`** | **vivo y enchufado de punta a punta MENOS la pantalla** |
| `Quote.internalNotes` | vivo, pero es **otra cosa**: las notas del PRESUPUESTO |

`Job.notes` se persiste, la API lo devuelve (`jobs.routes.ts:250`), se escribe por `PATCH` con tope
de 2.000 caracteres y **gate por CAMPO** (SCRUM-120, que se lo da al operario a propósito), y hasta
**viaja al calendario** dentro del `DESCRIPTION:` del `.ics`.

> **Y ya había un editor: en la LISTA de trabajos** (`jobsView.js`), que guarda al perder el foco.

**Así que el defecto no era «no existen las notas».** Era que **la nota que escribes desde la lista
es invisible desde la pantalla donde trabajas**, y quien abre el detalle no tiene forma de saber que
existe. Medirlo antes evitó construir un segundo sitio donde vivieran las notas del mismo trabajo —
que habría dejado dos verdades y la que vieras dependería de por dónde entraras.

**No se ha creado ningún almacenamiento, ningún campo ni ningún endpoint.**

## Lo que se entrega

Una sección en el detalle que **lee y escribe `Job.notes`** por el camino que ya existía. Guarda al
perder el foco —igual que la lista— y **solo si cambió**: sin esa comparación, abrir el detalle y
cerrarlo mandaría un `PATCH` por visita sobre un campo que otra pantalla también toca.

`SECCIONES_CUERPO` gana `notas` **la última**, y el cambio del contrato es deliberado: las cuatro
primeras son pasos del **ciclo del dinero** (qué falta → entregado → facturado) y ésta **no es un
paso, es contexto**. En medio rompería la lectura del ciclo; fuera de la lista quedaría escondida
del contrato, que es donde se mira qué secciones existen.

## Microcopy — reutilizada, no inventada

La sección de notas **ya existe en Presupuestos**, con su rótulo, su píldora **«Solo tú las ves»** y
su placeholder aprobados. Se reutilizan **literales**, y hay un test que compara las dos pantallas
carácter a carácter — y que también se pone rojo **si la premisa se rompe**, es decir si el texto
desaparece de Presupuestos y este guard pasara a comparar contra algo que se fue.

Si el fundador quiere otras palabras, es una línea; lo que no se ha hecho es inventarlas (regla 30).

## Verificado en rojo — cuatro, por `$?`

| # | inyectado | sale |
|---|---|---|
| 1 | la sección se declara pero **no se pinta** | 🔴 «declararla y no pintarla es peor que no tenerla» |
| 2 | se quita la comparación antes de guardar | 🔴 «cada visita al detalle escribiría en la base» |
| 3 | microcopy divergente del de Presupuestos | 🔴 nombra el texto que difiere |
| 4 | usar `internalNotes` **de verdad** | 🔴 — prueba que el guard caza el uso real, no solo el comentario |

## Dos guards de la casa me cazaron a mí, y los dos tenían razón

- **El mío se cazó a sí mismo.** La sección lleva escrito en su cabecera por qué NO toca
  `internalNotes`, y un guard de texto no distingue la prohibición de su explicación (SCRUM-203).
  **Quinta vez que muerde en este repo.** Arreglado leyendo el código sin comentarios
  (`soloEjecutable`), y el rojo nº 4 existe precisamente para probar que al taparlo no se quedó ciego.
- **SCRUM-237:** mi negación `!/internalNotes/` **no tenía respaldo**. Añadido el hermano positivo
  sobre Presupuestos, que sí lo usa: si el detector no lo encuentra donde está, su silencio sobre el
  detalle no significa nada.

## Lo que NO toca

La **lista** de trabajos (otro carril) · **Presupuestos** y `Quote.internalNotes` (otro carril) ·
`prisma/schema.prisma` · el gate de permisos, que ya daba `notes` al operario.

Ficheros: `public/dashboard/js/jobDetailView.js` · `public/dashboard/js/jobDocsReparto.js` ·
`tests/scrum319-documentos-por-tipo.test.mjs` · `tests/scrum427-notas-internas-detalle.test.mjs` (nuevo).

---

# TRAMO 2 — la enmienda al diseño y el ENUMERADOR

**Medido contra:** `origin/main` = `7f826e61f5ce1a82d5def188451ef16125f7e704` · 2026-08-10T17:31:04+01:00

**10-ago-2026** · sesión 1 · lo **ortogonal** al tramo 1, que ya está en `main` (PR #603). No se
toca su código: lo entregó otra sesión y lo medí verde antes de empezar —guards de entrada 17/17,
sus 6 tests, tanda 2463 pass / 0 fail—.

## PASO 0

* **ENTRADA:** el detalle del Trabajo, `public/dashboard/js/jobDetailView.js`.
* **MECANISMO:** ya existía todo. El contrato `SECCIONES_CUERPO` (`jobDocsReparto.js:111`) declara
  cinco secciones y `docs/diseno/bloque-g.md` §4 dibuja cuatro. **Nadie comparaba las dos listas.**
* **EL EMOJI:** medido — entró en `main` como **`📝 Notas internas`**. La microcopy aprobada es
  «Notas internas» a secas, y **ninguna de las otras seis secciones lleva emoji**, así que rompía el
  registro de la pantalla. Quitado aquí, con un test que lo fija para todas.

## ① La enmienda a §4

`FACTURAS` **se queda**: G4 la entregó a propósito (`docs/master/SCRUM-319.md`) y el §4 es anterior
a esa decisión. Medido antes de tocar nada: **no está vacía ni es inalcanzable** —se pinta, lleva
`data-seccion="facturas"`, es el destino del hueco «sin cobrar» de G5 y tiene tests propios—.

Y con ella va la distinción que salió del tramo 1, enunciada como regla y no como excepción suelta:

> Un bloque que **informa** se oculta sin dato. Un bloque donde se **escribe** se muestra siempre:
> su vacío no es ausencia de información, es el sitio donde se pone.

Sin eso, «Notas internas» tendría que ocultarse cuando no hay notas — y entonces **no habría forma
de escribir la primera**. La regla de G sigue intacta para lectura (G3/G4/G5); lo que se enmienda es
su alcance.

## ② El enumerador

`tests/scrum427-composicion-detalle.test.mjs` + `tests/_composicion-detalle.mjs` (8 tests).

**Enumera, no cuenta**, que es el ticket entero: G4 «cuadraba» porque 4 + 5 = 9. Compara conjuntos y
declara **qué FALTA** y **qué SOBRA**, con las dos listas en el mensaje. Los dos lados son
**derivados**: el diseño sale del recuadro ASCII del §4 y la pantalla de sus `detail-section-title`.
Lo único escrito a mano son las excepciones, porque una decisión no se deriva de ningún sitio.

### Verificado en rojo — las tres, con la inyección comprobada EN DISCO

| inyección | lo que dijo |
|---|---|
| **FALTA**: la sección de gastos deja de pintarse | *«EL DISEÑO PIDE SECCIONES QUE LA PANTALLA NO TIENE: gastos»* + las dos listas |
| **SOBRA**: aparece una sección «Publicidad» | *«LA PANTALLA PINTA SECCIONES QUE EL DISEÑO NO LISTA Y NADIE HA DECLARADO: publicidad»* |
| **SUELO**: el escáner deja de reconocer la pantalla | *«sólo se han encontrado 0 secciones pintadas… un escáner que no ve la pantalla no puede afirmar que la pantalla está bien»* |

🔴 **Y un agujero propio, encontrado por la prueba de rojo.** La primera dirección **no caía**: el
comparador usaba `includes`, así que renombrar «Gastos de este trabajo» a cualquier cosa que
contuviera «gastos» seguía contando como presente. Se endureció a coincidencia por palabra completa
(`esLaMisma`). **La prueba de rojo no confirmó el guard: lo corrigió** — que es para lo que está.

También mordió el escáner: el primer patrón casó con la ASIGNACIÓN `h.className =
'detail-section-title';` y se tragó 300 líneas de código como si fueran el nombre de una sección. De
ahí el cinturón `LARGO_MAX` y su test.

## Los dos sobrantes que encontró el enumerador — DECIDIDOS: los dos se enmiendan

El enumerador los encontró en su primera ejecución y **ninguno era un descuido**. El fundador
decidió el 10-ago-2026 que **los dos se incluyen en §4**, con el mismo tratamiento que `FACTURAS`.
Ninguna sección se retira de la pantalla.

| sección | por qué se enmienda | cita |
|---|---|---|
| **Datos** | G3 movió CLIENTE/TELÉFONO/DIRECCIÓN al rail y **dejó «Datos» a propósito** con lo que se EDITA. El §4 se dibujó ANTES de esa decisión: **quien está desactualizado es el documento, no la pantalla.** | `SCRUM-318` |
| **Tipo de trabajo** | Bandera **FISCAL** `Job.tipoOperacion`: gobierna cómo se factura. | `SCRUM-66` / `SCRUM-309` §5 |

### ⚠️ «Tipo de trabajo» no es como las otras dos, y el matiz cambia la lectura

Yo lo reporté como *«anterior al diseño de G, que no la lista ni para quitarla ni para
conservarla»*. **Medido con más cuidado: el diseño SÍ la conocía.** Sale en su §1 —*«TIPO DE
TRABAJO: Varios avisos o visitas sueltas [Cambiar]»*, en lo que hay hoy— y su §7 la pone entre lo
que hay que medir antes de partir el bloque:

> **§7 · 5.** *«**Qué es «Tipo de trabajo»** (`Varios avisos o visitas sueltas`) y qué gobierna.»*

Así que **no se omitió de §4 por quererla fuera: se omitió porque §7·5 no se ha contestado nunca.**
La enmienda la incluye **y deja la pregunta viva**, con un test que impide cerrarla de tapadillo —
una pregunta cerrada sin respuesta es peor que una abierta, porque nadie vuelve a mirarla.

Y el motivo de fondo para no plegarla mientras tanto: **quitar de la pantalla algo que gobierna un
campo fiscal porque un documento de diseño no lo listaba sería el error al revés** — el mismo que
esta enmienda corrige, pero recortando en vez de añadiendo.

`SOBRANTES_SIN_DECIDIR` queda **vacío**, y el mecanismo montado: la próxima sección que aparezca sin
decisión tiene dónde esperar sin que nadie afloje el guard para que pase.

### Los dos rojos de las enmiendas

| inyección | lo que dijo |
|---|---|
| una enmienda cita un ticket que el diseño no menciona | *«la enmienda de «datos» cita SCRUM-318 en el guard pero el diseño no lo menciona: quien lea el documento no sabrá por qué esa sección está ahí»* |
| la enmienda pierde la cita de §7·5 | *«la ENMIENDA ya no cita §7·5… si sólo vive en el §7 original, quien lea por qué se incluyó la sección no verá que sigue abierta»* |

🔴 **El segundo también me corrigió a mí.** En el primer intento el test seguía VERDE al quitar la
cita, porque buscaba «§7·5» **en todo el documento** y ese texto aparece también en el §7 original.
Se acotó la búsqueda al bloque de la enmienda. Es la segunda vez en este tramo que la prueba de rojo
no confirma el guard sino que lo arregla.

## Lo que NO toca

El código del tramo 1 · la tarjeta del listado · el rail · `prisma/schema.prisma` · el camino de
emisión. **No se reescribió historia:** `main` se mergeó DENTRO de la rama.

### El emoji arrastró un test del tramo 1, y por qué se ajustó así

Quitar el `📝` puso en rojo `«la microcopy es la MISMA que ya usa Presupuestos, literal»`, y el
motivo es que **el emoji viene de Presupuestos** (`quotesDetailView.js:851` rotula `📝 Notas
internas` desde antes). Ese guard exige que las dos pantallas digan lo mismo.

Se ajustó **la comparación del rótulo para que sea sin emoji**, no la microcopy aprobada ni
Presupuestos:

* **Presupuestos es otro carril** y su microcopy no entra en esta aprobación — cambiarla de paso
  sería decidir por otro ticket.
* Lo que ese guard protege sigue intacto: que las dos pantallas **llamen a la cosa por el mismo
  nombre**. El adorno es de cada pantalla, y aquí hay un motivo medido para no llevarlo: las otras
  seis secciones del detalle no tienen emoji.

⚠️ **Queda una divergencia declarada:** Presupuestos lleva `📝` y el detalle no. **Es decisión del
fundador** si el emoji se retira también allí o si se acepta que cada pantalla tenga el suyo; se
reporta y no se toca.

Ficheros de este tramo: `docs/diseno/bloque-g.md` (la enmienda) ·
`public/dashboard/js/jobDetailView.js` (sólo el emoji) · `tests/_composicion-detalle.mjs` (nuevo) ·
`tests/scrum427-composicion-detalle.test.mjs` (nuevo) ·
`tests/scrum427-notas-internas-detalle.test.mjs` (sólo la comparación del rótulo).

---

# TRAMO 3 — el emoji fuera de Presupuestos, y el guard APRETADO otra vez

**Medido contra:** `origin/main` = `b3a480d1102ff5b8ea23bbc9a7692a26e0034009` · 2026-08-10T17:38:58+01:00

⚠️ **Depende del tramo 2**: esta rama sale de `scrum-427-enmienda-y-enumerador`, porque el guard que
aquí se aprieta es el que allí se aflojó. Hay que mergear ese primero.

## El problema, que es de MECANISMO y no de emoji

El tramo 2 quitó el `📝` del detalle porque la microcopy aprobada es «Notas internas» a secas. Eso
puso en rojo el guard de coherencia con Presupuestos —que exigía el literal `'📝 Notas internas'` en
las dos pantallas— y **hubo que aflojarlo a `'Notas internas'` para que pasara**.

🔴 **Y ahí quedó el agujero, medido:**

```
'📝 Notas internas'.includes('Notas internas')  →  true
```

Con la comparación aflojada, **una pantalla con emoji y la otra sin él pasan las dos**. El guard se
relajó para dejar pasar un cambio legítimo y se quedó **más ciego de lo que estaba**. Un guard que
se afloja y no se vuelve a apretar es un guard perdido.

## ① El emoji, fuera de Presupuestos

`quotesDetailView.js:851` pasa a rotular `Notas internas`. Medido después: **ninguna de las dos
pantallas tiene ya emojis en sus rótulos de sección** (comprobado con un patrón Unicode sobre todos
los `detail-section-title` de ambos ficheros; el primer intento dio falsos positivos porque el rango
que usé se comía los acentos de «Decisión» y «Qué falta»).

## ② El guard, apretado — y más que antes

⚠️ **Restaurar la lista NO habría restaurado la propiedad**, y esto es lo que importa del tramo:
mientras se compare una SUBCADENA común escrita en el test, la divergencia del adorno es invisible
**por construcción**. Da igual qué literal se ponga.

Así que el rótulo ya no se compara contra un literal: **se EXTRAE de las dos pantallas y se exigen
iguales entre sí**. Es estrictamente más fuerte que el guard original —él comparaba cada pantalla
contra un texto escrito en el test; esto las compara una contra otra— y no deja literal que
mantener: el día que la copy cambie, cambia en los dos sitios o esto cae. Se conserva además un
assert contra el rótulo APROBADO, porque dos pantallas pueden estar de acuerdo en algo que nadie
aprobó.

## Verificado — las dos direcciones y el suelo

| caso | resultado |
|---|---|
| **control negativo**: los dos rótulos idénticos | ✅ verde |
| **dirección 1**: el emoji vuelve a **Presupuestos** | 🔴 *«LAS DOS PANTALLAS ROTULAN DISTINTO… detalle: «Notas internas» · Presupuestos: «📝 Notas internas»»* |
| **dirección 2**: aparece `🗒️` en **el detalle** | 🔴 mismo mensaje, con los dos textos invertidos |
| **SUELO**: el rótulo de una pantalla deja de encontrarse | 🔴 *«CIEGO: no se encuentra el rótulo… comparar dos cosas que no se han leído da igualdad trivial»* |

Las dos direcciones se ejercitaron **por separado y en el orden que rompe**, no con una matriz por
ejes: meter el emoji en una pantalla y luego en la otra son dos fallos distintos del mismo guard, y
sólo probando los dos se sabe que no está mirando en una sola dirección.

🔴 **El suelo no es teórico aquí**: si el extractor no encontrara ninguno de los dos rótulos,
`assert.equal(undefined, undefined)` pasaría y el guard diría «coinciden» sin haber leído nada. Por
eso lanza en vez de devolver vacío.

## Lo que NO toca

El resto de Presupuestos · el detalle del Trabajo (salvo lo ya hecho en el tramo 2) ·
`prisma/schema.prisma` · el camino de emisión. **No se reescribió historia:** `main` se mergeó
DENTRO de la rama.

Ficheros: `public/dashboard/js/quotesDetailView.js` (una línea, el rótulo) ·
`tests/scrum427-notas-internas-detalle.test.mjs` (el guard).
