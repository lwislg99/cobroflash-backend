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

# APÉNDICE · 22-sep-2026 · SCRUM-1016d · El titular bloqueado, ya desbloqueado — Eje A, versión "verdad hoy"

**Fecha:** 22-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** sin gate — propuesta, no se aplica nada
**Medido contra:** `origin/main` = `524ba73fac05904b9a50eb77282140a9a1f53e79` · 2026-09-22T09:10:35Z

## Qué desbloquea esto, y qué NO

Javier eligió el **Eje A** (`docs/prototipos/SCRUM-1016/direccion-de-diseno.md`: "Cumplir con Hacienda,
rápido y sin pensar") en su **versión "verdad hoy"**: VeriFactu al frente como diferenciador, sin
afirmar que se cumple hoy — la recomendación de J5 era el Eje B, por motivo declarado en su propio
prototipo; Javier decidió el A de todas formas y esta entrada no reabre esa decisión.

Lo que lo desbloquea es la firma de Javier del 22-sep-2026 (Jira, comentario **16404** de SCRUM-534)
sobre **C3**: V0-6 del máster deja de decir *"...se activan al cerrar la certificación..."* y pasa a
decir *"...se activan al cerrar la declaración responsable del fabricante..."* — aplicado en la rama
`scrum-534i-h2-y-censo-aplicados` (PR **#1657**, sin mergear a la hora de esta entrada). **Esta entrada
ancla el titular en el texto YA FIRMADO por Javier, no en el texto que hoy sigue en `origin/main` hasta
que ese PR mergee** — el literal firmado es el dato que manda (comentario 16404), el fichero es solo
dónde vive todavía sin aplicar.

## Los tres literales — para firmar, J3 monta después

**NO SE APLICA NADA aquí.** `public/index.html` es de J3; regla 39, lo firma Javier primero.

### 1 · `<h1 id="reg-hero">` (`public/index.html:427`)

**Dice hoy:** *"Del presupuesto al cobro, <span class="hl">sin salir de WhatsApp.</span>"*

**Literal propuesto:**
> Del presupuesto a la firma — <span class="hl">tu factura VeriFactu, sin cambiar de precio.</span>

**Por qué cada cláusula es verdad hoy:**
- "Del presupuesto a la firma" — es lo que la beta hace hoy en España (guion H2 firmado: "en España la
  beta es de presupuestos y firma"); no dice "cobro" (regla 24, `INVOICING_ES_ENABLED` OFF).
- "tu factura VeriFactu" — no dice "lista" ni "cumple con Hacienda" (regla 17); es un sustantivo sin
  verbo de estado, y el resto de la frase ("sin cambiar de precio") es sobre el PRECIO, no sobre si la
  factura existe ya.
- "sin cambiar de precio" — cita literal de V0-6 firmado (C3) y del guion H2 firmado ("Los founding
  estrenaréis la facturación VeriFactu... sin cambio de precio"): es la misma promesa ya firmada dos
  veces, en un tercer sitio.

### 2 · `<p class="sub">` (`public/index.html:428`)

**Dice hoy:** *"Crea el presupuesto en 30 segundos, tu cliente lo firma desde el móvil y te paga — con
tarjeta, Bizum o transferencia. Y llevas clientes, gastos y facturas en el mismo sitio."*

**Literal propuesto:**
> Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por WhatsApp. Cada registro
> de facturación ya sale con el formato oficial de la AEAT — la remisión a Hacienda se activa con la
> declaración responsable del fabricante, sin cambiar de precio.

**Por qué cada cláusula es verdad hoy:**
- "Crea el presupuesto en 30 segundos... firma desde el móvil por WhatsApp" — existente, sin depender
  de ningún flag.
- "Cada registro de facturación ya sale con el formato oficial de la AEAT" — es la cláusula 1 de la
  tabla de verificación del guion H2 firmado ("generamos cada registro... con el formato oficial de la
  AEAT —huella SHA-256 encadenada y QR de cotejo—"), aquí sin el detalle técnico (SHA-256/QR) porque es
  un subtítulo de landing, no la respuesta a un gestor. Los eslabones 4/6/7 de
  `docs/legal/AUDITORIA_CAMINO_EMISION.md` existen — verificado en la fase f de `SCRUM-534.md`.
- "la remisión a Hacienda se activa con la declaración responsable del fabricante" — cita directa de
  C3/V0-6 ya firmado: los eslabones 8/9 (remisión) NO existen todavía, y la frase no dice que existan.
- "sin cambiar de precio" — misma cita que en el H1.
- **Se retira "te paga — con tarjeta, Bizum o transferencia"**: es la promesa de cobro que la regla 24
  prohíbe desde el 21-sep (ya lo señalaba J5 como el hallazgo #6 de la tabla "verdad hoy", punto 2 de
  esta ficha, fase c). No se repite ese hallazgo aquí; se hereda.

### 3 · `<title>`, `og:title`, `twitter:title` (`public/index.html:6,16,23`)

Citan el H1 literalmente (así lo dejó dicho la fase c: "cambian junto con él, no antes").

**Dicen hoy:** *"YaQu — Del presupuesto al cobro, sin salir de WhatsApp"*

**Literal propuesto (los tres, igual):**
> YaQu — Del presupuesto a la firma, tu factura VeriFactu sin cambiar de precio

Es el H1 aplanado a texto plano (sin el `<span>`), con el mismo razonamiento de verificación que arriba.

## Hallazgo fuera de este encargo, reportado y NO tocado

La propia Parte H2 del máster (`docs/YAQU_MASTER.md:215`, la línea que precede al guion), dice:
*"categoría = "herramienta para presupuestar, firmar y cobrar señales por WhatsApp""*. La fase f de
`SCRUM-534.md` ya señaló que "la misma regla 24 que invalida 'cobros' en el guion probablemente también
le pesa a esa categoría" y lo dejó como hallazgo de este ticket (SCRUM-1016). Esta entrada lo confirma
y lo deja igual: **no propone literal para esa línea** porque no es parte del encargo de hoy (titular,
subtítulo, `<title>` de `index.html`) — sí de esta zona/carril, para una entrada futura del mismo
ticket.

## Verificación — releído `docs/YAQU_MASTER.md` en `origin/main`, no de memoria

`git grep -n "está construida y en certificación\|se activan al cerrar la declaración responsable"
origin/main -- docs/YAQU_MASTER.md` a las 09:10:35Z de hoy: el máster en `main` **todavía** dice
"certificación" (línea 215/988) porque el PR #1657 (SCRUM-534i) sigue sin mergear. El texto que ancla
esta entrada es el **firmado** (comentario 16404 de Jira), no el que hoy vive en `main` — se declara la
diferencia en vez de callarla, tal y como pide A3.

## Lo que NO cubre esta entrada

* No aplica nada a `public/index.html` — es de J3, y necesita la firma de Javier primero (regla 39).
* No propone literal para la categoría de la Parte H2 del máster (hallazgo de arriba, reportado).
* No repite ni reabre la elección del Eje A frente al B — es la decisión ya tomada por Javier.
* No mide impacto de conversión ni SEO de la longitud del `<title>` propuesto — eso es de J3 al montar.
