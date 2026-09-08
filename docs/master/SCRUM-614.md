# SCRUM-614 · El censo de rutas sin rol, y por qué `/admin/products` no era lo que yo dije

**Fecha:** 24-ago-2026 · **Carril:** B · **Gate:** sin gate — no entra código de producto

**Medido contra:** `origin/main` = `9b49190a7ab81be5c88a32b7745623ac78c8354f` · 2026-08-24T12:22:47+01:00

**Paso 0.** No existía rama ni worktree con este número (`git ls-remote --heads origin` completo).
`docs/master/SCRUM-614.md` no existía. Rama propia `scrum-614-censo-rutas-sin-rol`, nacida de
`origin/main`. `dist/` recompilado y cliente de Prisma verificado en sincronía antes de medir
(`_prisma-client-guard` y `_prisma-procedencia-guard`, los dos en verde).

**Nada de esto cambia una línea de producto.** No se ha añadido ningún `requireRole`, no se ha
tocado el borrado físico, no se ha borrado ningún producto, no se ha tocado `prisma/schema.prisma`,
ni la pantalla de Clientes, ni el formulario de documentos.

---

## 0 · LO PRIMERO: MI HALLAZGO DE AYER ERA CIERTO Y ESTABA INCOMPLETO

Ayer escribí, de rebote en SCRUM-613: «`/admin/products` se monta **sin `requireRole('admin')`**
(`src/app.ts:504`)». **El dato es correcto y la conclusión que sugiere es falsa.**

En este proyecto el rol de una ruta `/admin` **no vive sólo en el montaje**. Vive en uno de dos
sitios, y la red fail-closed de SCRUM-55 exige que esté en exactamente uno:

1. un `requireRole(...)` en el montaje, en un `router.use` o en la propia ruta, o
2. una entrada en `src/core/http/adminRouteDeclarations.ts` **con motivo escrito**.

`DELETE /admin/products/:id` está en el segundo sitio, declarada desde el 22-jul-2026:

> `{ method: 'DELETE', path: '/admin/products/:id', why: 'Simétrico del alta; una línea de catálogo, no el tarifario' }`
> — `src/core/http/adminRouteDeclarations.ts:127`

No es un olvido: es **una decisión de permisos tomada, escrita y defendida**. La defiende
`tests/scrum365-permisos-tarifario.test.mjs:124`, que se pone en ROJO si alguien le quita al
Operario el `POST`/`PUT`/`DELETE` de una línea suelta. Y SCRUM-365 la usó como criterio para cerrar
`import` y `load-catalog`: «línea suelta al presupuestar → Técnico; catálogo entero → Admin».

**Miré el montaje y di por medido el permiso.** El montaje es una de las dos mitades. Queda anotado
donde toca: un `app.use` sin gate no prueba que la ruta esté abierta por descuido, igual que un
`requireRole` escrito no prueba que la puerta esté cerrada (SCRUM-558, en sus dos direcciones).

---

## 1 · EL CENSO — cuántas rutas más están montadas sin comprobación de rol

Derivado, no a mano. Reusa **la misma enumeración** que la red fail-closed de SCRUM-55
(`tests/scrum55-admin-fail-closed.test.mjs`): montajes registrados por `mountAdmin` + rutas sueltas
de `app.router.stack`, leyendo el marcador `__requiredRole` que deja `requireRole`. Se reusa a
propósito: dos enumeraciones del mismo árbol divergen, y la que diverge en silencio es la que miente.

### Control del instrumento — en las dos direcciones, antes de dar ningún número

| comprobación | resultado |
|---|---|
| rutas `/admin` enumeradas | **154** |
| encuentra rutas **CON** `requireRole` | **81** ✅ |
| encuentra rutas **SIN** `requireRole` | **73** ✅ |
| rutas sueltas **NO** `/admin` vistas (otra clase, no se juzgan) | 6 |
| prefijos públicos declarados (`PUBLIC_PREFIXES`) | 18 |
| **suelo del encargo:** `DELETE /admin/products/:id` aparece sin rol de montaje | ✅ coincide con `app.ts:504` |

