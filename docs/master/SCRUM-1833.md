# SCRUM-1833a · medición y plan

**Medido contra:** `origin/main` = `f3b96b729d6a223c352f097e01f44fe2d9911982` · 2026-11-25T15:11:02Z

**Escribe:** J2 (`jv-j2fb`) · **Rama:** `scrum-1833-equipos-del-cliente-medicion` · **Carril:** J2, sólo
`docs/master/` (ni código, ni `prisma/schema.prisma`, ni `src/`, ni `public/`; nada contra ninguna base).
Pieza 2 de la versión 1.2 (SCRUM-1836). Luis la puso en el carril J2 (SCRUM-1835 c.22778, según el encargo
del orquestador; ese comentario NO lo he leído). Diseño de partida: `docs/master/SCRUM-914.md` (decisión C,
criterios 1-6 del ③, tramo 914d y apéndice de S1).

A9: sin fallo que generalice — tramo de sólo medición; lo que no medí va en la última sección, en la misma frase que lo que sí.

**Población.** Leído desde este árbol, que es `origin/main` (`git rev-list --count HEAD..origin/main` = 0).
Carriles con `node scripts/carriles.mjs de <ruta>`: 30 llamadas = 24 rutas que existen (las 24 con dueño), 5
con `--nueva` (4 con dueño; la del test la da «al puesto que trabaje el ticket», `docs/equipo/dos-equipos.md:171`)
y 1 errata mía de ruta («no existe»), re-medida con la buena. De Jira: SÓLO la descripción de SCRUM-1833 y la de SCRUM-1836,
por orden del encargo; sus comentarios NO.

## 1 · Qué existe

| pieza | medida |
|---|---|
| Modelo | `prisma/schema.prisma:1373-1395`, `model Equipment` → tabla `equipments`: `type` y `name` obligatorios; `brand`, `modelName`, `serialNumber`, `installedOn`, `warrantyUntil` (las dos fechas `DATE`) y `customerSiteId` opcionales. FK con RESTRICT sólo a `merchant` y `customer`; `customerSiteId` SIN FK. Leído, no tocado (regla 40). |
| `equipmentId` en documentos | opcional, sin FK, con índice, en `Job` (:1497), `MaintenancePlan` (:1522), `Albaran` (:1669) y `ParteTrabajo` (:1847). |
| ALTER | Aplicado en las tres bases según el registro: dev, por catálogo (`docs/MIGRATIONS_PENDING.md:2982`, lote de 7 con 914); staging y producción, por el fundador el 29-sep-2026 con verificación de 23 objetos (`docs/MIGRATIONS_PENDING.md:3056-3066`); y el comentario del esquema (`schema.prisma:1368-1369`) cita SCRUM-914 c.22434. **Las bases no las he mirado** (el encargo lo prohíbe). |
| `CustomerSite` | Existe (`schema.prisma:1335`). CRUD en `customersAdmin.routes.ts:473-541` (J2) con la lógica en `src/modules/system/domain/sitiosDelCliente.ts` (S1), y pestaña «Sitios» en la ficha (SCRUM-1145). |
| Los 4 ficheros de `src/` con `equipment` | `borradoMerchant.ts:115` (J3): `'equipment', 'customerSite'` antes de `customer` al borrar un comerciante. `anonimizarMerchant.ts:95` (J3): anonimiza `name` y `serialNumber`. `fusionClientes.ts:196` (S1): al fusionar dos clientes, pasa los equipos al principal. `albaranDuplicado.ts:58` (S1): `equipmentId` viaja al duplicar un albarán. Ninguno crea, edita ni borra un equipo: **0 rutas, 0 pantallas** (`grep -rn -i equipment src/` da esas 4 líneas más 6 de comentario en `borradoMerchant.ts`; el mismo barrido en `public/` da 4 ficheros, los 4 por la palabra `dos-equipos.md` dentro de un comentario). |
| La ficha del cliente | `customerDetailView.js:944-972` (J2) monta SIETE pestañas con un mismo `makeTab`: Presupuestos (n) · Facturas (n) · Trabajos (n) (si llega el historial) · WhatsApp (n) (si llega) · Sitios (sin número, la lista se pide al abrirla) · Notas (sólo admin) · Documentos (n) (si llega). `renderTab` (:983) pinta cada una dentro de un `data-card`. |
| Mantenimientos | módulo `src/modules/maintenance/` (S1) con rutas; en `public/dashboard/js/` no hay ninguna vista de mantenimientos por nombre (las 4 que dicen «mantenimiento» no las he leído por dentro). |

