# SCRUM-627 · El censo que no ve por la ventana

**Medido contra:** `origin/main` = `45412c14bf8d8a5be24007e75481d95b4a001bfe` · 2026-08-25T05:20:00+01:00

> ⚠️ El ancla es el commit contra el que se MIDIÓ —la base de esta rama, merge del PR #868—, no
> la punta de `origin/main` de ahora. Esa hora es la del trabajo de esta rama, no una lectura de
> reloj — criterio R14.

**Alcance: MIDE, DEMUESTRA y PROPONE. No se ha cambiado el censo de SCRUM-389 ni el cálculo de
la factura.** Nada de lo propuesto se ejecuta sin OK.

---

## 1 · El número, y cómo se buscó

Sobre **244 ficheros** de `src/`:

| | |
|---|---|
| llaman a `calcVatBreakdown` — **lo único que SCRUM-389 ve** | **12** |
| hacen aritmética de IVA y **NO** llaman — invisibles para él | **9** |
| reimplementan un **DESGLOSE completo** (base y cuota por tipo) | **2**, y uno es la propia primitiva → **1 reimplementación real** |

**La reimplementación es `src/modules/invoicing/infra/pdf/pdf.service.ts`** — el bloque de
totales de la factura, con su `vatMap` escrito a mano.

**El cero de las demás está declarado: ningún otro fichero del árbol agrupa IVA por tipo con su
propio acumulador.** Y como un cero vale lo que valga el método que lo produce, aquí está el
método.

### Cómo se buscó — por FORMA, nunca por quién llama

Cuatro señales, derivadas del árbol con el compilador de TypeScript:

| clase | qué reconoce |
|---|---|
| `DESGLOSE` | acumula una **cuota** por tipo (`algo.vat += base * tipo`) |
| `BRUTO` | aplica el IVA para un total (`qty * price * (1 + tipo)`) |
| `CONVERSION` | fracción ↔ porcentaje (`tipo * 100`, `tipo / 100`) |
| `OTRO` | toca un tipo y no encaja en las anteriores |

### 🔴 La trampa que casi me come, y que define el diseño

La primera versión buscaba **por nombre**: identificadores llamados `tax`, `vat`, `iva`… **y no
veía la reimplementación de la factura**, porque allí la variable del tipo se llama `t`:

```ts
const t = Number(l.tax) || 0;
vatMap[key].vat += base * t;      // ← invisible para un detector por nombre
```

Mi detector tenía **la misma ceguera que el censo, un nivel más abajo**. Por eso hay un paso de
**alias**: una variable inicializada desde algo que ya es un impuesto pasa a serlo, iterando hasta
punto fijo. Un detector de reimplementaciones al que se le escapa un renombrado no vigila nada —
renombrar es lo más barato que hay.

### Y una segunda trampa: refinar hizo BAJAR el número

Al partir la clase única en cuatro clases más finas, **perdí dos ficheros** que la versión
anterior sí veía (`albaran.service.ts`, `justificante.ts`): quedaron casos sin cubrir y el total
bajó **sin que nada avisara**. Un censo que clasifica mejor y cuenta menos es el mismo fallo que
este ticket persigue. De ahí el cajón `OTRO`: nada que mencione un impuesto puede escaparse por no
encajar en ninguna clase.

### Los nueve invisibles

| fichero | qué hace |
|---|---|
| `src/core/utils/utils.ts` | bruto con IVA (`calcTotal`) |
| `src/core/validation/schemas.ts` | conversión, para validar tipos permitidos |
| `src/modules/expenses/domain/justificante.ts` | cuota de un gasto |
| `src/modules/invoicing/domain/recargoEquivalencia.ts` | recargo |
| `src/modules/jobs/domain/albaran.service.ts` | valorado del albarán |
| `src/modules/jobs/domain/albaranAFactura.ts` | bruto en céntimos |
| `src/modules/maintenance/domain/maintenance.service.ts` | línea de mantenimiento |
| `src/modules/quotes/app/routes/quotes.routes.ts` | total de un tier |
| `src/modules/system/app/routes/customerPortal.routes.ts` | totales del portal |

**Ninguno de los nueve agrega un periodo**, que es el riesgo que SCRUM-389 nombra. Pero **eso no
lo sabía nadie hasta hoy**: no estaban mirados porque no eran mirables.

---

## 2 · La demostración, en las dos direcciones

Se metió en `src/` una reimplementación a mano de un desglose —con la variable del tipo llamada
`t`, como la de la factura— y se preguntó a los dos instrumentos:

| instrumento | veredicto |
|---|---|
| **censo de SCRUM-389** (quién llama) | `total=4 fail=0` → 🔴 **NO LA VE** |
| **detector por forma** | **LA VE**, y la nombra: `DESGLOSE COMPLETO · mapa[clave].vat += base * t` |

El fichero era nuevo; revertir fue borrarlo, y se comprobó que quedó borrado.

La misma demostración vive en la suite de forma hermética
(`tests/scrum627-censo-ciego.test.mjs`), sobre una fuente sintética y sin tocar `src/`. Lleva
**control negativo** —un fichero sin impuestos no dispara nada, para que un detector que dijera
«sí» a todo no pasara— y una comprobación de que **mi copia del criterio de SCRUM-389 reproduce
exactamente su lista real**: la fidelidad se mide, no se pide por fe.

### Por qué esto es peor que un simple hueco