Si faltara cualquiera de las dos clases el censo se declara roto y sale con código 2. No hizo falta.

### El censo

| clase | qué es | nº | % |
|---|---|---|---|
| **A** | `/admin` **CON** `requireRole` — cerradas | **81** | 52,6 % |
| **B** | `/admin` **SIN** rol, **DECLARADAS** en `TECNICO_ALLOWED` con motivo | **60** | 39,0 % |
| **C** | `/admin` **SIN** rol, **APARCADAS** en `PENDIENTE_CLASIFICAR` | **13** | 8,4 % |
| **D** | `/admin` **SIN** rol y **SIN DECLARAR** | **0** | 0,0 % |
| | **total** | **154** | |

**El número que importa es D = 0**, y no es suerte: lo impide la red de SCRUM-55, que corre en
`npm test` sin gate. Una ruta nueva sin declaración nace ROJA.

**Y por eso no procede el «DILO Y PARA» del encargo.** 73 rutas sin `requireRole` suena a número
grande, pero no es una apertura descontrolada esperando a que alguien la descubra: **60 están
decididas con motivo por línea y 13 están aparcadas bajo trinquete** (`PENDIENTE_MAX = 13`, hoy al
límite exacto y sin holgura) **con fecha de caducidad `REVISAR_ANTES_DE = 2026-09-30`**, pasada la
cual el test falla solo. No hay nada que descubrir aquí: está censado desde julio.

**Las 13 aparcadas, que son lo único sin decidir** — y ninguna es de productos:

| tanda | rutas |
|---|---|
| 2 · economía del negocio | `GET /admin/metrics/{home,funnel,services,whatsapp,platform-funnel}` |
| 3 · configuración y datos en bloque | `GET/POST /admin/providers`, `PUT/DELETE /admin/providers/:id`, `GET/POST /admin/templates`, `PUT/DELETE /admin/templates/:id` |

### La familia `/admin/products` entera

| ruta | estado |
|---|---|
| `GET /admin/products` | 🟢 técnico, declarada — «S1: productos crear-ver ✅» |
| `POST /admin/products` | 🟢 técnico, declarada — «S1: productos crear-ver ✅» |
| `GET /admin/products/:id` | 🟢 técnico, declarada — «S1: productos crear-ver ✅» |
| `PUT /admin/products/:id` | 🟢 técnico, declarada — «Corregir un precio suelto al presupuestar» |
| `DELETE /admin/products/:id` | 🟢 técnico, declarada — «Simétrico del alta; una línea de catálogo, no el tarifario» |
| `GET /admin/products/autocomplete` | 🟢 técnico, declarada |
| `GET /admin/products/frequent-concepts` | 🟢 técnico, declarada |
| `GET /admin/products/ping` | 🟢 técnico, declarada |
| `GET /admin/products/export` | 🔒 `requireRole('admin')` (SCRUM-103) |
| `POST /admin/products/import` | 🔒 `requireRole('admin')` (SCRUM-365) |
| `POST /admin/products/load-catalog` | 🔒 `requireRole('admin')` (SCRUM-365) |

---

## 2 · LO QUE SCRUM-614 SÍ ES: LA PREMISA DE ESA DECISIÓN CADUCA CON DOC-08

El motivo escrito dice **«una línea de catálogo, no el tarifario»**. Esa frase describe lo que una
fila de `products` era en julio: un nombre y un precio de venta para autocompletar. DOC-08 + CAT-01
mueven **el coste y el margen fuera del documento y al catálogo**. En cuanto eso entre, una fila de
`products` deja de ser una línea de catálogo y pasa a ser **donde está escrito lo que gana el
merchant**. La decisión no se equivocó: se le caduca el supuesto debajo.

Y hay una parte que **no espera a DOC-08, porque ya pasa hoy**. Medido:

