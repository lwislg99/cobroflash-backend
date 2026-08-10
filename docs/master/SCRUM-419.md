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

---
---

# SCRUM-419 · segunda entrega · Postgres EN CI, con GO del fundador

**Medido contra:** `origin/main` = `7f826e61f5ce1a82d5def188451ef16125f7e704` · 2026-08-10T18:48:34+02:00

## 🔴 Mi encuadre estaba mal, y el fundador lo corrigió

Escribí que montar Postgres en CI era **coste recurrente y regla 36**. No lo es: un
`services: postgres` en GitHub Actions es **un contenedor que levanta el propio runner** — sin
suscripción, sin proveedor nuevo, sin factura. Nace y muere con el job.

Con eso, el ticket que yo mandaba a la cola **entra aquí**.

## Lo que entra en `ci.yml`

Un servicio `postgres:16-alpine` con health-check, un paso que carga el esquema en una base
desechable, y `LIBRO_PG_URL` en el paso de tests.

**Y no contradice el aviso que ya tenía el fichero**, que excluye `QA_DB_TEST` /
`DATABASE_URL_TESTS`. Sus tres motivos son ciertos y siguen en pie —secretos que no viajan
(regla 9), varios PR escribiendo a la vez en la misma base de staging, y que los guards
estructurales no la necesitan— **y ninguno le aplica a `LIBRO_PG_URL`**: no es un secreto, no es
compartida y no es de nadie. Queda escrito ahí para que nadie lo lea como una contradicción.

El esquema se carga con `migrate diff --from-empty` + `psql`, **no con `db push`**: ese mecanismo
está reservado a las bases del proyecto (regla 3). Y el paso **falla si el DDL sale vacío**, en vez
de aplicar nada a ciegas — la lección de SCRUM-385.

⚠️ El nombre de la base termina en `_test` porque **los propios tests lo exigen** antes de tocarla,
junto con que el host sea loopback y que no sea ninguna base del proyecto. **Ese guard suyo no se
afloja: se le da lo que pide.**

## El guard se ACTUALIZA, no se afloja — y es su mejor prueba

Al añadir la variable al workflow, mi propio guard **se puso rojo**. Estaba bien construido: pedía
que la declaración correspondiera con lo que CI hace **hoy**. La respuesta correcta era actualizar
la declaración.

**Antes** exigía que ningún workflow definiera la variable. **Ahora exige lo contrario: que SÍ la
defina** — porque si alguien quita el servicio, los 7 vuelven a saltarse en silencio y la suite
seguiría diciendo «0 fallos». Se añade además que el workflow **levante el servicio**: definir la
variable apuntando a un Postgres que nadie arranca haría fallar los 7 por conexión, y ese rojo se
lee como «los tests están rotos» en vez de «falta la base».

Y **el aviso de declaración se queda**: en un portátil sin banco sigue imprimiendo qué 7 no se han
corrido. Eso no sobra — es lo que hace que un desarrollador no confunda su verde local con el de CI.

### 🔴 El rojo que NO salió, y por qué importa

Al probar «CI deja de definir la variable», el guard **siguió verde**. Casaba con
`contenido.includes('LIBRO_PG_URL')` — y la variable aparece **en el comentario que yo mismo
escribí explicando por qué entra**. Un guard de texto se caza a sí mismo en el comentario que lo
explica: **quinta vez en esta sesión**.

Arreglado mirando la **asignación** y no la mención: se quitan las líneas de comentario YAML y se
exige la forma `LIBRO_PG_URL: <algo>`. Con hermano positivo y **control negativo** — el detector
reconoce la asignación y **no** cuenta un comentario. Ahora el rojo sale.

## Evidencia

| | tests | pass | fail | skip |
|---|---|---|---|---|
| **sin banco** (portátil) | 2637 | 2563 | **0** | 74 |

`guards:entrada` 0 · `guard:contraste` 0 · `guard:prisma` 0.

### ⚠️ Lo que NO he podido re-verificar, dicho

**La pasada CON banco de esta segunda entrega no está hecha.** El Postgres portable que usé para el
recuento fase por fase pertenece a **otra sesión**, y a mitad de este turno dejó de responder: su
instalación está **incompleta** (`share/postgres.bki` no existe), así que ni arranca ni se puede
clonar con `initdb`. No toco el directorio de otra sesión.

Lo medido con banco **sigue siendo válido y está arriba** (recuento fase por fase, los 7 pasando,
`skip=0`), pero es de **antes** en este mismo turno. Una ejecución posterior dio «7 fail» y **no
cuenta**: el error era `Can't reach database server`, no una aserción — es el aviso de entorno de
esta mañana repetido, y por eso se descarta en vez de reportarse.

**Y el workflow en sí solo lo puede verificar CI.** No se puede ejecutar GitHub Actions en local:
el primer PR que lo corra ES la verificación. Si el paso del banco falla, fallará **con nombre
propio** («Banco desechable para los tests de libro»), que es justo para que no se lea como un test
roto.
