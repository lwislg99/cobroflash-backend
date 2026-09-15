# SCRUM-844 · La red del camino fiscal — los puntos que se rompen con la tanda en verde

**Fecha:** 9-sep-2026 · **Carril:** fiscal (solo tests) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `40f908f60ff0ece054d2c9e445b1fe9798fde3dc` · 2026-09-09T17:11:45+02:00
**Preámbulo:** `prisma generate` rc=0 · `npm run build` rc=0

> ⛔ **`src/` NO SE TOCA.** Este ticket escribe TESTS. Los rojos se inyectan en `src/`, se
> comprueban y **se restauran**: el árbol queda byte a byte como `main`, y se comprueba con
> `git status` después de cada uno.

---

## 0 · El orden no es el de la lista

> 🔒 **Un importe equivocado en una factura lo ve alguien. Una declaración equivocada en un XML
> no la ve nadie hasta que la mira Hacienda.**

Por eso el puesto 1 no es lo más frecuente ni lo más fácil: es lo que se rompe **invisiblemente**.

## 1 · Puesto 1 — las dos puertas del sellado dentro de transacción

`applyVeriFactu` y `applyVeriFactuAnulacion` rechazan que les pasen un cliente de transacción. Si
ese rechazo cae, N facturas de un mismo `$transaction` encadenan **todas a la misma huella
anterior** —no se ven entre sí sin commitear— y eso solo se deshace emitiendo **una R1 por cada
factura** (regla 29).

**El vector no es hipotético:** `recapitulativa.service.ts` emite N facturas en una sola
transacción, y el propio `verifactu.service.ts` lo nombra como «lo que habría pasado».

### 🔴 La cobertura EXISTÍA y estaba apagada

`tests/scrum173-cadena-verifactu-serializada.test.mjs` ya cubría las dos puertas… gateado por
`QA_DB_TEST`. Medido: en `npm test` sale **7 skipped, 0 pass**.

> 🔒 **Un test gateado que CI no corre no es un test que existe: es un test que existirá si algún
> día alguien pone la variable.**

Y **no hacía falta base**: el portón es `typeof prismaClient.$transaction !== 'function'`. Un
cliente de transacción de Prisma es `Omit<PrismaClient, ITXClientDenyList>` y `$transaction` está
en esa lista — **no tenerlo ES la forma de un `tx`**.

`tests/scrum844-sellar-dentro-de-transaccion.test.mjs`, 5 pruebas, sin base. **`scrum173` no se ha
tocado**: lo que él prueba —encadenamiento real, orden determinista, dos sellados concurrentes—
sigue necesitando una base y sigue siendo suyo.

### ⚠️ La trampa, medida puerta a puerta

El portón del alta está en `:283`, pero delante hay **tres puertas más**:

| doble | dónde muere |
|---|---|
| factura sin `type` | `unknown_invoice_type` |
| sin doble de `invoice` | TypeError: no puede leer `findUnique` |
| doble con `lines: []` | `invoice_without_lines_not_sealable` |
| con `type` **y** con líneas | ✅ `verifactu_seal_inside_transaction` |

O sea: `assert.rejects(() => applyVeriFactu(inv, nif, {}))` **sale verde** —la llamada sí
rechaza— habiendo probado un TypeError a cuarenta líneas del mecanismo.

> 🔒 **Un test escrito a la ligera puede pasar en verde habiendo probado otra puerta.**

Y las dos funciones **no son simétricas**: la anulación SÍ llega al portón con un doble vacío,
porque delante solo tiene el corte del `J-`. Copiar el caso de una para la otra da un verde
correcto en una y **falso** en la otra. Las dos cosas están fijadas como test.

### Los rojos, inyectados de verdad y restaurados

| rojo | qué cae | discrimina |
|---|---|---|
| los **dos** portones a `if (false)` | 3 tests | el positivo y la trampa siguen verdes |
| **solo** el del alta | 1, y solo ése | sí |
| **solo** el de la anulación | 2, y solo ésos | sí |

## 2 · Puesto 2 — qué documento se declara, y como qué tipo

`exigirTipoDeclarable` estaba en la lista de **exports huérfanos declarados**: ningún test lo
llamaba. `scrum413` vigila que la unión de tipos siga cerrada —otra pregunta— y las tres ramas de
esta función solo se ejercitaban de rebote, desde un test gateado.

