# SCRUM-1338 · La barra del operario se declara en la propia entrada, y un guard la contrasta con los gates del servidor

**Medido contra:** `origin/main` = `f19ac2f0081a613d44079df86f4cecf2d6f9ace7` · 2026-10-01T07:58:40Z

1-oct-2026 · **J4e** (equipo de Javier, relevo de J4d), por encargo del orquestador (`cobroflash-backend-5b`).
[Escrito por J4e. Los censos se corrieron sobre `8f5906bc51c1c17dfd4fd3d44c1bd028324b8f48`; entre ese
sha y el del ancla, `git diff --name-only -- src public prisma` da 0 ficheros: sólo se movieron docs y tests.]

A9: comprobación → `tests/scrum1338-la-barra-del-operario-contra-los-gates.test.mjs`

**Fecha:** 1-oct-2026
**Skill UI:** cargada (`yaqu-premium-ui`). No entra ningún componente, token, color ni texto nuevo:
se ocultan entradas de menú que ya existían y se deshabilita un botón con el veto por rol que la
pantalla ya usa en otros cuatro. De `DESIGN.md` y de la Parte AB no se leyó nada más que eso, porque
el cambio no usa ningún token. Checklist AB6: lo medido y lo no medido, abajo.

## Ficheros

`public/dashboard/index.html` · `public/dashboard/js/app.js` · `public/dashboard/js/productsView.js` ·
`tests/scrum1338-la-barra-del-operario-contra-los-gates.test.mjs` · `docs/BUGS.md` ·
`docs/evidencias/scrum1338/`

## Qué había

`tests/scrum55-admin-fail-closed.test.mjs` audita el servidor: toda ruta `/admin` declara rol. Lo hace
bien. Lo que no existía era **nada que comparase eso con la barra del panel**: `app.js` le ocultaba
entradas al operario con una lista de nombres escrita a mano (`nav-plans`, `nav-team`, `nav-export`,
Configuración, Gastos, Proveedores, Informes), cada uno añadido por el ticket que tropezó con él.

## ① El censo de la barra — medido POR EFECTO

Instrumento: `docs/evidencias/scrum1338/censo-barra.mjs.txt`. Monta cada pantalla en el banco de
vistas con rol `tecnico` y una red que contesta 403 **donde lo contesta el gate real**, derivado de
los routers de `dist/` (190 rutas `/admin` · 113 de admin · 77 sin rol: el mismo recuento que `scrum55`).

| | Antes (`8f5906bc`) | Después |
|---|---|---|
| Entradas en la barra | 18 | 18 |
| Ocultas al operario | 6 | 10 |
| **Visibles al operario** | **12** | **8** |
| **Visibles que al abrirse piden una ruta de admin** | **4** | **0** |
| Rótulo «Cuenta» sin ninguna entrada debajo | se pinta | no se pinta |
| «Crear producto», para el operario | pulsable | deshabilitado, con su nota |

Las 4: **Partes por valorar** (`GET /admin/partes/oficina/pendientes`), **Cobros** (`GET /admin/cobros`),
**Libro de registro** (`GET /admin/libro-registro`) y **Facturas recibidas**
(`GET /admin/libros/recibidas.json`). Son las cuatro que J4c vio en Edge, y ni una más: dos métodos
distintos, el mismo conjunto. Las 8 que le quedan —Inicio, Solicitudes, Trabajos, Presupuestos,
Albaranes, Facturas, Clientes, Productos— abren con 0 peticiones negadas.

Literales: `barra-ANTES-8f5906bc.txt` y `barra-DESPUES-76d25de8.txt`, en `docs/evidencias/scrum1338/`.

**Qué pintaba cada una tras el 403** (punto ⑤ del ticket; medido en el banco, no en un navegador):

| Pantalla | Lo que veía el operario |
|---|---|
| Partes por valorar | «No se han podido cargar los partes» y un botón «Reintentar» |
| Libro de registro | cartel «No se ha podido cargar el libro. Vuelve a intentarlo.» |
| Facturas recibidas | el mismo cartel con «[PENDIENTE microcopy oficial]» delante, y debajo el detalle crudo «API 403: forbidden» |
| Cobros | **ningún cartel**: los filtros pintados y la lista vacía, como si no hubiera cobros |

Esqueletos colgados: 0 en las cuatro. Estas pantallas no se tocan aquí —el operario ya no llega a
ellas—, pero dos de sus carteles son defectos de un admin sin red y van a la propuesta de tickets.

## ② Qué se hizo

**La regla, que es general** (orquestador, SCRUM-1338 comentario 17829):

| Qué | Qué se hace | Por qué |
|---|---|---|
| Entrada de MENÚ a una pantalla que no puede usar | se OCULTA | esa pantalla no es suya; no hay nada que explicarle |
| BOTÓN dentro de una pantalla que sí es suya | se DESHABILITA con su nota | la pantalla es suya; lo que no puede es esa acción |

