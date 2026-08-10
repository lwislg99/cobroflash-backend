# SCRUM-356 · H2 — Medir para que el fundador pueda decidir (informe, cero construcción)

**Fecha:** 7-ago-2026 · **Carril:** H (albarán sin red) · **Gate:** sin gate — esta tarea **solo lee**

**Medido contra:** `origin/main` = `f0720385437a094534d725b01ecca83057d2fd1a` · 2026-08-07T19:27:29Z

> **No se ha construido nada.** Ni el mecanismo de firma, ni la cola (H3), ni el almacenamiento
> (H5), ni `prisma/schema.prisma`, ni el camino de emisión. **Y no se escriben los tres textos de
> estado**: son microcopy del fundador y son el corazón del ticket (regla 30).

---

## ⚠️ DOS AVISOS DE PARTIDA, antes de las respuestas

### ① «Bloqueada por SCRUM-336 (H0)» es una referencia EQUIVOCADA

**SCRUM-336 no es H0.** Es *«La atribución deja de guardarse en el navegador del visitante y pasa a
viajar en la URL»* (carril B, 5-ago-2026, `docs/master/SCRUM-336.md`) — atribución de marketing, sin
relación con el albarán sin red.

**H0 es SCRUM-355** (`docs/master/SCRUM-355.md`, mergeado). La dependencia real de H2 es ésa.

> Una referencia equivocada en un ticket es lo que hizo dar A9 por cerrada. Se corrige aquí y **no
> se toca el ticket de Jira** (lo lleva el asesor).

### ② El ticket SCRUM-356 **no existe en el repo**

Se pidió leerlo entero; **no se ha podido**: no hay `docs/master/SCRUM-356.md` (esta entrada es la
primera) y el enunciado vive solo en Jira. Lo que se mide abajo sale de **H0 (SCRUM-355)**, del
código, y de las cinco preguntas del encargo. **Si el ticket afirma algo que no esté aquí, no se ha
contrastado.**

---

## 1 · ¿Dice el producto «guardado» hoy, y qué está afirmando? — **[MEDIDO]**

**Sí, en dos sitios que lo afirman como HECHO CONSUMADO** — y los dos, medidos, lo dicen **después
de la respuesta del servidor**, que es lo correcto:

| Dónde | Texto | Qué afirma | ¿Correcto? |
| --- | --- | --- | --- |
| `quotesDetailView.js:877` | `✓ Guardado automáticamente` | **confirmado por el servidor** — va tras `await apiRequest(PUT /admin/quotes/:id/notes)` | ✅ |
| `jobsView.js:332` | `✓ Notas guardadas` | **confirmado por el servidor** — dentro del `.then()` del `apiRequest` | ✅ |

**Las demás apariciones NO son afirmaciones de estado:** `Guardando…` en rótulo de botón mientras
la petición está en vuelo (`customerDetailView.js:373`, `expensesView.js:370`, `homeView.js:1253`,
`onboardingView.js:425`, `productsView.js:172`, `providersView.js:85`, `quotesDetailView.js:662`,
`:717`, `:1048`) — es un estado de progreso, no una promesa. Y `«Este cliente no tiene email
guardado»` (`invoiceDetailView.js:282`, `:298`, `jobDetailView.js:884`,
`quotesDetailView.js:116`) habla de un dato ajeno, no del guardado en curso.

> **Conclusión para H2:** hoy el producto **no** miente con «guardado» — porque hoy **no hay nada que
> guardar en el móvil**. El riesgo que el ticket describe —decir «guardado» teniendo solo «en este
> móvil»— **no existe todavía y nacería con H3/H5**. Los dos textos de arriba son el precedente a
> imitar, no un defecto a corregir.

## 2 · `navigator.onLine` — **[MEDIDO]**

**CERO usos en todo el árbol.** `grep -rn "navigator\.onLine" public/ src/` → **0 resultados**.

* **Ningún estado se decide con él**, porque no se consulta en ninguna parte.
* Y H0 ya lo había medido desde el otro lado: `api.js:17` hace `const res = await fetch(...)`
  **sin try/catch alrededor del `fetch` y sin consultar `navigator.onLine`** (SCRUM-355, P6).

> **Esto es una buena noticia y hay que decirla:** la regla que el ticket quiere —«el estado
> *enviado* NO lo declara `onLine`, lo declara una respuesta del servidor»— **hoy se cumple por
> construcción**, no por disciplina. Lo que H2 tiene que hacer es **impedir que se rompa**, no
> arreglarla.

## 3 · El portal cautivo: ¿algún 200 se toma por éxito sin mirar el cuerpo? — **[MEDIDO]**

**SÍ, en tres sitios, y los tres son descargas de fichero.**

