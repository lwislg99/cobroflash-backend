# SCRUM-423 · el eje de ENTREGA llega por fin a la pantalla — y el primer cierre en falso, cerrado

**Medido contra:** `origin/main` = `846d072b78352cab32af441a5e66f59a513fea6f` · 2026-08-10T15:55:53+01:00

**Fecha:** 10-ago-2026 · **Carril:** A (producto) · **Gate:** sin gate, corre en `npm test` ·
**UI:** vanilla (regla 4)
**Tanda:** ver «Tanda final» al pie (se corre DESPUÉS de esta entrada, no antes).

C6 (SCRUM-305) construyó `resumenEntrega`, lo probó con 12 tests y lo dejó verde. Lo importaba
**únicamente su propio test**. Ningún profesional lo había visto nunca.

## ¿Por qué NO se cableó al cerrar C6? No se olvidó — se decidió

La pregunta que decidía el alcance tiene respuesta escrita en `docs/master/SCRUM-305.md`, sección
*«🔴 ESTE TICKET SE PARTE EN DOS, Y NO CIERRA CON ESTA MITAD»*:

> Decisión del asesor (5-ago-2026, 23:0x) … **cuatro ramas tienen ediciones pendientes dentro de
> `renderJobDetailView`** y ninguna está en `main` … meter una quinta mano encima de 52 y 34 líneas
> que están a punto de rebasar, y dentro de la misma función, es garantizarse un conflicto.

Y remata: *«SCRUM-305 NO CIERRA con esta mitad. "Quedan 3" que nadie puede ver no es C6
entregado»*. Es decir: **el hueco estaba declarado, con motivo, y con lo que faltaba nombrado.** Lo
que falló no fue la entrega de C6 sino que el ticket se dio por Finalizado con su propia entrada
diciendo que no lo estaba.

**Medido hoy:** de las cuatro ramas bloqueantes, **tres ya no existen** en el remoto
(`scrum-300-campos-albaran`, `scrum-302-detalle-albaran`, `scrum-316-detalle-b2`) y una sigue viva
(`scrum-300-firmado-por`). El bloqueo que justificó partir el ticket está prácticamente disuelto.

## La superficie, medida antes de tocar nada

`HUECOS_COBRO` vive en `public/dashboard/js/jobCobroHuecos.js` (G5 · SCRUM-320, **6-ago**, un día
DESPUÉS de C6) y lo pinta `pintarQueFaltaParaCobrar` en `jobDetailView.js`. Está construida: no
hubo que parar.

⚠️ **Nota de destino:** el asesor eligió el 5-ago «encima de la tabla de albaranes del Trabajo»,
porque «Qué falta para cobrar» **todavía no existía**. Este ticket cablea a la sección de G5, que
es superficie posterior y mejor —enumera huecos accionables, que es exactamente lo que «faltan 3
líneas por entregar» es—. Queda dicho por si alguien vuelve a la entrada de C6 y ve otro sitio.

## Lo construido — se ENCHUFA, no se recalcula

* `src/modules/jobs/domain/entregaDelTrabajo.ts` (nuevo) — el adaptador. Resuelve las tres entradas
  de `resumenEntrega` y **no copia ni una línea de su aritmética**. Es un fichero aparte, y no
  código dentro de la ruta, por un motivo concreto: **el suelo tiene que poder ejercitarse sin base
  de datos.** Un suelo que exige levantar Postgres es un suelo que no se prueba.
* `jobs.routes.ts` — `serializeJobDetail` expone `entregaPendiente`. **Sin una consulta nueva**:
  `QUOTE_SELECT` ya trae `lines` y `quotesDeJob` ya devuelve el ORIGINAL el primero, que es
  justo lo que hacía falta para el eje y para `hayAdicionales`. Va también en la **salida temprana**
  del Trabajo sin presupuestos, para que ese caso no quede mudo.
* `jobCobroHuecos.js` — quinto hueco `sin-entregar`, entre facturar y cobrar (el orden de la
  sección: primero lo del pro, al final lo del cliente). **El número no se calcula en el navegador**;
  llega derivado del servidor.
* `jobDetailView.js` — el rótulo, con la copy aprobada.

## Microcopy — APROBADA por el asesor el 10-ago-2026 (regla 30)

