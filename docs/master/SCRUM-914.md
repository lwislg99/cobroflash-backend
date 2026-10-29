# SCRUM-914 · Equipos del cliente: diseño y `.sql` del ALTER (paso ② de A5)

**Medido contra:** `origin/main` = `37bda5dbc6991cc33a54ee7248020be30d2f977f` · 2026-09-27T15:49:35Z

**Escribe:** Sesión 1 (S1, `s1-27a`) · **Rama:** `scrum-914-equipos-alter` · **Carril:** S1 (diseño y
servidor) + S4 (pantallas del Trabajo y del parte) · bloque CRM (SCRUM-978).

## Alcance de esta rama: SÓLO el ②

Esta rama entrega el diseño y `docs/sql/scrum-914-equipos-del-cliente.sql`. **No toca
`prisma/schema.prisma`** (regla 40) ni código, y **no aplica nada a ninguna base**. El ③ (esquema +
servidor + tests en un solo PR) empieza cuando el equipo de Javier confirme el ALTER en las tres
bases.

## PASO 0 — medido en origin/main

| dato | medida |
|---|---|
| Modelos de equipo | 0 (`model Equipment\|Asset\|Device`, `equipmentId`): el mismo `grep` sí encuentra los 30+ modelos del esquema |
| `MaintenancePlan` | cuelga de `customerId`; el equipo es texto libre en `title` |
| `CustomerSite` (SCRUM-1014) | tabla en producción con 4 rutas CRUD (`/admin/customers/:id/sites`). **Ninguna pantalla la usa**: 0 referencias en `public/` (el mismo barrido sí encuentra texto en `public/`, así que no está ciego). Hoy ningún profesional puede dar de alta un sitio |
| Qué apunta a un sitio | nada: ni `Job`, ni `Quote`, ni `Albaran`, ni `ParteTrabajo`, ni `MaintenancePlan` |
| Convención de referencias opcionales | **sin clave ajena** (`schema.prisma`, `Customer.companyId`: decisión del fundador del 8-sep-2026, SCRUM-192/195/576: «servicio de borrado, no cascadas») |

## La decisión: de qué cuelga el equipo

Propuesta de la S1 con tres opciones; **el orquestador eligió C el 27-sep-2026**:

- A · sólo del cliente: el día que haya pantalla de sitios haría falta un 2.º ALTER (y hoy un ALTER
  cuesta días de espera).
- B · sólo del sitio: 914 quedaría bloqueado por la pantalla de sitios (SCRUM-1144/1145, sin
  construir).
- **C · del cliente (`customer_id` NOT NULL) y, opcionalmente, de un sitio (`customer_site_id`).**

## Una corrección al acuerdo, medida en el árbol

El acuerdo con el orquestador decía «`equipment_id` opcional con ON DELETE SET NULL». Al escribir
el candidato apareció en `schema.prisma` la decisión del fundador del 8-sep: las referencias
opcionales van **sin clave ajena** y el borrado lo hace el código. Gana el árbol: `customer_site_id`
y los cuatro `equipment_id` van sin FK, y el `.sql` deja escritas las obligaciones del ③ (poner a
NULL al borrar, comprobar mismo cliente y mismo merchant al asignar, añadir `equipment` a
`borradoMerchant.ts`/`anonimizarMerchant.ts`). Las dos claves NOT NULL (`merchant_id`,
`customer_id`) sí llevan FK con RESTRICT, igual que `customer_sites`.

## El DDL

Derivado offline con `previewMigracion({ schema: <candidato del scratchpad>, desde:
prisma/schema.prisma })` (control positivo: ok, 32 tablas). Clase: `con_cambios`, y **todo
aditivo**: 1 `CREATE TABLE`, 4 `ADD COLUMN` nullables sin `DEFAULT`, 7 `CREATE INDEX`, 2 FK sobre la
tabla nueva. Ni un `DROP`, ni un `ALTER COLUMN`, ni una fila reescrita.

Tabla `equipments`: `type` y `name` obligatorios (Housecall pide sólo esos dos; S0, com. 16151);
`brand`, `model_name`, `serial_number`, `installed_on`, `warranty_until` opcionales (en un oficio los
datos llegan cuando se saben; ServiceM8 los obliga y su manual avisa del problema). Las fechas en
`DATE` y no en `TIMESTAMP`: son días del calendario (la familia de SCRUM-1093).

