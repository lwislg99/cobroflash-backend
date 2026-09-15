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

---

# SCRUM-844 · APÉNDICE · 15-sep-2026 · El §13 barrido: 29 asserts que no necesitan base

**Medido contra:** `origin/main` = `c3dce7aa36e8a32cb34a2142269ac04d0845dcc2` · 2026-09-15T11:30:34Z
**Rama:** `scrum-844-barrido-asserts-sin-base` · **Carril:** instrumentos · **Gate:** sin gate

> 📌 Encabezado `# SCRUM-844` por el delimitador de `scrum267-ancla-de-medicion.test.mjs:147`.

Cierra el hueco que el §13 dejó escrito: **«la pregunta del §4 sigue sin barrer en los otros 65
ficheros»**. La pregunta se usa LITERAL, no reformulada:

> **«¿hay dentro de un gateado algún assert que no necesite base?»**

⛔ **Esto MIDE.** No arregla nada, no escribe tests (eso es otro ticket) y **no toca `src/`**. Los
ficheros del camino fiscal se han **leído**: ni uno modificado, ni siquiera para medir (regla 38).

**Instrumento:** `docs/master/evidencias/scrum844/barrido-asserts-sin-base.mjs` ·
salida en `salida-barrido.txt`. Sin base, sin red, sin claves.

---

## 1 · La población: 64, no 65 ni 57

| | |
|---|---|
| ficheros `.test.mjs` mirados | 798 |
| ficheros **con tests gateados** | **64** |
| tests gateados | 107 |

⚠️ La entrada se contradice sobre el número: el §4 dice «para barrer **los 57**» y dos párrafos
antes «los otros **65** ficheros»; el §13 dice **65**. Medido hoy por AST —resolviendo el `skip`
hasta el `process.env`, porque los gates se escriben de cuatro formas (`!ENABLED`, `!GATE`, `!DB`,
ternario)— salen **64**. No es corrección de nadie: los números venían de contar a ojo en momentos
distintos. El que cuenta es el que se puede volver a medir.

---

## 2 · 🔴 EL SUELO, y encontró tres defectos MÍOS antes que ningún hallazgo

Un barrido que dijera «todos cubiertos» no vale. Aquí el suelo es **doble**:

**① La respuesta CONOCIDA.** El §4 auditó a mano siete tests de `scrum173` y dijo cuáles tienen
mitad pura (① y 173b) y cuáles necesitan base de verdad (②, ③, ④, 177). El instrumento tiene que
reproducir ESO:

```
✅ ve173_1   ✅ ve173b   ✅ noSeñalaEl2   ✅ noSeñalaEl3   ✅ noSeñalaEl177
   → ✅ el instrumento distingue
```

**② La SIEMBRA.** Un test fabricado con las dos mitades dentro —una consulta a `prisma` y una
transformación de cadena pura—. El instrumento tiene que **separarlas**, que es literalmente el
fenómeno del §4. Se clasifica en memoria: no se escribe nada en el árbol.

### Lo que el suelo cazó, y no fueron hallazgos sino errores del instrumento

| # | defecto MÍO | lo cazó | la lista pasó de |
|---|---|---|---|
| 1 | sólo ensuciaba identificadores sueltos: `const [s1, s2] = await Promise.all(...)` y `for (const inv of ...)` escapaban | **el suelo del §4** (señalaba el ③, que sí necesita base) | 115 → 71 |
| 2 | la RED no contaba como base: una cookie de `fetch(/auth/verify)` no existe sin merchant real | **leer la lista** (§4 no lo cazaba: sus siete tests no hacen HTTP) | 71 → 44 |
| 3 | sólo miraba declaraciones: `let row; … row = await prisma…` dentro de un `try` escapaba | **leer la lista** | 44 → 29 |

> 🔒 **Por eso el resultado es una LISTA y no un porcentaje.** Dos de los tres defectos de arriba
> son invisibles en un número: sólo aparecen cuando alguien lee las líneas una por una. Un
> porcentaje se celebra; una lista se arregla — y, de paso, arregla el instrumento.

---

## 3 · LA LISTA · 29 asserts en 8 ficheros

`A` = ningún operando desciende de la base · `B` = comprueba el mensaje de un error contra un literal

