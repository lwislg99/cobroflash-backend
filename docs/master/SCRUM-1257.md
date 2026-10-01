# SCRUM-1257 · Censo del «justificante» en el panel — medir y proponer

**Medido contra:** `origin/main` = `3928cf10720e700b451e0f3eb893ab0743d764e0` · 2026-09-28T21:36:12Z (J3)

Encargo del orquestador (`cobroflash-backend-3c`), a raíz de la decisión de Javier: «1-Sí quitalo, pero ojo
es solo quitarlo del código, pero a nivel de producto lo que hay de justificantes será de facturas».
**Esta sección es el censo tal como se entregó: no cambia ningún rótulo, y sus propuestas estaban SIN FIRMAR cuando se escribió.** Lo firmado y construido va en SCRUM-1257b, abajo.

## 0 · Cómo se midió

- `git archive origin/main public` en una carpeta aparte: se mide `main`, no mi rama. Instrumento: `tests/banco-scrum1257/censo-vocabulario-justificante.mjs`.
- Literales extraídos con el AST de TypeScript (`StringLiteral`, `NoSubstitutionTemplateLiteral` y las
  piezas de plantilla), buscando `/justificante|documento de cobro|comprobante de (pago|cobro)/i`. Los
  comentarios se cuentan aparte con el escáner.
- **24 literales en 12 ficheros**, más unos 34 comentarios (recuento aproximado: el escáner suelto no
  distingue plantillas). `public/dashboard/index.html` no pinta la palabra.
- **Control:** los siete ficheros de la lista del orquestador que no salen en el censo (`albaranAccion`,
  `cuerpoDelDocumentoSuelto`, `expensesView`, `jobCobroHuecos`, `jobNextAction`, `jobsCierreTrabajo` y
  `jobsView`) se leyeron línea a línea: **solo aparece en comentarios**. En `expensesView` la palabra es
  además el justificante de un GASTO, que es otra cosa.
- **Positivo:** el censo encuentra `invoicesView.js:549`, la línea de la captura.
- **Suelo:** no ve los textos que manda el servidor (el `message` de un 4xx), ni el PDF, los correos o
  WhatsApp. En `src/` la palabra sale en 41 ficheros, que son de J1 (SCRUM-1255).

## 1 · 🔴 El hallazgo que ordena todo: la rama «justificante» del panel está MUERTA

`modoDocumentoSuelto` (`src/modules/invoicing/domain/facturaSuelta.ts:85`) devuelve, desde SCRUM-1027,
solo `'factura'` o `'no'`: `receipt` → `'no'`. El panel pone `window.appDocumentoSuelto = 'justificante'`
solo si el servidor se lo manda (`app.js:55`), y **el servidor ya no lo manda nunca**.

Consecuencias:

- `rotulosDelDocumento.esJustificante()` es **siempre `false`**. Sus seis rótulos «justificante», el
  botón «+ Nuevo justificante» y «¿Para quién es el justificante?» **no los ve nadie**.
- Un merchant español con el flag apagado recibe `'no'`: **no ve el botón de crear**
  (`invoicesView.js:205`) y el resto de rótulos le salen del lado «factura».
- Los únicos textos «justificante» que pueden pintarse son los que dependen del **documento** y no del
  modo: número `J-` o `type 'JUST'` (`tipoDeFactura`, `jobDocsReparto.js:34`). En producción no hay
  ninguno: es la deducción de SCRUM-1252 (2 filas en `invoices`, las dos de prueba), que no he podido
  re-medir porque no tengo base. En desarrollo o staging hay al menos 5.

## 2 · El censo, texto a texto, con las DOS preguntas separadas

«¿Palabra?» = ¿usa la palabra vieja donde debería decir «factura»? «¿Verdad hoy?» = ¿es cierto hoy,
con cualquiera de las dos palabras?

### A · Rama muerta. No hace falta texto: se borra la rama y queda el lado «factura», ya firmado

| # | Sitio | Texto | ¿Palabra? | ¿Verdad hoy? |
|---|---|---|---|---|
| A1 | `rotulosDelDocumento.js:70` | «Justificantes» | sí | nadie lo ve |
| A2 | `:71` | «Nº justificante» | sí | nadie lo ve |
| A3 | `:74` | «Nuevo justificante» | sí | nadie lo ve |
| A4 | `:75` | «Emitir justificante» | sí | nadie lo ve |
| A5 | `:79` | «Justificante emitido» | sí | nadie lo ve |
| A6 | `:82` | «No hemos podido emitir el justificante. Inténtalo otra vez.» | sí | nadie lo ve |
| A7 | `invoicesView.js:220` | «+ Nuevo justificante» | sí | nadie lo ve |
| A8 | `quotesView.js:440` | «¿Para quién es el justificante?» | sí | nadie lo ve |

