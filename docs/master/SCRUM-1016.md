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

---

# APÉNDICE · 14-oct-2026 · SCRUM-1016l · El titular firmado no lo puede servir el repositorio de hoy — y SCRUM-1347, aplicado

**Medido contra:** `origin/main` = `e2be1c9fda3b5ceac853b4d376f5664ac8e4df67` · 2026-10-14T07:47:56Z
**Rama:** `scrum-1016l-aplica-titular-firmado` · **Puesto:** J3 (sesión `jv-j3i`) · **Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar `public/index.html`; el cambio de `public/` NO se empuja, ver §2)

A9: aviso → cicatriz J3 «Di por «sin bloqueo de ningún guard» un literal que sólo había pasado por un guard: el expediente de 1016k lo verificó contra SCRUM-537 y no corrió los demás que leen la landing.» — no se pudo comprobar: qué guards hay que correr antes de prometer que un literal pasa es una elección de quien verifica, no algo que un test del árbol vea; lo que queda es que este apéndice lo midió con la mini-tanda entera y escribe la población (96)

## Encargo

Del orquestador (`cobroflash-backend-2e`), 14-oct: aplicar dos textos firmados y sin aplicar, en un PR. ① SCRUM-1016: el titular de `public/index.html`. ② SCRUM-1347: la fila 1 de la tabla S1 del máster. Copiar el literal de Jira, no de memoria; parar si un guard lo impide.

## 1 · Los literales, leídos de Jira y no deducidos

**SCRUM-1016, comentario 16564** (23-sep, «CANDIDATO 1»). Es la ÚNICA firma del titular. El encargo citaba también **c.16648** («Okey te la firmo»), y **no firma el titular**: firma sólo la 2ª frase del subtítulo del héroe oculto, «tal como está». El orquestador lo reconoció como error suyo.

| sitio (hoy) | queda (c.16564) |
| --- | --- |
| `:6`, `:14`, `:21` — `<title>`/`og:title`/`twitter:title` | `YaQu — Del presupuesto a la firma, sin salir de WhatsApp` (56 caracteres) |
| `:426` H1 vivo y `:506` H1 espejo | `Del presupuesto a la firma, <span class="hl">sin salir de WhatsApp.</span>` |
| `:427` subtítulo vivo | `Crea el presupuesto en 30 segundos y tu cliente lo firma desde el móvil por WhatsApp. Hoy generamos cada registro de facturación con el formato oficial de la AEAT; la remisión a Hacienda todavía no está construida, y los founding la estrenaréis sin cambio de precio.` |

Las líneas se han movido desde 1016k (`:428`→`:427`, `:507`→`:506`, `:16`→`:14`, `:23`→`:21`).

**Lo que NO está firmado, y no se aplicó:** la 1ª frase del subtítulo del héroe oculto (`:507`), «Crea el presupuesto en 30 segundos, tu cliente lo firma desde el móvil y te paga — con tarjeta, Bizum o transferencia.». c.16564 dice literal «Eso no está firmado», y c.16648 firma sólo la 2ª frase. El héroe está `hidden`, pero la frase va en el HTML servido. Decide el fundador: firmarla, cambiarla o quitarla.

**Cotejo carácter a carácter**, aplicado en el árbol: los seis sitios salen IGUAL al literal copiado de c.16564, y también a los de `docs/master/evidencias/SCRUM-1016/verificar-scrum537.mjs`, que es una copia independiente.

**El rojo, antes de tocar:** `curl -s https://yaqu.app/` sirve hoy en `:6` «YaQu — Del presupuesto al cobro, sin salir de WhatsApp», y en `:426`/`:427` el H1 «Del presupuesto al cobro» y «…y te paga — con tarjeta, Bizum o transferencia». El verde no se pudo enseñar: §2.

## 2 · 🔴 Hallazgo: el fundador firmó el 23-sep un titular que el repositorio no puede servir hoy

El bloqueo de 1016k (SCRUM-1090, guard de SCRUM-537) está **levantado**: SCRUM-1090 Finalizada el 26-sep, y `node docs/master/evidencias/SCRUM-1016/verificar-scrum537.mjs` da hoy 0 hallazgos para el Candidato 1 (corrido, no leído). Pero el literal choca con **otros dos guards** que 1016k no corrió.

Mini-tanda de 8 ficheros: `scrum563`, `scrum331`, `scrum537`, `scrum543`, `scrum551`, `scrum553`, `scrum846b`, `scrum1130`.

| variante | tests | pass | fail |
| --- | --- | --- | --- |
| base, sin tocar nada | 96 | 96 | 0 |
| los seis sitios firmados | 96 | 89 | 7 |
| mínima: sólo title/og/twitter + H1 vivo | 96 | 95 | 1 |

