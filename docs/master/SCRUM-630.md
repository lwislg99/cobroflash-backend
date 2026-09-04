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

---

# APÉNDICE · SCRUM-630 (2/2) — el test medía la máquina, no el defecto

**Medido contra:** esta misma rama, `aa2542c3d60d9cfe04c002d03a7e41384a5c7bd0` · 2026-09-01T20:05:00+01:00

> Se AÑADE al final. No se borra nada de lo anterior; lo que quedó mal escrito se corrige aquí
> nombrándolo.

## 1 · El rojo de CI tenía razón, y su propio mensaje decía por qué

```
✖ SCRUM-630 · y de MADRUGADA sí difieren — 210 de 365
  AssertionError: a las 00:30 difieren 0 días de 365, y estaban medidos 210.
```

El mensaje ofrecía dos explicaciones —«el defecto se arregló por otro sitio» o «estoy comparando
la misma función consigo misma»— y **no era ninguna de las dos**: el barrido medía la **zona
horaria de la máquina**.

## 2 · 🔴 El 210 nunca fue un número de Madrid

El mismo barrido de las 00:30, con la zona fijada a mano:

| Zona | Desfase ene / jul | Diferencias a las 00:30 |
|---|---|---|
| UTC | +0 / +0 | **0 / 365** ← lo que da el runner |
| Europe/London | +0 / +1 | **210 / 365** ← **de aquí salió el 210** |
| **Europe/Madrid** | +1 / +2 | **365 / 365** ← la zona del producto |
| Atlantic/Canary | +0 / +1 | 210 / 365 |
| America/New_York | −5 / −4 | 0 / 365 |

**El 210 es el número de Londres**, que era la zona efectiva de la máquina donde se escribió el
test. Un número londinense congelado dentro de un producto español. La entrada anterior lo
atribuye a Madrid: **eso queda corregido aquí**.

Y con Madrid fijado el defecto da **365/365**, o sea **sigue intacto**: el 0 de CI era la
máquina, no un arreglo por otro sitio.

## 3 · Lo que se vio al forzar la zona de verdad

`TZ` **sí** funciona pasada como entorno de un proceso HIJO. Lo que no funciona es el prefijo de
Git Bash (`TZ=x node …`), que es lo que se probó en SCRUM-633 y llevó a escribir allí que «`TZ=`
no surte efecto en este Node/Windows». **Impreciso, y se corrige.** Con `spawnSync` el fichero
entero se puede correr con la zona forzada:

| Zona del proceso | TEST VIEJO | TEST NUEVO |
|---|---|---|
| Europe/Madrid | pass 11 · **fail 1** 🔴 | pass 16 · fail 0 |
| Europe/London | pass 12 · fail 0 | pass 16 · fail 0 |
| UTC | pass 10 · **fail 2** 🔴 | pass 16 · fail 0 |
| America/New_York | pass 9 · **fail 3** 🔴 | pass 16 · fail 0 |
| Asia/Tokyo | pass 11 · **fail 1** 🔴 | pass 16 · fail 0 |

**El test viejo sólo pasaba en UNA zona del planeta: la de la máquina donde se escribió** — y ni
siquiera en la del producto. El rojo de CI era la punta: en UTC caían **dos** pruebas, y con
desfase negativo **tres**, porque el «control negativo» de las horas normales **también** medía
la máquina (a las 23:30 en Nueva York la aritmética vieja mueve las 365 fechas).

## 4 · La regla que sale de aquí

**Cada test fija la zona de la máquina donde ese código corre de verdad.**

* `quotesView.js` corre en el **navegador del profesional** → **Europe/Madrid** (España-first).
* `quotes.routes.ts`, `quoteDecisionLanding.routes.ts` corren en **Railway** → **UTC**.

Y se afirman **las dos direcciones**: Madrid 365 **y** UTC 0, éste último como *resultado
esperado*, no como fallo. Un test que no distingue las dos zonas vuelve a medir la máquina, así
que hay una aserción explícita de que los dos números **son distintos**.

## 5 · 🔴 CORRECCIÓN A SCRUM-633 · los cinco sitios NO corren en la misma máquina

Producción **no tiene variable `TZ`** (27 variables comprobadas en Railway por el asesor;
ninguna coincide), y un contenedor sin `TZ` corre en UTC. Con ese dato, lo que escribí en
SCRUM-633 sobre Canarias **cambia**, y no en la dirección que se suponía.

Rehecho con el **servidor fijado en UTC** y el navegador en la zona del pro:

| Navegador del pro | Desfase ene/jul | `main` | rama 630 |
|---|---|---|---|
| Europe/Madrid (península) | +1 / +2 | **0 / 1460** | **0 / 1460** |
| Atlantic/Canary | +0 / +1 | **0 / 1460** | **0 / 1460** |
| America/Mexico_City | −6 | **1460 / 1460** | 1460 / 1460 |
| America/Lima (Perú) | −5 | **1460 / 1460** | 1460 / 1460 |
| America/Bogota | −5 | 1460 / 1460 | 1460 / 1460 |
| America/Argentina | −3 | 1460 / 1460 | 1460 / 1460 |

Control positivo: forzando un día de más, caza **1460/1460 en las seis**.

**Con el servidor en UTC no diverge ni el peninsular ni el canario.** La víctima es el
profesional en **desfase NEGATIVO** —LATAM, que el producto contempla (MercadoPago, `country`,
`locale.vatName` con IGV)—: su `23:59:59` local cae en el día SIGUIENTE en UTC, y el cliente lee
un día de más. **Las 1460 son idénticas en `main` y en la rama 630: es preexistente, no lo trae
el arreglo.**

## 6 · ⚠️ La pregunta de producto que esto abre, y que NO se decide aquí

**Si el servidor corre en UTC, ¿se manifiesta el defecto de SCRUM-630 en producción?**

Lo medido dice que **la pregunta se parte en dos**, porque las dos costuras no viven en la misma
máquina:

* **El valor por defecto del campo (`quotesView.js:571-572`) se calcula en el NAVEGADOR.** Ahí la
  zona es la del profesional, no la de Railway: para un pro peninsular a las 00:xx **el defecto
  SÍ se manifiesta** (365/365 con Madrid fijado). La UTC del servidor no lo tapa.
* **Las costuras del SERVIDOR** (`quotes.routes.ts:166` y el respaldo legado de
  `quoteDecisionLanding.routes.ts:343`) no formatean ninguna fecha a texto: producen un
  **instante**. En UTC no hay desplazamiento que aplicar, así que **por ese lado no se
  manifiesta**.

Queda abierto, y depende de un dato que no se tiene: **cuántos presupuestos se crean de
madrugada**, y **si hay merchants fuera de la península**. Sin eso no se puede decir si el
defecto es un caso raro o uno diario. **No se decide aquí.**

## Tests que introduce este apéndice

* `tests/scrum630-default-en-dias.test.mjs` — reescritos los barridos con la zona EXPLÍCITA;
  añadidos el suelo del reloj (que `instanteDe`/`paredEn` son inversos y que la zona cambia el
  resultado), el de las dos direcciones (Madrid 365 · UTC 0 · Londres 210), el de Nueva York
  —que documenta que el control negativo también dependía de la máquina— y el que descarta que
  el barrido compare una función consigo misma. De 12 pruebas a 16.

## 7 · 🔴 HALLAZGOS FUERA DE ALCANCE

**No se tocan.** Se anotan porque son la misma familia que acaba de romper CI.

1. **La suite entera bajo la zona del runner queda VERDE:** con `TZ=UTC`,
   `tests 4182 · pass 4103 · fail 0 · skipped 79` — los mismos números que en local. El montaje
   sabe ver fallos bajo UTC (control positivo: contra el fichero VIEJO reporta sus dos rojos),
   así que ese 0 es un 0 de verdad.

2. **Pero hay CINCO tests más que miden la máquina.** Con `TZ=America/New_York` (desfase
   negativo) la suite baja a `pass 4098 · fail 5`:

   * `SCRUM-300 · la FECHA DE ENTREGA sale impresa, y es distinta de la de emisión`
   * `SCRUM-397 · una fecha FUTURA se rechaza: no puede ser un hecho`
   * `calcularSemaforo: fronteras exactas 0/5/6/-1 días`
   * `SCRUM-70 · la rotura por mes natural (art. 13) se mantiene al cruzar Trabajos`
   * `SCRUM-70 (ruta 1): "hasta el 31" incluye el 31 ENTERO`

   Con `Asia/Tokyo` (desfase positivo grande) están **las cinco en verde**, igual que en UTC y en
   Londres. O sea: **no fallan en CI hoy**, y por eso nadie los ha visto — pero heredan la zona
   del proceso exactamente igual que hacía éste.

   Dos de ellos pisan terreno fiscal (`SCRUM-70`, la rotura por mes natural del artículo 13;
   `SCRUM-397`, la fecha de cobro). Eso no los hace urgentes —el código que prueban corre en
   Railway, o sea en UTC, que es donde están verdes— pero sí los hace **candidatos a la misma
   regla del §4**: fijar la zona de la máquina donde ese código corre de verdad, que para todos
   ellos es UTC.
