# SCRUM-1107 · Retención de garantía de obra — PASO 0, MEDICIÓN Y DISEÑO, sin construir

**Medido contra:** `origin/main` = `5b007193a8c7ac07ada416d7a08131f5b4d67e32` · 2026-09-23T17:57:00Z

23-sep-2026 · **J2** (Clientes y cobro). Encargo del orquestador, decidido por Javier hoy: el
profesional que trabaja para una constructora o la Administración no cobra el 100% de la factura
— se queda un porcentaje (5% habitual, variable por contrato) retenido hasta que pasa el plazo de
garantía de la obra (12 meses habitual). Ese importe es SUYO, se lo deben, y hoy se olvida.
**El problema es el olvido, no el cálculo.** Alcance de esta tanda: **solo PASO 0 — medir y
proponer, no construir nada de código ni tocar el esquema.**

## 1 · Confirmado NO fiscal — el asesor lo dijo con todas las letras

*"La factura se emite por el 100% y el IVA se devenga sobre el 100%; lo retenido es un crédito
pendiente de cobro. Si lo modeláis, va en cobros, no en la factura."*

Esto fija el límite entero de esta tanda: **`Invoice` y el camino de emisión (`emitInvoice`,
`verifactu.service.ts`) no se tocan.** Ningún campo nuevo entra en la huella VeriFactu (los ocho
campos cerrados de `computeVeriFactuHash`), y la factura sigue diciendo el 100% que dice hoy. Si
al construir apareciera la tentación de anotar el porcentaje en `Invoice`, es STOP (regla 40) —
por eso el diseño de abajo lo coloca en `Charge`, no en `Invoice`.

**Tampoco es** un descuento (el cliente debe el 100%, no menos), ni un pago parcial sin más (hay
una FECHA y un MOTIVO contractual, no solo «pagó menos»), ni un impago (no está vencido: está
aplazado por contrato). Confundirlo con cualquiera de los tres haría mentir a los informes de
cobro — `saldoPendiente.ts` (SCRUM-1043, «quién me debe») y `cobros.service.ts` son los primeros
que se leerían mal si el retenido se contara como «ya cobrado» o como «impagado».

## 2 · Dónde vive el dato hoy — medido, no dos veces la pregunta de SCRUM-1050

`Invoice.lines` (`prisma/schema.prisma:816`, `Json?`) es el precedente citado por el encargo
(SCRUM-1050: ampliar un `Json` existente no necesita ALTER) — **pero `lines` es del camino de
emisión** (se sella, entra en el PDF y en el desglose de IVA): meter ahí la retención sería
exactamente el error que el §1 prohíbe, aunque la TÉCNICA (extender un JSON sin ALTER) sea válida
en general.

Buscado un JSON reutilizable en el lado de COBROS, que es donde el asesor dice que va:

- `Charge.payMethods` (`Json?`, `prisma/schema.prisma:469`) — semánticamente es «qué métodos de
  pago están habilitados para este cobro», no un sitio para datos de garantía. Reusarlo mezclaría
  dos conceptos sin relación en la misma columna — descartado.
- **Ningún otro campo `Json` existe en `Charge`.** No hay un cajón flexible ya abierto en el lado
  de cobros: **hace falta ALTER**, y lo decide y lo aplica Javier (A5) — esta tanda solo propone
  las columnas.

## 3 · La relación Invoice↔Charge, medida, porque decide la forma del dato

`Invoice.chargeId` (`Int?`) apunta a **UN** `Charge`; la relación inversa es
`Charge.invoices Invoice[]` (`schema.prisma:490`) — un mismo `Charge` puede saldar VARIAS
facturas (pago consolidado), pero **una factura no puede tener hoy dos `Charge` a la vez** por
esa FK. Eso importa porque la liberación de la garantía, 12 meses después, es un segundo COBRO
en el tiempo — y el esquema de hoy no modela «una factura, dos cobros sucesivos».