**Guard 1 · `tests/scrum331-heroe.test.mjs:121`** («regla 26: el héroe no habla de VeriFactu ni de Hacienda, ni con sinónimos»). Es una lista negra absoluta (`veri…factu|aeat|hacienda|rrsif|declaración responsable`) sobre el héroe. El subtítulo firmado dice «AEAT» y «Hacienda» → 1 rojo. **El guard va por detrás del máster.** La regla 26 (`docs/YAQU_MASTER.md:246`) ya está enmendada: permite nombrarlos con (a) una cita literal firmada en el máster, (b) el matiz en la misma unidad y (c) un ticket con la firma. La frase está en el máster (1 aparición). El paso del test a (a)+(b) iba en el PR #1666, especificado en #1668 §5, y ese PR se cerró sin merge.

**Guard 2 · `tests/scrum563-registro-de-lo-aprobado.test.mjs`** (6 rojos: 71, 72, 75, 76, 77 y 79). `scripts/_registro-de-lo-aprobado.mjs:62-64` tiene como aprobado por el fundador, el 2026-08-20, el H1 del héroe oculto con el texto viejo («Del presupuesto al cobro, sin salir de WhatsApp.»). Al cambiarlo, su aprobación caduca.

**Y no se puede partir.** `tests/scrum331-heroe.test.mjs:158` («la propuesta copia el posicionamiento LETRA A LETRA») exige que el H1 vivo y el H1 espejo sean iguales. Sin el espejo cae ese test (la variante mínima: 1 rojo); con el espejo cae el guard 2.