Borrarlas es código (J1, SCRUM-1255), no microcopy. ⚠️ `guard:caja-documento-suelto` cambia de
veredicto al quitarlas (SCRUM-825 §5): hay que re-decidir para qué sirve, no aflojarlo.

### B · 🔴 Vivos y FALSOS: la palabra no los arregla, prometen un documento que no sale

| # | Sitio | Texto | ¿Palabra? | ¿Verdad hoy? |
|---|---|---|---|---|
| B1 | `invoicesView.js:549` (vacío de Facturas) | «Cuando un cliente acepte un presupuesto, el documento de cobro se genera solo y aparece aquí.» | sí («documento de cobro») | **NO en `receipt`**: al aceptar no se intenta emitir nada (`quotes.routes.ts`, gate de SCRUM-1027). **Sí en fiscal/demo**: al aceptar se emite la primera factura del plan |
| B2 | `invoicesView.js:546` (título) | «Aquí verás tus cobros» | — | **NO**: la lista es de facturas. Los cobros tienen su pantalla (SCRUM-285) y aquí se filtran fuera los justificantes. En `receipt` no va a aparecer nada nunca |
| B3 | `settingsView.js:1339` (fila «Datos fiscales», cuando faltan) | «Sin ellos, el documento tras el pago es un justificante de cobro» | sí | **NO, por partida doble**: la tarjeta solo se ve en fiscal/demo (en `receipt` se oculta, `:1266`), donde desde SCRUM-1027 no sale ningún justificante. Y los datos fiscales no deciden el tipo de documento: `getEmissionMode` mira país, demo y el flag, nada más |

### C · Vivos, verdad con la palabra buena: basta cambiar la palabra

| # | Sitio | Texto | ¿Palabra? | ¿Verdad hoy? |
|---|---|---|---|---|
| C1 | `quotesDetailView.js:288` | «🧾 Ver justificante» | **sí**: sale cuando el presupuesto tiene un documento `paid`, y en fiscal/demo ese documento es una FACTURA | sí, abre el documento. ⚠️ Con un `J-` antiguo, «Ver factura» sería falso (ver D) |
| C2 | `invoiceDetailView.js:534` (tooltip, solo con `chargeId` = cobro con tarjeta) | «…evidencia de aceptación + justificante + registro de mensajes…» | sí: el paquete lleva «justificante/factura» (`invoicesAdmin.routes.ts:324`), y con tarjeta el documento es una factura | sí |
| C3 | `settingsView.js:44` (`receipt`, firmado en 17385) | «Por ahora, YaQu no genera facturas ni justificantes desde tu cuenta.» | sobra «ni justificantes» cuando la figura desaparezca | **sí**, es verdad hoy. Cambiarlo es opcional |

### D · Solo con documentos `J-` antiguos. 🔴 NO se renombran a «factura»

| # | Sitio | Texto |
|---|---|---|
| D1 | `invoiceDetailView.js:93` | «Justificante de cobro» (título de la ficha) |
| D2 | `:94` | «Detalle y acciones del justificante.» |
| D3 | `:138` | chip «JUSTIFICANTE» |
| D4 | `jobDetailView.js:24` | «Justificante» (tipo en la ficha del trabajo) |
| D5 | `cobrosView.js:73` | «No se pudo enviar el justificante al cliente por email.» |

Llamar «factura» a un documento que se emitió como justificante es afirmar que es una factura, y no lo
es: es un claim fiscal (regla 7), y el documento no se reetiqueta (regla 29). SCRUM-825 §3 ya midió que
«Justificante de cobro» no tiene traducción. **Esto no es microcopy: es lo que SCRUM-1252 pregunta al
fundador («qué SON esos cinco»).** Mientras no se decida, se quedan como están. En producción no hay
ninguno.

Y son valores de código, no rótulos: `invoicesView.js:81`/`:219`, `jobDocsReparto.js:36`,
`jobRailBlocks.js:157` (comparan `'justificante'`).

## 3 · Literales propuestos — ⛔ SIN FIRMAR