**El vector: un justificante declarado como F1.** `AEAT_POR_TIPO.JUST` es `null` («no se
declara»); si devolviera `'F1'`, YaQu declararía ante la AEAT, con el nombre del profesional
encima, un documento que no es una factura.

`tests/scrum844b-que-documento-se-declara.test.mjs`, 6 pruebas. Rojos:

| rojo | qué cae |
|---|---|
| `JUST: 'F1'` en el mapeo | el vector, **y los dos suelos** — sin ningún `null` el mapeo es degenerado |
| el `throw unknown_invoice_type` → `return 'F1'` | el caso del tipo desconocido y el del prototipo |

Incluye un caso que no estaba en la lista y sale del propio código: `esTipoConocido` usa
`hasOwnProperty` a propósito, así que `'toString'` o `'constructor'` **no** cuelan como tipos.

## 3 · 🔴 PARADA — y por qué es la decisión correcta

La Sesión 3 midió después que **57 de los 129 puntos ciegos YA TIENEN TEST**, gateado. Escribir a
mano un test que ya existe y solo está apagado sería trabajo tirado, así que el resto de la lista
**se para** hasta saber si el banco desechable del CI sirve a los gateados.

## 4 · Y la pregunta que sí se podía contestar hoy: ¿algún gate ya no tiene motivo?

Auditados los siete de `scrum173`, uno a uno:

| test | ¿el motivo del gate sigue en pie? |
|---|---|
| ① sellar dentro de tx | **NO, a medias** — el rechazo no necesita base |
| ② mismo `createdAt` → encadena determinista | **SÍ** — mide qué devuelve `orderBy id desc` sobre filas reales |
| ③ dos sellados concurrentes | **SÍ** — necesita el advisory lock de verdad |
| ④ cadenas ya persistidas siguen válidas | **SÍ** — necesita historia real que recomputar |
| 173b anulación dentro de tx | **NO, a medias** |
| 177 el alta encadena a la anulación | **SÍ** |

**Y el patrón vale más que la cuenta**, porque dice dónde buscar en los otros 65 ficheros:

> 🔒 **Un gate puesto al FICHERO apaga también las mitades que no lo necesitaban.**

① y 173b **mezclan dos cosas dentro del mismo test**: una guarda de presencia que sí necesita base
(«con el cliente global SÍ sella») y un rechazo que es lógica pura. El gate está en el fichero, y
se llevó por delante la mitad pura. El gate no estaba mal puesto: **nadie separó las dos mitades**,
y un gate no puede distinguirlas.

Así que para barrer los 57, la pregunta que rinde **no** es «¿este fichero necesita base?»
—casi todos dirán que sí, y con razón— sino **«¿hay dentro algún assert que no la necesite?»**.

> 🔒 **«Llegar no es cubrir» — y un gate tampoco es una razón: es la razón que había el día que se
> puso.**

## 5 · Lo que NO se ha tocado

- **`src/`**: ni una línea. Comprobado con `git status` tras cada rojo.
- **`tests/scrum173-*`**: intacto. Su mitad con base sigue cubriendo lo suyo.
- **El resto de la lista** (puestos 3 a 6): sin escribir, a la espera de la medición del CI.

---

# SCRUM-844 · segunda tanda — se levanta la parada, y la lista ya no es la misma

**Fecha:** 15-sep-2026 · **Carril:** fiscal (solo tests) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `e88f46b5a1c8f0cd34f3e335abd2d76ae151c364` · 2026-09-15T10:29:48+01:00
**Y main siguió moviéndose mientras:** a `587afdeb` entre dos comandos de este mismo cierre.
No se re-ancla a él porque **no se ha medido contra él**: su diff sobre `src/` está vacío (solo
docs), así que lo de aquí sigue en pie — pero el ancla dice el árbol que se midió, no el último que
pasó por delante.
**Preámbulo:** `prisma generate` rc=0 · `npm run build` rc=0 · tanda base 6477 tests, 0 fallos

> ⛔ **`src/` NO SE TOCA.** Igual que la primera tanda: los rojos se inyectan en el fuente, se
> recompila, se comprueba y **se restaura el fuente Y su `.js` de `dist/`** verificando los dos
> con `Buffer.compare === 0` (SCRUM-763: restaurar el fuente no es restaurar el árbol).
> `git status src/` sale vacío después de cada uno.

---

## 6 · Por qué se levanta la parada del §3, y qué se hizo en su lugar