`equipment_id` opcional en `jobs`, `maintenance_plans`, `albaranes` y `partes_trabajo`. En el
albarán y el parte **no entra en el contenido sellado** (`evidenciaFirma`, `contenido_hash`).

## Criterios de ACEPTACIÓN del ③ (sin FK, el borrado es del código)

Sin clave ajena en las referencias opcionales, lo que haría la FK es responsabilidad del código.
Si se olvida, borrar un comerciante deja equipos con datos de sus clientes dentro (terreno de
SCRUM-244). El ③ no se cierra sin:

1. Al borrar un **sitio**, sus equipos quedan con `customer_site_id` a NULL, en la misma
   transacción (test).
2. Al asignar un sitio a un equipo, el servidor comprueba que el sitio es **del mismo cliente Y del
   mismo merchant** (regla 2); si no, lo rechaza (test con un sitio de otro merchant).
3. **`equipment` entra en `borradoMerchant.ts` y en `anonimizarMerchant.ts`**, con su test.
4. Al borrar un **equipo**, `equipment_id` queda a NULL en `jobs`, `maintenance_plans`,
   `albaranes` y `partes_trabajo` de ese merchant, en la misma transacción (test).
5. Al ligar un documento a un equipo, el servidor comprueba que el equipo es del mismo merchant y
   del mismo cliente que el documento (test).
6. `equipment_id` **no entra** en el contenido canónico sellado del albarán ni del parte (el test de
   sellado existente sigue en verde sin tocarlo).

## Qué desbloquea

SCRUM-1019 (espera a 914). El ③ de 914 y las pantallas de S4 esperan al ALTER aplicado.

---

## J3 (equipo de Javier) · criterio 3 del ③: `equipment` en el borrado y en el anonimizado

**Medido contra:** `origin/main` = `dc1b2b4db78e75b1af0fcbc495912b29395938af` · 2026-10-20T09:12:21Z (sesión J3 `jv-j3a`; trabajo cruzado decidido por el fundador, SCRUM-914 c.19414 / c.20087)

A9: comprobación → `tests/scrum497-dato-personal-no-sobrevive.test.mjs`

(Por qué esa ruta: `serialNumber` no estaba en el vocabulario de `tests/_censo-datos-personales.mjs`, así
que `equipment.serialNumber` habría nacido invisible para el censo de scrum497 — igual que hoy lo es
`customerSite.contactName`. Ahora está, y el control de abajo, ⓪, lo vio cazar los dos campos.)

Lo tocado: `src/modules/system/domain/borradoMerchant.ts`, `src/modules/system/domain/anonimizarMerchant.ts`
y sus tests (`tests/scrum914-equipos-borrado-y-anonimizado.test.mjs`, nuevo; los dobles de `scrum244` y
`scrum440`; el vocabulario de `_censo-datos-personales.mjs` y su mensaje en `scrum497`; los inventarios
de `scrum411` y `scrum419`, que cuentan el fichero nuevo). Ni
`prisma/schema.prisma`, ni el dominio de equipos, ni rutas, ni ninguna base.

### ⓪ ¿Puede ir este commit ANTES que el esquema? — NO. Medido.

Con sólo `'equipment'` en `ORDEN_BORRADO_MERCHANT` y el schema de `origin/main` (sin `model Equipment`),
`tests/scrum192-borrado-merchant.test.mjs` cae en «el orden no inventa modelos que el schema no tiene»:
`🔴 el orden nombra modelos que ya no tienen merchantId (equipment)`. 13 de 14 en verde, 1 rojo. Lo
mismo `scrum314` («hay recorridos que no acabaron en un borrado», 27 ≠ 28: su espía se construye desde
el schema). → **Este commit va DESPUÉS del de S1**, en su rama.

Al revés, medido en una COPIA del árbol (fuera del repo) con el candidato `model Equipment` del `.sql`
(líneas 61-84) escrito en su schema (`prisma validate`: válido): con este commit encima, **80 tests,
73 verdes, 3 saltos (LIBRO_PG_URL), 4 rojos — los cuatro el MISMO, `SCRUM-172: todo modelo con
merchantId está en MODELOS_POR_MERCHANT`** (`tests/_merchant-fixture.mjs`, la lista del fixture de
tests). Ese rojo lo pone el schema de S1 por sí solo, con o sin esta mitad: **el commit de S1 tiene
que añadir `'equipment'` al fixture** (antes de `customer`, que el `merchant.delete` del fixture
choca con la FK RESTRICT).