| # | Dónde | Cuándo se pinta | Propuesta |
|---|---|---|---|
| P1 | vacío de Facturas, título (B2) | `receipt` | «Aún no se emiten documentos» — **ya firmado** en SCRUM-1220 comentario 17385 (título de Ajustes); se reutiliza, no es texto nuevo |
| P2 | vacío de Facturas, cuerpo (B1) | `receipt` | «Por ahora, YaQu no genera facturas desde tu cuenta.» — el firmado en 17385 sin «ni justificantes» |
| P3 | vacío de Facturas, título (B2) | fiscal/demo | «Aquí verás tus facturas» |
| P4 | vacío de Facturas, cuerpo (B1) | fiscal/demo | «Cuando un cliente acepte un presupuesto, su factura se genera sola y aparece aquí.» |
| P5 | «Datos fiscales», cuando faltan (B3) | fiscal/demo | «Complétalos antes de emitir tu primera factura» |
| P6 | C1 | documento de tipo factura | «🧾 Ver factura» |
| P7 | C2 | cobro con tarjeta | «Presupuesto firmado + evidencia de aceptación + factura + registro de mensajes, listo para responder al banco» |
| P8 | C3 (opcional) | `receipt` | «Por ahora, YaQu no genera facturas desde tu cuenta.» (el mismo literal que P2) |

- P1, P2 y P8 no afirman ningún documento: dicen que no sale ninguno, que es lo medido. P1 y P2
  necesitan que el vacío mire `window.appModoEmision`, como ya hacen `homeView` y `settingsView`: es
  código y va aparte.
- P5 no promete qué pasa sin datos: no lo he medido en fiscal (en `src/modules/invoicing` no encontré
  nada que pare la emisión por falta de `taxId`, salvo VeriFactu, `verifactu.service.ts:643`). Por eso
  pide, no afirma.
- ⚠️ **Hueco en P4:** «su factura se genera sola» lo he medido en el camino por defecto (`FULL_UPFRONT`:
  al aceptar se emite el tramo `plan[0]`). No he medido los planes personalizados, en los que un primer
  tramo podría no emitir al aceptar. Si no se quiere depender de eso: «Cuando un cliente acepte un
  presupuesto, sus facturas aparecerán aquí.»
- Ninguna dice «oficial», «AEAT», «Hacienda» ni «VeriFactu» (regla 7).

## 4 · Lo que NO se ha tocado

Ni un rótulo, ni `src/`, ni el flag, ni el modo `receipt`. No he consultado ninguna base.

---

# SCRUM-1257b · Lo construido: P1-P7, firmados en el comentario 17444

**Medido contra:** `origin/main` = `4fd0b309c265b10d0f376e2fdea856ed99a7d2ba` · 2026-09-28T21:45:46Z

**Firma:** el orquestador, por delegación del fundador, en SCRUM-1257 comentario 17444. Firmó P1-P7 con
**P4 cambiado a la alternativa**: «Cuando un cliente acepte un presupuesto, sus facturas aparecerán aquí.».
La recomendada («su factura se genera sola») solo estaba medida en los dos planes predefinidos, no en los
personalizados. **P8 no se firma** hasta que SCRUM-825 retire la figura. Registro:
`docs/microcopy/2026-09-28-SCRUM-1257-vacio-facturas.md`.

## Qué cambia

| # | fichero | cambio |
|---|---|---|
| P1-P4 | `invoicesView.js`, vacío de Facturas | título y cuerpo salen de `window.appModoEmision === 'receipt'`: en `receipt` P1/P2 y en fiscal/demo P3/P4. **La condición va en el mismo commit que los textos**: sin ella, el mensaje de `receipt` saldría en fiscal. Así B1 y B2 quedan arreglados por construcción |
| P5 | `settingsView.js`, fila «Datos fiscales» | `koText` pasa a P5 (B3) |
| P6 | `quotesDetailView.js` | `tipoDeFactura(paidInvCta) === 'factura' ? '🧾 Ver factura' : '🧾 Ver justificante'`. La rama `J-` conserva su texto (grupo D, SCRUM-1252) |
| P7 | `invoiceDetailView.js`, tooltip de la reclamación | `isReceipt ? <viejo> : P7`. Es el MISMO criterio `J-` que ya decide el título y el chip de la ficha: no hay un segundo criterio |

