# SCRUM-1624 · portal del cliente: con descuento GLOBAL, las líneas suman más que el total — medición y propuesta para firma

**Medido contra:** `origin/main` = `540c62bc257c0c9ad0a42c4649e3dea0da7e442f` · 2026-10-27T15:45:34Z (cabecera `Date` de GitHub)

A9: sin fallo que generalice — tramo de solo lectura y propuesta; no se ha construido nada, no hay test que pudiera haber salido mal, y las cifras del ejemplo se sacaron a mano de las fórmulas citadas (dicho abajo como «no medido»)

Lo escribe J2 (`jv-j2bn`). **Solo medición y propuesta: no se toca `src/`** (regla 39: el texto nuevo pide firma). Carril del fichero que se tocaría después: J2 (`node scripts/carriles.mjs de src/modules/system/app/routes/customerPortal.routes.ts`, `dos-equipos.md:125`; SCRUM-1568 c.21060). Leído también la rama de #2934 (`scrum-1568-portal-linea-con-descuento` @ `606e49cf0`, ABIERTO a la hora del ancla) sin tocarla.

## 1 · Qué ve hoy el cliente (medido leyendo el código)

Tarjeta del PRESUPUESTO del portal, `src/modules/system/app/routes/customerPortal.routes.ts`:

- `:351` (main) · cada línea = `Number(l.qty||1) * Number(l.price||0) * (1 + Number(l.tax||0))`: ni descuento de línea ni global.
- Con #2934 (rama, `:249-251`) · cada línea = `calcTotal([l])`: lleva el descuento de LÍNEA, no el global.
- `:380` (main) · el total de la tarjeta = `q.total`, el guardado por `calcTotal(lineas, discountGlobalAmount)` (`src/modules/quotes/app/routes/quotes.routes.ts:145`), que SÍ resta el global con su IVA (`src/core/utils/utils.ts:247-269`).
- La consulta (`:262`) es un `findMany` sin `select`: `discountGlobalAmount` ya llega a la ruta. No hace falta tocar la consulta.
- No hay ninguna fila ni texto que explique la resta.

## 2 · Cómo lo resuelven la firma y el PDF

Los dos sacan el pie de `pieDePresupuesto` (`src/modules/quotes/domain/presentacionIva.ts:109`). Rótulos literales (`:153-157`):

- `'Suma de líneas:'` · `'Descuento:'` · `'Descuento global:'` · `'Base imponible:'` · y una fila `IVA <tipo>%:` por tipo (`:181`).
- PDF (`src/modules/invoicing/infra/pdf/pdf.service.ts:1211-1225`): pinta cada fila tal cual, con dos puntos, y debajo «Total presupuesto: …» (`:1238`).
- Página de firma (`src/modules/system/app/routes/quoteDecisionLanding.routes.ts:480-494`): las mismas filas sin los dos puntos y el IVA como «IVA (21%)». Firma: SCRUM-888 c.15788 (citado en `:472`).

🔴 **Diferencia que decide la propuesta:** el pie de la firma y del PDF va **SIN IVA**. «Descuento global» resta de la BASE (`presentacionIva.ts:155`), y las líneas del PDF y de la firma son el neto `qty × price` (`pdf.service.ts:1100`, `quoteDecisionLanding.routes.ts:323`). Las líneas del portal llevan IVA. Así que una fila «Descuento global» con la cifra del PDF NO hace que el portal cuadre: el hueco del portal es el global **con su IVA**.

## 3 · El literal que el portal YA enseña

La tarjeta de FACTURA del mismo portal ya pinta una fila «Descuento global»:

- `src/modules/invoicing/domain/invoiceLines.service.ts:46` · `ROTULO_DESCUENTO_GLOBAL = 'Descuento global'`, el rótulo del pie del presupuesto sin los dos puntos (SCRUM-887).
- `:135-138` · al facturar un presupuesto con global, la factura lleva una línea `{ concept: 'Descuento global', qty: 1, price: -global, tax }`, la PRIMERA (la guarda `src/lib/invoicing.ts:350`).
- `customerPortal.routes.ts:402-405` (main) · esa línea sale en la tarjeta de factura como `qty × price × (1+tax)`: **«Descuento global» con el importe CON IVA**, en negativo.

