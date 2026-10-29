# SCRUM-1445 · Las fechas que se imprimen van en la zona del proceso (UTC) — el PDF del albarán

**Medido contra:** `origin/main` = `f02e48be2c66ae2e0dae8701401c8fcbc4fff14b` · 2026-10-22T10:02:28Z

A9: comprobación → `tests/scrum1445-fechas-del-albaran.test.mjs`

Sesión S1, encargo del orquestador (22-oct), con el trabajo de lectura ya hecho por S4 (traspaso de S4,
19-oct). **Registro NUEVO:** comprobado que `docs/master/SCRUM-1445.md` no existía ni en `main` ni en
ninguna rama remota. El censo de S4 de este ticket vive en `SCRUM-1470.md`, `SCRUM-1471.md` y
`SCRUM-1472.md` y en su mensaje al orquestador. Carril: `albaranPdf.service.ts`, `albaran.service.ts` y
`core/zonaDelMerchant.ts` → **S1** (`node scripts/carriles.mjs de …`).

**El albarán NO es documento fiscal.** Lo que espera firma del fundador en este ticket —las tres líneas
del CONCEPTO de la factura (`albaranes.routes.ts`, `recapitulativa.service.ts`) y la «Fecha:» de la
factura— **no se ha tocado**.

## Qué cambia

| línea (antes) | qué imprime | ahora |
|---|---|---|
| `albaranPdf.service.ts:129-130` `fmtDate` → emisión y entrega/ejecución (`:162`) | «Emitido: … · Entrega/ejecución: …» | **en la zona del negocio** (`zonaDelMerchant`) |
| `albaranPdf.service.ts:129-130` `fmtDate` → `fechaEntrega` (`:204`) | «Fecha de entrega: …» | **en UTC, explícito** (ver abajo: es un DÍA, no un instante) |
| `albaranPdf.service.ts:361-362` `signDate` | «Firmado el …», la fecha que firma el cliente | **en la zona del negocio** |
| `albaranPdf.service.ts:421` `sello` | «Sello temporal: … (hora del servidor)» | **sin tocar** (abajo) |
| `albaran.service.ts:795` | el `select` del negocio que llega al PDF | **añade `timezone`** (sin ella el papel caía siempre a UTC) |

La zona sale del sitio único (`zonaDelMerchant`) y se pasa como `timeZone` en la propia llamada, igual
que el PDF del presupuesto («Firmado el», `pdf.service.ts`) y el recibo. No hay un formateador nuevo.

## 🔴 Lo que habría salido mal aplicando la zona a las tres fechas por igual

El plan que me llegó decía «`fmtDate` → `timeZone: zonaDelMerchant(merchant)`». **`fmtDate` imprimía dos
clases de fecha distintas:**

- **instantes**: `emisionAt` (= `createdAt`), `fecha` (por defecto `now()`; el editor no la envía, sólo la
  API) y `firmadoAt`. En UTC, un albarán de las 00:30 del día 5 en España salía con el 4. **Ésos van en la
  zona del negocio.**
- **un día**: `fechaEntrega` llega del editor como `AAAA-MM-DD` (`jobDetailView.js`, `<input type=date>`)
  y `new Date('2026-10-05')` la guarda a las **00:00 UTC**. En la zona de un negocio al oeste de Greenwich
  (`America/Lima`, −5) eso es el **día 4** por la tarde. **Pasarla por la zona del negocio habría creado
  el defecto contrario.** Va en UTC, que es lo que imprimía ya en producción (proceso en UTC); ahora lo
  dice la llamada y no depende de dónde corra.

## ⛔ El sello temporal — PROPUESTA, no cambio

«Sello temporal: … (hora del servidor)» (`:421-428`) **declara en su rótulo** que es la hora del
servidor. Imprimirlo en la zona del negocio obligaría a cambiar ese texto, y un texto que ve el cliente
lo firma el fundador (regla 39). **Decisión para el fundador:** dejarlo como está (dice la verdad: es
la hora del servidor), o pasarlo a la hora del negocio con un rótulo nuevo que él firme. No propongo
redacción.

## Verificación

`tests/scrum1445-fechas-del-albaran.test.mjs`: genera el **PDF de verdad** y lee su texto, en un proceso
hijo con `TZ` forzada a **UTC** y a **Pacific/Honolulu** (−10). Tiene que dar lo mismo en las dos: si
dependiera del proceso, discreparían.