`pdf.service.ts` **sí está en el censo, con su veredicto** — entró en SCRUM-604, cuando le añadí
una llamada para el **presupuesto**. Un lector ve el fichero clasificado y da por mirado lo que
hay al lado. *El veredicto cubre la llamada, no las veinte líneas de al lado que no llaman.*

---

## 3 · Las dos opciones

### Opción A · que el censo detecte también las reimplementaciones

**Qué es:** añadir el detector por forma a SCRUM-389 (o como censo hermano) con su tabla de
veredictos, igual que la tabla de llamadores que ya tiene.

**Qué se rompe:** nada, **si nace con la población declarada**. Nacería rojo con las diez
entradas de hoy (9 invisibles + la reimplementación), así que se declaran en el mismo commit —
exactamente como hizo SCRUM-402 con su trinquete. Un guard que nace rojo lo apaga alguien en una
hora.

**Cuánto cuesta:** el detector **ya está escrito** (este ticket, ~160 líneas con sus suelos y
controles). El trabajo real es **escribir diez veredictos**, y cada uno necesita que una persona
juzgue si ese sitio agrega un periodo o no. Es media tarde, no un proyecto.

**Qué pasa con el bloque de la factura:** recibe una entrada declarada — *«reimplementación
conocida, bloqueada por SCRUM-623/624»*. **No obliga a cambiarlo.** Lo hace visible y, sobre
todo, impide que aparezca **una segunda**.

**Riesgo:** falsos positivos. Medido: el detector marca `OTRO` en sitios legítimos como
`recargoEquivalencia`. No es un problema de corrección —hay que declararlos igual— pero es trabajo
de juicio humano, y el mensaje del guard tiene que enseñar la línea para que ese juicio sea barato.

### Opción B · que las reimplementaciones pasen por la primitiva

**Qué es:** reescribir el `vatMap` de la factura para que llame a `calcVatBreakdown`, como ya hace
el bloque del presupuesto desde SCRUM-604.

**🔴 Qué se rompe — y esto está MEDIDO, no estimado:** las dos aritméticas **no dan lo mismo**. La
primitiva redondea **por tipo** y suma lo redondeado; el bloque del PDF suma en crudo y redondea al
imprimir. Sobre una rejilla determinista de **25.600** documentos de dos líneas:

| | difieren en el total impreso |
|---|---|
| las dos líneas al **mismo** tipo | **0 de 6.400** |
| líneas a tipos **distintos** | **4.800 de 19.200 — el 25 %** |

O sea: cambiarlo **movería un céntimo en uno de cada cuatro documentos de dos tipos**. En una
factura eso no es cosmético.

> ⚠️ La rejilla es determinista y está construida con precios que producen céntimos fraccionarios
> (`x,11` y `x,37`): mide **dónde puede pasar**, no cada cuánto pasa en las facturas reales. Para
> eso haría falta medir contra datos, y no se ha hecho.

**Cuánto cuesta:** ~20 líneas. Pero **son las mismas veinte** de SCRUM-623 (la fila del 0 %) y
SCRUM-624 (el total recalculado), que están bloqueados esperando a la asesoría. Tocarlas ahora es
resolver por la puerta de atrás dos tickets que están parados a propósito.

**Qué pasa con el bloque de la factura:** desaparece como reimplementación… y **cambia lo que
imprimen facturas reales**. Necesita GO y probablemente la misma decisión que 623/624.

**Y lo que B no arregla:** los **nueve** invisibles seguirían invisibles. Ninguno hace un desglose
—calculan brutos— así que no hay nada que pasar por la primitiva. **B arregla el caso; A vigila la
clase.**

### 🔴 Lo que apareció al medir B, y que no es de este ticket

La cuota que se **sella** sale de `calcVatCuotaTotal(lines)`, que **es** `calcVatBreakdown`
(`verifactu.service.ts:253`). El PDF imprime la suya. Por tanto, en ese 25 % de casos de dos tipos,
**el papel y la huella difieren en un céntimo**.

No se toca: es SCRUM-624 y está bloqueado. **Queda anotado**, porque cambia lo que significa el
defecto ②: no es sólo «el PDF ignora el total guardado», es que **puede imprimir un total distinto
del que se selló**.

---

## 4 · Recomendación

**A**, y luego B cuando la asesoría desbloquee 623/624.

El motivo es del propio encargo: *un censo con reputación de completo es un sitio donde dejar de
buscar.* B quita la única reimplementación de hoy y deja el censo **igual de ciego** para la
siguiente — que llegará, porque la de la factura no se escribió con mala intención: se escribió
porque nada dijo que ya existía una primitiva. A convierte eso en imposible de repetir en silencio,
y cuesta diez veredictos.

**No se ejecuta nada sin OK.**

---

## 5 · Verificación

* Los 8 tests de `tests/scrum627-censo-ciego.test.mjs` en verde, con **suelo** (ve 244 ficheros y
  reconoce a la propia primitiva), **control negativo** (un fichero sin impuestos no dispara) y la
  **comprobación de fidelidad** del criterio copiado.
* La demostración real (fichero inyectado en `src/`) se hizo sobre árbol limpio y se revirtió
  borrándolo; comprobado que no quedó.
* **No se ha tocado** `tests/scrum389-censo-vat.test.mjs`, ni `pdf.service.ts`, ni SCRUM-623/624.

## Tests que introduce esta entrada

* `tests/scrum627-censo-ciego.test.mjs` — la medida, la demostración de la ceguera en las dos
  direcciones y la población con su cero declarado.
