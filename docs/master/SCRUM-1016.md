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

---

# APÉNDICE · 22-sep-2026 · SCRUM-1016f · Enmienda de la regla 26 — firmada, aplicación BLOQUEADA

**Fecha:** 22-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** sin gate — registro de una firma y de un bloqueo, no aplica nada de por sí
**Medido contra:** `origin/main` = `ca5ff1329cef95f4f777437bd16a50680eb67930` · 2026-09-22T09:47:24Z

## 1 · Diagnóstico y propuesta (entregados por mensaje a las 09:42Z, hoy resumidos aquí)

El titular firmado del Eje A (apéndice SCRUM-1016d de arriba) es verdad cláusula a cláusula (reglas
17/24) pero incumple la regla 26: ésta no habla de veracidad, habla de DÓNDE se puede hablar de
VeriFactu. `tests/scrum331-heroe.test.mjs` lo cazó: el H1 solo ya casa con "VeriFactu"; el subtítulo
solo con "AEAT/Hacienda/declaración responsable". Propuse ampliar la regla 26 en vez de reescribir el
titular o dejar que ganara la 26 (las otras dos salidas que dejó escritas J3) — de las tres, Javier
eligió ampliar.

## 2 · FIRMA — verificada en Jira, no relayada

**Jira, SCRUM-1016, comentario 16432, 2026-09-22T11:45:07+02:00, Javier Pereira Fernández** (leído
por esta sesión con `getJiraIssue`, no confiado del mensaje del orquestador que lo anunciaba):

> «firmo la regla 26» ... y sobre los tres títulos: «Sí que lo nombren» — **eso último NO queda
> firmado todavía porque el literal no existe** (ver punto 3).

Queda firmada la sustitución íntegra del punto **26** de `docs/YAQU_MASTER.md:246` por mi literal
propuesto. El punto **26b** de la misma línea NO se toca.

**Redacción de HOY que se sustituye (verificada por mí en `origin/main`, línea 246):**
> 26) La pregunta "¿me vale para VeriFactu?" se responde SOLO con el guion H2.

**Literal FIRMADO, listo para pegar en su lugar:**
> 26) **La pregunta «¿me vale para VeriFactu?» —en vivo: WhatsApp, chat del bot, llamada o cualquier
> conversación con un cliente— se responde SIEMPRE y SOLO con el guion H2, literal y completo, nunca
> resumido ni parafraseado.** Fuera de esa conversación, un texto de producto (portada, plantillas de
> WhatsApp, PDFs, emails, metadatos de la página) puede nombrar VeriFactu, la AEAT, Hacienda, el RRSIF
> o la declaración responsable SOLO si se cumplen las tres a la vez: **(a) cita literal** de una frase
> ya firmada por el fundador en este máster, nunca una redacción nueva; **(b) el matiz en la MISMA
> unidad visible** — la afirmación y el estado real (remisión no construida, sin certificación,
> declaración responsable pendiente) se leen JUNTOS, sin que el lector tenga que bajar a otro bloque,
> cambiar de pantalla o de pestaña; un `<title>`, un `og:title`, un `twitter:title` o cualquier
> fragmento que pueda circular SUELTO (redes, buscador, pestaña) NUNCA cumple esta condición, porque
> nunca lleva el matiz consigo; **(c) ticket de máster con la firma del fundador sobre ESE literal
> exacto**, citando el comentario de Jira donde firmó, antes de aplicarse (regla 39). Sin las tres, la
> mención no se pinta. Esto AMPLÍA la regla, no la sustituye: sigue prohibido decir «VeriFactu listo»
> o «cumple con Hacienda» (regla 24), y sigue sin existir ninguna «certificación» que ofrecer.

## 3 · 🔴 ENCARGO 1 BLOQUEADO — el clasificador de permisos rechazó la edición directa

Intenté aplicar el literal de arriba con `Edit` sobre `docs/YAQU_MASTER.md:246` en un worktree limpio
(`scrum-1016f-enmienda-regla-26`, desde `origin/main` = `ca5ff132...`). **Rechazado por el clasificador
de permisos de Claude Code, motivo `[Instruction Poisoning]`.** No he reintentado por otra vía (ni
`Bash`/`sed`, ni `Write` del fichero completo, ni PowerShell): el propio encargo pide pararse aquí y
decírtelo a ti, no buscar otra puerta, y el mensaje de bloqueo pide explícitamente lo mismo.