- **`Product.cost` ya existe** (`prisma/schema.prisma:606`) y **ya se sirve entero al técnico**:
  `listProducts` (`src/modules/products/domain/products.service.ts:45`) y `getProductById` (`:222`)
  usan `include`, **sin `select`** → devuelven **todas** las columnas, `cost` incluida. Las dos rutas
  están abiertas al técnico.
- **La pantalla lo pinta.** `public/dashboard/js/productsView.js:290` es una columna `Coste` en la
  cabecera de la tabla y `:434` la rellena; `:242` es el campo de alta y `:195` el de edición.
- **El nav de Catálogo NO se oculta al técnico.** `public/dashboard/js/app.js:104` oculta
  `nav-plans`, `nav-team`, `nav-export`, `settings` y `expenses`. Catálogo no está en la lista.
  El motivo escrito para ocultar Gastos es, literalmente, que «totales del mes y **margen** son
  economía del negocio» — y Catálogo ya enseña coste sin que ese criterio le llegara.
- **No hay gate por campo que lo tape.** `FIELD_LEVEL_ROLE_GATES`
  (`src/core/http/adminRouteDeclarations.ts:271`) tiene **una sola** entrada y es de
  `PATCH /admin/jobs/:id`. `roleCapabilities.ts` sólo conoce campos de Trabajo
  (`ADMIN_ONLY_JOB_FIELDS`). Sobre `cost` no hay nada.
- **Y la asimetría que lo remata:** `exportProductsCsv` (`products.service.ts:60`) lleva `select`
  explícito con `name, description, price, vat, isActive` — **sin `cost`**. O sea que el volcado del
  tarifario, que **sí** es admin-only, enseña MENOS que la lista, que está abierta. Lo protegido
  filtra el coste; lo abierto lo sirve.

**Traducido a P-DOC-3:** la pregunta «¿qué roles VEN coste y margen?» tiene hoy una respuesta de
hecho, y es «todos». Y sobre ella se apoya la de este ticket: el técnico no sólo lo ve — **puede
editarlo y puede borrar la fila entera**.

### Propuesta de roles — CON SU COSTE, Y SIN DECIDIR

Va pegada a P-DOC-3, que es decisión de negocio. Aquí está lo que cuesta cada una, medido.

| opción | qué hace | qué cuesta |
|---|---|---|
| **A · no tocar nada** | la familia sigue como está | tras DOC-08, el técnico ve, edita y borra el margen. Y hoy ya ve el coste. Deja P-DOC-3 respondida de hecho antes de que nadie la responda |
| **B · cerrar la familia entera con `requireRole('admin')`** | un solo gate en el montaje | **rompe a un merchant hoy**: se lleva por delante `PUT` («corregir un precio suelto al presupuestar») y el `autocomplete`, que son trabajo de campo declarado. Pone en rojo `tests/scrum365-permisos-tarifario.test.mjs:124`, que existe justo para impedirlo |
| **C · partir POR VERBO** — leer/crear/corregir siguen del técnico, `DELETE` pasa a admin | es el precedente de la casa **dos veces**: SCRUM-107 partió `/admin/expenses` por verbo y SCRUM-365 partió el tarifario en línea/bloque | un técnico que hoy borra una línea deja de poder. Toca mover la entrada de `TECNICO_ALLOWED` a un `requireRole` y ajustar el aserto de `scrum365`, que hoy exige lo contrario |
| **D · partir POR CAMPO** — la ruta sigue abierta, pero `cost` no se devuelve ni se acepta a un técnico | responde a P-DOC-3 sin tocar quién entra; precedente: `FIELD_LEVEL_ROLE_GATES` + `adminOnlyJobField` | es el **punto ciego declarado** de la red: un gate dentro del handler no deja marcador y la derivación no lo ve. Obliga a entrada en `FIELD_LEVEL_ROLE_GATES` y a su guard, o nace invisible |

**C y D son ortogonales, no alternativas:** C contesta «¿quién BORRA?», D contesta «¿quién VE el
margen?». Se pueden tomar por separado y en distinto orden.

---

## 3 · ¿DEBE SEGUIR EXISTIENDO EL BORRADO FÍSICO? — medido, y sin decidir