El modo no se recalcula en el navegador: es el que manda el servidor, igual que en `homeView` y
`settingsView`. Si `appModoEmision` llega `null` (un `/admin/me` que no respondió), el vacío cae al lado
fiscal/demo (P3/P4), como el resto de la casa, que solo trata `receipt` aparte.

🔴 **Y el reverso, escrito a petición del orquestador:** con el modo desconocido, caer al lado fiscal es
prometerle «sus facturas aparecerán aquí» a alguien que podría estar en `receipt`, donde no va a salir
ninguna nunca. Es sobre-prometer, el mismo patrón que se quitó en SCRUM-1220, 1216 y 1247. No se cambia
ahora, porque si `/admin/me` no responde el panel ya está roto por sitios peores. **Pero si algún día se
revisa, el lado seguro es el contrario:** con el modo desconocido, no prometer.

⛔ **No se ha tocado nada de los grupos A y D**, ni `src/`, ni el flag, ni el modo `receipt`.

## Rojo primero

`tests/scrum1257-vacio-facturas-segun-modo.test.mjs`, comiteado solo y en rojo (`2bde0f5a`): **7 de 8
fallan** contra `main`. El único verde es el control del buscador de ternarios. Con el cambio: **8 de 8**.

El test comprueba la **condición**, no solo que el texto esté: busca con el AST el ternario que elige
entre cada pareja, y resuelve su condición hasta la definición (`sinEmision` → `window.appModoEmision ===
'receipt'`; `isReceipt` → el criterio `J-`). Los textos viejos se buscan **entre los literales**, no en el
fichero entero, porque el código cita el texto viejo en un comentario con su motivo. Control: el mismo
detector sí ve el literal viejo en el `settingsView.js` de `main`.

**Error propio, corregido antes de comitear el verde:** la primera versión del test buscaba los textos
viejos con `includes`, y habría caído por mi propio comentario. Es la trampa de medir la palabra y no la
llamada.

## El instrumento, repetido sobre el árbol cambiado

`node tests/banco-scrum1257/censo-vocabulario-justificante.mjs "$PWD" "$PWD"` → **22 literales** (antes 24).
Se van B1 («documento de cobro») y B3. Siguen, a propósito:

- la rama `J-` de P6 y la de P7 (grupo D);
- `settingsView.js:44` (P8, sin firmar);
- los ocho muertos del grupo A (SCRUM-825).

## El trinquete de SCRUM-601 se movió, y por qué

`scrum601-copy-del-documento-vs-flag` cayó con el cambio: `flag` pasó de 17 a 20, `tipo` de 7 a 11, `aPelo` de 156 a 154 y los no legibles de 34 a 37. Sobre `main` pasa. **Aislado con el propio censo**, sacando las categorías del árbol de `main` (4fd0b309) y del de la rama: el diff son exactamente mis literales.

- **flag +3:** P2, P3 y P4, que ahora elige `appModoEmision`. El texto viejo del vacío ni siquiera estaba en el censo.
- **tipo +4 y aPelo −2:** P6 y P7 dejan de ser «a pelo» y eligen la palabra por el tipo de documento, con su pareja.
- **No legibles +3:** los tres anteriores llegan al `innerHTML` a través de una variable.

No se duplican en línea para bajar el número (el motivo de 31→32 en el propio test). Los anclajes se actualizan con esta explicación escrita al lado, en el mismo commit. No es relajar el guard (regla 41): es que el censo ahora ve lo que se arregló.

## Suelo

- No se ha visto en un navegador con sesión: el panel pide sesión y este árbol no tiene base. Se
  verifica en yaqu.app cuando entre.
- No hay ningún test que fijara los literales viejos (buscado en `tests/`, `scripts/` y `docs/microcopy/`).

---

# SCRUM-1257c · El grupo A se retira (SCRUM-825 D1), y la ruta que seguía abierta

**Medido contra:** `origin/main` = `6112855bd225d5778598f4449ce752972614da32` · 2026-09-28T22:21:27Z

**Firma:** el fundador, **SCRUM-825 comentario 17446** («1-Sí a las 3»). D1: se retira el tipo `JUST`,
con los rótulos según ESTE censo y no según la tabla del 8-sep. **Rama:** `scrum-825-rotulos-rama-muerta`
(ticket SCRUM-825, reparto por fichero: `public/` es de J3 y `src/` de J1). Se registra aquí y no en
`SCRUM-825.md` porque J1 anexa allí su lado servidor en paralelo, y dos ramas añadiendo al final del
mismo fichero es el conflicto de SCRUM-709. Lo decidió el orquestador.