**La barra.** La entrada dice para quién es, en `index.html`: `data-rol="admin"` en las diez que son
sólo del admin. `app.js` pierde la lista de nombres y gana dos funciones a nivel superior, sin
ningún nombre de vista dentro:

- `aplicarRolALaBarra(documento, rol)`: a quien no es admin le quita lo declarado de admin, y con
  ello el rótulo de la sección que se quede sin entradas debajo.
- `vistaVedadaPorRol(documento, rol, vista)`: la misma declaración, para la vista **tecleada**. Es la
  primera sentencia de `renderView`: `#cobros`, `#plans` o `#expenses` llevan al operario a Inicio.

Quien no es admin —el técnico, o un rol que todavía no existe— cae del lado restringido.

**Dos efectos que no estaban en el enunciado y entran con esto:** `#plans` y `#expenses` tenían la
entrada oculta y la vista sin guard; tecleadas, el operario veía «Error cargando el plan · API 403:
forbidden». Ahora caen en Inicio, como ya hacían `#settings`, `#team` y `#providers`.

**«Crear producto».** `lockActionForRole` y `roleLockedNote`, el veto por rol que Productos ya usa en
Exportar, Importar, Editar y Desactivar. El texto no es nuevo: es la copy de SCRUM-89, aprobada por
el fundador el 23-jul-2026 (`docs/master/SCRUM-614.md` y `docs/master/SCRUM-365.md` lo recogen; la
decisión de usarla aquí, en el comentario 17829).

## ③ Lo que impide la siguiente

`tests/scrum1338-la-barra-del-operario-contra-los-gates.test.mjs`, en la tanda obligatoria y sin gate.
No tiene ninguna lista: deriva los gates del servidor, la barra del HTML, lo que ve el operario
**ejecutando** `aplicarRolALaBarra`, y lo que pide cada pantalla **montándola**. Y exige los dos sentidos:

1. entrada **visible** para el operario → al abrirse no pide ninguna ruta de admin;
2. entrada **oculta** para el operario → al abrirse pide al menos una. Si no, se le está quitando
   algo que es suyo: un barrido que le vacíe el menú es peor que el defecto.

Una entrada nueva hacia una ruta de admin que nazca sin declarar cae en el 1. El día que se añada,
el test no se toca.

🔴 **Lo que impide la siguiente es el guard, no el HTML.** Propuse primero la forma fail-closed —que
la entrada declare al operario, y la que no declare no se pinte— y no puede ser:
`tests/scrum599-navegacion-documentos-y-atajo.test.mjs` lleva el literal exacto de la etiqueta de
`quotes-list` en una de sus mutaciones, y marcar las entradas del operario la rompe. Una entrada
nueva sin declarar **sí se le pintaría** al operario en un árbol que no pase por CI.

**Visto caer.** 10 mutaciones de front, base verde antes y después (9 tests): **10 de 10 caen**
(`mutaciones-76d25de8.txt`, instrumento `mutar.mjs.txt`). Y dentro del propio test, de forma
permanente, dos barras estropeadas sin tocar el disco: una entrada de admin sin declarar y una del
operario declarada de admin.

## ④ El censo de los BOTONES — estático, y el «quién lo ve» está LEÍDO, NO CORRIDO

> **Para la barra hay puerta; para los botones, lo honesto hoy es un censo, no una puerta.**

Instrumento: `censo-llamadas.mjs.txt`. Por AST, cada llamada de `public/dashboard/js` a una ruta
`/admin`, contra el gate real.

| | |
|---|---|
| Ficheros leídos | 95 |
| Llamadas (`apiRequest` 180 + `fetch` 38) | 218 |
| …a `/admin` | 215 |
| **…a rutas de ADMIN** | **102** |
| …a rutas del operario | 96 |
| …que el instrumento no casó con ninguna ruta | 7 |
| …con la ruta no literal | 10 |

De las 102: **42** viven en pantallas que son sólo del admin, **3** ya las vetó y midió SCRUM-1317, y
**57** (60 filas: una tiene cuatro llamadores) están en pantallas que el operario sí abre. Esas 60
filas las triaron tres subagentes **leyendo**, sin pulsar nada (`triaje-leido.txt`):

| Veredicto leído | Filas |
|---|---|
| Ya vetada por rol en el front | 34 |
| **Sin ninguna condición de rol: el operario la ve y le daría 403** | **19** |
| Visible sólo si se da una condición que no se determinó (asistente de alta 5, banner de pago 1) | 6 |
| Código sin llamadores | 1 |