Es decir: en el portal, la cifra con IVA bajo el rótulo «Descuento global» ya existe. Reusarlo en la tarjeta del presupuesto no inventa rótulo ni cifra.

## 4 · Propuesta (para firma del fundador; no construida)

- **P1** · En la tarjeta del PRESUPUESTO, SOLO si `discountGlobalAmount > 0` y resta algo, una fila más dentro de «Ver detalles» con rótulo **«Descuento global»** (literal existente: `invoiceLines.service.ts:46`, el mismo que la tarjeta de factura) e importe **negativo, con IVA**. Sin descuento global, la tarjeta queda byte a byte igual.
- **P2** · El importe = `calcTotal(lineas) − calcTotal(lineas, global)`: la misma función que produce `q.total`, ninguna cuenta nueva. Con eso las filas suman el total al céntimo.
- **P3** · Posición: la PRIMERA fila, como en la tarjeta de factura. (Alternativa: la última.)
- **P4** · «Ver detalles (N líneas)» sigue contando solo las líneas del presupuesto, sin la fila del descuento. (En la factura sí la cuenta, porque allí es una línea de verdad.)
- **P5** · Coste aceptado: la misma palabra lleva cifras distintas en el PDF (−20,00, sin IVA) y en el portal (−24,20, con IVA), igual que ya pasa hoy entre el PDF del presupuesto y la tarjeta de factura del portal. Si no se acepta, la alternativa es un rótulo NUEVO, p. ej. «Descuento global (IVA incluido)» — **texto nuevo, marcado como nuevo**, que necesitaría su propia firma.

## 5 · Ejemplo (antes / después)

Presupuesto: «Mano de obra» 2 × 100 € al 21 % con 10 % de descuento de línea; «Material» 1 × 50 € al 21 %; descuento global 20 €.

- **Total guardado:** base 180 + 50 = 230 − 20 = 210; × 1,21 = **254,10 €**.
- **PDF y firma:** Suma de líneas 250,00 · Descuento −20,00 · Descuento global −20,00 · Base imponible 210,00 · IVA 21 % 44,10 · Total 254,10.
- **Portal hoy (main):** 242,00 + 60,50 = 302,50 frente a 254,10.
- **Portal con #2934:** 217,80 + 60,50 = 278,30 frente a 254,10. El hueco, 24,20 = 20 × 1,21.
- **Portal con la propuesta:** Descuento global −24,20 · Mano de obra 217,80 · Material 60,50 → suman **254,10**.

## No medido

- Las cifras del ejemplo están calculadas a mano con las fórmulas citadas (`utils.ts:241-269`, `presentacionIva.ts:139-157`), no ejecutadas.
- La fila «Descuento global» de la tarjeta de factura, por lectura de código: no la he visto en una factura real del portal ni en yaqu.app (hace falta el token del portal de un cliente).
- No revisado: el modo «IVA no incluido» en el portal (sus líneas ya llevan IVA hoy, con o sin descuento); queda fuera de este ticket.
- Varios tipos de IVA con descuento global no se pueden guardar (SCRUM-887, `quotes.routes.ts:149`). Un presupuesto anterior a 887 podría tenerlos: con P2 la cuenta sigue cuadrando, pero no he medido si hay alguno.

# APÉNDICE · 27-oct-2026 · SCRUM-1624b · construida la fila «Descuento global» de la tarjeta del presupuesto (firma c.21094)

**Medido contra:** `origin/main` = `c992358dc42fa7407e2960f826bd36d68bc3d47e` · 2026-10-27T16:00:17Z (cabecera `Date` de GitHub)

A9: aviso → cicatriz J2 «lancé `node scripts/meta-guard-mutaciones.mjs --help` para leer su uso, no tiene ayuda y arrancó la pasada entera; al pararla se quedó mutado `scripts/meta-guard-mutaciones.mjs`» — no se pudo comprobar: el instrumento no rechaza argumentos que no conoce, y cambiarlo es de su dueño (J6), no de este puesto

