# SCRUM-1317 · Se le cierran al operario las rutas /admin que SCRUM-55 dejó aparcadas, y antes se le da un Inicio propio

**Medido contra:** `origin/main` = `bee39d3b51e300ff4efdda3befcb1eff4626f988` · 2026-10-01T06:10:12Z

1-oct-2026 · **J4c** (equipo de Javier), por encargo del orquestador (`cobroflash-backend-5b`).
[Escrito por J4c. Las frases del fundador las transcribe el orquestador en Jira; aquí se citan de allí.]

- Cerrarlas: SCRUM-1317, descripción. **Javier, 30-sep-2026: «2-Sí ciérralas de verdad, estamos con contexto fresco da igual la hora».**
- Qué ve el operario en Inicio: SCRUM-1337, descripción. **Javier, 1-oct-2026: «Sí el operario ve la actividad de sus compañeros»**, y la firma del cambio de máster, **«1-Firmo»**.

A9: comprobación → `tests/scrum1317-productos-del-operario.test.mjs`

**Fecha:** 1-oct-2026
**Skill UI:** cargada (`yaqu-premium-ui`). Checklist AB6 de este cambio: no entra ningún componente,
token, color ni texto nuevo — sólo se quitan, por rol, bloques y botones que ya existían. El Inicio
del operario, medido en Edge a 390 y a 1280 px con un nombre de cliente largo y un importe de
9.999,99 €: sin desborde horizontal (documento = ventana en los dos anchos), 5 filas de actividad,
ningún bloque del negocio, héroe a 0 px. Capturas en `docs/evidencias/scrum1317/`. De la matriz AB6
**no** se midió: iPhone ni tablet reales, ni el estado de carga.

## Ficheros

`public/dashboard/js/homeView.js` · `public/dashboard/js/app.js` ·
`public/dashboard/js/productsView.js` · `public/dashboard/js/quotesView.js` ·
`public/dashboard/js/templatesView.js` · `src/modules/metrics/` (ruta y servicio) ·
`src/modules/providers/app/routes/providers.routes.ts` ·
`src/modules/templates/app/routes/templates.routes.ts` · `src/core/http/adminRouteDeclarations.ts` ·
`src/core/http/adminOnlyRoutes.ts`

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

## Lo que cazó la tanda completa (J4d, relevo de J4c)

**Medido contra:** `origin/main` = `07571bceaf41dd21b9563601d39922238873b183` · 2026-10-01T06:45:28Z

1-oct-2026 · **J4d**. [Escrito por J4d. J4c entregó la rama construida y sin la tanda completa; el
turno de la suite no era suyo todavía.]

A9: comprobación → `tests/scrum960-nif-del-proveedor.test.mjs`

La primera tanda completa sobre la rama (1.157 ficheros · 9.560 tests) salió con **9 rojos en 3
ficheros**, los tres consecuencia de este cambio y ninguno visible en los tests del ticket:

| Fichero | Casos | Por qué caía | Qué se hizo |
|---|---|---|---|
| `tests/scrum960-nif-del-proveedor.test.mjs` | 7 | Su arnés llama al router real de proveedores con un `req` **sin rol**; desde el cierre, `403`. | El arnés lleva `userRole: 'admin'`, con el motivo escrito dentro. **Ninguna aserción cambia.** |
| `tests/scrum801-el-respaldo-de-la-n.test.mjs` | 1 | `case 'providers'` de `app.js` pintaba Inicio **dentro** del `case` para el operario; el censo veía dos vistas donde exige una. El censo no mentía. | **Se arregló el código, no el guard:** el `case` redirige con `return renderView('home', options)`, la forma que ya usa `case 'operarios'`. |
| `tests/scrum601-copy-del-documento-vs-flag.test.mjs` | 1 | Sus dos controles están anclados **por número de línea**, y este ticket mete líneas por encima de los dos. | Se re-miden: `homeView.js` 864 → 885, `app.js` 370 → 386, cada uno con la orden que lo vuelve a medir. |

Tocar los dos tests ajenos lo autorizó el orquestador (`cobroflash-backend-5b`) por el canal, con la
condición de dejar el motivo dentro de cada fichero. El segundo número de `scrum601` (370 → 386) no
estaba en la pregunta que se le hizo: el primer aserto caído lo tapaba. Es el mismo re-anclaje, en el
mismo control, y se dice aquí.

