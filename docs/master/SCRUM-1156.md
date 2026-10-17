# SCRUM-1156 · La ficha de lectura del gasto

Un registro por ticket (SCRUM-273): la pantalla (S2) y la ruta (S1, tramo `1156b`) escriben en ESTE fichero, cada una su tramo. Quien llegue después, AÑADE el suyo al final; no reescribe el de otro.

## Tramo 1156b · `GET /admin/expenses/:id` — mitad de servidor (S1)

**Medido contra:** `origin/main` = `1716a0f5451c37c35250fb90b07bda2f2bbdc574` · 2026-10-16T12:45:57Z (`Date:` de GitHub)

A9: comprobación → `tests/scrum1156b-ficha-del-gasto.test.mjs`

Sesión S1 · rama `scrum-1156b-ficha-gasto-servidor`. Encargo del orquestador, a petición de S2. La ficha (pantalla) la construye S2 y su tramo va debajo de este. **Aquí no se pinta nada.** El texto del 404 en pantalla («Ese gasto ya no existe.») lo firmó el orquestador y lo pone S2.

### Por qué

Las fichas viven en el hash (`DETALLES` de `app.js`, SCRUM-832) para que «atrás» vuelva a la lista y una recarga no las pierda. Sin una ruta que devuelva el gasto solo, no hay entrada en `DETALLES`: `renderAppView` hace `replaceState` y abrir la ficha borra la lista del historial, que es justo el defecto que arregló 832. Hasta hoy sólo existían la lista, `/summary`, `/categories`, `/margin/:quoteId`, `/:id/foto`, `PUT` y `DELETE`.

### Lo que hace

- `src/modules/expenses/domain/expenses.service.ts`: `getExpense(merchantId, id)` devuelve **la misma fila que la lista**: el mismo `select` (las columnas de `CAMPOS_DE_LA_LISTA` de SCRUM-964, más `quote` y `provider`) y la misma `completarFilas` (`tieneFoto` y `job`), que antes vivía dentro de `listExpenses`. Si cada una pidiera sus columnas, la ficha enseñaría otro gasto que el que se acaba de tocar en la tabla. La foto sigue fuera y sale por `/:id/foto`.
- El `select` va escrito en las DOS llamadas y no en una constante compartida: el censo de SCRUM-289 lee la proyección de `quote` en el literal de la llamada, y con una constante la lista dejaba de verse y la clave de `getQuoteMargin` cambiaba de ordinal (fue uno de los rojos de #2530). Que las dos sigan dando la misma fila lo comprueba el caso «la ficha es LA MISMA fila que la lista». El sitio nuevo, `expense.findFirst#1`, está censado como `PROYECCION` en `tests/_censo-origen-factura.mjs`.
- `src/modules/expenses/app/routes/expenses.routes.ts`: `GET /:id` con `requireRole('admin')` (el mismo permiso que la lista y que la foto) y filtrado por `merchantId` (regla 2). Contesta `{ ok: true, item }`, la forma de los `PUT` de la casa. El gasto ajeno y el que no existe dan el mismo `404 { ok: false, error: 'not_found' }`. Un id que no cabe en la columna da `400 invalid_id` sin tocar la base (SCRUM-1379). Va detrás de `/summary`, `/categories` y `/margin/:quoteId`; delante, se los comería.
- La lista contesta exactamente lo mismo que antes: sólo se ha sacado su remate a una función.

### Verificado, ejecutando

- `tests/scrum1156b-ficha-del-gasto.test.mjs`: 5 de 5. Ruta y servicio reales de `dist/`, con un doble que aplica el `where` y el `select` que se le piden, como el de `scrum964`. El `req` lo arma `reqDeSesion` (SCRUM-1344), no un literal a mano.
- **Rojo primero, mutando `dist`:** sin `merchantId` en el `where` cae el caso de la regla 2; sin el `select` (la foto vuelve) cae el de «la misma fila que la lista». Cada mutante muere en su caso y el resto sigue en verde.
- Vecinos: los 79 ficheros que nombran `expenses` más los censos de ids y exports (`scrum964`, `scrum1379*`, `scrum411`, `scrum243`…): 798 tests · 787 pass · 11 skip (piden bases desechables) · **0 fail**.
- `tsc`: un error, el de la causa A (`merchantAdmin.ts:147`, `activityKind` sin cliente regenerado). No viene de esta rama. `dist` se emite igual.
- Los cinco guards que tumbaron el primer obligatorio de #2530 (`scrum273`, `scrum854 ②`, `scrum1344 ⑤`, `scrum289`, `scrum976 ④`), corridos solos tras el arreglo.

### No medido

- La ruta contra una base de verdad ni en producción: es una lectura nueva sin pantalla que la use todavía. Se verá en yaqu.app cuando S2 enganche la ficha.

## Tramo 1156c · la ficha en pantalla (S2)

**Medido contra:** `origin/main` = `d66ca7942c47ced5648fabe0280cc9ffcf2ec1a2` · 2026-10-17T21:31:06Z

A9: comprobación → `tests/scrum1156c-la-ficha-del-gasto.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`: DESIGN.md por tokens de `styles.css`, ni un token ni un `style=` nuevos; AB6 medido en navegador).