> **«3 líneas del presupuesto sin entregar»** · singular: **«1 línea del presupuesto sin entregar»**

El motivo de la elección, que el asesor pidió que quedara y no sólo la elección: gana **por el
registro**. Los cuatro huecos ya pintados son sustantivo-primero y sin verbo conjugado; un quinto
con «Quedan…» delante no se lee como quinto elemento de la lista, sino como un aviso distinto
metido en medio — y la lista tiene que leerse de un vistazo desde una furgoneta. El «Quedan 3» de
C6 es la frase del **diseño**, que ilustra; la copy tiene que convivir con lo que ya está pintado. Y
«del presupuesto» **no se cae**: es lo que dice contra qué se mide, que es el eje entero que C6
separa del de facturación.

⚠️ `COPY_ENTREGA` (los tres motivos y las dos coletillas) **ya estaba firmada** por el asesor el
5-ago y así consta en el código y en la entrada de C6. Lo que no existía en ninguna ranura firmada
era precisamente la frase que lleva el número — por eso hizo falta esta aprobación y no otra.

### La composición, aprobada aparte — y una corrección a mi propuesta

Yo propuse **callar la línea** cuando el número dejara entregas sin contar, para no pintar un
número mudo. **El asesor lo corrigió, y tenía razón:** mira lo que produce callarse. El profesional
abre «Qué falta para cobrar», no ve línea de entrega y lee que no queda nada por entregar. **Es la
pantalla que dice "ya puedes facturar"** — el mismo suelo que este ticket existe para prohibir. Con
`sinAtribuir` el motor SÍ supo que había algo; sólo no supo dónde ponerlo. Callarse es peor que el
número incompleto, porque el número incompleto al menos deja al profesional mirando.

Composición aprobada: la coletilla firmada va **en la misma línea**, detrás, separada por « · » —el
separador de la casa, el de «Presupuesto #2 · 24 jun · 853,05 €»— y con **el mismo peso visual**: ni
gris, ni más pequeña, ni entre paréntesis. *Una salvedad que se ve menos que el número al que
corrige no es una salvedad.*

> **El principio que gobierna esto:** un número y el motivo por el que puede estar incompleto **no
> se pueden separar**. Por eso van en UNA sola cadena y se pintan en UN solo `textContent`, y hay
> dos tests que lo fijan: uno cae si el rótulo se reparte en dos nodos, y otro si alguna regla CSS
> que alcance al hueco introduce truncado (`text-overflow`, `nowrap`, `line-clamp`). Los dos
> verificados en rojo.

⚠️ La coletilla **se compone en el servidor** con `fraseDeCuenta` (la copy firmada de C6). El
frontend es vanilla y no puede importar ese módulo: si el texto se escribiera allí habría dos
fuentes de verdad para una frase firmada, y la de la pantalla sería la que nadie firmó.

### El caso sin número: la coletilla se sostiene sola

`lineasPendientes === 0` **con** `sinAtribuir > 0` existe y es corriente — se entrega todo lo
presupuestado y además algo añadido en obra (medido: presupuesto de 1 línea entregada entera + 1
línea sin enlace → `calculable: true`, `lineasPendientes: 0`, `sinAtribuir: 1`).

Yo lo propuse dejar **sin pintar**, como deuda de microcopy, porque la frase aprobada no vale ahí:
«0 líneas del presupuesto sin entregar · …» es una contradicción en una sola línea. Descarté además
el marcador `[PENDIENTE microcopy oficial]` porque el trinquete de SCRUM-402 cuenta marcadores en
literales y no puede subir — **y no me pareció bien empeorar un ratchet ajeno por un caso mío**.

El asesor señaló que ese razonamiento era correcto pero la salida no era subir el ratchet: era
darse cuenta de que **la coletilla se sostiene sola**. «1 línea entregada que no sale del
presupuesto» ya es una frase completa y verdadera, ya sale de `fraseDeCuenta` —copy firmada—, y ya
respeta el registro sustantivo-primero de sus cuatro vecinas. Así que ese caso pinta la coletilla
sin acompañamiento: **sin texto nuevo, sin marcador, sin tocar el trinquete de 402, y sin deuda.**

Con eso **el suelo queda cerrado entero**: no queda ningún estado en el que el motor sepa que hay
algo y la pantalla se calle.