**Qué hace hoy cada botón, medido:**

| | «Desactivar» (`isActive`) | «Borrar» (`prisma.product.delete`) |
|---|---|---|
| sale del autocompletado del presupuesto | **SÍ** — `searchProducts` filtra `isActive: true` (`products.service.ts:202`) | sí |
| la fila sigue visible en Catálogo | sí — `listProducts` **no** filtra por `isActive` | no |
| conserva el `cost` | sí | **no** |
| **libera el nombre** | **NO** | **sí** |
| es reversible desde la interfaz | sí (botón «Activar») | no |

**La única función que el borrado físico cumple y «Desactivar» no es liberar el nombre**, y no es
teórica: `@@unique([merchantId, nameSearch])` (`prisma/schema.prisma:617`) no mira `isActive`, así
que un producto desactivado **sigue ocupando su nombre**. `createProduct` (`:27`) revienta contra la
única, y el importador CSV lo cuenta como `skipped` porque busca por `nameSearch` **sin** filtrar
por `isActive` (`products.service.ts:148`). Es decir: hoy nada empuja hacia la opción reversible, y
además la reversible tiene un efecto secundario que nadie ha decidido.

**Lo que cambia con DOC-08, y es lo que hace la pregunta urgente:** medido, `Product.cost` **no
aparece en ninguna vía de salida que el merchant pueda usar por sí mismo** — `exportProductsCsv` lo
excluye del `select`, `importProductsCsv` tampoco lo escribe, y los seis datasets de
`datos.zip`/`portabilidad.zip` (`seleccionExport.ts:19`) no incluyen productos en absoluto. Cuando el
margen viva sólo ahí, borrar una fila destruye el único registro del margen de ese producto **sin
ninguna vía por la que el merchant lo recupere**. Recuperarlo exigiría una restauración de la base
por plataforma, que es trabajo de R11, no un botón.

**Y el precedente de la casa NO se puede copiar tal cual.** `deleteProvider`
(`src/modules/providers/domain/providers.service.ts:64`) sí bloquea: cuenta `linkedProducts` y lanza
`provider_in_use`. Para producto **no hay a qué agarrarse** — es lo que medí ayer en P-DOC-5: cero
`productId` en el esquema, ningún documento referencia un producto. Un guard por referencias no
tendría nada que contar. Curiosamente eso deja al `Provider`, del que no cuelga nada fiscal,
protegido contra el borrado, y al `Product`, que va a guardar el margen, sin proteger.

### Propuesta — sin decidir

| opción | qué cuesta |
|---|---|
| **1 · dejar los dos botones como están** | tras DOC-08, un clic destruye el margen sin vuelta atrás y sin copia que el merchant pueda sacar |
| **2 · retirar «Borrar» y dejar sólo «Desactivar»** | cambio de comportamiento del producto (prohibido decidirlo aquí). Y deja el nombre ocupado para siempre: habría que decidir a la vez qué pasa con la `@@unique`, o el merchant no puede recrear un producto que desactivó |
| **3 · conservar los dos y que «Borrar» exija admin** | es la opción C del punto 2 vista desde aquí: el destructivo sube de rol, el reversible se queda donde está. No resuelve la irreversibilidad, sólo reduce quién la alcanza |
| **4 · conservar los dos y hacer reversible el borrado** (borrado lógico con nombre liberado) | toca `prisma/schema.prisma` (campo nuevo) → **diff y PARAR**. Es el único que cubre a la vez el nombre y el margen |

**No elijo ninguna.** La 2 y la 4 son cambios de comportamiento del producto y la 4 además toca
schema.

---

## Verificación — qué se ha comprobado y qué NO, y por qué

**Lo comprobado:** el instrumento del censo responde en las dos direcciones (81 con rol / 73 sin) y
cumple el suelo del encargo antes de dar un solo número; si le falla cualquiera de las dos clases,
sale con código 2 en vez de dar un censo.