Control en esa misma copia: con el `anonimizarMerchant` de `origin/main` en vez del de esta rama,
`scrum497` cae en «ninguna columna personal del esquema queda SIN CLASIFICAR» nombrando
`equipment.name` y `equipment.serialNumber`. El segundo sólo lo ve porque esta rama lo añade al vocabulario.

### 🔴 EL PR DE ESTA RAMA SALE ROJO, Y ES LO ESPERADO — no quites `'equipment'` del orden

Por decisión del fundador (20-oct, transmitida por el orquestador: «Venga pues dale para que commitee»),
esta rama se empuja SOLA, sin esperar a la de S1. Su obligatorio va a caer en:
- `tests/scrum192-borrado-merchant.test.mjs:54` · «SCRUM-192 · el orden no inventa modelos que el schema no tiene»;
- `tests/scrum314-wipedemo-derivado.test.mjs:130` · «SCRUM-314 · CONTROL: ningún borrado sale sin filtro del demo» (27 ≠ 28).

**Por qué cae:** los dos esperan el `model Equipment` de `prisma/schema.prisma`, que es de S1 (regla 40)
y no está en `main`. No es un defecto de este commit.

**Qué lo pone en verde:** que entre en `main` el esquema de S1 **con** su línea en
`tests/_merchant-fixture.mjs` (`'equipment'` antes de `'customer'` en `MODELOS_POR_MERCHANT`;
sin ella cae SCRUM-172, medido en ⓪). Con eso, este PR pasa a verde sin tocar nada.

**Lo demás, verde:** `guards:entrada` (15 guards, 170 tests), los 5 de árbol entero (38/38) y los
ficheros afectados (100 tests, 0 rojos, 3 saltos de `LIBRO_PG_URL`). Los diez ficheros del commit
están declarados uno a uno en SCRUM-914 c.20091.

⛔ Quitar `'equipment'` del orden para ponerlo verde es arreglar el guard en vez del código (regla 41).
Lo que falta es el código de otro equipo.

### ① DÓNDE va `equipment` en el orden — derivado de a quién apunta

Del `.sql`: `equipments` → `merchants` y `customers` con FK RESTRICT; → `customer_sites` SIN FK.
Y le apuntan SIN FK `jobs`, `maintenance_plans`, `albaranes` y `partes_trabajo` por `equipment_id`.

- Los cuatro documentos son sus HIJOS (sin red): van **antes** que el equipo. Si el equipo cayera antes
  y el bucle se cortara a mitad, quedarían documentos apuntando a un equipo inexistente sin que nada
  proteste — el mismo motivo de `emailMessage` y `parteTrabajo` en el propio fichero.
- `customerSite` es su PADRE (sin red): va **después** del equipo.
- `customer` es padre de los dos con FK RESTRICT: va después de ambos.

Queda `…, 'teamMember', 'equipment', 'customerSite', 'customer'`. **Eso obliga a sacar `customerSite`
del primer bloque**, donde lo puso SCRUM-1014. Se puede porque **a `customer_sites` no le apunta
nadie más** (medido en el schema: sólo `CustomerSite[]` en Merchant y en Customer). La propuesta de S1
(«antes de `customer` y de `customerSite`», sin mover nada) ponía el equipo en el primer bloque,
**antes** que los cuatro documentos que le apuntan: no la tomo, por esa razón.

`FUERA_DEL_BARRIDO_GENERICO` no aplica: `equipment` tiene `merchantId` NOT NULL, se borra por merchant
como cualquier otro, y `barridoDemo` lo recorre sin paso propio.

### ② QUÉ campos son dato personal — `name` y `serialNumber`

- `serialNumber`: **identifica un aparato concreto en casa de una persona**, y el registro de
  garantía del fabricante lo cruza con su dueño y su domicilio. Identificador indirecto aunque el
  cliente ya no tenga nombre. Es la razón fuerte, más que el texto libre.
- `name`: texto libre que el profesional escribe sobre lo de OTRA persona («Caldera de la Sra. Pérez»).
  No es `product.name` ni `quoteTemplate.name`, que nombran su propio catálogo.