Sesión S2 · rama `scrum-1156c-ficha-gasto-pantalla`. Encargo del orquestador del 16-oct-2026, con la ruta de S1 (tramo 1156b) ya en `main`.

### Lo que hace

- `public/dashboard/js/expensesView.js`: `renderExpenseDetailView`, la ficha de LECTURA. Cabecera (migas «Gastos», concepto, fecha, píldora de categoría, «Foto guardada»/«Sin foto», importe; «Editar», «Ver trabajo» si lo hay, y el «⋯» completo del prototipo: Editar · Ver la foto / 📷 Añadir la foto · Ver trabajo / Vincular a un trabajo · 🗑 Eliminar). La foto del ticket DELANTE y grande, por `GET /admin/expenses/:id/foto`; sin foto, su bloque y «📷 Añadir la foto ahora». Los datos de la factura, SÓLO los apuntados, y sin tarjeta si no hay ninguno (nunca «—»). Notas, si las hay. El trabajo, con la misma `celdaTrabajo` de la fila; suelto, por qué importa y «Vincular a un trabajo».
- Todo lo que CAMBIA el gasto pasa por el modal de siempre (`openExpenseModal`) con el foco en el control pedido (`#exp-btn-camara`, `#exp-foto-quitar`, `#exp-quoteid`) y `onSaved` que repinta la ficha: no hay un segundo formulario, ni textos de error nuevos.
- La fila de la lista abre la ficha (`expenses-detail`), no el modal: era lo que su comentario dejaba pendiente («hasta que exista el detalle»). Su «⋯» no cambia.
- `public/dashboard/js/app.js`: `case 'expenses-detail'` (admin, como su ruta), su entrada en `DETALLES` (SCRUM-832: «atrás» vuelve a Gastos y una recarga la pide sola), `state.expenseId` y el menú activo en Gastos.
- `public/dashboard/css/styles.css`: las reglas propias de la ficha; el armazón es el de las otras (`.detail-page`, `.detail-head`, `.detail-section`, `.detail-dl`).
- Censos que cuentan fichas: `scrum832` pasa de seis a siete; `tests/_barra-lateral.mjs` declara `expenses-detail` sin entrada en la barra.
- `scripts/guard-lista-gastos.mjs`, caso E: CAMBIA lo que exige, no se afloja. Antes «tocar la fila abre el modal con ese gasto»; ahora «abre la ficha de ESE gasto (id 1) y no el modal».
- `docs/microcopy/2026-10-17-SCRUM-1156-ficha-del-gasto.md`: los diez literales de 920 c.15992 que esta ficha pinta, con su firma.
- `docs/microcopy/2026-10-17-SCRUM-1156-ficha-del-gasto-avisos.md`: los dos avisos de la carga, «Ese gasto ya no existe.» (id que no existe) y «No se ha podido cargar el gasto. Vuelve a intentarlo.» (5xx o sin red), firmados por el orquestador en SCRUM-1156 comentario 19907 y citados así en `app.js` y `expensesView.js`. Hasta esa firma `scrum832 · REGLA 30` estaba en rojo y la rama no se empujó.

### Verificado, ejecutando

