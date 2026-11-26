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

# SCRUM-1868b · pantalla del borrado de cliente
**Medido contra:** `origin/main` = `f336e00c20b23a7fa11ae491c8cf8bfaa931fd6d` · 2026-11-26T17:08:44Z
**Skill UI:** no cargada · mi cambio en `public/` es una fila de texto firmado (c.22867) en la tabla `BORRAR_CLIENTE.TEXTOS.FILAS`, sin CSS ni maquetación; no la cargué antes de editar (A9 abajo) y el recorrido que la exige no se hizo. Si la cargó jv-j2fl para `3557598ea`, no consta en su commit.

Carril J2. Relevo jv-j2fm de jv-j2fl (orquestador J, SCRUM-1868 c.22870). Textos: SCRUM-1868 (descripción, c.22850 y c.22867, «1-Ok»). GO del fundador al servidor: c.22873 (citado por el orquestador; no lo he leído).

**Qué hay en la rama `scrum-1868b-borrar-cliente-pantalla`:**
- `3557598ea` (jv-j2fl): tarjeta solo admin al final de la ficha, modal de revisión y modal bloqueado, DELETE solo desde «Eliminar», toast «Cliente eliminado», ficha `docs/microcopy/2026-11-26-SCRUM-1868-eliminar-cliente.md` y `tests/scrum1868b-borrar-cliente-pantalla.test.mjs`.
- `69b819fae`: merge del servidor (`f211de3ee`, SCRUM-1868a, jv-j2fk), hecho por el orquestador.
- `550da9f14` (jv-j2fm): trinquete 1185 — `ruta · GET /admin/customers/:id/borrado-previa` de `declaradas` a `retiradas` en `scripts/_sin-consumir-declarados.json` (175→174 y 75→76), por parse y re-serialización con control previo de ida y vuelta idéntica (59.683 B, 258 líneas).
- Este commit (jv-j2fm): la fila «Solicitudes de presupuesto» con `cuenta.solicitudes`, detrás de «Historial de actividad», en la vista, en el test (caso de la previa con 6 solicitudes; 24 textos sin hueco) y en la ficha de microcopy. Literal cotejado con `grep -F` contra el cuerpo de c.22867: 1 en los tres ficheros; control negativo «Solicitudes de presupuestos»: 0.

**Verdes, con población:** `tests/scrum1185-trinquete-sin-consumir.test.mjs` 11 de 11 · `tests/scrum1868b-borrar-cliente-pantalla.test.mjs` 20 de 20 · `tests/scrum1868a-borrar-cliente-rutas.test.mjs` 10 de 10 · `npm run build` (tsc con tipos) salida 0, cliente de Prisma ✔ · `npm run censo:mudez -- --escribir`: 149 fichas, 0 medidas, `tests/_veredicto-mudez.json` SIN cambios (el encargo esperaba que cambiara; no lo he investigado).
Mutaciones: catálogo → `tests/scrum1868b-borrar-cliente-pantalla.test.mjs`
(la nueva quita la fila de la vista; corrida una vez a mano con la vista restaurada después: 18 de 20, caen el 9 y el 13; el meta-guard del catálogo NO lo corrí). Las tres entradas llevan ahora `fichero` como literal de cadena: con `fichero: VISTA`, que traían las dos de `3557598ea`, `scrum757` y `scrum1294` (en `guards:entrada`) no podían leer el catálogo.

**ROJO que dejo sin arreglar — `tests/scrum1850-ficha-360-resto-44.test.mjs`:** guards dirigidos (1294, 267, 854, 237, 976, 700 sin filtro, 824, 419, 1185, 1866, 1850, 337): 12 ficheros, 96 tests, 93 pasan, 3 caen. Dos son el mismo de 1850: «2 de 57 mediciones por debajo de 44 px en la ficha 360: @929px y @1280px BUTTON.btn.btn-secondary.gasto-opcion-eliminar «Eliminar cliente» caja 36 · toque 36.7». La descripción de SCRUM-1868 pide 36 px en escritorio; la regla de SCRUM-1845 c.22728 que vigila 1850 pide 44 en todo lo que no sea un `.btn-sm` no primario. Elegir es una decisión (y el arreglo toca `public/` o `styles.css`, fuera de mi encargo): no lo toco. El tercero era `scrum976` ④ por `guards:entrada` (`scrum811c` pedía la línea de la skill en este registro): lo cubre este tramo.

**Hallazgo (carril S2):** la tarjeta usa la clase `gasto-opcion-eliminar`, que es de gastos: si S2 la renombra, la tarjeta pierde el color de peligro sin que nada de este carril lo vea.

**NO hecho:** la suite entera (la corre el CI de #3472, por orden del orquestador) · el recorrido de navegador a 390 y 1280 con AB6 (otro relevo, o en staging tras el merge, patrón 1833e) · el meta-guard de mutaciones · la pregunta ② (`Charge` con cliente y sin factura) · nada en staging, producción ni yaqu.app. Contexto: 102k tras el arranque, 110k tras Jira y 158k tras editar el test, sin medida en medio (la línea de 1868a, repetida).

A9: aviso → cicatriz J2 «edité la tabla de textos de `customerDetailView.js` (la fila de c.22867) sin cargar antes la skill `yaqu-premium-ui`» — no se pudo comprobar: ningún hook ve qué skill se cargó antes de un Edit
