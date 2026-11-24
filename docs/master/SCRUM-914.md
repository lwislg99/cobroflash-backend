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

## SCRUM-914d · J3 · el ③: `model Equipment` en el esquema, y los equipos en el borrado y el anonimizado

**Medido contra:** `origin/main` = `97e196f930334971538b5c0ba13e0224cbe7d184` · 2026-11-23T21:16:58Z

**Escribe:** J3 (`jv-j3cr`) · **Rama:** `scrum-914d-equipos-en-borrado-y-anonimizado` · **Carril:** J3
(`borradoMerchant.ts`, `anonimizarMerchant.ts`); sin cerradura: `prisma/schema.prisma` (sólo el modelo y
sus relaciones, regla 40, con el ALTER aplicado: c.22434), `tests/_censo-datos-personales.mjs`,
`tests/_merchant-fixture.mjs`, `docs/MIGRATIONS_PENDING.md`; fila general de `scripts/`:
`scripts/backup-dump.mjs` (una línea, `'equipments'`: sin ella cae `tests/scrum241-backup-tablas.test.mjs`,
medido quitándola).

A9: comprobación → `tests/scrum914-equipos-borrado-y-anonimizado.test.mjs`

Mutaciones: catálogo → `tests/scrum914-equipos-borrado-y-anonimizado.test.mjs`

### De dónde sale