- `tests/scrum1156c-la-ficha-del-gasto.test.mjs`: 8 de 8, pintando la vista real en el banco. **Rojo primero**, mutando el fuente sobre `2aa57b60`: la tarjeta de datos con «—» en los vacíos, la foto pedida aunque no haya, y el gasto suelto sin su «Vincular»: cada mutante cae en su caso (7 pass · 1 fail cada uno). `scrum237` tumbó la negación «Fecha de la factura» por no tener hermano: se añade el caso con la fecha apuntada, y en rojo (rótulo mutado a «Fecha factura») cae su caso, 7 pass · 1 fail.
- `guard:lista-gastos` (navegador real, 390 y 1280): de acuerdo, 0 hallazgos. **En rojo** con la fila devolviendo el modal: 1 hallazgo, el del caso E, 0 ciegos.
- Sonda de navegador de la ficha (`D:\MILLONARIO\cobroFlash\sondas-s2\ficha-gasto-1156.mjs`, fuera del repo): 3 gastos × 2 anchos, sin desborde, 0 cajas fuera, 0 controles bajo 44 px, 0 `style=`, 0 errores. Capturas en `docs/master/evidencias/SCRUM-1156/`. En el banco la foto no se sirve: la `<img>` se retira, como en el alta.
- Tras la firma (contra `d66ca794`): 94 ficheros —los que leen `docs/microcopy/` y los vecinos de abajo, más `1157`, `1215*`, `1257`, `237`, `832`, `709`— 870 tests · 862 pass · 8 skip (todos de BD: `QA_DB_TEST`, `LIBRO_PG_URL`, `SERIE_PG_URL`) · 0 fail. Por el camino cayeron dos rojos verdaderos, arreglados en el código: un `APROBADO` dentro del objeto `DETALLES` de `app.js` lo metía entero en el censo 1157 (28 hojas «nuevas»), así que ahí la referencia va en prosa, como su hermana `parte-detail`; y la clase `gasto-ficha-justificante` entraba en el censo de «justificante» de 1257 (regla 29): pasa a `gasto-ficha-ticket`. Los de árbol entero (`195`×4, `414`, `694`, `710b`, `737`, `1294`, `267`): 120 de 120. `guards:entrada`: 14 de 14. `guard:lista-gastos`: de acuerdo.
- El primer obligatorio de #2545 cayó con 3 de 11777 (job 117510845071), los tres de esta rama: `scrum1560` (entró en `main` con #2541, después de la base) monta cada `render*View` en el banco, y la ficha sin id pedía `/admin/expenses/undefined` → la vista ya no pide nada sin id; `scrum601`, el ancla de línea del rótulo «Facturas» de `app.js`, 386 → 388 (medido con `grep`); `scrum836d`, las mutaciones M2 y M3 de `scrum832` nombraban el título viejo («…SEIS fichas») → medidas aplicándolas: las dos tumban «…SIETE fichas», y ése es su `cae`. Tras el arreglo, esos tres más `832`, `1156*`, `237`, `1157`, `1257`: 91 de 91. **Queda para S3** (carril de `scripts/_datos-del-censo.mjs`, no tocado): darle a `renderExpenseDetailView` su contrato (`/admin/expenses/:id`) y su argumento en `ARGUMENTOS_DEL_CENSO`, para que el censo táctil mida la ficha en vez de saltarla.
- Vecinos (31 ficheros: `scrum514`, `402`, `709`, `811`, `722`, `801`, `599`, `821`, `769`, `920`, `964`, `135`, `370`, `1155`, `1038`, `912`…): 399 tests · 392 pass · 6 skip · 1 fail, el de la Skill UI de este registro, que se escribe aquí.

### Lo que NO entra todavía

- El NIF del proveedor: la fila no lo trae, y sin dato no hay fila.
- Visto en yaqu.app: después del merge (tramo siguiente).

## Tramo 1156c VISTO · la ficha en yaqu.app (S2)

**Medido contra:** `origin/main` = `44f3a6bf229837bc5249b4dc8056790f7b6d0e41` · 2026-10-17T22:18:01Z

A9: sin fallo que generalice — tramo de verificación en producción, sin código: lo medido va en las tablas de abajo, con sondas de navegador fuera del repo (`D:\MILLONARIO\cobroFlash\sondas-s2\visto-1156.mjs`, `crear-1156.mjs`, `medir-1156.mjs`) contra yaqu.app con la cuenta QA.