**Dos hallazgos de la medición** (ninguno con víctima hoy: no existe ninguna ruta que escriba `customerSiteId`):

1. **Criterio 1 de 914 sin cumplir.** `borrarSitio` (`sitiosDelCliente.ts:69-72`, S1) hace `deleteMany` del sitio
   y no pone a NULL `equipments.customer_site_id`. El día que un equipo pueda colgar de un sitio, borrar el sitio
   deja el equipo apuntando a un id que no existe. Es de S1: se declara a Luis (tramo S1-① abajo).
2. **Comentario caducado en mi carril.** `customerDetailView.js:104-106` dice que «ningún modelo apunta a
   `CustomerSite`» y que borrar un sitio no alcanza a nada guardado; desde 914d `Equipment.customerSiteId` le
   apunta. Lo corrige 1833c, que es quien hace verdad el cambio (en este tramo no se toca código).

## 2 · Qué falta, trozo a trozo, con su carril medido

| trozo | dónde iría | carril medido | nota |
|---|---|---|---|
| A · rutas CRUD `/admin/customers/:id/equipos` (listar, crear, editar, borrar) | `src/modules/system/app/routes/customersAdmin.routes.ts`, junto a las de Sitios y Documentos | **J2** | mismo patrón que Sitios: `cabeEnColumnaInt`, 404 si el cliente no es del merchant, códigos y no frases (como 1005b). |
| A · lógica (tenencia, validación, borrado) | `src/modules/system/customerAdmin.ts` | **J2** | un fichero NUEVO en `src/modules/system/domain/` o en `src/modules/system/` sería **S1** (medido con `--nueva`); por eso va en `customerAdmin.ts`, como la lógica de Documentos (1005b). El esquema de zod, ahí mismo: `src/core/validation/schemas.ts` es **S1**. |
| A · permisos del técnico | `src/core/http/adminRouteDeclarations.ts` | **S1** | cruce declarado de 4 líneas, sólo las de estas rutas, con la decisión de roles del fundador (precedente `147b4749b`, SCRUM-1005b, +3 líneas). |
| A · criterio 4 (borrar un equipo pone a NULL `equipment_id` en los 4 documentos, en la misma transacción) | `customerAdmin.ts` | **J2** | escribe en filas de `jobs`, `maintenance_plans`, `albaranes` y `partes_trabajo` desde un fichero J2: se declara a Luis en el PR. `equipmentId` no entra en el contenido sellado (criterio 6). `grep -rli trigger docs/sql/` = 0 de 17 ficheros con `CREATE TABLE` (control positivo): ningún disparador lo impediría, al menos ninguno escrito en `docs/sql/`. |
| A · criterio 2 (el sitio asignado es del mismo cliente y merchant) | `customerAdmin.ts` | **J2** | sólo si el fundador dice ✅ a P3. |
| B · pestaña «Equipos» en la ficha | `public/dashboard/js/customerDetailView.js` | **J2** | octava pestaña, detrás de «Sitios». Un módulo nuevo en `public/dashboard/js/` sería **S2** (`--nueva`): va dentro de la ficha, como Sitios, Notas y Documentos. |
| B · estilos | ninguno | — | reusa las clases `sitios-cliente__*`, como ya hace Documentos (`customerDetailView.js:241`). `public/dashboard/css/styles.css` es contenedor de **S2**: si hiciera falta una regla, bloque marcado y declarado. |
| C · al borrar un sitio, sus equipos a NULL (criterio 1) | `src/modules/system/domain/sitiosDelCliente.ts` | **S1** | **para Luis.** Precondición de que la pestaña deje elegir el sitio. |
| D · selector de equipo en trabajo, albarán y parte (+ criterio 5 en servidor) | servidor: `src/modules/jobs/domain/job.service.ts`, `albaran.service.ts`, `albaranEdicion.ts` · pantallas: `jobDetailView.js`, `jobNuevoModal.js`, `albaranDesdePresupuestoModal.js`, `parteOficinaView.js` (S2) y `albaranDetailView.js`, `parteDetailView.js` (S4) | **S1 + S2 + S4** | **para Luis.** No se cruza. |
| E · historial de trabajos por equipo | filtro por `equipmentId` en `src/modules/system/domain/historialDelCliente.ts` (**S1**: ahí vive el recorte del técnico; copiarlo en J2 serían dos anclas para la misma comprobación) + ruta en `customersAdmin.routes.ts` y pintado en la pestaña (**J2**) | **S1 + J2** | sin D, sale siempre vacío. |
| F · garantía | el campo `warrantyUntil` en el formulario y en la fila de la pestaña | **J2** (dentro de B) | «vencida» como pastilla sería un estado nuevo (regla 5): pregunta P5. |
| G · mantenimientos ligados al equipo | `src/modules/maintenance/` | **S1** | sin pantalla hoy. Pregunta P2. |
| Borrado, anonimizado, fusión, duplicado | — | — | hechos (914d + apéndice de S1). |

