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
