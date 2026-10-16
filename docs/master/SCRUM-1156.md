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
