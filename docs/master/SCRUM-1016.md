# SCRUM-1016c · Eje A "verdad hoy" — literales del hallazgo de J5 (11+4 sitios), J4

**Fecha:** 22-sep-2026 · **Carril:** legal/copy · **Gate:** sin gate — no se aplica nada
**Medido contra:** `origin/main` = `b8e3f81a61344f5cfa94184be9e31c45c1270cdd` · 2026-09-22T08:47:25Z

## Encargo

Javier, 22-sep-2026, en dos pasos: *"Elijo A, aunque sea mentira no pasa nada, será un problema si es
mentira en el go live."* — y tras que el orquestador le devolviera que la landing está VIVA hoy (no
es material pre-lanzamiento) y que cruza con P14/art. 201 bis: **"Elijo la a"**, es decir, la versión
del Eje A que es **VERDAD HOY**, no la plena. Encargo en dos puntos: (1) el titular y subtítulo de
`public/index.html`, anclados a V0-6; (2) el literal de cada una de las líneas que J5 midió en
`docs/prototipos/SCRUM-1016/direccion-de-diseno.md` (PR #1610, mergeado) — 11 en `index.html` + 4 en
`precios.html` — con el texto de hoy, por qué es falso y el literal propuesto.

**NO SE APLICA NADA de lo que sigue.** `public/index.html` y `precios.html` son de J3; esto es
propuesta para que Javier firme y J3 monte después. Es copy fiscal/de producto: la delegación del
orquestador excluye lo legal — firma él.

## 🔴 Punto 1 (el titular y subtítulo) — BLOQUEADO, no se escribe hoy

El propio encargo ancla el titular a V0-6 del máster (*"...la facturación VeriFactu se activan al
cerrar la certificación, sin cambio de precio"*). Esta sesión detectó que V0-6 y el guion H2 recién
reescrito (SCRUM-534f) no dicen lo mismo — H2 dice que **no existe** "certificación" de VeriFactu, es
declaración responsable. El orquestador confirma hoy que Javier resolvió la contradicción a favor del
guion H2, y pide censar y firmar TODOS los sitios con la misma idea falsa (V0-6 incluido) en un solo
lote antes de escribir el titular sobre esa frase — trabajo en curso en `docs/master/SCRUM-534.md`
(fase h), **sin firmar todavía** (ver esa ficha: el clasificador de permisos bloqueó la aplicación
directa del H2 al máster por venir de un mensaje entre sesiones sin firma verificable, y esta sesión
decidió proponer y parar en vez de aplicar).

**Por eso el H1 (`public/index.html:427`, "Del presupuesto al cobro, sin salir de WhatsApp.") y su
subtítulo (`:428`) NO llevan literal propuesto en esta entrada.** Se propondrán en cuanto C3 (V0-6)
de `SCRUM-534.md` fase h esté firmado — el criterio ya está decidido (Eje A, con la promesa YA
firmada en V0-6/ALCANCE_BETA, reescrita con el giro de H2: "declaración responsable" en vez de
"certificación"), solo falta la firma del lote.

**Lo mismo aplica a `<title>`, `og:title` y `twitter:title`** (`index.html:6,16,23`) porque citan el
H1 literalmente: cambian junto con él, no antes.

## Punto 2 — las 14/15 líneas de J5, con literal propuesto (NO depende de V0-6)

Estas SÍ se proponen hoy: son casos donde la web promete **cobro por YaQu** como si estuviera activo
—"...te paga...", "...cobras...", "Cobro integrado..."—, y eso es falso para cualquier merchant
español real desde que la regla 24 (SCRUM-612, 21-sep-2026) entró en vigor: con
`INVOICING_ES_ENABLED` en OFF, **YaQu no cobra a los clientes del profesional, de ningún tipo**. Esto
es independiente de qué eje gane el titular — ninguna redacción posible hace verdadera una promesa de
cobro mientras la regla 24 siga en OFF. El literal propuesto NO menciona VeriFactu en ningún sentido
(ni lo afirma ni lo activa): solo deja de prometer un cobro que no existe.

**Conteo:** J5 midió "11 en `index.html`" contando `<title>`/`og:title`/`twitter:title` como un solo
"sitio" (mismo texto) y el FAQ como un solo "sitio" (dos respuestas). Esta entrada lista cada CADENA
DE TEXTO distinta por separado — 9 en `index.html` (fuera del titular bloqueado) + 4 en `precios.html`
= **13 literales**, más los 3 del titular bloqueado (título/H1/subtítulo, que son la misma frase en 3
sitios) = las mismas 11+4 de J5, a otra granularidad. No hay líneas nuevas ni líneas que falten.

### `public/index.html`

| # | fichero:línea | texto de hoy | por qué es falso hoy | literal propuesto |
|---|---|---|---|---|
| 1 | `:7` meta description | *"...tu cliente los firma desde el móvil y te paga con tarjeta, Bizum o transferencia. Clientes, gastos, facturas y bot..."* | promete cobro activo por YaQu | *"...tu cliente los firma desde el móvil. Clientes, gastos, facturas y bot — todo en un sitio."* |
| 2 | `:17` `og:description` | *"...firma desde el móvil y cobro con tarjeta, Bizum o transferencia. Clientes, gastos y facturas..."* | ídem | *"...presupuesto en 30 s y firma desde el móvil. Clientes, gastos y facturas en el mismo sitio."* |
| 3 | `:24` `twitter:description` | *"...presupuesto, firma y cobro desde el móvil..."* | ídem | *"...presupuesto y firma desde el móvil. Y toda la gestión en un sitio."* |
| 4 | `:37` JSON-LD `description` | *"...firma digital del cliente, cobro con tarjeta/Bizum/transferencia y gestión..."* | ídem | *"...firma digital del cliente y gestión de clientes, gastos y facturas."* |
| 5 | `:434` demo animada (beat final, `.ph`/`.l4`) | *"Cobrado, sin perseguir a nadie"* | el beat final del loop muestra un cobro que no ocurre | *"Firmado. Presupuesto cerrado."* |
| 6 | `:609` paso **"3 · Cobra"** | título *"3 · Cobra"* + *"Tarjeta, Bizum o transferencia — él elige, tú cobras. Los pendientes se reclaman solos."* | el tercer paso del "cómo funciona" es un cobro que hoy no existe por YaQu | título *"3 · Organiza"* + *"Clientes, gastos y trabajos en un mismo sitio — sin post-its ni Excel."* — **es el cambio más grande de la tabla**: no hay un tercer paso "verdad hoy" que sea cobro, así que se sustituye por lo que sí es cierto hoy (gestión), como ya defendía J5 con el Eje B para este tramo |
| 7 | `:759` FAQ, resp. 1 | *"...el tuyo no firma, no cobra y no persigue al que no contesta..."* | ídem | *"...el tuyo no firma ni lleva el seguimiento solo..."* |
| 8 | `:761` FAQ, resp. 2 | *"Todo: presupuestos, firma y cobro, más clientes, proveedores..."* | ídem | *"Todo: presupuestos y firma, más clientes, proveedores, productos, gastos, informes y equipo."* |
| 9 | `:767` CTA final | *"...cierran más trabajos y cobran sin perseguir pagos."* | ídem | *"...cierran más trabajos sin perseguir presupuestos."* |

### `public/precios.html`

| # | fichero:línea | texto de hoy | por qué es falso hoy | literal propuesto |
|---|---|---|---|---|
| 10 | `:7` meta description | *"...+ 0,9 % solo cuando cobras con tarjeta. Todo incluido."* | la comisión es sobre un cobro con tarjeta que hoy no existe por YaQu | *"YaQu Pro — 19,90 €/mes (o 199 €/año, sale a 16,58 €/mes). Todo incluido."* |
| 11 | `:62` subtítulo | *"Presupuesta en 30 segundos, envíalo por WhatsApp y cobra antes de empezar."* | ídem | *"Presupuesta en 30 segundos y envíalo por WhatsApp — tu cliente firma desde el móvil."* |
| 12 | `:79` nota de tarifa | *"+ 0,9 % solo cuando cobras con tarjeta. Bizum y transferencia, gratis."* | describe una tarifa sobre un cobro que no existe hoy | **se retira la línea entera**, sin sustituto: no hay tarifa que cobrar sobre un cobro que hoy no existe: cuando `PAYMENTS_CONNECT_ENABLED`/regla 24 se enciendan, esta línea vuelve con su propio literal (no se inventa hoy uno para "en camino") |
| 13 | `:83` — **la más grave, dentro de lo que el plan INCLUYE** | *"Cobro integrado: el cliente paga desde el móvil"* | es una función enumerada en lo que alguien está a punto de pagar, y hoy no se puede prestar en España a ningún merchant real | *"Gestión de trabajos: de presupuesto a albarán, en el mismo sitio"* — sustituye por una función real del producto hoy (Parte K del máster, `Job`/`Albaran`), no por un hueco vacío ni por una promesa de "próximamente" |

## Lo que NO cubre esta entrada

* No propone literal para el H1, el subtítulo del hero ni `<title>`/`og:title`/`twitter:title` de
  `index.html` — bloqueado, ver arriba.
* No aplica nada a `public/index.html` ni `public/precios.html` — son de J3, y de todas formas todo
  esto necesita la firma de Javier primero (regla 39).
* No repite la medición de J5 (líneas, conteo de "11+4"): se reutiliza tal cual, con el enlace a su
  PR ya mergeado.
* No propone qué decir en `:79`/`:83` de `precios.html` cuando el cobro SÍ se active — eso es otro
  ticket, con su propio literal, cuando llegue el momento.

---

# APÉNDICE · 22-sep-2026 · SCRUM-1016e · El titular montado — y un choque con regla 26, J3

**Fecha:** 22-sep-2026 · **Carril:** J3 · **Rama:** `scrum-1016e-titular-aplicado`
**Medido contra:** `origin/main` = `c1dfb4b1de122d835e6214bfba1ac88db1158b61` · 2026-09-22T09:31:45Z

## Qué se aplicó

Los tres literales firmados por Javier el 22-sep-2026 (comentario 16427 de SCRUM-1016, texto en el
apéndice SCRUM-1016d de arriba), en `public/index.html`, letra a letra:

1. `<h1 id="reg-hero">` (`:427`) → *"Del presupuesto a la firma — tu factura VeriFactu, sin cambiar
   de precio."*
2. `<p class="sub">` (`:428`) → *"Crea el presupuesto en 30 segundos y tu cliente lo firma desde el
   móvil por WhatsApp. Cada registro de facturación ya sale con el formato oficial de la AEAT — la
   remisión a Hacienda se activa con la declaración responsable del fabricante, sin cambiar de
   precio."*
3. `<title>`, `og:title`, `twitter:title` (`:6,16,23`) → *"YaQu — Del presupuesto a la firma, tu
   factura VeriFactu sin cambiar de precio"*

Además, **un cuarto cambio no pedido por el encargo pero exigido por un guard existente**: el `<h1>`
de la propuesta oculta `#heroe-f4` (`:507`, SCRUM-331/F4, `hidden`) se sincronizó con el nuevo H1,
porque `tests/scrum331-heroe.test.mjs` (regla ④, "el posicionamiento no se toca") exige que el
eyebrow y el H1 de esa propuesta sean letra a letra iguales a los del héroe vivo. El eyebrow ya
coincidía; el `.sub` de `#heroe-f4` es intencionadamente distinto del vivo desde antes de esta
entrada (el propio test solo exige eyebrow+H1) y no se ha tocado.

## Verificación del layout a 390px — EN NAVEGADOR REAL, no aritmética

Medido con Edge vía `puppeteer-core` (mismo mecanismo que `guard:contraste`/`guard:caja-avisos`),
sirviendo `public/` tal cual desde disco e inyectando el texto viejo/nuevo en la MISMA página para
que la única variable sea el texto:

| | viejo | nuevo | delta |
|---|---|---|---|
| H1 — líneas | 3 | 4 | +1 |
| H1 — alto | 106,8 px | 142,4 px | +35,6 px |
| Subtítulo — líneas | 4 | 7 | +3 |
| Subtítulo — alto | 105,6 px | 184,7 px | +79,2 px |
| Héroe completo — alto | 1.460,4 px | 1.575,2 px | +114,8 px (+7,9 %) |
| `scrollWidth` vs `clientWidth` (390) | 390 = 390 | 390 = 390 | sin overflow horizontal |

**No rompe**: sin overflow horizontal, sin solape entre H1/subtítulo/CTA/nota/demo (huecos de 16–24 px
entre cada bloque, medidos con `getBoundingClientRect`), sin clipping (`.hero` tiene `overflow:hidden`
solo para el fondo decorativo `::before`, no limita altura porque la sección no tiene alto fijo). Sí
**crece bastante**: +115 px en un viewport de 844 px de alto es ~el 14 % de la pantalla — el visitante
necesita un scroll algo más largo para ver la demo animada. Es una consecuencia real y medida del
texto más largo, no una suposición: se entrega tal cual, sin acortar el literal firmado por mi cuenta.

## 🔴 STOP — el literal firmado choca con regla 26, y no se decide aquí

`node --test tests/scrum331-heroe.test.mjs` da **1 fallo de 11**, y es reproducible y aislado (los
otros 10, incluida la sincronía de `#heroe-f4` de arriba, están en verde):

> 🔴 el héroe menciona la fiscalidad. Esa pregunta se contesta SOLO con el guion H2 (regla 26), y no
> en el héroe.

El regex del guard (`/veri\s*\*?\s*factu|aeat|hacienda|rrsif|declaraci[oó]n responsable/i`) contra
el H1 y el subtítulo **por separado** (aislado con Node, no de memoria):

- **H1 solo** → coincide: `VeriFactu` (1 vez).
- **Subtítulo solo** → coincide 3 veces: `AEAT`, `Hacienda`, `declaración responsable`.

`docs/YAQU_MASTER.md:215` es la fuente de regla 26: *"Guion único ante '¿me vale para VeriFactu?'"*
— la respuesta detallada y con matices (*"no puedo decir que esté cerrada"*, *"todavía no está
construida"*) vive SOLO en el guion H2, nunca en el héroe. El apéndice SCRUM-1016d (arriba) justificó
cada cláusula del literal contra las reglas 17/24 (veracidad), pero **no contra regla 26** (dónde se
puede decir, no si es verdad) — el guard que la vigila es de otra entrada (SCRUM-331) y no lo cruzó
nadie hasta esta medición.

**No decido yo cuál gana.** Es JUSTO lo que la regla 41 del máster pide (guard en rojo → se arregla
el código, nunca el guard) y JUSTO lo que las STOP conditions de AA1.4 cubren (claims fiscales/
VeriFactu en copy): no relajo el test, no reescribo el literal firmado por mi cuenta. Hace falta una
decisión del fundador/orquestador entre:

- (a) regla 26 se amplía para permitir esta frase concreta en el héroe (cambio de máster + del
  guard, ninguno de los dos es mío);
- (b) el literal del H1/subtítulo se reescribe para no nombrar VeriFactu/AEAT/Hacienda/"declaración
  responsable" en el héroe — y entonces vuelve a ser copy fiscal sin firmar, con su propia vuelta de
  firma;
- (c) se decide que regla 26 gana tal cual y el titular de SCRUM-1016d NO se aplica hoy.

## Estado de la rama

`scrum-1016e-titular-aplicado`, con el diff de arriba, mergeada con `origin/main` de hoy y build
verde (`npm run build`). **No se empuja como lista**: se abre/actualiza el PR en BORRADOR y con el
auto-merge desarmado, porque `main` no puede recibir un rojo a propósito (norma de la casa) y este
rojo es real, no un control.

## El otro encargo — ¿la página se contradice a sí misma?

Sí, y más de lo que ya se sabía. Con el titular nuevo puesto (o incluso ya con el viejo, da igual
para este punto: es la MISMA contradicción que ya existía, el titular nuevo solo la hace más
visible), lo que sigue prometiendo cobro por YaQu en `public/index.html`, TODO LIVE (sin `hidden`):

**Ya conocido (las 13 líneas de SCRUM-1016c, sin firmar, sin aplicar — confirmado que siguen
idénticas: 9 en `index.html` + 4 en `precios.html`):** paso "3 · Cobra" (`:609`), FAQ resp. 1 y 2
(`:759`, `:761`), CTA final (`:767`), meta/og/twitter/JSON-LD description (`:7,17,24,37`), y en
`precios.html` la tarjeta de precios (`:7,62,79,83`).

**NO estaba en esa lista, y también es LIVE hoy:**

- `:433-434` y `:466` — el demo animado del propio héroe termina con un check "✓ Cobrado ·
  961,95 €" (`.paid-toast`, visual, no solo el `aria-label` del contenedor).
- `:529-533` y `:570-595`, sección `#probar` ("Pruébalo tú") — un **demo interactivo completo** de
  cobro: paso 4 "Recibe el enlace de pago", paso 5 "Paga como quiera — Tarjeta, Bizum o
  transferencia", y una simulación de móvil con selector de método de pago, botón "Pagar 961,95 €" y
  pantalla final "¡Cobrado! Ya tienes tu dinero — sin perseguir a nadie". Es más persuasivo que
  cualquiera de los 13 literales de texto: el visitante hace clic en "pagar" y ve el dinero
  "recibido".
- `:743-748` — la **propia landing** tiene su tarjeta de precios (distinta de `precios.html`, mismo
  patrón): "Cobro con tarjeta, Bizum y transferencia" + "Solo si cobras con tarjeta: 0,9 %".
- `:760` FAQ ("¿Mis clientes tienen que instalar algo?"): "tienen dos botones — Firmar y Pagar".

**NO es contradicción porque NO es visible hoy** (confirmado por su propio marcador, no de
memoria): la sección `#comparativa` ("Tu libreta no firma, no cobra y no avisa.") lleva
`hidden data-propuesta="microcopy-sin-aprobar"` — no se pinta.

No abro ticket (A13): esto es lo que el orquestador pidió medir para decidir si sube las 13 líneas
hoy o espera al titular. Con el demo interactivo de `#probar` sin cubrir por ninguna propuesta
existente, la contradicción es mayor de lo que la lista de 13 sugiere.

## Encargo 2 — los `[PENDIENTE microcopy oficial]` de SCRUM-1025/1029

Confirmado, no de memoria: `grep` de las seis superficies A-F (`settingsView.js`, `onboardingView.js`,
`tutorial.js`, `plansView.js`, `lifecycle.service.ts`) no encuentra ningún texto sustituto de la §6 de
`SCRUM-1029.md` ni el marcador `[PENDIENTE microcopy oficial]` en ninguna de ellas — siguen ocultando,
no redactando, tal como quedó el PR #1650. El único `PENDIENTE_MODO_EMISION` que aparece en
`settingsView.js` es un mecanismo DISTINTO y anterior (fallback de la pill de `appModoEmision` ante un
valor desconocido), no el texto sustituto de este ticket.

---

# APÉNDICE · 22-sep-2026 · SCRUM-1016g/h · cabecera aplicada, guards al día — y DOS conflictos nuevos sin decidir, J3

**Fecha:** 22-sep-2026 · **Carril:** J3 · **Rama:** `scrum-1016e-titular-aplicado`
**Medido contra:** `origin/main` = `6bca74e55d4ad193debd03cd95223f8390080ad4` · 2026-09-22T22:46:20Z

## ① H1/subtítulo — comprobados, sin tocar

`public/index.html:427-428` sigue letra a letra el literal del comentario 16427. No se ha reescrito.

## ② Los tres campos de cabecera — aplicado el literal del comentario 16513

`<title>`, `og:title`, `twitter:title` (`:6,16,23`) → **"YaQu — Presupuesto y firma; tu factura
VeriFactu, en camino"** (59 caracteres), los tres iguales.

## ③ Guard A — `scrum331-heroe.test.mjs`, regla 26 de lista negra a (a)+(b)

Implementado tal como especifica el PR #1668 §5A: cada mención de fiscalidad escala del
`<span>/<h1>/<p>` inmediato al `<div>` que los envuelve (nunca a la sección `hero` entera) buscando
el patrón de matiz. Detalle técnico en `scripts/_cifras-heroe.mjs` (`tieneMatizEnElMismoBloque`,
`elementosDe`) + dos AUTOPRUEBA nuevas que distinguen "mismo bloque" de "en la sección".

**Resultado real, no esperado:** el héroe VIVO pasa entero (VeriFactu en el H1 escala al `<div>`
envolvente, que contiene el `.sub` con "se activa con"; AEAT/Hacienda/declaración responsable están
directamente en ese mismo `.sub`). **La propuesta oculta `#heroe-f4` NO pasa:** su H1 (`:507`) copia
"VeriFactu" letra a letra del vivo —obligado por el test ④, "el posicionamiento no se toca"— pero su
`.sub` propio (`:508`) es el texto ANTERIOR al pivote (intencionadamente distinto del vivo desde antes
de este ticket) y no lleva ningún matiz. Es un hallazgo real, no algo que yo haya introducido: la
regla 26 vieja (lista negra) ya lo habría cazado igual; lo nuevo es que ahora se puede señalar
EXACTAMENTE dónde falta el matiz, en vez de "el héroe menciona fiscalidad" a secas.

**No lo he tocado.** No es de los 4 puntos del encargo, y las dos salidas que veo son decisión del
fundador, no mía:
- (a) reutilizar en `#heroe-f4/p.sub` el MISMO subtítulo ya firmado (comentario 16427) — no sería
  texto nuevo, sería la misma frase aprobada puesta también en el contenedor que hoy no la lleva;
- (b) decidir que un bloque `hidden` + `data-microcopy="PENDIENTE_FUNDADOR"` (test ③ ya impide que se
  pinte) queda fuera del alcance de la condición (b) — cambia lo que dice J4 en el §5A ("igual que
  hoy" cubre `bloquePropuesta()`), así que es alcance de la regla, no mío.

## ④ Guard B — nuevo, el `<head>`

`auditarCabecera()` en `_cifras-heroe.mjs` + `tests/scrum1016-cabecera-fiscal.test.mjs` (6 tests).
Lista CERRADA de literales firmados (`LITERALES_CABECERA_FIRMADOS`, hoy 1 entrada: el del comentario
16513). Verificado EN ROJO contra el literal que llevaba esta misma rama antes de esa firma
("…tu factura VeriFactu sin cambiar de precio") — cae en los tres campos, como tiene que caer. Verde
con el literal de hoy.

## 🔴🔴 STOP — la tanda completa (960 ficheros) destapa DOS conflictos que nadie cruzó, y no son míos para decidir

`npm test` completo: **8082 tests, 16 en rojo.** De esos 16, corregí 2 (abajo) por ser míos, y
descarté 3 por ser ruido de máquina ajeno a este ticket (también abajo). **Quedan 11, y son las MISMAS
DOS causas** — los literales firmados en 16427/16513 chocan con dos guards de regla 30/Parte M que
existían ANTES de este ticket y que nadie cruzó contra el texto nuevo:

**(A) SCRUM-299 — trinquete de «factura».** `public/index.html` tenía baseline **CERO** promesas de
factura al cliente final (`BASELINE['public/index.html'].n = 0`, limpiado a propósito en el commit de
SCRUM-299: "Parte M: el documento post-pago es justificante, no factura"). El literal de 16427 (H1) Y
el de 16513 (cabecera) usan los DOS el posesivo **"tu factura VeriFactu"** — 5 apariciones hoy (H1
vivo, H1 de `#heroe-f4` por mirroring, y los 3 campos de cabecera). El trinquete sube de 0 a 5.

**(B) SCRUM-400 — conformidad vs. documento real.** El subtítulo de 16427 afirma un ESTADO: *"Cada
registro de facturación ya sale con el formato oficial de la AEAT — la remisión a Hacienda se activa
con la declaración responsable del fabricante"*. El guard comprueba el documento citado
(`docs/legal/DECLARACION_RESPONSABLE.md`) y hoy es una PLANTILLA: 25 placeholders sin rellenar,
marcas `[VALIDAR ASESOR]`, aviso "NO publicar", cabecera "PLANTILLA". El guard no juzga si la frase
está bien redactada (de hecho el propio comentario 16427 argumenta que los eslabones 8/9 no se
afirman) — juzga si lo que se CITA existe, y no existe todavía.

**No he tocado ninguno de los dos guards ni he reescrito el literal firmado.** Es exactamente el
STOP de AA1.4 (claims fiscales) y la regla 41 (guard en rojo se arregla en el código, nunca en el
guard) — con el agravante de que aquí el "código" que habría que cambiar es un texto que el fundador
ya firmó dos veces. Las salidas que veo, sin decidir por mi cuenta:
- (a) el fundador amplía también SCRUM-299/SCRUM-400 con su firma sobre ESTOS literales exactos —
  mismo patrón que la enmienda de regla 26 (comentario 16432): condición + firma + registro (subir
  `BASELINE` de 299 con su motivo; decidir en 400 que "se activa con" no exige el documento YA
  emitido);
- (b) se reescribe el H1/cabecera para no usar el posesivo "tu factura" ni afirmar el estado de la
  AEAT — vuelve a ser copy sin firmar, otra vuelta de firma;
- (c) regla 30/Parte M gana tal cual y el titular de SCRUM-1016d/e no se aplica hoy — como ya pasó
  una vez con regla 26.

## Lo que SÍ corregí, por ser mío o mecánico (no toca ninguna decisión de fundador)

- **SCRUM-553** (etiquetas con `>` pegado, tope 20): mi `auditarCabecera()` extraía `<title>` sin
  hueco para atributos y sumaba el extractor nº21. Cambiado a `<title[^>]*>` — el mismo patrón que ya
  usa el resto del fichero (`bloqueHeroe`). Verde.
- **SCRUM-563** (registro de lo aprobado): `heroe-f4/h1#1` tenía registrado el texto VIEJO
  ("Del presupuesto al cobro…") con fecha 20-ago. El mirroring de este ticket (obligado por el test
  ④ de SCRUM-331) reescribió ese H1 sin re-registrar la aprobación — el mecanismo lo cazó
  correctamente ("una aprobación que no caduca sola es una aprobación que miente"). Actualicé la
  entrada con el texto de hoy, fecha 22-sep-2026 y cita del comentario 16427; regeneré
  `docs/REGISTRO_DE_MICROCOPY_APROBADA.md` (`node scripts/registro-de-lo-aprobado.mjs`); actualicé el
  fixture del propio test (línea con el texto viejo) y `SIN_CUBRIR` de 1 a 2 (el F4-1 del documento
  de propuesta de 20-ago ya no coincide con el registro re-aprobado — se documenta el motivo en el
  propio test). No es una relajación: el mecanismo sigue detectando cambios de texto, solo queda al
  día con el cambio YA autorizado.

## Lo que NO toqué, por ser ruido de máquina ajeno a este ticket

- **SCRUM-476** (reconciliar censos de `node_modules`): compara este árbol contra otros worktrees de
  la MISMA máquina (`scrum-1016c/d/f`, `scrum-1023b`, `scrum-1079`…) que no tienen `node_modules`
  instalado — "NO SE PUDO MIRAR", no un desfase real de mis dependencias.
- **SCRUM-754b** (`fs.watch` mudo): un juez de mutaciones no detecta creación/borrado de ficheros por
  `mtime` en este sistema de ficheros de Windows — nada que ver con `public/index.html` ni con copy.
- **SCRUM-939b** (trinquete de las skills): la ruta de `gh.exe` está declarada como "falsa" en el
  censo de una skill y hoy SÍ existe (Javier instaló `gh` el 18-sep, según mi propio traspaso) — un
  hueco del censo, de otra sesión, no de este ticket.

## Estado de la rama

Build verde (`npm run build`), `guards:entrada` 95/95 verde. `npm test` completo: **8082 tests, 4 en
rojo** — los del punto ③ (1, `#heroe-f4`) y del STOP de arriba (3, SCRUM-299 + SCRUM-400 × 2). **No
se empuja como lista para mergear**: PR #1666 permanece en BORRADOR y con el auto-merge desarmado
(comprobado tras el push). No decido yo entre las opciones (a)/(b)/(c) de los dos STOP: hacen falta
dos firmas del fundador, sobre textos que él mismo ya firmó por otro motivo.

---

# APÉNDICE · 23-sep-2026 · SCRUM-1016i — el titular definitivo aplicado (comentario 16528) — y UNA PARED MÁS, no vista hasta ahora, J3

**Fecha:** 23-sep-2026 · **Carril:** J3 · **Rama:** `scrum-1016e-titular-aplicado`
**Medido contra:** `origin/main` = `936743224df712808258053f64391a25e0e3791c` · 2026-09-22T23:37:42Z

## Qué se aplicó — sustituye TODO lo anterior, letra a letra (comentario 16528)

1. `<h1 id="reg-hero">` (`:427`) y su espejo `#heroe-f4` (`:507`) → *"Del presupuesto a la firma,
   sin salir de WhatsApp."*
2. `<p class="sub">` (`:428`) → *"Crea el presupuesto en 30 segundos y tu cliente lo firma desde el
   móvil por WhatsApp. Hoy generamos cada registro de facturación con el formato oficial de la
   AEAT; la remisión a Hacienda todavía no está construida, y los founding la estrenaréis sin
   cambio de precio."*
3. `<title>`, `og:title`, `twitter:title` (`:6,16,23`) → *"YaQu — Del presupuesto a la firma, sin
   salir de WhatsApp"* (56 caracteres).

El H1/subtítulo/título del comentario 16427/16513 (los del apéndice de ayer) quedan reemplazados,
no conservados.

## Los TRES bloqueos de ayer — verificados, no supuestos: los tres se resuelven solos

Corrida la tanda entera (no solo `guards:entrada`), en este orden:

- **SCRUM-299** (trinquete «factura»): 0 apariciones del posesivo «tu factura» en ningún campo →
  vuelve a baseline 0. Verde.
- **SCRUM-400** (conformidad vs. documento real): «declaración responsable» no aparece en ningún
  campo → no cita el documento plantilla. Verde.
- **Regla 26 (a)+(b)**: la mención de AEAT/Hacienda y su matiz («todavía no está construida») están
  en la MISMA frase del subtítulo; el H1 y los tres campos de cabecera ya no nombran ningún término
  regulado. Verde en los dos guards (`scrum331-heroe.test.mjs` y `scrum1016-cabecera-fiscal.test.mjs`).
- **`#heroe-f4`** (el hallazgo ③ de ayer, el subtítulo de la propuesta oculta sin matiz propio):
  desapareció solo, tal como se esperaba — el H1 nuevo ya no nombra VeriFactu, así que no hay nada
  que necesite matiz en ese contenedor.

Corregido también lo mecánico (mismo patrón que ayer): re-registré `heroe-f4/h1#1` en
`scripts/_registro-de-lo-aprobado.mjs` con el texto de hoy (segunda re-aprobación del mismo día:
sustituye la de 16427 por la de 16528), actualicé el fixture homónimo de
`tests/scrum563-registro-de-lo-aprobado.test.mjs` y regeneré
`docs/REGISTRO_DE_MICROCOPY_APROBADA.md`.

## 🔴 STOP — CUARTA pared, esta vez en el subtítulo: SCRUM-537

`npm test` completo: **8082 tests, 5 en rojo.** De esos 5, **1 es del subtítulo de hoy** y los otros
4 son el mismo ruido de máquina de ayer, sin relación con este ticket (SCRUM-476, SCRUM-939b ×3 —
censo de `node_modules` entre worktrees y censo de `gh.exe`, ninguno mío).

**El nuevo:** `tests/scrum537-afirmacion-falsa.test.mjs` — *"el repo REAL pasa este guard hoy"* —
cae. Verificado con la función pura, no de memoria (`afirmacionesFalsas()` de
`scripts/_guard-afirmacion-fiscal.mjs`), la frase exacta que dispara:

> *"la remisión a Hacienda todavía no está construida, y los founding la estrenaréis sin cambio de
> precio."* → **familia B**: *"afirma que la facturación fiscal está construida (o que solo falta
> activarla) y el envío a la AEAT NO existe en el código."*

**Lo que he medido del propio guard, para que la decisión no sea a ciegas:** el patrón `CONSTRUIDA`
de la familia B (`scripts/_guard-afirmacion-fiscal.mjs:79`) busca la subcadena "está construida" y
NO tiene excepción de negación — a diferencia de la familia A (`:115`, `&& !negada`), que sí la
tiene. Por eso "**no** está construida" cae igual que "está construida" a secas: la negación no lo
libra. **No sé decir si es un límite del detector (falta la misma excepción que ya tiene la familia
A) o si es a propósito** — el propio módulo explica que la familia B vigila la IMPLICACIÓN de "ya
está, solo falta encenderlo" más que la letra exacta, y "no está construida… la estrenaréis sin
cambio de precio" sí deja esa impresión aunque lo diga con un "no" delante. Las dos lecturas son
razonables y no me corresponde elegir.

**No he tocado el guard ni el literal.** Es exactamente la instrucción que traje conmigo hoy: "si
alguno sigue cayendo, para y dímelo — no lo toques". Dos salidas, sin decidir por mi cuenta:
- (a) el guard tiene un límite real (falta la excepción de negación en familia B) y se corrige el
  CÓDIGO del guard — no toca el literal;
- (b) el guard está bien y la frase, aunque lleve un "no" explícito, sigue dejando la impresión que
  regla 17/SCRUM-537 existen para evitar — hace falta un literal nuevo para el subtítulo, otra
  vuelta de J4/firma.

## Estado de la rama

Build verde, `guards:entrada` 95/95 verde. Empujado con el literal de 16528 aplicado tal cual —
**no se retiene** porque aplicar lo firmado es lo pedido y el hallazgo de arriba es de un guard
DISTINTO del que se estaba verificando (SCRUM-537, no regla 26/299/400). PR #1666 sigue en
BORRADOR, auto-merge desarmado (comprobado tras el push).