## 1 · Re-medido antes de borrar, ejecutándolo

Compilado `main` (d216084a), `modoDocumentoSuelto` ejecutado en los tres modos (receipt, fiscal, demo),
con `INVOICING_ES_ENABLED` apagado y encendido por entorno, y además sin país y con `null`: solo salen
`'no'` y `'factura'`. La función solo depende de `getEmissionMode` y esos tres valores son todos los
que devuelve, así que la rama «justificante» está muerta para cualquier merchant. El censo de §0 sobre
ese `main` dio los mismos 24 literales, con el grupo A donde estaba.

## 2 · Lo que se borra: los ocho del grupo A, sin un texto nuevo

- `rotulosDelDocumento.js`: fuera `esJustificante()` y las seis ramas. Queda el lado factura.
- `invoicesView.js`: el botón pierde «+ Nuevo justificante».
- `quotesView.js`: la guía del documento suelto queda vacía, que ya era el lado factura.
- `app.js`: `window.appDocumentoSuelto = me.documentoSuelto === 'factura' ? 'factura' : 'no'`. No es un
  rótulo, pero sin esto un `'justificante'` que llegara del servidor pintaría el botón «Nueva
  factura», porque la puerta es `!== 'no'`. Falla cerrado.

⛔ **No se toca:** el grupo D (documentos `J-` antiguos, SCRUM-1252), P8/C3 (`settingsView.js:44`, sin
firmar), el modo `receipt`, `src/` ni nada emitido.

## 3 · Los guards que protegían la rama muerta, uno a uno

| guard | qué pasa | por qué no es relajarlo (regla 41) |
|---|---|---|
| `scrum776` | pasa al lado factura, y el predicado `=== 'justificante'` queda en CERO sitios, con un control que lo ve en código y no en un comentario | sigue vigilando UNA sola fuente y que el DEMO lea «factura» |
| `scrum514` | «¿Para quién es el justificante?» se aparca con su motivo, por el mecanismo del propio guard | la firma ocurrió; ya no tiene dónde pintarse |
| `scrum976` | cae solo en cascada del 514 | — |
| `guard:caja-documento-suelto` | `MODOS = ['factura']`, con la cita y con lo que deja de medirse. **Ejecutado en Edge real:** exit 0, las cinco cajas caben a 929 y 390 px, y el control negativo respondió | mide todo lo que se pinta |
| `scrum600b` (la ruta) | re-anclado en «Emitir factura» | mide lo mismo: que la puerta monta el documento suelto |
| `scrum601` (control positivo) | era «+ Nuevo justificante», que se ha borrado. Pasa a `homeView.js:864` (vía `WINDOW::appModoEmision`, condición `=== 'receipt'`), el único de los cuatro «flag» que quedan que depende del modo DE VERDAD. Los tres de `jobDetailView` heredan por `jobNextAction` y su condición local no mira el modo | un positivo anclado en algo borrado está muerto |
| `scrum601` (reparto) | flag 17 → 4, aPelo 156 → 162. **EL NÚMERO EMPEORA MIENTRAS EL CÓDIGO MEJORA:** los seis «factura» pierden la vía `WINDOW::appDocumentoSuelto`, pero en ejecución siguen detrás de la puerta `!== 'no'`. Es un punto ciego del censo, escrito encima del número | aislado con el censo, `main` contra la rama |
| `scrum601` (no legibles) | 34 → 33: «+ Nuevo justificante» era uno | baja |

## 4 · 🔴 Lo que salió al preguntar si se podían retirar dos guards

El orquestador puso una condición antes de retirar el «defecto ATADO» de `scrum601` y el primer test
de `scrum600b`: **comprobar que el defecto no fuera alcanzable por otra vía.**

- **Fiscal y demo no discrepan:** los dos reciben `'factura'`, la página no tiene ninguna rama por modo y
  el servidor emite `F1` en los dos.
- **Pero la RUTA sí:** `'invoices-new'` está en `HASH_VIEWS` y su `case` no miraba el modo. Un merchant
  en `receipt` que abría `#invoices-new` veía «Nueva factura» y «Emitir factura» y se comía un 409.
  Está medido montando la página, y es previo a D1: con los ficheros de `main` sale igual.
  `docs/BUGS.md` P1-825.

