# SCRUM-1571 · Borrar o editar el cliente de OTRO comercio contestaba «hecho» sin haber hecho nada

**Medido contra:** `origin/main` = `321ce160b0d53cfa7b5e16bed6214cd5e98e0923` · 2026-10-21T13:10:50Z (hora de GitHub al escribir: 2026-10-21T13:13:27Z)
A9: comprobación → `tests/scrum1571-cliente-ajeno-no-contesta-hecho.test.mjs`

Puesto J2 (`jv-j2p`) · árbol `j2p-1571` · rama `scrum-1571-borrar-ajeno-contesta-404`. Encargo del orquestador del
equipo de Javier (`cobroflash-backend-5f`). Carril J2: `customersAdmin.routes.ts` (`dos-equipos.md:125`). El ticket no
tenía comentarios al leerlo (21-oct, ~13:00Z): no hay decisión del fundador que citar, y no hacía falta ninguna: no
entra ningún texto nuevo (abajo).

## PASO 0

`git log origin/main --grep=1571` → nada de este ticket (salen el PR #1571 y dos commits que citan otros números).
`git log origin/main -- customersAdmin.routes.ts`: lo último es SCRUM-1456b (`3aa4aa39a`, valida el id con
`cabeEnColumnaInt`), que no mira el `count`. Sin `docs/master/SCRUM-1571*.md` ni rama en el remoto.

## El rojo, por la ruta real

El router de `dist/`, montado en Express con su `requireRole('admin')` y pedido por `node:http`; sesión doblada (comercio
2, admin) y base en memoria que casa el `where` por todos sus campos y devuelve el `count`. El reparto del ticket: cuatro
clientes del comercio 2 y el `5`, del 3. Sobre `67dde0caf`, **sin el arreglo**: 8 casos, **4 caen y 4 pasan**.

| petición | antes | después | filas |
|---|---|---|---|
| `DELETE /5` (ajeno) | **204** | **404 `not_found`** | no se borra nada, antes ni después |
| `DELETE /99` (no existe en ningún comercio) | **204** | **404 `not_found`** | nada |
| `DELETE /2` (propio) — control negativo | 204 | 204 | se borra el 2 y sólo el 2 |
| `PUT /5` y `PATCH /5` (ajeno) | **200, cuerpo `null`** | **404 `not_found`** | el 5 no cambia |
| `PUT /3` y `PATCH /3` (propio) — control negativo | 200 + fila | 200 + fila | el 3 cambia, el 5 no |

La separación entre comercios aguantaba antes y aguanta ahora (regla dura 2): lo que mentía era la respuesta.

⚠️ **Corrijo el encargo.** Decía «que conteste lo mismo que para un cliente que no existe: mira qué contesta HOY».
Medido: **hoy un id que no existe en ningún comercio también daba 204**, así que no había una respuesta del DELETE
que copiar. El 404 `{ error: 'not_found' }` es el que ya dan, **en el mismo fichero**, `GET /:id`, `GET /:id/detail` y
`DELETE /:id/sites/:siteId` cuando el `where` con `merchantId` no casa. Ajeno e inexistente siguen siendo indistinguibles
para quien pregunta, que era lo que pedía el punto 3 del ticket.

**Qué pieza trabaja:** quitando cada `if (count === 0)` del `dist`, uno cada vez, vuelven sus dos rojos y sólo esos
(el del handler de edición tumba PUT y PATCH ajenos; el del DELETE, el ajeno y el inexistente). Los 6 casos restantes
siguen en verde en las dos pasadas.

## El arreglo

`src/modules/system/app/routes/customersAdmin.routes.ts`, dos líneas de código:

- `DELETE /:id`: lee el `count` que `deleteCustomer` ya devolvía (`desvincularYBorrar` → `deleteMany`) y, si es 0, 404.
- `PUT`/`PATCH /:id` (un solo handler, SCRUM-1138): lee el `count` del `updateMany` de `updateCustomer` y, si es 0, 404.

`customerAdmin.ts` no se toca: los dos servicios ya devolvían el `count`; la ruta lo tiraba.

## El barrido de hermanos (punto 3 del ticket), con su población

- **Rutas `router.delete(` en `src/`: 7.** Seis ya contestaban 404 cuando no encontraban: gastos, proveedores,
  mantenimiento, equipo, plantillas y sitios del cliente. **La única que no era ésta.** Fuera de clientes no ha salido
  ninguna, ni de cobros ni de facturas ni de emisión, así que no hay nada que listar como STOP.
- **El resto de `customersAdmin.routes.ts`** (22 declaraciones `router.<verbo>(`): el hermano con el mismo patrón era `PUT`/`PATCH /:id`, y entra
  aquí. Las demás que escriben ya dicen la verdad: notas y portal (`customer_not_found` → 404), sitios (`null` → 404),
  `bulk-tags` (devuelve `actualizados` según lo encontrado), `fusion-preview` (contesta `bloqueada` con `null` en el
  ajeno) y `fusionar` (`cliente_no_encontrado` → **409**). **Si ese 409 debería ser 404 no lo cambio**: no afirma nada
  falso, y cambiarlo es una decisión sobre el contrato, no este defecto.
- **Sin medir:** las rutas que borran o editan por `POST`/`PUT` fuera de este fichero (facturas, presupuestos,
  trabajos…). Este barrido es de las `router.delete(` del repo y de las rutas de este fichero, no de todo `updateMany`.

## Qué pinta el panel con el código nuevo (regla 39: ningún texto nuevo)

- **`DELETE /admin/customers/:id`**: ninguna pantalla lo llama. Medido con control positivo: en `public/` hay 6 apariciones
  de `'DELETE'`/`"DELETE"`, 5 llamadas (gastos, proveedores, mantenimiento, equipo, plantillas) y un comentario de
  productos, y ninguna es a clientes. No cubre una llamada que construya el método con una variable. El DELETE de sitios tampoco lo llama nadie.
- **`PUT /admin/customers/:id`**, ficha de cliente (`customersView.js:1895`): antes, para un cliente que ya no está,
  pintaba «Cliente actualizado correctamente.», que era falso. Ahora el 404 no trae `message` y cae en el texto aprobado
  que ya existía, `AVISO_ERROR_GENERICO` («No se ha podido guardar el cliente. Revisa los datos e inténtalo de nuevo.»).
  La primera frase es verdad; «Revisa los datos» no es la causa, pero es el texto firmado y no se escribe otro.
- **`PUT`, bandeja de facturas** (`invoicesView.js:809`, tipo de destinatario): un 404 cae en su `catch` y pinta el
  marcador que ya tenía. Antes recargaba como si hubiera guardado.
- ⚠️ **`PATCH`, NIF antes de emitir** (`jobDetailView.js:3423`): antes, con el cliente ya borrado, la pantalla daba el NIF
  por guardado y seguía. Ahora cae en su `catch` y pinta «No hemos podido guardar el NIF en la ficha del cliente.
  Inténtalo otra vez.», que es verdad, y **no sigue**. **No he tocado esa pantalla ni nada del camino de emisión**: lo
  que cambia es la respuesta de una ruta de clientes. Lo digo porque cambia lo que hace esa pantalla en un caso raro
  (cliente borrado con la factura a medio preparar).

## Tests

- **Nuevo:** `tests/scrum1571-cliente-ajeno-no-contesta-hecho.test.mjs`: 8 casos, sin base y sin saltos (corre igual
  en local y en CI). El primero es el control del banco: con SU comercio, la fila ajena se edita y se borra; si no, «no se
  borró» sería ceguera del doble y no la regla 2.
- **Tocado:** `tests/scrum1456-ids-que-no-caben-en-la-columna.test.mjs`, el control «un id CORRECTO sigue llegando al
  borrado y contesta 204». Pedía 204 con la base **vacía** (`deleteMany` → `count: 0`): afirmaba justo el defecto de este
  ticket. Ahora siembra la fila (`{ 'customer.deleteMany': { count: 1 } }`) y **la aserción sigue siendo 204**. No se
  relaja nada (regla 41): se le da el dato que el título del caso ya suponía.
- **Pasadas locales** (`tsc --noCheck`, el árbol no trae `dist/`), sobre la rama mergeada con `321ce160b`: mi test
  más `scrum1456`, `scrum1415`, `scrum237`, `scrum812` y `scrum976` → 101 casos, 100 pasan y **1 cae: `scrum1415`, por mí**
  (abajo). Arreglado → `scrum1415` + el mío, 14 de 14. Antes del merge, los 8 ficheros de clientes que pasan por estas
  rutas (`scrum1571`, `1456`, `1138`, `1199`, `1057`, `1291`, `983`, `615`): 101 casos, 99 pasan y 2 caen, los dos de
  `scrum1199` por `MODULE_NOT_FOUND` (busca `express` en `<árbol>/node_modules`, y este árbol no lo tiene). Con una copia
  temporal que resuelve `express` por el `require` normal, ya borrada: 4 de 4. Su `PUT /5` cae en Zod (400) antes del
  `updateMany`, así que el 404 no le alcanza.
- **No corrida en local:** la tanda completa. La lee el check obligatorio del PR.

## Lo que hice mal

El test nuevo construía en un bucle (`${verbo}`) los nombres de los cuatro casos de PUT/PATCH, y `scrum1415` lo cazó en
local. **Es la misma línea que dejé en mis cicatrices el 13-oct** (SCRUM-1522b), con la comprobación al lado. Esta vez
la comprobación funcionó porque **la corrí antes de empujar**: esa es la diferencia con el 13-oct, no que me acordara.
No añado otra cicatriz: el guard ya existe y es el que me paró.

# SCRUM-1571b · ¿Dónde más se contesta «hecho» sin haber hecho nada en un recurso de OTRO comercio?

**Medido contra:** `origin/main` = `5dcc9fe1e7b9e097d6a697203e3326bfcee6aa9d` · 2026-10-21T14:22:31Z (hora de GitHub)
A9: comprobación → `tests/scrum1571b-escritura-ajena-no-contesta-hecho.test.mjs`

Puesto J2 (`jv-j2q`) · árbol `j2q-1571b` · rama `scrum-1571b-escrituras-ajenas-404`. Encargo del orquestador
`cobroflash-backend-5f`: el «NO medido» de SCRUM-1571 (ediciones y borrados fuera de `customersAdmin`).
Jira no respondía al arrancar (el MCP de Atlassian seguía conectando); el encargo dice que todo está en el repo.

## PASO 0

`git log origin/main --grep=1571` → sólo SCRUM-1571 (#2640). Ni rama `scrum-1571[a-z]-` en el remoto ni tramo 1571b.

## El censo (por AST, no grep)

`tests/_censo-escrituras-sobre-id.mjs`: compila `src/` con TypeScript, toma toda llamada
`<x>.delete|put|patch|post('/<ruta literal>', …)`, sigue con el checker las funciones de `src/` que llaman sus
manejadores (hasta 4 niveles) y recoge cada `updateMany`/`deleteMany`: si su `where` nombra `merchantId` y qué
se hace con el resultado (`count leído`, `devuelto`, `tirado`, `en $transaction`). SOSPECHOSA = escritura con
`merchantId` cuyo resultado se tira o se devuelve, sin `.count` leído en la cadena y sin `404`/`'not_found'` en
el manejador ni en lo que llama directamente.

**Población:** 328 ficheros `.ts` de `src/` · 128 rutas · **80 sobre un `:id`/`:token`** · 14 alcanzan un
`updateMany`/`deleteMany` con `merchantId` · **0 sospechosas**. Control positivo SEMBRADO: una ruta fabricada
(`DELETE /semilla/:id`, fichero que no existe en el árbol) con el defecto → SOSPECHOSA; quitándola, el censo dice
CIEGO (sale 2), no verde. Rojo con defecto REAL: quitando cada `if (count === 0)` de SCRUM-1571 en
`customersAdmin.routes.ts` (commit `51a4183a4`, `git diff --numstat` 1/2 cada vez), el test cae y nombra
`DELETE /:id` en un caso y `PUT /:id` + `PATCH /:id` en el otro; restaurado con `git restore --source=HEAD`.

Las 14 con escritura, revisadas a mano: 5 son de clientes — las 3 de 1571 y `DELETE /:id/sites/:siteId`, con 404,
y `POST /:id/fusionar`, que lee el `count` y contesta 409 `cliente_no_encontrado` (lo dejó así 1571); `PUT /admin/expenses/:id`
tira el `count` de `provider.updateMany`, pero es el NIF del proveedor de lado (SCRUM-937), no la escritura del
gasto. Las demás leen el `count` y contestan 404. Las 5 con escritura SIN `merchantId` en el `where`
(asignados de trabajos y documentos, sesiones del equipo, supresión) llevan 404 en el manejador según el censo;
leído sólo el del equipo: `findFirst` con `merchantId` → `member_not_found` antes del borrado.

Sobre `:id` sin `404` ni `'not_found'` (criterio final, nivel ≤ 1): **7** — 4 de `dev.routes` (desarrollo),
`POST /:id/fusionar` (409, arriba) y 2 de S1: `POST /quote/:token/reject` (por token) y `app.ts:574`, que es sólo
el montaje de `requireActivePlan`. Con el primer criterio (sólo el `404` numérico del manejador) eran 16: las 9
de más son albaranes y partes, que contestan `not_found` con `found.status` de un ayudante (leídas a mano).

## Lo que contesta cada carril (lista; nada tocado fuera del mío)

Recontado con el censo por fichero (80 en total; «sin 404» = sin `404` ni `'not_found'` a nivel ≤ 1):

| carril | rutas sobre `:id` | sin 404 | sospechosas |
|---|---|---|---|
| **J2** clientes (`customersAdmin`, `customerPortal`) | 9 | 1 (`fusionar`, 409) | 0 |
| **J2** cobros (`chargesAdmin`, `payBizum`, `receipt`) — STOP, sólo lista | 5 | 0 | 0 |
| **J1** facturas (`invoicesAdmin`, `invoice.routes`) — STOP, sólo lista | 13 | 0 | 0 |
| **J3** supresión | 1 | 0 | 0 |
| **S1**, equipo de Luis (quotes, jobs, albaranes, partes, expenses, providers, products, maintenance, team, templates, quoteRequests, landing) y `app.ts` | 47 | 2 | 0 |
| `dev.routes` | 5 | 4 | 0 |

En cobros, además, lo leí: `confirm-bizum`, `garantia` y `garantia/liberar` hacen `findFirst` con el comercio → 404;
`payBizum` y `receipt` van por token → 404. Facturas no la he leído ruta a ruta: lo que digo es lo del censo.

**No hay nada que arreglar en mi carril**: el único caso real era el de SCRUM-1571, ya en `main`. El test queda
como comprobación para todo `src/`, para que el patrón no vuelva en una ruta nueva de ningún carril.

## Lo que NO mide (dicho en la misma frase que lo que sí)

- **«200 con cuerpo `null`»** sin `updateMany` (un `findFirst` que devuelve `null` y la ruta lo pinta): no lo
  censa; lo revisé a mano sólo en las 16 rutas sin 404 numérico en el manejador, no en las otras 64.
- Rutas con camino no literal o montadas de otra forma (`router.route(…)`): 0 por grep, con su positivo
  (127 llamadas con camino literal por el mismo grep). `update`/`delete` por clave única no entran: un id
  ajeno ahí es un `P2025` (500), no un «hecho».
- El criterio de 404 es de texto en el AST: un `404` en lo que el manejador llama directamente cuenta como
  «contesta 404» aunque sea de otra rama del código. Es un falso negativo posible, no medido.

## Tests

`tests/scrum1571b-escritura-ajena-no-contesta-hecho.test.mjs`: 4 casos, sin base ni saltos, ~8 s (compila `src/`
con TypeScript; no lee `dist/`). Nombres literales (scrum1415).

## Lo que hice mal

La primera pasada del censo dijo «81 sobre un `:id`» y «15 con escritura»: contaba la ruta sembrada. Son 80 y 14.
Lo vi al repasar el JSON, antes de escribir aquí; la salida a mano ahora lo avisa en su primera línea. Y mi primer
criterio de 404 miraba sólo el manejador, lo que habría dado sospechosas en albaranes y partes, que contestan
`not_found` desde un ayudante: lo ensanché al nivel 1, y eso abre el falso negativo de arriba. Y la primera versión
de este registro llevaba una tabla por carril con cifras escritas sin recontar (S1 decía 46; son 47) y frases de
«`findFirst` → 404» para rutas que no había leído: la rehice con el censo por fichero antes de empujar.

# SCRUM-1571c · «200 con cuerpo null»: la lectura que no encuentra y se manda igual

**Medido contra:** `origin/main` = `f53289026390853176eb2d8ba4ad2bbd51bc9d6d` · 2026-10-21T14:34:50Z (hora de GitHub)
A9: comprobación → `tests/scrum1571c-lectura-ajena-no-contesta-null.test.mjs`

Puesto J2 (`jv-j2r`) · árbol `j2r-1571c` · rama `scrum-1571c-findfirst-null-404`, nacida de la de 1571b
(`413057ea2`, PR #2650, abierto y sin mergear al medir) con `origin/main` mergeado encima. Encargo del orquestador
`cobroflash-backend-5f`: el primer «NO mide» de 1571b. Jira no conectó (el MCP de Atlassian dio `CONNECT_TIMEOUT`):
no he leído el ticket ni sus comentarios; trabajo sobre el encargo y el repo.

## PASO 0

`git log origin/main --grep=1571` → sólo SCRUM-1571 (#2640). En el remoto, sólo `scrum-1571b-escrituras-ajenas-404`.
Ningún tramo 1571c. El defecto existe hoy: el rojo de abajo, sobre `e1a83b2a4` (antes del arreglo).

## El censo: el MISMO de 1571b, ampliado

`tests/_censo-escrituras-sobre-id.mjs`, bloque 1571c (no un censo nuevo). Toma toda ruta
`get|delete|put|patch|post('/<literal con :>', …)` y, en cada manejador (función en línea o importada, resuelta por
el checker), mira lo que decide el CUERPO de cada `res.json(…)`/`res.send(…)`: el argumento entero, un objeto literal
de UNA sola propiedad (`{ ...v }` → `{}`, `{ v }` → `{ v: null }`) y la izquierda de `v || {}` / `v ?? {}`. Es
SOSPECHOSA si ese valor es ANULABLE —sale de un `findFirst`/`findUnique` cuyo primer argumento nombra `merchantId`,
de una función de `src/` que lo devuelve (hasta 4 niveles), o de un `c ? x : null`— y la variable no se MIRA en el
manejador (`!v`, `==`/`===`/`!=`/`!==`, condición de `if` o de `? :`, izquierda de `&&`, `||` o `??` salvo `|| {}`).

**Población** (sin semilla): 328 ficheros · **119 rutas sobre un `:id`/`:token`** (39 GET + las 80 de 1571b) · 119
con manejador legible, 0 sin él · 44 con `findFirst`/`findUnique` + `merchantId` en el propio manejador ·
**SOSPECHOSAS antes del arreglo: 2** (`PUT` y `PATCH /admin/customers/:id`) · **después: 0**.

**Controles SEMBRADOS** (en el fichero que no existe en el árbol, el mismo de 1571b): `GET /semilla/:id` (manda el
`findFirst` tal cual) y `GET /semilla/:id/servicio` (lo lee un servicio y manda `{ ...fila }`) tienen que salir
SOSPECHOSAS; `GET /semilla/:id/con-404` (la misma lectura con su `if (!fila) 404`) tiene que salir callada. Sin la
semilla, `lectura.semillaVista` es `false` y la salida a mano dice CIEGO y sale 2 (medido).

La primera pasada daba 8 sospechosas: 6 eran objetos de varias propiedades con un dato opcional dentro
(`customer: job ? {…} : null` en albaranes, la decisión del presupuesto, el pago de la factura, `portalUrl` en la
ficha del cliente). No es un 200 vacío: el cuerpo lleva algo. Por eso el criterio mira sólo lo que decide el cuerpo.

## El rojo, por la ruta real

`PUT`/`PATCH /admin/customers/:id` miran el `count` del `updateMany` desde SCRUM-1571, pero después RELEEN el cliente
con `getCustomer` (`findFirst` + `merchantId`) y lo mandan sin mirarlo. Si otra petición lo borra entre las dos
consultas, contestan `200` con `null`. El banco provoca esa carrera (el `updateMany` doblado borra la fila que acaba
de tocar) contra el router de `dist/` montado en Express y pedido por `node:http`, con el arnés de SCRUM-1571.
Sobre `e1a83b2a4`: **9 casos, 6 pasan, 3 caen** — el censo (nombra las dos rutas) y los dos casos de la carrera,
`🔴 contesta 200 con «null»`. Los controles del banco (la misma edición sin carrera → 200 con la fila) pasan.

## El arreglo

`customersAdmin.routes.ts`, una línea: `if (!updated) return res.status(404).json({ error: 'not_found' })`. Es el
mismo 404 que ya contestan `GET /:id` y la propia ruta cuando el `count` es 0: ningún texto nuevo (regla 39).
Con él: 21 de 21 en `scrum1571`, `scrum1571b` y `scrum1571c`, 0 saltos.

## Lo que contesta cada carril (lista; nada tocado fuera del mío)

Recontado con el censo por fichero: 119 rutas sobre `:id`, 44 con lectura + `merchantId` en el manejador,
**0 sospechosas en todos los carriles** tras el arreglo. Por carril (rutas / con lectura): **J2** clientes
(`customersAdmin`, `customerPortal`) 18 / 2; **J2** cobros (`chargesAdmin`, `payBank`, `payBizum`, `payCard`,
`payInvoice`, `payMp`, `receipt`) 13 / 3, STOP, sólo lista; **J1** facturas (`invoicesAdmin`, `invoice.routes`)
16 / 9, STOP, sólo lista; **J3** supresión 1 / 1; **S1**, equipo de Luis (quotes, quotesAdmin, quoteDecisionLanding,
jobs, albaranes, albaranPublic, partes, expenses, providers, products, maintenance, team, templates,
quoteRequests, attachments, publicProfile) y `app.ts` 66 / 29; `dev.routes` 5 / 0. Nada que pasar a nadie.

## El falso negativo del 404 indirecto (el segundo «NO mide» de 1571b)

Con el criterio de escrituras: de las 14 rutas con `updateMany`/`deleteMany` + `merchantId`, **4** no leen `.count`
y se salvan SÓLO por tener un `404` en el texto: `PUT`, `PATCH` y `DELETE /admin/customers/:id` y
`PUT /admin/expenses/:id`. Leídas a mano las 4: las tres de clientes leen el `count` por desestructuración
(`const { count } = …; if (count === 0) 404`, que el censo no cuenta como lectura) y su 404 es el de verdad; el
`updateMany` que tira el `DELETE` es el de desvincular la empresa (`customerAdmin.ts`, 0 filas es lo normal), y el de
gastos es el NIF del proveedor (SCRUM-937, ya dicho en 1571b). **Falsos negativos medidos: 0 de 4.** No cambié el
criterio para que cuente la desestructuración: entonces quitar sólo el `if (count === 0)` dejaría de dar rojo, que
es la mutación con la que 1571b demostró su test.

## Lo que NO mide (dicho en la misma frase que lo que sí)

- Un `where` en una variable (`findFirst({ where })`) no se ve con `merchantId`: no cuenta como lectura anulable.
- «Mirado» es por nombre en todo el manejador, sin orden: un `if (v)` DESPUÉS del envío lo da por mirado.
- Un anulable que es una propiedad entre varias, o que pasa por una función que lo formatea, no cuenta.
- Lo que el manejador manda desde una función a la que le pasa `res`, no lo ve: sólo los envíos de su propio cuerpo.
- La carrera de `PUT`/`PATCH` está probada con un banco doblado, no con dos peticiones contra Postgres.

## Tests

`tests/scrum1571c-lectura-ajena-no-contesta-null.test.mjs`: 9 casos, sin base ni saltos (el censo compila `src/`;
la carrera usa `dist/`). Nombres literales (scrum1415).

## Lo que hice mal

Mi primer criterio contaba como «200 con null» cualquier anulable dentro del objeto que se manda, y dio 6
sospechosas falsas de S1 y J1 que habría listado como hallazgos para otros carriles. Lo vi al leer las 8 antes de
escribir nada: el defecto del ticket es el cuerpo vacío, no un campo opcional. Y no leí Jira: el MCP no conectó.