#2545 entró en `main` el 2026-10-17T22:10:06Z (merge `196453e15bb14ab8df07f9edfc3ea419bfe16461`, obligatorio verde en 12m55s). yaqu.app servía `44f3a6bf` (contiene el merge, comprobado con `git merge-base --is-ancestor`).

### 🔴 La cuenta QA pasa de 0 a 2 gastos

Antes de medir, `GET /admin/expenses` de la cuenta QA daba `{"ok":true,"items":[]}`: sin un gasto no hay ficha. Con la autorización del orquestador (bajo la norma del fundador del 29-sep: crear datos de prueba en QA es nuestro trabajo) se crearon DOS por el alta del panel, y sólo esas dos escrituras salieron (`POST /admin/expenses` → 201 cada una; todo lo demás que no es GET, cortado y probado con control positivo):

| id | concepto | estado al crearlo |
|---|---|---|
| 13 | `[QA-1156] sin foto ni trabajo` | 10 €, materiales, sin foto, sin trabajo (`quoteId` null), sin datos de factura |
| 14 | `[QA-1156] con foto y nº de factura` | 14,64 €, materiales, foto de un ticket de prueba dibujado por la sonda, `providerInvoiceNumber` «A-QA/1156», sin trabajo |

No se borran: la cuenta QA es para esto, y un borrado sería otra escritura. Quien llegue después se encontrará 2 gastos donde había 0.

### Los cinco literales de 920 c.15992, dónde se ven

En el `expensesView.js` SERVIDO por yaqu.app los cinco salen ahora (1, 2, 1, 1, 1 apariciones), con el control «Ver trabajo» dando 3. S3 los midió a CERO el 17-oct con ese control en 1.

| literal | dónde se ve en yaqu.app |
|---|---|
| «Ver a tamaño completo» | ficha del gasto 14 (con foto), botón bajo la foto del ticket |
| «Cambiar la foto» | ficha del gasto 14, botón al lado del anterior |
| «De este gasto no guardaste ninguna foto.» | ficha del gasto 13 (sin foto), en el bloque «La foto del ticket», sobre «📷 Añadir la foto ahora» |
| «Este gasto no cuenta para el margen de ningún trabajo.» | fichas 13 y 14 (las dos sin trabajo), bajo «Sin trabajo» |
| «Vincular a un trabajo» | fichas 13 y 14, botón bajo esa frase, y en su «⋯» |

Datos de la factura del proveedor: la ficha 14 pinta «Nº de factura del proveedor: A-QA/1156» y sólo esa fila (no se apuntó nada más); la 13 no tiene tarjeta. El «⋯», abierto: ficha 13 → Editar · 📷 Añadir la foto · Vincular a un trabajo · 🗑 Eliminar; ficha 14 → Editar · Ver la foto · Vincular a un trabajo · 🗑 Eliminar. A 390 sale como hoja inferior (capturas `visto-g13-menu-390.png`, `visto-g14-menu-390.png`).

### El historial (SCRUM-832), a 1280 y a 390

- Tocar la fila en la lista abre `#expenses-detail/13` y `#expenses-detail/14`, con la ficha y SIN el modal de edición.
- «Atrás» desde la ficha vuelve a `#expenses`.
- Recargar con `#expenses-detail/<id>` vuelve a pintar la ficha de ese gasto.
- `#expenses-detail/999999999` → `showToast('Ese gasto ya no existe.')` (llamada interceptada; a los 4 s ya no estaba en pantalla) y termina en `#expenses`, título «Gastos».
- Sin desborde horizontal, 0 errores de página y 0 peticiones que no fueran GET en la medida.

Capturas: `docs/master/evidencias/SCRUM-1156/visto-*.png` (fichas 13 y 14 a 390 y 1280, los dos «⋯» a 390, el id inexistente a 390, esta última con la cuenta todavía vacía).

### Visto y no es de esta ficha

- En la captura de página completa a 390 de la ficha 14, el botón flotante «?» de ayuda (global del panel) tapa media fila de «Nº de factura del proveedor». Es el botón de siempre, no algo de la ficha; queda dicho, sin ticket.
- El censo táctil todavía no mide la ficha: le falta su contrato en `scripts/_datos-del-censo.mjs` (carril de S3), apuntado en SCRUM-1560.