`apiRequest` **no** es uno de ellos: siempre termina en `res.json()` (`api.js:50`), así que el HTML
de un portal cautivo revienta el parseo y sale por el `catch`. Falla — de forma incomprensible,
pero falla.

El problema está en los `fetch` **directos** que miran solo `res.ok` y luego piden el cuerpo como
binario:

| Dónde | Qué descarga | Qué pasaría con un portal cautivo |
| --- | --- | --- |
| `exportView.js:222` | `portabilidad.zip` | `res.ok` es `true` → `res.blob()` del HTML de login → **se descarga un ZIP corrupto** |
| `exportView.js:277` | `datos.zip` | ídem |
| `exportView.js:340` | `libros/expedidas.csv` | ídem — el CSV que va al asesor |

**Y hay que decir de quién es la tercera: la introduje yo en SCRUM-325 (E4)**, copiando la forma de
las dos que ya estaban. Es la clase de defecto que se propaga por imitación.

> **La escena real:** obra con wifi de cortesía sin salida. El profesional pulsa «descargar», el
> navegador guarda un fichero, y lo que hay dentro es la página de login del router. Se entera el
> día que se lo abre el asesor.

**`[HUECO]`:** no se ha probado contra un portal cautivo real. **Qué haría falta:** un router con
portal (o un proxy que devuelva 200 + HTML) y el dashboard con sesión.

## 4 · El aviso: qué soporta cada navegador y qué costaría cada salida — **[MEDIDO]**

### Lo confirmado contra fuentes (7-ago-2026)

| API | Safari (iOS y macOS) | Firefox | Chrome / Edge | Global |
| --- | --- | --- | --- | --- |
| **Background Sync** | **NO, en ninguna versión** (3.1 → 26.5, y TP) | NO (2 → 153) | sí (Chrome 49+, Edge 79+) | 76,73 % |
| **Periodic Background Sync** | **NO** (iOS 3.2 → 26.5) | NO (2 → 156) | sí (80+) | 76,3 % |

**El ticket acierta:** Background Sync es **0 % en Safari** y Periodic es **solo Chromium**.

⚠️ **Y el dato que decide cuánto pesa eso NO lo tenemos.** H0 dejó **P2 como `[HUECO]`**: no hay
telemetría de navegador ni sistema (cero analítica en `public/dashboard/`, `navigator.userAgent`
leído en dos sitios y persistido en ninguno). **Si la mitad de los pros van en iPhone, el 76 % global
es irrelevante: el bloque cambia de forma entera.** No se rellena con cuota de mercado — la cuota de
iPhone en España no dice nada de NUESTROS usuarios.

### Las tres salidas, en NUESTRO producto

**A · Solo al abrir la app** *(reintentar cuando el profesional vuelve a entrar)*

* **Necesita:** la cola (H3) y el almacenamiento (H5). Nada más. **Cero dependencias nuevas, cero
  permisos, cero servicios.** Funciona igual en Safari y en Chrome.
* **Qué se pierde:** si no vuelve a abrir la app, **no se envía nunca**. El albarán firmado se queda
  en el móvil sin que nadie lo sepa — y el profesional puede estar convencido de que se envió.
* **Coste:** el más barato de los tres, y es el único que hoy es construible.

**B · Push**

* **Necesita:** ① `PushManager` + claves VAPID + un servicio de envío; ② **permiso explícito del
  usuario**; ③ en **iOS, que la app esté INSTALADA en la pantalla de inicio** — Safari no da push
  a una web en pestaña; ④ backend nuevo para almacenar suscripciones y despachar.
* **Medido: en el producto NO existe NADA de esto.** Cero `PushManager`, cero
  `Notification.requestPermission`, cero `showNotification`, cero VAPID, cero `web-push` en
  `public/` y `src/`.
* **Qué se pierde:** es **dependencia nueva → regla 36, decide el fundador**. Y depende de dos
  cosas que no controlamos: que el usuario conceda permiso y que se haya instalado la PWA. Si
  cualquiera de las dos falla, se degrada a la salida A **sin avisar**.
* **Coste:** el más caro con diferencia, y el único que introduce infraestructura.

**C · Declarar el hueco en pantalla** *(decirle que hay algo sin enviar y que debe abrir la app)*

* **Necesita:** la cola (H3) y el almacenamiento (H5), lo mismo que A, **más un sitio visible donde
  decirlo** y **microcopy del fundador** (regla 30).
* **Qué se pierde:** no envía nada por sí sola — es honestidad, no mecanismo. Le pasa el trabajo al
  profesional.
* **Coste:** A + una superficie de UI + un texto aprobado.

