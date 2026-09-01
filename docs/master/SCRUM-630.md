# SCRUM-630 · El «Válido hasta» por defecto no sumaba días de calendario

**Medido contra:** `origin/main` = `17f028b68cea6225c9fbb5b063b821346e4a4698` · 2026-09-01T19:30:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** el **valor por defecto** del campo. El `min` no se toca (prohibido por el encargo) y
queda caracterizado con su defecto. Se entrega además el censo del patrón en todo el árbol.

---

## 1 · 🔴 El defecto no era el que yo conté

En SCRUM-605 escribí que «31 de marzo + 30 → 29 de abril» era **el cambio de hora de marzo**.
Medido aquí sobre 2026 entero, a cuatro horas del día:

| hora local | días que difieren |
|---|---|
| 09:00 | **0 de 365** |
| 12:00 | **0 de 365** |
| 23:30 | **0 de 365** |
| **00:30** | **210 de 365** |

**Lo que muerde no es `86400000`: es `toISOString()`, que formatea en UTC.** En Madrid (UTC+1/+2)
una hora local temprana cae en el día **anterior**, y por eso el 31 de marzo a medianoche daba el
29 de abril. La aritmética en milisegundos, por sí sola, no cambia el día a horas normales: un
salto de una hora sobre el mediodía sigue cayendo en el mismo día.

Las dos costuras se arreglan igual —componentes de fecha locales— pero **decirlo bien importa**:
quien lea «cambio de hora» buscaría el defecto dos días al año en vez de 210.

---

## 2 · El arreglo: reutilizar, no reescribir

```js
// antes
const defUntil = new Date(Date.now() + 30 * 86400000);
validInput.value = defUntil.toISOString().slice(0, 10);

// ahora
validInput.value = atajosVencDefecto ? atajosVencDefecto.fechaDeAtajo(30) : '';
```

`fechaDeAtajo` es **la primitiva de los atajos de SCRUM-605**, con sus bordes ya probados. Escribir
una segunda habría sido el defecto de familia de **617/620/625/627/629**: existe una primitiva y
alguien no la usa. Ahora el valor por defecto y el atajo de «30» **no pueden dar días distintos**:
salen de la misma función.

**Si la primitiva faltara, el campo se queda sin valor por defecto** en vez de escribir una fecha
calculada de otra manera. Es deliberado: un campo vacío es un fallo **visible** y una fecha mal
calculada es uno **silencioso**, y este campo acaba impreso en el documento del cliente. La
dependencia era implícita —el orden de los `<script>`— y ahora **está vigilada**: un test falla si
`quoteAtajosVencimiento.js` pasa a cargarse después de `quotesView.js`.

---

## 3 · El censo del patrón · **30 sitios**, con su método

**Método, porque un cero (o un treinta) vale lo que valga cómo se buscó:** AST sobre `src/`,
`public/`, `tests/` y `scripts/` (`.ts`, `.js`, `.mjs`). Se buscan **sumas o restas** cuyo operando
sea un múltiplo exacto de 86.400.000, **evaluando el número** en vez de buscarlo escrito — así
`86400000`, `86_400_000`, `24 * 60 * 60 * 1000` y `24 * 3600 * 1000` cuentan igual. Un `grep`
habría visto menos. Los comentarios quedan fuera por construcción.

**No, el valor por defecto del presupuesto no era el único.** De los 30, la mayoría son
**ventanas** (`- 7 días` para una consulta de métricas) o **duraciones** (la caducidad de un token
de sesión), donde los milisegundos son lo correcto. Los que producen una **fecha de calendario**
son estos:

| sitio | qué calcula | estado |
|---|---|---|
| `public/dashboard/js/quotesView.js:571` | el valor por defecto del campo | **arreglado aquí** |
| `public/dashboard/js/quotesView.js:573` | el `min` del campo | ⚠️ **mismo defecto, NO tocado** |
| `src/modules/quotes/app/routes/quotes.routes.ts:166` | 🔴 el `validUntil` que se **GUARDA** cuando el front no lo manda | **no tocado** |
| `src/modules/system/app/routes/quoteDecisionLanding.routes.ts:343` | 🔴 el «Válido hasta el …» que **ve el cliente** cuando el presupuesto no tiene fecha | **no tocado** |
| `public/dashboard/js/jobsView.js:93` | la ventana «esta semana» para agrupar | agrupación visual, no una fecha impresa |

### 🔴 Y el hallazgo que sale de ahí

**La caducidad de un presupuesto se calcula en TRES sitios distintos** —el front, el servidor al
guardar y la landing del cliente— **con la misma aritmética y el mismo defecto**. Es otra vez la
familia de 617/620/625/627/629, y esta vez sobre un dato que el cliente lee en pantalla.

**No se han tocado** porque este ticket es el valor por defecto del front. Van al fundador.

---

## 4 · Verificación

* **Antes**: 31-mar-2026 a medianoche + 30 → `2026-04-29`. **Después**: `2026-04-30`.
* **✅ Control negativo, el que decide**: a 09:00, 12:00 y 23:30, sobre **los 365 días de 2026**,
  el arreglo **no mueve ni una fecha**. Quien no toque nada sigue viendo exactamente lo de antes.
* **Control positivo del propio barrido**: a las 00:30 difieren **210 de 365** — fijado, para que
  si algún día baja a 0 se sepa que o el defecto se arregló por otro sitio o estoy comparando la
  misma función consigo misma.
* **Bordes de SCRUM-605**, otra vez: 31-ene+30, bisiesto, cambio de año, 31-dic+7.
* **El detector del censo lleva su control**: sabe ver las tres formas de escribir un día, sabe
  **no** contar una hora, y sabe **no** contar un comentario.

### Dos cosas que se cazaron a sí mismas

1. **Mi primer barrido usó el mediodía** y dio 0 diferencias — o sea, «el defecto no existe». A
   esa hora, en efecto, no se manifiesta. El control positivo del barrido (exigir que **haya**
   diferencias) fue lo que lo destapó.
2. **Mi guard de texto se cazó a sí mismo**: buscaba la cadena `Date.now() + 30 * 86400000` con
   cero apariciones, y **mi propio comentario** —el que explica por qué esa suma está prohibida—
   la contenía. Pasó a AST, donde los comentarios quedan fuera por construcción.

### El trinquete de SCRUM-605 cayó, y se actualizó con su decisión

`scrum605-atajos-vencimiento.test.mjs` fijaba la línea del valor por defecto para que nadie la
tocara de refilón. Al sustituirla, **cayó**. No se relajó: se actualizó **con el motivo escrito**.
Lo que ese control protege sigue intacto —el valor por defecto siguen siendo 30 días— y lo único
que cambia es que ahora se calculan bien.

---

## 5 · Lo que NO se ha tocado

* **El `min` del campo**, prohibido por el encargo. Tiene **exactamente el mismo defecto** y queda
  **caracterizado**: un test fija su línea actual, así que su arreglo —cuando se decida— tendrá que
  pasar por ahí y no podrá colarse de refilón.
* **Los atajos de SCRUM-605**: aquí el default se alinea con ellos, no al revés.
* **La nota de caducidad**, el cálculo de nada más, y ninguna librería de fechas.
* **Coordinación**: no me he acercado a `pdf.service.ts` ni a `invoicing.ts` (S3), ni a
  `productsView` ni al catálogo (S1). Los dos sitios de servidor del censo se **reportan**, no se
  tocan.

## Tests que introduce esta entrada

* `tests/scrum630-default-en-dias.test.mjs` — el antes/después, el control negativo sobre el año
  entero, el censo por AST con su control y la caracterización del `min`.
