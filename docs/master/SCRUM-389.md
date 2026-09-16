# SCRUM-389 · Los DOS agregadores de IVA repercutido, reducidos a uno

**Fecha:** 7-ago-2026 · **Carril:** A (núcleo fiscal) · **Origen:** hallazgo propio al entregar A5
**Medido contra:** `origin/main` = `2732d811f594f7a870c6531a603d636aa0d5ab7c` · 2026-08-07T10:02:56+02:00
(anclado con `git ls-remote`)
**Tanda:** 2080 tests · 2009 pass · **0 fail** · 71 skipped · `npm test` **`$? = 0`**
Los tests con base (389, 295, 296) contra el banco local: **`$? = 0`**

## El defecto

`GET /admin/reports/vat` llevaba tiempo calculando el IVA repercutido del trimestre **por su
propio camino** (leía facturas y las sumaba él), y el 303 de SCRUM-295 lo calcula desde el Libro.
Dos derivaciones de la misma cifra: un profesional podía ver **dos cifras oficiales distintas en
dos pantallas**, las dos con aspecto de buenas, y a Hacienda se entrega una sola.

## PASO 1 · ¿ya difieren hoy? — LA MEDICIÓN VA PRIMERO

Se midió **antes de tocar nada**, con el handler **REAL** de Informes (cargado de `dist` y llamado
con un `req`/`res` de mentira: una réplica del cálculo habría medido mi réplica, no la pantalla) y
sobre **los mismos datos**, contra el banco Postgres local.

**Primera pasada, 10 facturas: DIFERÍAN.** 100,00 € de base y **21,00 € de cuota**.

Aislada la causa, era **una sola**: una factura con el **número vacío**. Informes la sumaba al
cuadro; el Libro la aparta (`sinNumero`) y el 303 con él.

**Segunda medición — ¿es alcanzable esa fila?** No:

* `formatInvoiceNumber` nunca devuelve cadena vacía (cae a `'CF'` y siempre lleva año y secuencia);
* los **siete** `invoice.create` del árbol sacan su número de `allocateInvoiceNumber`.

Así que se repitió la medición **solo con datos que el código puede producir**, en seis escenarios
—227 facturas— buscando a propósito el otro sospechoso estructural, el **orden del redondeo**:

| escenario | Δ base | Δ cuota |
|---|---|---|
| normal (21/10/4) | 0,00 | 0,00 |
| con una factura sin líneas | 0,00 | 0,00 |
| con una línea a tipo 0 | 0,00 | 0,00 |
| **40 facturas con cuota de medio céntimo** | 0,00 | 0,00 |
| **60 facturas de 1.234,565 €** | 0,00 | 0,00 |
| **120 facturas variadas** | 0,00 | 0,00 |

**Conclusión medida: hoy NO difieren sobre ningún dato que el código pueda producir**, así que no
hay ninguna cifra ya vista por un profesional que este ticket cambie — por eso se siguió adelante
sin parar. Y mi hipótesis del redondeo **era falsa**: Informes también acumulaba lo ya redondeado
por factura (`calcVatBreakdown(...).entries`), o sea el mismo orden. Medido, no deducido.

Lo que quedaba era una **duplicación latente**: dos mecanismos que coinciden hoy y no tienen nada
que los obligue a coincidir mañana.

## PASO 2 · Informes lee el Libro

`/admin/reports/vat` ya no lee facturas: llama a `leerLibroRegistro` y suma el `porTipo` que el
Libro ya calculó. Y el periodo sale de `rangoTrimestre`, **el mismo que usa el 303** — antes se
construía aquí con dos líneas idénticas, y dos copias del mismo criterio de fechas es exactamente
como empiezan a discrepar dos cifras que deberían ser una.

**El contrato de la respuesta no cambia** (`year, quarter, from, to, currency, rates[], totals,
invoiceCount, excluded`), y hay un control positivo con los valores **calculados a mano** que lo fija
campo por campo.

⚠️ **Lo único que se mueve, y se dice:** las filas **sin número** pasan de sumar en el cuadro a
contarse en el aviso de «no incluidas». Es lo correcto —el número es la identidad fiscal del
documento— y por la medición del paso 1 **no existe ninguna** con el código de hoy. Para que ese
aviso siga pudiendo revisarse a mano hizo falta extender el Libro con `sinNumeroImporte`: un «hay 3
facturas fuera» sin decir cuánto dinero es no se puede revisar.

