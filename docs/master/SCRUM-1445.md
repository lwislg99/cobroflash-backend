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

---

## SCRUM-1445d · 16-nov-2026 · J1 (jv-j1f2) · FASE 1: las 4 funciones de borde fiscal aceptan la zona del comercio

**Medido contra:** `origin/main` = `37947dc1522a094320a4499eac28800f38cdc659` · 2026-11-16T15:34:09Z

A9: comprobación → `tests/scrum1445d-bordes-fiscales-en-la-zona.test.mjs`

**Encargo:** la decisión del fundador de SCRUM-1445 c.21896 («arreglarlo en el código, sin tocar TZ»),
partida en dos por el plan de c.21898 (jv-j1f1). Esta es la FASE 1: las cuatro funciones de borde reciben
la zona y calculan en ella, **sin cambiar a ningún llamador**. La FASE 2 (los ~12 llamadores leen
`merchant.timezone` y la pasan con `zonaDelMerchant`) va en otra sesión.

### Qué cambia (carril J1, `carriles.mjs de` comprobado en los cuatro ficheros)

| función | fichero | con `zona` | sin `zona` |
| --- | --- | --- | --- |
| `rangoTrimestre` (+ `rangoDeMesesEn`, nueva y exportada) | `src/modules/fiscal/modelo303/modelo303.ts` | bordes con `inicioDelDiaEn`/`finDelDiaEn` de esa zona | lo de siempre |
| `rangoAcumulado` y el aviso `alta_a_mitad_de_ejercicio` (`construirBorrador130`, parámetro `zona`) | `src/modules/fiscal/modelo130/modelo130.ts` | ídem; el 2-ene empieza a las 00:00 del comercio | lo de siempre |
| `topeDeDevengo` / `fechaDeDevengo` | `src/modules/invoicing/domain/devengoPorCaja.ts` | el año de la operación con `diaNaturalEn`, y el 31-dic de X+1 con `finDelDiaEn` | lo de siempre |
| `leerPorCaja` (por `RangoLibro.zona`) | `src/modules/invoicing/domain/libroRegistro.repo.ts` | años y bordes de la consulta de candidatas, y la fecha de devengo, en la zona | lo de siempre |

**El valor por defecto es la zona del PROCESO, no `ZONA_POR_DEFECTO`.** jv-j1f1 recomendaba UTC por
defecto (c.21898); el encargo de esta fase pide «el valor que tienen hoy por defecto, para que los
llamadores sigan dando lo mismo», y hoy es la zona del proceso. Con UTC, la suite podía cambiar en el
trinquete de zona (Kiritimati/Midway), que es justo el riesgo que jv-j1f1 dejó sin medir. En la FASE 2
cada llamador pasa `zonaDelMerchant(merchant)`, que ya da `'UTC'` para un comercio sin zona: el defecto
«zona del proceso» se queda sin llamadores y se puede quitar.

`src/core/zonaDelMerchant.ts` (S1) se importa, no se toca. El DEFECTO_CONOCIDO ② de
`tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs` **sigue declarado**: llama a `rangoTrimestre`
sin zona, y sin zona nada cambia. Lo retira la FASE 2.

### Rojo primero

`tests/scrum1445d-bordes-fiscales-en-la-zona.test.mjs` fija `process.env.TZ` ANTES de cargar `dist/`
(jv-j3cf cazó que `TZ=X node` desde Git Bash no llega), y cada caso con zona se corre con el proceso en UTC
y en Pacific/Kiritimati, con un control que comprueba que el proceso VE esa zona (si no, sale CIEGO).
Casos A–G de c.21891 con la zona a mano, más tope, libro por caja y aviso de alta.

| pasada | resultado |
| --- | --- |
| `dist/` de `origin/main` (sin el cambio) | 6 casos · **5 fallan** (los cinco «con zona») · 1 pasa («sin zona, lo de siempre») |
| con el cambio | 6 · 6 pasan · 0 fallan |