Lo escribe J2 (`jv-j2bo`). Firma del fundador: SCRUM-1624 c.21094, P1-P5 ✅, sobre la propuesta de arriba (c.21089). Va encima de #2934 (SCRUM-1568), mergeado en `main` a las 15:53:45Z.

## Qué cambia

`src/modules/system/app/routes/customerPortal.routes.ts`, **sólo la tarjeta del PRESUPUESTO**, con `filaDescuentoGlobalDelPresupuesto`:

- **P1** · sólo si el presupuesto tiene descuento global y resta algo, sale una fila «Descuento global» en negativo y con IVA. Con `discountGlobalAmount` a `null`, `0`, `'0'`, `''` o sin el campo, la tarjeta es idéntica byte a byte.
- **P2** · el importe es `calcTotal(líneas, global) − calcTotal(líneas)`. No hay ninguna cuenta nueva.
- **P3** · la fila va la primera. **P4** · «Ver detalles (N líneas)» sigue contando sólo las líneas.
- Usa las mismas clases y el mismo marcado que las demás filas. No hay CSS, token ni componente nuevos.

**El rótulo.** El de la tarjeta de factura vive en `ROTULO_DESCUENTO_GLOBAL` (`src/modules/invoicing/domain/invoiceLines.service.ts:46`). Esa constante no está exportada y es camino de emisión, así que exportarla sería modificarlo (regla 38, STOP). Por eso el portal lleva el mismo literal, y el test lee esa constante del fuente y exige que la fila diga exactamente lo mismo. Si una cambia sin la otra, el test cae. No hay texto nuevo.

## Medido

- **Rojo primero**, con #2934 dentro y sin este cambio, sobre el ejemplo firmado: las filas suman **278,30 €** y el total es 254,10 €. Caen 2 de 5 casos y pasan el control y los dos que ya cumplía la tarjeta de antes (P4 y «sin global, idéntica»): 3 + 2 = 5.
- **Verde después:** `tests/scrum1624b-portal-fila-descuento-global.test.mjs`, 5 de 5. Las filas suman **254,10 €** al céntimo, y la primera es «Descuento global» con −24,20 €. El test pide la ruta real con el Prisma de mentira de scrum1568. Junto a él, `scrum1568` sigue 4 de 4.
- **Mutaciones**, con `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` sobre las dos de `MUTACIONES_QUE_ME_TUMBAN`: **2 de 2 tumban su caso**. Después, `git status` deja sólo mis ficheros.
- **Build con tipos** (`tsc -p .`, sin `--noCheck`): salida 0.

## Sin medir, o fuera

- **No se ha verificado en yaqu.app.** Ver el portal de un cliente pide su token, y no lo tengo.
- **No hay capturas antes/después** (checklist AB6). La fila reusa el marcado de las otras filas, y no he arrancado navegador.
- **Un `discountGlobalAmount` negativo o no numérico** no pinta fila: la condición es que el total con global sea menor que sin él. Si `calcTotal` da NaN, tampoco sale fila.
- **Suite entera en local: NO CORRIDA** (orden del orquestador). Los guards que sí se corrieron están en el comentario de Jira.

# APÉNDICE · 30-oct-2026 · SCRUM-1624b · relevo: el rojo de #2950 era un merge de tres padres, y la entrega pasa a una rama sin él

**Medido contra:** `origin/main` = `06ad4f1bd53d25b701cd11ae42791db753329ceb` · 2026-10-30T17:15:30Z (cabecera `Date` de GitHub)

A9: comprobación → `tests/scrum1572-registro-creado-por-dos-ramas.test.mjs`

Lo escribe J2 (`jv-j2br`). El obligatorio de #2950 cayó con «no pude mirar: 0225c794515db264e7b01575ab55497d4ec2e2dc tiene 3 padres»: ese commit era un merge a la vez de `main`, de la rama de #2934 y de la del registro. El registro no estaba entrelazado, y seguía cayendo igual después de `git merge origin/main`, así que todo el trabajo va ahora en un solo commit sobre `main` (`scrum-1624b-fila-descuento-global-sin-octopus`), sin cambiar ni una línea de lo construido.