## PASO 3 · el censo de quién deriva IVA, DERIVADO

`calcVatBreakdown` **no se retira**: es la primitiva compartida del IVA y la usa medio sistema
(emisión, VeriFactu, exports, albaranes, recapitulativa, la landing). Lo que se vigila es otra
cosa: **agregar un PERIODO por un camino propio**, que es lo que hacía Informes.

El censo se **deriva del árbol con el compilador de TypeScript** (un `grep` casaría con los
comentarios que explican esto mismo) y los veredictos los pone una persona: **10 ficheros, 1
PRIMITIVA y 9 DOCUMENTO** — todos desglosan UN documento, así que ninguno puede discrepar de nada.
Un llamador nuevo sin clasificar sale **rojo**, con el mensaje de que si agrega un periodo tiene
que leer el Libro. Con su suelo (si el extractor encuentra menos de 8, falla diciendo que no supo
mirar) y su trinquete (no puede describir ficheros que ya no llaman).

Y un guard estructural, **sin base**: Informes llama a `leerLibroRegistro` y a `rangoTrimestre`, y
**no** llama ni importa `calcVatBreakdown`. Corre en `npm test`: el cuadre de las tres pantallas
está gateado, y si este censo también lo estuviera, el CI no ejecutaría nada de este ticket.

Retirado además el `import` de `calcVatBreakdown` que quedaba muerto en `reports.routes.ts`.

## El test que cierra esto — las tres, al céntimo

Mismo trimestre, tres puertas distintas, y **falla si difieren en un céntimo**. Con su **suelo**:
si el caso no genera importes, el test cae diciendo que *dos ceros cuadran siempre* — el mismo
suelo que puse en A5, porque aquí vale igual.

## Verificado en rojo — tres, por `$?`, y **comiteado antes de cada inyección**

| se desvía… | `$?` | lo que dijo |
|---|---|---|
| **Informes** (vuelve a agregar con otro redondeo) | 1 | *Informes 116,76 · Libro 115,60 · Modelo303 115,60* |
| **el 303** (una casilla suma de más) | 1 | *Informes 115,60 · Libro 115,60 · **Modelo303 115,67*** |
| **el Libro** (deja de desglosar por tipo) | 1 | cae el **control positivo**: *«la tabla de Informes ya no enseña lo mismo»* |

El tercero es el que enseña el límite honesto del cuadre: **si se desvía el Libro, las tres se
mueven juntas y el cuadre no lo vería** — de eso se encarga el control positivo con los números
calculados a mano, y por eso está.

## Lo que NO cubre — declarado

* **La unificación es de la CIFRA, no de la presentación.** Informes sigue enseñando una fila por
  tipo (incluido el 0 %); el 303 aparta el 0 % como no clasificable (no se puede saber si es
  exenta, no sujeta o ISP). Mismo dinero, dos lecturas legítimas — y por eso el cuadre compara lo
  declarado **más** lo apartado.
* **No se ha comprobado contra datos de producción.** Todo el paso 1 es sobre el banco local. Si
  en prod existiera una factura con número vacío —que el código no puede crear, pero una edición
  manual sí—, su importe se movería del cuadro al aviso.
* **`/reports/x2` y `/reports/pl` no se han tocado**: leen facturas COBRADAS por `paidAt`, otra
  población y otro criterio. No entran en este ticket.
* **Sin rectificativas R1 en el juego de datos** del cuadre (el mecanismo las suma como vengan).

## Hallazgo de otro carril (regla 9: se reporta, no se arregla)

`src/modules/jobs/app/routes/jobs.routes.ts:34` **importa `calcVatBreakdown` y no lo llama** —
import muerto, con su comentario «SCRUM-17: total con desglose IVA». No lo he tocado: `jobs.routes.ts`
es zona roja y es de otro carril. Es cosmético, pero un import muerto en un fichero caliente hace
creer que ahí se calcula IVA cuando no se calcula.

## Ficheros

* `src/modules/reports/app/routes/reports.routes.ts` — `/vat` lee el Libro; fuera el import muerto.
* `src/modules/invoicing/domain/libroRegistro.ts` — `sinNumeroImporte` (aditivo).
* `tests/scrum389-un-solo-iva.test.mjs` (2, gateado por `LIBRO_PG_URL`) — el cuadre y el control positivo.
* `tests/scrum389-censo-vat.test.mjs` (4, sin gate) — el censo derivado y el guard de Informes.