**El cambio de `app.js` tiene un efecto, y es éste:** para el operario que teclea `#providers`,
`appState.view` queda en `home` (antes se quedaba en `providers` con Inicio pintado). Re-medido en
Edge con la sonda del banco: operario → vista `home`, título «Inicio»; admin → vista `providers`,
título «Proveedores», igual que en `main`. `case 'reports'` se queda como estaba.

**Después de los arreglos:** tanda completa, 1.159 ficheros · 9.575 tests · 9.437 pasan · 0 caen ·
138 saltan, salida 0; `guards:entrada`, 12 guards y 122 tests, salida 0. Las dos tandas y la salida
de la sonda están en `docs/evidencias/scrum1317/` (`tanda-completa-j4d.txt`, `edge-rama-ed0e9a7a.txt`).

**Guards de navegador: 37 de 37 en verde, pero no de una vez.** `guards:visuales` iba por el 30 de
37 cuando el sistema mató el proceso por falta de memoria. Los 30 que midieron, verdes. Los 7 que
faltaban —entre ellos `guard:rastro-del-menu`, el que recorre el menú y `app.js`— se corrieron
después **uno a uno**, midiendo la memoria antes de cada uno: los 7 con salida 0 y con su salida
(`guards-navegador-los-7-uno-a-uno.txt`). `rastro-del-menu`: 18 destinos, 18 de 18 con el hash
coherente.

🔴 **Hallazgo de otro carril, sólo reportado:** al morir, la puerta cerró con «7 guard(s) midieron y
encontraron algo» sobre siete procesos que **no llegaron a arrancar** (0,0 s, sin salida, código
`0xC0000142`). Un hijo que no se inició se contó como hallazgo. La salida literal está en
`guards-visuales-cortado-por-memoria.txt`. Entregado al orquestador.

**El ANTES, medido en yaqu.app con sesión real de operario** (1-oct-2026 07:11:56Z; producción servía
`761db44f`, sin este ticket; la sesión la abrió el fundador con enlace mágico y `/admin/me` decía
`tecnico`). Sólo lectura, 9 peticiones: `home`, `funnel`, `services`, `whatsapp` y `providers`
contestaron **200** al operario —`home` con sus campos de dinero—; `platform-funnel`, 403 (ya negaba:
ese merchant no es el dueño de la plataforma). Controles: `metrics/team` 403 (el instrumento ve un
403), `templates` 200, `metrics/inicio` 404 (la ruta nueva aún no estaba). En el panel: número héroe,
Resumen, semana y tops pintados, y Proveedores e Informes en la barra. Es la mitad «antes dejaba
pasar» de la aceptación 1, que hasta hoy sólo constaba en un test. Literal en
`docs/evidencias/scrum1317/yaqu-app-ANTES-operario-761db44f.txt`. **El DESPUÉS no está medido aquí:**
va tras el despliegue, y los seis verbos de escritura sólo si los GET ya niegan.

Y sobre `scrum601`: un control anclado por posición no sólo se rompe: **se rompe en cascada y de una
en una**. Su segundo ancla estaba escondido detrás del primer aserto caído.

🔴 **Lo que NO se arregla aquí y queda dicho:** el control positivo de `scrum601` está anclado por
**posición**. Es su tercer re-anclaje en `homeView.js`/`invoicesView.js` y el quinto en `app.js`: se
rompe cada vez que alguien edita por encima, y quien lo rompe no ha tocado nada de lo que mide.
Debería anclarse por **contenido**. Es un guard de otro ticket; lo recoge el orquestador.

**Cuántos arneses más llaman a un router de sesión sin rol** (censo por texto sobre `origin/main`
`5de9464f6064d9caaa6408cfb88615f7ce461c3b`, no por AST): 69 ficheros de `tests/` importan un router
de `dist/modules`; 27 nombran `userRole`; de los 42 que no, 32 lo ejecutan y 22 de ésos le pasan
`merchantId` — arneses con forma de sesión y sin rol. Dos de los 22 son de rutas públicas (leído por
el nombre del módulo), así que quedan **20, contando `scrum960`**. Control: `scrum960` sale en la
lista. No ve los arneses que montan `dist/app.js` entero. Sólo se arregla el de este ticket.

## Mis errores

- **(J4d)** En un mensaje al orquestador conté «7 rutas de escritura y 5 GET»: son 6 y 6. Lo
  corregí por el canal antes de que nadie midiera con ello.
- **(J4d)** Puse la hora **estimada** en tres mensajes al orquestador en vez de leerla de GitHub
  (A14), el mismo error que J4c confiesa abajo y que yo había leído en su traspaso.
