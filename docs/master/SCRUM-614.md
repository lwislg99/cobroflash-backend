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