## 3 · Los textos nuevos que verá el usuario — TODOS a firmar por el fundador (regla 39)

Patrón: la pestaña «Sitios» (`customerDetailView.js:108-131`, SCRUM-1145 c.20592/c.20598) y «Documentos»
(`:183-194`, SCRUM-1005 c.22192). «Reusa» = el MISMO literal que ya está firmado en esas líneas; aun así va en la
tabla, porque una firma lo es para su pantalla (A7: que exista en otra no acredita que se firmara para ésta).

| clave | literal PROPUESTO | origen |
|---|---|---|
| pestaña | «Equipos» | nuevo · ⚠️ el menú ya dice «Equipo» por tu equipo de trabajo (`public/dashboard/index.html:194`, `teamView.js:40`): alternativa «Instalaciones» (P1) |
| botón alta | «+ Nuevo equipo» | nuevo, forma de `:111` («+ Nuevo sitio») |
| vacío | «Todavía no hay equipos guardados para este cliente.» | nuevo, forma de `:112` |
| campo `type` | «Tipo de equipo» | nuevo |
| ejemplo de tipo | «Caldera / Aire acondicionado / Cuadro eléctrico» | nuevo, forma de `:115` |
| campo `name` | «Nombre del equipo» | nuevo, forma de «Nombre del sitio» |
| ejemplo de nombre | «Caldera de la cocina» | nuevo |
| campo `brand` | «Marca» | nuevo |
| campo `modelName` | «Modelo» | nuevo |
| campo `serialNumber` | «Número de serie» | nuevo |
| campo `installedOn` | «Fecha de instalación» | nuevo |
| campo `warrantyUntil` | «Garantía hasta» | nuevo |
| campo `customerSiteId` (si P3 ✅) | «Sitio» · opción vacía «Sin sitio concreto» | nuevo |
| fila: garantía | «Garantía hasta {fecha}» | nuevo (P5) |
| fila: garantía pasada (si P5 ✅) | «Garantía vencida el {fecha}» | nuevo, sería estado |
| error: faltan obligatorios | «Escribe el tipo y el nombre del equipo.» | nuevo |
| error al cargar | «No se pudieron cargar los equipos guardados. Inténtalo de nuevo.» | nuevo, forma de `:130` |
| error genérico | «No se ha podido completar la acción. Vuelve a intentarlo.» | reusa `:131` |
| Editar · 🗑 Eliminar · Guardar · Cancelar | «Editar» · «🗑 Eliminar» · «Guardar» · «Cancelar» | reusa `:126-129` |
| confirmación de borrado | «¿Borrar el equipo "{nombre}"? Los trabajos ligados a él lo perderán de su historial. Esta acción no se puede deshacer.» | nuevo, forma de `:194` |
| historial (tramo E) · título | «Trabajos en este equipo» | nuevo |
| historial · vacío | «Todavía no hay trabajos ligados a este equipo.» | nuevo |
| selector en trabajo/albarán/parte (Luis) · rótulo y opción vacía | «Equipo» · «Sin equipo» | nuevo; lo usa S2/S4 |

