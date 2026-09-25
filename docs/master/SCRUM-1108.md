# SCRUM-1108 · El aviso de la retención de garantía

**Medido contra:** `origin/main` = `dac1f9d7f9cd5237778aa2cd3f9241bd2210855a` · 2026-09-25T15:12:18Z (con SCRUM-1107 ya dentro: #1758, mergeado a las 14:52:02Z)

Carril J2 (cobros). Sesión jv-j2. Rama `scrum-1108-aviso-garantia`.

## 1 · Qué se pedía

SCRUM-1107 guarda cuánto se retuvo por garantía de obra, cuándo se libera y si ya se cobró, pero nadie
volvía a mirar el dato. 1108 pide avisar al profesional cuando llega `retencionGarantiaLiberacion` con
`retencionGarantiaCobrada` todavía a NULL, y que el aviso se apague al cobrar. Límites: regla 28 (J6),
regla 39 (texto firmado), regla 7 (cero asesoramiento) y no tocar el cálculo ni las rutas de 1107.

## 2 · Por qué NO se reusa ningún recordatorio que ya exista

Lo pedía el propio ticket: «reutilizar, no inventar un segundo mecanismo». Se midieron los dos avisos
por fecha de la casa y **ninguno sirve**. Queda escrito para que nadie los reuse sin mirar a quién
escriben:

- **`billing/domain/invoiceReminder.service.ts` escribe al CLIENTE FINAL**, por WhatsApp (plantilla
  `payment_request_es`, días 7 y 14 desde `Invoice.createdAt`, con candados en `Invoice`). Reusarlo
  sería mandarle al cliente «paga la garantía»: asesorar a reclamar (regla 7) y un envío automático
  nuevo fuera de la tabla J6, que para facturas fija «2/factura (7/14d)» y ya los gasta (regla 28).
  Además mira otra población (`Invoice`, no `Charge`). **Parece el candidato y es justo el que no vale.**
- **`maintenance/domain/maintenance.service.ts` sí avisa al profesional, pero por WhatsApp**, y es un
  flujo de propuesta con borrador de presupuesto (J6: «máx 1 propuesta/cliente/90d»). Copiarlo sería
  otro canal automático por WhatsApp → regla 28 → cambio de máster.

## 3 · Lo decidido (orquestador, 25-sep-2026)

- **A, SÍ:** aviso dentro de la aplicación, **derivado**, como SCRUM-171b («aviso, no automatismo»): sin
  columna, sin candado y sin envío, así que la regla 28 no entra. Se apaga solo: en cuanto
  `retencionGarantiaCobrada` pasa a fecha (1107 lo hace en la misma transacción que crea el cobro de la
  liberación), `retencionPendiente` deja de ser cierto.
- **B (correo semanal), NO en este ticket:** `messaging/` no está en el carril de J2 y el cambio es texto
  que ve el usuario. Va en **SCRUM-1116**.
- **La ficha 360 y la lista «quién me debe» cuentan la retención:** dentro de 1108.
- **El literal** propuesto por J2 es «Garantía retenida: {importe} · liberación desde el {dd/mm/aaaa} · sin cobrar».
  Según el orquestador, Javier lo firmó el 25-sep-2026 («Firmo»). **Esa firma llegó a esta sesión de segunda
  mano (reenviada por otra sesión), y el registro `docs/microcopy/` con «Aprobado por el fundador» NO lo
  escribe J2**: al intentarlo se denegó, con razón. Por eso **este PR no lleva texto de pantalla** (ver §7).

## 4 · Lo construido

- `src/modules/billing/domain/garantiasRetenidas.ts` (nuevo): `garantiasRetenidasPorCliente(merchantId,
  customerIds?, ahora)` devuelve por cliente `{ total, count, liberable, proximaLiberacion, aviso,
  retenciones[] }`. Consume `retencionPendiente` de 1107 sin redefinir qué es «pendiente».
  - **Solo cobros `paid`.** Mientras el cobro está `pending`, su factura está `pending` y
    `saldosPendientesPorCliente` ya cuenta el 100 %, lo retenido incluido: sumarlo aquí sería contarlo
    dos veces.
  - **El día se lee en la zona del merchant** (`zonaDelMerchant` + `diaNaturalEn`), tanto «hoy» como la
    liberación. Sacar el día del reloj del proceso es el defecto de SCRUM-735.
  - Suma en céntimos enteros; importes o fechas ilegibles se saltan, no cuentan como cero ni como hoy.
- `GET /admin/customers/:id/detail`: `stats.garantiaRetenida` (ausente si no hay), **aparte** de
  `totalPending`, que sigue siendo solo facturas `pending` (la cifra de SCRUM-1035). El técnico no la
  recibe (dinero, el mismo criterio que el saldo de SCRUM-1043).
- `GET /admin/customers` (con saldo): cada fila lleva `garantiaRetenida`; `conDeuda=1` incluye a quien
  solo debe garantía, y `orden=saldo` suma las dos deudas. `saldoPendiente` no cambia.
- La lista «quién me debe» todavía **no tiene pantalla** (SCRUM-1043 es solo servidor): el dato ya va en
  la respuesta y se pintará cuando exista.

## 5 · Cómo se ha medido

- `tests/scrum1108-aviso-garantia-retenida.test.mjs`: 8 casos. Dos sondas independientes del «se apaga
  al cobrar»: el filtro de la consulta (`where`) y la guarda del código, esta con un doble que devuelve
  los cobros sin filtrar.
- **En rojo primero, por mutación sobre `dist/`**, las cuatro muertas: sin `status: 'paid'` (caen 2),
  sin `retencionPendiente` (caen 2), con el día en UTC en vez de la zona del merchant (cae 1) y con la
  lista sin la garantía en `conDeuda` (cae 1).
- `tests/scrum1035-*` y `tests/scrum1043-*`: sus dobles de Prisma no tenían `charge` ni `merchant`, y la
  ficha y la lista ahora los consultan. Se les añadió un doble vacío (sin ninguna garantía): **no se
  tocó ningún assert**. Antes del arreglo, 6 rojos con la base real; después, 7/7.
- SCRUM-411 cazó `resumirGarantias` exportado sin consumidor: se le quitó el `export` y se prueba por
  `garantiasRetenidasPorCliente`.

## 6 · Fuera, declarado

- ~~**La pantalla de la ficha 360** (§7): espera a que la firma del literal conste en `docs/microcopy/`.~~
  Hecha en SCRUM-1108b (§8).

- El correo semanal y su «✅ ¡No tienes facturas pendientes de cobro!» → **SCRUM-1116**.
- `Charge.customerId` es nullable: una retención sobre un cobro sin cliente no aparece en ninguna ficha
  (no hay a quién atribuirla).
- **La fecha que manda quien declara la retención.** `POST /admin/charges/:id/garantia` (1107) guarda
  `new Date(liberacion)`: un `YYYY-MM-DD` suelto queda en la medianoche UTC. En España (UTC+1/+2) y en
  Canarias el día sale bien; en una zona con desfase negativo saldría un día antes. Cuando exista la
  pantalla que declara la retención, conviene que mande el día anclado a la zona del merchant
  (`inicioDelDiaEn`). Hoy no hay pantalla ni víctima.
  **Arreglado en SCRUM-1108b (§8)**: con la pantalla ya hay víctima posible.

## 7 · La pantalla, preparada y SIN aplicar (aplicada en SCRUM-1108b, §8)

El servidor ya da todo lo que la ficha necesita: `stats.garantiaRetenida.retenciones[]`, con
`importe`, `liberacionDia` (día natural en la zona del merchant, que el navegador no conoce) y `aviso`.
El cambio de `public/dashboard/js/customerDetailView.js` está escrito y medido que aplica sobre este
`main`, pero no entra hasta que alguien con derecho a hacerlo registre la firma en `docs/microcopy/`:

- debajo de las cifras, **una línea por retención** con el literal (clase `.alert warning` si ya llegó la
  fecha, `.alert info` si no; sin CSS nuevo; `textContent`, no `innerHTML`). Una por retención y no una
  suma: con dos fechas distintas, «total · desde la más temprana» diría que todo se libera ya;
- la cifra «Pendiente de cobro» deja de decir «al día ✓» cuando hay garantía sin cobrar (en ese caso es
  falso). No se añade texto: se quita uno.

```js
  // debajo de: wrap.appendChild(kpiGrid);
  (stats.garantiaRetenida?.retenciones || []).forEach((r) => {
    const [y, m, d] = String(r.liberacionDia).split('-');
    const linea = document.createElement('div');
    linea.className = r.aviso ? 'alert warning' : 'alert info';
    linea.textContent = `Garantía retenida: ${fmt(r.importe)} · liberación desde el ${d}/${m}/${y} · sin cobrar`;
    wrap.appendChild(linea);
  });
  // y en la KPI «Pendiente de cobro»: … : (stats.garantiaRetenida ? '' : 'al día ✓')
```

## 8 · SCRUM-1108b — la pantalla, y el día que pinta

**Medido contra:** `origin/main` = `c67243103d5032d0f7ee522f886c0bf8d136efd5` · 2026-09-25T16:55:42Z (con #1765 y #1776, el registro de la firma, dentro)

Rama `scrum-1108b-pantalla-garantia`. Sesión jv-j2.

**El literal** consta en `docs/microcopy/2026-09-25-SCRUM-1108-garantia-retenida.md`, ranura
`garantiaRetenidaFicha` (PR #1776, mergeado a las 16:54:59Z). Esta rama se empujó después: el test
del literal (`constaAprobado`) cae sin ese registro, a propósito.

### Qué cambia

- `public/dashboard/js/customerDetailView.js` — lo de §7, tal cual: una línea por retención con el
  literal firmado, `.alert warning` si la fecha ya llegó e `.alert info` si no (clases existentes, sin
  CSS nuevo), `textContent`; y «al día ✓» se calla cuando hay garantía sin cobrar.
- `src/modules/billing/app/routes/chargesAdmin.routes.ts` — **la nota de §6 deja de ser hipotética y se
  arregla.** `POST /admin/charges/:id/garantia` guardaba `new Date('AAAA-MM-DD')`, la medianoche UTC. Ahora
  un día suelto se guarda como el primer instante de ese día en la zona del merchant
  (`inicioDelDiaEn` + `zonaDelMerchant`, lo mismo que ya usa este fichero desde SCRUM-1093). Un instante
  completo (`…T12:00:00Z`) se respeta tal cual. Y un día que no existe (`2027-02-30`) pasa a ser un 400:
  antes `new Date` lo convertía en el 2 de marzo.
  PASO 0, corrido sobre este `main` antes de tocar nada: `diaNaturalEn(new Date('2027-09-23'), zona)`
  daba `2027-09-23` en Madrid y Canarias y **`2027-09-22` en `America/Mexico_City` y `America/Bogota`**.
  ⚠️ Lo ya guardado antes de este cambio no se reescribe: sólo corrige las declaraciones nuevas.

### Cómo se midió

`tests/scrum1108b-pantalla-garantia.test.mjs`, 11 casos: la ficha PINTADA en el banco de vistas
(no grep), el literal por `constaAprobado`, y la ruta corrida con un doble de prisma en cinco zonas.

- Antes de que entrara #1776: 10 pasan y cae exactamente el del literal. Con #1776 en `main`: 11/11.
- Mutaciones, las cinco muertas (con el registro puesto): quitar el silencio de «al día ✓» (1 fallo) ·
  clase fija `.alert info` (1) · no pintar las líneas (2) · volver a `new Date(crudo)` (2: México y
  Bogotá) · no comprobar que el día existe (1).
- `tests/scrum1107b-rutas-garantia.test.mjs` y `scrum1108-aviso-garantia-retenida` siguen verdes.

### Fuera, declarado

- **La lista «quién me debe»** no tiene pantalla que pinte deuda: ningún `public/dashboard/js/` lee
  `saldoPendiente` ni `garantiaRetenida` (grep sobre este `main`). El registro nombra esa lista como
  sitio del literal; cuando exista la pantalla, usará el mismo.
- El color de la cifra «Pendiente de cobro» sigue en verde con deuda 0 y garantía retenida: §7 decía
  «no se añade texto: se quita uno», y cambiar el color no estaba en lo acordado.

### La tanda entera

`npm test` sobre esta rama (base `c6724310`): **8.334 tests · 8.199 pass · 1 fail · 134 skipped**. El único
fallo es `tests/scrum910d-microcopy-recibo-pendiente.test.mjs` **como fichero**: sus 6 subtests pasan y el
proceso aborta al cerrar con `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c`.
Es el rojo de libuv en Windows que ya estaba censado antes de esta rama; no toca ningún fichero de este
cambio. Repetido 3 veces a solas: el mismo aborto, y los mismos 5 de 5 subtests con aserción pasando.