Así que **no se retiró nada: se re-apuntó**. Los dos tests se escribieron en rojo contra el código sin
puerta (`59a723ec`) y se pusieron en verde con el arreglo:

- `scrum600b` ejecuta el `case` REAL de `app.js` con `'no'` (pinta Facturas y `view = 'invoices'`) y con
  `'factura'` (pinta la página, como control).
- `scrum601` exige las dos puertas del flujo: el botón `!== 'no'` y la ruta `=== 'no'`. Deja escrito lo
  que deja de vigilar: los rótulos «a pelo» DENTRO de la página. Con las dos puertas cerradas, esa página
  solo la ve quien emite factura.

⚠️ **El arreglo de la ruta NO lo cubre la firma 17446.** Es un cambio de comportamiento que el
orquestador autorizó como arreglo de pantalla del carril de J3: sin textos nuevos, fallando cerrado y
sin tocar el servidor, que ya contestaba 409. **Que nadie lea este PR creyendo que Javier firmó eso.**

## 5 · El choque con SCRUM-1257b, resuelto regenerando

`#1938` movió los mismos anclajes de `scrum601`. Al rebasar sobre `main` (6112855b) se regeneraron con
`censoCopy` sobre el árbol fusionado: `{ flag: 7, tipo: 11, aPelo: 160 }` y 36 no legibles. Cuadra con
la suma de los dos cambios (20−13, 11, 154+6; 37−1), que se usó como comprobación, no como fuente.

## Rojo primero, y pruebas

- `e945ac55`: `tests/scrum825-rama-justificante-retirada.test.mjs`, 4 de 5 en rojo contra `main`. El
  verde es su control. Después, 5 de 5.
- `59a723ec`: los dos re-apuntados en rojo, por la ruta. Después, en verde.
- **Errores propios, cazados antes del verde:**
  · Mi primer arreglo del router tenía un `break;` dentro del `case`, y los guards lo extraen hasta el
    primer `break;`. Se reescribió con `if/else` y una sola salida.
  · Al explicarlo en un comentario escribí la palabra `break;`, y volví a cortar el `case` por ahí. El
    comentario ya no la cita.
  · Al rebasar sobre `main` para regenerar `scrum601`, comiteé el conflicto resuelto con los números
    como marcadores `__REGENERAR__`, que no parsean. Los commits intermedios habrían tenido un «rojo»
    que era un error de sintaxis. La rama se rehízo, antes de empujarla, en cinco pasos limpios: rojo
    de D1, borrado + guards, rojo re-apuntado, puerta y registro. Se comprobó que el árbol final es
    idéntico al de antes de rehacerla.

---

# SCRUM-1257d · P8: Ajustes deja de nombrar el justificante, y el censo baja de 11 a 10

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T01:38:47+01:00 (J3)

A9: aviso → cicatriz J3 «Conté tres caminos sobre un listado cortado con head: una salida recortada no es la población.» — no se pudo comprobar: es cómo leo la salida de una orden, no algo del árbol que un test pueda mirar

**Firma:** el orquestador, por delegación del fundador, en **SCRUM-1257 comentario 17676** (leído en
Jira antes de copiarlo aquí). Ficha: `docs/microcopy/2026-10-01-SCRUM-1257-detalle-modo-receipt.md`.

## 0 · La premisa del encargo no se sostenía, y eso fue la primera entrega

El encargo llegó con el título de Jira: «24 literales, 8 muertos, 3 vivos y falsos, 5 de la regla 29».
Repetido el censo de §0 sobre un `git archive` de este `main`: **11 literales, no 24.**

| clase del enunciado | en este `main` | cómo entró |
|---|---|---|
| 8 muertos (grupo A) | 0 de 8 como literal en `public/` y `src/`; quedan citados en 3 comentarios | #1943, sección SCRUM-1257c |
| 3 vivos y falsos (grupo B) | 0 de 3; sustituidos por P1-P5 | #1938, sección SCRUM-1257b |
| 5 de la regla 29 (grupo D) | 5 de 5, intactos | no se tocan (SCRUM-1252) |

Los otros 6: las ramas `J-` de P6 y P7, tres valores de código que comparan la palabra, y C3
(`settingsView.js`, `DETALLE_MODO_EMISION.receipt`), lo único que quedaba abierto. No se borró nada.

## 1 · Lo medido antes de pedir la firma: ¿puede hoy una petición escribir `type: 'JUST'`?