## 4 · Preguntas ✅/❌ para el fundador (sólo las que cambian el plan)

- **P1 · Nombre de la pestaña.** ✅ «Equipos» (tu palabra en SCRUM-914) · ❌ «Instalaciones» (el menú ya dice «Equipo» por tu equipo de trabajo).
- **P2 · ¿Mantenimientos entra en la 1.2?** ❌ recomendado: sólo historial + garantía. Hoy no hay pantalla de mantenimientos; meterlo es otra pieza de S1 con su pantalla.
- **P3 · ¿El equipo puede colgar de un sitio en la 1.2?** ✅ = la pestaña deja elegir el sitio, y antes S1 cierra el criterio 1 (`borrarSitio` suelta los equipos) · ❌ = el equipo cuelga sólo del cliente y `customerSiteId` se queda vacío hasta otra versión (la 1.2 no depende de S1 para la pestaña).
- **P4 · ¿Quién borra un equipo?** ✅ sólo admin (como Documentos, c.22192: borrar uno lo desliga de su historial) · ❌ cualquiera (como Sitios). Ver, crear y editar: también el técnico en la obra, como Sitios y Documentos.
- **P5 · ¿La garantía pasada se pinta como estado?** ❌ recomendado: sólo la fecha («Garantía hasta …»), sin pastilla; ✅ = pastilla «Garantía vencida», que es un estado nuevo y pide cambio de master (regla 5).
- **P6 · ¿El selector de equipo en trabajo, albarán y parte entra en la 1.2?** ✅ recomendado: es de Luis (S1 + S2 + S4); sin él, el historial por equipo sale siempre vacío.

## 5 · Plan por tramos (cada uno de UNA sesión)

| tramo | qué hace | carril | depende de | qué lo prueba |
|---|---|---|---|---|
| **1833b** | rutas CRUD + lógica en `customerAdmin.ts` + 4 líneas de permisos (cruce S1 declarado) + criterio 4 (y 2 si P3 ✅) | J2 | P4 contestada. Sin textos: las rutas contestan códigos | test nuevo de 1833b: tenencia (otro merchant → 404), obligatorios (400), borrar desliga los 4 documentos en la misma transacción (rojo primero), permisos por rol; los casos de transacción real contra Postgres desechable, gateados (`LIBRO_PG_URL`) |
| **1833c** | pestaña «Equipos»: lista al abrirla, alta, edición, borrado con confirmación, garantía como fecha; corrige el comentario de `:104-106`; sin CSS nuevo | J2 | 1833b en `main` + firma de §3 (P1, P5) + P3 | piezas sin DOM de la pestaña (como `HISTORIAL_CLIENTE`) + recorrido de navegador a 390 y 1280 px con el checklist AB6 (vacío, error, carga, textos largos, técnico sin «Eliminar» si P4 ✅) |
| **S1-①** (para Luis) | `borrarSitio` pone a NULL `customer_site_id` de los equipos, en la misma transacción (criterio 1) | S1 | — | lo decide S1 |
| **S1/S2/S4-②** (para Luis) | selector de equipo en trabajo, albarán y parte + criterio 5 en servidor | S1 + S2 + S4 | 1833b en `main`, P6 ✅ | lo decide Luis |
| **1833d** | historial por equipo: S1 añade el filtro por `equipmentId` en `historialDelCliente.ts`; J2, la ruta y su pintado en la pestaña | S1 + J2 | ② en `main` | test de tenencia y del recorte del técnico con el filtro |

