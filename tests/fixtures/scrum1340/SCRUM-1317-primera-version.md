# SCRUM-1317 · Se le cierran al operario las rutas /admin que SCRUM-55 dejó aparcadas, y antes se le da un Inicio propio

**Medido contra:** `origin/main` = `bee39d3b51e300ff4efdda3befcb1eff4626f988` · 2026-10-01T06:10:12Z

1-oct-2026 · **J4c** (equipo de Javier), por encargo del orquestador (`cobroflash-backend-5b`).
[Escrito por J4c. Las frases del fundador las transcribe el orquestador en Jira; aquí se citan de allí.]

- Cerrarlas: SCRUM-1317, descripción. **Javier, 30-sep-2026: «2-Sí ciérralas de verdad, estamos con contexto fresco da igual la hora».**
- Qué ve el operario en Inicio: SCRUM-1337, descripción. **Javier, 1-oct-2026: «Sí el operario ve la actividad de sus compañeros»**, y la firma del cambio de máster, **«1-Firmo»**.

A9: comprobación → `tests/scrum1317-productos-del-operario.test.mjs`

## Qué había

SCRUM-55 dejó 13 rutas en `PENDIENTE_CLASIFICAR` (`src/core/http/adminRouteDeclarations.ts`): sin
rol declarado y abiertas al operario. El plazo de la lista venció el 30-sep y se movió al 1-nov
(SCRUM-1318) porque cerrarlas era este ticket.

Las 13, **corridas** con sesión de operario —routers reales de `dist/`, `req.userRole` inyectado,
la base doblada—:

| Ruta | Operario, antes | Qué sirve |
|---|---|---|
| `GET /admin/metrics/home` | 200 | 16 campos; 9 son dinero del negocio |
| `GET /admin/metrics/funnel` | 200 | embudo comercial |
| `GET /admin/metrics/services` | 200 | servicios, con ingresos |
| `GET /admin/metrics/whatsapp` | 200 | coste y entrega de WhatsApp |
| `GET /admin/metrics/platform-funnel` | 403 | embudo de plataforma |
| `GET /admin/providers` | 200 | la fila entera de `Provider` |
| `POST`, `PUT`, `DELETE /admin/providers` | pasan (llegan a la base) | gestión de proveedores |
| `GET /admin/templates` | 200 | `QuoteTemplate`: plantillas de **presupuesto**, con líneas y precios |
| `POST /admin/templates` | 201 | crear plantilla |
| `PUT`, `DELETE /admin/templates/:id` | 200 | renombrar y borrar |

Las 13 existen. **12 dejaban pasar al operario.** Control del arnés: `GET /admin/metrics/team`, que
ya exigía admin, daba 403 con la misma sesión.

## Por qué no era un `requireRole` y ya

Cerrarlas sin más dejaba al operario fuera del producto por tres sitios, y los tres se soltaron
**antes** del cierre:

1. **`/admin/metrics/home` era su Inicio** (`homeView.js`) y la fuente de los globos del menú.
2. **`/admin/providers` tumbaba su lista de Productos**: `productsView.js` pedía productos y
   proveedores en un mismo `Promise.all`, y el 403 de proveedores se llevaba la lista entera. No
   estaba en el enunciado; salió al medir.
3. **Botones y entradas de menú hacia un 403**: «Guardar como plantilla» en el editor, «Renombrar»
   y «Borrar» en Plantillas, Proveedores e Informes en la barra.

## Qué se hizo

**El Inicio del operario.** Ruta propia, `GET /admin/metrics/inicio` (`getInicioOperario`): los tres
recuentos de los globos y los cinco últimos presupuestos. No es un recorte por rol de `/home` —así
`/home` se cierra de verdad— y no pide ni una suma a la base. En pantalla coincide con la tabla
firmada en SCRUM-1337:

| En Inicio | Admin | Técnico |
|---|---|---|
| Saludo · avisos de riesgo · acciones rápidas · «Te esperan en WhatsApp» · globos del menú | ✅ | ✅ |
| Actividad reciente del negocio (últimos presupuestos, con importe) | ✅ | ✅ |
| Número héroe · cobrado, gastos y beneficio · resumen de la semana · top clientes · top servicios | ✅ | ❌ |

Ningún texto nuevo: al operario se le **quitan** bloques que ya existían.

