# SCRUM-316 · G1: el detalle del Trabajo con el patrón B2

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **UI:** vanilla (regla 4)

**Medido contra:** `origin/main` = `fbe050592594569b967100114bf41724eede6ff0` · 2026-08-05T11:33:14+02:00

## Lo que desbloqueó este ticket

Estaba parado porque «cuál es la acción primaria» no tenía respuesta alcanzable. SCRUM-366 movió la
escalera a `jobNextAction.js`, y con eso el hueco de primaria **ya tiene quién lo ocupe sin
inventar mecanismo**. Este ticket no decide qué acción va primero: la coloca donde el patrón manda.

## Las dos correcciones del ticket, aplicadas

El diseño original estaba mal en dos cosas y las dos vienen medidas de G0. No se han «tenido en
cuenta»: han cambiado la forma del código.

**1 · El cobro no es un eje. Es aritmética.** No hay columna de estado de cobro:
`estadoCobroFor(cobrado, aceptado)` lo calcula de dos `Decimal`. Un eje tiene tabla de transiciones
y auditoría; el otro se recalcula en cada lectura. Por eso el guard **genera** las situaciones de
cobro con números (`{aceptado: 500, cobrado: 0}`) en vez de enumerar un enum que no existe, y hay un
test que falla si alguien mete `Pendiente`/`Parcial`/`Pagado` en el enum de estados.

**2 · Son CINCO estados, no cuatro.** Falta `cerrado`, terminal. El guard **deriva `JOB_STATES` del
AST de `job.service.ts`** y comprueba que son cinco y que `cerrado` está. Una lista escrita a mano
en el test habría heredado el mismo error que venía a corregir.

**Y lo que el fundador corrigió de su propia corrección:** `jobNextAction` **sí** consulta
`job.status` en el nivel «Cobrar». No se ha tocado. La escalera entra en este PR exactamente como
salió del anterior.

## Lo que se construye

### La cabecera, con la ley del patrón

`public/dashboard/js/jobActionsRegistry.js` (nuevo) — misma forma que `invoiceActionsRegistry.js`
(B2): la vista **pinta** desde ahí y el guard **verifica** contra ahí. Nadie escribe la tabla dos
veces.

- **La primaria** sube del bloque de resumen a la cabecera. El registro declara el **hueco**, no su
  ocupante: quién lo llena lo decide la escalera. Fijar aquí una acción concreta sería una segunda
  fuente para la misma pregunta — justo lo que SCRUM-366 acaba de eliminar.
- **Los dos chips** (estado del Trabajo + estado de cobro) suben con ella, juntos y al lado del
  título, como en la maqueta.
- **Ensamblado** en el orden de la ley: primaria · secundarias · `⋮`. El `⋮` reutiliza
  `overflowMenu` de AB3; si no estuviera cargado, las acciones se pintan sueltas — perder el menú no
  puede costar una acción.

### ⚠️ Esta tabla NO va por estado del Trabajo, y no es un olvido

La de factura sí lo hace. La del Trabajo no puede: **ninguna guarda de la vista ramifica por
`job.status`** — miran el albarán, el cobro o la existencia de datos. Escribir cinco columnas
idénticas habría sugerido que el destino depende del estado, invitando a diferenciarlas, cuando el
producto no tiene ese mecanismo. Añadirlo es una decisión nueva que aprueba el fundador, no un
efecto colateral de ordenar. **Ordenar no exige cambiar el criterio, y no se ha cambiado ninguno.**

### Salen DOS filas, no tres

| id | destino | por qué |
|---|---|---|
| `cta` | primaria | la escalera |
| `btnGasto` | secundaria | un gasto **no es un documento** — estaba en la barra de DOCUMENTOS por inercia |

Fuera, cada una por su motivo medido:

- **`+ Nuevo albarán`** y **`🧾 Consolidar en factura`** — sí son de Trabajo, pero crean y reparten
  DOCUMENTOS, que es **G4** y el ticket lo declara fuera de alcance.
- **`Cambiar`** (tipo de trabajo) — **no es una acción: es el editor plegado de un campo**, dentro
  de su sección. Subirlo dejaría el botón arriba y lo que abre fuera de pantalla. La ley ordena
  acciones, no controles de formulario.

**La ley permite hasta dos secundarias y la medición da una. El hueco se queda vacío**: rellenarlo
exigía promover un control que no es una acción o invadir G4, y las dos cosas son peores que una
cabecera con una secundaria.

### El rail: estructura hoy, contenido en G3

Los cinco bloques quedan declarados (`JOB_RAIL_BLOQUES`) y la rejilla montada. **Cada bloque se
pinta solo si tiene contenido, y hoy ninguno lo tiene** — así el sitio existe y está probado sin
publicar una columna en blanco en yaqu.app. Sin esto G3 se inventaría su propio contenedor, que es
como una pantalla acaba con dos maquetaciones que nadie decidió tener.

## Lo destructivo

**No hay ninguna acción destructiva sobre el Trabajo en esta vista** — medido, no supuesto. El
requisito «solo en `⋮`» se cumple hoy por ausencia, así que el guard lleva **control positivo**: se
comprueba que el detector reconoce una destructiva evidente antes de afirmar que no hay ninguna.
Sin eso, «ninguna visible» y «el detector no sabe reconocer ninguna» darían el mismo verde con
significados opuestos.