## 🔴 DIVERGENCIA DECLARADA: el diseño prometía material, el motor da líneas

El diseño de G ilustra este hueco como **«Quedan 3 m de bajante por entregar»**: unidades de un
material concreto. **El motor no puede dar eso.** `resumenEntrega` trabaja contra las líneas del
presupuesto, y ni el presupuesto ni el albarán comparten una unidad fiable — C6 lo midió y por eso
decidió que *«el número va desnudo, sin unidad»*: la del albarán es texto libre que el profesional
puede cambiar sin que nada se entere.

**La copy sigue al DATO —líneas—, nunca a lo que el diseño imaginó.** Y se escribe aquí en vez de
ajustarlo en silencio: si algún día alguien quiere la frase del diseño, **tendrá que cambiar el
motor** (y antes, el modelo: unidades comparables es esquema), y esa decisión tiene que estar
visible cuando llegue. Un texto que se acomoda al dato sin decirlo esconde que la promesa era otra.

### Un error mío que la aprobación arrastraba, corregido al implementar

Propuse la copy hablando de «líneas» dando por hecho que `pendienteTotal` las contaba. **No las
cuenta:** es la SUMA DE CANTIDADES pendientes (horas, m², ud). Rotular `pendienteTotal: 2.5` como
«2,5 líneas del presupuesto sin entregar» habría sido falso, y encima con decimal. Así que la vista
recibe **`lineasPendientes`** —el conteo de líneas de C6 con pendiente > 0, contado sobre su
resultado, sin recalcular nada— y `pendienteTotal` viaja también, con otro nombre, para que no
puedan confundirse sin querer.

## Las cinco verificaciones

| # | qué | resultado |
|---|---|---|
| ① | Trabajo con entrega pendiente **muestra** la línea con su cifra | ✅ y la sección se hace visible por este hueco aunque no haya otro |
| ② | Sin nada pendiente, **ni línea vacía ni «pendiente de calcular»** | ✅ las dos negaciones, con hermano positivo del patrón |
| ③ | Rojo por el mecanismo | ✅ cae **nombrando que la línea desapareció** |
| ④ | **SUELO**: si no se pueden leer las líneas, FALLA | ✅ cinco formas de ceguera, cada una con su motivo |
| ⑤ | `entregaPendiente.ts` sale de los inalcanzables | ✅ **medido con el censo de SCRUM-411**, no a ojo |

**③ el rojo, literal** (quitado el cableado de pantalla, inyección verificada en disco):

> 🔴 LA LÍNEA DE ENTREGA HA DESAPARECIDO de «Qué falta para cobrar» habiendo 2 líneas del
> presupuesto sin entregar. El cálculo de C6 sigue dando el número: lo que se ha roto es el ENCHUFE
> — o el backend dejó de mandar `job.entregaPendiente`, o el motor de huecos dejó de leerlo. **No es
> un fallo de pintado: el hueco ni siquiera se produce.**

**⑤ el rojo, literal** (quitado el cableado de backend):

> 🔴 `entregaPendiente.ts` SIGUE siendo inalcanzable: el motor de C6 continúa sin llegar a ningún
> profesional.

### ④ El suelo, que es el test que más importa

«No queda nada por entregar» y «no supe leer lo entregado» **dan la misma pantalla**, y el segundo
le está diciendo al profesional que ya puede facturar. Por eso `ILEGIBLE` es un estado propio y no
se puede confundir con `CALCULADO` con cero pendiente.

⚠️ Y el caso que de verdad muerde no es `lines: null` —ése salta a la vista— sino **un array de
líneas cuyas cantidades no se pueden leer**: ahí `resumenEntrega` daría `presupuestada: 0` para
todas, `pendienteTotal: 0`, y la pantalla diría tan tranquila que no queda nada. Un cero derivado
de no saber leer es la mentira más cara de esta pantalla, y se caza antes de llamar al motor.

## Los tres guards que se descuadraron, ajustados CON su motivo (ninguno relajado)

* **SCRUM-411 · 8 → 7.** El trinquete es de IGUALDAD y su propio mensaje pide bajarlo en el mismo
  commit que cablea. Sale `entregaPendiente.ts`. **Fue este censo, y no una revisión a ojo, el que
  convirtió «C6 está Finalizada» en «C6 tiene un cierre en falso».**
