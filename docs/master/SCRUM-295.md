# SCRUM-295 (A5) · El modelo 303 con las casillas mapeadas — sumando el libro de A6

**Fecha:** 6-ago-2026 · **Carril:** A (núcleo fiscal)
**Medido contra:** `origin/main` = `f56f49038ab9fbeb2e1a21bc2eb9ec0958c48877` · 2026-08-06T15:21:46+02:00
(anclado con `git ls-remote`, no con la ref local)
**Tanda:** 2048 tests · 1979 pass · **0 fail** · 69 skipped · `npm test` **`$? = 0`**
Los dos tests con base (295 y 296) contra el banco local: **`$? = 0`**

## PASO 0 · lo que había en main, y una corrección mía

**El ticket NO estaba hecho** (sin entrada en `docs/master/`, sin rama, sin casillas), pero
**tampoco estaba virgen**, y eso lo dije mal en el barrido del bloque A: informé «cero
coincidencias por concepto (modelo 303)». Es **falso**. En main hay desde hace tiempo:

* `GET /admin/reports/vat` — base y cuota por tipo de IVA del trimestre, y
* `public/dashboard/js/reportsView.js` — el bloque **«IVA repercutido · modelo 303»**.

El propio `docs/diseno/bloque-a.md` § A5 lo dice con estas palabras: *«Nosotros: en Informes hay
IVA REPERCUTIDO - MODELO 303 con tipo, base y cuota. **La mitad del camino, sin las casillas**»*.
Mi barrido buscó mal y dio un «virgen» que no era. Lo que faltaba —y es lo que entrega este
ticket— son **las casillas, el cuadre con el libro y el cruce con los cobros**.

## Un solo agregador: el 303 SUMA el libro

No hay una segunda lectura de facturas ni una segunda llamada a `calcVatBreakdown`. El 303 recibe
el `LibroRegistro` de SCRUM-296 y suma su desglose. **Si el 303 y el libro contasen por caminos
distintos, un día dirían cifras distintas** — y el profesional tendría dos documentos oficiales
contradictorios sin saber cuál miente: uno se lo entrega a Hacienda y el otro a su asesor.

Para eso hubo que **extender el libro** (autorizado en el encargo): cada asiento expone ahora
`porTipo` —el desglose por tipo—, **de la misma llamada** que ya producía su `base` y su `cuota`.
Un solo cálculo, un solo filtro por `merchantId` (el del libro, ya probado contra Postgres), un
solo criterio de fechas.

### El cuadre, al céntimo — lo que A6 pedía y no se pudo hacer entonces

```
libro.base  = Σ bases de las casillas + base  sin clasificar
libro.cuota = casilla 27              + cuota sin clasificar
```

**No es una igualdad ciega:** dice que **cada euro del libro está o en una casilla o declarado
como no clasificable**. Nada se evapora. Se comprueba dos veces: en memoria con un juego que
mezcla 21 %, 10 %, 4 %, tipo 0, un 5 % sin casilla y una factura sin líneas; y **contra Postgres**,
leyendo las dos salidas del mismo periodo. Los dos tests llevan su suelo: si el caso no genera
importes, dos ceros cuadrarían siempre y el cuadre no probaría nada.

## Las casillas no se inventan: proceden de `docs/diseno/bloque-a.md` § A5

> «21 % → 07-09, 10 % → 04-06, 4 % → 01-03, TOTAL casilla 27»

Cada tripleta es (base, tipo %, cuota). Un número de casilla escrito de memoria es una declaración
falsa con aspecto de dato: si el mapeo cambia, cambia **primero el documento** y luego el código —
y hay un test que lo ata al documento por su nombre.

**Una casilla sin operaciones sale a 0,00, no desaparece.** Un impreso al que le falta la fila del
10 % no es más corto: es uno del que no se sabe si esa fila es cero o si se perdió.

## Lo que NO se adivina (SCRUM-212, aportado y no absorbido)

La factura de hoy **no guarda la calificación** de la operación. Así que:

* **línea con tipo > 0** → se puede sostener que es **sujeta y no exenta**: no se repercute IVA
  sobre una operación exenta o no sujeta. Va a su casilla del régimen general.
* **línea a tipo 0** → no se puede saber si es exenta (E1..E6), no sujeta (N1/N2) o ISP (S2).
  **No entra en ninguna casilla**: se declara en `sinClasificar` con su número, su base y su
  motivo. Un `ClaveRegimen` adivinado es una declaración falsa.
* **tipo sin casilla (5 %, 2 %…)** → tampoco se fuerza a la vecina. Redondear un tipo hacia la
  casilla más parecida es declarar mal, y encima queda cuadrado.
* **factura sin líneas** → `sinDesglose`. No se estima una cuota.

Todo eso alimenta `motivosParaNoFiarse`, que viaja en el resultado.

## El suelo, que aquí pesa más que en el libro

**Un 303 con todo a cero no se lee como «no encontré nada»: se lee como una declaración de que no
facturaste.** El resultado lleva siempre `miradas` y `asientos`, y grita cuando:

* se revisaron facturas y no salió ningún asiento;
* hay asientos y **todas** las casillas salen a cero sin nada declarado aparte;
* hay facturas sin desglose, operaciones sin calificar o importes ilegibles.

Con su cara positiva, sin la cual el suelo sería un adorno: **cero facturas es cero de verdad** y
no se presenta como roto.

## 🏆 El cruce con los cobros — y por qué AVISA, no afirma

El 303 dice cuánta cuota se declara **sin haber cobrado** (`cuotaDeNoCobradas`) y cuánta
corresponde a facturas que constan cobradas. Eso es lo que ningún facturador puede enseñar: no
saben cuándo entra el dinero.