- Madrid, todo a las 00:30 del día 5 → «Emitido: 05/10/2026», «Entrega/ejecución: 05/10/2026», «Firmado
  el 05 de octubre de 2026», y ni rastro del 4.
- El día de entrega `2026-10-05`, leído **pegado a su rótulo**, sale «05/10/2026» en Madrid, sin zona y
  en **Lima**.
- **Control:** un negocio **sin zona** sigue imprimiendo UTC (el 4). El arreglo sólo le sirve a quien
  tenga la zona puesta: por eso la consulta de SCRUM-1566 (c) cuenta cuántos negocios la tienen.
- Por AST: el `select` del negocio que alimenta al PDF trae `timezone`.

**Mutaciones** (en `dist/` para el PDF y en `src/` para el `select`, restauradas byte a byte), cada una
tumba SÓLO lo suyo y el control sigue verde en las cuatro:

| mutante | caen |
|---|---|
| M1 · los instantes sin `timeZone` | los 2 de «imprime 5» (UTC y Honolulu) |
| M2 · el día de entrega por la zona del negocio | los 2 de «el día no se corre» (cae Lima) |
| M3 · «Firmado el» sin `timeZone` | los 2 de «imprime 5» |
| M4 · el `select` sin `timezone` | el del `select` |

**Tests vecinos:** 11 ficheros (PDF de albarán, sellado, firma, marcadores, censo de fechas) → 113 de
113, 0 saltados.

### Lo que se movió para acompañar el cambio (y por qué no es «tocar el guard»)

- `scripts/_censo-fecha-sin-zona.mjs`: `albaranPdf.service.ts::fmtDate` pasa a `RETIRADAS` con su
  motivo. Lo exige el propio censo (regla 41: mejorar se declara, no desaparece en silencio).
  `::generateAlbaranPdf` **sigue** en `USO`, por el sello.
- `tests/scrum300-albaran-campos.test.mjs`: la caracterización de SCRUM-640 afirmaba «0 llamadas con
  zona» y pedía, con esas palabras, «actualiza este test con la decisión, no lo relajes». Ahora afirma
  **«todas con zona»**, que es más estricto: un formateador nuevo sin zona lo tumba.
- El **fixture** del mismo `scrum300` ponía las fechas a mediodía LOCAL para esquivar la zona del proceso.
  Con el PDF ya independiente de esa zona, **caía en `Pacific/Kiritimati` (+14)**, una de las dos zonas
  del trinquete de zona del CI: medido antes de empujar, 14 de 15 allí. Ahora dice las fechas en UTC, y
  `fechaEntrega` vuelve a medianoche UTC, que es como llega de verdad. **Ninguna aserción cambia.**
  Medido después: los 20 ficheros que generan el PDF del albarán, más el censo de fechas, dan 205 de 207
  (2 saltados, los de base de datos) en Kiritimati y en Midway. Y los 2 ficheros del albarán, 15 de 15 en
  UTC, Madrid, Kiritimati y Midway.

## Comentario falso, arreglado de paso (encargo del orquestador; lo vio S0)

`src/core/documentos/grupoDelPresupuesto.ts:29` decía «Hoy nadie escribe `Merchant.timezone`». **Falso
desde `409e05317` (13-oct-2026, SCRUM-1522e):** el alta la escribe en el mismo `create` que crea el
negocio (`zonaDeAlta`, `auth.service.ts:344`). Medido hoy: es la **única** escritura de `timezone` en
`src/`, y ninguna pantalla la cambia. El comentario dice ahora eso, con el commit. Ningún otro comentario
del árbol afirmaba lo mismo: los de `auth.service.ts:342` y `zonaDeLaProvincia.ts:4` hablan en pasado y
son ciertos.

## Hallazgo de paso, NO arreglado

- **El control ④ de `tests/scrum1093h-censo-fecha-sin-zona.test.mjs` ya no mide lo que dice.** Busca
  `fmtQty` en las líneas 132-134 de `albaranPdf.service.ts` como «`toLocaleString` sobre un número». Pero
  `fmtQty` ya delega en `formatNumeroEs` (SCRUM-743) y no llama a `toLocaleString`, y además ha cambiado de
  línea. Su negativo pasa sin mirar nada. No es de este ticket ni de un fichero con dueño: lo declaro.

## Lo que NO cubre