La actividad reciente **se mantiene porque ocultarla aquí no cambiaría lo que puede ver**: esos
presupuestos ya los tiene en la pantalla de Presupuestos. Si un operario no debe verlos en ningún
sitio, es otro cambio de máster y es más grande que el Inicio.

Dentro de «Resumen» iba también la tarjeta «Cotizaciones sin respuesta», que es un recuento y no
dinero. Se va con el bloque; el mismo número le sigue saliendo en el globo de Presupuestos.

**Lo que se le oculta.** Proveedores e Informes salen de su barra y de su router (`app.js`); no se
le pintan «Guardar como plantilla» (`quotesView.js`) ni «Renombrar» y «Borrar» (`templatesView.js`);
Productos no pide proveedores con su sesión; y el aviso del resumen del trimestre no pregunta a
`/admin/reports`, que le negaba desde SCRUM-55.

**El cierre.** `requireRole('admin')` en `metrics/home`, `funnel`, `services` y `whatsapp`; en las
cuatro de `providers`; y en `POST`, `PUT` y `DELETE` de `templates`. Entran en `ADMIN_ONLY_ROUTES`.

**`GET /admin/templates` se queda con el operario**, declarada en `TECNICO_ALLOWED`. Su nota en la
lista decía «plantillas de mensaje» y la ruta sirve plantillas de presupuesto. No es un permiso
nuevo: es la primera fila de la tabla S1 del máster («Quotes/clientes/productos crear-ver» ✅ para
el Técnico), porque leer una plantilla para arrancar un presupuesto es parte de crearlo, y cerrarle
la lectura le quitaba «Usar plantilla». Consta en SCRUM-1317, comentario 17782. Crear, renombrar y
borrar plantillas es administración, y va a admin.

**`platform-funnel` también se cierra**, con `requireRole('admin')` **delante** de su puerta de dueño
de plataforma, que se queda intacta. El ticket decía «no se toca» porque daba esa puerta por «más
estricta que admin», y no lo es: `isVerifiedPlatformOwner` mira el **merchant** de la sesión (correo
en `OWNER_EMAILS` y marca en la base), nunca quién llama. El orquestador retiró su propio límite
por escrito (SCRUM-1317, comentario 17780). Los cuatro casos, corridos antes y después:

| Quién llama | Antes | Después |
|---|---|---|
| operario de un merchant cualquiera | 403 | 403 |
| admin de un merchant que no es el dueño | 403 | 403 |
| admin del merchant dueño | pasa | pasa |
| **operario del merchant dueño** | **pasa** | **403** |

Sólo cambia la última fila: ese operario veía el embudo de todos los merchants. El merchant dueño
es la cuenta del fundador; si allí hay, o se planea, un operario que deba ver métricas de
plataforma, se revierte quitando el `requireRole` de esa ruta.

**`PENDIENTE_CLASIFICAR` y `PENDIENTE_MAX` bajan en el mismo commit que saca las entradas**: 13 → 1
con las doce primeras, 1 → 0 con `platform-funnel`. La lista queda vacía. `REVISAR_ANTES_DE` no se
toca: con la lista a cero, el plazo deja de aplicar.

## Un defecto que ya estaba en `main`, arreglado aquí (BUGS.md · P1-1317)

Con sesión de operario, abrir Productos lanzaba un `TypeError` en `cablearMargen`: SCRUM-597 le
retira «Coste» y «Margen %», y unas líneas después se cableaban sin mirar si seguían ahí. La lista
salía **vacía**. Medido en Edge sobre el panel de `main`: 0 filas con 1 producto en el servidor;
con admin, 1 fila.

Va en commit aparte. Entra en este ticket porque el control positivo del cierre —el operario sigue
viendo sus productos— no puede sostenerse con la pantalla rota. Para el admin no cambia nada.

🔴 **Ningún test montaba Productos con rol de operario.** El banco de vistas usa `admin` por
defecto, así que una pantalla que se bifurca por rol sólo se medía por una rama. Ese agujero es más
grande que el defecto que destapó, y no lo cierra este ticket: aquí sólo se montan con rol de
operario Inicio, Productos, Plantillas y el editor.

## Cómo se comprobó