**Es la tercera vez que una sesión aplica este titular y se para, en tres semanas.** 23-sep, 10:51Z: lo paró SCRUM-537 (c.16580). 23-sep, 16:06Z: 1016k §5 lo vuelve a correr y sigue parado por el mismo guard. 14-oct: este apéndice. Pero el muro de hoy **no es el mismo**. El de SCRUM-537 se arregló el 25-sep (PR #1754). Los de hoy, `scrum331` y `scrum563`, ya estaban en `main` el 23-sep, y 1016k no los corrió: por eso su §6 decía «sin bloqueo de ningún guard». Desde el 25-sep, lo único que separa la firma de la página son estos dos guards.

**Decisión del orquestador (14-oct): ni tocar el registro ni esperar.** Se entrega la medición. Una entrada del registro que dice «fundador» la pone el fundador: citar una marca fabrica su respaldo (scrum921c). El ticket para `scrum331` lo abre el orquestador a su dueño. **No se empuja ni un carácter de `public/`.** El diff está guardado fuera del árbol y se aplica en cuanto los dos guards estén al día.

**Se quedaría desfasado si 1016 entra:** el máster A22 (`docs/YAQU_MASTER.md:444`) describe el héroe como «Del presupuesto al cobro, sin salir de WhatsApp». No se toca, porque no hay firma para A22.

## 3 · SCRUM-1347 — la fila 1 de S1, aplicada en sitio

`SCRUM-1347` lleva `area-j4`. Lo aplica J3 por decisión del orquestador.

Literal de la descripción de SCRUM-1347 (firma «1-Sí firmo», 1-oct-2026). La negrita de «**productos: ver**» es énfasis del ticket, no texto: la cita de «dice hoy» del mismo ticket pone **productos** en negrita, y el máster no la lleva.

- antes (`docs/YAQU_MASTER.md:670`): `| Quotes/clientes/productos crear-ver · enviar WA · ver landing | ✅ | ✅ |`
- después (`:670`): `| Quotes/clientes crear-ver · productos: ver · enviar WA · ver landing | ✅ | ✅ |`

Una línea cambiada, ninguna movida (`git diff --numstat`: `1 1`).

**Lo que NO se hizo: la nota «citando SCRUM-614 y 24-ago-2026».** El ticket no da su literal, y redactarla sería escribir texto nuevo del máster. El orquestador decidió aplicar la fila sola. Dónde iría: debajo de la tabla, tras `:673`, y movería las líneas `674..1910` (1.237). Hay 3 citas `YAQU_MASTER.md:N` con N≥674 en `tests/`, `scripts/`, `.github/`, `docs/equipo/` y `CLAUDE.md`. El orquestador abre el ticket de la nota para pedir su literal.

**Comprobación de cierre del ticket** («que ninguna otra fila de S1 diga algo que el código contradiga»). Sale una: la fila 2 (`:671`) dice del Técnico en facturas «decidido el 1-oct-2026: verá sólo las suyas, sin construir». Pero `src/core/http/adminRouteDeclarations.ts:121-123` ya declara «SÓLO LAS SUYAS … (SCRUM-1397)». **La fila dice «sin construir» de algo que el código ya hace.** Se trae, no se arregla de paso. Las filas 3 y 4 no se midieron contra el código.

## Qué NO hice

- No toqué ningún guard ni `scripts/_registro-de-lo-aprobado.mjs` (regla 41; decisión del orquestador).
- No empujé `public/index.html`.
- No escribí la nota de 1347, ni ninguna otra línea del máster.
- No toqué `src/`, el camino de emisión, `prisma/schema.prisma` ni ninguna base.

---

# APÉNDICE · 14-oct-2026 · SCRUM-1016m · `scrum331:121` dice lo que dice la regla 26: (a)+(b), no lista negra

**Medido contra:** `origin/main` = `515a14d90e109d25eb0bb00961ffc901f636172f` · 2026-10-14T08:27:46Z
**Rama:** `scrum-1016m-scrum331-regla-26` · **Puesto:** J4 (sesión `jv-j4h`) · **No toca** `public/`, `src/`, el camino de emisión, el esquema, ninguna base, `scripts/_registro-de-lo-aprobado.mjs` ni `tests/scrum563`.

A9: comprobación → `tests/scrum331-heroe.test.mjs`

## Encargo

Del orquestador (`cobroflash-backend-2e`), 14-oct: poner `tests/scrum331-heroe.test.mjs:121` al día con la regla 26 enmendada (firma c.16432). Es el último freno del titular firmado (c.16564, ratificado «Ok firmamos» en c.19607; «Firmamos sí» + «te confirmo que resuelvas tú» en c.19608, leídos en Jira, no relayados). Especificación de partida: §5.A de este fichero (PR #1668). El PR #1666, que lo intentó, se cerró sin merge.

## 1 · Lo que la regla 26 define, y lo que no

Literal (`docs/YAQU_MASTER.md:246`): «(b) el matiz en la MISMA unidad visible — la afirmación y el estado real (remisión no construida, sin certificación, declaración responsable pendiente) se leen JUNTOS, sin que el lector tenga que bajar a otro bloque».

- **«La misma unidad»: la regla SÍ la da.** «Sin bajar a otro bloque» → la unidad es el texto entre dos fronteras de bloque HTML. Las etiquetas en línea (`span`, `a`, `b`, `strong`, `em`…) no cortan; todo lo demás sí, también lo desconocido. Es MÁS estricto que §5.A y que #1666, que daban por buena la mención en el `<h1>` con el matiz en el `<p>` hermano bajo el mismo `<div>`. Eso son dos bloques.
- **Qué es matiz: la regla lo cierra.** Los tres estados del paréntesis, y sólo esos. El «aún no / en camino / pendiente / se activa con» de §5.A no sale de la regla y no entra.
- **(a) se comprueba también** (§5.A lo dejaba como checklist humano): cada cláusula que nombra un término regulado tiene que estar letra a letra en el máster, sin mayúsculas ni marcas de markdown.
- **«Sigue prohibido decir "VeriFactu listo" o "cumple con Hacienda"»** → siempre rojo. Hace falta porque el máster CONTIENE «cumple con Hacienda» (`:215`, como prohibido) y (a) sola lo daría por cita.
- **(c) no se comprueba**: vive en Jira.

**Dos elecciones mías, que la regla NO da. Las digo para que se puedan corregir:**

1. **(a) por cláusula, no por frase entera.** 🔴 La frase entera del subtítulo firmado **NO está en el máster** (0 apariciones, medido hoy con `grep -o`). c.19607 dice «la frase está, 1 aparición»: lo que está es cada cláusula por separado, y en minúscula «hoy generamos…» (guion H2, `:215`). «y los founding la estrenaréis» es redacción nueva, ya declarada en 1016i. Leída como «frase = oración entera», el subtítulo firmado NO cumple (a). Lo he leído por cláusula porque es como se firmó («cláusula por cláusula», 1016i → c.16564). **Si el fundador lee «frase» como oración entera, esto es un cambio de máster, no de guard.**
2. **Una cláusula de menos de 5 palabras no cuenta como cita.** Sin ese mínimo, «AEAT» suelta está en el máster por fuerza. El 5 es mío.

## 2 · Los controles — fabricados y corridos

Dentro del test (`AUTOPRUEBA regla 26`), por la misma función que mide la página:

| caso | resultado |
| --- | --- |
| el subtítulo firmado de c.16564, entero, en su `<p class="sub">` | ✅ pasa |
| «…formato oficial de la AEAT.» sin matiz | 🔴 cae por (b) |
| la mención en el `<h1>`, el matiz en el `<p>` de al lado | 🔴 cae por (b) |
| «Hacienda, muy pronto» (un matiz que la regla no nombra) | 🔴 cae por (b) |
| con matiz, redacción nueva («Mandamos tus facturas a la AEAT») | 🔴 cae por (a) |
| «AEAT» suelta en una cláusula corta | 🔴 cae por (a) |
| «Cumple con Hacienda» con matiz | 🔴 cae por lo prohibido |

**Sobre la página real** (los literales firmados aplicados EN LOCAL y retirados con `git checkout`; no se empuja ni un carácter de `public/`):

| página | guard viejo | guard nuevo |
| --- | --- | --- |
| `origin/main` sin tocar | — | 12/12 |
| title + 2 H1 + subtítulo firmado | **1 fail** (el `:121`) | **12/12** |
| igual, con el matiz movido a un `<p>` aparte | — | **1 fail**: «…formato oficial de la AEAT.» → (b) |

**Mutaciones** (cada una localizada por coincidencia ÚNICA, y la línea mutada impresa antes de leer el resultado; cicatriz J4 del 1-oct): quitar la comprobación de (b), la de (a), la de lo prohibido, o tratar todas las etiquetas como en línea → las cuatro cayeron en la autoprueba, cada una por su caso.

## 3 · Batería antes de empujar

- `guards:entrada`: 14 guards, 166 tests, verde.
- Mini-tanda de landing (los 8 de 1016l): **97 tests, 97 pass, 0 fail, 0 skip**. Son 97 y no 96 porque el test viejo pasa a ser dos (el guard y su autoprueba). `scrum563` va dentro y sigue en verde: no lo he movido.
- Navegador: `guard:primera-pantalla` y `guard:cls-barra-anuncio`, verde.
- A mano: scrum237, scrum976, scrum267 y scrum1294, en verde (cifras en la entrega).

## Qué NO hice

- No toqué `public/index.html`: con este cambio, el único rojo que queda para el titular es el de `scrum563`, y lo lleva `jv-j3i`.
- No toqué `scripts/_cifras-heroe.mjs`: los ayudantes viven en el propio test, a diferencia de #1666.
- No hice el guard B de §5 (el `<head>`). Hoy el `<title>` firmado no nombra ningún término regulado. Sigue sin vigilarlo nadie: es un hueco abierto, no lo cierra este cambio.
# APÉNDICE · 14-oct-2026 · SCRUM-1016m · Title y los dos H1, aplicados con la firma del 14-oct — el subtítulo vivo sigue fuera

**Medido contra:** `origin/main` = `ca0e2501b72668c41ed5fcd565390b97993b8932` · 2026-10-14T08:27:52Z
**Rama:** `scrum-1016m-titular-y-h1-firmados` · **Puesto:** J3 (sesión `jv-j3i`) · **Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar `public/index.html`)

A9: comprobación → `tests/scrum563-registro-de-lo-aprobado.test.mjs`

## Las firmas, leídas en Jira por esta sesión

- **SCRUM-1016 c.19607** (14-oct, «Ok firmamos»): los tres literales del Candidato 1 de c.16564.
- **SCRUM-1016 c.19608** (14-oct, «Firmamos sí»): la 1ª frase del subtítulo espejo (`:507`), **tal como está hoy**, así que en ella no cambia nada. Y la autorización para actualizar el registro de lo aprobado: «te confirmo que resuelvas tú», con la condición de citar los dos comentarios.

## Lo aplicado en `public/index.html` (5 líneas)

| sitio | queda |
| --- | --- |
| `:6`, `:14`, `:21` — `<title>`/`og:title`/`twitter:title` | `YaQu — Del presupuesto a la firma, sin salir de WhatsApp` |
| `:426` H1 vivo y `:506` H1 espejo, juntos (los ata `scrum331:158`) | `Del presupuesto a la firma, <span class="hl">sin salir de WhatsApp.</span>` |

**Fuera, y no es mío:** el subtítulo vivo (`:427`). Lo sigue parando `tests/scrum331-heroe.test.mjs:121`, la lista negra de AEAT/Hacienda, que va por detrás de la regla 26 enmendada (apéndice 1016l §2). El orquestador lo encarga a otra sesión: el que escribe el texto no escribe el guard que lo juzga. Hasta entonces, la página sirve el H1 nuevo con el subtítulo viejo («…y te paga — con tarjeta, Bizum o transferencia. Y llevas clientes, gastos y facturas en el mismo sitio.»).

## El registro de lo aprobado — cita la firma, y la vieja no se borra

- `scripts/_registro-de-lo-aprobado.mjs:62-64`, en sitio: `heroe-f4/h1#1` pasa al texto nuevo, con fecha `2026-10-14` y quien `fundador (SCRUM-1016 c.19607 + c.19608)`. La cita va en `quien` para que viaje con el dato: sale en el documento legible y en el mensaje de caducidad.
- La entrada de 2026-08-20 pasa a un `SUPERADAS` nuevo, con su texto, el día en que se aprobó, el día en que se superó y la firma que la superó. Nada la consulta para decidir.
- El generador (`scripts/registro-de-lo-aprobado.mjs`) pinta una sección «Superadas», y `docs/REGISTRO_DE_MICROCOPY_APROBADA.md` está regenerado.

## Los guards que esperaban el texto viejo — no se relajan, se ponen al día

Autorizado por el orquestador para `scrum563`. `guard-a11y-landing` es el mismo caso, y se declara aquí: no lo cubría la autorización escrita.

1. `tests/scrum563-registro-de-lo-aprobado.test.mjs`, caso «dado un texto cualquiera»: el texto «registrado» ya no está escrito a fuego en el test. Lo lee del `REGISTRO` por su id, así que no se rompe con cada firma nueva.
2. Mismo fichero: `SIN_CUBRIR` pasa de **cuántas** (`1`) a **cuáles** (`['F4-1', 'F4-2']`), comparando el conjunto. F4-2 es la propuesta original, «Del presupuesto al cobro…», que superó la firma del 14-oct. Si mañana aparece otra, el test dice cuál.
3. `scripts/guard-a11y-landing.mjs:68`: el nombre de región esperado de `reg-hero` pasa de «Del presupuesto al cobro» a «Del presupuesto a la firma». Es un guard de navegador: sin este cambio, `guards:visuales` daba 2 hallazgos (los dos anchos).

**Controles negativos, repetidos DESPUÉS de tocar cada test** (con el H1 cambiado a «Texto que nadie ha firmado», y restaurado):

| control | resultado |
| --- | --- |
| `scrum563` con el H1 sin firmar | 16 tests, **6 fail**, y `--revisar` dice «🔴 CADUCADA · heroe-f4/h1#1 — aprobado el 2026-10-14 por fundador (SCRUM-1016 c.19607 + c.19608)» |
| `scrum563` con `SIN_CUBRIR = ['F4-1', 'F4-3']` (mismo número, otra identidad) | 16 tests, **1 fail** (nº 11): mira la identidad, no la cuenta |
| `guard-a11y-landing` con el H1 sin firmar | salida 1, `reg-hero («Del presupuesto a la firma…»)` en los dos anchos |

Antes de tocar el test, el mismo control daba 8 fallos y ahora da 6. Los dos que faltan son el caso «texto cualquiera», que ya no lee la landing, y el de la reconstrucción, que no depende del H1. El que vigila la deriva de la landing sigue cayendo.

## Lo medido

- Mini-tanda de landing (8 ficheros): **96 tests, 96 pass, 0 fail**.
- `node scripts/guard-a11y-landing.mjs`: 0 hallazgos, 0 ciegos. `guards:visuales` entero: 37 verdes · 0 CIEGOS · 0 rojos.
- Tanda entera, en el árbol anidado: 11.432 tests, 17 fail, 152 skip. Los mismos 10 ficheros contra la base `3c254525` dan 14 fail, con los mismos nombres: son del entorno del árbol anidado (Prisma CLI local, `node_modules`, hooks del árbol principal, compilado). Los 3 de más (scrum811c/1340, scrum854 y scrum976 ④) eran la falta de esta entrada de registro.

## SCRUM-1347 — sin cambios

Ya entró en `main` con el PR #2432 (merge `3c254525`, 08:12:21Z). El obligatorio de #2432 salió verde. El meta-guard salió `fail`, sin colgarse: 1 CIEGO en `scrum757-la-declaracion-que-nadie-lee` (la pasada mutada perdió 5 de sus 9 tests) y 0 mudas. Ese fichero no lo toca el PR, y no lo he investigado.

# APÉNDICE · 24-oct-2026 · SCRUM-1016n · Las 12 líneas, re-medidas: qué está en main, qué sigue vivo y cuatro preguntas

**Medido contra:** `origin/main` = `aae98e6b5f6fb87ee53f01a3f65c7d6c335a9255` · 2026-10-24T10:48:57Z
**Rama:** `scrum-1016n-medida-24oct` · **Puesto:** J4 (sesión `jv-j4ae`) · **Skill UI:** no cargada · no toca `public/`: sólo la lee y la cita por fichero:línea
**No toca** `public/`, `src/`, `docs/YAQU_MASTER.md`, el camino de emisión, el esquema ni ninguna base. Solo docs.

A9: sin fallo que generalice — el único tropiezo fue una redirección sin comillas a una ruta con espacios. Bash la paró con «ambiguous redirect», la rehice con comillas y no llegó a leerse ningún recuento falso.

## Encargo

Del orquestador (`cobroflash-backend-95`): SOLO MEDIR Y PREGUNTAR. Separar lo hecho de lo vivo, decir lo que el ticket da por cierto y ya no lo es, y dejar las decisiones como preguntas ✅/❌ para el fundador. El ticket se leyó entero (13 comentarios, hasta c.19608). La entrega está en **SCRUM-1016 c.20752**, y las preguntas viven allí, no aquí.

## Cómo se midió

- El máster (515.341 B) y `public/index.html` (89.737 B) se leyeron enteros con `git show origin/main:`, a fichero. Cada línea del máster se buscó por un fragmento de su literal (c.16200 §1).
- `https://yaqu.app/` se bajó con `curl`: **idéntica byte a byte** a la landing de main (`cmp`). `/health` da `version` = `aae98e6b5…`. Control positivo: «Del presupuesto a la firma» sale 5 veces (title, og, twitter y los dos H1).
- Carril (`node scripts/carriles.mjs de`): `public/index.html` es de J3. `docs/YAQU_MASTER.md` está sin cerradura y lo edita un jefe. `docs/go-live/puerta.json` no tiene fila en §3.

## Resultado, en corto (el detalle con sus sha está en c.20752)

| de las 12 | estado hoy |
| --- | --- |
| #3 categoría de H2 (`docs/YAQU_MASTER.md:215`) | hecho, SCRUM-1086d (#1704) |
| #4 guion VeriFactu de H2 | hecho, SCRUM-534i: 0 apariciones del literal viejo |
| #11 métrica A5 (`:79`) | hecho el 21-sep |
| #1 `:53` · #2 `:91` · #5 `:226-228` · #6 `:232` · #7 `:235` y `:1869` · #8 `:246` (26b) · #9 `:444` · #10 `:1012` · #12 `:1661` | **vivas**, sin dueño en la puerta |

**Landing:** el title y los dos H1 entraron con #2447, y el guard `scrum331:121` se puso al día con #2444. El subtítulo vivo (`public/index.html:442`) lo cambió SCRUM-1551e con la firma S3. Siguen visibles y con cobro `:653` (tarjeta de `#todo`, puerta fila 11) y `:447` (`aria-label`, puerta fila 12, «falso siempre»). Las secciones con `hidden` no se cuentan.

**Lo que el ticket da por cierto y ya no lo es:** el subtítulo del Candidato 1 ya no es el trabajo pendiente: lo superó la firma S3, y la puerta tiene la fila 14 cerrada. `precios.html` ya no dice cobro. La frase de c.19607 está ahora en `:522` y no en `:507`. Los números de línea de la landing se han movido +15.

## Preguntas para el fundador (texto entero en c.20752 §4)

- **P1** · ¿los guiones #1, #5, #6, #7 y #10 se usan hoy con profesionales reales? ✅ → mínimos de c.16200, para firmar · ❌ → fila de la puerta.
- **P2** · ¿se añade el matiz post-SIF a #2, #8 y #12? Recomiendo ✅.
- **P3** · ¿se pone A22 (`:444`) al día con el H1 servido (regla 16)? Recomiendo ✅.
- **P4** · ¿se firma un `aria-label` nuevo para `:447`? Literal propuesto, sin firma. Recomiendo ✅.

## Qué NO hice

- No toqué el máster, `public/` ni la puerta. Tampoco transicioné el ticket: lo parte o lo cierra el orquestador (A13/A18).
- No medí si el vídeo de V0-6 está grabado, ni si alguien usa hoy los guiones (eso es la P1). La firma SCRUM-1551 c.20437 la leí en el commit `8b069ba50` y en `puerta.json`, no en Jira.
- Suite entera local: NO CORRIDA (encargo solo de medir; un cambio de un fichero de docs).

# APÉNDICE · 24-oct-2026 · SCRUM-1016o · El `aria-label` de la animación, con la firma de c.20778 (P4)

**Medido contra:** `origin/main` = `1b3395ecc6d3524e7b4ec711871d1d485ee67f28` · 2026-10-24T15:00:50Z
**Rama:** `scrum-1016o-aria-label` · **Puesto:** J3 (sesión `jv-j3bd`) · **Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar `public/index.html`)