**UI (skill `yaqu-premium-ui` cargada antes de este plan).** La pestaña reusa el inventario de AB3 y los tokens
de `DESIGN.md` sin añadir ninguno: card de contenido (`data-card`), campos con rótulo encima y error en Peligro,
estado vacío, botones del inventario, objetivos ≥ 44 px, móvil primero. Una pantalla por cambio (la ficha), sin
rediseño. Si P5 fuera ✅, la pastilla saldría de las de `DESIGN.md` §5 y el estado iría antes al master.

## Lo que NO he medido

- Las bases: el ALTER «aplicado» es lo que dicen el registro y el esquema, no una consulta mía.
- Los comentarios de SCRUM-1833 y SCRUM-1836, y SCRUM-1835 c.22778 (el carril J2 lo da el encargo).
- Por dentro, las 4 vistas de `public/dashboard/js/` que dicen «mantenimiento».
- Si escribir `equipment_id` en un albarán o parte FIRMADO choca con algún test que vigile esas filas: lo mide
  1833b en rojo primero (en `docs/sql/` no hay disparadores).

# SCRUM-1833b · rutas y lógica

**Medido contra:** `origin/main` = `924c9b7ed6156a9c2516b8f10db650264037fcf5` · 2026-11-25T22:19:58Z

**Escribe:** J2 (`jv-j2fe`, segundo relevo; código de `jv-j2fd`, diseño de `jv-j2fc`) · **Rama:** `scrum-1833b-equipos-rutas-y-logica` · **Carril:** J2, con
cruce declarado J2→S1 en `src/core/http/adminRouteDeclarations.ts` (precedente `147b4749b`). Decisiones: SCRUM-1833 c.22811;
diseño: c.22817; traspaso de `jv-j2fd`: c.22819.

A9: aviso → cicatriz J2 «Me medí el contexto al arrancar y tras Jira, y no durante el reconocimiento» — no se pudo comprobar: el aviso a 200k del hook ya existe y llegó tarde; la medida es medirse antes de cada fase

El detalle de esa cicatriz, que antes iba pegado a ella: `jv-j2fc` pasó de 122k a 201k sin una línea de código; `jv-j2fd`
arrancó a 104k, leyó dos ficheros de test enteros por patrón, pasó de 116k a 156k en tres lecturas y paró a 184k sin empujar.

**🔴 Error de `jv-j2fd`, medido por `jv-j2fe`:** el rojo de `scrum1294` («el aviso no está LITERAL en `cicatrices/J2.md`»)
era de la cicatriz, no del guard. `leerCicatrices` toma como frase TODO lo que va entre `· ` y ` → sin comprobación:`
(menos un `(SCRUM-N)` final) y compara por IDENTIDAD: la frase del aviso era una subcadena de la cicatriz, que llevaba
el detalle de arriba detrás. Medido con la propia función del guard: antes `identica=false subcadena=true`; después
`identica=true`. Arreglo: la cicatriz se queda en la frase y el detalle viene aquí. El guard no se tocó.
Rojo primero: `scrum1294` 4 tests · 3 pass · 1 fail (`docs/master/SCRUM-1833.md:124`); después 4 · 4 · 0.

## Qué hay

- `src/modules/system/customerAdmin.ts`: `equipoCreateSchema` (`z.strictObject`: `customerSiteId` o `merchantId` → 400) y
  `equipoUpdateSchema` (`.partial()`); `type`/`name` trim 1-200; opcionales '' → null; fechas `YYYY-MM-DD` con `diaExiste`;
  `listarEquipos`, `crearEquipo` (tenencia con `clienteDelComercio`), `actualizarEquipo` (`updateMany` con merchant+cliente),
  `desligarYBorrarEquipo(tx, merchantId, customerId, equipoId)` (4 `updateMany` a NULL en job, maintenancePlan, albaran y
  parteTrabajo del comercio + `equipment.deleteMany`) y `borrarEquipo` en `prisma.$transaction`. El `updateMany` del parte
  va con el argumento LITERAL (`jv-j2fe`): con la variable compartida, `scrum1488` lo daba por OPACO.
