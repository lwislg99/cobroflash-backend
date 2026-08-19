# ¿Está el guion H2 publicado en `public/`? — medición

**Medido:** 19-ago-2026 · **Contra:** `origin/main` = `b78a3b1f5e41ee40d009dfd6bee48c9637722280`
**Rama:** `scrum-535-guion-h2-en-public` · **SCRUM-535**
**Alcance:** SÓLO MEDIR. **No se corrige nada** — ni una palabra de copy (regla 26: la respuesta
sobre VeriFactu sale del guion oficial, y el guion lo escribe el fundador; regla 30: el copy
público es del máster). La corrección va con **SCRUM-534** y no puede hacerse antes de que exista
el guion nuevo: si no, se sustituye una frase falsa por otra improvisada.

**De dónde viene el encargo.** El inventario **SCRUM-528** dejó `public/index.html` declarado
**NO MEDIDO** y señaló que por AB5 usa el guion H2 y por tanto heredaría su afirmación falsa
(entrada A1 del inventario): el guion dice *«está construida»* y *«no puedo activarla»*, y la
auditoría **SCRUM-525** midió que el envío a la AEAT **no está construido**.

> **Por qué esto iba primero:** el máster lo leemos nosotros; `PACK_GESTORIA.md` y
> `DECLARACION_RESPONSABLE.md` los lee una gestoría cuando se los demos; **`public/` lo lee
> cualquiera, ahora mismo y sin pedirlo.**

---

## LA RESPUESTA, EN UNA LÍNEA

**Hoy no está.** Ni el guion H2 ni ninguna variante suya viven en `public/`. **Pero estuvo
publicado 33 días**, en tres redacciones distintas y con una insignia aparte que decía lo mismo con
otras palabras. Lo retiró **SCRUM-400 el 7-ago-2026**, doce días antes de esta medición. Lo que hoy
lo mantiene fuera es un **guard**, no la ausencia de intención de ponerlo.

---

## 1 · ¿Está el texto del guion H2 (o una variante) en `public/index.html`?

**NO. Cero, y es un cero MEDIDO, no un cero de instrumento roto** (ver el suelo, abajo).

Los siete fragmentos distintivos del guion oficial (`docs/YAQU_MASTER.md:214`) se buscaron uno a
uno, normalizados —minúsculas, acentos fuera, etiquetas HTML fuera, espacios colapsados— sobre el
texto completo de cada fichero, no línea a línea:

* `te contesto como fabricante` → **0**
* `esta construida y en certificacion` → **0**
* `declaracion responsable del productor` → **0**
* `no puedo activarla hasta cerrarla` → **0**
* `la beta es de presupuestos y cobros` → **0**
* `los founding la estrenais al cerrarse` → **0**
* `el detalle tecnico cuando lo publique` → **0**

Y la palabra suelta: **`verifactu`, `aeat`, `hacienda`, `rrsif`, `certificac`, `declaración
responsable` y `validez fiscal` no aparecen ni una vez en `public/index.html`.**

Lo único que la landing dice hoy sobre facturación es **funcionalidad**, no conformidad:

* `public/index.html:329` → *"…con tarjeta, Bizum o transferencia. Y llevas clientes, gastos y
  **facturas** en el mismo sitio."*
* `public/index.html:509` → *"Sin permanencia. Tus datos son tuyos: clientes, presupuestos,
  **facturas**, cobros, trabajos y gastos se exportan en CSV cuando quieras."*

La FAQ que contenía el guion **ya no existe**: donde había cinco preguntas hay cuatro
(`public/index.html:506-509`), y la de VeriFactu se retiró sin sustituirla por otra.

## 2 · ¿Y en el RESTO de `public/`?

**Tampoco.** Barrido completo: **90 ficheros** bajo `public/`, **80 leídos como texto** y **10
saltados por ser binarios** (`.png`), declarados uno a uno.

**Las siete páginas que ve un visitante están limpias de vocabulario fiscal**, medido por los dos
instrumentos por separado: `index.html`, `precios.html`, `login.html`, `register.html`,
`terminos.html`, `privacidad.html` y `admin.html` → **cero** `verifactu`, **cero** `aeat`, **cero**
`hacienda`.

