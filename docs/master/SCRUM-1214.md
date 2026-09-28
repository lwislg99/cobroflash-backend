# SCRUM-1214 · El consejero de producción deja de dar un informe FALSO y se aprieta en 8 formas; las 4 diferencias que quedan con la lista de dev son decisiones, no accidentes

**Medido contra:** `origin/main` = `f9dc44a3f9267cd5624a4902ba3fc1fd93b108d9` · 2026-09-28T14:41:42Z

J6 (jv-j6). GO de Javier para apretar («Sí aprieta»), transmitido por el orquestador del equipo de
Javier, que decidió también el alcance (8 formas, no 10). Toca **sólo** `scripts/_clasificador-sql.mjs`
y añade `tests/scrum1214-clasificador-apretado.test.mjs`. **No se unifica con `_aplicar-sql-dev.mjs`**
y **no se toca la lista de dev.**

## Qué es este fichero y por qué importa

`_clasificador-sql.mjs` es el **consejero** del SQL que se pega a mano en staging y producción.
Desde SCRUM-685, `db push` no es el método de la casa: la persona aplica y el clasificador
aconseja. Lo usan `db-push-prod`, `preflight-migracion.mjs` y `_guard-arbol-y-borrado.mjs`. El
28-sep se midió que admitía 10 formas que el guarda de dev rechaza, y que a cuatro de ellas les
ponía una **etiqueta falsa**.

## ① Primero, el informe FALSO

Antes, cualquier acción de un `ALTER TABLE` que empezara por `ADD` salía como **«ADD COLUMN ×1 —
solo añade columnas (nullable o con DEFAULT)»**. A una persona a punto de pegar en producción una
clave ajena, un `CHECK`, un `UNIQUE` o una `PRIMARY KEY`, el informe le decía que iba a añadir una
columna. **Eso no era permisividad: era un informe falso.**

Ahora se nombran por lo que son (`ADD CONSTRAINT (FOREIGN KEY)`, `(CHECK)`, `(UNIQUE)`, `(PRIMARY
KEY)`, `(EXCLUDE)`) y se rechazan: validan la tabla entera y toman bloqueos. La clave ajena de una
tabla **nueva** va dentro de su `CREATE TABLE`, que sigue permitido. Así la aplicó SCRUM-1127, y lo
comprueba el test.

## ② Las 8 que se aprietan

`ADD CONSTRAINT … FOREIGN KEY` · `… CHECK` · `… UNIQUE` · `ADD PRIMARY KEY` · `CREATE TABLE … AS
SELECT` · `CREATE TYPE` compuesto `AS ( … )` · `CREATE TYPE … AS RANGE` · `CREATE TYPE` shell (y el
base, que ejecuta funciones de E/S). **Se admite la forma, no la familia:** `CREATE TABLE` sólo con
definición de columnas, y `CREATE TYPE` sólo `AS ENUM ( '…', … )`.

## 🔴 El objetivo no era que las dos listas fueran iguales: era que ninguna diferencia fuera un accidente

Quedan **cuatro diferencias vivas**, y las cuatro tienen detrás una decisión y su ticket. Eso es
mejor que dos listas idénticas: dos listas iguales por casualidad vuelven a separarse en un mes.

| diferencia | la admite | la decidió | por qué |
|---|---|---|---|
| `ALTER TABLE … ALTER COLUMN … DROP DEFAULT` | sólo **dev** | SCRUM-797 | medida en `yaqu_dev_javier` dentro de una transacción revertida: cambia el catálogo, no las filas |
| `ALTER TABLE … ADD COLUMN … NOT NULL` sin `DEFAULT` | sólo **dev** | SCRUM-395 (la rechaza producción) | en una tabla con filas falla en seco; producción la rechaza para no aconsejar algo que va a fallar |
| `ALTER TYPE … ADD VALUE` | sólo **producción** | SCRUM-395 (`scrum395-preflight-migracion.test.mjs:93`) | añadir un valor a un enum es aditivo y no es un `ALTER COLUMN … TYPE` |
| `COMMENT ON` | sólo **producción** | SCRUM-395 (fixture de `:55`) | sólo documenta, y es la sentencia con la que 395 prueba que un «DROP» dentro de un literal no dispara nada |

Las dos últimas estaban en la lista de «las 10» del primer encargo. El orquestador las retiró al
ver que eran decisiones de 395. Revertirlas habría obligado a tocar el test de otro guard.