> **No son excluyentes: C es el suelo de A y de B.** Con A sin C, un albarán puede quedarse sin
> enviar y nadie lo sabe. Con B sin C, lo mismo el día que el permiso no esté concedido. **La
> pregunta que decide no es "¿cuál?", es "¿se construye C siempre, y A o B encima?"**

## 5 · ¿Hay hoy cola o reintento en el frontend? — **[MEDIDO]**

**No hay cola. No hay reintento automático. No hay persistencia de nada pendiente.**

* **IndexedDB: CERO** — confirmado, y ya lo había medido H0 (SCRUM-355, P5): cero ficheros en
  `public/` y `src/` lo mencionan.
* **Lo que sí hay, y es otra cosa: reintento MANUAL, iniciado por el usuario.**
  * `api.js:56` `uiErrorState(container, message, onRetry)` → pinta un botón **«Reintentar»** que
    vuelve a llamar a la función de carga. Es re-pedir una lectura, no reencolar un envío.
  * `api.js:165` `waFallbackBar({ … onRetry })` → **«↻ Reintentar WhatsApp»**, con dos salidas más
    (copiar enlace, enviar por email). Es el patrón más cercano al que H2 necesitaría… **pero exige
    que el profesional esté delante y pulse.**
* **El service worker no ayuda:** precachea 50 rutas de **cáscara** y **0 rutas de datos**, y manda
  a red directa y sin caché todo `/admin/`, `/auth/`, `/quote`, `/webhooks/` (`sw.js:90-96`).

> **Conclusión: la cola es pieza nueva ENTERA.** No hay nada de lo que colgarla, ni siquiera un
> almacén. Y H0 añade el bloqueo de fondo: **el albarán no existe hasta que el servidor le da
> número** (`allocateAlbaranNumber` dentro de la transacción) y **no hay clave de idempotencia
> generada en el cliente**, así que no hay con qué reconciliar un envío repetido.

---

## Recuento

**4 `[MEDIDO]` · 1 `[MEDIDO]` con `[HUECO]` de validación** (el 3, que necesita un portal cautivo
real) **· 1 `[HUECO]` heredado y bloqueante** (P2 de H0: qué navegador usan los pros).

---

# HOJA DE DECISIÓN PARA EL FUNDADOR

**La pregunta:** cuando el profesional firma un albarán sin cobertura, el envío queda pendiente.
**¿Cómo se entera de que sigue pendiente?**

**Lo que ya está decidido por la técnica, no por gusto:** Background Sync —la respuesta obvia— **no
existe en Safari, en ninguna versión**. Si hay iPhones entre los pros, esa vía no está.

| | **A · Solo al abrir** | **B · Push** | **C · Decirlo en pantalla** |
| --- | --- | --- | --- |
| **Qué hace** | reintenta cuando vuelve a entrar | avisa aunque la app esté cerrada | dice que hay algo sin enviar |
| **Dependencias nuevas** | ninguna | **VAPID + servicio de push + backend** (regla 36) | ninguna |
| **Permiso del usuario** | no | **sí** | no |
| **Funciona en iPhone** | sí | **solo si instala la PWA** | sí |
| **Qué se pierde** | si no abre, no se envía **nunca** | se degrada a A **en silencio** si falta permiso o instalación | no envía: avisa |
| **Coste** | bajo (va con H3+H5) | **alto** | bajo + **microcopy tuya** |

**Lo que se recomienda decidir, y es una sola cosa:** **si C se construye siempre**. A y B son
mecanismos; C es la honestidad de la pantalla. Sin C, tanto A como B pueden dejar un albarán firmado
sin enviar **sin que nadie lo sepa** — que es exactamente el modo de fallo que este bloque existe
para cerrar.

**Lo que NO se puede decidir todavía, y por qué:**

* **B (push) no se puede evaluar de verdad sin saber cuántos pros van en iPhone y cuántos tienen la
  app instalada.** Hoy eso es `[HUECO]` (H0/P2) y **no hay usuarios reales de los que medirlo**.
* **Los tres textos de estado** —«en este móvil», «enviado», «confirmado»— **son tuyos** y no se
  escriben aquí. Son el corazón del ticket: decir «guardado» a secas afirma el tercero teniendo solo
  el primero.

**Y un hallazgo que no era de este ticket pero sale de la misma medición:** las **tres descargas de
`exportView.js`** (portabilidad, datos y el CSV del libro) tratan un 200 como éxito **sin mirar el
cuerpo**. Con un portal cautivo, el profesional se descarga la página de login del router creyendo
que lleva sus datos. **Se reporta y no se arregla** (regla 9) — pero es del mismo bloque de
«confundir conectividad con éxito» y conviene decidir si entra aquí o va aparte.