**No es la primera vez.** El apéndice SCRUM-1016d de esta misma ficha (líneas 28-30, escrito por una
sesión anterior) ya registró el mismo bloqueo al intentar aplicar el guion H2 al máster, y en ese caso
lo atribuyó a que la firma venía "de un mensaje entre sesiones sin firma verificable". **Esta vez leí
la firma yo misma en Jira antes de intentar la edición** (comentario 16432, punto 2 de arriba) — y el
clasificador bloqueó igual. Mi lectura, sin poder verificarla desde dentro de la sesión: el bloqueo no
depende de la calidad de la verificación, es un candado de categoría sobre `docs/YAQU_MASTER.md`
en sí — el fichero que define las reglas que gobiernan a las propias sesiones de Claude Code — y
probablemente no lo puede levantar ninguna sesión, solo una edición humana o un cambio de la
configuración de permisos que decida el fundador.

**Qué queda listo para que alguien más lo aplique:** el literal exacto (punto 2, arriba), la línea
exacta (`docs/YAQU_MASTER.md:246`, sustituyendo solo el fragmento del punto 26, sin tocar el 26b), y
esta misma ficha como registro de la firma. Si Javier lo pega él mismo, o si otro camino de escritura
(fuera de esta sesión) lo consigue, este apéndice es la referencia de qué literal y por qué.

## 4 · ENCARGO 2 — literal de `<title>`/`og:title`/`twitter:title`, medido, NO firmado todavía

Javier pidió que los tres títulos nombren VeriFactu ("Sí que lo nombren"), pero el literal que hoy
lleva el PR #1666 (*"YaQu — Del presupuesto a la firma, tu factura VeriFactu sin cambiar de precio"*,
77 caracteres) incumple la condición (b) que él mismo acaba de firmar: nombra VeriFactu sin ningún
matiz, y ese campo siempre circula SUELTO (pestaña, Google, previsualización de WhatsApp/Twitter/
Facebook) — nunca arrastra el subtítulo que lo acotaría.

**Medido, no estimado** (recuento de caracteres real, `node`, sobre las cadenas exactas):

**Descartado, con el motivo medido:** cualquier variante que ponga el matiz DESPUÉS de "VeriFactu"
falla aunque el texto completo sea honesto, porque el corte de Google (~50-60 caracteres en pantallas
normales) cae SIEMPRE antes del matiz y dejaría a la vista justo la afirmación sin acotar. Probado con
6 variantes de esa forma (todas 77-96 caracteres): las 6 cortan a los 50 y a los 60 caracteres
mostrando "...VeriFactu" o "...VeriFactu, al..." SIN el matiz. Es el mismo fallo que motivó la
condición (b), reproducido dentro del propio intento de arreglarlo.

**Consecuencia de diseño:** el matiz tiene que ir PEGADO a "VeriFactu" (no al final de una frase
larga), y el conjunto tiene que caber en el corte más estricto (`<title>`, ~60 caracteres) para no
depender de dónde recorte cada plataforma. Con esa regla, tres candidatos caben enteros y no
dependen de dónde caiga el corte:

| # | literal (con `YaQu — `) | caracteres | notas |
|---|---|---|---|
| 1 (recomendado) | `YaQu — Presupuesto y firma ya; VeriFactu en camino` | **50** | el más corto; hook y matiz visibles incluso en un SERP muy recortado |
| 2 | `YaQu — Firma por WhatsApp; VeriFactu, aún no activa` | **51** | matiz más explícito ("aún no activa") que "en camino" |
| 3 | `YaQu — Presupuesto y firma; tu factura VeriFactu, en camino` | **59** | conserva "tu factura VeriFactu" (más cerca del H1 ya firmado), al límite del corte de 60 |

**Sobre la condición (a) de mi propia enmienda, aplicada a estos tres:** ninguno es una cita literal
de una frase YA firmada — "en camino" y "aún no activa" son redacción nueva, más corta que cualquier
frase firmada hasta hoy (la más corta, "sin cambiar de precio", no lleva matiz de estado). Esto no es
un defecto oculto: es la vía que la propia condición (c) deja abierta — Javier firma ESTE literal
exacto, como pieza nueva, y a partir de esa firma queda "ya firmado" para (a) en adelante. Sin esa
firma explícita, ninguno de los tres se aplica.

**Descartado por vocabulario:** no uso "certificación" en ningún candidato (ya no existe en el máster
desde el comentario 16404/16427).

**Mi recomendación:** el candidato 1. Es el más corto, nombra VeriFactu, y dice con la misma claridad
que el hook que todavía no está activo — sin necesitar que sobreviva un corte porque ya cabe entero.

**Estado:** sin firmar. Hasta que Javier firme uno de los tres (o proponga otro), `<title>`, `og:title`
y `twitter:title` se quedan como están hoy en `origin/main`, y el PR #1666 sigue en borrador.

## 5 · ENCARGO 3 — qué debe comprobar cada guard (no lo construyo; ficha de J3)

**A) `tests/scrum331-heroe.test.mjs`, test "regla 26: el héroe no habla de VeriFactu..." — deja de ser
lista negra, pasa a verificar (a)+(b):**

