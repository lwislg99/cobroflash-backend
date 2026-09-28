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
