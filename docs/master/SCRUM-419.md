# SCRUM-419 · El guard de evidencias no corre en CI, y «0 fallos» no lo dice

**Medido contra:** `origin/main` = `9ed7f26c763a349c8ad0e776e6533f491d606003` · 2026-08-10T18:18:53+02:00
**Rama:** `scrum-419-ci-declara-lo-que-no-corre`

---

## 🔴 ANTES DE NADA: EL TICKET QUE HAY DEBAJO NO ES ÉSTE

Lo pediste explícitamente y la medición confirma el caso: **los 7 tests gateados necesitan un
Postgres de verdad. Todos.** Ninguno puede correr sin banco sin dejar de probar lo que prueba.

Así que **hacer que corran en CI es «CI necesita una base»**: coste recurrente, decisión del
fundador (regla 36) y **ticket aparte**. No se cuela aquí.

Lo que sí se puede hacer hoy, y es lo que entrega este ticket, es el **suelo**: que la salida de CI
distinga **«0 fallos porque pasó»** de **«0 fallos porque no se ejecutó»**. Hoy son el mismo número.

---

## PASO 0 · (1) Qué gatea exactamente `LIBRO_PG_URL`

Cinco ficheros lo nombran. El gate es siempre la misma forma —
`{ skip: !ENABLED && 'sin LIBRO_PG_URL (banco local)' }` — y **`ENABLED` es simplemente que la
variable no esté vacía**. Cada fichero valida además que el banco sea **desechable** antes de
tocarlo: loopback, nombre terminado en `_test`, y ninguna de las bases del proyecto.

**Y `.github/workflows/` NO define la variable ni levanta ningún servicio de Postgres.** Medido:
cero apariciones en `ci.yml` y `zona-roja.yml`. Los 7 se saltan en CI **siempre**.

## PASO 0 · (2) Cuántos necesitan banco de verdad — la separación

Derivado por AST (el gate viaja en el objeto de opciones de `test()`, así que un `grep` del nombre
de la variable contaría también los comentarios que explican cómo correrlos):

| fichero | tests | **gateados** |
|---|---|---|
| `scrum244-supresion-y-anonimizado` | 10 | **1** |
| `scrum295-modelo-303-postgres` | 1 | **1** |
| `scrum296-libro-postgres` | 1 | **1** |
| `scrum297-evidencias-postgres` | 2 | **2** |
| `scrum389-un-solo-iva` | 2 | **2** |
| | **16** | **7** |

Nueve de esos 16 corren siempre. **Los 7 gateados necesitan banco, sin excepción**, y el motivo es
el mismo en todos: crean un `PrismaClient` real contra la URL y prueban **tenencia contra el motor**
—que un merchant no vea ni un euro ni una factura del otro— o el **cuadre entre pantallas** al
céntimo. Un cliente falso no puede probar eso: probaría que el filtro se aplica *como se lo pasen*,
que es justo lo que ya cubren los tests sin gate.

> **El riesgo del ticket, dicho:** la salida fácil era quitar el gate y verlos verdes sin banco.
> Eso habría **fabricado el defecto que este ticket persigue** — un test que corre y no prueba nada.
> Si un test necesita banco, lo necesita. Lo correcto es que **CI declare que no lo corrió**.

## PASO 0 · (3) El recuento GATEADO, fase por fase

Levantado un Postgres desechable en `127.0.0.1:55432/yaqu_libro_test` (portable, fuera del
proyecto; esquema por `migrate diff --from-empty` con el binario local):

| fichero | pass | fail | skip |
|---|---|---|---|
| `scrum244-supresion-y-anonimizado` | 10 | 0 | **0** |
| `scrum295-modelo-303-postgres` | 1 | 0 | **0** |
| `scrum296-libro-postgres` | 1 | 0 | **0** |
| `scrum297-evidencias-postgres` | 2 | 0 | **0** |
| `scrum389-un-solo-iva` | 2 | 0 | **0** |

**`skip=0` en los cinco: el gate abrió y los 7 pasan.** No están rotos — es que no se ejecutan
nunca.

### Y el defecto, en dos líneas

| | tests | pass | **fail** | skipped |
|---|---|---|---|---|
| **sin banco** (lo que corre CI hoy) | 2613 | 2539 | **0** | **74** |
| **con banco** | 2613 | 2546 | **0** | **67** |

**Las dos dicen «0 fail».** Lo único que cambia es un número que nadie mira, y la diferencia son
exactamente los 7. Ésa es la frase entera del ticket.

*(Los otros 67 saltados lo están por otros gates y no son de este ticket. Se dicen para que el 74
no se lea como «74 tests de banco».)*

---

## Lo que entra: el suelo

`tests/scrum419-ci-declara-lo-que-no-corre.test.mjs` — **sin gate**, y es el punto: el guard que
vigila a los gateados no puede estar gateado él mismo.

1. **SUELO propio**: si el extractor ve **cero** gateados, falla declarándose ciego — sería cometer
   el defecto que persigue, dentro del propio guard. Exige además >100 ficheros mirados.
2. **El inventario, fichero por fichero** (1/1/1/2/2). Un gateado nuevo sin declarar pone esto
   rojo: un test que deja de ejecutarse en silencio es indistinguible de uno que no existe. Si uno
   deja de necesitar banco, **el número baja** — la única dirección que se mueve sola.
3. **Cada gateado dice POR QUÉ**: un `skip: true` a secas es un test apagado que en el log no se
   distingue de uno roto que alguien silenció.
4. **LA DECLARACIÓN**: cuando falta la variable, la ejecución imprime **qué 7 tests no ha corrido,
   con nombre y fichero**, y cómo correrlos. Es la línea que hoy no existe. Y el número declarado se
   comprueba contra el real: una declaración con la cifra equivocada es peor que ninguna, porque se
   lee como comprobada.
5. **Atado a la realidad de CI, no a una creencia**: si alguien define `LIBRO_PG_URL` en un
   workflow, el guard **se pone rojo** y obliga a actualizar la declaración — en vez de dejar un
   aviso que ya caducó. Mismo criterio que las cabeceras caducadas de esta semana.

### Los cuatro rojos

| # | inyección | resultado |
|---|---|---|
| 1 | aparece un gateado nuevo sin declarar | rojo por su motivo |
| 2 | un gateado se apaga con `skip: true`, sin motivo | rojo por su motivo |
| 3 | alguien monta el banco en CI → la declaración caduca | rojo por su motivo |
| 4 | el extractor se rompe y ve cero (suelo) | rojo por su motivo |

Cada inyección se verifica **aplicada** antes de creerse el rojo, y el arnés comprueba primero que
el guard pasa en el árbol limpio: si no, ningún rojo significaría nada.

---

## Lo que NO se ha tocado

El camino de emisión · `prisma/schema.prisma` · **el diff de SCRUM-413, que espera GO** · ningún
gate existente: los 7 siguen gateados exactamente igual, porque siguen necesitando banco.

## Lo que queda para el fundador

**Montar un Postgres en CI** (servicio en el workflow + `LIBRO_PG_URL`). Es coste recurrente y
regla 36. Medido: son 7 tests que **hoy pasan** y que cubren tenencia fiscal contra el motor real y
el cuadre de las tres pantallas al céntimo — lo que hoy no se comprueba en ningún merge. El día que
entre, este guard se pone rojo y pide bajar el inventario a 0, que es como tiene que enterarse.