### Mutaciones (con `aplicarUna` y `correr` de `scripts/meta-guard-mutaciones.mjs`)

**9 probadas: 8 VIVAS (el test cae) y 1 MUDA.** La muda era el año (`añoDesde`/`añoHasta`, entonces una flecha `añoDe`) del proceso dentro de
`leerPorCaja`: con un rango de trimestre alineado en la zona, el año del proceso sólo ENSANCHA la consulta
de candidatas, y el filtro por `fechaDeDevengo` deja el mismo libro. No la he declarado; el motivo va en
un comentario en `MUTACIONES_QUE_ME_TUMBAN`. Las 8 declaradas son las vivas.

### No hecho / no medido

- **FASE 2** (llamadores y `merchant.timezone`): otra sesión.
- **El año del XML VeriFactu exportado** (`verifactu.service.ts`): es camino de emisión (regla 38). Aquí
  no se lee ni se fija. Su test DEFECTO_CONOCIDO **no lo he escrito**: no lo he encontrado ya escrito y no
  me cabía en esta sesión. Queda para la FASE 2 o para su propio ticket.
- S1 (`reports.routes.ts`, crons, métricas, gastos, exports) y el censo `_censo-fecha-sin-zona` (S0): no
  tocados.
- yaqu.app: nada visible cambia (ningún llamador pasa la zona todavía), así que no hay nada que mirar allí.

### Errores propios

- Lancé `node scripts/meta-guard-mutaciones.mjs --help` para ver sus opciones: **no tiene `--help`**, y
  arrancó el meta-guard ENTERO sobre el árbol. Lo paré a los 120 s y se dejó puesta una mutación
  (`if (false)` en `scripts/censo-clics-del-80.mjs`). La devolví a sus bytes y lo comprobé con
  `git hash-object` = blob de HEAD (`ef47f59c`). Sin comprobación: un `--help` que no existe no lo para
  ningún guard; queda como aviso en mis cicatrices.
- El primer verde no salió: el test esperaba el 1-oct de Canarias a UTC+0, y aún va en verano (UTC+1). El
  código acertaba; corregí lo esperado.
- Mi driver de mutaciones llamó a `instalarRedDeSeguridad()` sin argumentos y su manejador de salida
  reventó al acabar (salida 1). Las 9 mutaciones ya habían terminado y el árbol estaba limpio
  (`git status` vacío).

## SCRUM-1445f · 18-nov-2026 · J1 (jv-j1fa, relevo de jv-j1f7) · FASE 2: los lectores de J1 pasan la zona del comercio

**Medido contra:** `origin/main` = `6c5327559bb8e17f1ecad128f99331ee16b31a2f` · 2026-11-18T04:34:55Z

A9: comprobación → `tests/scrum1445f-los-lectores-pasan-la-zona.test.mjs`

Decisión del fundador: SCRUM-1445 c.21896 («arreglarlo en el código, sin tocar TZ»). Plan: c.21898; fase 1: c.21937; código de esta fase (jv-j1f7): c.21950.

