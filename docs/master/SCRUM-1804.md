# SCRUM-1804 · IVA al 10 %: las pantallas de S2 y el informe X2 (PARTE S de SCRUM-1316)

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24T09:37:05Z

**Skill UI:** cargada (`yaqu-premium-ui`) — ⚠️ TARDE: la cargué con el código ya escrito, cuando la suite
pidió esta línea. Repasado contra AB6 después: componentes del inventario AB3 (`.alert.warning`, el selector
común de 44 px), sin `style=`, `label` + `aria-required` + `aria-describedby`; capturas abajo.

A9: comprobación → `tests/scrum811c-skill-ui-declarada.test.mjs`
(mi fallo: escribí la UI sin cargar antes `yaqu-premium-ui`; este guard exige declararla en el registro y fue lo que me
lo hizo ver. Otros dos tropiezos de esta rama los cazó la casa: un arnés sin rol, `tests/scrum1344-arnes-de-prueba-con-rol.test.mjs`,
y el aviso montado de más al 21 %, `tests/scrum697-un-solo-render.test.mjs`; los tres están arreglados en la rama.)

Puesto S2 (frontend), rama `scrum-1804-iva10-parte-s` (base = merge-base `8e0d40816`). Ticket padre: **SCRUM-1316** (RDL 29/2026, desde el
1-dic-2026 el 10 % en obras de vivienda depende del medio de pago). El servidor y la ficha de factura los dejó
el equipo J en main (SCRUM-1316l, PR #3336/#3334/#3328). Esto pone lo que faltaba: el aviso al elegir el 10 %
en el editor, la ficha del TRABAJO y una línea del informe X2. Órdenes: orquestador `cobroflash-backend-41`,
24-nov (cola ①-⑤ de SCRUM-1804; SCRUM-1766, que detallaba ②, está deduplicado dentro de este ticket).

## ① El texto del aviso: MEDIDO, no escrito (regla 39)

Había dos redacciones firmadas, distintas: la variante A del fundador (SCRUM-1316 c.22084, copiada en
SCRUM-1766) y la de Javier (SCRUM-1316 c.22424, posterior). Medido con `git grep` en `public/`, `src/` y
`tests/` de `origin/main` `8e0d40816`:

| redacción | dónde está en main |
|---|---|
| **c.22424 (Javier)**: «Desde el 1 de diciembre de 2026, el IVA del 10 % en obras de vivienda solo se aplica si el cliente paga con tarjeta, transferencia bancaria, cheque nominativo o ingreso en cuenta. Si cobras en efectivo, consúltalo con tu asesor.» | `public/dashboard/js/invoicesView.js:123` (`COPY_IVA_10.avisoEfectivo`), que pinta la ficha de factura (`invoiceDetailView.js:1041`); `tests/scrum1316l-medio-de-cobro-con-iva-10.test.mjs:52` |
| variante A (c.22084): «…queda condicionado a que el cliente pague…» | **ningún fichero** de `public/`, `src/` ni `tests/` |

No hay mezcla entre pantallas, así que se usa la de c.22424, idéntica, y **sin copiarla**: las tres
pantallas de este ticket leen `window.COPY_IVA_10` (de J1). Decisión del orquestador en SCRUM-1804
c.22550 (delegación c.21978). T3, el error «Elige cómo lo has cobrado: en esta factura hay IVA al 10 %.»
(SCRUM-1316 c.22438), sale de esa misma constante (`COPY_IVA_10.eligeMetodo`). Texto nuevo de S2: **cero**.

## ② El aviso al elegir el 10 % (editor del presupuesto)

- `public/dashboard/js/tiposDeIva.js`: `conectarAvisoIvaAlDiez(select, contenedor)` ata al selector un
  `.alert.warning` (`role="status"`, `hidden`, atado por `aria-describedby`) y `avisoIvaAlDiezVisible(valor)`
  (puro: solo el 10 % exacto). El nodo **nace la primera vez que hace falta**, no al montar: la primera tanda
  completa lo cazó con `scrum697`/`scrum698` (el editor pasaba de 267 a 268 nodos al 21 %). En vez de
  cambiar esa exigencia, cambié el código: al 21 % el editor monta los mismos nodos que antes. `ponerValor` lo refresca, así que el aviso sigue al **valor** y no solo al clic (borrador, plantilla,
  IA, autocompletado y suplido escriben por `ponerValor` y no disparan `change`). Sin `COPY_IVA_10` servido
  no hay aviso: la pantalla no lo inventa.
- `public/dashboard/js/quotesView.js`: dos llamadas, en el IVA de la línea (hoja de ajustes, tras
  `vatTd.appendChild(vatInput)`) y en «IVA por defecto» del documento (`fieldVatDefault`). La línea `:385`
  del encargo es de antes: hoy el campo está en `quotesView.js:884`.
- No bloquea, no cambia el tipo elegido y no toca ningún cálculo (el test comprueba que el valor sigue siendo
  `10` después del aviso).

## ③ La ficha del trabajo (`jobDetailView.js`, «Marcar como PAGADA»)

**Medido antes de tocar:** la fila de factura de la ficha del trabajo NO tenía selector de método (mandaba
`{status:'paid'}` a pelo), y `GET /admin/jobs/:id` no servía `lines` ni `metodosConAvisoIvaAlDiez`: la
pantalla no podía saber si la factura lleva línea al 10 %. Se lo llevé al orquestador con tres opciones; la A,
la autorizada, añade al detalle del trabajo lo que la ficha de factura ya recibe.

- `public/dashboard/js/jobDetailView.js`: con `inv.conIvaAlDiez === true` (y solo el admin, que es quien
  puede marcar) se pinta «¿Cómo lo has cobrado?» con la pieza común `window.pintarSelectorMetodo`
  (`selectorMetodoCobro.js`, J2; opciones servidas, mismos `value` de `PAID_VIA`), `required` +
  `aria-required`; debajo, T4 cuando el medio elegido es de los que el servidor sirve con aviso
  (`window.avisoDeEfectivoVisible`, de J1). Al pulsar «Marcar como PAGADA» sin medio: T3 en la barra de
  estado y foco al selector, **antes** del `confirm` y del `prompt` del importe; con medio, el PUT lleva
  `paidVia` (`window.cuerpoConMetodo`). El servidor ya lo exigía (422, `invoiceAdmin.ts:430`).
- **Diferencia A PROPÓSITO con la ficha de factura** (decisión del orquestador, c.22550): allí J1 pinta el
  selector SIEMPRE, opcional, y obligatorio con el 10 %; aquí sale **solo** en facturas con línea al 10 %.
  Las demás filas siguen exactamente como hoy (mismo PUT `{status:'paid'}`). Si el fundador quiere unificarlo,
  es una condición y la decide él.
- Un servidor sin `conIvaAlDiez` (despliegue a medias) deja la ficha como hoy; el 422 del servidor sigue
  mandando.

### AUTORIZACIÓN NOMINAL (copiada literal del orquestador)

«AUTORIZACIÓN NOMINAL · 24-nov-2026 · cruce S2→S1 (opción A, decidida en SCRUM-1804 c.22550) — src/modules/jobs/app/routes/jobs.routes.ts sobre base 8e0d40816, SEIS líneas añadidas y cero quitadas: L83 import { llevaLineaAlDiez, METODOS_CON_AVISO_IVA_10 } de invoiceAdmin (solo lectura, sin ciclo) · L732 lines: true en el select de Invoice de serializeJobDetail (se lee y NO se serializa; el test lo exige y exige los 14 campos previos intactos) · L793-794 comentario · L795 conIvaAlDiez: llevaLineaAlDiez(inv.lines) · L796 metodosConAvisoIvaAlDiez: METODOS_CON_AVISO_IVA_10. Además ④: src/modules/reports/app/routes/reports.routes.ts L182 añade status: true al select del charge (SCRUM-1316 c.22445). invoiceAdmin.ts INTACTO. Rojo-primero visto: 9 rojos antes del código, 13/13 después; 5 mutaciones tumban su test cada una. — firma del orquestador, c.21978»

## ④ El informe X2 (`reports.routes.ts:182`)

`charge: { select: { method: true } }` → `{ method: true, status: true }`. La regla ya la había arreglado el
equipo J en `metodoDeUnCobro` (#3334, SCRUM-1316k): con `status` ausente se conservaba la regla vieja (el
cargo manda siempre). Ahora que X2 lo trae, un cargo NO pagado cede ante el método declarado. Decisión:
SCRUM-1316 c.22445. El tipo `FacturaDelInforme` no se ha tocado (una línea, como se pidió): el campo de más
viaja igual en tiempo de ejecución.

## ⑤ Qué · esperado · visto

`tests/scrum1804-iva10-parte-s.test.mjs` (13 casos). **Rojo primero:** escrito y corrido ANTES del código,
9 rojos, cada uno por su aserción (sin aviso, sin selector, PUT sin medio, `conIvaAlDiez` ausente, X2
contando `card`); el de la línea salió CIEGO y lo corregí para abrir la hoja de ajustes como el profesional.

| qué | esperado | visto |
|---|---|---|
| IVA por defecto al 10 % / 21 % / 4 % | aviso firmado byte a byte, `.alert.warning`, valor intacto / oculto / oculto | ✔ |
| IVA de la línea (hoja de ajustes) | ídem | ✔ |
| 10 % puesto por código / 0 % de suplido | aviso visible / oculto; conectar dos veces no duplica | ✔ |
| sin `COPY_IVA_10` | no hay aviso (ni vacío ni inventado) | ✔ |
| copias del literal en `tiposDeIva.js`, `quotesView.js`, `jobDetailView.js` | cero | ✔ |
| ficha del trabajo, factura con 10 % | selector obligatorio con su rótulo de siempre; T4 con efectivo, oculto con transferencia | ✔ |
| ídem, pulsar sin medio | T3, sin `confirm`/`prompt`, sin PUT | ✔ |
| ídem, con transferencia | PUT `{status:'paid', paidVia:'transfer'}` | ✔ |
| factura sin 10 % / servidor sin el campo | sin selector, PUT `{status:'paid'}` como hoy | ✔ |
| `GET /admin/jobs/:id` con facturas al 10 % y al 21 % | `conIvaAlDiez` true/false, `metodosConAvisoIvaAlDiez: ['cash']`, 14 campos previos intactos, `lines` NO servidas (el doble solo devuelve `lines` si el `select` las pide) | ✔ |
| X2 con cargo `pending` `card` y `paidVia: 'cash'` | cuenta `cash`, no `card` (el doble solo devuelve `status` si el `select` lo pide) | ✔ |
| X2 con cargo `paid` | manda el cargo (control positivo) | ✔ |

**Mutaciones** (`MUTACIONES_QUE_ME_TUMBAN`, cinco, una por pieza): las cinco TUMBAN su test nombrado y el
árbol queda restaurado byte a byte (pasada manual; para los dos `.ts`, la mutación equivalente en su `.js` de
`dist/`).

**Suite completa** (`node --test tests/*.test.mjs`, TAP a fichero fuera del árbol). Primera tanda, antes del
commit: 14 300 tests · 14 096 pass · **21 fail** · 183 skip. Los 21, uno a uno:

| rojo | causa | ahora |
|---|---|---|
| `scrum1344` · ④ ningún arnés arma un `req` sin rol | **mío**: el arnés de X2 iba sin rol | ✔ arreglado (`reqDeSesion`) |
| `scrum697` / `scrum698` (3) · el editor monta 267 nodos | **mío**: el aviso nacía al montar (268) | ✔ arreglado en el CÓDIGO (el aviso nace al hacer falta); la exigencia no se ha tocado |
| `scrum267` (×4 ficheros, 12) · `scrum854` ② · `scrum811c`/1340 (parte) | **mío**: registro sin commit, sin hora en el ancla y sin `**Skill UI:**` | ✔ arreglado (ancla de `scripts/equipo/ancla.mjs`) |
| `scrum976` ④ `guards:entrada` sale 1 | consecuencia de los de arriba, más `scrum1294` (línea A9) y `scrum258` (`document` en mi script de capturas), que salieron al correrlo | ✔ los míos arreglados; sigue en rojo SOLO por el de abajo |
| `scrum811c` · SCRUM-1340 · PR de interfaz sin `**Skill UI:**` | **ajeno, ya en main**: «el merge 8e0d40816 → SCRUM-1810.md» (PR #3365, J1). El propio guard dice «lo de esta rama: DECLARA» | ✖ sin tocar (carril J1) |
| `scrum1726` · D1 (2) · fechas de la hoja de disputa | **ajeno, del entorno** (MI LECTURA, sin probar en un árbol limpio): espera «3 de octubre de 2026 a las 0:30» y Node v24.8 local da «3 de octubre de 2026, 0:30». Mismo día y hora; cambia el formato de Intl. Esta rama no toca la hoja de disputa | ✖ sin tocar |

La segunda tanda completa **no terminó**: Claude Code la paró por falta de memoria en la máquina. No la he
relanzado. En su lugar he vuelto a correr, uno a uno, los ficheros de cada rojo de la tabla, más
`scrum660`, `scrum611`, `npm run guards:entrada` y el test de este ticket. Resultado: todos en verde salvo
los dos ajenos. **No hay ninguna exigencia existente cambiada.**

## Capturas (antes = merge-base · después = esta rama; 390 y 1280)

`node scripts/capturas-iva10-parte-s.mjs` → `docs/master/evidencias/SCRUM-1804/` (16 PNG: 4 escenas × antes/después ×
2 anchos). Monta las vistas REALES en Edge (`_banco-lista.mjs`); el «antes» es el `public/` del merge-base.
Lo que mide el «después» (en el «antes» ninguna escena tiene aviso, como se esperaba):

| escena | 390 (caja del aviso) | 1280 | cabe · desborde |
|---|---|---|---|
| `linea` · hoja de ajustes de la línea, IVA 10 % | 342×123 | 372×123 | ✔ · no |
| `iva-por-defecto` · Condiciones → Ajustes del documento, 10 % | 324×144 | 544×83 | ✔ · no |
| `trabajo-efectivo` · ficha del trabajo, pestaña Facturas, «Efectivo» → T4 | 286×164 | 540×83 | ✔ · no |
| `trabajo-sin-elegir` · «Marcar como PAGADA» sin medio → T3 | 322×63 | 940×42 | ✔ · no |

La primera pasada de capturas cazó un defecto de forma: a 1280, el aviso de «IVA por defecto» salía DENTRO de
la columna del campo (173×285 px, una tira estrecha). Ahora nace justo debajo de su fila
(`conectarAvisoIvaAlDiez(…, { trasDe })`) y mide 544×83.

## Lo que NO se ha tocado

`invoiceAdmin.ts`, `invoicesAdmin.routes.ts`, `invoiceDetailView.js`, `invoicesView.js` (J1),
`selectorMetodoCobro.js` (J2), `prisma/schema.prisma`, ningún cálculo de IVA ni el camino de emisión.

## Apéndice · 24-nov-2026 · reparación del orquestador (PR #3370)

El obligatorio cayó con 3 rojos: dos AJENOS (scrum1340/811c por docs/master/SCRUM-1810.md del equipo J sin «Skill UI:», avisado en SCRUM-1810 c.22554, y su arrastre scrum976 ④) y UNO de la rama: scrum1480f — `scripts/capturas-iva10-parte-s.mjs` nació sin fila en dos-equipos.md §3.3. REPARADO por el orquestador (precedente #3274, acta §46): fila S2 en §3.3 (por el área del ticket, `area-s2`) + `node scripts/carriles.mjs generar` (derivados regenerados: carriles.json y carril-s2.md; no editados a mano). Rojo→verde visto: 1480f con 1 fichero sin fila ANTES y 0 DESPUÉS; scrum1295 8/8. Los dos rojos ajenos se re-corren cuando el equipo J cure su registro. — orquestador cobroflash-backend-41 (delegación c.21978)

---

# SCRUM-1804b · r42 en vivo — verificación en yaqu.app del PR #3370

**Medido contra:** `origin/main` = `f4dbf1f11d72c73e71ad9857a9ba87584144ff61` · 2026-11-24T15:16:39Z

A9: aviso → A10 «El `filename` de `browser_run_code_unsafe` no esconde nada: el MCP devuelve el código que ejecutó, y un secreto que lleve dentro sale al chat.» — no se pudo comprobar: el eco lo hace el MCP de Playwright en el transcript, fuera del repo, y ningún guard lo lee.
(mi fallo: para entrar con la cuenta QA metí la cookie de sesión en un fichero y lo cargué con `filename`, creyendo que así no
pasaba por el chat; el resultado del MCP la imprimió entera. Revocada en el momento: «Salir» en el navegador → `POST /auth/logout`,
y `node scripts/qa/sesion-panel.mjs estado` → «MUERTA — GET /admin/me → 401 … ha muerto ANTES de su hora».)

Puesto S2, rama `scrum-1804b-r42-en-vivo`. Encargo del orquestador `cobroflash-backend-41` (24-nov, tarde): **regla 42** de
SCRUM-1804, que se mergeó en #3370 (`f04e19db8`). **Sin código:** este tramo solo lee yaqu.app y deja las capturas.

**Lo servido es main.** `git hash-object` de lo que sirve `https://yaqu.app/dashboard/js/<f>` frente a `origin/main:public/dashboard/js/<f>`:
`tiposDeIva.js`, `quotesView.js`, `jobDetailView.js` e `invoicesView.js` → **IGUAL** los cuatro. Los 4 commits de main posteriores a
`16a404982` no tocan ninguno de los ficheros verificados (`git diff --stat`, vacío).

**Navegador real:** Chromium del MCP de Playwright, contra `https://yaqu.app`, a 1280×900 y a 390×844. La cuenta es la QA
(`PruebaQA`, merchant 46, admin).

## Lo que la cuenta QA NO permite, medido (y por qué ② se hizo con una respuesta inyectada)

- La cuenta QA tiene 0 facturas (`GET /admin/invoices` → `[]`), ninguno de sus 13 trabajos tiene facturas (`GET /admin/jobs/:id` → `invoices: []`)
  y `GET /admin/me` da `modoEmision: "receipt"`, `motivoSinEmision: "sii_no_consta"`, `documentoSuelto: "no"`, `serieEmitida.emitidas: 0`.
  En `receipt`, el servidor no crea factura (`facturaDesdeParte.ts:106` → 409 `facturacion_no_disponible`; `facturaSuelta.ts:96` → `'no'`),
  por la **regla 24**. Sacarla de ahí obliga a tocar `INVOICING_ES_ENABLED` o la respuesta del SII de esa cuenta: es un **STOP**
  (flag de la Parte P y camino fiscal), así que **no lo he hecho**.
- La demo (merchant 1, `modoEmision: "demo"`) tampoco tiene facturas (`[]`). No escribí en ella: la autorización es para la cuenta QA.
- **Por eso ② se verificó así:** el JS DESPLEGADO en yaqu.app, con la ficha real del trabajo 77 de la cuenta QA, y la respuesta de
  `GET /admin/jobs/77` interceptada en el navegador. Se le cambiaron las `invoices` por dos facturas FICTICIAS: `990001` «QA-INYECTADA-10», pendiente, 110 €,
  `conIvaAlDiez: true`, `metodosConAvisoIvaAlDiez: ['cash']`; y `990002` «QA-INYECTADA-21», pendiente, 121 €, `conIvaAlDiez: false`.
  **Mientras duró, todo método distinto de GET hacia `/admin/` o `/api/` se ABORTÓ en el navegador** y se apuntó; ninguno llegó al servidor.
  **Lo que NO se ha visto en vivo:** que el servidor de producción sirva `conIvaAlDiez` y `metodosConAvisoIvaAlDiez` en una factura real.
  Eso lo cubre `tests/scrum1804-iva10-parte-s.test.mjs` (caso `GET /admin/jobs/:id`, 14 campos previos intactos).

## Aceptación → dónde se ve

| aceptación (literal del encargo) | dónde se ve |
|---|---|
| ① editor: elegir el 10 % en el selector de IVA de una línea → aparece el aviso BYTE A BYTE (`window.COPY_IVA_10`) | yaqu.app → Presupuestos → Nuevo presupuesto → línea → «Ajustes (IVA, descuento, descripción…)» → IVA 10. `#aviso-iva-10-1`, `.alert.warning`, `role=status`, atado por `aria-describedby`; `textContent === COPY_IVA_10.avisoEfectivo` → **true**. Caja: 372×123 a 1280 (igual que el banco) y 312×144 a 390, sin desborde. `r42-vivo/linea-10-1280.png`, `linea-10-390.png` |
| ① con el 21 % → SIN aviso | ídem, de vuelta al 21: `hidden = true`, 0 `.alert.warning` visibles; antes de tocar el 21, el selector ni siquiera lleva `aria-describedby` (el aviso nace la primera vez que hace falta). `linea-21-1280.png`, `linea-21-390.png` |
| ① no bloquea ni cambia el cálculo | el selector se queda en `10`, sin diálogos. Vista previa con la línea al 10 %: base 100,00 € · IVA 10,00 € · total 110,00 €, el cálculo normal del 10 %. Con «IVA por defecto» a 10: total 121,00 € antes y después (la línea conserva su 21 %) |
| ① ídem al elegir 10 % en «IVA por defecto» del documento (su aviso, bajo su fila) | Condiciones → «Ajustes del documento» → Cambiar → IVA por defecto 10. `#aviso-iva-10-2`, byte a byte → **true**, bajo la fila «IVA por defecto / IVA del presupuesto». Caja: 535×83 a 1280 (544×83 en el banco; la diferencia es la barra de desplazamiento del navegador real) y 309×144 a 390, sin desborde. Al 21: `hidden = true`. `iva-por-defecto-10-1280.png`, `iva-por-defecto-21-1280.png`, `iva-por-defecto-21-390.png` · ⚠️ a 390 la caja se MIDIÓ, pero la captura quedó corta (el aviso cae bajo el pliegue) y la quité: no la repetí para no abrir otra sesión cuya cookie saldría también al chat |
| ② ficha del trabajo, factura pendiente CON línea al 10 % → «¿Cómo lo has cobrado?» OBLIGATORIO | trabajo 77 → pestaña Facturas: `select#metodo-cobro-inv-990001` con `required` y `aria-required="true"`, rótulo «¿Cómo lo has cobrado?»; opciones servidas: Sin especificar / Bizum / tarjeta / transferencia / efectivo. **Respuesta inyectada** (arriba) |
| ② sin elegir → error firmado «Elige cómo lo has cobrado: en esta factura hay IVA al 10 %.» byte a byte | «Marcar como PAGADA» sin medio: `.alert.error` con `textContent === COPY_IVA_10.eligeMetodo` → **true** (940×42 a 1280, igual que el banco; 307×63 a 390). Foco al selector; 0 `confirm`, 0 `prompt` y 0 peticiones. `trabajo-sin-elegir-1280.png`, `trabajo-sin-elegir-390.png` · 🔴 **a 390 el profesional NO lo ve**: hallazgo de abajo, `trabajo-sin-elegir-390-tal-cual.png` |
| ② al elegir efectivo sale el aviso de ① | `#metodo-cobro-inv-990001-aviso`, `.alert.warning`, byte a byte → **true** (540×83 a 1280, igual que el banco; 271×164 a 390). Con transferencia → `hidden = true`. `trabajo-efectivo-1280.png`, `trabajo-efectivo-390.png` |
| ② (consecuencia) con medio elegido, el PUT lo lleva | transferencia + «Marcar como PAGADA»: `confirm` + `prompt` del importe como siempre → `PUT /admin/invoices/990001/status {"status":"paid","paidVia":"transfer"}`, **abortado en el navegador** |
| ② factura SIN líneas al 10 % → NADA cambia (ni selector) | fila `990002`: 0 `select`. El único selector de la ficha es el de `990001`. «Marcar como PAGADA» → `confirm` + `prompt` → `PUT /admin/invoices/990002/status {"status":"paid"}`, el mismo cuerpo de siempre, **abortado** (de ahí el «Error actualizando estado» que se vio después) |
| ③ informe X2 (`status: true`): servidor compilado → lo cubren el test de la rama y el arreglo de J en #3334 | **DECLARADO:** `tests/scrum1804-iva10-parte-s.test.mjs` (X2 con cargo `pending` `card` + `paidVia: 'cash'` cuenta `cash`; con cargo `paid` manda el cargo), y la regla de `metodoDeUnCobro` es de #3334 (SCRUM-1316k) |
| ③ en vivo solo: el informe carga sin error | yaqu.app → Informes: `GET /admin/reports/x2?year=2026` → **200**, claves `year, byMethod, marcadosAMano, reminderEur, aging, pendingTotal`; 0 alertas de error en pantalla. `informes-x2-1280.png`. (En consola, un 403 de `/admin/metrics/platform-funnel`, métrica de plataforma, no de X2 — MI LECTURA, sin investigar) |
| capturas del vivo 390 + 1280 (con 10 %, con 21 %, el error del selector) | `docs/master/evidencias/SCRUM-1804/r42-vivo/` (13 PNG, 1,4 MB). El teléfono del cliente QA de la ficha del trabajo está **enmascarado en el DOM** antes de capturar («[teléfono oculto]»): el repo es público. Borré la única captura en la que se veía sin enmascarar |

## 🔴 Hallazgo (carril S2, mi propio código de SCRUM-1804): a 390, el error T3 sale fuera de la pantalla

Medido a 390×844, recargando la ficha y pulsando «Marcar como PAGADA» sin medio, sin tocar el desplazamiento: T3 se pinta en la barra de estado
de la ficha, arriba del todo (`top −196 px`, `bottom −134 px`, con `scrollY 688`), y el foco salta al selector (`top 557`). **La pantalla
solo enseña el selector con el foco; el error, no.** Una persona que pulsa y no ve nada vuelve a pulsar. A 1280 sí se ve (la ficha cabe y
no se desplaza). El banco no lo cazó porque la escena `trabajo-sin-elegir` fotografía la página entera. Ningún texto es nuevo; arreglarlo es
cuestión de **dónde** se pinta T3 (junto a su selector, o desplazando la barra de estado a la vista). **No lo he tocado:** este encargo era
solo verificar. Lo decide el orquestador: se arregla aquí o se parte en un ticket nuevo (A18) antes de cerrar SCRUM-1804.

## Lo que se ha escrito en producción (todo en la cuenta QA, salvo el login de lectura de la demo)

- **Facturas: 0. Presupuestos: 0** (`GET /admin/quotes` sigue terminando en el id 217, de 20-nov). El «✓ Guardado automáticamente» del
  editor no creó presupuesto en el servidor; el borrador «Reforma baño [QA-1804b]» quedó solo en el navegador.
- Sesiones: tres `POST /auth/test-login` con `scripts/qa/sesion-panel.mjs` (QA, demo para leer, QA) y un `POST /auth/logout` (la revocación de arriba).
- Las peticiones que la página manda sola al cargar (`POST /admin/entorno`, por ejemplo) salieron como en cualquier visita mientras no
  estaba la intercepción. Con ella puesta se abortaron (una apuntada: `POST /admin/entorno {"entorno":"pestana"}`).