`verifactu` sí aparece en **9 ficheros, todos bajo `public/dashboard/`** — es decir, **detrás del
login**, no en la superficie abierta:

* `public/dashboard/index.html:138` ×1 — y es un **comentario HTML**, no copy:
  *"VeriFactu: todo lo que se pinte DENTRO de esa pantalla sigue bajo la regla 26 y sale…"*
* `public/dashboard/js/`: `invoiceDetailView.js` ×6 · `reportsView.js` ×6 · `jobDetailView.js` ×4 ·
  `settingsView.js` ×3 · `exportView.js` ×2 · `api.js`, `customersView.js` y
  `facturaPreEmision.js` ×1 cada uno.

**Ninguno de los nueve es el guion H2 ni una variante suya.** Son etiquetas de producto y
comentarios de código, y el inventario SCRUM-528 ya los tiene catalogados (C12-C14: el badge
`✓ VeriFactu` de `invoiceDetailView.js:114` y compañía). **Este ticket no los reabre.**

Y `public/precios.html` **nunca** ha contenido la palabra: el pickaxe sobre toda la historia del
fichero devuelve **cero commits**.

## 3 · ¿Coincidía con el guion del máster, o era una VARIANTE?

**Era una variante, y cambió tres veces.** Ninguna de las dos primeras coincide con el oficial; la
tercera coincide salvo en una alteración aprobada. Las tres, literales:

**① 5-jul-2026 · `dd31eb25` — variante en PRIMERA PERSONA DEL PLURAL**
*(el mensaje del commit la llamó «el guion H2 LITERAL (regla 26)»; no lo era)*
> *"**Te contestamos** como fabricante: la facturación VeriFactu está construida y en certificación
> — con declaración responsable del productor, que es lo que tu gestor te pedirá. Por ley no
> **podemos** activarla hasta cerrarla; por eso la beta es de presupuestos y cobros. **Los primeros
> usuarios la estrenarán** al cerrarse, sin cambio de precio. Si quieres, le **pasamos** a tu gestor
> el detalle técnico cuando lo **publiquemos**."*

**② 7-jul-2026 · `3e2d99ab` (rediseño A22) — variante RECORTADA, y es la que más tiempo estuvo**
> *"Te contestamos como fabricante: la facturación VeriFactu está construida y en certificación —
> con declaración responsable del productor, que es lo que tu gestor te pedirá. Los primeros
> usuarios la estrenarán al cerrarse, sin cambio de precio."*

Le faltan **dos frases enteras** del oficial: *«Por ley no puedo activarla hasta cerrarla; por eso
la beta es de presupuestos y cobros»* y *«Si quieres, le paso a tu gestor el detalle técnico cuando
lo publique»*.

🔴 **Y el recorte va en la peor dirección.** La frase que desaparece es justamente la que avisaba de
que la facturación **no se puede usar todavía**. Lo que quedó publicado 28 días afirma que está
construida y en certificación **y ya no dice que no esté disponible**. La variante corta es más
falsa que el original, no menos.

**③ 4-ago-2026 · `dca4289a` (SCRUM-299) — el íntegro, con UNA alteración aprobada**
> *"Te contesto como fabricante: la facturación VeriFactu está construida y en certificación — con
> declaración responsable del productor, que es lo que tu gestor te pedirá. Por ley no puedo
> activarla hasta cerrarla; por eso la beta es de presupuestos y cobros. **Los primeros usuarios la
> estrenarán** al cerrarse, sin cambio de precio. Si quieres, le paso a tu gestor el detalle técnico
> cuando lo publique."*

Único apartamiento del oficial: **«Los primeros usuarios la estrenarán»** donde el máster dice
**«Los founding la estrenáis»** — el propio commit lo declara como alteración aprobada. El resto,
transcrito carácter a carácter desde `YAQU_MASTER.md:214`.

**④ Y no era la única afirmación de la página.** Junto al héroe había una **insignia de confianza**
que decía lo mismo en cinco palabras y no cita ningún guion:

`public/index.html:377` →
> *"Facturación **VeriFactu en certificación**"*

