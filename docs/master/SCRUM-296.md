# SCRUM-296 (A6) · El Libro de Registro, con la trazabilidad completa del euro

**Fecha:** 6-ago-2026 · **Carril:** A (núcleo fiscal) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `4b4f30a6bcfb4ffd75694f781704865510336580` · 2026-08-06T13:09:12+02:00
**Tanda:** 1959 tests, 1892 pass, 0 fail, 67 skipped · `npm test` **`$? = 0`**

> El sha se ancló con `git ls-remote`, no con la ref local: con cuatro sesiones fetcheando a la vez
> la ref local miente. Main se movió **dos veces** durante esta tarea (`51221c0` → `e714d23` →
> `4b4f30a`), así que la medición se re-ancló antes de concluir.

## Qué es, y por qué no es una tabla más

El libro de facturas emitidas es **lo primero que pide un asesor**, y cualquier facturador lo
tiene. Lo que ninguno puede hacer es enlazar **cada asiento con su presupuesto, su albarán y su
cobro**, porque no tiene los tres objetos atados. Eso es la trazabilidad completa de un euro:
de dónde vino, qué se entregó a cambio y dónde acabó.

## Solo lectura, y comprobado

No compone números, no reserva nada, no escribe. Un guard lee el módulo y **prohíbe**
`allocateInvoiceNumber`, `formatInvoiceNumber`, `prisma.`, `.update(` y `.create(`: la regla 38
permite **leer** el camino de emisión, no modificarlo, y este módulo no tiene ningún motivo para
hacerlo.

Lo que sí hace es **reutilizar `calcVatBreakdown`**, el mismo cálculo que usa la emisión.
Recomputar la base con otra fórmula haría que el libro **cuadrase consigo mismo** en vez de con las
facturas — y ése es justo el error que nadie detecta, porque los dos números salen del mismo sitio
equivocado.

## El suelo, y aquí no es una formalidad

**Un libro vacío no se lee como «no encontré nada»: se lee como «no facturaste nada», y ante
Hacienda eso es una afirmación, no un hueco.**

Por eso el resultado lleva **siempre** `miradas`. Cero asientos con `miradas: 0` significa «no
había»; cero asientos con `miradas: 40` significa **que algo está roto** — y quien lo consuma puede
distinguirlo. Sin ese número las dos cosas se leen igual de tranquilizadoras.

## Control negativo: dos merchants, montado aquí

**No se apoya en el guard de tenencia de SCRUM-243**, que tiene un agujero conocido (SCRUM-348): el
aislamiento de un documento fiscal no puede colgar de algo que ya se sabe incompleto. El libro
filtra por merchant **también él**, y lo ajeno **se cuenta** (`ajenas`).

Un descarte silencioso en un documento fiscal es indistinguible de un dato que nunca existió, y
aquí hay que poder demostrar **por qué el libro tiene las filas que tiene**.

Mismo criterio con las filas sin número: no son asiento —el número **es** la identidad fiscal del
documento— pero se declaran en `sinNumero` en vez de desaparecer.

## Los importes: familia SCRUM-271

`Number('')` es `0` y `Number([])` es `0`. **Un total ilegible convertido en `0,00 €` es un asiento
que AFIRMA que esa factura no cobró nada**, y eso es peor que no tener la fila.

Un importe que no se puede leer sale como `null`, se marca (`importeIlegible`) y se reporta **con
su número de factura delante**, para que quien lea el libro sepa cuál mirar. Se probó con `''`,
`[]`, `null`, `undefined`, `'doce euros'`, `NaN` y `{}`.

**Y la otra cara, sin la cual la primera no vale:** un total de **cero legítimo** no se confunde con
uno ilegible. Sin ese test, «todo lo raro es null» y «todo es null» se verían igual en verde.

## Verificado en rojo — los tres por `$?`

* **Se quita una columna del asiento** → cae nombrándola: *«le faltan columnas: moneda»*.
* **El libro deja de filtrar por merchant** → cae: *«se ha colado una factura de OTRO merchant»*.
  En un libro de registro eso no es una fuga cualquiera: es **declarar como propia la facturación
  de un tercero**.
* **El importe ilegible se coerciona** → cae: *«se ha convertido en un número»*.

Las tres inyecciones revertidas; árbol limpio, `npm test $? = 0`.

## Lo que NO cubre

* **No hay pantalla todavía.** Es el mecanismo puro y probado; dónde se enseña, con qué copy y con
  qué filtros (rango de fechas, tipo F1/R1) es decisión de producto y necesita microcopy (regla 30).
* **No hay lector contra la base.** El constructor recibe las facturas ya leídas. La consulta —con
  su `where: { merchantId }`— es el paso siguiente, y es donde habrá que decidir la paginación: un
  libro de un ejercicio entero puede ser grande.