Las 19 son **15 controles y 2 cargas automáticas**: ficha de factura 7 (Enviar por WhatsApp, Enviar por
email, Marcar como cobrada, Cobrar por Bizum, Enviar recordatorio de pago, Emitir factura
rectificativa, Volver a generar el PDF), lista de facturas 1, factura suelta 1, ficha de presupuesto 3
y una carga, albarán 1, Trabajos 1 y una carga, Productos 1.

**De los 15, este ticket mide por efecto y arregla UNO: «Crear producto».** Los otros 14 quedan
fuera, con el acuerdo del orquestador: son pantallas de documento, no caben en un día junto a esto
(A17), y sobre todo **están leídos**: su primer paso es pulsarlos.

## Cómo quedó medido antes de empujar

- El test del ticket: 9 tests, 9 pasan.
- Una tanda **dirigida**, no la completa: 36 ficheros de `tests/` —el del ticket, los dos de SCRUM-1317,
  `scrum55`, `scrum599`, `scrum601`, `scrum801`, `scrum819`, `scrum1040`, los de la barra y el dispatch
  (`scrum420`, `scrum433`, `scrum284`), los de suite (`scrum237`, `scrum976`, `scrum711`, `scrum850`) y los
  de documentación—: 322 tests, 322 pasan, 0 caen, 0 saltan, salida 0.
- `scrum601` sigue verde **sin tocarlo**: el bloque de `app.js` se reescribió con el mismo número de
  líneas por encima de su ancla (la 386 es la misma línea que en `main`, comparada con `diff`).

## Lo que NO está medido

- 🔴 **La tanda completa NO se corrió en local.** Se pidió turno y el orquestador mandó converger. El
  PR sale con el auto-merge **desarmado** y lo dice en su primera línea: lo que lo mide es el CI, y
  hay que leerlo —los 9 casos de este ticket, por nombre— antes de rearmarlo.
- 🔴 **De los guards de navegador se corrió UNO de 37**: `guard:rastro-del-menu`, en primer plano, que
  es el que recorre el menú y `app.js`. Con sesión de **admin**: 18 destinos, 18 de 18 con el hash
  coherente, salida 0 (`guard-rastro-del-menu.txt`). Dice que al admin no se le ha roto el menú.
- **El operario, en un navegador: no medido.** La barra se midió ejecutando las funciones reales sobre el DOM
  mínimo del banco; que `initApp` y `renderView` las llaman se comprueba por AST.
- **Los 14 controles restantes**, por efecto.
- **Si un operario puede ver el asistente de alta**, de lo que dependen 5 filas.
- Las 7 llamadas que el instrumento no casó con ninguna ruta y las 10 de ruta no literal: no se
  sabe a qué gate van.
- El banco sirve datos mínimos: mide lo que cada pantalla pide **al abrirse**, no lo que pediría con
  una lista llena.
- De la matriz AB6: iPhone, tablet y estado de carga.

## Lo que queda fuera, visto y sin tocar

- **S1 del máster y el código divergen en «crear producto».** La fila 1 de la tabla S1 dice que el
  Técnico crea productos; `src/core/http/adminRouteDeclarations.ts` recoge que el fundador cerró el
  catálogo a escritura el 24-ago-2026 (SCRUM-614). Subido al fundador por el orquestador.
- **La copy de SCRUM-89 está aprobada y no vive en `docs/microcopy/`**, así que ningún guard
  comprueba que siga diciendo lo que se aprobó (comentario 17829).
- **El enumerador de rutas vive ahora en dos sitios**: dentro de `scrum55` y dentro de este test. No
  se puede importar de un fichero de test sin ejecutarlo. Sacarlo a un módulo común es de su carril.
- Cada fichero pregunta el rol a su manera (`=== 'tecnico'`, `!== 'admin'`, `!== 'tecnico' && !== 'operario'`):
  con un tercer rol, los vetos escritos contra `'tecnico'` no se aplicarían.
- `nav-export` estaba en la lista de `app.js` y no existe en `index.html`.

## Mis errores

- **Una mutación muda en mi propio test.** «Crear producto deshabilitado pero sin su nota» pasaba en
  verde: el test buscaba «alguna nota en la pantalla», y con el catálogo vacío otro botón ya pinta la
  suya. Primera pasada, 9 de 10. Ahora la busca detrás de la fila del botón, y lo dice dentro.
- **Dije «fail-closed» antes de mirar quién parsea la etiqueta.** Se lo escribí al orquestador como
  diseño y lo retiré al encontrar el literal de `scrum599`, antes de construirlo.
- **Parché un instrumento pasando texto a `node -e` por bash**, y bash se comió las barras de dos
  expresiones regulares: el censo murió con un `SyntaxError` y salida 1. No dio un número falso
  porque no llegó a arrancar; lo rehice con la herramienta de edición.