- `src/modules/system/app/routes/customersAdmin.routes.ts`: `GET|POST /admin/customers/:id/equipos`,
  `PUT|DELETE /admin/customers/:id/equipos/:equipoId`; 400 `invalid_id`/`invalid_body`, 404 `not_found`, 200/201/204,
  500 `internal_error`; DELETE con `requireRole('admin')` (P4 ✅).
- **Cruce para Luis (S1):** 3 entradas en `TECNICO_ALLOWED` (GET, POST, PUT) + 2 líneas de comentario en
  `adminRouteDeclarations.ts`; el DELETE no. Escrituras nuevas en las 4 tablas de documentos: solo `equipmentId` → NULL,
  filtrado por `merchantId`.
- `tests/scrum1833b-equipos-rutas.test.mjs`: 6 casos sin gate (tenencia, obligatorios, permisos por rol, desligado,
  atomicidad con foto del doble).
- `tests/scrum1833b-equipos-postgres.test.mjs` (`jv-j2fe`): 1 caso gateado SOLO por `LIBRO_PG_URL` (no por `QA_DB_TEST`:
  crea un disparador, y eso no va contra staging). Un `BEFORE DELETE` en `equipments` rechaza el borrado de un equipo
  marcado → `borrarEquipo` falla y los 4 documentos siguen ligados; quitado el disparador, los desliga y borra el equipo.

Mutaciones: catálogo → `tests/scrum1833b-equipos-rutas.test.mjs`

Rojo primero (de `jv-j2fd`, c.22819): las 4 mutaciones del catálogo con `correr` + `aplicarUna` de
`scripts/meta-guard-mutaciones.mjs`; base 6 pasados · 0 caídos · 0 saltados; las 4 `ok:true`, 0 colaterales. El cambio de
`jv-j2fe` en `customerAdmin.ts` no toca ninguna de sus anclas (la línea del parte no está en el catálogo).

## Verdes (medidos por `jv-j2fe`, en este árbol, con `npm run build` CON tipos: salida 0)

- Tanda 1 (23 ficheros: 1294, 267, 854, 237, 976, 700, 824, 419, 719, 1185, 337, 55, los dos de 1833b, 1650c, 1677, 1360,
  1303, 1315, 1379b, 1379c, 1456, 1488): 312 tests · 306 pass · 5 fail · 1 skipped (el gateado). Los 5 rojos, abajo.
- Tras el arreglo del parte: 1488 + 1833b-rutas + 1294 + 1303 + 1315: 43 · 43 · 0 · 0.
- `npm run censo:mudez -- --escribir`: 149 fichas, 0 medidas ahora, `_veredicto-mudez.json` sin cambios.
- El gateado, sin base: 1 · 0 pass · 0 fail · 1 skipped, motivo LITERAL en la llamada:
  «sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI».

## ✅ Las tres declaraciones, hechas con el GO del fundador (SCRUM-1833 c.22828 ①) · relevo jv-j2ff

El relevo anterior no las tocó (el encargo lo prohibía y el clasificador denegó la de 337). Con el GO, las hace jv-j2ff,
en las líneas que pedía cada guard, y ningún guard se ha tocado fuera de ellas:

1. `tests/scrum337-aviso-atado-al-bloqueo.test.mjs` · `BORRADOS_DECLARADOS` += `'src/modules/system/customerAdmin.ts::equipment.deleteMany#1'`,
   CONTESTADA como la vecina de `attachment.deleteMany` (botón manual de admin, sin cron ni trial; precedente `147b4749b`).
   El borrado del cliente (abajo) NO añade un `#2`: reusa la misma llamada.
2. `tests/scrum419-ci-declara-lo-que-no-corre.test.mjs` · `GATEADOS_DECLARADOS` += `'scrum1833b-equipos-postgres.test.mjs': 1`.
   El total no se escribe a mano: `TOTAL_DECLARADO` lo suma (179 → 180).