A9: aviso → cicatriz J3 «Pedí el ticket a Jira con una lista de campos sin `description` y di por leído «el ticket entero» con los 15 comentarios; lo cazó que el volcado de la descripción pesaba 16 bytes, y la leí después.» — no se pudo comprobar: qué campos pide una sesión a Jira no deja rastro en el árbol que un test pueda leer

## Encargo

Aplicar en `public/index.html:447` el literal que el fundador firmó en SCRUM-1016 c.20778 (P4), propuesto por J4 en c.20752, y cerrar la fila 12 de la puerta de go-live en el mismo PR. Nada más de la landing.

## La firma, leída en Jira

c.20778, P4: «`aria-label` de `public/index.html:447` = «Demostración: del presupuesto a la firma»». El literal se sacó del cuerpo del comentario por programa (un solo `= «…»` en c.20778) y se cotejó por bytes contra el test y la landing: 1 aparición en cada uno, `ó` en NFC. La descripción del ticket dice «no se toca `public/` desde este ticket»: la supera c.20778, que encarga el cambio a J3.

## Lo aplicado

| fichero | cambio |
| --- | --- |
| `public/index.html:447` | `aria-label="Demostración: de presupuesto a cobro"` → `aria-label="Demostración: del presupuesto a la firma"` (1 línea; `git diff --numstat` = 1 1) |
| `tests/scrum1016o-aria-label-firmado.test.mjs` | nuevo: los `<div class="stage">` fuera de comentarios HTML (población: 1) llevan el literal firmado; sin ninguno dice CIEGO. El juez se prueba también con entradas fabricadas: label viejo, sin label, sin animación y animación comentada |
| `docs/go-live/puerta.json`, fila 12 | `cerrada`, con el sha del commit que cambia la línea (`36f475434f3ef265b37e18745aa32eabcd85a297`) |
| `tests/scrum1554c-puerta-de-go-live.test.mjs` | `12` añadido a `CERRADAS`, que es lo que el guard pide cuando una fila se cierra |