* **SCRUM-320 · el fixture del orden canónico** ahora produce los CINCO huecos. La comparación
  sigue siendo de igualdad: un hueco nuevo que el guard no sepa producir lo deja rojo, que es para
  lo que sirve.
* **SCRUM-237 · negaciones respaldadas.** Me cazó tres negaciones mías sin hermano positivo, con
  razón. Las tres llevan ahora su positivo con el mismo token — incluida la del censo, donde se
  exige primero que el censo VEA los dos ficheros: si dejara de verlos, «no está entre los
  inalcanzables» sería cierto y vacío.

## Lo que NO cubre — declarado

* **Los tres motivos de «no contesto» no se pintan** (regla de G: o está el dato, o no está la
  línea). Su copy firmada queda construida y sin usar **en esta superficie**.
* `enPartesSinFirmar > 0` **sí** deja pintar: esas líneas no cuentan *por definición* de C6, y su
  declaración ya está en pantalla en otra línea (el hueco `sin-firmar`). Hay un test que fija esa
  implicación: si se rompe, avisa de que este hueco necesitaría su coletilla.
* **El ticket NO deja deuda de microcopy.** El caso `lineasPendientes === 0` con `sinAtribuir > 0`
  —que existe y es corriente: se entrega todo lo presupuestado y además algo añadido en obra— se
  resolvió **sin texto nuevo**: se pinta la coletilla SOLA. Ver abajo.
* **No se toca la cabecera** (`jobNextAction`, la escalera de SCRUM-366): esta sección enumera, no
  elige.
* **No hay AB6 de captura**: el cambio es una fila más en una lista ya existente, con sus mismos
  tokens y sin CSS nuevo.

## De paso, y por encargo del asesor: la frase falsa de `CLAUDE.md` (SCRUM-422)

Decía *«`.env` apunta a PROD; dev usa `.env.local`»*. **Es falsa en los cuatro worktrees desde
SCRUM-383**, y fue la que me hizo afirmar sin medir en SCRUM-418. Se reescribe **como registro
fechado, no como afirmación de estado**: qué se midió, cuándo, y con qué comando volver a medirlo.

Verificado hoy con el propio guard antes de escribirlo — los cuatro árboles: `fallos = 0`, las tres
claves `_STAGING`/`_DEV`/`_TESTS`, ninguna `DATABASE_URL`, ningún `.env.local`.

⚠️ La otra mención (`npm run dev … carga .env.local con prioridad`) **no se toca y no es falsa**:
describe el mecanismo de `loadEnv.ts`, que sigue dando prioridad a ese fichero *si aparece*. La
diferencia entre «este fichero existe» y «si existe, manda» es justo la que hacía falta.

## Ficheros

* `src/modules/jobs/domain/entregaDelTrabajo.ts` — **nuevo**, el adaptador puro.
* `CLAUDE.md` — la frase de las claves de BD, como registro fechado (SCRUM-422).
* `src/modules/jobs/app/routes/jobs.routes.ts` — expone `entregaPendiente` (sin consulta nueva).
* `public/dashboard/js/jobCobroHuecos.js` — quinto hueco y `HUECOS_COBRO`.
* `public/dashboard/js/jobDetailView.js` — el rótulo aprobado.
* `tests/scrum423-entrega-en-que-falta.test.mjs` — **nuevo**, 12 tests, sin gate.
* `tests/scrum411-exports-inalcanzables.test.mjs` · `tests/scrum320-que-falta-para-cobrar.test.mjs`
  — los dos trinquetes, ajustados con su motivo.

## Tanda final

**2549 tests · 2475 pass · 0 fail · 74 skipped · `npm test` `$? = 0`**, corrida **DESPUÉS** de
escribir esta entrada. El orden importa y es la lección de SCRUM-415: allí la tanda se corrió antes
de crear el documento, se commiteó después, y el CI se puso rojo por el propio documento.

*(Tramo 1 —el cableado— se midió en 2512 · 2438 pass · 0 fail sobre `ca15d694` y está en `main`
desde el PR #603. Este tramo 2 añade la coletilla y se mide sobre `846d072b`.)*
