# SCRUM-1868a · servidor del borrado de cliente
**Medido contra:** `origin/main` = `f336e00c20b23a7fa11ae491c8cf8bfaa931fd6d` · 2026-11-26T16:48:40Z

Carril J2. Decisión del fundador: SCRUM-1868 (descripción y c.22850); entra en la 1.2 por SCRUM-1836 c.22852
(citado por el orquestador; ese comentario no lo he leído). La pantalla es SCRUM-1868b (jv-j2fl), en paralelo.

**Qué hay.**
- `src/modules/system/customerAdmin.ts`: `contarLoQueSeBorra` es el ÚNICO criterio de bloqueo (cuenta documentos,
  sitios, equipos, historial, solicitudes, presupuestos y facturas, todo con `merchantId`). `previaDeBorrado` lo usa
  para el GET; `borrarClienteYSusDocumentos`, dentro de la `$transaction` de `deleteCustomer`, comprueba que el
  cliente es del comercio, lanza `BorradoBloqueado` si hay presupuestos o facturas y, si no, borra equipos
  (`desligarYBorrarEquipo`), sitios, historial, solicitudes, el cliente y sus adjuntos. `Charge` no se toca.
- `customersAdmin.routes.ts`: `GET /admin/customers/:id/borrado-previa` (admin) → 200 `{ bloqueado, motivos, cuenta }`
  · 404 `not_found` · 400 `invalid_id`. `DELETE /admin/customers/:id` → 409 `{ error, motivos, cuenta }` (con las dos,
  `error` = `tiene_facturas`). Códigos, ninguna frase. El contrato de 1868b, sin cambios.
- Declaraciones: `tests/scrum337-aviso-atado-al-bloqueo.test.mjs` (3 `deleteMany` nuevos) y
  `scripts/_sin-consumir-declarados.json` (el GET, carril J2, a retiradas en 1868b; cruce J2→S0 del encargo,
  editado parseando y re-serializando con ida y vuelta idéntica). Cero cambios en `prisma/`.
- 🔵 Corrección al encargo: **no** hay fila en `src/core/http/adminRouteDeclarations.ts` (S1). Esa lista es la de lo
  que el técnico SÍ puede usar, y el GET lleva `requireRole('admin')`; `scrum55` pasa sin ella. No crucé a S1.

**Verdes, con población.** Test nuevo `tests/scrum1868a-borrar-cliente-rutas.test.mjs`, por la RUTA: contra main
(`f336e00c2`, mi `src/` revertido con `git apply -R`) 8 de 10 caen y el caso del presupuesto dice «dio 500»; con el
cambio, 10 de 10. Guards y vecinos (19 ficheros: 1294, 267, 854, 237, 976, 700, 824, 419, 1185, 337, 1866, 55,
1833b, 576, 1005b y el nuevo): 155 casos, 153 pass, 1 skip (1833b POSTGRES, sin `LIBRO_PG_URL`) y 1 fail, `scrum854`,
que pedía este registro. Build con tipos (`npm run build`): salida 0. `censo:mudez --escribir`: 149 fichas, nada nuevo.

**NO medido, en la misma frase:** la suite entera NO la corrí (no cabía en el contexto de la sesión); las 6 mutaciones
de `MUTACIONES_QUE_ME_TUMBAN` sólo las comprobé ancladas (cada `de`, una vez en su fichero), NO las corrí; nada en
Postgres: la FK RESTRICT y el SET NULL de `charges` los imita el doble; la pregunta ② (¿hay `Charge` con cliente y sin
factura?) pide la base de producción, que no se toca desde aquí; nada en staging ni en yaqu.app.

**Para 1868b y el fundador:** `cuenta.facturas` cuenta TODA fila de `invoices` del cliente (cualquiera bloquea por
la FK), y la copia firmada dice «Facturas emitidas»; `cuenta.documentos` cuenta todos sus adjuntos, igual que el
borrado. `Job`, `MaintenancePlan`, `ParteTrabajo`, `WhatsAppMessage` y `EmailMessage` guardan `customerId` sin FK y
se quedan con el número de un cliente borrado, como antes de este tramo: no está en lo firmado y no lo toco.

## CI del primer empujón (`f211de3ee`): rojo de `scrum1456`, arreglado por el orquestador