No. Y no es «no encontré cómo llegar»: es una cadena de cuatro eslabones, cada uno con su población.

1. **Un solo sitio crea filas de `Invoice`**: `src/modules/invoicing/domain/crearFacturaEmitida.ts`.
   `invoice.(create|createMany|upsert)` en `src/`: 1. Creates anidados: 0. SQL crudo sobre la tabla: 0.
   De los 20 `update`/`updateMany` censados, ninguno pone `type` en su `data`.
2. **Tiene 8 llamantes.** Seis escriben `isReceiptNumber(n) ? 'JUST' : 'F1'`: `src/lib/invoicing.ts`,
   `src/modules/jobs/app/routes/jobs.routes.ts`, `src/modules/quotes/app/routes/quotes.routes.ts`,
   `src/modules/system/app/routes/quotesAdmin.routes.ts` (dos) y `emitInvoice`
   (`src/modules/invoicing/domain/invoicing.service.ts`), cuyos 4 llamantes pasan `'F1'` literal. El
   octavo es la rectificativa, que escribe `'R1'` fijo.
3. **En los 8 el número sale de `allocateInvoiceNumber`** y de ningún otro sitio: 7 llamadas, `const`
   en la línea de la llamada, sin reasignar.
4. **Y `allocateInvoiceNumber` no puede devolver un `J-`**
   (`src/modules/invoicing/domain/invoiceNumber.service.ts`). En `receipt` lanza
   `invoicing_es_disabled` antes de reservar nada. Su única salida es `formatInvoiceNumber`, con dos
   formas: `F` + año + secuencia, o año + prefijo del merchant. El generador de `J-` se retiró en #1940.

El eslabón 4 se **ejecutó**, no se razonó: `formatInvoiceNumber` compilado, con 11 prefijos hostiles
(«J-», con espacio delante, con salto de línea delante…) × 5 fechas × 3 años × rectificativa sí/no =
**330 combinaciones. 0 reconocidas como `J-`**, 22 lanzan (año no numérico en el formato F). Control
positivo: `isReceiptNumber` sí devuelve `true` para una referencia `J-` de verdad.

**No lo apaga un flag.** Con `INVOICING_ES_ENABLED` en OFF lanza y en ON sale `F`. Un bloqueo por flag
se enciende; éste no.

**Error propio, dicho antes de la firma:** al orquestador le dije «tres caminos» y eran seis. Mi lista
venía de un `grep` cortado con `head -12`. Va a las cicatrices del puesto (línea `A9:` de arriba).

**De paso, para SCRUM-1260 (carril de J1, no se toca aquí):** la condición inalcanzable no es solo la de
`emitInvoice`: es la misma en los seis sitios y en tres semillas de `scripts/`. El parámetro
`esJustificante` de `auditar` solo se llama con `false`. Y `scripts/e2e-critico.mjs` todavía espera
`'JUST'`: no se ha corrido, pero leído así fallaría hoy.

## 2 · 🔴 Sobre qué descansa la firma, y sobre qué NO

- **Descansa en el código de este `main`, no en un guard.** Hay 13 ficheros de `tests/` que nombran el
  reconocedor de `J-`, y **no se han interrogado**: no se sabe si alguno caería si alguien devolviera
  un generador de `J-`.
- **No se ha medido ninguna base.** «No se pueden crear nuevos» no dice cuántos `J-` antiguos existen.
- El texto firmado **no afirma nada sobre justificantes: solo deja de mencionarlos.** Sería verdad
  aunque existieran `J-` antiguos en la cuenta, y por eso la firma es delegable. Una frase que dijera
  que YaQu ya no genera justificantes sería un hecho sobre el producto, y del fundador (regla 39).

## 3 · Qué cambia

| fichero | cambio |
|---|---|
| `public/dashboard/js/settingsView.js` | `DETALLE_MODO_EMISION.receipt`: «Por ahora, YaQu no genera facturas desde tu cuenta.» Es, carácter a carácter, el P2 del vacío de Facturas. El comentario de historia se actualiza en sitio, sin mover líneas |
| `tests/scrum298-modo-visible.test.mjs` | en `APROBADOS`, la entrada del texto viejo **se borra** y entra la nueva con su procedencia (comentario 17676) |
| `tests/scrum514-aprobado-y-aplicado.test.mjs` | el texto viejo se aparca como «sustituido por una firma posterior», con su motivo |
| `docs/microcopy/` | ficha nueva, ranura `detalle-modo-receipt`. La de SCRUM-1220 no se toca (SCRUM-1306) |
| `docs/equipo/cicatrices/J3.md` | la primera cicatriz del puesto |