## Rojo, verde y lo que no se mueve

- **ROJO**, con el clasificador sin tocar: el test nuevo da 3 de 5 en rojo. Son los tres de lo
  que se aprieta; los dos de control ya pasaban.
- **VERDE:** `scrum1214` 6/6. Con él, los 11 ficheros de test que usan el clasificador o a quien
  lo usa (`scrum395`, `scrum685`, `scrum685b`…) suman **97/97**.
- **La línea base no se mueve.** Hay 21 sentencias fijadas literalmente con el veredicto y la
  etiqueta que tenían en `f9dc44a3`, y ninguna cambia: las 9 destructivas, las 4 aditivas, las
  decisiones de 395 y las 2 de dev. Si alguna cambiara, el test cae con «se apretó de más».
- **Sobre las 32 sentencias medidas el 28-sep cambian exactamente las 8**, y ninguna más.
- **Sobre el SQL real:** 116 versiones históricas de `docs/sql/*.sql` más los 57 ficheros de
  HEAD, 415 sentencias. **Cambian 2:** las dos versiones de la clave ajena de SCRUM-576 que el
  fundador retiró el 8-sep sin aplicarla. **Ningún fichero de HEAD cambia de veredicto.**
- **Mutaciones**, con el sha256 del clasificador restaurado igual al de antes (`45eee183`):
  - quitar el reconocimiento de restricciones → caen ①, ①② y el de la llamada «a pelo»;
  - volver a admitir cualquier `CREATE TYPE` → caen ② y el de «a pelo».
- **Un fallo mío que cazó un test ajeno:** la primera versión sólo entendía la sentencia
  «desnuda» (sin comillas ni literales). `clasificarSentencia` es pública y `scrum395` la llama con
  el SQL crudo. Ahora entiende las dos, y hay un test para cada una.

## ⚠️ Límite declarado: el enum vacío

El clasificador trabaja sobre texto **desnudo**, donde los literales son espacios, así que **no
distingue `AS ENUM ()` de `AS ENUM ('a')`** y el vacío pasa (el guarda de dev lo rechaza).

- **Por qué es tolerable:** un enum vacío no toca ningún dato ni ningún objeto que ya exista.
- **Quién lo retira:** el carril J6, si algún día deja de ser inofensivo, dándole a
  `clasificarSentencia` también el texto con literales.

## ¿Etiqueta bien las demás? (pregunta del orquestador)

**Medido sobre las 32:**
- Después del cambio, **todas las permitidas llevan una etiqueta correcta**.
- Quedan **tres rechazos con un motivo impreciso**. Se registran y **no se tocan**: rechazan, que
  es el lado seguro, y no son el objeto de este ticket.
  - `ALTER COLUMN … DROP DEFAULT` y `ALTER COLUMN … DROP NOT NULL` salen como «contiene DROP:
    destruye datos», y **ninguna de las dos destruye datos** (797 lo midió para `DROP DEFAULT`).
  - `UPDATE` sale como «DESCONOCIDA»: vago, pero no falso.

**Antes del cambio eran cuatro etiquetas falsas sobre sentencias PERMITIDAS, no una:** FK, CHECK,
UNIQUE y PK.

## 🔴 CI en rojo tras el push: SCRUM-237 sin respaldo (arreglado en la misma rama)

El check obligatorio `build + tests (con banco desechable)` cayó porque `SCRUM-976` ejecuta
`tests/scrum237-negacion-respaldada.test.mjs` como parte de `guards:entrada`. Ese guard vigila que
ninguna negación de la suite se quede sin respaldo (nació del bug de scrum73: un `doesNotMatch`
sobre un token imposible, verde permanente). El `assert.doesNotMatch(String(c.motivo), /solo añade
columnas/, …)` de `scrum1214-clasificador-apretado.test.mjs:38` usa un texto que el clasificador SÍ
emite de verdad (`_clasificador-sql.mjs:189`, para un `ADD COLUMN` legítimo) pero, sin ningún
`assert.match` en el fichero que use el mismo token sobre un caso positivo, el analizador no podía
distinguirlo de la clase de bug que persigue y lo clasificaba `NINGUNO`.

No es un guard caprichoso (regla 41): se arregló el test, añadiéndole el «hermano del token» — un
`assert.match` sobre un `ADD COLUMN` legítimo con el mismo patrón `/solo añade columnas/`, antes del
bucle de restricciones. El guard no se tocó.