- **En un mensaje al orquestador conté «~35 vetadas» y «6 del asistente»**: son 34 y 5. Lo recontó el
  propio fichero del triaje al escribirlo.
- En dos cabeceras del banco puse una hora «aprox.»; la cambié por las dos lecturas de GitHub que la
  acotan.

---

# SCRUM-1338b · Cobros SÍ pinta su aviso tras el 403: lo que no lo veía era el instrumento

**Medido contra:** `origin/main` = `762f4fbba51ea214fd6c2473baa577d69c088791` · 2026-10-01T14:49:03Z

1-oct-2026 · **J4f** (equipo de Javier, relevo de J4e), por encargo del orquestador (`cobroflash-backend-5b`).
[Escrito por J4f. Anexo de sólo docs y banco: no toca `src/`, `public/` ni `tests/`. Medido sobre la
rama con ese `origin/main` ya mergeado dentro (`92eed0586594e185fe59a4f1eeeb3d29621c9677`).]

A9: aviso → A10 «Un instrumento que solo sabe callar no es un instrumento.» — no se pudo comprobar: `censo-barra` es una sonda del banco de evidencias y no un guard de la tanda, así que no hay dónde colgarle un control; lo que queda escrito es su límite, aquí y en la propuesta de tickets

**Fecha:** 1-oct-2026

## Qué corrige

La tabla «Qué pintaba cada una tras el 403» de arriba dice de Cobros «ningún cartel: los filtros
pintados y la lista vacía, como si no hubiera cobros». **No es así.** Cobros pinta su aviso
aprobado —«No hemos podido cargar los cobros. Vuelve a intentarlo.» (`COBROS_COPY.errorCarga`, de
SCRUM-285)— dentro de la tabla, en una celda **sin clase** (`cobrosView.js`, `pintarAviso`).

`censo-barra` buscaba los carteles por el NOMBRE DE CLASE del nodo (`error`, `empty-state`, `alert`)
y no por su texto: una celda sin clase le es invisible, y su `carteles=[]` se leyó como «no pinta
nada». La fila de J4e se deja como está y se corrige aquí.

## Cómo se midió

`docs/evidencias/scrum1338/sonda-cobros.mjs.txt`, con el mismo banco de vistas, busca el literal
de `COBROS_COPY.errorCarga` en el texto de las hojas del contenedor. Salida entera en
`sonda-cobros-92eed058.txt`:

| Montaje | `GET /admin/cobros` | Aviso de fallo | Vacío «no hay cobros» |
|---|---|---|---|
| operario | negada | **pintado** (una celda, sin clase) | no |
| admin, control | concedida | no | pintado |
| admin con el mismo fallo | negada | **pintado** | no |

El control es la segunda fila: sin fallo no hay aviso, así que la sonda distingue.

## Lo que cambia en la propuesta de tickets

- **«Cobros no pinta ningún cartel» se retira**: no tiene víctima. Lo que sí es cierto es menor y
  distinto: el aviso va en una celda sin clase, no en el cartel de error que usan las otras pantallas.
- **Facturas recibidas se mantiene, partido en dos cosas distintas.** El marcador
  «[PENDIENTE microcopy oficial]» no es un descuido del cartel: todas las ranuras de esa pantalla
  que aún no tienen firma lo llevan a propósito (`facturasRecibidasView.js`, `rotulo(…)`), y se
  quita con una firma, no con código. El detalle crudo de la API debajo del cartel
  («API 403: forbidden») sí es código.
- **Los gates de las llamadas citadas en la propuesta siguen siendo de admin**, consultados uno a
  uno contra `dist/` (`sonda-gates-92eed058.txt`, con sus dos controles: una ruta sin rol y una que
  no existe). Las líneas citadas en `triaje-leido.txt` son de `8f5906bc`; `quotesDetailView.js`,
  `albaranDetailView.js` y `quotesView.js` se movieron en `main` desde entonces, y la sonda lleva
  las de hoy.

## Lo que NO está medido

- Sigue siendo el banco de vistas, no un navegador: que la celda se vea bien en pantalla no consta.
- Los controles de las fichas de factura, presupuesto, albarán y Trabajos siguen LEÍDOS, no pulsados.
  La sonda de gates dice qué exige el servidor, no qué botón ve el operario.

## Lo que entró en esta rama sin ser de J4e ni mío

El commit `f54e1440042fa73280c08dab8043cec58a2d3b17` lo hizo el flujo `@claude` del repositorio,
llamado por el avisador de rojos: el primer CI de la rama cayó en `scrum553` y `scrum737` por el
test nuevo. Cambia tres líneas de ese test (dos expresiones dejan hueco a los atributos; un
comentario escribe dos recuentos en letra) y ningún guard. Leído entero antes de seguir.
