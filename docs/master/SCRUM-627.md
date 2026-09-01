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

---

# APÉNDICE · 25-ago-2026 · SE EJECUTA LA OPCIÓN A

**Medido contra:** `origin/main` = `57e16ca1b67905310d5ff2a0a9dda1ce27b2359e` · 2026-08-25T07:45:00+01:00

> ⚠️ Esta rama está **apilada**: sale de la de SCRUM-627 (`acaea594`, que trae el detector y aún
> no estaba mergeada) y se le mezcló `origin/main` en ese commit. El ancla es ese `origin/main`.
> Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
>
> Este apéndice se **añade** al final de la entrada anterior; no se borra nada.

**Decisión del fundador:** A ahora, B cuando la asesoría desbloquee 623/624.

---

## 1 · 🛑 La pregunta que el encargo mandaba parar a contestar: el límite ES real

> *«Si el formato del censo no admite dos entradas para un fichero, PARA Y DILO: eso sería un
> límite del censo, no un detalle de tu ticket.»*

**No las admite.** El `CENSO` de SCRUM-389 es un objeto indexado **por ruta**: una clave, una
entrada. Y hacen falta dos para `pdf.service.ts`, porque tiene dos cosas distintas —la llamada a
la primitiva para el presupuesto y las veinte líneas de al lado que se escriben el desglose a
mano—.

**No se ha forzado el formato, y tampoco se ha parado el ticket:** la segunda cosa vive en una
**tabla hermana**, que es la forma que el propio encargo describe («nace con la población
declarada, como el trinquete de SCRUM-402»). Se dice aquí porque es un límite del censo, no un
detalle: si algún día hiciera falta una tercera cosa en un fichero, volvería a aparecer.

**Y el límite deja un agujero que la tabla hermana sola no tapa:** un lector de SCRUM-389 ve
`pdf.service.ts` clasificado y deja de buscar. Por eso se ha añadido allí **una remisión
escrita** —un comentario encima de su entrada que dice que el fichero tiene dos cosas y dónde
está la otra—. **No cambia ni la lógica ni la tabla ni lo que aquel censo exige**: es texto. Sin
esa remisión, la tabla hermana existiría y nadie llegaría a ella desde donde se empieza a mirar.

---

## 2 · Los diez veredictos

Cada uno se escribió **mirando el código**, no la ruta. La pregunta es la de SCRUM-389 y no ha
cambiado: *¿es una segunda cifra del mismo periodo?*

| fichero | veredicto | por qué |
|---|---|---|
| `core/utils/utils.ts` | `DOCUMENTO` | `calcTotal` suma el bruto de las líneas de **un** documento y redondea una vez. Ni agrupa por tipo ni mira periodos |
| `core/validation/schemas.ts` | `NO_ES_DINERO` | la única aritmética está **dentro del mensaje de error** del suplido, para poder decir «un IVA del 21 %». Convierte para NOMBRAR, no deriva importes |
| `expenses/domain/justificante.ts` | `COMPROBACION` | recalcula la cuota **esperada** de un gasto para detectar que el justificante no cuadra. No sale en ningún documento, y es IVA **soportado**, no repercutido |
| `invoicing/domain/recargoEquivalencia.ts` | `DOCUMENTO` | la cuota del **recargo de equivalencia** —otro impuesto, otra tabla de tipos— por documento. El fichero ya declaraba leer la forma de `calcVatBreakdown` «leído, nunca importado» |
| `jobs/domain/albaran.service.ts` | `DOCUMENTO` | el valorado de **un** albarán, en céntimos y redondeando por línea. Acumula **una** base y **una** cuota, no una por tipo |
| `jobs/domain/albaranAFactura.ts` | `DOCUMENTO` | `totalDeFacturables`, redondeando por línea **a propósito**: su comentario ya decía que dos formas de redondear la misma factura dan importes distintos |
| `quotes/app/routes/quotes.routes.ts` | `DOCUMENTO` | `calcTierTotal`: el total de **una** opción de **un** presupuesto, que ni entra en el 303 |
| `system/app/routes/customerPortal.routes.ts` | `DOCUMENTO` | pinta el importe de cada línea en el portal. Es **presentación** de un documento que ya existe |
| `invoicing/domain/vat.service.ts` | `PRIMITIVA` | **es** el desglose. Su entrada aquí es por su aritmética; en SCRUM-389 está por la llamada de `calcVatCuotaTotal`. Que salga marcada es el control de que el detector reconoce lo que dice reconocer |
| `invoicing/infra/pdf/pdf.service.ts` | `REIMPLEMENTACION` | 🔴 **las dos cosas.** La llamada (presupuesto, SCRUM-604) la clasifica SCRUM-389; el bloque de la factura, con su `vatMap`, no lo ve nadie. **No se convierte** — eso es B |