**Lo NO comprobado, y se dice en voz alta:** el control que decide del encargo — «un usuario SIN el
rol que se decida NO puede alcanzar la ruta, por el camino real» — **no se ha ejecutado, porque no
hay rol decidido ni puerta cerrada que probar.** Los puntos 2 y 3 son «propón y para», así que aquí
no se ha cerrado nada. Ese control pertenece al PR que implemente la decisión del fundador, y su
forma ya existe en casa: `tests/tenancy-permisos.test.mjs` (A12.4) es quien ejercita el 403 real con
sesión de técnico, y está gateado tras `QA_DB_TEST=1`. Declararlo ahora como hecho sería exactamente
el verde que SCRUM-558 existe para impedir.

---

## Recuento de la suite

`npm test` sobre esta rama, 24-ago-2026:

**total 3934 · pass 3857 · fail 0 · skipped 77 · duration 56,1 s**

Los 77 saltos declaran su motivo, y el «0 fallos» no los incluye:

| saltos | motivo declarado |
|---|---|
| 65 | `sin QA_DB_TEST=1 · npm run test:staging:gated` |
| 9 | `sin LIBRO_PG_URL` (banco local / desechable) |
| 1 | `sin BOT_SUITE_TEST=1` |
| 1 | `sin A55_DB_TEST=1` |
| 1 | EPERM de Windows creando un enlace a fichero (el mismo mecanismo lo cubre un control positivo portable que sí corre) |

Entre los 65 gateados está `tenancy-permisos.test.mjs`, que es justo el que ejercitaría el control
real de rol. Mientras la decisión no exista, no hay nada que ejercitar en él.

---

# SCRUM-614 · APÉNDICE · La ejecución: el catálogo se cierra a escritura

**Fecha:** 24-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `61d35a741e92c0e987d70bc7dba5a0a8302a5630` · 2026-08-24T13:16:12+01:00

Lo de arriba era la MEDICIÓN. Esto es la EJECUCIÓN de las dos decisiones que salieron de ella:

1. **Del fundador:** el catálogo se cierra. El Operario **sólo ve**. Editar y borrar pasan a admin.
2. **Delegada al asesor:** se retira el borrado FÍSICO; «Desactivar» ocupa su lugar.

---

## 🔴 PASO 0 · NO SE PUEDE MEDIR DESDE UN ÁRBOL DE TRABAJO SI HAY OPERARIOS USANDO EL CATÁLOGO HOY

Va con estas palabras y va aquí, y no sólo en un informe de chat, porque **el cierre entra
sabiendo que va a ciegas** y eso tiene que verlo quien venga después.

La pregunta era la que yo mismo había hecho cara: cerrar la familia «rompe a un merchant que hoy
lo esté usando». Para saber si alguien lo usa hacen falta o autoría de la fila o rastro de la
acción. **No hay ninguna de las dos**, y son tres razones medidas, no una suposición:

- **`products` NO tiene columna de autoría.** Doce columnas, medidas contra las dos bases por
  `information_schema`: `id, merchant_id, name, name_search, description, price, cost,
  provider_id, is_active, created_at, updated_at` — ninguna dice **quién** creó la fila.
- **El módulo de productos NO llama a `recordAudit`.** No es una lectura del código a ojo: se
  comprobó contra las dos bases. `audit_log` registra **3** clases de acción en staging y **1** en
  dev, y **ninguna es de producto o catálogo**. El filtro no está ciego — sí ve lo que hay
  (`datos_exportados/export`, `albaran_editado/albaran`, `marcar_pagado_manual/invoice`).
- **Producción no es alcanzable desde un árbol de trabajo** (regla 3): no hay credencial de
  producción aquí y no la puede haber.

Y las dos bases que sí se alcanzan **no tienen ni la combinación que daría la evidencia**:
staging tiene 5 `team_members` —los cinco `tecnico`— y **0 productos**; dev tiene 8 productos y
**0 team_members**.