| fichero | línea | clase | assert |
|---|---|---|---|
| `tests/a55-window-quote.test.mjs` | 39 | A | `equal(process.env.WHATSAPP_DRY_RUN)` |
| `tests/bot-suite.test.mjs` | 148, 149, 176, 191, 217, 224, 230, 231, 237, 243, 244, 245, 252, 255, 299, 301, 324 | A | 17 asserts sobre el `outbox` en memoria y sobre `last()` |
| `tests/scrum106-trabajos-fecha.test.mjs` | 24 | A | `equal(CAMPO_FECHA_TRABAJOS)` — una constante |
| `tests/scrum115-wa-fallo-registrado.test.mjs` | 108, 109 | A | `result.ok` / `result.reason` del sender |
| `tests/scrum173-cadena-verifactu-serializada.test.mjs` | 51, 188 | B | `match(err.message, /verifactu_seal_inside_transaction/)` |
| `tests/scrum222-deriva-arranque.test.mjs` | 291, 298, 299 | A | `r.estado`, `r.tablas`, `r.columnas` del comparador |
| `tests/scrum72-pdfs-privados.test.mjs` | 36, 40 | A | `invoicesDir` no está bajo `public/` y sí bajo `storage/` |
| `tests/scrum728d-ms-en-loopback.test.mjs` | 133 | A | `rtt < 5` |

### Los dos que mejor ilustran el §4

* **`scrum72:36` y `:40`** — comprueban que `invoicesDir` no cuelga de `public/`. Es una
  **regresión de configuración**: una transformación de cadena sobre un valor importado. No hay
  base por ningún lado, y está apagada detrás de `QA_DB_TEST` porque el gate se puso al FICHERO.
  El propio comentario del test la llama «EL ASSERT DE REGRESIÓN (el que blinda esto para
  siempre)» — y hoy sólo corre cuando alguien levanta Postgres a mano.
* **`scrum173:51` y `:188`** (categoría B) — son los que §4 audita y declara «NO, a medias». Lo que
  afirman es una **regla** (`verifactu_seal_inside_transaction`), no un dato.

---

## 4 · ⚠️ Lo que esta lista NO dice

* **No dice que ningún assert sobre.** Dice «éste no parece necesitar base» y pone el dedo.
  Separar la mitad pura de la que sí la necesita —extraerla, darle su test sin gate— es trabajo de
  otro ticket, y de `src/` no se ha tocado nada.
* **Las 17 de `bot-suite` van juntas a propósito**: son un cuerpo de conversación sobre un
  `outbox` en memoria, y sacarlas del gate es una decisión de ese fichero, no de éste.
* **La categoría B es un criterio de FORMA**, no una prueba de que la guarda sea pura: afirma que
  se está comprobando una regla contra un literal. Para ① y 173b coincide con la auditoría a mano
  del §4; para un caso nuevo, habría que mirarlo.
* El barrido mira `assert.*`. Un `expect(...)` o un `throw` propio no los ve — aquí no hay, pero
  si entraran, entrarían sin que esto avise.

## 5 · Lo NO tocado

`src/` entero · los ficheros del camino fiscal (**leídos**, regla 38) · `prisma/schema.prisma` ·
los gates · ningún test nuevo. Ninguna base, ninguna clave. **Nada ejecutado contra producción ni
contra staging.**

---

# SCRUM-844 · APÉNDICE · 15-sep-2026 · Fuera del gate: de 29 candidatos salen 3

**Medido contra:** `origin/main` = `c50c6a54b61d9518f6cb98ec14def5d3ed897222` · 2026-09-15T13:00:07Z
**Rama:** `scrum-844-fuera-del-gate` · **Carril:** instrumentos · **Gate:** sin gate

Cierra lo que el apéndice anterior midió. **`src/` intacto**: esto mueve asserts de sitio respecto
al gate, no cambia producto. Ni una palabra del texto de ningún assert ha cambiado.

---

## 1 · 🔴 NO ME FIÉ DE MI PROPIA LISTA, y menos mal

Los 29 salían de un análisis estático que ya se había equivocado tres veces esa mañana.
«Estáticamente no necesita base» es una **hipótesis**. Se ejecutaron los 29 **sin base levantada**
(`QA_DB_TEST` y `A55_DB_TEST` vacíos, sin `DATABASE_URL`):