El §3 paró los puestos 3 a 6 con un motivo bueno: **57 de los 129 puntos ya tenían test, gateado**,
y escribir a mano lo que ya existe apagado es trabajo tirado. La parada esperaba a saber si el
banco desechable del CI servía para desgatearlos.

Seis días después, la pregunta que decide **no era ésa para estos puntos**. Medido función por
función: de las 16 funciones del ticket, la única con cobertura gateada era `verifactu.service`;
**las quince restantes no dependen de ningún gate**. `libroRegistro`, `libroRecibidas`,
`criterioCaja`, `suplidos`, `facturaSuelta`, `vistaPreviaSerie` y `selladoEstado` los cubren
—o los dejan sin cubrir— tests que CI **sí** corre. Así que la parada protegía de un riesgo que
en esta mitad de la lista no existía.

## 7 · 🔴 LA LISTA YA NO ES LA MISMA, Y ÉSTE ES EL NÚMERO NUEVO

Re-medido hoy por mutación, punto por punto, con la población de tests **directos** de cada
módulo. No es la lista de SCRUM-840 releída: es la misma pregunta hecha otra vez contra un `main`
que se ha movido.

| | |
|---|---|
| decisiones declarables medidas en las 16 funciones | **41** |
| 🔴 **vivas** — se rompen y no cae nadie | **22** |
| ✅ ya cubiertas por un test que CI corre | **19** |

**Diecinueve de los puntos que SCRUM-840 midió vivos hace seis días ya no lo están**, y no por
casualidad: `scrum294` cubrió el recargo y el criterio de caja, `scrum293` la retención, `scrum500`
la marca de suplido, `scrum289b` el IVA fuera de rango, `scrum780` la vista previa sin secuencia,
`scrum426` el libro de recibidas entero, `scrum141` los dos signos de la factura final, `scrum296`
la tenencia y los importes ilegibles del libro.

> 🔒 **Una lista de huecos es una foto, no un inventario.** La de SCRUM-840 lo dijo en su primera
> línea —«esta lista caduca»— y tenía razón en la mitad exacta de los casos.

**El ticket pedía 31. Medidos hoy son 41 decisiones, 22 vivas.** La diferencia no es que alguien
contara mal: SCRUM-840 enumeró **puntos mutables en `dist/`** por número de línea, y esto enumera
**decisiones del código de hoy**. Donde ellos contaban un punto por operando, aquí hay una
decisión con sus dos bordes; donde una función tenía seis líneas mutables, tiene siete decisiones.
Los números de línea de `dist/` no se han vuelto a usar: no son verificables desde el fuente.

## 8 · Los cuatro ficheros, y los 26 rojos

Cada caso se vio **caer** con su mutación antes de darlo por bueno. Ninguno se declara cubierto
por haber pasado en verde.

| fichero | puntos | pruebas | rojos ejecutados |
|---|---|---|---|
| `tests/scrum844c-el-xml-que-se-remite.test.mjs` | 8 (puesto 3) | 10 | 7 |
| `tests/scrum844d-quien-entra-en-la-cadena.test.mjs` | 4 (puesto 4) | 9 | 6 |
| `tests/scrum844e-el-libro-es-una-declaracion.test.mjs` | 6 (puesto 5) | 9 | 7 |
| `tests/scrum844f-lo-que-cambia-el-importe.test.mjs` | 4 (puesto 6) | 12 | 6 |

Los cuatro salen **`# skipped 0`**: ni uno de sus casos depende de una variable de entorno, que es
la mitad del sentido de este ticket.

## 9 · 🔴 TRES MUTANTES QUE SOBREVIVEN Y NO SON AGUJEROS — y cómo se distinguen

Lo más importante que sale de esta tanda no son los tests: es que **«el mutante sobrevive» tiene
tres causas distintas**, y llamarlas todas «hueco» publica agujeros que no existen.

**① INALCANZABLE · la guarda fail-closed del productor** (`verifactu.service`, 5 puntos).
Sustituir la condición entera por `if (false)` deja la tanda en **133 pass / 0 fail**. No es que
nadie mire: es que la condición **no puede ser cierta**. Los cinco datos del productor son
constantes literales de `productor.ts` —sin override por entorno, «ni de test», decisión del
fundador— y `scrum247` exige que ninguna esté vacía. Se cubre por estructura: que la guarda siga
ahí y siga mirando los cinco campos (por AST, no por texto), **y el enlace**: que ninguna
constante esté vacía, que es lo que la mantiene inalcanzable. Si ese enlace cae algún día, la
guarda deja de ser decorativa y la emisión de ese merchant está parada — y entonces es un STOP,
no un test en rojo.