**Conclusión que se asume, no que se esconde:** no se ha podido comprobar si hoy hay operarios
creando, editando o borrando productos. El cierre se aplica igualmente porque la decisión es del
fundador y está tomada — pero se aplica **A CIEGAS sobre el uso real**, y si mañana un merchant
reporta que su técnico ya no puede tocar el catálogo, **esto es lo que hay que releer antes de
llamarlo regresión**: no es que nadie lo mirara, es que no había con qué.

---

## 1 · Los tres verbos, cerrados

`POST /admin/products`, `PUT /admin/products/:id` y `DELETE /admin/products/:id` exigen ahora
`requireRole('admin')` en `src/modules/products/app/routes/products.routes.ts`.

**La LECTURA no se toca**, y no es un resto: el fundador decidió el mismo día que coste y margen
los ven **todos** los roles. `GET /` y `GET /:id` siguen abiertos y siguen devolviendo `cost`.

**Y queda escrito lo que arrastra, porque desde fuera parece otro botón y no lo es:** «Desactivar»
es `PUT` con `{ isActive: false }`. Retirar un producto pasa a ser también de admin.

## 2 · El guard cambia de lado; no se relaja ni se borra

`tests/scrum365-permisos-tarifario.test.mjs` exigía que los tres verbos **siguieran** declarados
para el Operario. Ahora exige lo contrario, con la fecha, la decisión y la premisa caducada dentro
del propio test. Y se le añaden dos que no había:

- el **positivo** de que la LECTURA sigue abierta — cerrar de más y cerrar bien se ven igual de
  verde sin él;
- uno que comprueba el gate **en el router**, no sólo en el registro: sacar la entrada de la lista
  sin poner el gate deja la ruta abierta, y el rojo de la red de SCRUM-55 no distingue qué mitad
  falta.

## 3 · La derogación, escrita donde estaba la decisión

Las tres entradas de julio **no se han borrado**: están en el bloque de Productos de
`adminRouteDeclarations.ts`, con su texto original y con el porqué cambió — que es lo único que no
se puede reconstruir mirando el diff. Aquella decisión **era correcta** con la premisa de julio;
con DOC-08 la fila pasa a ser dónde está escrito el margen y se le fue el supuesto de debajo.

## 4 · 🛑 EL BORRADO FÍSICO NO SE HA RETIRADO — DIFF PREPARADO Y PARADA

Depende de que la unicidad mire `isActive`, y eso vive en `prisma/schema.prisma`, que es de los
fundadores. **El schema real no se ha tocado:** verificado con `Buffer.compare` contra los bytes de
disco de partida → `0`. El diff, generado con la herramienta de la casa sobre una copia:

```sql
DROP INDEX "products_merchant_id_name_search_key";
CREATE UNIQUE INDEX "products_merchant_id_name_search_is_active_key"
  ON "products"("merchant_id", "name_search", "is_active");
```

**Por qué no se retira antes de eso:** hoy `@@unique([merchantId, nameSearch])` no mira `isActive`,
así que un producto desactivado sigue ocupando su nombre; recrearlo revienta y el importador CSV lo
cuenta como `skipped`. Retirar el borrado ahora dejaría al merchant sin ninguna forma de liberar un
nombre: **sería cambiar un defecto por una trampa**.

⚠️ Y la opción del diff **no es la única ni es obviamente la buena**: `[merchantId, nameSearch,
isActive]` permite un activo y **un solo** inactivo con el mismo nombre, así que desactivar dos
veces ese nombre vuelve a chocar. Lo semánticamente correcto es un índice **parcial**
(`WHERE is_active`), que Prisma no sabe declarar en el schema y que por tanto viviría fuera de lo
que sincroniza el esquema. Es una decisión de diseño, y por eso se para aquí en vez de elegirla.

## 5 · Confirmado y NO arreglado

`exportProductsCsv` sigue con `select` de `name, description, price, vat, isActive` — **sin
`cost`**. Con «coste y margen los ven todos los roles», ese filtro oculta un campo que ya no hay que
ocultar. Se anota para que no se lea como intencionado; su arreglo no es de este ticket.

---