- FUERA: `type`, `brand`, `modelName` (catálogo) y `installedOn`, `warrantyUntil` (sin nº de serie
  ni cliente con nombre no señalan a nadie).

⚠️ Coincide con S1, pero choca con un precedente de la casa: `customerSite.name` («Piso 3ºB») se
declaró FUERA en scrum497 como «etiqueta del sitio». Con mi criterio esa etiqueta también es texto
sobre lo de un tercero (y «Piso 3ºB» es media dirección). No la toco aquí: va a quien reparte.

### Los dos rojos, con el código real contra Postgres

Banco desechable PGlite en memoria (fuera del repo), DDL de `prisma migrate diff --from-empty` sobre
el schema de `origin/main` (33 tablas = 33 modelos) + `docs/sql/scrum-914-equipos-del-cliente.sql`
**aplicado tal cual**. Control: `pg_constraint` de `equipments` da `customer_id_fkey=r`,
`merchant_id_fkey=r`. Siembra: comercio, cliente, sitio, equipo en ese sitio, trabajo ligado al equipo.
Se pasa por `borrarMerchant` y `suprimirMerchant` del `dist` de `origin/main` y del de esta rama; el
cliente de Prisma, por un traductor mínimo a SQL (quien decide las FK es el motor).

| | `dist` de `origin/main` | `dist` de esta rama |
|---|---|---|
| ① borrado | `ok=false`, 2 errores: `customer` («violates foreign key constraint "equipments_customer_id_fkey"») y `merchant` («…"customers_merchant_id_fkey"»). Quedan merchant 1, cliente 1, **equipo 1, sitio 0** (el equipo se queda apuntando a un sitio borrado) | `ok=true`, 0 errores, no queda ninguna fila |
| ② anonimizado | `ok=true` y el equipo **intacto**: `name`=«Caldera de la Sra. Pérez», `serial_number`=«SN-914-QA» | `name` y `serial_number` = `[borrado a petición del interesado]`; `type`, `brand`, `model_name`, las dos fechas y `customer_site_id` **sin tocar** |

El ② en `main` es el «creerías haber cumplido»: la supresión dice `ok=true`.

El test de la casa (`scrum914-…`) repite los dos con `LIBRO_PG_URL` en CI. **NO lo he podido correr
con Prisma**: en esta máquina no hay Postgres y el cliente generado no tiene `Equipment` hasta el
commit de S1. Su lógica es la del arnés de arriba, pero su primer verde será el de CI en la rama de S1.

### La tanda, y lo que cazó de MÍO

Tanda entera sobre esta rama (`node --test 'tests/*.test.mjs'`, TAP a fichero): **11.975 tests, 11.788
verdes, 158 saltos, 29 rojos.** Separados contra un árbol limpio de `origin/main` `dc1b2b4db` con los
mismos 17 ficheros que fallaron (mismos `node_modules`): `main` da 22 rojos ahí, y esta rama los
**mismos 22 más dos**, scrum192 y scrum314, los de ⓪, que esperan el schema de S1. Los otros 5 los
puso MI test nuevo, y los guards tenían razón: lo arreglé a él, no a ellos.
- scrum113: creaba el comercio a mano → ahora va por `withMerchant`.
- scrum262: sembraba teléfonos `+34 6XX`, que pueden ser de alguien → ahora sin teléfonos.
- scrum411 y scrum419 (2): son inventarios declarados de quién llama a `borrarMerchant` (13 → 14) y
  de qué no corre sin banco (+2). Se actualizan con el fichero nuevo, como manda su propio texto.
Los 22 de base (deriva de `node_modules` y del cliente de Prisma heredados del checkout compartido,
CLI local, latido…) son de la máquina, no de esta rama: no los toco.

`guards:entrada`: verde (15 guards, 170 tests). Los 5 de árbol entero que pide su salida: 38/38.

### Encontrado de paso, no arreglado aquí (va a quien reparte)

- `customerSite.contactName` (el nombre del contacto en obra, una persona) **no se anonimiza** y el
  censo no lo ve: `contactName` no está en su vocabulario. El comentario de `CAMPOS_PERSONALES` dice
  que «su único rastro es este teléfono», y el schema tiene también su nombre.
