# SCRUM-400 · La landing deja de afirmar una conformidad que no tenemos

**Medido contra:** `origin/main` = `cb2399788aebe786608491734390b45e8b067d1e` · 2026-08-07T19:13:03+01:00

**7-ago-2026** · rama `scrum-400-censo-sistema-de-facturacion` · sin gate, corre en `npm test`

## 🔴 ESTO NO ENMIENDA EL MÁSTER: LO APLICA

La entrada **A4.1 ya prohíbe** «factura», «VeriFactu» y los claims fiscales en la landing. **Lo
que estaba publicado la incumplía.** Retirarlo no cambia la regla — la cumple.

Se escribe así a propósito, para que nadie lea esto como una decisión de producto que luego se
pueda revertir alegando que cambió el criterio. **El criterio no ha cambiado; lo publicado estaba
fuera de él.**

## Lo retirado, y solo eso

Decisión del fundador del 7-ago-2026. **Se retira, no se sustituye**: donde había una promesa no
va otra promesa, porque cualquier texto nuevo sería microcopy sin aprobar (regla 30) y se ha
decidido esperar al asesor (P14 de `docs/legal/PREGUNTAS_ASESOR.md`).

| Estaba en | Texto retirado |
| --- | --- |
| `public/index.html:377` | insignia «Facturación **VeriFactu en certificación**» |
| `public/index.html:510` | FAQ entera: «**Te contesto como fabricante**: la facturación VeriFactu **está construida y en certificación** — **con declaración responsable del productor**, que es lo que tu gestor te pedirá. […]» |

**Por qué eran insostenibles:** `docs/legal/DECLARACION_RESPONSABLE.md` es una plantilla con **25
placeholders** sin rellenar y su cabecera dice «**NO publicar** ni entregar a merchants hasta (1)
SIF-1 8/8, (2) revisión del asesor fiscal, (3) datos reales del productor». **La web invocaba un
documento que no está emitido.**

## La maquetación NO quedó coja — medido, no supuesto

Servida la landing y medida en el navegador:

| | Escritorio (914 px) | Móvil (390 px) |
| --- | --- | --- |
| Barra de confianza | **3 items**, todos en la misma fila (`top` idéntico), altura 22 px | 3 items apilados, ninguno fuera del contenedor |
| FAQ | **4 preguntas**, ninguna vacía | igual |
| Desbordamiento horizontal | **no** | **no** |
| Contenedores vacíos donde estaban | **0** | **0** |

Ninguna de las dos dejaba hueco: eran elementos de listas flexibles. **No se ha rellenado nada.**

## El guard: `scripts/_guard-conformidad-landing.mjs`

Vigila **la conjunción de dos cosas**, no una palabra:

① que el texto publicado afirme un **estado de conformidad** —un término de estado (certificación,
homologado, conforme, cumple, declaración responsable) **junto a** uno fiscal (VeriFactu, AEAT,
RRSIF, RD 1007…) **en la misma frase**—, o que se **autodenomine** fabricante/productor; y
② que **no haya un documento emitido** detrás.

**«Emitido» significa**: sin placeholders sin rellenar, sin marcas `[VALIDAR ASESOR]`, sin el aviso
de «NO publicar», y sin que la cabecera se declare PLANTILLA.

**La proximidad es lo que evita el falso positivo.** «YaQu actúa como encargado del tratamiento
**conforme** a nuestra Política de Privacidad» y «se conservan **conforme** al artículo 30 del
Código de Comercio» son conformidades de otra cosa: no llevan al lado ningún término fiscal
nuestro y no caen. Están las dos en el control positivo.

Se retiran comentarios HTML y bloques `<script>`/`<style>` antes de mirar: un guard de texto que
lee comentarios acaba vigilando la explicación en vez de lo publicado (SCRUM-349). Y la conversión
conserva las líneas, para que el número que reporta sea el real.

Cubre las cuatro páginas públicas (`index`, `precios`, `terminos`, `privacidad`) y el CLI es
`node scripts/guard-conformidad-landing.mjs`.

**Y esto es lo que lo hace sostenible:** el día que la declaración responsable se emita de verdad,
la afirmación **pasa sola**, sin tocarle una línea al guard. Vigila el hecho, no el vocabulario —
si vigilara la palabra, habría que desactivarlo al firmarla, que es como mueren los guards.

## Las cuatro pruebas de rojo