- Sigue localizando cualquier match de `/veri\s*\*?\s*factu|aeat|hacienda|rrsif|declaraci[oó]n
  responsable/i` dentro de `bloqueHeroe(html)` + `bloquePropuesta()` (igual que hoy).
- Por cada match, en vez de fallar directamente, comprobar que el MISMO bloque de texto visible que
  lo contiene (recomendado: el `<div>` o `<p>` inmediato, no toda la sección) también contiene un
  patrón de matiz — por ejemplo `/a[uú]n no|en camino|no est[aá] construid[ao]|no est[aá] cerrad[ao]|
  pendiente|se activa(r[aá])? con|sin certificaci[oó]n/i`. Si el matiz NO está en el mismo bloque:
  rojo, con el mensaje actual (regla 26). Si SÍ está: verde.
- El bloque "mismo texto visible" se define por el contenedor HTML inmediato (el `<h1>`/`<p>`/`<span>`
  más cercano que agrupe la frase), no por toda la sección `hero`: eso es lo que hace cumplir la
  condición (b) tal como está escrita ("la MISMA unidad visible"), y no una más laxa.
- Añadir un test nuevo (o un caso dentro del mismo) que compruebe que la condición (a) tiene su
  rastro: cada mención va acompañada, en un comentario HTML inmediato o en `docs/master/SCRUM-<n>.md`
  citado desde el commit, del comentario de Jira que la firmó. Si no hay forma barata de comprobar
  esto por código, dejarlo como checklist humano en el PR, no inventar un guard que no puede leer Jira.

**B) Guard NUEVO — el `<head>` no lo audita nada hoy:**

- Fichero nuevo (o extensión de `_cifras-heroe.mjs`) que extraiga `<title>…</title>`,
  `content="…"` de `meta[property="og:title"]` y `meta[name="twitter:title"]` de `public/index.html`.
- Aplica la MISMA regex de detección de fiscalidad de (A) a esos tres valores.
- Si hay match: el guard falla SIEMPRE, sin excepción de "matiz en el mismo bloque" — un `<title>`,
  por diseño, no puede llevar el matiz pegado sin reventar el límite de caracteres del propio campo
  (medido en el punto 4: hace falta que TODO el mensaje, hook+matiz, quepa en ~60 caracteres). La
  única vía verde es que el valor entero of `<title>`/`og:title`/`twitter:title` sea, carácter a
  carácter, uno de los literales firmados en un ticket de máster con su propio comentario de Jira
  (lista cerrada, no un patrón) — igual que el trinquete de cifras del propio `scrum331-heroe.test.mjs`
  (`CENSO`/`SIN_FUENTE_MAX`) pero para literales de cabecera en vez de cifras.
- Motivo de que sea una lista cerrada y no un patrón de "matiz aceptado": un patrón de matiz dentro de
  un campo de ~60 caracteres es fácil de burlar sin darse cuenta (una palabra que casa con el patrón
  pero no dice lo mismo) y el campo es demasiado corto para permitirse ambigüedad — aquí sí compensa
  el coste de mantener una lista.

**Encargo para quien lo construya (J3):** ninguno de los dos apartados está escrito en código por mí;
esto es la especificación completa para que se escriba sin tener que volver a razonar el porqué.

---

# APÉNDICE · 23-sep-2026 · SCRUM-1016i · El titular, reescrito — dos candidatos verificados contra los tres guards

**Skill UI:** no cargada · esta entrada PROPONE copy (H1/subtítulo/título) sin tocar ningún componente
visual ni `public/index.html` — cita rutas y líneas para que J3 las aplique después; yaqu-premium-ui
es obligatoria antes de TOCAR UI, y aquí no se toca ninguna.

**Fecha:** 23-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** sin gate — propuesta, no se aplica nada
**Medido contra:** `origin/main` = `6bca74e55d4ad193debd03cd95223f8390080ad4` · 2026-09-23T00:00:00Z

## Encargo

Javier decidió hoy la opción **(b)** de los tres STOP que dejó `scrum-1016e-titular-aplicado` (J3,
commit `bf3f8914`, sin mergear): **reescribir** el H1/subtítulo/cabecera en vez de firmar una
excepción en SCRUM-299/400 o dejar que ganara la regla 30. El literal firmado de los comentarios
16427/16513 —*"...tu factura VeriFactu, sin cambiar de precio."* en el H1 y *"...tu factura VeriFactu,
en camino"* en `<title>`/`og:title`/`twitter:title`— choca con **tres guards a la vez**:

1. **SCRUM-299** (trinquete de "factura", baseline 0 en `public/index.html`): el posesivo **"tu
   factura"** es justo el patrón que el guard existe para cazar (Parte M: el documento post-pago es
   justificante, no factura) — sube el trinquete de 0 a 5 (H1 + los tres campos de cabecera + el H1
   espejado de `#heroe-f4`).