**Lo de `scrum298` no es relajar el guard (regla 41), y se comprobó antes de tocarlo:** con el literal
nuevo y la lista vieja cae, 11 de 12, nombrando exactamente el texto nuevo como «microcopy escrita sin
aprobar». Su propio mensaje dice qué hacer: el aprobado entra con su procedencia, y el que ya no se
pinta sale (la caducidad). Relajarlo sería ensanchar la lista o quitarle la caducidad; aquí la lista
sigue teniendo seis entradas.

**`scrum514` no lo había previsto, y salió rojo en mi primera pasada** (y `scrum976 ④` en cascada: es
uno de los guards de entrada). La ficha de SCRUM-1220 sigue firmada y su texto ya no se pinta: «hay
texto aprobado que no llega a la pantalla». El propio guard da las dos salidas —aplicarlo o aparcarlo
con su motivo— y el caso tiene precedente escrito en su lista: «sustituido por una firma posterior»
(SCRUM-915d) y el de la sección SCRUM-1257c. Se aparca igual. Su segundo test sigue vigilando la
excepción: si el texto volviera a pintarse, la entrada sobra y cae. **El orquestador aprobó de antemano
lo de `scrum298`, no esto: se hace por ser consecuencia mecánica de la firma, y se dice.**

⛔ **No se toca:** el grupo D, las ramas `J-` de P6 y P7, `src/`, el flag ni el modo `receipt`.

## 4 · Rojo primero, y el control de no haberse llevado de más

`tests/scrum1257-p8-detalle-receipt-sin-justificantes.test.mjs`, comiteado solo (`33b50d46`): **4 de 5 en
rojo** contra este `main`; el verde es el control de los detectores. Con el cambio, **5 de 5**.

- El literal se lee con el AST, como valor de `DETALLE_MODO_EMISION.receipt`, y el viejo se busca
  **entre los literales**: el comentario del código lo sigue citando, con su motivo.
- **El censo de §0 se ejecuta desde el test** sobre el árbol: **10 literales** (antes 11), Ajustes ya no
  sale, y **los cinco de la regla 29 tienen que seguir saliendo**, uno a uno, por fichero y texto y no
  por línea. Sin ese positivo, «ya no sale la palabra» sería cierto también por haber borrado de más.
- El conjunto de los 10 se compara entero. Si cambia no es un fallo del test: es que alguien añadió o
  quitó un texto con la palabra, y eso se decide (reglas 29 y 39).
- La firma se comprueba contra **su** ficha, por ticket y ranura: el mismo literal ya constaba firmado
  para otra ranura (17444), y esa firma decía expresamente que ésta no se firmaba todavía. Este caso
  se reescribió después del commit en rojo: allí miraba el nombre del fichero, que es la forma débil.
- El hijo que lanza el censo lleva el entorno construido a mano (SCRUM-1308).

**Hueco declarado:** la caída por «falta uno de los cinco» no se ha visto: no se mutó el árbol para
provocarla. El rojo que sí se vio en ese caso fue el de «Ajustes sigue en el censo».

## 5 · Qué se corrió, y qué no

En local, **30 ficheros elegidos a mano, 245 tests, 245 pasan, 0 saltados**: el nuevo, `scrum298`,
`scrum514`, los dos de 1257/825, `scrum601` (sus anclajes **no se movieron**), `scrum237`, `scrum976`,
`scrum377`, `scrum267`, `scrum273`, `scrum391`, `scrum1294`, `scrum1306` y los del registro de
microcopy. La pasada anterior, sobre los mismos 30, dio 243 de 245: los dos rojos de `scrum514`.
Es una muestra, no la tanda: hay 93 ficheros de `tests/` que nombran Ajustes o el registro.

- **La tanda completa NO se corrió en local**: se deja al CI, por decisión del orquestador (memoria de
  la máquina).
- `dist/` se generó en este worktree con `tsc --noCheck` (solo emisión): no había, y sin él `scrum298`
  no arrancaba. El primer «rojo» de `scrum298` fue ése, un instrumento que no llegó a arrancar, y no
  se contó como la caída.
- No se ha visto en un navegador con sesión: se verifica en yaqu.app cuando entre.
