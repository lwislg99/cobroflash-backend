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