El obligatorio del run 45864266702 cayó con `fail 1` sobre 14.629: `tests/scrum1456-ids-que-no-caben-en-la-columna.test.mjs:252`,
el control negativo «un id CORRECTO sigue llegando al borrado y contesta 204», contestó 404. Causa: desde este tramo la
ruta BUSCA al cliente (`customer.findFirst`) y cuenta lo que le cuelga ANTES de borrar, y ese caso solo sembraba
`customer.deleteMany`: el banco decía «no existe» y la ruta, como manda SCRUM-1571, 404. No es un defecto del código: el
caso siembra ahora también `'customer.findFirst': { id: 7 }`; la aserción no cambia. Medido en el árbol de la rama: antes
61/62 (cae ese caso), después 62/62, y con 1868a, 1571, 337, 1294, 267 y 854: 9 ficheros, 127/127. El encargo de
`jv-j2fk` no pedía correr `scrum1456` (vecino del DELETE): error del orquestador, cazado por el CI.

A9: aviso → cicatriz J2 «otra vez crucé el tope del primer empujón sin medirme entre la lectura de Jira y el final del test» — no se pudo comprobar: ningún hook del repositorio lee el contexto a mitad de tanda

# SCRUM-1868c · huérfanos del borrado: medición y propuesta
**Medido contra:** `origin/main` = `5ed6e94f6a61547eb4589ec913e93be9a4ce4b55` · 2026-11-27T06:45:25Z
Versión: 1.2 (SCRUM-1836)

Carril J2, solo documentación (jv-j2fq). Nace de SCRUM-1868 c.22890 ② (pregunta A/B del orquestador) y c.22898; sin
respuesta del fundador al medir (11 comentarios, ninguno posterior a c.22898). **Ningún texto de aquí está firmado.**

**① La lista.** Dos sondas independientes que casan: el esquema (`grep customerId`, 12 campos que apuntan a un cliente)
y la base de staging (`information_schema` + `pg_constraint`: 12 columnas, 7 con FK). Con FK: `quotes` e `invoices`
(columna `customerId`, RESTRICT), `quote_requests`, `customer_events`, `customer_sites`, `equipments` (RESTRICT) y
`charges` (SET NULL). **Sin FK, las cinco del registro de 1868a y ninguna más:**

| modelo (tabla) | campo | qué ve el profesional si apunta a un cliente borrado |
|---|---|---|
| `Job` (`jobs`) | `prisma/schema.prisma:1449`, `Int` NOT NULL | un trabajo sin cliente: agenda y cobros sin a quién; no se puede desligar sin esquema |
| `MaintenancePlan` (`maintenance_plans`) | `prisma/schema.prisma:1510`, `Int` NOT NULL | un plan activo que sigue venciendo y proponiendo visitas a nadie; no se puede desligar sin esquema |
| `ParteTrabajo` (`partes_trabajo`) | `prisma/schema.prisma:1779`, `Int?` | un parte, firmado o facturado, cuyo cliente ya no existe: el documento firmado se queda sin su ficha |
| `WhatsAppMessage` (`whatsapp_messages`) | `prisma/schema.prisma:1404`, `Int?` | un envío en el registro sin cliente; el número (`toPhone`) se queda en la fila |
| `EmailMessage` (`email_messages`) | `prisma/schema.prisma:1718`, `Int?` | un correo en el registro sin cliente; la dirección (`toEmail`) se queda en la fila |

Fuera de la población, por ser polimórficas (`entityType`/`entityId`): `attachments` (el borrado ya los quita) y
`audit_log` (en staging, 48 filas de 5 tipos; ningún tipo contiene «cust» ni «client», y no miré cuáles son).

**② Staging, hoy (SOLO SELECT, en transacción `READ ONLY`; destino comprobado antes con `comprobar-claves-bd.mjs`:
`DATABASE_URL_STAGING` → STAGING).** Población: 12 clientes de 4 comercios, 21 presupuestos, 16 facturas.
- **Huérfanas YA: 0 en las cinco tablas** (jobs 22 filas, maintenance_plans 10, partes_trabajo 7, whatsapp_messages 35
  —24 con cliente—, email_messages 1 —0 con cliente—). Cada recuento lleva un control SEMBRADO en la propia consulta (un
  id que no existe suma 1, uno que existe suma 0): salió +1 en las cinco, así que el 0 es «mirado», no «ciego».
  Filas que apuntan a un cliente de OTRO comercio: 0.
- **Clientes que el borrado de hoy deja borrar** (sin presupuestos ni facturas): 4. **De ellos, 3 (de 3 comercios)
  tienen trabajos: 5, todos en `pendiente_agendar`**; 0 con partes, 0 con mantenimientos, 0 con WhatsApp o correo. La
  unión sale 3 por `EXISTS` y 3 por `EXCEPT`. Es decir: con la tarjeta de 1868b, hoy en staging 3 de los 4 clientes
  borrables dejarían trabajos apuntando a nadie.