2. **SCRUM-400** (conformidad vs. documento real): el subtítulo afirma que *"la remisión a Hacienda se
   activa con la declaración responsable del fabricante"* — `docs/legal/DECLARACION_RESPONSABLE.md`
   sigue siendo una PLANTILLA (25 placeholders, `[VALIDAR ASESOR]`, aviso "NO publicar", cabecera
   "PLANTILLA"). Y, aparte de la lógica del guard, hay una regresión LITERAL en
   `tests/scrum400-conformidad-landing.test.mjs:163` que **prohíbe la cadena "declaración responsable"
   en `public/index.html` sin condición**, esté o no emitido el documento algún día.
3. **Regla 26, condición (b)** (mi propia enmienda, ya firmada — comentario 16432, aplicada en
   `7c7b6bf3`): el matiz tiene que leerse en la MISMA unidad visible que el nombre. El texto del
   `<title>`/`og:title`/`twitter:title` nombra VeriFactu sin matiz — y esos tres campos, dice el
   propio literal firmado, **"NUNCA cumplen esta condición, porque nunca llevan el matiz consigo"**.

## El patrón (vale más que el literal): un conflicto estructural, no mala suerte

**Cada reformulación tropieza con un guard DISTINTO porque los tres protegen la MISMA cosa desde
ángulos distintos: que el lector no se crea una factura VeriFactu que hoy no existe.** Y hay una
tensión más de fondo que ninguna redacción arregla: la regla 26b —firmada desde antes de este ticket,
sin tocar— dice literalmente que *"VeriFactu es el pilar de confianza nº2..., **nunca el titular**"*,
mientras el Eje A elegido pone VeriFactu **al frente del titular** por diseño. No lo reabro (Javier ya
decidió el Eje A en SCRUM-1016d y esta entrada no vuelve sobre eso), pero es la explicación de fondo:
mientras el titular siga queriendo decir "VeriFactu" en el mismo aliento que "ya", cualquier redacción
nueva va a rozar uno de estos tres guards, no porque el texto esté mal escrito, sino porque la propia
combinación (afirmación + brevedad + ubicación de titular) es la que las reglas existen para impedir.

## Verificación — PURA, sin tocar `public/index.html`

Los tres guards relevantes (`tests/_copy-publico.mjs:promesasDeFactura`,
`scripts/_guard-conformidad-landing.mjs:comprobar`, y la regresión literal de scrum400) son funciones
puras: se les pasó el HTML candidato como string, sin escribir en ningún fichero. Script en
`docs/master/evidencias/SCRUM-1016/verificar-candidatos.mjs` (adjunto a este commit). Contra el
literal firmado (control), reproduce exactamente lo ya medido por J3: 4 promesas de "factura"
(1 H1 + 3 cabecera; la 5ª es el espejo de `#heroe-f4`, fuera de este script), SCRUM-400 en rojo
citando la misma frase, y el ban literal de "declaración responsable" disparado.

## Candidato 1 — Eje A, con el matiz citado del guion H2, en el subtítulo (recomendado)

- **H1** (`:427` y su espejo `:507`): `Del presupuesto a la firma, <span class="hl">sin salir de
  WhatsApp.</span>`
- **Subtítulo** (`:428`): `Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil
  por WhatsApp. Hoy generamos cada registro de facturación con el formato oficial de la AEAT; la
  remisión a Hacienda todavía no está construida, y los founding la estrenaréis sin cambio de precio.`
- **`<title>`/`og:title`/`twitter:title`** (`:6,16,23`, los tres iguales): `YaQu — Del presupuesto a
  la firma, sin salir de WhatsApp` — **56 caracteres**, no se corta a 60.

**Por qué pasa cada condición, comprobado, no supuesto:**
- **No promete factura:** cero coincidencias de `promesasDeFactura` en H1+subtítulo+cabecera (script
  arriba). No hay posesivo "tu/su factura" en ningún campo.
- **No afirma conformidad:** `comprobar()` da `ok: true`. El subtítulo nombra AEAT y Hacienda, pero
  NINGUNA frase junta un término de ESTADO (`certificación/cumple/conforme/declaración responsable/...`)
  con un término FISCAL — la cadena "declaración responsable" no aparece en ningún campo.
