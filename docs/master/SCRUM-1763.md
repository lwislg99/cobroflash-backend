# SCRUM-1763 · La R1 guarda su total como Σ(base + cuota) de su propio desglose (J1)

**Medido contra:** `origin/main` = `bcff9d8b1ea465938ef797c17548cb5217de02bc` · 2026-11-18T15:51:34Z
**Rama:** `scrum-1763-r1-total-del-desglose` · **Carril:** J1 · **GO:** fundador, SCRUM-1763 c.22062 (literal «GO»; camino de emisión, regla 40)
A9: comprobación → `scripts/meta-guard-mutaciones.mjs`
Mutaciones: catálogo → tests/scrum1763-r1-total-del-desglose.test.mjs

## Qué cambia (y qué no)

`POST /admin/invoices/:id/rectify` (`src/modules/system/app/routes/invoicesAdmin.routes.ts`) guardaba
`total = −original.total`. Ahora guarda `(bd.base + bd.cuota).toFixed(2)` con `bd = calcVatBreakdown(negLines)`,
las mismas líneas negadas que guarda la R1: la misma regla que la F1 desde SCRUM-624 c.14413.

**No se toca:** numeración, sellado, XML, creación de la F1, PDF (el arreglo A en la R1 es otro tramo de
SCRUM-624), el redondeo de las cuotas negativas (sigue en el asesor, SCRUM-1264 fila 11), el esquema, ningún
texto, y ninguna R1 ya emitida (regla 29: el cambio solo actúa al CREAR).

## Medido

- **Rojo primero** (código de main `bcff9d8b1`, `dist` compilado en este árbol): 1 × 12,50 € al 21 % → la
  F1 guarda 15,13 y la R1 guardaba **−15,13**, su desglose suma **−15,12**. Dos tipos (12,50 al 21 % +
  4,95 al 10 %): R1 **−20,58**, desglose **−20,57**. 2 casos caen, 3 controles pasan.
- **Tras el arreglo:** el fichero nuevo, 5/5. Dirigida (rectify + familia 624 + 308/263/1713/1455b/1051c/
  1055b/283/289b/597): 142 casos, 141 pass, 1 fail, que es el de abajo, y después de arreglarlo, 142/142.
- **Build con tipos** (`tsc -p .`, sin `--noCheck`): salida 0.
- **Mutación** (catálogo + `aplicarUna` de la casa, con su pasada limpia): volver a `−original.total`
  tumba el caso declarado y uno más (el de dos tipos). Viva.

## Un test de SCRUM-308 cambiaba con el GO, y cómo se ha tocado

`tests/scrum308-bloqueo-rectify.test.mjs` («sobre una factura NORMAL sigue funcionando exactamente igual»)
afirmaba que la R1 guarda `'-100.00'` con una original de `total: 100` y una línea de 1 × 100 al 21 %. Esa
factura no existe: desde SCRUM-624 una F1 así guarda 121. El fixture pasa a `total: 121` y la cifra
esperada a `'-121.00'`. La aserción no se relaja: con el código viejo también daría −121,00, así que el
caso sigue diciendo lo mismo («sobre una normal, la R1 nace en negativo y por su total»).

## Huella y XML de la R1 (solo leídos)

`src/modules/invoicing/domain/verifactu.service.ts` (no tocado): la huella toma `ImporteTotal` de
`invoice.total` (l.293) y `CuotaTotal` de `calcVatCuotaTotal(lineas)` (l.297); el XML toma `ImporteTotal`
de `inv.total` (l.1212) y `Desglose`/`CuotaTotal` de `calcVatBreakdown(lines)` (l.958-959) sobre las líneas
guardadas. Con este cambio, total guardado = base + cuota de ese mismo desglose, así que `ImporteTotal`
cuadra con el `Desglose` **por construcción**. Esto lo he leído en el código, no lo he ejecutado contra el
generador del XML.

## Lo que no he hecho

- **«Verificado en staging con la cuenta QA antes de cerrar»** (aceptación del ticket): NO HECHO. Esta
  sesión no toca staging. Lo verifica quien tenga el turno, después del merge.
- No he medido cuántas R1 ya emitidas llevan el descuadre: eso son las siete poblaciones de SCRUM-1566
  (c.20814), y la regla 29 las deja como están.

## El error mío de esta tanda

Llamé a `correr()` del meta-guard con `tests/scrum1763-…` y espera el nombre relativo a `tests/`. Construyó
`tests/tests/…` y dijo **CIEGO** («NO aparece EN VERDE en la pasada limpia… no se ha mutado nada»), no
MUDO ni verde. La PUERTA 1 de `aplicarUna` ya impide que el error pase por una medición: de ahí la línea `A9:`.