| candidato | veredicto ejecutado | por qué vuelve dentro |
|---|---|---|
| `scrum72:36`, `:40` | ✅ **PASA sin base** | — **sale** |
| `scrum106:24` | ✅ **PASA sin base** | — **sale** |
| `a55:39` | 🔴 FALLA | `process.env.WHATSAPP_DRY_RUN` no vale `'1'` fuera del arranque gateado. Es una **precondición del carril**, no una afirmación sobre el producto |
| `scrum115:108`, `:109` | 🔴 FALLA | el sender escribe su fila de log; sin `DATABASE_URL` el resultado no llega a `demo_safe_numbers` |
| `scrum173:51`, `:188` | 🔴 FALLA | `$transaction` revienta por falta de cliente **antes** de que salte la guarda |
| `scrum222:291`, `:298`, `:299` | 🔴 FALLA | `comprobarDerivaDeSchema()` lee `information_schema` → `estado=no-pude-comprobar` |
| `scrum728d:133` | 🔴 FALLA | el RTT se mide con `prisma.$queryRaw` |
| `bot-suite` ×17 | 🔴 FALLA | los diecisiete viven en **UN** test que abre con `withMerchant(prisma, …)` |

> **De 29: salen 3, vuelven 26.** El encargo avisaba «si volvieron 0, sospecha de ti mismo». Volvió
> el 90 %: el sospechoso era el instrumento, y con razón.

### Las correcciones que esto le hace al barrido — y son cinco más

Las tres de la mañana salieron del suelo y de leer la lista. Éstas sólo podían salir de EJECUTAR:

| # | por dónde se escapaba | caso |
|---|---|---|
| 4 | **mutación por método**: `rtts.push(<sucio>)` no es una asignación, así que `rtts` nunca se ensuciaba | `scrum728d` |
| 5 | **función de dominio que abre su propia conexión**: no dice `prisma.` por ningún lado | `scrum222` |
| 6 | **precondición del CARRIL**, no de la base: `WHATSAPP_DRY_RUN` no es un dato de Postgres y aun así no se cumple fuera del gate | `a55` |
| 7 | la categoría **B acertaba sobre producción y fallaba sobre el test**: la guarda de `verifactu_seal_inside_transaction` *es* pura, pero el test no puede alcanzarla sin cliente vivo | `scrum173` |
| 8 | **la unidad nunca fue el assert**: 17 de los 29 son un cuerpo de conversación dentro de un solo test | `bot-suite` |

🔒 La nº 7 es la que más enseña: **§4 tenía razón sobre el código y aun así el assert no puede salir
del gate.** «El rechazo no necesita base» describe la guarda de producción; el test, tal como está
escrito, llega a ella a través de `prisma.$transaction`. Separar las dos mitades exigiría reescribir
el test, y eso es otro ticket.

---

## 2 · Lo que sale, y por qué importa

**`scrum72:36` y `:40`** — el caso que abrió todo esto. Su propio comentario los llama
**«EL ASSERT DE REGRESIÓN (el que blinda esto para siempre)»**, y sólo corrían si alguien levantaba
Postgres a mano. Comprueban que `invoicesDir` no ha vuelto bajo `public/` — una regresión de
seguridad/RGPD (los PDFs servidos como estático con nombres enumerables). **Un assert que no corre
no blinda nada.** Ahora corre en cada tanda.

**`scrum106:24`** — fija la decisión del fundador (el criterio es `scheduledAt`, opción C). Es una
constante del módulo.

Los dos siguen con **su texto intacto**; lo único que cambia es dónde viven respecto al gate.

---

## 3 · ✅ CONTROL POSITIVO: ni un gateado se ha colado fuera

| | antes | después |
|---|---|---|
| ficheros con tests gateados | 64 | **64** |
| **tests gateados** | **107** | **107** |
| asserts señalados dentro del gate | 29 | **26** |
| tests gateados que aún contienen alguno | — | **7** |

**Ninguno escapó.** Si uno se hubiera colado fuera, la tanda empezaría a dar rojos que no son
defectos y alguien acabaría relajando el gate entero.

### ⚠️ Corrección de unidades al enunciado: 107 − 29 ≠ 78

