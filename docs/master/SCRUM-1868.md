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

# SCRUM-1868b · pantalla del borrado de cliente
**Medido contra:** `origin/main` = `f336e00c20b23a7fa11ae491c8cf8bfaa931fd6d` · 2026-11-26T17:08:44Z
Versión: 1.2 (SCRUM-1836)
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

A9: aviso → cicatriz J2 «edité la tabla de textos de `customerDetailView.js` (la fila de c.22867) sin cargar antes la skill `yaqu-premium-ui`; es la segunda línea de J2 con lo mismo» — no se pudo comprobar: ningún hook ve qué skill se cargó antes de un Edit

**Relevo jv-j2fo: 44 px (c.22728).** 2026-11-26T17:21:15Z (Date de GitHub) · rama al arrancar en `b652f90c5` · `origin/main` = `b2094c2cc2feceeee67ba2a2d07476fa6c53ebbc`, 8 commits por delante de la rama; ninguno toca `styles.css`, `customerDetailView.js`, `scrum1850` ni este registro (`git diff --name-only HEAD...origin/main`). Encargo del orquestador J (SCRUM-1868 c.22877): el botón de la tarjeta va a 44 px en todas las anchuras por SCRUM-1845 c.22728, y por la regla 41 se arregla el botón, no el guard. Skill `yaqu-premium-ui` cargada antes del primer Edit.
- Arreglo: bloque `J2: SCRUM-1868b` en `public/dashboard/css/styles.css`, justo detrás del de SCRUM-1850, con una sola regla, `.customers-card[data-rol="borrar-cliente"] > .btn-secondary { min-height: 44px; }`: el mecanismo de `402be3df2` (por contenedor, solo tamaño). `.btn-secondary` global y los `.btn-sm` no se tocan; el botón no llevaba `.btn-sm`. Cruce J2→S2 (contenedor `styles.css`), declarado en el commit con el precedente `402be3df2` y la cita c.22728. En `customerDetailView.js` solo cambia el comentario que decía «36 px en escritorio».
- Medido: antes del arreglo (rama en `b652f90c5`, `dist/` con `tsc --noCheck`), `tests/scrum1850-ficha-360-resto-44.test.mjs` pasaba 3 de 5 casos (b en rojo: 2 de 57 mediciones cortas, «Eliminar cliente» @929 y @1280, caja 36 · toque 36,7); después pasa 5 de 5, el control d) incluido. Con `docs/master/evidencias/SCRUM-1850/medir.mjs` (20 interactivos por anchura, 0 sin alcanzar), «Eliminar cliente»: caja 44 · toque 44,9 a 390; 44 · 44,7 a 929; 44 · 44,7 a 1280. Las otras 2 cortas de cada anchura son los exentos de c.22728 («← Volver a Clientes» y «Ver →», 30).
- Verdes, con población: 14 ficheros dirigidos (1868b, 1866, 1850, 1841, 1852, 352, 542, 380, 1179c, 1593, 562, 1868a, 1185, 337), 125 de 125 · `tests/scrum1868b-borrar-cliente-pantalla.test.mjs` 20 de 20 · los 158 ficheros de `tests/` que nombran `styles.css`, `customerDetailView` o `renderCustomer360View`, en 3 lotes: 1.276 casos, 1.270 pasan, 0 caen, 6 saltados (gateados por `LIBRO_PG_URL` o `QA_DB_TEST`, con su motivo). `scripts/guard-objetivo-tactil.mjs`: ficha 360 en verde a 929 y 390 (suelo 2 = los dos exentos); sale 2 por 4 ciegos de fuentes en `/`, la landing, que no carga `styles.css` (0 referencias en `public/index.html`).
- Error mío: la primera vez corrí 1850 sin `dist/`, que este árbol no trae (la ficha del orquestador lo avisa); salió CIEGO («no se monta como la monta el censo»), no verde, así que lo cazó el propio test. Sin línea `A9:` nueva: la comprobación ya existe y es ese CIEGO.
- NO hecho: el recorrido a 390 y 1280 con AB6 y capturas (en staging tras el merge, patrón 1833e) · el meta-guard de mutaciones: la regla nueva no tiene mutación de catálogo, y el control d) de 1850 quita solo sus 3 reglas, no esta · la suite entera (la corre el CI de #3472) · nada en `src/`, staging, producción ni yaqu.app. El hallazgo S2 de `gasto-opcion-eliminar` (arriba) sigue en pie; esta regla no depende de esa clase.

**Relevo jv-j2fp: marcas del censo de microcopy y catálogo de mutaciones (CI de `cf8794eac`: 1157 ①③, 1215g, 1215i y 836d en rojo).** Commits `d3d7b5564` (marcas) y `83a4fde4f` (`cae`); este párrafo y la línea `Versión:` los escribe el orquestador J con lo que la sesión midió y le mandó al parar a 220k.
- Marcas: las 26 hojas de `BORRAR_CLIENTE.TEXTOS` llevan la marca en su línea (`FILAS` y `MOTIVOS` partidos, una clave por línea; ni un literal cambia). Las citas llevan a donde está cada texto: la descripción de SCRUM-1868 («2-Los textos valen»), c.22850 para `exito`, c.22867 para `solicitudes` y SCRUM-1124 c.17002 para `generico` (la firma de origen que cita `FUSION_CLIENTE`). Censo: 26 hojas, 26 APROBADO propias, 0 por grupo; trinquete nuevas 0 · sobran 0; población 103 ficheros, 434 hojas. Controles: sin la marca de `exito` sale 1 NUEVA SIN_COMENTARIO; con FIRMADOS solo en la cabecera vuelven exactamente 4 NUEVA por grupo.
- Las otras 4 de las 30 acusadas no eran textos: `CUENTA_DEL_MOTIVO.tiene_facturas`/`tiene_presupuestos` y `estado` (`generico`, `bloqueado`, `revisar`) son CÓDIGOS, y `alertaBloqueo` deriva texto. Pasados a minúscula con el patrón de `EQUIPOS_CLIENTE`, salen del censo. Los 4 trozos de `alertaBloqueo` llevan su marca en su línea, pero el censo no lee cuerpos de método: los ve un humano, no el instrumento. Decisión de la sesión, validada por el orquestador.
- `cae` medidos con `aplicarUna` (base 20/20): mut.1 (`if (!listo) return;`) tumba 2 → «BLOQUEADO: alerta, «Lo que lo impide» y solo «Cerrar»; pulsar «Eliminar» igualmente no manda el DELETE»; mut.2 (el 409) tumba 1 → «409 tras pulsar (alguien emitió una factura entre mirar y pulsar) → el modal pasa al bloqueo con el cuerpo del 409»; mut.3 (al partir `FILAS` su ancla pasa a la línea nueva) sigue tumbando su `cae` (2 caen).
- Verdes, con población: 1157 + 1215g + 1215i + 836 + 1868b = 65 de 65, 0 saltados. NO corridos por la sesión: 837, 1850, 1866, 1294, 267, `guards:entrada` y la suite entera (el CI de #3472 los corre; el PR sigue en borrador hasta la decisión del fundador, c.22900). Error de la sesión, confesado: cruzó 200k sin medirse entre Jira y las marcas.
**1868e (jv-j2fs): bloqueo ampliado y textos de c.22916.** Arranque 2026-11-27T10:44:21Z (Date de GitHub), rama en `758de802b`, 69 commits detrás de `origin/main` (`10f12420d`); desde la base de fusión `main` solo toca, de lo que nombra este tramo, `public/dashboard/css/styles.css` (25 líneas añadidas por 1805e y 1857), así que no fusiono. Cierre medido sobre `origin/main` = `81b244c1ff492a0bfecb508474ddd7e41a2ee63d` a las 10:51:31Z. Encargo del orquestador J sobre SCRUM-1868 c.22916 ① (textos y contrato); el servidor es 1868d, en otra rama, y aquí se dobla en el test.
- Vista `public/dashboard/js/customerDetailView.js`: `tarjetaTexto` (:781) y `nota` (:795) sustituidos; `bloqueoTrabajos` (:800); `MOTIVOS.tiene_trabajos`, `tiene_partes` y `tiene_mantenimientos` (:805-807); `CUENTA_DEL_MOTIVO` con los tres; `alertaBloqueoTrabajos` (:849), hermana de `alertaBloqueo`: el literal entero con `{nombre}`, `null` con cero de los tres. En `pintarBloqueo` (:2209) sale solo cuando `alertaBloqueo` da `null` (cero facturas y cero presupuestos). Cada texto lleva `// APROBADO por el fundador el 27-nov-2026 (SCRUM-1868 comentario 22916)` en su línea. Sin CSS: las filas nuevas usan la misma `tabla`, y el botón sigue a 44 px con el bloque de jv-j2fo, sin tocar.
- Test `tests/scrum1868b-borrar-cliente-pantalla.test.mjs`: casos «SOLO TRABAJOS» (:229) y «LOS CINCO MOTIVOS» (:245), `FIRMADOS` con los cuatro textos (27 sin hueco), la alerta nueva en el caso de la derivación y `CUENTA` con `trabajos`, `partes` y `mantenimientos`.
- Rojo primero, con `dist/` de `tsc --noCheck`: base 20 de 20; con el test nuevo y la vista sin tocar caen 6 de 22, cada uno por lo suyo (textos distintos de los firmados, la ficha sin el texto nuevo, `alertaBloqueoTrabajos is not a function`, falta la nota nueva, y SOLO TRABAJOS y LOS CINCO caen en el genérico). Con la vista: 22 de 22.
- Ficha `docs/microcopy/2026-11-26-SCRUM-1868-eliminar-cliente.md`: los cuatro textos de c.22916 como citas aprobadas; los dos sustituidos, en la tabla «Retirados el 27-nov-2026 por c.22916», sin la columna «Texto aprobado» (patrón de SCRUM-769), así que dejan de contar como aprobados sin borrarse.
Mutaciones: catálogo → `tests/scrum1868b-borrar-cliente-pantalla.test.mjs`
(con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, base 22 de 22 y 0 saltados: mut.1 cae, +2 colaterales; mut.2 cae; mut.3 cae, +1; la nueva, mut.4 —quitar `tiene_trabajos` de `MOTIVOS`—, cae, +2 (los textos y LOS CINCO). `git status` vacío después.)
- Verdes, con población: 237, 976, 700, 824 y los dos 824b, 419, 836, 1157, 1215g, 1215i, 1185, 1850, 1866, 1145 y 1868b: 16 ficheros, 149 tests, 147 pasan, 1 saltado (1145, por `LIBRO_PG_URL`, con su motivo) y 1 cae: 976 ④, porque `guards:entrada` salía 1 antes de escribir este párrafo. Después del párrafo, `guards:entrada` cayó en `tests/scrum514-aprobado-y-aplicado.test.mjs` (control de prosa: la frase nueva de la tarjeta tiene 175 caracteres, más de 160, y la firma de la ficha decía `c.22916` pero no `comentario 22916`, que es lo que lee el guard). Arreglo en la ficha, no en el guard: la línea de la firma dice ahora «comentario 22916». Con eso, `guards:entrada` 186 de 186; 1294 + 267 + 854, 24 de 24; 1868b + 1157 + 976, 44 de 44, 0 saltados.
- NO medido: la suite entera (no me cabía en el contexto; lo dije al orquestador antes de empujar; la corre el CI de #3472) · el servidor real (1868d): el contrato está doblado, no probado contra la ruta · el recorrido de navegador a 390 y 1280 con AB6 y capturas · el cotejo de los literales con c.22916 lo hice a ojo sobre la respuesta de Jira de esta sesión, no con `grep -F` contra el cuerpo guardado · `DESIGN.md` y la Parte AB no los releí: no hay token, clase ni componente nuevo.
- Errores míos: la primera base la corrí sin `dist/` (CIEGO, `MODULE_NOT_FOUND`); en la primera pasada de mutaciones le di el guard al instrumento con `tests/` delante y su línea base salió con 0 pasados (CIEGO, ninguna mutación contada); y pasé de los 175k que el encargo fijaba para el primer empujón sin haber empujado (eso no tiene comprobación: el hook de contexto avisa a 200k, no a 175k).

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

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