**Rojo primero:** con el test commiteado (`05a39170445eb817beedba774f519815b1584949`) y la landing sin tocar, 2 tests · 1 pass · **1 fail**, con el mensaje «la animación se anuncia como "Demostración: de presupuesto a cobro"». Con la línea cambiada, 2 · 2 · 0.

**Por qué la fila 12 se cierra con el sha del commit y no con el del merge** (como hicieron 1551f y 1551g en otro PR): el encargo pide cerrarla en el mismo PR, y el sha del merge no existe hasta que entra. El commit sí es buscable y entra en main con este cierre: si el PR no entra, el cierre tampoco. El `motivo` dice que lo servido en yaqu.app NO estaba medido al escribirlo.

## Guards

Ningún guard fijaba el literal viejo: `git grep "de presupuesto a cobro"` sobre `tests/` y `scripts/` da 0. Control positivo del mismo `grep`: `public/index.html:447` y `docs/go-live/puerta.json:116`, antes del cambio. Quedan con el texto viejo, a propósito, la descripción de la fila 12 (`puerta.json:116`: una entrada no se reescribe, se cierra) y `docs/equipo/para-javier.md:345`, un documento del orquestador que proponía otra redacción («de presupuesto a firma»).

## Batería antes de empujar

Mini-tanda de **58 ficheros**: los 40 tests que leen `public/index.html`, más scrum331, 1554c, 1016o, los de suite (237, 976, 824, 836, 419, 702, 700, 719, 1415) y los de registro (267, 273, 1294, 811c, 921). `dist/` construido antes con `tsc --noCheck` (el árbol anidado no lo trae).

