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
- **Tanda completa** (13 195 tests): 16 fallos; 13 son los conocidos de un worktree fresco (1199,
  1321, 245, 385, 471, 475, 476) y salen igual en `origin/main`. Los tres míos, arreglados:
  - `scrum412` (una `btn-primary btn-sm` nueva se declara): `jobsView.js:bParte` entra en
    `DECLARADAS` como FILA, con su motivo, igual que `cobrarBtn` (lo que el guard pide).
  - `scrum601` (ancla por número de línea en `app.js`): 388 → 391, medido con su `grep`.
  - `scrum700` (filtros propios): mi test limpiaba la URL con una regex `https?:\/\/`, que el censo
    cuenta como filtro; ahora usa `new URL(...).pathname`.
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

## Apéndice · 11-nov-2026 (tarde) · obligatorio de #3069 en rojo, arreglado · C.1 a decisión

- **Rojos del obligatorio, los dos míos:** `scrum1233g` (el `capturar.mjs` importaba el banco por una
  ruta absoluta a mi worktree; ahora `../SCRUM-1658/banco/lib.mjs`) y `scrum719`/1395b (el veredicto de
  mudez caducó al tocar `scrum601`; regenerado con `npm run censo:mudez -- --escribir`). Local: 6
  ficheros, 63/63.
- **`guard:lista-trabajos-917` (fuera de la tanda), A.1:** pulsaba `#jobs-partes-valorar`, la puerta
  provisional que esta pieza retira (D1=A c.21461; N2 c.21470). Se cambia la aserción al contrato
  firmado: la cabecera lleva «Trabajos» + «Nuevo trabajo» y la puerta YA NO está. No se afloja: un
  regreso del botón lo pone rojo. El número del menú lo mide `tests/scrum1700-…` (este banco no
  monta el menú).
- **C.1 SIGUE EN ROJO, A PROPÓSITO (regla 41):** «una sola primaria en la lista y es la del dinero»
  (917c) contra N1 «botón principal · Abrir parte». Son dos decisiones del fundador que chocan, y el
  guard tiene razón. No lo toco ni bajo el botón por mi cuenta: el automerge de #3069 queda QUITADO
  hasta que se decida (a) «Abrir parte» secundaria (manda 917c) o (b) N1 manda y C.1 admite las
  «Abrir parte» de los trabajos en curso además de la del dinero.

## Apéndice · 11-nov-2026 (noche) · DECIDIDO (b): C.1 re-anclada a la regla firmada

- **La firma:** el fundador eligió **(b)** en SCRUM-1700 **c.21526**: «cada fila con su primaria y
  nunca dos verdes en la MISMA fila» (texto tal como lo transmite el orquestador en el encargo de S4
  del 11-nov; esta sesión no tiene lectura directa de Jira). Manda N1; 917c queda sustituida en lo
  que dice «una sola primaria en la lista».
- **Rojo con el anclaje viejo, medido antes de tocar:** `node scripts/guard-lista-trabajos-917.mjs`
  → `🔴 C.1 primarias en las filas: 2 ["Abrir parte","💰 Cobrar el resto (740,00 €)"]`, exit 1.
- **Anclaje nuevo** (`scripts/guard-lista-trabajos-917.mjs`, C.1): se mide FILA A FILA; rojo si una
  fila tiene más de una `.btn-primary`, si falta la del dinero o si falta «Abrir parte» en el en
  curso. Verde: `C.1 11 filas, ninguna con dos primarias`, 49/49, exit 0.
- **Control positivo:** mutante en `jobsView.js` que duplica «Abrir parte» en la misma celda →
  `🔴 C.1 dos primarias en la MISMA fila: [["Abrir parte","Abrir parte"]]`, exit 1. Mutante revertido.
- **Lo que NO mide (lectura mía):** «cada fila CON su primaria» no se exige a todas las filas —hoy
  pendientes y agendados no llevan verde, y exigirlo sería construir lo que no se ha pedido—; se
  exige el «nunca dos». Si el fundador lo quiere literal, es otra pieza.
- Automerge de #3069 REARMADO tras el push. Pendiente: verlo en yaqu.app tras el merge (regla 42).