**Ninguno de los ocho invisibles agrega un periodo.** Pero eso **no lo sabía nadie hasta hoy**:
no estaban mirados porque no eran mirables.

Un test exige que cada veredicto esté en un **vocabulario cerrado** y traiga un motivo de al
menos 80 caracteres: *un veredicto sin motivo es una etiqueta*.

---

## 3 · 🔴 La población bajó de 9 a 8, y NO es un refinamiento silencioso

El encargo avisaba: *«si al declarar la población el detector pierde ficheros respecto a tu
barrido de ayer, ESO ES UN ROJO».* Perdió uno — **`maintenance.service.ts`**— y aquí está la
prueba de que era un **falso positivo**, no una pérdida:

```ts
let line: QuoteLine = { concept: plan.title, qty: 1, price: 0, tax: 0 };
const price = Number(line.price ?? 0) * Number(line.qty ?? 1);   // ← lo que se marcaba
```

El alias del impuesto nacía del **nombre de una propiedad** (`tax: 0`), así que `line` entera
pasaba por impuesto y `line.price * line.qty` —que no toca ninguno— salía marcada. **Un objeto
que TIENE un impuesto no ES un impuesto.**

Arreglado en el detector: el nombre de una clave ya no cuenta como mención; **su valor sí**.
Medido: era el **único** falso positivo, y quitarlo **no pierde ningún hallazgo real** — los otros
ocho y los dos desgloses siguen exactamente donde estaban.

Y no se deja a la buena voluntad: hay un **test de regresión** con las dos mitades —que `line` no
vuelva a ser alias, y que `base * linea.tax` **sí** se siga viendo, para que el arreglo no se
pase de frenada—. La entrada que salió queda **anotada** en la lista, no borrada a secas.

---

## 4 · Verificación

**El control que decide**, con la reimplementación a mano dentro de `src/` (con el tipo llamado
`t`, como la de la factura). Fichero nuevo: revertir fue borrarlo, y se comprobó que quedó
borrado.

| | árbol limpio | con la reimplementación |
|---|---|---|
| `scrum389-censo-vat` (llamadores) | `fail=0` | **`fail=0` — sigue sin verla** |
| `scrum627b-censo-declara…` (forma) | `fail=0` | 🔴 **`fail=1`, y la NOMBRA** |

Que el de SCRUM-389 siga en `fail=0` **es lo correcto**: no se ha relajado ni ampliado. Sigue
vigilando lo suyo; lo que falta lo vigila el hermano.

**Controles que acompañan** —los ocho tests del fichero nuevo—:

* **negativo:** un fichero **declarado** no se reporta como nuevo (sin esto, un censo que dijera
  «sin declarar» a todo pasaría el control de arriba);
* **suelo:** ve 244 ficheros y sabe leer la tabla de al lado;
* **trinquete al revés:** una entrada que ya no corresponde a nada también cae — *«cero» y «no
  supe mirar» no son el mismo número*;
* **doble entrada:** los que están en las dos tablas tienen que **decirlo**, y son exactamente
  los dos que hacen aritmética **y** llaman;
* **fidelidad:** la copia del criterio de SCRUM-389 reproduce su lista real. *La fidelidad se
  mide, no se pide por fe.*
* **suelo de la población:** con las diez entradas declaradas, la tanda nace **en verde**. Si
  hubiera nacido en rojo, la población estaría incompleta.

---

## 5 · Lo que NO se ha tocado

* **El cálculo de la factura.** Ni una línea. Aquí se decidió **quién lo vigila**.
* **SCRUM-623 y SCRUM-624.** Anotados en la entrada de `pdf.service.ts` y nada más.
* **Ninguna reimplementación se ha convertido a la primitiva.** Eso es B, y B espera a la
  asesoría: mueve un céntimo en el 25 % de los documentos de dos tipos (medido en la entrada
  anterior) y son las mismas veinte líneas de 623/624.
* **El censo de SCRUM-389**: sólo se le añadió un **comentario** de remisión. Su lógica, su tabla
  y lo que exige están intactos.

## Tests que introduce este apéndice

* `tests/scrum627b-censo-declara-reimplementaciones.test.mjs` — la tabla de los diez veredictos,
  la regla de que nadie hace aritmética de IVA sin declararse, y sus controles.