El encargo dice «los 107 − 29 = 78 tests gateados que SÍ necesitan base». **29 son ASSERTS y 107
son TESTS**: no se restan. Los 29 asserts vivían dentro de **9** tests gateados (de 107), no de 29.
Tras el movimiento quedan **26 asserts en 7 tests**, y los **107** tests gateados siguen los 107.

### ⚠️ Y «110 skipped» no es un verde

La tanda salta 110 tests, y **un test saltado se cuenta como pasado** (SCRUM-754). Esos 110 no
midieron nada: son los gateados esperando su carril. El verde de abajo es sobre los que SÍ
corrieron.

---

## 4 · El límite declarado, cerrado en CERO

El apéndice anterior dejó escrito que el barrido mira `assert.*` y que un `expect(` no lo vería.
Censado sobre los **64** ficheros de la población: **0 ocurrencias de `expect(`, en 0 ficheros.**
El límite era teórico. *(El censo lleva su propio suelo: sobre una fuente con dos `expect(`
cuenta dos — si contara cero también ahí, su cero no significaría nada.)*

---

## 5 · Mover no es borrar, y se comprueba

| fichero | asserts ejecutables antes → después | tests antes → después |
|---|---|---|
| `scrum72-pdfs-privados` | 27 → **27** | 1 → 2 |
| `scrum106-trabajos-fecha` | 7 → **7** | 1 → 2 |

Ni una aserción añadida ni perdida. El número de bloques `test()` sube en uno por fichero porque
**sacar un assert del gate exige un `test()` que no esté gateado**: es el mecanismo del cambio, no
cobertura nueva. No hay ni un assert que antes no existiera.

> ⚠️ Contar esto también tuvo su trampa: `grep -c 'assert\.'` daba 7→**8** en `scrum106` y no había
> ningún duplicado — contaba mi propio comentario, que termina en «no al assert.». Es la lección de
> SCRUM-740 mordiendo otra vez: *un guard que cuenta menciones vigila la prosa*. Se recuenta
> exigiendo que la línea EMPIECE por `assert.`.

## 6 · Lo NO tocado

`src/` entero · el camino de emisión fiscal (regla 38: `scrum173` es un TEST del camino, y ni él ni
`src/` se han modificado) · el texto de ningún assert · los gates · `prisma/schema.prisma` · los 26
asserts que volvieron dentro. Ninguna base, ninguna clave. **Nada ejecutado contra producción ni
contra staging.**

---

# SCRUM-844 · APÉNDICE · 15-sep-2026 · ¿Está cumplida la promesa? 25 cubiertos, 0 descubiertos, 6 no medibles

**Medido contra:** `origin/main` = `51fb635ca3391cc769a6583a8aab08945e1fb5e0` · 2026-09-15T13:29:27Z
**Rama:** `scrum-844-promesa-cumplida` · **Carril:** medición · **Gate:** sin gate

⛔ **Esta tanda NO construye nada.** No se cubre ningún punto que salga descubierto: se mide, se
lista, y decide el fundador (regla 9). `src/` intacto, ni un test nuevo ni uno menos.

---

## 0 · 🔴 EL SUELO, Y VA ANTES QUE CUALQUIER CIFRA: los 31 NO se pueden enumerar desde el ticket

El ticket promete «31 puntos … los 31 se cubren». Desglosado literalmente:

| puesto | sujeto | puntos declarados |
|---|---|---|
| 1 | las dos puertas (`verifactu.service.ts:283`, `:398`) | 2 |
| 2 | `exigirTipoDeclarable` (`:143·144·146`) | 3 |
| 3 | `buildVerifactuRegistrosXml` (`:497×4·498·521·529·483`) | 8 |
| 4 | `entraEnLaCadena` (`:68×3`) + `formatFechaHoraHuso` (`:58`) | 4 |
| 5 | `construirLibroRegistro` (6) + `construirLibroRecibidas` (2) | 8 |
| 6 | `calcularRecargo`, `leerTipoRetencion`, `clasificarPorCobro`, `leerMarcaSuplido`, `validarFacturaSuelta`, `vistaPreviaSerie`, `huecosSerie` | **sin reparto** |
| | **identificables uno a uno** | **25** |