`tests/scrum1317-cierre-admin-e-inicio-del-operario.test.mjs` y
`tests/scrum1317-productos-del-operario.test.mjs`, sin gate.

- **El rojo, por efecto y antes de cerrar:** 11 de 11 dejaban pasar al operario, tocando la base.
  Después: 403 y **cero llamadas a la base**. Un rol desconocido tampoco pasa.
- **Control:** el admin sigue llegando a las once y el handler corre. Sin él, el 403 no probaría nada.
- **El positivo:** con rol de operario, en el banco de vistas, el Inicio pinta su actividad y sus
  tres globos sin pedir `/home` ni `/reports`; Productos carga; en Plantillas puede usar; en el
  editor puede usar plantillas. Y cada caso lleva su control con admin.
- **Mutaciones de front:** 8 de 8 caen, con la base verde antes y después (11 casos).
- **Mutaciones de servidor**, con build entre una y otra y la base verde antes y después (17
  casos): **4 de 5 caen** — aparcar una ruta con la lista a cero (cae `scrum55`: el trinquete sigue
  mordiendo), quitarle el `requireRole` a `DELETE /admin/templates/:id`, quitárselo a
  `platform-funnel`, y que la portada del operario le pida una suma a la base.
  🔴 **La quinta es MUDA, y se dice:** aparcar una ruta **y además subir `PENDIENTE_MAX` a 1** pasa
  en verde. No es de este ticket ni es nuevo: `scrum55` lo declara desde SCRUM-124 como convención
  aceptada —subir el tope es una línea en el diff de un PR, deliberada y revisable— y no se puede
  cerrar sin tocar el guard. Lo que sí queda es que quien aparque tiene que subir el tope a la vista.
- **`scrum55`, con todo aplicado:** 190 rutas /admin · 113 con `requireRole` · 77 del Técnico ·
  0 sin clasificar.
- **En Edge**, panel real y `/admin` simulado negando las once:

| | Operario, `main` | Operario, rama | Admin, las dos |
|---|---|---|---|
| Número héroe · Resumen · semana · tops | se pintan | no | se pintan |
| Actividad · acciones rápidas · globos | sí · 1/5/3 | sí · 1/5/3 | sí · 1/5/3 |
| Peticiones negadas al cargar | 7 (`/admin/reports`) | 0 | 0 |
| Productos | 0 filas, `TypeError` | 1 fila | 1 fila |
| Menú | con Proveedores e Informes | sin ellas | con ellas |
| `#providers` y `#reports` tecleados | abren la vista | caen a Inicio | abren la vista |
| Plantillas | Usar, Renombrar, Borrar | Usar | Usar, Renombrar, Borrar |
| Menú «⋯» del editor | Guardar como plantilla, Limpiar | Limpiar | Guardar como plantilla, Limpiar |

## Lo que NO está medido

- **Nada en yaqu.app**: no hay despliegue todavía. El 403 con sesión real de operario se mide tras
  el merge.
- **A12.4** (`tenancy-permisos`, gateado por `QA_DB_TEST`) no se corrió: las once están en su lista,
  pero su 403 contra una base lo dará la tanda gateada.
- En Edge el servidor es simulado: lo que mide es el panel, no las rutas. Las rutas las mide el
  test, con los routers reales.

## Lo que queda fuera, visto y sin tocar

- El menú del operario enseña además **Libro de registro, Facturas recibidas, Cobros y Partes por
  valorar**. Las cuatro están visibles (medido en Edge) y sus rutas exigen admin (leído en el
  fuente, no corrido). Son entradas hacia un 403, como lo era Informes. Entregado al orquestador.
- El botón «Crear producto» no se le veta al operario, y `POST /admin/products` exige admin desde
  SCRUM-614.
- En Plantillas, el texto de la lista vacía le dice al operario que pulse «Guardar como plantilla»,
  que ya no tiene. Cambiarlo es texto nuevo (regla 39).

## Mis errores

- La primera versión del test de Productos buscaba los campos con un localizador que **no encontraba
  ninguno**: «al operario no se le pinta Coste» habría salido verde con el campo delante. Lo cazó el
  control de admin del mismo test, que usa el mismo localizador y exige encontrar los tres.
- En dos mensajes al orquestador puse la hora **estimada** en vez de leerla de GitHub (A14). Iba
  casi una hora adelantada.