- **Código** (jv-j1f7, commit 11180aa8c): `src/modules/invoicing/domain/zonaDelLibro.ts` (`zonaDelMerchantParaElLibro`: lee `merchant.timezone`, sin zona da UTC, y PARA si el merchant no existe). Lo llaman 303, 130, 347, retenciones (x2), libros AEAT (x2) y el paquete de evidencias; el 390 lo hereda del 303.
- **Test nuevo** (este relevo): los 8 lectores piden el periodo en la zona del comercio (Madrid, Canarias y sin zona) con el proceso en UTC; casos A, D, E y F de c.21891 y el suelo. **Rojo en `origin/main`: 10 de 14** (los 8 lectores y A y D; E, F, el suelo y el control pasan, como deben en UTC). Verde en la rama: 14/14.
- **Mutaciones** con `aplicarUna` y `correr`: 10 declaradas, 10 vivas. Más las 3 anclas que la fase 2 había dejado caducadas (scrum836): `scrum1065e`, `scrum1066h` y `scrum1067b`, puestas al texto nuevo; las 3 vivas.
- **Fakes** de 10 ficheros de tests (1040, 1063b, 1065b, 1065e, 1066c, 1066e, 1067b, 1077, 1721, 426): el comercio falso declara la zona del PROCESO, porque sus fixtures son hora local; 1065e y 1066c cuentan la lectura nueva. Los 21 ficheros de los lectores: 151 pasan + 5 saltados (`LIBRO_PG_URL`) de 156, en UTC, Kiritimati, Midway y Canarias.
- **Suite por tramos** (15): tramos 1-14 corridos. Rojos de entorno: 1298b (2) en el 3 y 351 (1) en el 9. Dos rojos míos, arreglados en el código y vueltos a correr: `scrum1415` (títulos de test construidos, en el 5) y `scrum836` (en el 14). `scrum854` (14) pedía este registro. **El tramo 15 NO se ha corrido** (contexto); los tramos 1-13 se corrieron antes de los dos arreglos de anclas y títulos. Build con tipos (`tsc -p .`): salida 0.

**NO HECHO:** el DEFECTO_CONOCIDO ② de `scrum1055b` sigue declarado (no lo he mirado); el año del XML VeriFactu (`verifactu.service.ts`, camino de emisión) sigue sin su test DEFECTO_CONOCIDO; `libroRegistro.routes.ts` sin decidir. **Para Luis:** S1 `reports.routes.ts` (rangoTrimestre sin zona), `cron.ts`, `exports.routes.ts`, métricas y gastos; S0 el censo de `new Date(a, b, …)`. yaqu.app no mirado: sin comercio con zona y con facturación, no se ve nada.

**Error propio:** el primer `test()` de los lectores llevaba el título construido con `${l.nombre}`, y lo cazó `scrum1415` en la suite. Ya lo dice A10 («Una prohibición sin mecanismo es una frase»): aquí el mecanismo existía y funcionó; el error fue no correr antes los guards que leen `tests/`.

## SCRUM-1445g · 18-nov-2026 · J1 (jv-j1fc) · los dos rojos informativos que dejó 1445f en main: el trinquete de zona en scrum295 y el MUDO de scrum1065b

**Medido contra:** `origin/main` = `65b2e3b2a03a4a5cb6119b9b7e33465b89494769` · 2026-11-18T05:09:19Z

A9: aviso → cicatriz J1 «Empujé 1445f con el 303 contra Postgres visto en local como SKIP (sin `LIBRO_PG_URL`), y lo cazó en CI el trinquete de zona, un job no obligatorio que no paró el merge» — no se pudo comprobar: el job que lo caza no es obligatorio, y hacerlo obligatorio es un workflow (S5 y fundador)

Mutaciones: `scrum1065b` 10 declaradas, 10 vivas (con `aplicarUna` y `correr`; antes, 9 vivas y 1 MUDA). `scrum295` (gateado por `LIBRO_PG_URL`, sin declaración: el meta-guard del CI no tiene base y lo contaría como pasado) a mano en `dist/`: el 303 con la zona forzada a UTC y a Canarias, las 2 caen; antes del arreglo, la de UTC salía VERDE.

Los dos jobs de #3202 (run 44238444994) que no son obligatorios, y por eso #3202 entró en main: «La tanda entera en dos zonas extremas» y «Cada guard cae con la mutación que declara». Se arreglan los TESTS; ni el trinquete ni el meta-guard se tocan (regla 41), y el producto no está mal.

### (b) `tests/scrum1065b-borrador-130.test.mjs` · MUDO