**No se propone resolver eso en este ticket.** El encargo lo enmarca como lo que es: *«YaQu
recuerda un dato que el profesional metió»* — un recordatorio, no un segundo objeto de cobro con
su propio ciclo de vida. Cuando llegue el momento de liberar la garantía, el profesional
registraría ese cobro como CUALQUIER OTRO (un `Charge` nuevo, sin necesidad de encadenarlo por FK
al original) y marcaría la retención como liberada. Diseñar el encadenamiento formal (si hiciera
falta) es una decisión de producto que no está pedida hoy — se deja anotada, no resuelta.

## 4 · El diseño propuesto — tres columnas aditivas en `Charge`, NADA en `Invoice`

Seguido el patrón ya usado en esta misma tabla para «un dato que puede no constar» (`paidAt`,
`expiresAt`: nullable, sin `@default`, sin backfill) y NO el patrón de la retención de IRPF del
`Merchant` (dos columnas, `declarada` + `tipo`) — porque ahí «declaro que no retengo IRPF»
necesitaba distinguirse de «no consta», y aquí no hace falta: un `Charge` sin ninguna de las tres
columnas rellenas simplemente NO tiene garantía retenida, que es la lectura natural de `NULL`.

```prisma
// Propuesta, NO aplicada — el ALTER lo decide y ejecuta Javier (A5)
retencionGarantiaPorcentaje Decimal? @db.Decimal(5, 2) @map("retencion_garantia_porcentaje")
retencionGarantiaImporte    Decimal? @db.Decimal(12, 2) @map("retencion_garantia_importe")
retencionGarantiaLiberacion DateTime? @map("retencion_garantia_liberacion")
```

- **Porcentaje** — editable, sin valor fijo por defecto en el ESQUEMA (un `@default(5)` grabaría
  una norma que no hemos visto en ningún contrato). El **5% propuesto en pantalla** es copy y lo
  firma Javier (regla 39): la columna no impone nada, solo lo guarda.
- **Importe** — el valor en euros, no derivado por fórmula en cada lectura: se guarda calculado
  en el momento en que el profesional confirma el cobro parcial, igual que `suplidos` no se
  recalcula en cada consulta sino que se fija una vez.
- **Fecha de liberación** — 🔴 la más importante de las tres, tal como pide el encargo: sin ella,
  el porcentaje anotado no dispara ningún aviso y el ticket no vale nada. Editable, sin `@default`
  calculado en el ESQUEMA (proponer +12 meses es lógica de aplicación, no una columna que se
  rellene sola).

**El invariante a proteger** (el que más le importa al encargo): `retención + recibido = total`,
EXACTO, al céntimo. Con `Charge.amount` ya representando lo efectivamente cobrado (el 95%, en el
ejemplo) y la nueva `retencionGarantiaImporte` el otro 5%, la suma de los dos tiene que igualar el
`Invoice.total` original — éste es el primer caso de test a escribir cuando se construya, con
redondeos de céntimo incluidos (10.000 × 5% = 500 exacto, pero un contrato al 7% sobre una base
no redonda no lo es).

## 5 · Lo que esta tanda NO decide ni construye

- **Ningún ALTER aplicado.** Solo propuesto arriba; lo decide y ejecuta Javier.
- **Ningún código nuevo.** Cero líneas en `src/`.
- **Ningún texto de pantalla.** El copy del recordatorio, del aviso y de los valores por defecto
  (5%, 12 meses) se propone al construir y lo firma Javier (regla 39) — YaQu no asesora sobre qué
  porcentaje corresponde ni si hay derecho a reclamar (regla 7).
- **El disparo del aviso** (cuándo y cómo se le recuerda al profesional que ya puede reclamar) es
  diseño de UI/notificación que tampoco se aborda aquí — depende de que las columnas existan
  primero.
- **El encadenamiento del segundo cobro** (§3) queda expresamente sin resolver, no es un olvido.

## Siguiente paso

Con las tres columnas decididas y el ALTER aplicado por Javier en las tres bases, la construcción
(escribir el importe retenido al confirmar un cobro parcial, leerlo en la ficha del cliente/factura,
y el aviso cuando se acerque la fecha de liberación) cabe en un ticket de tamaño mediano sobre
`src/modules/billing/**`, que es mi área.
