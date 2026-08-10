# SCRUM-456 · Que todo test que salta **DIGA POR QUÉ**

**Fecha:** 10-ago-2026 · **Carril:** QA/suite · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `409780f4f15ac717021056993c2d5966bfa504e3` · 2026-08-10T21:44:42Z

**Paso 0:** `docs/master/SCRUM-456.md` **no existía** en `main` ni en ninguna rama remota. Premisa
reconfirmada sobre `main` de hoy: **74 saltos · 7 con motivo · 67 mudos**.

## 1 · Por qué era un defecto y no una curiosidad

La lección ya estaba escrita **en el árbol**, en `scrum419-…:128`:

> *«Un `skip: true` a secas es un test apagado sin motivo.»*

Y **67 tests la incumplían** sin que nadie los mirara. El trinquete construido para esto vigilaba 7.

> **Un trinquete que vigila la parte que ya sabíamos mirar no es un trinquete: es una confirmación.**

Y costó algo real el mismo día: el rojo del CI de SCRUM-438 salió de esta familia — un test que la
tanda local no ejecuta. Con 67 apagados sin motivo, **no sabíamos qué más estaba así**.

## 2 · Lo medido, por DOS caminos que dan el mismo número

| Camino | Cómo |
| --- | --- |
| **TAP** | `node --test --test-force-exit --test-reporter=tap tests/*.test.mjs`, contando `# SKIP` — el reporter `spec` **no** imprime el motivo, y por eso nadie lo había visto |
| **AST** | recorriendo los 391 ficheros de `tests/` y leyendo la expresión de cada `skip:` |

Los dos: **74 con `skip:` · 7 con motivo · 67 mudos**. Y los mudos, en dos formas: **65** con
`skip: !ENABLED }` y **2** con `skip: !DB }`, repartidos en **49 ficheros**, con tres gates —
`QA_DB_TEST` (47 ficheros), `A55_DB_TEST` (1) y `BOT_SUITE_TEST` (1).

## 3 · Lo construido

### 67 → 0. Cada salto nombra su variable **y el comando que lo arregla**

```
65  sin QA_DB_TEST=1 · npm run test:staging:gated
 1  sin A55_DB_TEST=1 · npm run test:staging:gated
 1  sin BOT_SUITE_TEST=1 · npm run test:staging:gated
 7  sin LIBRO_PG_URL (…)   ← los que ya lo decían
```

Quien lee el log en CI no tiene que ir a buscar cómo se ejecuta lo que no se ejecutó.

### Se EXTIENDE el trinquete de SCRUM-419 — no se construye otro

Un segundo trinquete sobre lo mismo es el defecto que cerraron SCRUM-436 y 447. El invariante que
aquel fichero ya tenía —*«cada salto dice por qué»*— **era correcto**; lo acotado era **dónde
miraba**: solo los ficheros que mencionan `LIBRO_PG_URL`. Ahora `todosLosSaltos()` recorre el árbol
entero **una vez** y `gateadosPorVariable()` **deriva de ella**: ni dos recorridos del AST, ni dos
suelos que puedan discrepar.

### 🔴 No se assertea ningún TOTAL

Un `assert(saltos === 74)` lo rompe la primera sesión que añada un test de base, alguien sube el
número, y **un número que la gente sube no es un trinquete: es un peaje** — pasó con el marcador de
SCRUM-402. Lo que se assertea es el **invariante**, cierto con 74, con 80 y con 3.

**El único número es el SUELO, y va al revés:** si el censo devuelve **cero**, falla — sabemos que
hay decenas, y un cero significa que no supo contar. Y **los tres recuentos van por separado**
(ficheros mirados · nodos recorridos · saltos encontrados): un suelo agregado puede tapar otro — un
escáner que leyera cuatro ficheros y encontrara saltos en ellos pasaría igual estando ciego para los
otros 387.

### El criterio es ESTRUCTURAL, no por nombre de variable