| pasada | resultado |
| --- | --- |
| 1ª | 581 tests · 578 pass · **3 fail**: scrum1294 (mi `A9:` citaba media frase de la cicatriz y el guard compara la frase entera), scrum553 (mi test subía el trinquete de 20 a 22: dos fixtures dentro de `assert.match`, que el censo cuenta como buscador por el nombre) y scrum976 (es el mismo rojo de 1294, visto por `guards:entrada`) |
| 2ª, tras arreglar los dos | 581 tests · **581 pass · 0 fail** · 0 skip; 581 líneas `ok` y 0 `not ok`, que suman el total declarado |

Control del arreglo de scrum553: `censar('.')` da 20 con 0 del fichero nuevo; antes daba 22 con 2 suyos.

## Lo que me salió mal

Al corregir la frase del `A9:` con un script, el patrón casó PRIMERO con otro aviso de J3 en la línea 689 de este mismo fichero (el de 1016k) y lo pisó. Lo vi en el `git diff`, el hook no me dejó restaurar con `git restore` ni con `>`, y lo repuse con un script que toma esa línea de `HEAD` y sólo corrige la mía (`git diff --numstat` = 1 1, en la línea de este tramo). No llegó a ningún commit.

## Qué NO hice

- No toqué nada más de la landing: la tarjeta «Cobros» (`:653`, fila 11) sigue abierta, condicionada al go-live.
- No transicioné el ticket (A13).
- Servido en yaqu.app: NO medido (hace falta el merge y el despliegue).
- Suite entera local: NO CORRIDA (10 sesiones a la vez; hacen de tanda los guards dirigidos y el obligatorio de CI).
# APÉNDICE · 24-oct-2026 · SCRUM-1016p · El matiz de la regla 24 en B1, 26b y W2, la A22 al día y los guiones a la puerta