Los 6 que faltan para 31 se reparten entre **SIETE** funciones **sin decir cuántos lleva cada una**.
Siete no caben en seis, así que no hay forma de mapearlos uno a uno.

Y hay una razón de fondo, escrita por la propia sesión que los trabajó (**§7 de este fichero**):

> «El ticket pedía 31. Medidos hoy son **41 decisiones, 22 vivas**. […] SCRUM-840 enumeró **puntos
> mutables en `dist/`** por número de línea […] **Los números de línea de `dist/` no se han vuelto
> a usar: no son verificables desde el fuente.**»

🔒 **Los «31» no son un inventario: son una foto de `dist/`.** Por eso los 6 sin reparto se declaran
**NO MEDIBLES** y **no cuentan como cubiertos**: vacía y no-medida se leen igual y significan lo
contrario.

---

## 1 · LOS TRES NÚMEROS, Y SUMAN 31

| veredicto | nº |
|---|---|
| ✅ **CUBIERTO** — con test que CI corre y que CAE si se rompe | **25** |
| 🔴 **NO CUBIERTO** | **0** |
| ⚠️ **NO MEDIBLE** — no enumerable desde el ticket (puesto 6) | **6** |
| | **31** |

### El filtro que de verdad decide: ninguno está sólo escrito

Un punto cuyo test esté gateado tras `QA_DB_TEST` **no está cubierto: está escrito**. Comprobado
uno a uno — **todos los tests asignados salen `# skipped 0`**:

`scrum844` (5) · `scrum844b` (6) · `scrum844c` (10) · `scrum844d` (9) · `scrum844e` (9) ·
`scrum844f` (12) · `scrum426` (17) · `scrum294` (15) · `scrum291` (15) · `scrum293` (10).

Eso es justo lo que denunciaba el ticket y ya no pasa: `scrum173` salía **7 skipped, 0 pass**, y las
dos puertas las cubre ahora `scrum844`, sin base y sin gate.

---

## 2 · LOS 25, UNO A UNO, CON SU ROJO EJECUTADO

Cada sujeto se rompió **en `dist/`** (salida de compilación — `src/` jamás se tocó) y se comprobó
que el test asignado CAE. Restaurado y verificado por sha256: **los 7 ficheros idénticos**.

| puesto | pts | sujeto | test que cae | rojos |
|---|---|---|---|---|
| 1 | 2 | las dos puertas del sellado | `tests/scrum844-sellar-dentro-de-transaccion.test.mjs` | **3** |
| 2 | 3 | `exigirTipoDeclarable` | `tests/scrum844b-que-documento-se-declara.test.mjs` | **5** |
| 3 | 8 | `buildVerifactuRegistrosXml` | `tests/scrum844c-el-xml-que-se-remite.test.mjs` | **8** |
| 4 | 3 | `entraEnLaCadena` | `tests/scrum844d-quien-entra-en-la-cadena.test.mjs` | **5** |
| 4 | 1 | `formatFechaHoraHuso` | `tests/scrum844d-quien-entra-en-la-cadena.test.mjs` | **4** |
| 5 | 6 | `construirLibroRegistro` | `tests/scrum844e-el-libro-es-una-declaracion.test.mjs` | **7** |
| 5 | 2 | `construirLibroRecibidas` | `tests/scrum426-libro-recibidas.test.mjs` | **15** |
| | **25** | | | |

### Puesto 6 — las siete funciones tienen cobertura, y los puntos siguen siendo NO MEDIBLES

| función | test que cae | rojos |
|---|---|---|
| `calcularRecargo` | `tests/scrum294-recargo-caja.test.mjs` | **6** |
| `leerTipoRetencion` | `tests/scrum293-retencion-irpf.test.mjs` | **1** |
| `huecosDeLaSerie` | `tests/scrum291-series-huecos.test.mjs` | **6** |
| `clasificarPorCobro` · `leerMarcaSuplido` · `validarFacturaSuelta` · `vistaPreviaSerie` | `tests/scrum844f-lo-que-cambia-el-importe.test.mjs` (12, `skipped 0`) | — |

Las **siete** tienen test que CI corre. Pero el ticket no dice **cuáles 6 de las 7** son los puntos,
así que no se pueden dar por cubiertos punto a punto. Se declara CIEGO sobre ellos, que es lo que
pedía el suelo.