3. `scripts/_sin-consumir-declarados.json` (**S0**, contenedor: bloque marcado `carril: J2`) += las 4 rutas
   (`customersAdmin.routes.ts:560/573/588/603`), motivo «las consume la pestaña Equipos de SCRUM-1833c».

Y **scrum189** (sin GO, no es declaración): `tests/scrum1833b-equipos-rutas.test.mjs:3` decía «Trampa 1 de c.22817», que
el guard lee como cita numerada a la doctrina sin `SUITE_REGRESION.md` al lado. Ahora dice «Primera trampa, la de
c.22817» (y «Segunda trampa» / «Primera trampa» en sus dos referencias). Guard sin tocar.

Los cuatro guards (337, 419, 1185, 189), antes y después, misma orden:
- ROJO antes: 31 tests · 26 pass · 5 fail · 0 skipped (los 5 `not ok` del run del CI: 1185 ①, 189, 337 capa ②, 419 ×2;
  419 decía «se declaran 179 tests sin ejecutar y hay 180»).
- VERDE después: 31 · 31 · 0 · 0.

## ✅ Borrar el cliente se lleva sus equipos (decisión del fundador, SCRUM-1833 c.22828 ②)

`borrarClienteYSusDocumentos` (`src/modules/system/customerAdmin.ts`, J2), que `deleteCustomer` llama dentro de
`prisma.$transaction`, busca los equipos del cliente (`equipment.findMany` con `merchantId` y `customerId`) y pasa cada
uno por `desligarYBorrarEquipo`, la MISMA función del botón de borrar un equipo: ninguna segunda copia del desligue
(los 4 documentos a NULL por `merchantId`, argumentos literales). Va ANTES de borrar la fila del cliente, por la FK
RESTRICT de `equipments.customer_id` (`docs/sql/scrum-914-equipos-del-cliente.sql:107`).

Test, en el mismo fichero (`tests/scrum1833b-equipos-rutas.test.mjs`): un cliente de A con 2 equipos, un trabajo y un
albarán ligados a uno de ellos, y un equipo de B → `deleteCustomer(A, cliente)` → los 2 equipos fuera, los documentos con
`equipmentId` NULL, el cliente borrado y el equipo de B intacto. El doble imita la FK RESTRICT en `customer.deleteMany`.
- ROJO antes del cambio: 7 tests · 6 pass · 1 fail, con el error «FK RESTRICT: equipments.customer_id».
- VERDE después: 7 · 7 · 0 · 0.