- La pantalla pública del albarán (`albaranPublicVista.ts`) no imprime fechas: no hay gemelo que alinear.
- `fecha` editada por la API con un `AAAA-MM-DD` se trataría como instante a las 00:00 UTC. El editor no la
  envía (medido: sólo manda `fechaEntrega`). `mesNaturalKey` ya la trata como instante en la zona del
  negocio, así que papel y rotura del mes dicen lo mismo.
- **Producción está congelada** (sirve `fe65a8b7`): esto no se puede ver en yaqu.app hasta que se
  desbloquee el despliegue.

---

# SCRUM-1445 (b) · Censo: ¿cuántos controles de tests/ están anclados a algo que se mueve?

**Medido contra:** `origin/main` = `0077bd1d51a7cb64b1c18d85781117b71936fd38` · 2026-10-22T09:56:47Z

A9: sin fallo que generalice — censo de sólo lectura; no se ha tocado ningún test

Encargo del orquestador (22-oct), a partir del hallazgo de paso de arriba (el control ④ de `scrum1093h`).
**Sólo lectura: no se ha arreglado nada.** Los tests son de S3, o no los reclama nadie: aquí se mide y el
orquestador reparte. Árbol `origin/main` limpio, separado, sin compilar.

## La respuesta: NO es sistémico. Hay UNO que pasa en vacío.

| familia | población | apuntan a algo que ya no está | de ésos, pasan EN VACÍO |
|---|---:|---:|---:|
| **número de línea** (`f.linea >= N`, `lineas[N]`, `.slice(N, M)` sobre `split('\n')`) | **3** comparaciones en 2 controles | 1 control | **1: `scrum1093h` ④** |
| **texto del código** (`X.indexOf('…')`, `.includes`, `/…/.test(X)`, `assert.match(X, /…/)`, con X = un fichero de `src/` o `public/`) | **935** anclas con el fichero resuelto | 97 ausentes: **85** son controles NEGATIVOS a propósito («esto no debe volver»), **12** revisados a mano | **0** |
| **identidad `fichero::nombre`** (en `tests/` y `scripts/`) | **72** (62 distintas) | 16 | **0**: las 16 son fixtures sintéticos o controles hechos para no existir (`estoNoExisteEnNingunSitio`, `src/no/existe.ts`…). Las **56 reales siguen vivas** |

**El que pasa en vacío:** `tests/scrum1093h-censo-fecha-sin-zona.test.mjs:132` (control ④). Busca filas del
censo en las líneas **132-134** de `albaranPdf.service.ts` y exige que no haya ninguna, como prueba de que
`fmtQty` («`toLocaleString` sobre un número») no se acusa. Pero `fmtQty` **ya no llama a `toLocaleString`**
(delega en `formatNumeroEs`, SCRUM-743) y además **cambió de línea**. Su negativo no puede fallar. Su
segunda mitad («el fichero tiene alguna fila») sigue viva gracias al sello temporal. Arreglarlo es de quien
el orquestador decida; no lo toco.

**El otro ancla a línea es sano:** `tests/_huerfanos-en-modulos-vivos.mjs:223` (`?.linea === 4`) mira un
fichero sintético que escribe el propio test. Si se moviera, el control fallaría a la vista.

## Por qué el texto del código sale limpio, y qué NO dice eso

Truco del método: **la tanda está en verde.** Un ancla positiva que ya no estuviera en su fichero haría
caer su test, salvo que pase en vacío. Así que sólo hay que mirar las ausentes, y entre ellas, las que no
tienen forma negativa. Las 12 se revisaron una a una:
- 2 sólo detectan el fin de línea (`includes('\r\n')`);
- 2 son negativas con `|| []` y `deepEqual(…, [])` (`scrum132`);
- 7 miran una cadena DERIVADA, no el fichero tal cual (un `mutado`, un `movido`, el cuerpo de una
  función, el texto sin comentarios) — límite del escáner, no un ancla rota;
- 1 mira un fichero sintético de un banco (`scrum778`).

**Lo que este censo NO puede decir:** si un control NEGATIVO sigue siendo útil. «Esto no debe volver»
pasa igual si se arregló que si alguien lo reescribió con otro nombre (`scrum598` busca «Margen» por cuatro
formas de código concretas). Es una limitación propia de cualquier control negativo por texto, no un ancla
que se ha movido. Tampoco ve anclas que no son literales directos (una cadena armada en tiempo de
ejecución, o un helper que recibe la cadena por parámetro).

## Primer escáner, error propio