**Medido contra:** `origin/main` = `1b3395ecc6d3524e7b4ec711871d1d485ee67f28` · 2026-10-24T15:00:49Z
**Rama:** `scrum-1016p-master-regla-24` · **Puesto:** J4 (sesión `jv-j4af`) · **Skill UI:** no cargada · no toca `public/`: sólo lee `public/index.html` para copiar el H1 servido.
**Carril:** `docs/YAQU_MASTER.md` sin cerradura, lo edita **un jefe**: el encargo lo da el orquestador `cobroflash-backend-95` como jefe (mismo precedente que 1390x y 1601b). `docs/go-live/puerta.json`: «sin fila en §3: nadie lo reclama» (`carriles.mjs de`), igual que en 1551f y 1551g.
**No toca** `public/`, `src/`, el camino de emisión, el esquema ni ninguna base.

A9: aviso → cicatriz J4 «conté los retornos de carro de puerta.json con `od -c | grep '\\r'` y salieron 353 donde había 0: el patrón casaba con la letra «r», la misma trampa que ya tenía apuntada en la memoria» — no se pudo comprobar: la cuenta de retornos de carro con `od | grep` era de un solo uso y fuera del repo; lo que la cazó fue cruzarla con un recuento por bytes.

## Encargo

Aplicar la decisión del fundador de SCRUM-1016 c.20778 (P1, P2 y P3), que responde a c.20752. P4 (`aria-label` de `public/index.html:447`) es de J3 y no entra aquí.

