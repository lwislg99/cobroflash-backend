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

## 6 · La cuarta pregunta: falta decir CUÁNDO SE COBRÓ — respondida, cambia el diseño

El orquestador midió el hueco correcto: las tres columnas del §4 dicen cuánto y cuándo se PUEDE
reclamar, pero no si YA SE RECLAMÓ. Sin eso, el aviso dispararía para siempre sobre un dinero ya
ingresado — peor que no avisar, porque el profesional deja de creerse los avisos.

**① ¿Cuarta columna o `Charge` nuevo?** Las dos cosas, no una u otra — son preguntas distintas:

- **El DINERO que entra** (la liberación real de los 500€, o 480€ si hubo un desperfecto) debe
  pasar por el mismo camino que CUALQUIER otro cobro: un `Charge` NUEVO, normal, confirmado con
  el mismo mecanismo que ya existe (`confirm-bizum` u homólogo). No es un capricho de diseño: es
  el mismo principio que ya cerró SCRUM-397 (`instanteDeCobro.ts`, «UN SOLO GENERADOR, no dos
  asignaciones que se parecen» — el motivo exacto por el que ese ticket existió es que TRES
  sitios daban tres respuestas sobre «cuándo se cobró»). Si el importe liberado viviera en un
  campo aparte del retenido, `saldoPendiente.ts` y `cobros.service.ts` tendrían que aprender a
  sumar DOS fuentes de «dinero cobrado» en vez de una, y ésa es la clase de bifurcación que ya
  causó un ticket entero. El `Charge` nuevo no necesita un FK formal de vuelta a la factura
  original — `Invoice.chargeId` ya lo ocupa el cobro inicial (§3) — se relaciona por el mismo
  cliente, igual que hoy cualquier cobro se relaciona por `customerId`.
- **La cuarta columna SÍ hace falta**, pero es MÁS PEQUEÑA de lo que parece: no es «cuánto se
  cobró» (eso ya lo tiene el `Charge` nuevo, en su propio `amount`) — es solo **«¿sigue pendiente
  este recordatorio, o ya se resolvió?»**, para que el aviso sepa cuándo callarse.

**② ¿Solo fecha, o también importe?** **Solo fecha.** El importe REAL cobrado (500€, o 480€ con
el desperfecto descontado) ya vive en `Charge.amount` del cobro nuevo — duplicarlo en la fila de
la retención original sería el mismo defecto de «dos sitios que dicen cuánto» que el punto ① acaba
de evitar para el DINERO; repetirlo para el IMPORTE sería la misma grieta un nivel más abajo.

```prisma
// Cuarta columna, añadida a la propuesta del §4 — sigue SIN aplicar
retencionGarantiaCobrada DateTime? @map("retencion_garantia_cobrada")
```

### ✅ APLICADO — las tres bases

Javier aplicó el DDL del §7 en **producción y staging** el 23-sep-2026 («Query ran successfully»
en las dos). **DEV, aplicado por J2** el mismo día con `node scripts/aplicar-sql-dev.mjs --file
docs/sql/scrum-1107-retencion-garantia-obra.sql --go` (destino confirmado ANTES:
`acela.proxy.rlwy.net/yaqu_dev_javier`, el único que ese script acepta). El SQL del fichero es
BYTE A BYTE el mismo que se aplicó en las otras dos — no se reescribió.

**Verificado leyendo el catálogo** (no el mensaje de «aplicado»): `information_schema.columns`
sobre `yaqu_dev_javier.charges` devuelve las cuatro, con el tipo, la nulabilidad y el `NULL`
esperados —

| columna | tipo | nullable | default |
|---|---|---|---|
| `retencion_garantia_cobrada` | `timestamp without time zone` | `YES` | ninguno |
| `retencion_garantia_importe` | `numeric(12,2)` | `YES` | ninguno |
| `retencion_garantia_liberacion` | `timestamp without time zone` | `YES` | ninguno |
| `retencion_garantia_porcentaje` | `numeric(5,2)` | `YES` | ninguno |

**Las tres bases tienen ya las cuatro columnas.** El paso ③ de A5 (esquema + código + tests en un
PR) puede empezar.

`NULL` = pendiente de reclamar (el aviso sigue vivo); con fecha = resuelto, el profesional marcó
que ya entró (el aviso se apaga). La cifra exacta que entró, si difiere de la retenida, se lee del
`Charge` nuevo — no de aquí. El invariante del §4 (`retención + recibido = total`) sigue siendo el
control del cobro INICIAL; el cobro de la LIBERACIÓN es un segundo hecho independiente, con su
propio importe, que puede no coincidir con lo retenido (ahí está el desperfecto) — y eso no es un
error del sistema, es la realidad que el ticket pide poder anotar.

## 7 · El DDL exacto — generado, no escrito a mano

Pedido por el orquestador para poder llevárselo a Javier: `node scripts/preview-migracion.mjs
--desde <viejo.prisma>` en modo offline (compara dos ficheros de esquema, no toca ninguna base).
`prisma/schema.prisma` de este worktree se modificó SOLO para generar el DDL de abajo y se
revirtió a continuación — no se empuja (regla A5: la decisión y el ALTER son de Javier; el PR con
esquema + código + tests va DESPUÉS de que él lo aplique).

```sql
-- AlterTable
ALTER TABLE "charges" ADD COLUMN     "retencion_garantia_cobrada" TIMESTAMP(3),
ADD COLUMN     "retencion_garantia_importe" DECIMAL(12,2),
ADD COLUMN     "retencion_garantia_liberacion" TIMESTAMP(3),
ADD COLUMN     "retencion_garantia_porcentaje" DECIMAL(5,2);
```

**Veredicto de `preview-migracion.mjs`:** control positivo pasado (herramienta responde, 30
tablas vistas) · **aditiva: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL.**

**Árbol limpio tras generarlo, verificado por CONTENIDO, no solo porque el comando no fallara:**
`git checkout -- prisma/schema.prisma`, luego `git status --short` (no lista `schema.prisma`) Y
`sha256sum` del fichero en el árbol contra la copia intacta guardada antes de tocarlo — **hash
idéntico** (`4084abc3…9a77a2` los dos). El esquema del worktree quedó exactamente como estaba.

## Siguiente paso

Con las cuatro columnas decididas y el ALTER aplicado por Javier en las tres bases, la construcción
(escribir el importe retenido al confirmar un cobro parcial, leerlo en la ficha del cliente/factura,
y el aviso cuando se acerque la fecha de liberación) cabe en un ticket de tamaño mediano sobre
`src/modules/billing/**`, que es mi área.