- **Cuál:** la #1, `desde: new Date(año, 0, 1, 0, 0, 0, 0)` → `(t - 1) * 3`, con `cae` «cifras a mano». Medido: limpia 9/9; mutada, «cifras a mano» PASA y cae otro («cambio de año»).
- **Por qué:** «cifras a mano» va por `leerBorrador130`, que desde 1445f pasa la zona del comercio, así que `rangoAcumulado` toma la rama CON zona (`rangoDeMesesEn`). La línea mutada es la rama SIN zona («la del proceso, como hasta hoy»): sigue existiendo y la usa `construirBorrador130` sin zona, pero el test que la declaraba ya no pasaba por ella.
- **Arreglo, en el test:** «cifras a mano» comprueba además que, con el comercio en la zona del proceso, las dos ramas dan el MISMO acumulado (`r.desde`/`r.hasta` del lector = `rangoAcumulado(2026, t)` sin zona). La declaración no cambia. 10/10 vivas; 9/9 en Kiritimati y en Midway.

### (a) `tests/scrum295-modelo-303-postgres.test.mjs` · el trinquete de zona

Banco DESECHABLE, sin Postgres en la máquina: PGlite 0.5.8 + pglite-socket 0.2.11 (`maxConnections: 64`) en loopback, base `yaqu_libro_test`, esquema de `migrate diff --from-empty` (34 `CREATE TABLE`, 34 `model`), PGlite nuevo por zona, `TZ` en el entorno del hijo (el prefijo `TZ=` de Git Bash no llega a node: lo comprobé con una sonda).

| pasada | UTC | Kiritimati (+14) | Midway (−11) |
|---|---|---|---|
| test de `HEAD` (antes) | 1/1 | 1/1 | **0/1**: «la factura del PRIMER instante del trimestre … se ha caído entre dos trimestres» |
| arreglado | 1/1 | 1/1 | 1/1 |
| arreglado, con el 303 forzado a UTC en `dist/` | **0/1** | — | — |
| arreglado, con el 303 forzado a Canarias en `dist/` | **0/1** | — | — |

**Dos defectos, los dos del TEST:**
1. Los bordes del 2T iban en hora LOCAL del proceso y los comercios se sembraban sin `timezone`. Desde 1445f el 303 lee la zona del comercio (sin ella, UTC), así que en Midway el borde de entrada y el ms anterior entran los dos. Arreglo ①: los dos comercios con `timezone: 'Europe/Madrid'` y los bordes escritos como instantes (`2026-03-31T22:00:00.000Z`, `2026-06-30T21:59:59.999Z`).
2. **Los bordes eran simétricos.** FUERA-DESPUES llevaba las mismas líneas que BORDE-INI (base 100 al 21 %): un trimestre corrido hacia delante perdía una y ganaba la otra, y la 07, la 04 y la 27 cuadraban igual. Por eso el test de `HEAD` salía VERDE en Kiritimati, y por eso la primera mutación (303 a UTC con el comercio en Madrid) salió MUDA con el arreglo ① ya puesto. Arreglo: las dos de fuera con importes propios (3.000 y 5.000).

② El producto no está mal: con zona, el 303 calcula en la del comercio y sin ella en UTC, como decidió el fundador (c.21896). ③ `CENSADAS` no se toca.

### Lo que se ha corrido

- Los dos ficheros, en UTC, Kiritimati y Midway (tablas de arriba). Guards de registro y de tests: en la entrega. Suite por tramos: en la entrega, con los tramos que no corran nombrados.
- `src/` no se toca: ni build con tipos ni yaqu.app (no hay nada que ver allí).

**Error propio:** mi primera pasada en las dos zonas fue con `TZ=Pacific/… node` desde Git Bash, y salió 9/9 en las dos sin haber cambiado de zona (el proceso seguía en Europe/London). Lo cacé al imprimir `new Date(2026, 0, 1)`; la lección ya está escrita en el trinquete (`scripts/_trinquete-de-zona.mjs`, «LA SONDA»), y por eso el lanzador del banco imprime la zona que ve el hijo en cada línea.