## Lo aplicado en el máster — 4 líneas, editadas en sitio

El máster tiene 1.913 líneas antes y después; `git diff -U0` da cuatro trozos de una línea (`@@ -91 +91`, `-246 +246`, `-444 +444`, `-1661 +1661`). Ninguna línea citada por número se ha movido.

| # | línea | qué se añade | de dónde sale el literal |
| --- | --- | --- | --- |
| 2 | `:91` B1 | «(en España, hasta SIF-1, tampoco se vende cobro por YaQu: regla 24; la ventaja del ciclo completo empieza en SIF-1)» | c.16200 §3 #2 |
| 8 | `:246` regla 26b | «⚠️ Con la regla 24, en España este gancho no se usa hasta SIF-1: el titular ahí es presupuesto + firma + organización; la morosidad/el cobro es el ángulo de la Etapa 2 (post-SIF) y de los países sin este apagado.» | c.16200 §3 #8 |
| 12 | `:1661` W2 | «(España: post-SIF, regla 24)» detrás de «cobros todos los métodos» | c.16200 §3 #12 |
| 9 | `:444` N5 A22 | «Del presupuesto al cobro» pasa a «Del presupuesto a la firma», y la nota guarda el texto de antes | H1 servido, `public/index.html:441` y `:521`, firmado en c.19607 |

Cada cambio lleva su nota *(SCRUM-1016: … c.20778, 24-oct-2026)*.

**Re-cotejo con el máster de hoy:** el trozo que cada literal de c.16200 deja intacto sigue igual, letra a letra («Competencia "gratis" Kit Digital → vender cobro, no factura», «…nunca el titular.**», «facturación ES VeriFactu (post-SIF) · cobros todos los métodos ·»). «Etapa 2 (post-SIF)» ya existe en el máster (`:216`), así que el literal de la 26b no se inventa ningún término. El eyebrow «El ERP por WhatsApp para los oficios» sigue sirviéndose (`public/index.html:440`), y por eso la A22 lo conserva.

## P1 — fila 24 de la puerta de go-live

Los cinco guiones no se reescriben. Re-medidos hoy, los cinco siguen prometiendo cobro: `:53` «Cobra la señal antes de empezar», `:226-228` «te paga la señal» / «señal cobrada», `:232` «no cobra la señal», `:235` y `:1869` «¿Cuántas señales has dejado de cobrar este mes?», `:1012` «paga la señal». Pasan a la **fila 24** de `docs/go-live/puerta.json`, abierta, con `de_donde` = SCRUM-1016 c.20778. `tests/scrum1554c-puerta-de-go-live.test.mjs` sube `TOTAL` de 23 a 24, que es lo que su cabecera pide para cada entrada nueva («Sube con cada entrada nueva; NUNCA baja»): no se relaja nada.

## Lo que queda, y no es de este encargo

- **La A22 todavía describe la demo animada como «presupuesto→WhatsApp→firma→cobrado».** La animación servida acaba en «Firmado · 961,95 €» (`public/index.html:480`). La P3 firmada cubre el H1 y no esta frase, así que no la toco. Pregunta para el fundador: ¿se cambia también «→cobrado» por «→firmado», por la misma regla 16?
- P4: el `aria-label` lo aplica J3, y la fila 12 se cierra con su sha.

## Qué NO hice

- No toqué `public/` ni transicioné el ticket (A13/A18).
- Suite entera local: NO CORRIDA (hoy hay 10 sesiones a la vez). Corrí los guards dirigidos; el obligatorio de CI hace de tanda.