## Los seis rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | La **condición** de la primaria (`terminado` → `cerrado` en la escalera) | 🔴 nombrando la combinación: «terminado + sin cobrar propone «nuevo» en vez de cobrar» |
| 2 | Quitar un estado del modelo (quedan 4 — el error de B2) | 🔴 SUELO de estados + el recorrido del producto |
| 3 | Meter `cobrado` como quinto estado | 🔴 CONTROL NEGATIVO |
| 4 | Pintar una acción de cabecera a mano | 🔴 nombrando fichero y línea |
| 5 | Declarar una destructiva como botón visible | 🔴 «lo irreversible va en el ⋮» |
| 6 | Cegar una vía del censo (`mkBtn`) | 🔴 «no hay acciones» ≠ «no supe mirar» |

### El rojo 4 no salió a la primera — y el arreglo se perdió, y se entregó decorativo

La primera versión de ese test **contaba** apariciones de `headRight.appendChild` y restaba las
permitidas — pero uno de los patrones de resta casaba con las **mismas dos líneas** que ya había
restado el anterior. El total quedaba negativo y el assert **no podía dispararse nunca**: verde
perfecto, midiendo nada.

Se reescribió para revisar **cada línea** contra las formas admitidas, y el rojo salió. **Y aun
así el PR se subió con la versión rota.**

Al revertir un rojo posterior con `git checkout -- tests/scrum316-…`, git restauró ese fichero
desde HEAD — y **se llevó por delante la corrección, que todavía no estaba comiteada**. El commit
de seguridad se había hecho ANTES de arreglar el test, así que «volver al estado bueno» significaba
volver al estado malo. La rama viajó con el guard decorativo y esta entrada afirmaba lo contrario.

Lo destapó repetir los rojos tras el rebase, porque el rojo 4 volvió a no saltar. **La lección no
es «arreglar el test»: es que un `git checkout --` para revertir una inyección solo es seguro sobre
un fichero cuyo estado bueno esté comiteado.** Ahora la corrección se comitea antes de inyectar
nada.

Si nadie hubiera vuelto a pedir los rojos, este guard se habría quedado en `main` sin poder fallar
jamás, con una entrada de registro diciendo que sí.

## El conflicto de #449, resuelto conservando las TRES

`main` trajo **SCRUM-363** y chocó en `jobDetailView.js`, en el bloque de los chips. Las dos
versiones contestaban a preguntas distintas y ninguna sustituye a la otra:

- **363 decide CUÁNDO** hay chip de cobro: sin importe de referencia no se pinta ninguno — ni
  «Parcial», ni «Pendiente», ni un hueco gris.
- **316 decide DÓNDE** va: en la cabecera, junto al estado del Trabajo.

Quedarse con la de 316 habría devuelto el «Parcial» falso a la pantalla, en su sitio nuevo. La
resolución conserva la condición de 363 dentro de la colocación de 316, y **cada comentario mantiene
su texto literal** (regla 30): no se ha redactado una frase nueva para fundirlos.

Verificado por separado, no por que compile:

- **363** — el chip sigue siendo condicional y el `importeReferencia` lo sigue calculando el
  BACKEND (`jobs.routes.ts`), no la vista.
- **366** — la vista **consume** `jobNextAction` y no la redefine: 0 definiciones locales.
- **316** — cabecera, chips, rejilla del rail: 13 referencias vivas.

## Verificación

- `npm run build` OK y `npm test` en **esa misma tirada**: **1581 tests · 1514 pass · 0 fail · 67
  skipped**.
- **Los seis rojos, repetidos enteros después del rebase.** No se dio por bueno que compilara — y
  menos mal: el rojo 4 volvió a no saltar y así se destapó que su arreglo nunca había viajado.
- Guards vecinos: SCRUM-363 + SCRUM-366 + SCRUM-274 (SHELL) → 17/17.
- `origin/main` se movió **tres** veces durante el ticket (entraron 366, 315 y 363). La tanda de
  arriba es la de después de la última.

## Microcopy (regla 30)

**Este PR no introduce ni un texto nuevo.** La etiqueta de la primaria la pone la escalera, los
chips salen de `jobStatusMeta` y `estadoCobro`, y `+ Añadir gasto` se mueve **verbatim**. Los
rótulos del rail son microcopy sin aprobar y llegan con G3, junto con su contenido — no se han
escrito marcadores porque no se pinta nada que los necesite.

## Huecos declarados

- **AB6 · matriz de dispositivos: PENDIENTE.** Es humana. El CSS contempla el caso que más falla
  (el rail pasa debajo por debajo de 720 px y las acciones bajan enteras en vez de partir la
  primaria de las secundarias), pero **no está verificado en dispositivo**.
- **Capturas antes/después: PENDIENTE** — mismo motivo.

## Lo que NO se tocó

- El criterio de ninguna acción: qué se ve y cuándo sigue decidiéndolo la misma guarda de siempre.
- La escalera (`jobNextAction`), que entra igual que salió de SCRUM-366.
- El reparto de DOCUMENTOS (**G4**), el contenido del rail (**G3**) y «Qué falta para cobrar»
  (**G5**).
- El defecto de `Pagado` inalcanzable con `totalAceptado` null o 0: es de la fórmula, se reporta y
  va aparte (regla 9).