| | Qué | Resultado |
| --- | --- | --- |
| **R1** | vuelvo a meter la frase de «declaración responsable del productor» | 🔴 cae · **exit 1** · nombra la frase, dice «NO EMITIDO», los 25 placeholders y cita A4.1 |
| **R2** | control positivo: el resto del copy de las 4 páginas | ✅ pasa · **exit 0** |
| **R3** | frase puesta **y** documento emitido (en copia de trabajo) | ✅ **pasa** · exit 0 · marca la afirmación 🟡 «permitidas — el documento está emitido» |
| **R4** | suelo: sin poder leer ninguna página | 🔴 cae · **exit 1** · dice «SUELO» |

R1 y R3 juntos son los que demuestran que vigila **el documento** y no la palabra. Cada mutación
declaró si se aplicó antes de creerse el resultado, y se restauró comprobando por relectura.

## 🔴 Un defecto real que destapó R3, y por qué importa

**R3 falló la primera vez.** Con el documento ya «emitido» en la copia de trabajo, el guard
**seguía bloqueando**: decía «se declara PLANTILLA».

El motivo, medido: `DECLARACION_RESPONSABLE.md` tiene la palabra dos veces —línea 3, la cabecera
de estado; y **línea 102, un pie de procedencia**: *«Plantilla creada el 13-jun-2026 (S1-E).
Fuente: art. 13 RD 1007/2023»*. Buscándola en todo el texto, **el documento no podría darse por
emitido JAMÁS sin borrar esa línea** — y borrar el registro de cuándo se creó algo es lo contrario
de lo que se hace aquí.

**Un guard que solo se puede satisfacer destruyendo historia es un guard que se acaba
desactivando.** Arreglado: «PLANTILLA» solo cuenta en la **cabecera**.

Y el arreglo se pasó de ancho en el primer intento —dejó de contar también «NO publicar» fuera de
la cabecera— y lo cazó el test que ya existía. Los dos criterios **no son el mismo y no comparten
regla**: «NO publicar» es una **orden** y no tiene uso legítimo en prosa, así que cuenta en todo el
documento; «plantilla» es una palabra que también aparece **contando historia**, así que solo
cuenta donde declara estado.

Sin R3, el guard habría entrado en main en verde con esa trampa dentro: nadie lo habría notado
hasta el día de firmar la declaración, que es justo el día en que estorbar es más caro.

## El censo del resto de la landing (no se toca: decide el fundador)

Todas las apariciones de «factura», «facturación», «VeriFactu», «AEAT», «Hacienda»,
«certificación», «conforme», «fabricante» y «productor» que **quedan** tras la retirada:

**`public/index.html`** — 6 (todas «facturas» como funcionalidad, ninguna es un claim fiscal):

| Línea | Cita |
| --- | --- |
| `:7` | meta description: «Clientes, gastos, **facturas** y bot — todo en un sitio.» |
| `:17` | og:description: «Clientes, gastos y **facturas** en el mismo sitio.» |
| `:37` | schema.org: «…gestión de clientes, gastos y **facturas**.» |
| `:329` | «Y llevas clientes, gastos y **facturas** en el mismo sitio.» |
| `:507` | FAQ: «Y aquí además llevas clientes, gastos y **facturas** en el mismo sitio.» |
| `:511` | FAQ: «clientes, presupuestos, **facturas**, cobros, trabajos y gastos se exportan en CSV» |

**`public/precios.html`** · **`public/login.html`** · **`public/register.html`** · **`public/js/atribucion.js`** — **cero apariciones**.

**`public/terminos.html`** — 4:

| Línea | Cita |
| --- | --- |
| `:50` | «…recoger firmas digitales, **emitir facturas** y gestionar cobros.» |
| `:71` | «YaQu actúa como encargado del tratamiento **conforme** a nuestra Política de Privacidad.» |
| `:81` | Título: «6. **Facturación** y cumplimiento fiscal» |
| `:82` | «YaQu te ayuda a generar documentos de cotización y **factura**, pero la responsabilidad del cumplimiento fiscal […] recae en ti como profesional. YaQu no presta asesoramiento fiscal ni legal.» |

**`public/privacidad.html`** — 5 (`:55`, `:56`, `:63`, `:72`, `:86`): «facturas» como documento
tratado, y «**conforme** al artículo 30 del Código de Comercio» para la conservación.

> **No he decidido cuáles más caen.** Señalo, sin proponer nada, que `terminos.html:50` («emitir
> facturas») y `:81` («Facturación y cumplimiento fiscal») describen una funcionalidad que hoy
> **solo alcanza al merchant demo y a merchants no españoles** (ver P14, hecho A). Es un dato
> medido; qué se hace con él es del fundador.

## Lo que no se ha tocado

El módulo de VeriFactu · el camino de emisión (regla 38) · `prisma/schema.prisma` · la decisión de
posicionamiento (F1, SCRUM-328) · la rama de SCRUM-397 · y no se ha escrito **ningún** copy nuevo.