* **No se ha probado contra Postgres.** El control negativo se monta con dos merchants en memoria,
  que es lo que permite probarlo sin base; lo que no se verifica aquí es que la consulta real
  filtre — eso llegará con el lector.
* **`albaranRefs` se lee tal cual viene.** Si un día su forma cambia, el libro enseñaría enlaces
  vacíos en vez de romperse — se prefiere así, pero queda dicho.

## Ficheros

* `src/modules/invoicing/domain/libroRegistro.ts` (nuevo) — el constructor puro.
* `tests/scrum296-libro-registro.test.mjs` (11, sin gate).

---

# TRAMO 2 — el lector contra Postgres, los enlaces y la pantalla

**Fecha:** 6-ago-2026 · **Medido contra:** `origin/main` = `c551224aeb03ef5994c53b263ee006a1869f6b58`
· 2026-08-06T14:21:15+02:00 (anclado con `git ls-remote`; main se movió **cuatro veces** durante la
tarea: `51221c0` → `e714d23` → `4b4f30a` → `22d8e84` → `dc63496` → `c551224`).
**Tanda:** 2023 tests · 1955 pass · 0 fail · 68 skipped · `npm test` **`$? = 0`**

El tramo 1 cerró con un hueco declarado por mí: *«no se ha probado contra Postgres: el control
negativo es en memoria, así que lo que no queda verificado es que la consulta real filtre»*. Esto
lo cierra.

## 1 · Postgres de verdad, sin tocar ninguna base del proyecto

No había `psql`, ni Docker, ni distro de WSL, ni nada escuchando en 5432 (el `yaqu_dev` del
`.env.local` apunta a un servidor que no está levantado). En vez de declarar el hueco:

* binarios **portables** de PostgreSQL 16.4 en el scratchpad — sin instalar nada en el sistema, sin
  permisos de administrador, borrables;
* cluster propio con `initdb`, escuchando en **127.0.0.1:55432** (puerto raro a propósito: no puede
  colisionar con nada), base `yaqu_libro_test`;
* el esquema real **sin `db push` y sin migrar ninguna base del proyecto**: DDL generada con
  `prisma migrate diff --from-empty --to-schema-datamodel` usando el **binario local 6.18.0**
  —nunca `npx`, SCRUM-385—, **verificada no vacía** (718 líneas, 24 `CREATE TABLE`, cero `DROP`)
  antes de aplicarla con `psql`. El worktree no tiene `.env` ni `.env.local`, así que el CLI no
  tenía ninguna URL real que poder coger.

El test **no confía en que quien lo lance apunte bien**: antes de tocar nada exige que la URL sea
loopback y que la base termine en `_test`, y si no, **falla** (no se salta). Un test destructivo que
se salta en silencio cuando le apuntan a la base equivocada es el que un día la encuentra abierta.

## 2 · El guard que corre SIEMPRE, y el que corre con base

El control negativo real está **gateado** (sin `LIBRO_PG_URL` no corre). Un ticket cuyo único guard
de tenencia esté detrás de un gate es un ticket cuyo guard **el CI no ejecuta nunca**. Por eso hay
dos, y comprueban lo mismo por caminos distintos:

* `scrum296-lector-tenencia.test.mjs` — **sin base, en `npm test`**, por **AST**: pregunta por el
  `where` de CADA `findMany` del lector. Por AST y no por `grep` porque un guard de texto se caza a
  sí mismo en el comentario que explica la prohibición, y porque `grep merchantId` daría verde con
  el `merchantId` de otra consulta. Tiene suelo: si el extractor encuentra menos de 3 consultas,
  falla diciendo que no supo mirar.
* `scrum296-libro-postgres.test.mjs` — **contra Postgres**: dos merchants, dos juegos de facturas,
  y el libro de uno no ve ni una del otro. En las dos direcciones.

## 3 · Verificado en rojo — todos por `$?`

| inyección | qué cayó | lo que dijo |
|---|---|---|
| **quitar `merchantId` del `where`** de la consulta | los DOS guards | AST: *«invoice.findMany (línea 86)»* · Postgres: *«la segunda cerradura ha funcionado, pero la PRIMERA está abierta»* |
| **abrir las dos cerraduras** (consulta + constructor) | Postgres | *«declarar como propia la facturación de un tercero»*, con los tres números ajenos listados |
| **derivar «firmado» de `acceptedAt`** | Postgres | *«un presupuesto ACEPTADO pero sin firma sale como firmado»* |
| **el descuadre pasa a decir «no tienes facturas»** | pantalla | *«con 40 facturas miradas y 0 asientos la pantalla no avisa del descuadre»* |
| **el importe ilegible se pinta 0,00 €** | pantalla | *«eso AFIRMA que esa factura no cobró nada»* |
| **tono de aviso inventado** | pantalla | *«se pintan con un tono que el CSS no conoce y quedan OCULTOS»* |