Retomado POR CONTENIDO de `origin/scrum-914c-esquema-de-equipos` (#3014) y
`origin/scrum-914-j3-borrado-y-anonimizado-equipos` (#2621, contenido dentro de la otra), los dos DIRTY y
sin reabrir: aplicado con `git apply --3way` fichero a fichero. Dos conflictos, los dos por
`fiscalPlazoEstado` (entró en `main` después): se conserva y se añade `equipment` detrás. Lo que NO se trae:
`fusionClientes.ts` y `albaranDuplicado.ts` (S1, abajo) y el tramo de registro viejo (es de esas ramas).
`docs/sql/deriva-prod.sql` NO se trae: se REGENERA con `node scripts/generar-sql-deriva.mjs` sobre este
esquema (548 → 565 columnas, 35 → 36 tablas; las 17 líneas añadidas son todas de equipos), y scrum222, 461 y
733 en verde (68 = 66 pass + 2 skip, junto a 1294, 267 y 854). En `docs/legal/AUDITORIA_CAMINO_EMISION.md`
(líneas 36 y 40) se ponen al día EN SITIO las dos coordenadas del esquema que el modelo desplaza (970-971 →
972-973, 1908 → 1957), sin cambiar la afirmación; scrum525d, 8 de 8.

⚠️ **Error mío, cazado antes de empujar:** la primera versión de este tramo decía que la auditoría y
`deriva-prod.sql` no hacían falta porque «sus guards no cayeron en la tanda dirigida»; no estaban EN esa
tanda. Lo cazó scrum525d al correr los guards del registro, y por el mismo motivo regeneré la deriva
(#3014 ya había caído en 222/461/733). Lo que no corrí no puede haber quedado en verde.

### Lo que cambia

- `prisma/schema.prisma`: `model Equipment` (`@@map("equipments")`) y `equipmentId Int? @map("equipment_id")`
  + `@@index([equipmentId])` en `Job`, `MaintenancePlan`, `Albaran` y `ParteTrabajo`; relaciones inversas en
  `Merchant` y `Customer`. Offline (`preview-migracion.mjs --desde` el esquema de `origin/main`) da EXACTAMENTE
  el DDL de `docs/sql/scrum-914-equipos-del-cliente.sql`, veredicto «aditiva». Contra dev: 0 sentencias de
  equipos (12 `DROP` de otros tickets que dev ya tiene; `docs/MIGRATIONS_PENDING.md`).
- `borradoMerchant.ts`: `'equipment', 'customerSite'` justo antes de `'customer'` (le apuntan los cuatro
  documentos sin FK; él apunta al sitio sin FK y al cliente con RESTRICT).
- `anonimizarMerchant.ts`: `equipment: ['name', 'serialNumber']`. `type` y `brand` → `NO_PERSONALES` del censo
  con motivo; `modelName` → `FUERA_DE_ANONIMIZADO` de scrum497 con motivo (la clasificación del tramo J3 de
  #2621: catálogo). `serialNumber` entra en `VOCABULARIO_PERSONAL`.
- Tests: `scrum914` nuevo (2 sin base + 2 contra Postgres desechable, saltados en local), y 244, 440
  (fakes con `equipment.updateMany`), 419 (gateados del 914: 2), 411 (13 → 14 llamadas a `borrarMerchant` y el
  4.º fichero: **decisión del orquestador, SCRUM-914 c.22443**), fixture (`equipment` antes de `customer`).

### Rojo primero, y verde con recuento

- **Rojo** (código sin tocar, esquema ya con el modelo; 5 ficheros): 57 = 46 pass + 8 fail + 3 skip. Los 8:
  scrum172 ×2 (fixture), scrum192 (orden), scrum497 + 1547 ×2 (columnas sin clasificar), scrum914 ×2.
- **Verde** (después; 26 ficheros: 914, 244 ×6, 411, 419, 440, 497, 192, 1291, 302-duplicar, 1157, 1215 ×10,
  1415, 810, 810b, 854, 1307): 234 = 227 pass + 4 fail + 3 skip. Los 4 rojos: `scrum1291` ① y ③ y
  `scrum302` (S1, abajo) y `scrum854` ② (pedía este tramo). Los 3 saltos: `LIBRO_PG_URL` (no hay Postgres
  desechable en esta máquina: 0 escuchas en 5432) → **los dos casos contra Postgres de scrum914 NO los he
  corrido**; los juzga el CI.
- `tsc -p .` CON tipos, con el cliente regenerado en el `node_modules` propio del árbol: salida 0.
- Mutaciones (`aplicarUna` de la casa, guion `docs/master/evidencias/SCRUM-914d/mutar-914d.mjs.txt`): «el
  borrado se salta los equipos» y «el anonimizado se salta los equipos» → las dos VIVAS, 0 colaterales; el
  ancla vuelve a estar después.
- **La suite entera NO se ha corrido en local**: la corre el obligatorio.

### 🔴 EL PR NACE ROJO, A PROPÓSITO (c.22443): dos ficheros de S1, medidos y sin tocar (`aviso-a-luis`)

| rojo | causa | qué haría falta (S1) |
|---|---|---|
| `tests/scrum1291-fusion-mueve-direcciones-de-obra.test.mjs` ① y ③ (`{"error":"internal_error"}`) | deriva del esquema todo modelo con `customerId`; `equipments.customer_id` tiene FK RESTRICT y `fusionarClientes` no mueve los equipos → el `DELETE` del fusionado falla, 500. **Defecto real y latente**: nada da de alta equipos todavía | `src/modules/system/domain/fusionClientes.ts:191`, detrás del `customerSite.updateMany`: `await tx.equipment.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } });` (lo escribió S1 en #3014, `d5d29ee22`) |
| `tests/scrum302-duplicar.test.mjs:59` (`equipmentId` sin cubo) | `Albaran.equipmentId` sin clasificar en `CAMPOS_QUE_VIAJAN` / no viaja | `src/modules/jobs/domain/albaranDuplicado.ts:54`, en `CAMPOS_QUE_VIAJAN`: `equipmentId` con su motivo (S1 lo puso en «viaja» en #3014, con un testigo en scrum302) |

### Aceptación del ③ (registro, arriba): qué cubre esta rama

Esta rama cubre el **3** («`equipment` entra en `borradoMerchant.ts` y en `anonimizarMerchant.ts`, con su
test»). Los **1, 2, 4 y 5** son del día en que haya rutas que creen, asignen o borren equipos y sitios: hoy no
existe ninguna (0 `equipment` en `src/` fuera de estos dos ficheros). El **6** se cumple sin tocar nada: ni
el canónico del albarán ni el del parte leen `equipmentId` (lo dice el comentario del esquema; el test de
sellado no se ha tocado).

---

## APÉNDICE · SCRUM-914 · 24-nov-2026 · S1 (encargo SCRUM-1817 pieza ③) · las dos líneas de S1, ENCIMA de la rama de #3335

**CRUCE DECLARADO.** Este tramo va en la rama `scrum-914d-equipos-en-borrado-y-anonimizado` (PR #3335, de J3),
encima de su punta `8ad26800d`, porque así lo diseñó su decisión c.22443 («Con esas dos líneas de S1 el PR
entra; sin ellas, no»). Los dos ficheros que toco son de S1; lo demás de la rama es de J3 y no lo toco.
`prisma/schema.prisma` se ha LEÍDO, no tocado; ni `migrate` ni `db push`. [Escrito por la sesión, no por Luis.]

- `src/modules/system/domain/fusionClientes.ts`, detrás del `customerSite.updateMany`:
  `tx.equipment.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } })`.
- `src/modules/jobs/domain/albaranDuplicado.ts`: `equipmentId` en `CAMPOS_QUE_VIAJAN`, con su motivo.
- Las dos, copiadas de `d5d29ee22` (#3014, S1, 2-nov-2026), sin cambios.

**Rojo primero, medido en esta rama** (`npm ci` + `prisma generate` en el `node_modules` propio del árbol,
guard del cliente ✔, `npm run build`): `scrum1291` + `scrum302` → 15 tests, 12 pasan, **3 caen**: `scrum1291` ①
(control positivo), `scrum1291` ③ (la misma dirección en los dos clientes) y `scrum302` («TODO campo de
`Albaran` está clasificado, y en UN solo cubo»). Son los tres de c.22448.

**Verde después:** los mismos dos ficheros + `scrum1057b` → 20 tests, 15 pasan, 0 caen, 5 saltan (los de
`scrum1057b`, que piden Postgres desechable: no corridos aquí, los juzga el CI). Barrido de vecinos (78
ficheros que casan con `fusion|duplic|914|equipo|scrum1057|scrum302|albaran`): 657 tests, 640 pasan, 0 caen,
17 saltan. **La suite entera NO se ha corrido en local**: la corre el obligatorio.

**Main.** La rama va 148 commits por detrás de `origin/main` `8e0d40816` (2026-11-24T08:31:18Z) y 1 por
delante; `git merge-tree` contra main: sin conflictos. No he traído main (lo decide el orquestador).
**Medido también sobre el MERGE con main** (lo que corre el CI de `pull_request`): árbol desechable con
`git merge-tree` de esta punta y `8e0d40816`, `npm ci` propio, cliente ✔, `tsc` limpio. Los mismos 78
ficheros vecinos: 657 tests, 640 pasan, 0 caen, 17 saltan. Para estos dos rojos **no hace falta traer main**.