## El suelo, cumplido en dos tiempos y medido

Se exigía ver el guard **en rojo** antes de invertirlo. Salió, y en dos pasos distintos:

| paso | qué se tocó | qué se puso en rojo |
|---|---|---|
| A | `requireRole` en los tres verbos | **`scrum55-admin-fail-closed`** → «RUTA DECLARADA DOS VECES», nombrando `POST /admin/products`, `PUT …/:p` y `DELETE …/:p`. `scrum365` seguía **verde 7/7**: lee las declaraciones, que aún no se habían tocado |
| B | derogadas las tres entradas | **`scrum365`** → «🔴 POST /admin/products ya no está declarada para el Operario» |

O sea que el guard **sí vigilaba lo que dice vigilar**. Comprobado, no supuesto.

## Anotado, no es de este ticket

`cost` no sale en **ninguna** exportación del merchant — ni `exportProductsCsv` ni los seis
datasets del ZIP incluyen el catálogo. R11 dice que el merchant se lleva sus datos, y hoy se iría
sin sus costes ni sus márgenes. Es un hueco de portabilidad que existe con o sin esta decisión.

## Recuento de la suite

**total 3936 · pass 3859 · fail 0 · skipped 77**

| saltos | motivo declarado |
|---|---|
| 65 | `sin QA_DB_TEST=1 · npm run test:staging:gated` |
| 9 | `sin LIBRO_PG_URL` (banco local / desechable) |
| 1 | `sin BOT_SUITE_TEST=1` |
| 1 | `sin A55_DB_TEST=1` |
| 1 | EPERM de Windows creando un enlace a fichero (el mismo mecanismo lo cubre un control positivo portable que sí corre) |

---

# SCRUM-614 · APÉNDICE 2 · Retirado el borrado físico, y el Operario sólo ve

**Fecha:** 01-sep-2026 · **Carril:** B · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `aa9309e7bdf80717373d0273f1d03f01f2008b8c` · 2026-09-01T15:11:36+01:00

## Lo primero: este ticket ya estaba construido y sin mergear

El censo, el cierre de los tres verbos, el guard invertido y la derogación estaban **desde el
24-ago en esta misma rama**, empujados en `fa8e4096` y **sin mergear**. Se comprobó con
`ls-remote` y `merge-base` antes de tocar nada, que es lo que evitó rehacerlo: es el patrón de
SCRUM-367 —Jira decía «por hacer» y el remoto decía otra cosa— y el `ls-remote` manda.

Se trajo `main` (**89 commits**, merge limpio) y la suite siguió verde: el cierre sobrevive.

## Lo nuevo: el borrado físico se retira **de los tres sitios**

No sólo la ruta. Los tres, y el motivo del tercero es el que se olvida:

| sitio | qué se va |
|---|---|
| ruta | `DELETE /admin/products/:id` |
| **servicio** | **`deleteProduct` entero** |
| front | el botón «Borrar», su manejador y el `fetch` con `method: "DELETE"` |

**Por qué también la función:** un servicio de dominio sin llamadores pasa todos los tests, entra
verde y desde fuera es indistinguible de una función entregada — así se cerraron en falso
`cambiarFlagFiscal` y `borrarMerchant` (SCRUM-411). Dejar un `prisma.product.delete` huérfano es
dejar el borrado **a un `import` de distancia**.

**Y NO se sustituye por un borrado lógico en esa ruta.** «Desactivar» ya *es* `PUT /:id` con
`isActive: false`. Una segunda puerta que hiciera lo mismo sería otro sitio donde se decide lo
mismo — justo lo que esta semana lleva desmontando.

## El Operario sólo ve: **cero copy nuevo**

«Editar» y «Desactivar» se **vetan** para el técnico con `lockActionForRole`, el helper de
SCRUM-89, cuyo copy **ya está aprobado por el fundador** («Solo para administradores», 23-jul,
marcado *«NO reformular»*). Se veta en vez de ocultar, por el criterio que ya usan export/import en
esta misma pantalla: un botón que desaparece no explica nada.