**② EQUIVALENTE · sumar cero es no sumar** (`libroRegistro`). Cambiar
`if (suyo !== null) sinNumeroImporte += suyo` por `sinNumeroImporte += (suyo ?? 0)` no cambia
ningún resultado: `+ 0` es la identidad. El test SÍ cubre el punto, y se demuestra con la mutación
que sí cambia algo —invertir el comparador, que es el operador que usó SCRUM-840—: entonces cae.
Ídem con el operando `vfAnulHash` del filtro de la cadena: una entrada con `huella: null` nunca
casa con ningún `vfAnulPrevHash`, que siempre es una huella de 64 hex.

> 🔒 **Antes de acusar al test, comprueba que el comportamiento cambió.** Una mutación muda no
> mide la red: mide la mutación.

**③ PROTEGIDO POR EL COMPILADOR · el `RegistroAnulacion`**. La condición
`inv.vfAnulHash && inv.vfAnulTimestamp` de la emisión (no la del filtro) **no se puede mutar**:
`formatFechaHoraHuso(inv.vfAnulTimestamp)` exige el estrechamiento que da ese `&&`, así que
quitarlo no compila. Ahí la red no es la tanda, es `tsc`. Y eso también hay que saberlo, porque
es la única de las tres que se pierde entera el día que alguien escriba un `as` o un `!`.

## 10 · ⚠️ LA TRAMPA DEL TICKET, otra vez, y esta vez en mi propio test

El ticket avisaba: *«un test escrito a la ligera puede pasar en verde habiendo probado otra
puerta»*. Pasó aquí, y lo cazó el protocolo del rojo, no la revisión:

`assert.throws(() => vistaPreviaSerie(…, 2.5), RangeError)` **seguía verde con la guarda
arrancada**. Sin `Number.isInteger`, `formatInvoiceNumber` lanza **su propio `RangeError`**
cuarenta líneas más abajo («secuencia inválida: 2.5»). Mismo tipo de error, otra puerta. Ahora se
exige la frase de ESTA guarda.

Y de paso sale un dato que vale más que el test: ese punto está **defendido en profundidad**. Lo
que se pierde al romperlo no es la protección —la de abajo sigue— sino el mensaje que dice QUÉ
HACER, a cambio de uno genérico que manda a mirar donde no es.

## 11 · Y un hueco de población, no de criterio: el huso que nunca se ejecutó

`scrum643` ejercita `formatFechaHoraHuso` con zonas reales y está bien escrito. Pero sus dos zonas
son **UTC y Madrid**, las dos en el meridiano o al este: su `tzMin` nunca es negativo, así que la
rama `'-'` del ternario **no se ha ejecutado jamás en la tanda**. No es un criterio flojo: es una
población que no contenía el caso. Se cubre con un reloj explícito (los tres signos, borde `0`
incluido) y un control con `TZ=America/New_York` de verdad, con su comprobación de zona efectiva
para no salir ciego.

## 12 · Lo que NO se ha tocado

- **`src/`**: ni una línea. `git status src/` vacío tras cada uno de los 26 rojos.
- **`prisma/schema.prisma`**: no se abre.
- **Ningún test ajeno**: `scrum173` sigue gateado y sigue siendo suyo lo que cubre; `scrum643`
  intacto — lo de aquí es la zona que a él le faltaba, no una corrección.
- **Ningún estado, flag ni microcopy nuevo** (reglas 27 y 30).
- **Los gateados**: no se ha desgateado ninguno. Sigue abierto el hallazgo colateral del ticket
  —66 ficheros que la casa cree tener y CI no corre— y sigue siendo ticket propio.

## 13 · Lo que queda

- Los **5 puntos del productor** quedan cubiertos por estructura, no por comportamiento. Es lo
  máximo que se puede hacer sin tocar `src/`; hacerlo por comportamiento exigiría un camino de
  inyección que el fundador ya descartó a propósito, y proponerlo sería cambio de máster.
- El **puesto 1 y el 2** (las dos puertas del sellado y `exigirTipoDeclarable`) siguen como los
  dejó la primera tanda.
- La pregunta del §4 —«¿hay dentro de un gateado algún assert que no necesite base?»— sigue sin
  barrer en los otros 65 ficheros.