Retirada el mismo día que la FAQ. **Cuenta aparte, y no es un detalle:** el guion al menos se
explica a sí mismo; una insignia con un escudo verde al lado del titular se lee como un sello. Y
**«en certificación» describe un trámite que no existe** — el régimen VeriFactu no se certifica, se
declara (art. 13 RRSIF).

## 4 · ¿Desde cuándo estuvo? — el tamaño de la exposición

Fechas de autoría de los commits en la historia de `main`. **No se ha medido el instante exacto de
cada despliegue** (Railway despliega con el merge): eso es **NO MEDIDO**, y las fechas de abajo son
la mejor cota disponible desde el repositorio.

* **5-jul-2026** — entra la variante ① (`dd31eb25`, *"A4.5: FAQ desde las objeciones H6 + footer
  serio"*).
* **7-jul-2026** — el rediseño A22 (`3e2d99ab`) la deja recortada: variante ②.
* **4-ago-2026** — SCRUM-299 (`dca4289a`) restituye el íntegro: variante ③.
* **7-ago-2026** — SCRUM-400 (`265fca83`) **retira la FAQ y la insignia**, y monta el guard.
  *"Retirado, NO sustituido: donde había una promesa no va otra."*

**Ventana total con alguna afirmación de conformidad publicada: 5-jul → 7-ago-2026 = 33 días.**
De ellos, **28 días con la variante recortada ②** —la que ya no avisaba de que no se podía usar— y
**3 días con el guion íntegro**. La insignia estuvo los 33.

**Y el motivo por el que se retiró NO fue éste.** SCRUM-400 no lo quitó por falso —eso se midió doce
días después, en SCRUM-525 y SCRUM-528— sino porque **la web invocaba un documento que no está
emitido**: `docs/legal/DECLARACION_RESPONSABLE.md` es una plantilla con placeholders cuya cabecera
dice «NO publicar». Se retiró por la razón correcta antes de que se conociera la razón mayor.

---

## Lo que hoy mantiene la landing limpia, y por dónde puede volver

No es la costumbre: es `scripts/_guard-conformidad-landing.mjs` + `tests/scrum400-conformidad-landing.test.mjs`
(**12 tests, sin gate, corren en `npm test`; hoy los 12 en verde**, incluido *«el repo REAL pasa el
guard hoy»* y *«las dos afirmaciones retiradas NO han vuelto a la landing»*). Vigila las cuatro
páginas públicas `index`, `precios`, `terminos` y `privacidad`.

**Pero vigila una conjunción, y conviene saber cuál:** ① que el texto afirme un estado de
conformidad **y** ② que **no haya un documento emitido** detrás. Está escrito en su propia cabecera:
*«el día que el documento se emita de verdad, el guard deja pasar la afirmación sin tocarle una
línea: vigila el hecho, no el vocabulario»*, y hay un test que lo fija —
`SCRUM-400 · con el documento EMITIDO, la misma frase PASA`.

🔴 **La consecuencia, medida y no supuesta:** el guard protege contra *afirmar sin documento*, **no
contra afirmar algo falso**. El día que `DECLARACION_RESPONSABLE.md` se rellene y pierda su
cabecera de «NO publicar», **el guion H2 vuelve a pasar** — y el guion H2 es exactamente la
afirmación que SCRUM-528 catalogó como **A1**. Si SCRUM-534 no ha reescrito el guion para entonces,
la frase falsa vuelve a la superficie pública con el guard en verde.

**Y hay una segunda puerta, en la propia normativa interna.** El guard cita como autoridad la
entrada **A4.1**, que **no vive en el máster** sino en `docs/SPRINT_DEMO_READY_EXT.md:105-106`. Su
texto literal es:

> *"PROHIBIDO en toda la landing: «factura», «VeriFactu», claims fiscales (pre-SIF). **Si existe
> sección VeriFactu, SOLO con el wording del guion H2.**"*

La segunda frase **autoriza** lo que la primera prohíbe, y el máster dice lo mismo en
`docs/YAQU_MASTER.md:1824` (AB5): *"**Sección VeriFactu: SOLO post-SIF**, o pre-SIF únicamente con
el wording del guion H2"*. **Las dos normas vigentes permiten hoy publicar el guion H2 en la
landing.** Lo que lo impide es el guard. **No se corrige aquí** — es cambio de máster, y va con
SCRUM-534.

---

## Los dos instrumentos, y qué encontró cada uno

**① Sonda propia en Node, escrita a fichero** (`sonda-535.mjs`, fuera del repo). Normaliza a
minúsculas, **quita los acentos por descomposición NFD** en vez de escribirlos, retira etiquetas
HTML y colapsa espacios; busca sobre el texto **completo** del fichero, no línea a línea, porque el
HTML parte las frases. Se escribió así por un aviso medido el mismo día: **`grep -E "remisi[oó]n"`
devolvió CERO donde hay cinco** — en este entorno una clase de corchetes con un carácter acentuado
no casa. Aquí no hay ni una.

* Encontró: los **0 aciertos** de los siete fragmentos del guion, el mapa completo de vocabulario
  fiscal fichero a fichero, y el reparto **superficie abierta / detrás del login**.

**② Contraste crudo con `grep -ric`**, sin acentos y sin clases (`erifactu`, `aeat`, `acienda`), que
lee los bytes tal cual.

* Encontró **lo mismo**… y **una cosa más**: `public/dashboard/index.html` contiene `VeriFactu` ×1
  y **la sonda ① no lo vio**.

🔴 **Esa discrepancia es un hallazgo del método, y se declara.** La sonda ① retira las etiquetas
HTML antes de mirar, y en ese fichero la palabra vive **dentro de un comentario `<!-- -->`**, que se
va con las etiquetas. **Punto ciego real: la sonda ① no ve el interior de los comentarios HTML.**
Aquí no cambia ninguna respuesta —era un comentario de código, no copy publicado— pero sin el
segundo instrumento nadie lo habría sabido. *(Es la misma decisión de diseño que toma el guard de
SCRUM-400, y por el motivo contrario: él quita los comentarios a propósito, para no vigilar la
explicación en vez de lo publicado.)*

## El suelo de ceguera

Un cero por instrumento roto y un cero medido son la misma frase con consecuencias opuestas, y aquí
la consecuencia sería *«no hay nada publicado»*, que es la mentira más cara de este ticket. Por eso:

* **Control positivo dentro de la propia sonda:** busca `yaqu`, que tiene que estar. Resultado:
  **34 de los 80 ficheros de texto** lo contienen. El grep crudo, por su cuenta, da **35** (uno más:
  el que la sonda no ve por el comentario HTML).
* **La sonda aborta declarándose CIEGA** —con `exit 2` y con esas palabras— si lee cero ficheros o
  si el control positivo no aparece. No lo hizo: leyó 80 y encontró el control.
* **Los ficheros saltados se cuentan y se nombran**, en vez de desaparecer del denominador: 10
  binarios de 90.

**Tanda completa sobre esta rama, sin tocar nada: 3.704 tests · 3.626 pass · 1 fail · 77 skipped.**
El único rojo es `scrum480-fin-de-linea` (**SCRUM-533**), preexistente y ajeno — es exactamente el
que el encargo declaraba esperado, y ninguno más. Los 12 tests de SCRUM-400 pasan.

---

## Lo que NO he podido medir

1. **El instante real de cada despliegue.** Las cuatro fechas son de autoría de los commits, no de
   producción. La ventana de 33 días es la mejor cota desde el repositorio; el dato exacto vive en
   el historial de Railway, que este trabajo no toca.
2. **Cuánta gente lo vio.** No hay analítica en este repositorio que lo responda. La exposición está
   medida en días, no en visitas.
3. **El tramo 1180-1650 del máster y los 110+ ficheros de `docs/master/`.** Eran el «si sobra
   tiempo» del encargo y **NO se han empezado**, a propósito: media medición figura después como
   cobertura, y es peor que ninguna. Siguen **NO MEDIDOS**, igual que los dejó SCRUM-528.
4. **Las otras superficies que un tercero puede leer sin login** y que no son ficheros de `public/`:
   el HTML que sirven las rutas públicas desde `src/` (`/pay/*`, `/recibo/*`, `/albaran/*`), los
   PDF, y los textos de las plantillas de WhatsApp. **NO MEDIDOS aquí**, y son el siguiente sitio
   natural: la landing era la superficie más leída, pero no es la única abierta.