---

## 3 · 🔴 DOS DE MIS PROPIOS CONTROLES SALIERON MAL PRIMERO, Y ESO ES EL HALLAZGO

**① El control POSITIVO dijo «no cae» sobre el punto nº 1 por gravedad de todo el ticket.**
Sustituí `throw new Error('verifactu_seal_inside_transaction')` por `void 0`… y esa cadena **no
existe**: el código real es `throw new Error('verifactu_seal_inside_transaction: applyVeriFactu
debe…' + …)`. El `split().join()` casó **cero** veces, el fichero quedó intacto, y el test pasó en
verde.

> 🔒 **Una mutación que no se aplica y una cobertura que no existe dan EXACTAMENTE la misma
> salida.** Sin comprobar que la mutación entró, habría declarado NO CUBIERTO el puesto 1.

Rehecho contra el `if`, las dos puertas caen y tiran **3** tests — el mismo número que registró §1.

**② La mutación del puesto 3 dio `pass 0 · fail 1`**, que parece «el test cae». No lo era: metí el
`return` **dentro de una lista de parámetros de varias líneas**, rompí la sintaxis y el fichero no
cargó. Rehecha sobre `opts = {}) {`, caen **8**.

**③ Y el ayudante con aserción de ancla cazó otras dos.** `exigirTipoDeclarable(inv)` y
`entraEnLaCadena(inv)` no existen —son `(tipo, numero)` y `(numero, merchant)`—. Al exigir que el
ancla apareciera **exactamente una vez**, se negó a mutar y lo dijo, en vez de no hacer nada en
silencio.

🔒 La diferencia entre ① y ③ es la aserción del ancla. Es la lección de esta mañana —el `grep` que
contaba mi propio comentario— en su versión cara: **un instrumento que no comprueba que ha hecho
algo informa de lo que no midió.**

---

## 4 · La tanda, con su población

| | |
|---|---|
| tests | **6681** |
| pass | **6571** |
| fail | **0** |
| skipped | **110** ⚠️ |

⚠️ **Los 110 saltados NO midieron nada**, y un test saltado se cuenta como pasado (SCRUM-754). El
verde es sobre los **6571** que corrieron.

> ⚠️ Antes de reconstruir salían **16 rojos**, y no eran del árbol: el cliente de Prisma estaba
> desfasado respecto a un `schema.prisma` que se movió bajo mis pies (el `GatewayEvent` de otra
> sesión). `prisma generate` + `build` y a cero. Se deja escrito porque es el segundo tropiezo igual
> del día: **el cliente generado no es parte del árbol y caduca sin avisar.**

---

## 5 · Veredicto

**La promesa no se puede declarar cumplida en sus términos literales** — y no porque falte trabajo:

* **0 puntos descubiertos** de los que se pueden enumerar;
* **25 de 25 cubiertos**, cada uno con test sin gate y rojo ejecutado;
* **6 no medibles**, y la §7 explica por qué: los 31 eran líneas de `dist/`, no decisiones del
  fuente.

🔒 **Un ticket no se cierra porque haya trabajo suyo en main** (regla 23). Aquí hay bastante más que
trabajo: hay 25 puntos cubiertos y vistos caer. Lo que no hay es forma de afirmar «los 31», porque
los 31 nunca fueron enumerables. **Decide el fundador:** cerrar por los 25 dejando constancia de que
la población era una foto, o redefinir los 6 antes de cerrar.

## 6 · Lo NO tocado

`src/` entero · el camino de emisión fiscal (regla 38: leído, y mutado sólo en `dist/`, que es
salida de compilación, restaurado byte a byte) · ningún test nuevo ni uno menos · ningún punto
cubierto de los que salieran sin cubrir (no salió ninguno). Ninguna base, ninguna clave. **Nada
ejecutado contra producción ni contra staging.**

---

# SCRUM-844 · APÉNDICE · 15-sep-2026 · El hueco de la auditoría, cubierto: el tipo de IVA del libro de recibidas

**Medido contra:** `origin/main` = `9070f3d780938b6b1f53cf6afbeb55f71221229b` · 2026-09-15T16:17:27+02:00
**Rama:** `scrum-844b-el-tipo-de-lo-recibido` · **Carril:** fiscal (solo tests) · **Gate:** sin gate
**Hora del ancla corregida** con la cabecera `Date:` de GitHub: el reloj de esta máquina iba 332 s adelantado.