**③ La propuesta (no decido; el fundador elige).** Textos **PROPUESTOS, sin firmar**; los vigentes, de la ficha de
microcopy de la rama de 1868b (`cf8794eacc8e621efe92d561214f99f266c0ef55`), no copiados de Jira.
- **(a) Bloquear también por trabajos, partes y mantenimientos.** Servidor: tres `count` más en `contarLoQueSeBorra`
  y tres motivos nuevos en el 409 (`tiene_trabajos`, `tiene_partes`, `tiene_mantenimientos`; `cuenta` gana `trabajos`,
  `partes`, `mantenimientos`). Pantalla, PROPUESTOS:
  - frase de la tarjeta: «Se borra su ficha con sus documentos, sus sitios y sus equipos. No se puede deshacer. Si tiene presupuestos, facturas, trabajos, partes o mantenimientos, no se puede eliminar.»
  - filas nuevas en «Lo que lo impide»: «Trabajos» · «Partes de trabajo» · «Mantenimientos»
  - cabecera cuando solo impiden los nuevos: «No se puede eliminar a {nombre}. Tiene trabajos, partes o mantenimientos que se quedarían sin cliente.»
  - la de «se puede»: «Este cliente no tiene presupuestos, facturas, trabajos, partes ni mantenimientos: por eso se puede eliminar.»
  Alternativa que NO propongo y anoto: borrarlos en cascada. `Job` y `MaintenancePlan` no admiten NULL, y un parte
  firmado lleva la firma del cliente: borrarlo es borrar un documento (dato de cliente, STOP del fundador).
- **(b) Mensajes de WhatsApp y correo.** Las dos columnas admiten NULL, así que las tres salidas caben sin esquema:
  (b1) bloquean, y la tarjeta casi nunca dejaría borrar a un cliente al que se le escribió; (b2) se quedan con el
  número de cliente, como hoy (cero trabajo, huérfanos en el registro); (b3) se desligan con `customerId` a NULL en la
  misma transacción (dos `updateMany` con el comercio en el `where`). En (b3) el teléfono y el correo SIGUEN en
  `toPhone`/`toEmail`: si eso también se borra es una decisión de datos de cliente (STOP), no de este tramo.
- **(c) Tamaño.** (a): 1 tramo de servidor J2 (`src/modules/system/customerAdmin.ts`, su test de 1868a y los bancos
  que siembran el borrado, p. ej. `scrum1456`, porque el contador pedirá `job.count`) + 1 tramo de pantalla J2 (la
  vista de 1868b, su ficha de microcopy y la firma). (b3): cabe en el tramo de servidor de (a) o en uno propio; la
  pantalla no cambia salvo que el fundador quiera decirlo. (b1) y (b2): sin pantalla nueva. **Esquema: NO en ninguna.**

**④ La nota de c.22890 (borradores), corregida.** En `invoices` **no hay borradores**: la única creación de una fila
es `src/modules/invoicing/domain/crearFacturaEmitida.ts:69` (el embudo de SCRUM-729; 1 `invoice.create` en `src/`).
Staging: 16 facturas, todas con número, `paid`/`pending` × `no_aplica`/`sellado`; 0 sin número, 0 `annulled`. La
frase «borradores incluidos» del registro de 1868a (este puesto) y de c.22890 no se sostiene: lo que cuenta
`cuenta.facturas` son facturas emitidas, anuladas incluidas (una anulada tampoco se borra, regla 29 y FK RESTRICT).
Propuesta: **el texto «Facturas emitidas» se queda como está** y el bloqueo sigue contando todas.

**NO medido, en la misma frase:** producción (no se toca desde aquí), así que las cifras de ② valen para 12 clientes
de staging y no para los comercios reales; quién LEE hoy `customerId` de `whatsapp_messages` y `email_messages`
(pantallas, anti-spam J6) no lo he mirado; la derivación de singulares y plurales de las filas propuestas en la vista
de 1868b, tampoco; la suite entera NO la corrí (solo docs; guards 1294, 267, 824, 419 y `guards:entrada`).

A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: mi primera sonda de columnas buscaba `customer_id` y no veía `quotes`/`invoices` (`customerId`); lo destapó un error de SQL, no un control, y la sonda vive en el temporal de la sesión