⚠️ **Y no afirma nada sobre cuándo entró un euro.** Tres de las cinco formas de cobro se marcan a
mano y `paidAt` se pone con `new Date()` en todas partes (medido en main), así que el estado dice
«alguien lo dio por cobrado», no «el euro entró este día». Un test comprueba que **el cruce no
altera la cuota devengada**: el devengo es por emisión. Liquidar por criterio de caja es **E5 y no
está construido** — no se ha rozado.

## El rango: un trimestre incluye sus bordes

`rangoTrimestre` va del **primer milisegundo** del primer día al **último (`.999`)** del último, y
en **hora LOCAL**: el trimestre fiscal es del calendario español, no de UTC. Con
`new Date('2026-04-01T00:00:00Z')` la última hora del 31 de marzo caería en el 2T con el servidor
en UTC+2 — un euro cambiado de declaración, y **solo se ve en abril**.

Tres tests: los bordes exactos; que los cuatro trimestres son **contiguos** (exactamente 1 ms entre
uno y el siguiente: con más hay facturas que no se declaran en ninguno, con menos se declaran dos
veces); y que el inicio coincide con la medianoche local. Y contra Postgres, cuatro facturas: una
en el primer instante, otra en el último, y dos a **1 ms** por fuera de cada borde.

## ⚠️ Hallazgo medido: escribir fechas por SQL cruda las corre dos horas

El primer rojo contra Postgres fue real y mío: puse el `createdAt` del borde con
`$executeRawUnsafe`, y la factura del **1 de abril a las 00:00 apareció declarada en el 1T**.
Medido: `invoices."createdAt"` es `timestamp WITHOUT time zone` y **Prisma guarda ahí UTC**; una
SQL cruda con un `Date` escribe la **hora de pared local**, así que la fila queda 2 h corrida
(`2026-04-01 00:00:00` en columna frente a `2026-03-31T22:00:00Z` que esperaba el lector).

Corregido escribiendo por el mismo camino que usa la aplicación. **En `src` no hay hoy ninguna
escritura de fechas por SQL cruda** (comprobado), así que no hay defecto vivo — pero queda escrito,
porque el día que aparezca una moverá facturas de trimestre en silencio.

## Verificado en rojo — todos por `$?`, y comiteado antes de cada inyección

| inyección | `$?` | lo que dijo |
|---|---|---|
| **cambiar UNA casilla** (21 % de la 07 a la 17) | 1 | *«🔴 casilla 07 (base 21 %)»* y *«el mapa ya no es el de `docs/diseno/bloque-a.md` § A5»* |
| el 303 **se traga lo sin clasificar** | 1 | *«no cuadra con la del libro (597,74)»* |
| el trimestre **pierde su último milisegundo** | 1 | memoria: *«una factura de las 23:59:59.700 del 30 de junio…»* · Postgres: *«solo miró 1 facturas habiendo dos dentro del trimestre»* |

Las tres revertidas, árbol limpio. En el tercero **contra Postgres saltó primero el suelo**, no el
mensaje del borde: es correcto («miró 1 habiendo dos» es la primera señal buena), pero queda dicho
que el mensaje preciso del borde lo dio el test en memoria.

## Lo que NO cubre — declarado

* **No hay pantalla.** El encargo pedía el mapeo, el cuadre y los controles. La ruta
  (`GET /admin/modelo-303`, admin-only) devuelve el 303 con su aviso dentro; dónde se enseña y con
  qué copy es decisión de producto (regla 30). El aviso **«orientativo — consúltalo con tu asesor
  fiscal»**, que A5 declara obligatorio, viaja **dentro del resultado** para que ningún consumidor
  —pantalla, export o PDF— pueda pintar un 303 sin él. Va marcado como pendiente.
* **Solo IVA DEVENGADO (régimen general).** No hay IVA deducible (casillas 28-45), ni el resultado
  de la liquidación (47), ni recargo de equivalencia, ni intracomunitarias, ni ISP. Ninguna de esas
  casillas existe en el mapa: **su ausencia es la que impide colocar ahí algo adivinado**.
* **`GET /admin/reports/vat` sigue existiendo y sigue siendo un segundo agregador.** No lo he
  tocado (es otro carril y hay una pantalla viva encima). Mientras siga ahí, hay dos caminos que
  cuentan IVA repercutido: el suyo y el del libro. **Recomiendo un ticket** para repuntarlo al
  libro; hasta entonces, el cuadre garantizado es el del 303 con el libro, no con Informes.
* **No se ha probado con datos reales de un merchant de producción**, ni con rectificativas R1
  (líneas en negativo) contra Postgres — el mecanismo las suma como vengan, pero no hay caso.
* **Regla 24 respetada:** se construye, no se enciende. Nada de esto afirma nada fiscal.

## Ficheros

* `src/modules/fiscal/modelo303/casillas.ts` (nuevo) — el mapa, con su procedencia.
* `src/modules/fiscal/modelo303/modelo303.ts` (nuevo) — construye el 303 sumando el libro.
* `src/modules/fiscal/modelo303/modelo303.repo.ts` (nuevo) — lee el libro del trimestre.
* `src/modules/fiscal/modelo303/modelo303.routes.ts` (nuevo) — `GET /admin/modelo-303`.
* `src/modules/invoicing/domain/libroRegistro.ts` — el asiento expone `porTipo` (extensión de A6).
* `src/app.ts` · `src/core/http/adminOnlyRoutes.ts` — montaje admin-only y su 403 ejercido.
* `tests/scrum295-modelo-303.test.mjs` (15, sin gate) ·
  `tests/scrum295-modelo-303-postgres.test.mjs` (1, gateado por `LIBRO_PG_URL`).
