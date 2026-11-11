# SCRUM-1700 · TRABAJOS · «Abrir parte» en el trabajo EN CURSO y «Partes por valorar · {n}» en el menú (PILOTO-1)

**Medido contra:** `origin/main` = `412ddc20d0233162159567d4e7705bf845f71404` · 2026-11-11T14:40Z

**Skill UI:** cargada (`yaqu-premium-ui`; AB6 abajo)

A9: comprobación → `tests/scrum1700-abrir-parte-y-partes-por-valorar.test.mjs`

## Origen y firma

T7 de la ③ de SCRUM-1686 (Jira c.21459; registro `docs/master/SCRUM-1686.md` §SCRUM-1686b). D1=A
firmada (c.21461): en obra, un documento, el parte. **Textos FIRMADOS** en la tanda N1-N13 de
SCRUM-1686 («si firmo», c.21470 + registro del orquestador de las ~12:05 con localizador):

- **N1** · Lista de Trabajos, trabajo EN CURSO, botón principal · «Abrir parte».
- **N2** · Menú, entrada de la oficina, con partes firmados sin valorar · «Partes por valorar · 2»
  (el número es el de partes esperando).

## Qué cambia

`public/dashboard/js/jobsView.js` (carril S4):

- **N1.** La fila de un Trabajo `en_curso` lleva «Abrir parte» como `btn-primary btn-sm`, en la celda
  de acciones y **fuera de `.jobs-acciones`** (la escalera `jobNextAction`, compartida con el detalle
  y comparada por `guard:escalera-por-estado`), con el mismo criterio que «Ver detalle»
  (SCRUM-1562f). La escalera **no se toca** (es de S2 y la vigila SCRUM-366/823).
- **Qué abre:** el BORRADOR de ese Trabajo si existe (`GET /admin/partes`, que ya trae `jobId` y
  `estado`); si no, crea el de esta visita (`POST /admin/partes {jobId}`) y lo abre. No abre un parte
  FIRMADO de una visita anterior (no se puede tocar) ni crea uno nuevo en cada pulsación (D2).
  Error: el mismo aviso, literal, que la puerta del detalle (`jobDetailView.js`, SCRUM-652).
- **Se retira la puerta provisional** «Partes por valorar» de la cabecera de la lista: era «hasta que
  se firme el rótulo» y la entrada vive en el menú desde el 3-sep-2026.

`public/dashboard/js/app.js` (contenedor de S2, bloque marcado S4):

- **N2.** `contarPartesPorValorar(documento, pedir, rol)` (nivel superior, la ejecuta el banco):
  pide `/admin/partes/oficina/pendientes` y pone «Partes por valorar · n» en
  `#nav-partes-oficina-label`. **Falla hacia el rótulo a secas**: cero, otra forma o fallo de red
  dejan «Partes por valorar», nunca un número viejo. Sólo para `admin` (la ruta es
  `requireRole('admin')` y la entrada ya va oculta al operario). Se llama al cargar, cada 5 min
  (mismo ritmo que el badge de solicitudes) y al entrar a la cola.

Sin texto nuevo fuera de N1 y N2. Sin cambios de servidor ni de esquema.

## Pruebas

- **Rojo primero** sobre `412ddc20d`: 5 de 7 casos en rojo por el motivo esperado (0 «Abrir parte»,
  sigue `#jobs-partes-valorar`, `app.js` no publica `contarPartesPorValorar`).
- **Verde:** 7/7 tras el cambio.
- **En yaqu.app, cuenta QA, 390 px**, con `jobsView.js` y `app.js` servidos desde el árbol y todo
  lo demás de producción (banco `evidencias/SCRUM-1700/capturar.mjs`; aborta toda petición que no sea
  GET, salvo `POST /admin/partes` en el modo «clic»):
  - Dato preparado: el Trabajo QA #77 pasó `pendiente_agendar → agendado → en_curso` (no había
    ninguno en curso; reversible por la FSM).
  - antes: fila en curso `Ver detalle | + Nuevo albarán | ⋯`; cabecera `Nuevo trabajo | Partes por
    valorar`; menú «Partes por valorar» · `antes-lista-390.png`, `antes-menu-390.png`
  - después: fila en curso `Abrir parte (btn-primary 89×44) | Ver detalle | + Nuevo albarán | ⋯`; el
    terminado, sin cambio; cabecera `Nuevo trabajo`; menú **«Partes por valorar · 1»**; sin scroll
    horizontal (scrollWidth 390) · `despues-lista-390.png`, `despues-menu-390.png`
  - clic en «Abrir parte»: sin borrador → creó **PT-2026-006 (parte id 14)** y abrió
    `#parte-detail/14` · `despues-abrir-parte-390.png`. **Segundo clic: abrió el MISMO id 14**, sin
    crear otro.

## AB6

Botón del inventario (`btn-primary btn-sm`), 44 px de alto medido, sin estilo en línea ni token
nuevo; se deshabilita mientras pide (sin doble alta); error con aviso ya existente; rótulo corto
(sin riesgo de texto largo).

## Decisiones y lo que queda fuera

- **Más de una primaria en la lista:** SCRUM-917c reservaba la primaria de la lista al dinero. N1
  firma «Abrir parte» como botón PRINCIPAL del trabajo en curso, así que con N trabajos en curso hay
  N verdes. Se aplica lo firmado; se anota por si el fundador lo quiere revisar.
- **La escalera del trabajo en curso sigue proponiendo «+ Nuevo albarán»** (secundaria, al lado).
  Con D1 lo coherente sería que en obra no se propusiera el albarán; eso es `jobNextAction.js` +
  `jobDetailView.js` (S2) y lo vigilan SCRUM-366/823: no lo meto en esta pieza.
- Que el número del menú se ponga al día justo después de valorar un parte dentro de la cola
  necesitaría una llamada desde `parteOficinaView.js` (S2); hoy se pone al día al volver a entrar a
  la cola, al recargar o a los 5 min.
- Pendiente: verlo en yaqu.app tras el merge (regla 42).