«Declara motivo» = **la expresión del `skip` contiene un literal de cadena no vacío**. Se hace así a
propósito y no buscando `QA_DB_TEST` o `LIBRO_PG_URL`: **un gate nuevo con una variable que hoy no
existe entra solo en la vigilancia.** Buscar los nombres de hoy es exactamente lo que dejó a 67
tests fuera durante meses.

## 4 · Verificación

| | Qué | |
| --- | --- | --- |
| **Control negativo** | cinco formas que **sí** declaran motivo —incluida una plantilla `` `sin ${VARIABLE}` `` y un apagado a mano— **no hacen caer nada**. Si el guard acusara a los que ya hacen lo correcto, se desactivaría al primer roce (el final de SCRUM-450) | ✅ |
| **Control del control** | cinco formas **mudas de verdad** —`true`, `!ENABLED`, `!DB`, una comparación de env y un `&& ''`— salen como mudas. Va **dentro del mismo test** | ✅ |
| **SUELO ×3** | ficheros mirados >300 · nodos >100 000 · saltos >0, **cada uno su assert** | ✅ |

### Los rojos por el mecanismo — **nombran el fichero y el test**

| Mutación | Cae diciendo |
| --- | --- |
| se le quita el motivo a uno de los 67 | *«HAY 1 TEST(S) QUE SE APAGAN SIN DECIR POR QUÉ: · scrum68-evidencias-firma.test.mjs → «SCRUM-68: sella evidencias…» · skip: !ENABLED»* |
| se le quita a uno de los **7** del banco | lo cazan **los dos** trinquetes, el viejo y el nuevo, cada uno con su mensaje |
| el escáner se queda ciego | *«ESCÁNER CIEGO: el extractor ve CERO tests gateados…»* (+3 tests) |

> ⚠️ **Y la post-condición evitó una prueba mal ejecutada.** La segunda mutación no casaba una vez
> sino **dos**, y `replace` solo cambia la primera: la comprobación de que el texto viejo ya no
> estaba **falló**, y con razón. Rehecha contando ocurrencias (2 → 1). Una inyección a medias es una
> prueba NO ejecutada, no una superada.

## 5 · Dónde se busca — el mecanismo YA existía

**No había que construir cómo se corren: `npm run test:staging:gated` existe**, toma el turno de
staging, aísla en tres procesos y tiene runbook (`docs/QA/SUITE_REGRESION.md`). Lo que faltaba era
**el puntero**. Medido, `grep -c` por fichero:

| | antes | ahora |
| --- | --- | --- |
| `CLAUDE.md` | **0 de 4** referencias | las cuatro |
| `docs/RUNBOOKS.md` | `test:staging` sí · **`LIBRO_PG_URL` no** | la receta del banco desechable |

`CLAUDE.md` dice ahora que **`npm test` no lo corre todo**, cómo ver los saltos con el reporter TAP
y los dos comandos. `RUNBOOKS.md` lleva la receta del **banco desechable**, copiada del `ci.yml` que
ya la ejecuta en cada PR.

> 🔴 **`exigirBancoDesechable` NO se relaja.** Exigir loopback y base terminada en `_test` es lo
> único que impide que una tanda que **borra filas** se ejecute contra algo que importe. Lo que se
> arregla es **saber montar el banco**, no el guard.

## 6 · Un comentario que describía un estado superado

La cabecera de `scrum419-…` decía que *«`ci.yml` no define esa variable ni levanta ningún
Postgres»*. **Ya no es cierto:** levanta `postgres:16-alpine` y su paso se llama «Tests (incluidos
los 7 de banco)». Se corrige **el texto**, no el mecanismo — y de hecho fue ese CI el que cazó el
rojo de SCRUM-438 que la tanda local no veía.

## 7 · Lo que NO se ha tocado

**Ningún test que hoy salte se ha activado.** Esta tarea hace que los saltos **se declaren**, no que
se ejecuten: activar 67 tests de base es otra conversación y otro riesgo. Tampoco se ha tocado
`exigirBancoDesechable`, `prisma/schema.prisma`, el camino de emisión, el sellado, el verificador ni
nada de `public/`.
