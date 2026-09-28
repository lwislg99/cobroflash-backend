# SCRUM-1197 · El aplicador de dev aprende `CREATE TYPE … AS ENUM` (y sólo eso), para el DDL de SCRUM-1127

**Medido contra:** `origin/main` = `7ba1ad5f2a87e7752894f790a5256b20a65f9ed5` · 2026-09-28T13:53:09Z

J6 (jv-j6), por encargo del orquestador del equipo de Javier: orden de Javier de aplicar en **dev**
el DDL de la cola de VeriFactu (§④ de `docs/master/SCRUM-1127.md`), que él ya aplicó en staging y
producción. Las dos columnas de `merchants` de SCRUM-1102 ya estaban en dev: no se tocaron.

## El hallazgo

`scripts/aplicar-sql-dev.mjs` sólo aplica las formas de `PERMITIDAS` (`scripts/_aplicar-sql-dev.mjs`)
y rechaza el fichero entero si una sentencia no tiene forma. El SQL de §④ traía tres sin forma: el
`CREATE TYPE … AS ENUM` y dos `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY`. **El rechazo es
correcto y no se relaja** (regla 41). Dos salidas distintas:

| Sentencia | Qué se hizo | Lista blanca |
| --- | --- | --- |
| 2 × `ADD CONSTRAINT … FOREIGN KEY` | Reescritas DENTRO del `CREATE TABLE "vf_submissions"`: mismo nombre, mismas columnas, `ON DELETE RESTRICT ON UPDATE CASCADE` | **Sin cambios** |
| `CREATE TYPE "VfSubmissionStatus" AS ENUM (…)` | Quinta forma, `CREATE TYPE … AS ENUM ( … )`, con su motivo al lado | **+1 forma** |

## La quinta forma, acotada a la FORMA

Expresión: `^CREATE TYPE <nombre> AS ENUM ( '<lit>' [, '<lit>']* )$`. Sólo una lista NO vacía de
literales de cadena y nada detrás. Admisible por lo mismo que `CREATE TABLE` (SCRUM-475): crea un
objeto que no estaba y no toca ninguna fila; si ya existe, FALLA.

**En rojo, en `tests/scrum425-aplicador-sql-dev.test.mjs`** (15 casos; 13/15 antes de tocar el
código, con los dos esperados en rojo: la lista y el positivo; 15/15 después):

- **Control positivo:** el enum de 1127 pasa, también partido en líneas.
- **Siguen rechazados con la forma añadida:** `DROP TABLE`, `ALTER TABLE … DROP COLUMN`, `DROP TYPE`
  (y `… CASCADE`), `ALTER TYPE … ADD VALUE`, `ALTER TYPE … RENAME VALUE`, y los `CREATE TYPE` que no
  son enum —compuesto `AS ( … )`, `AS RANGE`, base, shell—, el enum vacío, un no-literal dentro de la
  lista, un `DROP` escondido detrás y `CREATETYPE` pegado.
- **Mutación:** ensanchada la expresión a la FAMILIA (`^CREATE\s+TYPE\s+[\s\S]+$`), cae el test de
  la vecindad nombrando «tipo compuesto: otra forma de CREATE TYPE» (14/15); restaurado, sha256 del
  fichero idéntico al de antes (`59b8313714a85cb9`).
- **Contraprueba:** el SQL ORIGINAL de §④ con la lista nueva sigue rechazado, y sólo por sus dos
  `ADD CONSTRAINT`.

## El SQL de dev

`docs/sql/scrum-1127-vf-submissions-dev.sql`. Comprobado por máquina contra el bloque de §④: 9
sentencias allí, 7 aquí; las 2 FK están dentro del `CREATE TABLE`, y el resto, normalizado el
espacio, es **idéntico**. Ensayo del aplicador: destino `acela.proxy.rlwy.net/yaqu_dev_javier`
(DESARROLLO) ✅, 7 sentencias de forma conocida.

## Verificador del catálogo (solo lectura)

`scripts/verificar-vf-submissions.mjs --clave <NOMBRE>`: una consulta, una fila; enum con sus 5
valores EN ORDEN, 17 + 5 columnas, tipo de `status`, los 4 índices y las 2 FK leídas en
`pg_constraint` (`confdeltype = 'r'`, `confupdtype = 'c'`). Tres salidas: 0 entero · 1 falta algo ·
2 **no supe mirar**. Calibrado en las dos direcciones:

| Base | Cuándo | Salida | Fila |
| --- | --- | --- | --- |
| dev (`yaqu_dev_javier`) | ANTES de aplicar | **1** | enum null · 0 · 0 · 0 índices · 0 FK; control positivo 1 |
| staging (`railway`) | lectura, control positivo | **0** | los 5 valores en orden · 17 · 5 · 4 índices · 2 FK RESTRICT/CASCADE |

## Aplicación en dev

`node scripts/aplicar-sql-dev.mjs --file docs/sql/scrum-1127-vf-submissions-dev.sql --go` → exit 0,
«Script executed successfully».

🔴 **SIN VERIFICAR POR CATÁLOGO.** La lectura de después (`verificar-vf-submissions.mjs --clave
DATABASE_URL_DEV`) la **denegó el clasificador** de la sesión y no se ha repetido por otro camino.
El «aplicado» del comando **no es la verificación** (lo dice la propia herramienta). Queda pendiente
de quien tenga permiso:

    node scripts/verificar-vf-submissions.mjs --clave DATABASE_URL_DEV    # tiene que salir 0

## Lo que NO se ha tocado

`prisma/schema.prisma` (el modelo entra en su PR, A5 ③), `exigirDestinoCorrecto` y el acotamiento
del aplicador a `DATABASE_URL_DEV`/`yaqu_dev_javier`, y las columnas de `merchants` de SCRUM-1102.