Mutaciones: catálogo → `tests/scrum1833b-equipos-rutas.test.mjs` (quitar el bucle de los equipos → cae «borrar el
cliente se lleva sus equipos»). Pasada con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`: base 7 pasados ·
0 caídos · 0 saltados; la mutación `ok:true`, 0 colaterales; el fuente, restaurado (el bucle sigue: 1 coincidencia).
**Error mío:** la primera pasada la lancé con `tests/` delante del nombre y `correr` ya lo pone (`tests\tests\…`): la base
salió 0 pasados y `aplicarUna` contestó CIEGO («ese test NO LLEGÓ»), no verde. Lo cazó el propio instrumento.

**Lectura de la fusión (S1, solo leída):** `src/modules/system/domain/fusionClientes.ts:196` mueve los equipos del
duplicado al principal (`equipment.updateMany` → `customerId: principalId`) y `:211` borra el duplicado con
`desvincularYBorrar`, NO con `deleteCustomer`: el cambio no le llega, y aunque le llegara ya no tendría equipos que borrar.
El comentario de `:210-211` dice «la MISMA función que usa `deleteCustomer`»: es `desvincularYBorrar`, que sigue igual.

## Lo que NO he medido

- La suite entera (el encargo la prohíbe).
- El caso gateado contra Postgres (`tests/scrum1833b-equipos-postgres.test.mjs`): no hay Postgres en la máquina; lo corre
  el CI con `LIBRO_PG_URL` ahora que 419 lo declara. Y no cubre el borrado del cliente: ese caso solo vive con el doble.
- Los sitios: borrar un cliente con sitios sigue dando 500 (FK RESTRICT, S1). Es hallazgo para Luis, no se cruza.
A9: comprobación → `tests/scrum1833b-equipos-rutas.test.mjs`

# SCRUM-1833c · pestaña «Equipos»

**Medido contra:** `origin/main` = `8e44c80f2b0a719f8724537cdd5bce30a848b8a2` · 2026-11-26T11:09:45Z

**Escribe:** J2 (`jv-j2fi`, relevo de cierre; código y test de `jv-j2fh`) · **Rama:** `scrum-1833c-pestana-equipos` · **Carril:** J2
(`public/dashboard/js/customerDetailView.js` → J2, `node scripts/carriles.mjs de`). Traspaso de `jv-j2fg`: SCRUM-1833 c.22834.

**Skill UI:** no cargada · el relevo `jv-j2fi` no tocó la interfaz (solo el test y este registro); si `jv-j2fh` la cargó al construir `5dacc0331` no consta en su commit, y no lo he medido.

A9: comprobación → `tests/scrum1833c-pestana-equipos.test.mjs`

## Qué hay

- `5dacc0331` (`jv-j2fh`): la pestaña entre las marcas `// SCRUM-1833c · INICIO/FIN` de `customerDetailView.js`
  (`EQUIPOS_CLIENTE`, `montarEquiposDelCliente`) y el comentario de :104-106 corregido; el test
  `tests/scrum1833c-pestana-equipos.test.mjs` (10 casos propios + 8 que entran por el import de scrum1773: 18); la ficha
  `docs/microcopy/2026-11-26-SCRUM-1833-equipos-del-cliente.md`.
- Commit de `jv-j2fi` encima, sin reescribir el de `jv-j2fh`: un positivo en el test (`t2` lleva «Split del salón»)
  antes de la negación `!t2.includes('Garantía hasta')`. Sin él, `scrum237` caía: «negación SIN NINGÚN respaldo»,
  `tests/scrum1833c-pestana-equipos.test.mjs:171`. El positivo de la fila 1 va en una plantilla y el analizador no lo
  cuenta como hermano. Ningún texto que ve el usuario cambia; ningún guard se ha tocado.

Mutaciones: catálogo → `tests/scrum1833c-pestana-equipos.test.mjs`

Las dos de `MUTACIONES_QUE_ME_TUMBAN`, pasadas por un mutador temporal fuera del árbol (base sin mutar: 18 pasan, 0 caen):
`puedeBorrarEquipo = true` → MUERE «TÉCNICO: no hay «🗑 Eliminar»»; el `confirm` quitado → MUERE «ADMIN: «🗑 Eliminar»
pregunta». Vivas 0 de 2; `git status` después, solo el cambio del test. Según el encargo, el «rojo primero» de `jv-j2fh`
salió CIEGO por no haber `dist/` en su árbol y lo sustituyó una mutación real; eso no lo he medido yo, sí lo de arriba.

## Decisiones aplicadas

- c.22811 (citadas del encargo; no he releído ese comentario): P1 la pestaña se llama «Equipos»; P3 sin campo sitio;
  P4 borrar, solo admin (el técnico ve, crea y edita); P5 la garantía se pinta como fecha, sin pastilla de estado.
- c.22837 (fundador, leída en Jira): las filas pintan la etiqueta firmada + «: » + el dato («Número de serie: X»).
  Respuesta literal: «1-Ok vale así». ✅ Queda como lo construyó `jv-j2fh`; ya no es pregunta abierta.

## Lo NO medido

- El recorrido de navegador a 390 y 1280 px (AB6) y yaqu.app: ver la entrega en SCRUM-1833.
- La suite entera (el encargo la prohíbe). `censo:mudez -- --escribir`: 0 medidos de 149; el test nuevo no cita
  el filtro de comentarios, así que no entra en su población y `tests/_veredicto-mudez.json` no cambia.
- `scrum1845`: no hay ningún `tests/scrum1845*`; para los 44 px corrí `scrum1850` y `scrum962f`.