El primero es el que más dice: con el `where` abierto, el libro **seguía enseñando solo lo mío**
—la segunda cerradura del constructor lo paraba— y aun así el test cayó, porque `ajenas` dejó de
ser 0. Sin ese contador, una consulta abierta habría pasado por verde.

⚠️ **Una corrección de proceso:** al revertir el rojo del tono con `git checkout --` destruí cuatro
correcciones que aún no había comiteado, y las tuve que rehacer. Es la segunda vez en esta sesión.
La regla —*la corrección se comitea ANTES de inyectar el siguiente rojo*— no es ceremonia.

## 4 · «Presupuesto firmado» sale de `signatureUrl`, NO de `acceptedAt`

**Es una decisión, no un detalle de implementación.** `acceptedAt` dice que el cliente le dio a un
botón; `signatureUrl` es el trazo, y es **la prueba** el día que ese cliente diga que él no pidió
esto. En un libro que existe para enseñárselo a un tercero, el enlace tiene que apuntar a la
prueba, no a la intención.

Es además el criterio que ya usa `metrics.service` para el paso «Que tu cliente firme»
(SCRUM-314/315): un solo significado de «firmado» en toda la casa.

Y **la firma no viaja**: `signatureUrl` es un data-URI con el trazo (dato personal, y decenas de KB
por fila). El filtro `signatureUrl: { not: null }` se resuelve **en Postgres** y de vuelta solo
viene el `id`. Un guard lo comprueba: si algún `select` del lector se trae `signatureUrl`, falla.

El test tiene las dos caras — un presupuesto firmado y otro **aceptado pero sin firmar** —, porque
sin la segunda «firmado» y «aceptado» darían el mismo verde y la decisión no estaría medida.

## 5 · Los enlaces, y el descuadre que un libro tiene que dejar ver

Cada asiento lleva `presupuestoId` + `presupuestoFirmado`, los **albaranes sellados** en la factura
(`albaranRefs`) y `cobroId`. Y uno más: `albaranesNoSellados`, los albaranes que apuntan **hoy** a
esa factura (`Albaran.invoiceId`) y **no estaban en el sello**. No se añaden a la lista —la factura
emitida dice lo que dice, regla 29— pero tampoco se ocultan: un descuadre entre el documento
sellado y la relación viva es exactamente lo que un libro de registro tiene que enseñar.

`presupuestoFirmado` es `null` cuando no hay presupuesto: «no viene de uno» y «viene de uno sin
firmar» son cosas distintas, y un `false` para las dos las haría indistinguibles.

## 6 · La pantalla

Ruta nueva `GET /admin/libro-registro`, **admin-only** (el default de S1, y aquí el correcto por
contenido: es la facturación entera del negocio, no trabajo de campo del Operario), en **fichero
propio** — no colgada de `invoicesAdmin.routes.ts`, que es camino de emisión: la regla 38 permite
leerlo, no tocarlo, y en un diff un añadido ahí no se distingue.

Las tres situaciones que se parecen y significan lo contrario, y **se prueban ejecutando la vista**
sobre un DOM de mentira (sin dependencias nuevas, regla 36), no leyendo el fuente:

| situación | qué se pinta |
|---|---|
| la carga falla | aviso de error, **ni una fila** |
| miró 40, salieron 0 asientos | **«el libro no cuadra»**, con los dos números |
| miró 0 | «todavía no has emitido ninguna factura» — aquí sí es la verdad |
| falta `miradas` en la respuesta | se trata como fallo: sin ese número no se puede saber cuál de las dos cosas pasa |

Y los importes ilegibles se pintan «—», nunca `0,00 €`, con su aviso y el número de factura
delante. Con su cara positiva: un **cero legítimo** sí se pinta `0,00 €`.

**Microcopy: TODAS las ranuras van con `[PENDIENTE microcopy oficial]` DELANTE del texto** (regla
30), no en vez de él — con el marcador solo, «no tienes facturas» y «el libro no cuadra» dirían lo
mismo, que son justo los dos mensajes que esta pantalla existe para no confundir. El guard compara
**ranura a ranura contra las constantes**, así que el día que se apruebe la copy sigue verde sin
tocarlo (patrón SCRUM-263/303).

## 7 · AB6: lo que encontró la captura y el conteo de nodos no

Banco HTML **fuera del repo** que carga el CSS real y el fichero real de la vista;
`chrome-headless-shell` a 360/390/768/1280 y la página midiéndose a sí misma. Detalle y capturas en
`docs/capturas/scrum-296/README.md`. Dos defectos reales, los dos con el **nodo presente**:

1. **el aviso de importes ilegibles no se veía** — lo pinté `alert warn`, y el CSS oculta toda
   `.alert` sin un modificador conocido. Ahora hay un guard que **deriva los tonos válidos del
   propio `styles.css`** y falla si alguno se sale;
2. **la tabla no tenía estilos** — escribí `class="data-table"`, que no existe; el inventario AB3 es
   `.table-scroll` + `.table`. Salía sin padding, con el importe pegado al estado.

Y una idea mía que la medición mató: puse `max-width:280px` en la columna de trazas creyendo que
estrechaba la tabla; medido, **no cambiaba el ancho y engordaba las filas** (262 px contra 244 a
360). Se quitó. Lo que estiraba la tabla eran los **encabezados con `nowrap`** llevando el marcador
de 29 caracteres delante: sin `nowrap`, de 2.277 px a 520.

**En ningún ancho la PÁGINA scrollea en horizontal.** A 1280 la tabla pide 2.357 px, y eso **es el
marcador, no la pantalla**: la misma vista con `MARCADOR = ''` mide **1.246 px, exactamente el ancho
visible, cero scroll**.

## Lo que NO cubre — declarado

* **Foco con Tab real: NO medido.** La pantalla no añade controles interactivos propios, así que no
  hay foco nuevo; el recorrido completo del dashboard con esta vista dentro no se ha comprobado.
* **Contraste AA: NO medido.** Se reutilizan tokens y clases existentes, sin color nuevo, pero no ha
  pasado un medidor.
* **Matriz de dispositivos real**: solo anchos simulados.
* **En móvil la columna de trazabilidad queda fuera de la vista** hasta arrastrar la tabla — es lo
  que hace este libro distinto y en un teléfono no se ve de entrada. No lleva `table--cards-mobile`
  porque esa variante apila la fila en una rejilla de **cinco áreas fijas** y este libro tiene ocho
  columnas. Limitación declarada, no decisión cerrada.
* **Sin paginación ni filtros en la interfaz.** El lector acepta rango de fechas; la pantalla pide
  el ejercicio entero. Un libro de un año grande traerá muchas filas.
* **`AlbaranLineaFacturada` (C6) no se usa todavía.** El enlace por línea existe en la base; el
  libro enlaza a nivel de documento. Es el siguiente escalón natural.

## Lo que otros guards cazaron por el camino (y tenían razón)

* **SCRUM-113** — el test creaba merchants a mano. Migrado a `withMerchant`, cuyo orden de barrido
  sabe de `albaranLineaFacturada` (SCRUM-170/172), cosa que a mano se olvida.
* **SCRUM-289** — la consulta del libro no estaba clasificada en el censo de «sitios que atan una
  factura a su origen». Clasificada como **OPACO**: el `where` solo es opaco por el spread de
  fechas, `quoteId` no aparece, y **la factura suelta SALE**, con `presupuestoId: null`. Es el sitio
  donde atar al origen sería más grave: un libro que se presenta como completo y no lleva la suelta
  es un documento que **afirma** que esa facturación no existió.
* **SCRUM-274** — el service worker no precacheaba el fichero nuevo (primera visita sin cobertura,
  sin pantalla, y con red no se nota). Añadido a `SHELL`.
* **SCRUM-55 y SCRUM-158** — la ruta no declaraba rol, y su montaje no tenía ninguna ruta en
  `ADMIN_ONLY_ROUTES`, así que su 403 no lo ejercía nadie. Las dos cosas, arregladas.

## Ficheros (tramo 2)

* `src/modules/invoicing/domain/libroRegistro.repo.ts` (nuevo) — el lector, tres consultas.
* `src/modules/invoicing/app/routes/libroRegistro.routes.ts` (nuevo) — `GET /admin/libro-registro`.
* `src/modules/invoicing/domain/libroRegistro.ts` — enlaces nuevos en el asiento.
* `src/app.ts` · `src/core/http/adminOnlyRoutes.ts` · `public/sw.js` — montaje, rol, precache.
* `public/dashboard/js/libroRegistroView.js` (nuevo) · `public/dashboard/index.html` ·
  `public/dashboard/js/app.js` — la pantalla y su sitio en el menú.
* `tests/scrum296-lector-tenencia.test.mjs` (4, sin gate) ·
  `tests/scrum296-libro-postgres.test.mjs` (1, gateado por `LIBRO_PG_URL`) ·
  `tests/scrum296-pantalla-libro.test.mjs` (14, sin gate).
* `tests/_censo-origen-factura.mjs` — la entrada del censo de SCRUM-289.
* `docs/capturas/scrum-296/` — seis capturas y sus medidas.