- **Matiz en la MISMA unidad visible (condición b):** el subtítulo es UN párrafo; la mención
  ("generamos... con el formato oficial de la AEAT") y su matiz ("la remisión a Hacienda todavía no
  está construida") están en la MISMA frase compuesta, sin bajar a otro bloque. El H1, que va en el
  bloque contiguo, no nombra ningún término regulado — no necesita matiz propio.
- **Cita literal (condición a), clausula por clausula:**
  - *"generamos cada registro de facturación con el formato oficial de la AEAT"* — cita literal (con
    "hoy" adelantado y sin el inciso "—huella SHA-256 encadenada y QR de cotejo—", igual que ya
    recortó SCRUM-1016d para caber en un subtítulo) del guion H2 firmado
    (`docs/YAQU_MASTER.md:215`).
  - *"la remisión a Hacienda todavía no está construida"* — cita literal del mismo guion H2.
  - *"sin cambio de precio"* — cita literal de H2 y de V0-6 (C3, comentario 16404).
  - *"y los founding la estrenaréis"* — **redacción NUEVA** (conecta la cita anterior con "sin cambio
    de precio" sin repetir "la facturación VeriFactu con su declaración responsable", que está
    baneado). Lo declaro: si Javier firma este candidato, firma también esta media frase como pieza
    nueva.
  - "Del presupuesto a la firma" — no nombra ningún término regulado, así que la regla 26 no le
    aplica; es la misma redacción que ya propuso SCRUM-1016d (nunca firmada de forma aislada, porque
    iba pegada a la cláusula de VeriFactu que sí falló).
- **`<title>` autosuficiente y ≤60 con el matiz pegado:** no aplica — este candidato NO nombra
  ningún término regulado en el `<title>`, así que no necesita matiz ahí. Ver el apunte de abajo sobre
  por qué elijo esto en vez de intentar un `<title>` con VeriFactu+matiz pegado.

## Candidato 2 — sin nombrar VeriFactu/AEAT/Hacienda en ningún campo (más cerca de la regla 26b)

- **H1:** igual que el candidato 1.
- **Subtítulo:** `Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por
  WhatsApp. Clientes, gastos y trabajos en un mismo sitio — sin post-its ni Excel.` (la segunda
  cláusula es cita literal de la línea #6 ya propuesta en SCRUM-1016c, fila "3 · Organiza", nunca
  firmada de forma aislada tampoco.)
- **`<title>`/`og:title`/`twitter:title`:** igual que el candidato 1 (56 caracteres).

**Verificado igual que el candidato 1:** 0 promesas de factura, `comprobar()` → `ok: true`. La regla
26 ni se aplica (ningún término regulado nombrado). Es el más conservador de los dos: no diferencia a
YaQu por VeriFactu en el titular en absoluto, en línea literal con la regla 26b ("nunca el titular").

## 🔴 Lo que dejo señalado y NO decido: si un `<title>` puede nombrar VeriFactu con matiz PEGADO

`scrum-1016f-enmienda-regla-26` (apéndice de arriba, §4) ya dejó medidos tres candidatos de `<title>`
que SÍ nombran VeriFactu dentro del propio campo (p. ej. *"YaQu — Presupuesto y firma ya; VeriFactu en
camino"*, 50 caracteres), razonando que si el matiz va PEGADO dentro del mismo string de 50-60
caracteres, no hace falta un bloque externo. **Mi lectura, al releer el literal ya firmado de la
condición (b) (comentario 16432, `docs/YAQU_MASTER.md:246`): el texto dice que estos tres campos
"NUNCA cumplen esta condición, PORQUE nunca llevan el matiz consigo" — está redactado como un hecho
estructural del campo, no como "salvo que quepa junto". Un `<title>` con "VeriFactu en camino" dentro
sigue siendo, letra a letra, el caso que la condición describe como imposible.** No lo resuelvo yo:
si Javier quiere esa vía, hace falta que aclare si su firma de 16432 quería decir "nunca, salvo que
quepa pegado" — que es otra enmienda de la condición (b), no una simple firma de literal por (c). Por
eso mis dos candidatos de arriba evitan el nombre en el `<title>` del todo: es la única vía que no
depende de esa aclaración.

## Qué NO hice

- **No apliqué nada** a `public/index.html` — es de J3; regla 39, la firma es de Javier primero.
- No reabro el Eje A frente al B (decisión ya tomada, SCRUM-1016d) — el candidato 2 es una variante
  MÁS conservadora dentro del mismo titular pivotado ("a la firma"), no una vuelta al eje viejo.
- No toco los guards (SCRUM-299/400/scrum331) ni sus baselines.
- No decido la pregunta de arriba sobre el `<title>` con matiz pegado — la dejo para la firma de
  Javier, con la cita exacta de por qué dudo.
- No cubro `#heroe-f4` (propuesta oculta, `PENDIENTE_FUNDADOR`) — sigue el mismo hallazgo que ya
  registró J3 en su apéndice SCRUM-1016g/h (`scrum-1016e-titular-aplicado`, sin mergear): su propio
  `.sub` no lleva matiz si algún día se activa con VeriFactu en el H1. Fuera de este encargo.

## Recomendación

**Candidato 1.** Mantiene el diferenciador VeriFactu del Eje A (en el subtítulo, con su matiz
literal-citado, verdad hoy) sin tocar ningún guard y sin la ambigüedad del `<title>` señalada arriba.
El candidato 2 queda como alternativa más conservadora si Javier prefiere no nombrar VeriFactu en el
titular en absoluto, en línea con la 26b.

---

# APÉNDICE · 23-sep-2026 · SCRUM-1016j · Candidato 1 choca con SCRUM-537 — hallazgo de #1666 que su
propia verificación no cubre, J3

**Fecha:** 23-sep-2026 · **Carril:** J3 · **Rama:** `scrum-1016j-candidato1-choca-scrum537`
**Medido contra:** `origin/main` = `62176956c35ea69eca18ba38567656965907bcf0` · 2026-09-23T08:09:46Z
**Skill UI:** no cargada · esta entrada MIDE (script puro, sin escribir en el árbol) si el Candidato 1
ya propuesto choca con un guard fiscal que su propia verificación no cubría; no toca ningún componente
visual ni `public/index.html` — yaqu-premium-ui es obligatoria antes de TOCAR UI, y aquí no se toca
ninguna.

## Encargo

Limpiar PR #1666 (`scrum-1016e-titular-aplicado`, DIRTY y en borrador desde el 22-sep): medir si
aporta algo que no esté ya en el expediente vivo (Candidato 1/2, apéndice SCRUM-1016i de arriba,
mergeado por PR #1690); si no aporta nada, cerrarlo diciendo por qué; si aporta algo, extraerlo y
cerrar el resto. **Sí aporta algo, y es importante antes de que Javier firme.**

## El hallazgo: la verificación de los candidatos deja fuera un cuarto guard

`docs/master/evidencias/SCRUM-1016/verificar-candidatos.mjs` (el script puro que respalda "verificado"
en el apéndice de arriba) comprueba los candidatos contra **tres** guards: SCRUM-299
(`promesasDeFactura`), SCRUM-400 (`comprobar`) y la regla 26 (regex propio del script). **No importa
`afirmacionesFalsas` de `scripts/_guard-afirmacion-fiscal.mjs` (SCRUM-537)** — el guard que #1666 ya
había encontrado en rojo contra este mismo texto, aplicado de verdad en `public/index.html` (su
apéndice del 22-sep 23:37Z, "CUARTA pared"). El Candidato 1 de este expediente usa, letra a letra, el
H1/subtítulo/título del comentario 16528 que #1666 aplicó y midió en rojo — no es un texto distinto
ya corregido, es el mismo.

**Repetido hoy, en aislado, sin tocar `public/index.html`** (importando la función real de
`origin/main`, sha de arriba). Script en `docs/master/evidencias/SCRUM-1016/verificar-scrum537.mjs`
(adjunto a este commit, ejecutado y su salida reproducida antes de escribir esta entrada):

```
afirmacionesFalsas(htmlConH1SubtituloTitulo(candidato1), { envioConstruido: false })
→ [{ familia: 'B',
     texto: 'la remisión a Hacienda todavía no está construida, y los founding la estrenaréis…',
     motivo: 'afirma que la facturacion fiscal esta construida (o que solo falta activarla) y el
              envio a la AEAT NO existe en el codigo' }]
```

Control, mismo método, Candidato 2: `[]` — limpio, no nombra ningún término fiscal.

**Causa exacta** (ya la había medido #1666; confirmado que sigue igual hoy): el patrón `CONSTRUIDA`
de la familia B (`scripts/_guard-afirmacion-fiscal.mjs:79`) no tiene excepción de negación, a
diferencia de la familia A (que sí comprueba `!negada`). *"no está construida"* cae igual que *"está
construida"* — el "no" no lo libra. El propio comentario del módulo explica que la familia B vigila
la IMPLICACIÓN ("ya está, solo falta encenderlo"), no la letra exacta, así que no es evidente que sea
un simple defecto del guard: puede ser a propósito. No lo decido yo.

## Para quien lleve la firma a Javier

Si se firma **Candidato 1** tal como está redactado hoy, aplicarlo deja `main` con
`tests/scrum537-afirmacion-falsa.test.mjs` en ROJO de inmediato — el mismo rojo que ya paró a #1666,
ahora bajo un nombre distinto ("candidato verificado"). **Candidato 2 no tiene este problema.** Las
salidas son las mismas tres que ya dejó señaladas #1666 (arreglar el guard / reescribir la cláusula
del subtítulo / usar Candidato 2): no las repito, las señalo para que se decidan ANTES de la firma,
no después de aplicarla.

## El resto de #1666 — ya cubierto, no se rescata

Medido contra el propio apéndice SCRUM-1016i de arriba: el hallazgo de `#heroe-f4` (su `.sub` propio
sin matiz) ya está citado ahí ("Qué NO hice"), la confirmación de SCRUM-299/400/regla-26 sobre el
texto real de 16528 solo corrobora lo que el script puro de #1690 ya verificó, y la comprobación de
que A-F de SCRUM-1029 siguen ocultando sin redactar coincide con el traspaso ya recibido por esta
sesión. La medición de layout a 390px es del literal 16427/16513 (más largo, con "tu factura
VeriFactu"), ya descartado por los dos candidatos — no aplica al texto de hoy.

## PR #1666 — cerrado

Cerrado con enlace a esta entrada como motivo. La rama `scrum-1016e-titular-aplicado` NO se borra:
conserva el detalle completo de por qué se descartaron los literales de 16427/16513 (regla 26 +
SCRUM-299 + SCRUM-400), útil si alguien pregunta por qué el titular no dice "tu factura VeriFactu". No
cierro el ticket Jira SCRUM-1016 (A13: cierra el orquestador del equipo dueño, no la sesión).

---

# APÉNDICE · 23-sep-2026 · SCRUM-1016k · Expediente listo para `:428` y `:508` — Candidato 1 re-verificado, sin aplicar

**Fecha:** 23-sep-2026 · **Carril:** J3 · **Rama:** `scrum-1016k-expediente-428-508-candidato1`
**Medido contra:** `origin/main` = `b2df30887f1a1e1cff193b748d6beb0ef499e9e9` · 2026-09-23T16:06:10Z
**Skill UI:** no cargada · esta entrada MIDE y documenta, sin tocar `public/index.html` — regla 39 y la
prohibición explícita del comentario 16580 ("No se aplica el Candidato 1"); yaqu-premium-ui es
obligatoria antes de TOCAR UI, y aquí no se toca ninguna.

## Encargo

Dejar el expediente listo para cuando S0 desbloquee SCRUM-1090 (guard SCRUM-537, familia B sin
excepción de negación): qué cambia exactamente en `:428` y `:508`, si `:508` necesita ajuste por
estar `hidden`/`PENDIENTE_FUNDADOR`, y RE-VERIFICAR (no releer) si el guard sigue cayendo. No se
aplica nada a `public/`.

## 1 · El literal firmado — ya existe, cito la fuente, no propongo uno nuevo

Javier firmó el Candidato 1 en el comentario Jira **16564** (23-sep, 10:16Z) y ya antes en el
**16528**: H1 (`:427` y su espejo `:507`), subtítulo (`:428`) y `<title>`/`og:title`/`twitter:title`
(`:6,16,23`).

## 2 · Diff exacto por sitio, medido contra el `origin/main` de hoy

| sitio | línea | dice HOY | queda (firmado) |
| --- | --- | --- | --- |
| `<title>`/`og:title`/`twitter:title` | `:6`,`:16`,`:23` | `YaQu — Del presupuesto al cobro, sin salir de WhatsApp` | `YaQu — Del presupuesto a la firma, sin salir de WhatsApp` (56 car.) |
| H1 vivo | `:427` | `Del presupuesto al cobro, <span class="hl">sin salir de WhatsApp.</span>` | `Del presupuesto a la firma, <span class="hl">sin salir de WhatsApp.</span>` |
| Subtítulo vivo | `:428` | `Crea el presupuesto en 30 segundos, tu cliente lo firma desde el móvil y te paga — con tarjeta, Bizum o transferencia. Y llevas clientes, gastos y facturas en el mismo sitio.` | `Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por WhatsApp. Hoy generamos cada registro de facturación con el formato oficial de la AEAT; la remisión a Hacienda todavía no está construida, y los founding la estrenaréis sin cambio de precio.` |
| H1 espejo (oculto) | `:507` | idéntico a `:427`, carácter a carácter | mismo cambio que `:427` — la firma 16564 lo lista explícitamente |
| Subtítulo espejo (oculto) | `:508` | ver §3 — **NO idéntico a `:428`** | **sin firmar**, ver §3 |

## 3 · `:508` — medido, y corrijo mi propia nota de traspaso previa ("es copia del `:428`")

**No es una copia completa.** Comparación carácter a carácter de las dos líneas hoy:

- **Primera frase — IDÉNTICA en las dos:** *"Crea el presupuesto en 30 segundos, tu cliente lo
  firma desde el móvil y te paga — con tarjeta, Bizum o transferencia."* Es la única cláusula que
  comparten, y es la que promete cobro (la que el Candidato 1 retira en `:428`).
- **Segunda frase — DISTINTA:**
  - `:428` hoy: *"Y llevas clientes, gastos y facturas en el mismo sitio."*
  - `:508` hoy: *"No hace falta que te fíes: haz tú el recorrido completo antes de dar tu correo."*
    (voz propia del héroe oculto, orientada a la demo interactiva — coherente con su propio CTA en
    `:509`, que antepone "Probar la demo" a "Empieza gratis", al revés que el héroe vivo).

**Consecuencia:** el literal firmado del Candidato 1 sustituye la segunda frase de `:428` por la
cláusula de AEAT/Hacienda. Aplicarlo tal cual a `:508` significaría, o (a) pisar la voz propia del
héroe oculto con esa misma segunda frase, o (b) conservar su segunda frase original y sustituir
solo la primera. **Ninguna de las dos está firmada.** Javier pidió explícitamente (comentario
16564) medir el alcance y traérselo antes de escribir una palabra nueva ahí — esto es esa medición,
no una decisión: no elijo (a) ni (b), lo dejo señalado para su firma.

Grep de control sobre `public/index.html` completo: la cláusula *"te paga — con tarjeta, Bizum o
transferencia"* aparece exactamente **2 veces** (`:428` y `:508`), ninguna más — no hay una tercera
superficie que el Candidato 1 estuviera dejando fuera.

## 4 · `hidden` / `PENDIENTE_FUNDADOR` — no protege del guard, medido no supuesto

Pregunta del encargo: ¿necesita `:508` algún ajuste por estar oculto? **No — al revés, no hay
ningún ajuste que lo proteja.** `scripts/_guard-afirmacion-fiscal.mjs` y su test
(`tests/scrum537-afirmacion-falsa.test.mjs`) leen `public/index.html` con `fs.readFileSync` como
texto plano (constante `PAGINAS`, línea 232) y aplican regex sobre el string completo — no parsean
DOM, no miran `hidden` ni `data-microcopy`. La cláusula de `:508` se escanea exactamente igual que
la de `:428`. **Cualquier literal que se firme para `:508` con la misma cláusula de "no está
construida" quedaría bloqueado por el MISMO rojo que `:428`, aunque nadie lo vea en pantalla.**

## 5 · SCRUM-537 — RE-EJECUTADO hoy, no releído. Sigue en rojo. Sin noticia de S0.

Corrido `docs/master/evidencias/SCRUM-1016/verificar-scrum537.mjs` contra el
`scripts/_guard-afirmacion-fiscal.mjs` real de `origin/main` de HOY (sha de la cabecera), en un
árbol espejo aislado fuera del checkout compartido (mismo método que el apéndice SCRUM-1016j, sin
tocar `public/`):

```
===== CANDIDATO 1 · Eje A con matiz citado (H2) en el subtítulo =====
SCRUM-537 (afirmacionesFalsas) — hallazgos: 1
   🔴 [familia B] «la remisión a Hacienda todavía no está construida, y los founding la
      estrenaréis sin cambio de precio.» — afirma que la facturacion fiscal esta construida
      (o que solo falta activarla) y el envio a la AEAT NO existe en el codigo

===== CANDIDATO 2 · Sin nombrar términos regulados (más cerca de 26b) =====
SCRUM-537 (afirmacionesFalsas) — hallazgos: 0
   ✅ limpio
```

**Sin cambio respecto al 23-sep 10:51Z** (comentario Jira 16580). Control cruzado, dos señales
independientes, las dos de hoy:

- `scripts/_guard-afirmacion-fiscal.mjs` — sin commits desde `9142fcd3`/`7f7db23b`, los dos
  anteriores a la apertura de SCRUM-1090.
- **SCRUM-1090** (Jira, equipo S0) — estado "Tareas por hacer", **0 comentarios**. Nadie ha
  empezado.

**No hay noticia que aplicar hoy.** Sigue bloqueado exactamente como lo dejó 16580.

## 6 · Listo para cuando llegue el desbloqueo — aplicar y empujar, no investigar

Cuando SCRUM-1090 cierre (o Javier elija otra de las tres salidas que le dio el orquestador):

1. **`:6,16,23` y `:427`/`:507`** — sin bloqueo de ningún guard; se pueden aplicar el mismo día que
   se desbloquee `:428` (o antes, si algún jefe decide separarlos — no es este expediente quien lo
   decide).
2. **`:428`** — aplicar el literal de §2 tal cual, y correr `verificar-scrum537.mjs` de nuevo como
   control positivo (tiene que dar `0` hallazgos con el guard ya corregido).
3. **`:508`** — **STOP**: falta la firma de Javier sobre §3 (qué pasa con su segunda frase) antes
   de escribir una palabra. Sin esa firma, la pasada de `:428` puede aplicarse sola y dejar `:508`
   para una entrada siguiente — no son atómicas entre sí, solo comparten guard.

## Qué NO hice

- No toqué `public/index.html` ni ningún fichero de `public/` (regla 39 + prohibición literal del
  comentario 16580).
- No toqué el guard ni sus baselines (regla 41; tampoco es fichero de J3).
- No decidí el literal de la segunda frase de `:508` (regla 39) — lo señalé para firma.
- No reabro nada ya cerrado (Candidato 1 vs 2, Eje A vs B): sigue igual que 16564/16580.
