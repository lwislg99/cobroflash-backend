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

A9: aviso → cicatriz J2 «otra vez crucé el tope del primer empujón sin medirme entre la lectura de Jira y el final del test» — no se pudo comprobar: ningún hook del repositorio lee el contexto a mitad de tanda