---

# APÉNDICE 2 · 25-ago-2026 · LA REMISIÓN, ATADA

**Medido contra:** `origin/main` = `bcf30775b0e535c9c6534eb7636558b9a4200a3e` · 2026-08-25T09:30:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
> Se **añade** al final; no se borra nada.

**Qué cierra:** el comentario de remisión en `scrum389-censo-vat.test.mjs` era una **nota** —nadie
lo leía: borrarlo dejaba la tanda entera en verde— y el veredicto `REIMPLEMENTACION` tampoco
estaba atado a lo que el detector encuentra. Ahora los dos pueden caer.

## Por qué merecía existir

Los dos instrumentos fallaban **en el mismo sentido**. El día que se ejecute la opción B y ese
bloque deje de reimplementar, el veredicto seguiría diciendo `REIMPLEMENTACION` y la remisión
seguiría apuntando: **mentirían los dos a la vez, y su acuerdo se leería como confirmación.** No
era un control que faltaba — eran dos controles corroborándose entre sí sin tocar la realidad.

## Las dos direcciones

| | |
|---|---|
| ① | el puntero existe **⟺** hay una entrada con veredicto `REIMPLEMENTACION` para ese fichero |
| ② | ese veredicto **sólo se admite mientras** el detector siga marcándolo como desglose completo |

El puntero se busca en los comentarios **pegados a esa entrada** (`getLeadingCommentRanges` sobre
su `PropertyAssignment`), no en cualquier sitio del fichero: una remisión suelta al final no lleva
a nadie desde la fila que se está leyendo. Y el nombre que se busca es el de **este mismo fichero,
derivado** (`import.meta.filename`): si alguien lo renombra, ① cae pidiendo que se actualice el
puntero — un puntero a un fichero que ya no se llama así es exactamente la nota que miente.

## Los tres rojos, provocados de verdad

Inyección real y reversión byte a byte con `Buffer.compare` en cada uno; árbol limpio después.

| | rotura | resultado |
|---|---|---|
| **a** | se **borra la remisión** de `scrum389` | `fail=1` · ① cae diciendo **«FALTA EL PUNTERO»** y nombra el fichero |
| **b** | se **quita la entrada** `REIMPLEMENTACION`, dejando la remisión | `fail=2` · ① cae diciendo **«PUNTERO QUE APUNTA A NADA»** |
| **c** | 🔴 el **detector deja de marcarlo** —se retira `vatMap[key].vat += base * t`— con veredicto y remisión **intactos** | `fail=1` · ② cae diciendo **«EL VEREDICTO YA NO CORRESPONDE»** |

**(a) es el «antes»**: hasta hoy esa misma rotura dejaba los 4111 tests en verde.

**(c) se provocó sobre el fichero de producción**, no sobre una fuente sintética — precisamente
porque el defecto que se estaba cerrando era que `desgloseCompleto` sólo aparecía sobre la fuente
del control, y por eso el veredicto real no estaba atado a nada. Nota: **no se ha cambiado el
cálculo**; la aritmética se retiró y se devolvió byte a byte en la misma operación.

## 🔴 El suelo de ① me salió mal DOS veces, y las dos por lo mismo

**Primera:** lo puse como «al menos una entrada `REIMPLEMENTACION`». El control (b) cayó, sí, pero
**por el suelo y no por la rama del puntero huérfano**: el mensaje no decía lo que había pasado. Y
era peor que un mensaje flojo — ese suelo habría puesto en **rojo la limpieza legítima** del día
que se ejecute B y no quede ninguna reimplementación, que es un final **correcto**. *Un suelo no
puede prohibir el buen estado final.*

**Segunda:** al rehacerlo como «al menos 3 entradas con comentario», lo puse **a ojo**. Medido: son
**2 de 12** — la mayoría de las filas de aquel censo son de una línea. Caía en árbol limpio por un
número que me inventé.

**Cómo quedó:** el suelo vigila **al lector, no a la población**, y se mide en **caracteres**
(medido: 1.560). Lo que tiene que distinguir es **0 contra algo**; cuántas filas lleven comentario
es cosa de quien escriba allí.

## Lo que NO se ha tocado

* El `CENSO` de SCRUM-389: ni su lógica, ni su tabla, ni lo que exige. Sigue en `fail=0`.
* El cálculo de la factura, SCRUM-623 y SCRUM-624.
* Ninguna reimplementación convertida a la primitiva — eso es B, con su 25 % medido encima.
* Los diez veredictos: ni uno añadido, ni uno cambiado.