> ⛔ **Solo tests. `src/` no se toca.** Los rojos se inyectan en el FUENTE, se recompila, y se
> restauran fuente y `dist/` byte a byte, con `git status src/` vacío después de cada uno.

## 1 · El hueco

La auditoría del 15-sep-2026 (comentario en SCRUM-844) midió dos operandos vivos en `tipo()`
(`libroRecibidas.ts`), que es la función que da el `tipoIva` de cada asiento del libro de recibidas:

```ts
if (n === null || !Number.isInteger(n) || n < 0 || n > 100) return null;
```

* sin `n > 100` → un gasto con `vatRate: 150` salía con `tipoIva: 150`;
* sin `n < 0` → un `vatRate: -5` salía con `tipoIva: -5`;

y con cualquiera de los dos **la tanda completa —789 ficheros, por lotes— seguía con 0 fallos**. El
tercer operando (`!Number.isInteger`) sí lo caza `scrum426` («una fracción NO se acepta»).

No es un caso de laboratorio:

* **alcanzable** — `Expense.vatRate` es `Int?` y `POST /admin/expenses` no lo valida (solo exige
  `concept` y `amount`), así que `tipo()` es la ÚNICA defensa;
* **declarado** — `librosAeat.ts:238` pinta ese `tipoIva` en la fila del libro de recibidas, que se
  entrega.

## 2 · Por qué no lo recogía el apéndice de la promesa (#1279)

No es una contradicción: es otra población. Aquel apéndice cuenta **25 cubiertos · 0 descubiertos ·
6 no medibles sobre los 31 del ticket**, y el rango de `tipo()` no está entre esos 31. Además se
mergeó (14:05Z) antes de que existiera el comentario de la auditoría (15:59). No cubre esto con
ningún test: su PR solo trae este fichero.

## 3 · El test

`tests/scrum844g-el-tipo-de-lo-recibido.test.mjs`, 3 pruebas, sin gate y sin base. En fichero propio:
`scrum426` es de otro carril y no se amplía.

| prueba | qué exige |
|---|---|
| ✅ control positivo | un 21 se declara como 21 — sin él, un `tipo()` que devolviera siempre `null` pasaría los dos rojos |
| 🔴 150 % | sale `null` |
| 🔴 −5 % | sale `null` |

Las tres llevan **suelo**: el gasto tiene que producir asiento, porque sin asiento `tipo()` no se
ejecuta y «sale `null`» se cumpliría por vacío.

## 4 · Los dos rojos, por el FUENTE

| mutación en `src/` | `tsc` | ¿llegó a `dist/`? | qué cae |
|---|---|---|---|
| sin `n > 100` | rc 0 | sí | **solo** «un tipo de 150 % NO se declara» |
| sin `n < 0` | rc 0 | sí | **solo** «un tipo NEGATIVO (−5 %) NO se declara» |

Tras cada uno: fuente **byte a byte** · `dist/libroRecibidas.js` **byte a byte** · **hash de todo
`dist/` igual al de antes** (por si `tsc` hubiera reescrito algo más) · `git status src/` **vacío**.
Control sin mutar, antes y después: 3 pass · 0 fail.

## 5 · La tanda completa

**805 ficheros · 6592 pass · 0 fail · 110 skipped**, corrida POR LOTES de 120 (nunca en una sola invocación: con 789 ficheros el límite de línea de comandos de Windows dejó al arnés sin salida y devolvió `null` con forma de resultado), con detección de lote ciego: **ninguno ciego**. `src/` limpio y `dist/` restaurado al terminar.

## 6 · Lo NO tocado

* **`src/`**: ni una línea.
* **`scrum426` y `844e`**: intactos.
* **`productor.ts:39`** (`"<Luis Lara Granado>"` en el XML): fiscal, lo decide el fundador.
* Las dos precisiones de la auditoría —`vistaPreviaSerie` `seqF < 1` pierde el mensaje, y «`scrum426`
  cubrió el libro de recibidas entero» no es cierto— quedan en su comentario del ticket: no son
  objetivo de esta tanda.
