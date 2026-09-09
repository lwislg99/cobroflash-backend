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