- Mis propios tropiezos: el primer intento de editar `scrum497` lo pasé por `node -e` desde bash con
  backticks dentro (lo que mi memoria dice que no se hace). Lo paró la comprobación de ancla del propio
  script, que salió en error sin escribir; lo rehíce con Edit. Y el arnés falló dos veces por montaje
  (ruta con espacio codificada, `public/` sin copiar) antes de medir: ninguno llegó a un resultado.

---

## 29-oct-2026 · S1 · el ③: `model Equipment` y los cuatro `equipmentId` en el esquema

**Medido contra:** `origin/main` = `8dcf269130bab35d42a9fa4ba3d026d0efb98152` · 2026-10-29T18:52:15Z

A9: comprobación → `tests/scrum192-borrado-merchant.test.mjs`

Decisión del orquestador (por delegación del fundador, SCRUM-914 c.21269): el ③ ENTERO, encima de la rama de
J3 (#2621). Regla 40 cubierta: el ALTER ya está aplicado, 17 de 17 columnas en las tres bases (c.20085,
medido el 20-oct). Esto es el paso ③ de la regla 3, aditivo. Rama `scrum-914c-esquema-de-equipos`: los dos
commits de J3 + `origin/main` + lo de abajo.

### Qué cambia

- `prisma/schema.prisma`: `model Equipment` (`equipments`) tal cual el candidato de
  `docs/sql/scrum-914-equipos-del-cliente.sql`; `Equipment[]` en `Merchant` y `equipments` en `Customer`;
  `equipmentId Int? @map("equipment_id")` + `@@index([equipmentId])` en `Job`, `MaintenancePlan`, `Albaran` y
  `ParteTrabajo`. Sin FK en las referencias opcionales (decisión del 8-sep). `prisma validate`: válido.
- `tests/_merchant-fixture.mjs`: `'equipment'` antes de `'customer'` en `MODELOS_POR_MERCHANT` (lo midió J3 en ⓪).
- Consecuencias del modelo nuevo, cada una con su guard:
  - `scripts/backup-dump.mjs`: `'equipments'` en `TABLES` (`scrum241`: «FALTAN … equipments»).
  - `tests/scrum497-…`: `equipment.modelName` a `FUERA_DE_ANONIMIZADO`, con motivo. Lo hace visible el censo
    por núcleo («…Name») de SCRUM-1569, que entró en `main` DESPUÉS de la medida de J3. La clasificación es la
    de J3 en el §② de arriba («`modelName` (catálogo)»), no mía. Si quien reparte la quiere en `SIN_DECIDIR`,
    se mueve.
  - `docs/legal/AUDITORIA_CAMINO_EMISION.md:36` y `:40`: dos coordenadas de `schema.prisma` llevadas a donde
    están hoy (`scrum525d` ①, mecánico). La afirmación no cambia.
- Conflicto de #2621 con `main`, una línea de `tests/_censo-datos-personales.mjs`: se quedan las tres,
  `'serialNumber'` y `'mobile', 'clabe'`.
- `equipmentId` no entra en el canónico sellado del albarán ni del parte: no se ha tocado ningún canónico.

### Tests (local, sin regenerar el cliente)

⚠️ No he regenerado el cliente de Prisma: el `node_modules` de este árbol es el compartido (junction), y
regenerarlo cambia el de todos (`docs/equipo/trampas-del-entorno.md` §10: lo coordina el orquestador).
No he leído ninguna base.

- 31 ficheros (192, 314, 914, 244, 497, 440, 411, 419, 241 y los que nombran `MODELOS_POR_MERCHANT` o
  `backup-dump`): 243 tests, 237 pass, 5 SKIP (base), **1 fail**: `scrum244` «la lista sale del SCHEMA …:
  producción y guard coinciden», que compara con el DMMF del cliente GENERADO (el compartido, sin
  `Equipment`). Lo pone verde el cliente que genera el CI desde este schema.
- `scrum192` y `scrum314`, los dos rojos de #2621 que leen el schema, en verde.
- `scrum914` ×2 (Postgres) y `scrum244` contra Postgres: SKIP en local, sin `LIBRO_PG_URL`.
- `guards:entrada`: 170/170. `scrum525d`: 8/8.

**La verificación de punta a punta es la del CI** («build + tests (con banco desechable)»): si los cinco
rojos de #2621 (scrum192, 314, 914×2, 244) no salen verdes ahí, la medida del 20-oct ya no describe las bases.