**Consecuencia: el censo de marcadores NO sube.** No hace falta ningún `[PENDIENTE microcopy
oficial]`, porque no hay ningún texto nuevo.

⚠️ Y queda escrito lo que arrastra: **«Desactivar» es el MISMO verbo que «Editar»** (`PUT` con
`isActive`). Desde fuera parecen dos acciones; no lo son, y por eso se cierran juntas.

## 🛑 La consecuencia viva, que no se tapa

`@@unique([merchantId, nameSearch])` **NO mira `isActive`**. Un producto desactivado **sigue
ocupando su nombre**: recrearlo revienta y el importador CSV lo cuenta como `skipped`. Retirado el
borrado, **hoy no queda ninguna forma de liberar un nombre**.

El diff está **PREPARADO Y PARADO** — `prisma/schema.prisma` es de los fundadores:

```sql
DROP INDEX "products_merchant_id_name_search_key";
CREATE UNIQUE INDEX "products_merchant_id_name_search_is_active_key"
  ON "products"("merchant_id", "name_search", "is_active");
```

Y con su pega declarada, que sigue en pie: esa forma permite **un activo y UN SOLO inactivo** con
el mismo nombre, así que desactivar dos veces ese nombre vuelve a chocar. Lo correcto es un índice
**parcial** (`WHERE is_active`), que Prisma no sabe declarar y que por tanto viviría fuera de lo
que sincroniza el esquema. Es una decisión de diseño y no se toma aquí.

## Dos redes de la casa se atendieron. Ninguna se relajó.

- **SCRUM-337 · el censo de sitios de borrado.** Un sitio DESAPARECIÓ y el guard exige contestar su
  pregunta en el mismo commit: *¿este borrado se disparaba al vencer la prueba o por inactividad?*
  **No.** Era el botón manual del catálogo, sin relación con `trialExpired` ni con ningún cron.
  Sale de `BORRADOS_DECLARADOS` con esa respuesta escrita al lado.
- **El guard propio de SCRUM-614** pasa de exigir **tres** verbos con gate a exigir **dos**, y se le
  añade uno nuevo que comprueba que el borrado físico no quedó en **ninguno de los tres sitios**.

## El control

Árbol commiteado en **`a0fa770e`** antes de inyectar.

| | resultado |
|---|---|
| **Rojo por el mecanismo** · devolver `prisma.product.delete` al servicio | **el test CAE y lo nombra**: «queda un `prisma.product.delete` VIVO en el servicio: `await prisma.product.delete({ where: { id } });`» |
| reversión | `Buffer.compare(disco, testigo) === 0` |
| suite tras revertir | verde |

⚠️ **Y el test se cazó a sí mismo en el estreno**, que merece quedar escrito porque es la segunda
vez hoy: el comentario que explica la retirada **nombra `method: "DELETE"`**, así que el assert del
front salía rojo con el borrado ya quitado. Ahora mira el fichero **sin comentarios**, y lleva
**control positivo** (tiene que seguir viendo el `method: "POST"` que sí existe) para que quitar
comentarios no lo deje midiendo sobre un vacío.

## Lo que NO se ha podido ejecutar, y se dice

El control «un usuario SIN el rol no alcanza la ruta **por el camino real**» necesita servidor y
sesiones: en casa eso es `tests/tenancy-permisos.test.mjs`, **gateado tras `QA_DB_TEST=1`** contra
staging. **No se ha corrido en esta pasada.** Lo que sí está probado aquí es el gate ejercitado
—el middleware devuelve 403 a `tecnico`, `operario`, rol vacío, desconocido y ausente, y deja pasar
a `admin`— y que el botón ya no está en la pantalla. Queda declarado como hueco, no como hecho.

## Estado del árbol

- **Suite: total 4148 · pass 4069 · fail 0 · skipped 79**, medida en esta rama.
- `npm run guards:entrada` en verde.
- No se ha borrado ningún producto para comprobar nada, ni se ha tocado `prisma/schema.prisma`.