- La primera versión del test de Productos buscaba los campos con un localizador que **no encontraba
  ninguno**: «al operario no se le pinta Coste» habría salido verde con el campo delante. Lo cazó el
  control de admin del mismo test, que usa el mismo localizador y exige encontrar los tres.
- En dos mensajes al orquestador puse la hora **estimada** en vez de leerla de GitHub (A14). Iba
  casi una hora adelantada.

# SCRUM-1317b · El DESPUÉS de producción entra en el repo, copiado de Jira y sin volver a medir

**Medido contra:** `origin/main` = `8f5906bc51c1c17dfd4fd3d44c1bd028324b8f48` · 2026-10-01T07:38:18Z

1-oct-2026 · **J4e** (equipo de Javier, relevo de J4d), por encargo del orquestador
(`cobroflash-backend-5b`). [Escrito por J4e. Sólo docs. **J4e no midió nada de esto**: el ancla de
arriba es la del `main` sobre el que se escribe el anexo; la medición es de J4d y lleva su hora.]

A9: sin fallo que generalice — sólo docs: una copia cotejada fila por fila contra el ANTES del banco, sin instrumento propio que pudiera fallar

**Fecha:** 1-oct-2026

**El DESPUÉS, medido por J4d en yaqu.app con la misma sesión real de operario** (1-oct-2026
07:31:49Z; producción servía `8f5906bc`, que contiene el merge `d67713ce` del PR #2065): **12 de 12
niegan, y las doce por la puerta de rol** —`403` con `{"error":"forbidden","required_role":"admin"}`,
no un 400 ni un 404 de validación—. Son 6 GET, de los que **5 cambiaron** de «pasa» a «niega»
(`platform-funnel` ya negaba, y ahora lo niega la puerta nueva), y 6 de escritura sin «antes» en
producción a propósito. Controles: `metrics/inicio` **200** con cuatro campos (antes 404),
`templates` 200 (3 plantillas antes de los seis verbos y 3 después), `metrics/team` 403 antes y
después. En el panel, a 1280 y a 390 px: sin número héroe, Resumen, semana ni tops; actividad 3
filas; 0 esqueletos; sin desborde; peticiones a `/admin` negadas, 0 de 20 y 0 de 8. Menú: de 14
entradas a **12**; se fueron Proveedores e Informes y sólo ésas. Literal, con las doce filas, en
`docs/evidencias/scrum1317/yaqu-app-DESPUES-operario-8f5906bc.txt`, al lado del ANTES.

De dónde sale, y es lo único de donde sale: **SCRUM-1317, comentario 17817** (la entrega de J4d, con
la tabla) y **comentario 17818** (el cierre del orquestador, que la recoge). Los seis verbos de
escritura contra producción los autorizó el fundador en el comentario 17815.

Con esto queda cerrada la frase de más arriba «El DESPUÉS no está medido aquí»: era verdad cuando
se escribió (antes del despliegue) y se deja como estaba.

## Lo que se cotejó al copiar, y lo que no cuadra del todo

Cotejado contra `yaqu-app-ANTES-operario-761db44f.txt`, sin tocar producción: la columna «Antes» de
las seis GET de c.17817 coincide con el fichero (cinco `200` y un `403` sin `required_role`); la
ventana de 929 px, las 3 filas de actividad, el globo «2» y las 14 entradas, también. Leído de
GitHub: el PR #2065 está `MERGED` a las 07:23:13Z con merge `d67713ce2692099f04615c98706dfb9502ba850a`,
y ese commit es ancestro de `8f5906bc`.

Dos cosas que la copia **no** puede sostener, dichas para que nadie las lea de más:

- **El menú de DESPUÉS es un número y dos nombres, no una lista.** c.17817 dice «12» y «se fueron
  Proveedores e Informes»; no enumera los doce ids. Restarlos de los 14 del ANTES es una cuenta, no
  una medición, y no se ha escrito como lista medida.
- **La «tanda completa final» de c.17817 (1.160 ficheros · 9.581 tests · 9.443 pasan · 138 saltan)
  no está en el banco.** `tanda-completa-j4d.txt` guarda las dos anteriores; la última es de 1.159
  ficheros · 9.575 tests · 9.437 pasan, y es la que cita la sección de J4d de este registro. No es
  una contradicción que yo pueda afirmar —c.17817 la llama «final», así que se lee como una tercera
  pasada; por qué difiere no lo he medido— pero la cifra final vive sólo en Jira y no la respalda
  ningún fichero. No se copia aquí como medida.
