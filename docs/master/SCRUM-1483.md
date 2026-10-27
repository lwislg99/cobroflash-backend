# SCRUM-1483 · La búsqueda manda el número hecho del presupuesto y busca por él, no por el id de la tabla

**Medido contra:** `origin/main` = `8f77f96dd12c0cc7cad87f94d166b58601741b5f` · 2026-10-06T18:03:38Z

A9: sin fallo que generalice — lo que se torció en la tanda (un `import` de `dist/` un nivel corto en el test, visto en el primer rojo) no llegó a ningún sitio que otro lea

Sesión S1 (`s1-6octg`) · rama `scrum-1483-la-busqueda-manda-y-busca-el-numero`. Lo abrió S2 con su
medición en yaqu.app; gemelo: SCRUM-1482 (S2), que pinta lo que llegue.

## El defecto

`GET /admin/search` (`src/modules/search/app/routes/search.routes.ts`), el servidor del buscador de
arriba del panel, trataba un presupuesto por su `id` de tabla:

- **no mandaba su número**: el `select` traía `id, status, total, currency, createdAt, customer`;
- **no buscaba por él**: un término numérico era `id: Number(q)`.

El `id` es de toda la plataforma. Medido por S2 (cuenta QA, build `f8da1ec8`): el buscador pintaba
«#205» para el presupuesto que la lista y la ficha llaman «#4». Y quien tecleara el «12» de su lista
encontraba el presupuesto cuyo id es 12, que es otro documento de su cuenta.

## El arreglo

| Qué | Dónde |
|---|---|
| `numeroVisibleDelPresupuesto({ quoteNumber, revision })` → `#12`, `#12.1`, o `null` sin número | `src/modules/quotes/domain/revision.ts` |
| `numeroBuscado(texto)` → lo que se teclea, leído al revés de como se escribe: `12`, `#12`, `12.1`, `#12.1` | el mismo fichero |
| La ruta pide `quoteNumber` y `revision`, responde `numeroVisible` y **no manda la secuencia en crudo** | `search.routes.ts` |
| La búsqueda por `id` de tabla se retira | `search.routes.ts` |

Lo que cambia en la respuesta, por presupuesto: entra `numeroVisible` (texto o `null`). `id` sigue:
es lo que abre la ficha. Nada más cambia; clientes y facturas salen como salían.

## Tres decisiones, y de dónde sale cada una

1. **El id de tabla deja de buscar** (aceptación 3). Sale del encargo del orquestador de la tanda
   («buscar por el número que el profesional VE, no por el id») y está escrita en el ticket antes de
   construir (c.18497). No es una firma del fundador. La aceptación 2 la exige de todos modos: con
   el id en el `OR`, «12» devuelve dos documentos.
2. **El texto es `#12`, no `P260012`.** Es una desviación declarada sobre SCRUM-1444, que decidió
   la serie. Motivos: la ficha y el papel dicen hoy `#12` y la aceptación 1 de SCRUM-1482 pide «el
   mismo número que su ficha»; el año de la serie no está guardado en la fila y una revisión no lo
   puede deducir (SCRUM-1444 c.18485); y así el id a la vista se puede retirar hoy. El cambio a la
   serie se hace en esa función, y con ella cambian a la vez las respuestas que la usen.
3. **Sin número, `null`**: ni raya ni el id (SCRUM-1444 c.18405, punto 2). Qué pinta el buscador en
   esa fila es texto de S2 y no está firmado.

## Cómo se ha medido

`tests/scrum1483-la-busqueda-manda-y-busca-el-numero.test.mjs`: 9 casos por la ruta real de `dist/`,
con los `findMany` doblados. El doble de presupuestos tiene tabla y **evalúa el `where`** (lanza con
una clave que no conoce): sin eso, buscar por id y buscar por número darían lo mismo. En la tabla el
nº 12 tiene id 500 y el id 12 es el nº 3; hay una segunda cuenta con el mismo número 12.

Seis mutantes, inyectados en `src/` de uno en uno con el `git diff --numstat` al lado; base 9 de 9
antes y después, árbol restaurado:

| Mutante | Casos que caen |
|---|---|
| vuelve a buscar por el id de la tabla | 5, 6, 7, 8 |
| la secuencia en crudo viaja | 3 |
| la revisión se llama como su original | 2, 9 |
| sin número pinta una raya | 4, 9 |
| la consulta pierde el merchant | 2, 5, 6, 8 |
| no manda `numeroVisible` | 2, 3, 4 |

Vecinos corridos después del último cambio de `src/`: 17 ficheros (`scrum1452`, `scrum1379*`,
`scrum1344`, `scrum409`, `scrum709`, `scrum553`, `scrum1415`, `scrum237`, `scrum1444*`, `scrum688`,
`scrum655`, `scrum836`), 261 casos, 0 fallos, 0 saltados.

## Lo que NO se ha hecho o no se ha podido medir

- **`npm run build` no se ha corrido en local, ni la tanda entera.** Memoria libre de la máquina
  entre 705 y 2.392 MB durante la tanda, y 1.382 al acabar; el umbral del equipo es 2.200. Los tests
  de arriba corren contra un `dist/` hecho transpilando los 317 `.ts` de `src/` uno a uno, sin
  comprobar tipos. **Los tipos se han comprobado sólo de lo tocado**: `tsc --noEmit` sobre
  `search.routes.ts`, `revision.ts` y lo que importan (5 ficheros de `src/`), salida 0; el mismo
  comando sin `src/types/express.d.ts` salió rojo con `req.merchantId`, así que sabe fallar. El
  resto de `src/` (quien importe `revision.ts`) lo comprueba el CI.
- **No visto en yaqu.app**: no está desplegado. Cuando lo esté, la aceptación 1 se ve con la sonda
  de S2 (`id-global.mjs`, columna «campos») y la 2 tecleando `#4` (dos caracteres: la cuenta QA no
  tiene números de dos cifras, y `#4` es lo que hace posible mirarlo).
- **La pantalla no cambia con este PR**: `globalSearch.js` sigue pintando `#${q2.id}` hasta
  SCRUM-1482.
- **El gemelo de la búsqueda, sin tocar:** la caja de la lista de presupuestos
  (`quoteAdmin.ts`, `listQuotesAdmin`) busca por `id` **y** por `quoteNumber`. Tiene el mismo cruce
  (teclear «12» devuelve el nº 12 y el de id 12). Es de S1 y no entra en la aceptación de este ticket.
- **El recorte del Técnico**: esta ruta devuelve presupuestos y facturas de todo el negocio a quien
  no es admin (fila 9 del censo de `docs/master/SCRUM-1390.md`). Leído, no ejecutado; va aparte.