La primera pasada dio **45** anclas ausentes no negativas. **33 eran falsas:** varios tests reutilizan el
mismo nombre (`src`, `fuente`) para ficheros distintos, y yo atribuía cada uso a la declaración por nombre
en todo el fichero. Corregido: cada uso se resuelve contra la declaración del bloque más cercano. Con eso,
de 703 anclas resueltas se pasó a 935 y las ausentes por revisar bajaron a 12.

## Evidencia

`docs/master/evidencias/SCRUM-1445/`:
- `censo-anclas.cjs` y `contexto-anclas.cjs`: escriben su intermedio en el temporal del sistema, no en el
  árbol.
- `censo-identidades.cjs`.
- Las dos salidas, `salida-censo-anclas.txt` y `salida-censo-identidades.txt`.

Uso: `node <guion> <árbol> <ruta de typescript>`. Es todo AST: un comentario no cuenta.

## SCRUM-1445c · 23-oct-2026 · S4 · el papel en producción: ¿se ve «Firmado el 05» junto a «Sello 04»?

**Medido contra:** `origin/main` = `6c8706daef7399513e69e6872068aa7bed25b760` · 2026-10-23T12:34:27Z ·
`yaqu.app/version` = el mismo SHA (cabecera `Date` 12:28:10Z).

A9: comprobación → `docs/master/evidencias/SCRUM-1445/1445c-visto/sonda-pdf-albaran.mjs`

Encargo del orquestador: con producción sirviendo ya #2675, mirar en un albarán de verdad si el mismo
papel imprime «Firmado el 05» y «Sello temporal: 04/10/2026, 22:30:00 (hora del servidor)». Solo GET
con `scripts/qa/sesion-panel.mjs` (cuenta `luisdragonball+qa@gmail.com`, merchant 46). **No se ha
firmado ni creado nada.**

**Respuesta: en la cuenta QA no se puede ver a ninguna hora.** Lo medido:

| qué | ruta | lo recibido |
|---|---|---|
| zona del merchant QA | `GET /admin/merchant` → 200 | `"timezone": null`, `"country": "ES"` → `zonaDelMerchant` cae a `'UTC'` |
| zona del PROCESO | `GET /admin/albaranes/47/pdf` → 200, 3351 B | `firmadoAt` 2026-10-14T07:50:59.626Z → «Sello temporal 14/10/2026, 07:50:59 (hora del servidor)»: el proceso de Railway va en **UTC** (medido, ya no supuesto) |
| «Firmado el» del mismo papel | ídem | «Firmado el 14 de octubre de 2026» |
| control del extractor | ídem, y `#46` | el número (`AB260002`, `AB260001`) sale en el texto extraído; sin él la fila sería CIEGA |

**Por qué no se puede ver la contradicción en QA.** Con `timezone` null, «Firmado el» y el sello salen los
dos en UTC: no se contradicen nunca. **Pero los dos dan la VÍSPERA** en una firma de 00:00 a 02:00 de
Madrid: el merchant sin zona tiene un defecto distinto, que tampoco está bien. Y no se puede forzar:
`firmadoAt` es el `new Date()` del servidor al firmar (`albaranes.routes.ts:1069`), ninguna ruta
cambia `Merchant.timezone` (sólo la escribe el alta, `auth.service.ts:347`), y firmar en QA exige el
perfil fiscal relleno (R25), que sigue a null. **No se crea otro merchant:** además del permiso, la puerta
de SCRUM-390 (`puertaClienteReal.ts`, cron diario) se abre con más de 13 merchants y avisa al fundador por
WhatsApp (aviso del orquestador, 23-oct).

**Quién la verá (MI LECTURA del código, no vista en papel):** todo merchant ES dado de alta desde
`409e05317` (SCRUM-1522e, 13-oct), que nace con `Europe/Madrid` o `Atlantic/Canary`, y firme entre las
00:00 y las 02:00 de Madrid (en Canarias, de 00:00 a 01:00). «Firmado el» usa la zona del negocio
(`albaranPdf.service.ts:379`) y el sello no lleva `timeZone` (`:438`). La decisión A/B/C del sello es la
firma pendiente de SCRUM-1470 y no se toca aquí.

Evidencia en `docs/master/evidencias/SCRUM-1445/1445c-visto/`: la sonda, los dos PDF, su texto extraído y la
salida. Uso: `node sonda-pdf-albaran.mjs <árbol> <id>...` (sale 2, CIEGO, si el número no aparece).
