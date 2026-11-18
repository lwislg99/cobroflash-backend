# SCRUM-1739 — Como mucho UNA rellena por tarjeta: «▶ Empezar» de hoy va rellena y primera (y la mitad-tarjeta de SCRUM-1749)

**Puesto:** S4 · **Rama:** `scrum-1739-una-rellena-por-tarjeta` · 18-nov-2026
**Skill UI:** cargada (`yaqu-premium-ui`; ningún token, color ni clase nueva: se reutiliza `btn-primary btn-sm`, la de «Abrir parte»)
**Medido contra:** `origin/main` = `6881a0d27e8b4e337bd55175c3068791c8304c69` · 2026-11-18T08:08:31Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum1739-una-rellena-por-tarjeta.test.mjs`

## La decisión (no es mía: se cita)

La lista de Trabajos tenía DOS reglas escritas que ya no casaban:

- **917c C.1** (prototipo aprobado ENTERO por el fundador, SCRUM-917 c.15876; `docs/master/SCRUM-917.md`):
  «una sola primaria, la del dinero; Agendar/▶ Empezar en secundaria», con su motivo medido («doce
  "Agendar" verdes idénticos no jerarquizan»).
- **N1** (SCRUM-1700, firmado en SCRUM-1686 c.21470): «Abrir parte», botón principal del trabajo EN CURSO.
  Está en producción desde entonces.

El choque lo midió S4 en el PASO 0 de este ticket y lo resolvió el orquestador en **SCRUM-1739 c.22030**,
por la delegación general de firma (**SCRUM-1656 c.21978**). La regla que queda, para la LISTA:

> Como mucho UNA rellena por TARJETA, y es el paso que hace avanzar el trabajo HOY.

| estado de la tarjeta | la rellena | antes de este ticket |
|---|---|---|
| agendado para HOY (grupo «📅 Hoy») | «▶ Empezar» | secundaria, detrás de «Ver detalle» |
| EN CURSO | «Abrir parte» | igual (control positivo) |
| SIN AGENDAR | ninguna: «Agendar» sigue secundaria | igual (el caso de los doce verdes) |
| TERMINADO con importe y pudiendo facturar | «💰 Cobrar el resto (importe)» | rellena, pero detrás de «Ver detalle» |
| TERMINADO sin importe, o sin poder facturar | ninguna | igual |

No hay texto nuevo: sólo cambia qué botón pesa y en qué orden va.

## El defecto, medido

Recorrido H6 del operario (16-nov, `docs/master/SCRUM-1686.md`, apéndice H6): en la tarjeta de hoy
«▶ Empezar» iba segundo y con contorno; en la de EN CURSO «Abrir parte» iba primero y relleno.

PASO 0 del 18-nov en yaqu.app (cuenta QA, 390 y 1280): 8 tarjetas, 2 rellenas, las dos «Abrir parte».
**La cuenta QA no tiene ningún trabajo agendado** (0 «▶ Empezar»), así que el antes y el después se
fotografían con dos agendados SIMULADOS Y DECLARADOS: la acción cambia en el navegador la respuesta de
`GET /admin/jobs` (los trabajos #83 y #82 pasan a agendado, hoy y +3 días) y no escribe nada en el
servidor. Con eso, el código de producción pinta `□Ver detalle · □▶ Empezar · □⋯` en los dos.

## Lo que cambia

`public/dashboard/js/jobsView.js`, en `jobRow`, y nada más de producto:

1. `bSiguiente` es `btn-primary btn-sm` cuando la acción de la escalera es «▶ Empezar» **y** el trabajo
   cae en el grupo «📅 Hoy». «Hoy» lo decide `grupoDeTrabajo`, la misma función que pinta la cabecera
   del grupo y cuenta la cifra «Para hoy»: no hay una segunda definición de hoy.
2. Cuando la rellena es la acción de la escalera («▶ Empezar» de hoy o «💰 Cobrar el resto»), su caja
   `.jobs-acciones` se monta DELANTE de «Ver detalle», y el «⋯» pasa a colgar de la celda para seguir
   cerrando la fila (SCRUM-1562f). Es orden del DOM, no `order` de CSS: el foco del teclado sigue lo
   que se ve. En las demás filas no se mueve nada.

Ni CSS, ni textos, ni servidor, ni esquema.

## MI LECTURA, para que el orquestador la confirme o la tumbe

- **«▶ Empezar» rellena sólo en el agendado de HOY, no en todo agendado.** c.22030 dice «SOLO en PARA
  HOY/AGENDADO» y también «riesgo… acotado al grupo HOY». Un agendado para otro día no es «el paso de
  HOY», y con relleno el riesgo dejaría de estar acotado al grupo «Hoy». Si se quería todo agendado, es
  quitar una condición (`&& grupoDeTrabajo(j, new Date()) === 'hoy'`) y dos filas del test.
- **«💰 Cobrar el resto» también pasa a ir primero.** La aceptación pide que la acción principal «de cada
  tarjeta» vaya primera; el relleno del cobro no se toca. No se puede fotografiar en la cuenta QA (no
  puede facturar: regla 24); lo ve el banco de vistas y `guard:lista-trabajos-917` con su trabajo de 740 €.

## Regla 41: lo que fijaba «secundaria», mirado ANTES

| quién | qué fijaba | qué se ha hecho |
|---|---|---|
| `tests/scrum412-primaria-nunca-es-sm.test.mjs` | censo de `btn-primary btn-sm`; su comentario decía «SALE `jobsView.js:bSiguiente`: ya no es primaria» | **RE-ANCLADO citando c.22030**: `bSiguiente` vuelve a la lista de declaradas con su motivo. El censo no se relaja: sin la declaración da rojo (mutante M3) |
| `scripts/guard-lista-trabajos-917.mjs` C.1 | «ninguna fila con dos primarias» y «Agendar en secundaria» (ya re-anclado por SCRUM-1700 c.21526) | NO se toca: 49 de 49 con el código nuevo. Sus dos exigencias siguen siendo ciertas |
| `scripts/guard-escalera-por-estado.mjs` | la lista y la ficha proponen lo mismo (`.jobs-acciones > button`) | NO se toca: verde en los cinco estados. La acción sigue siendo hija directa de la única `.jobs-acciones` |
| `tests/scrum1562f-…`, `tests/scrum1562d-…`, `tests/scrum1700-…` | «Ver detalle» fuera de la escalera; teclado; «Abrir parte» primaria | NO se tocan: verdes |

## Cómo se ha medido

- **Banco de vistas** (`tests/scrum1739-una-rellena-por-tarjeta.test.mjs`, 7 pruebas, seis casos fabricados):
  una rellena como mucho y cuál; «Agendar» y el «▶ Empezar» de otro día en secundaria; la rellena va
  primera, «Ver detalle» detrás y el «⋯» cierra; una sola `.jobs-acciones`; sin poder facturar no hay
  cobro ni relleno heredado; el operario ve lo mismo.
- **Mutación, con base** (HEAD `703ea71cade725b2b9677fd0b65fd499a7b3fc4f`; base 24 de 24): seis mutantes,
  seis muertos, cada uno con su `numstat` y el árbol restaurado limpio. M1 «▶ Empezar» vuelve a secundaria
  (5 caen) · M2 rellena cualquier agendado (3) · M3 sin la declaración de scrum412 (1: la PROHIBICIÓN) ·
  M4 la caja ya no va delante (3) · M5 toda la escalera rellena (3) · M6 el «⋯» vuelve a la caja (1).
- **Tanda dirigida** (los 38 ficheros de `tests/` que nombran la lista de Trabajos, más los dos censos de
  `public/dashboard/js`): 365 pruebas, 0 fallos, 0 saltos. NO es la suite completa: ésa la corre el CI.
- **Navegador:** `guard:lista-trabajos-917` 49 de 49 (pulsa «▶ Empezar»: `PATCH /admin/jobs/3
  {"status":"en_curso"}`, no navega; abre el «⋯» de esa fila) · `guard:escalera-por-estado` verde.
- **yaqu.app con el fichero del árbol encima** (`evidencias/SCRUM-1739/c1739-primaria.mjs`), admin y
  operario simulado:

| ancho | tarjetas | rellenas | «▶ Empezar» rellena | «Agendar» rellena | dos rellenas en una | rellena que no va primera | desbordes |
|---|---|---|---|---|---|---|---|
| 390 antes | 8 | 2 | 0 de 2 | 0 de 2 | 0 | 0 | 0 |
| 390 después | 8 | 3 | 1 de 2 (la de hoy) | 0 de 2 | 0 | 0 | 0 |
| 1280 antes | 8 | 2 | 0 de 2 | 0 de 2 | 0 | 0 | 0 |
| 1280 después | 8 | 3 | 1 de 2 (la de hoy) | 0 de 2 | 0 | 0 | 0 |
| 768 después | 8 | 3 | 1 de 2 | 0 de 2 | 0 | 0 | 0 |
| 320 después | 8 | 3 | 1 de 2 | 0 de 2 | 0 | 0 | 1 (el desplegable de técnicos, x=357: SCRUM-1757, ya en producción) |

  «▶ Empezar» mide 91×44 en los cuatro anchos, con el fondo `rgb(4, 120, 87)` de «Abrir parte».
  El banco anota dos `POST /admin/entorno → 200` por pasada: es la telemetría del panel al cargar (la
  página se recarga una vez), no una escritura de la acción.

Capturas, en `docs/master/evidencias/SCRUM-1739/`: `antes-` y `despues-lista-admin-390.png`,
`…-admin-1280.png`, `…-tecnico-390.png`.

## Lo que NO se ha medido

- Un trabajo agendado DE VERDAD en la cuenta QA: los dos son simulados en el navegador. Es la regla 42
  de este ticket, tras el despliegue: agendar un trabajo QA para hoy y verlo relleno y primero.
- «💰 Cobrar el resto» primero, en yaqu.app y a 390: la cuenta QA no puede facturar.
- La FICHA (`jobDetailView`): la iguala S2 en SCRUM-1749. Este ticket deja la tarjeta TERMINADO sin
  rellena cuando no hay cobro —«Enviar para firmar» sigue secundaria en la tarjeta—, por c.22030.
- Android de gama media y iPhone reales: sólo anchos de navegador de escritorio.

## Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| En «HOY», «▶ Empezar» es la primera acción y usa la variante primaria; las demás, secundarias. | `tests/scrum1739-una-rellena-por-tarjeta.test.mjs` (casos AGENDADO-HOY y operario) · `evidencias/SCRUM-1739/despues-lista-tecnico-390.png`. En yaqu.app con dato real: PENDIENTE de la regla 42 |
| En «EN CURSO» nada cambia (control positivo). | mismo test (caso EN-CURSO) · «Abrir parte» 2 de 2 rellenas antes y después, en la tabla de arriba |
| Capturas antes/después a 390 y 1280 con el banco del recorrido. | `docs/master/evidencias/SCRUM-1739/` (seis PNG) |
| SCRUM-1749, mitad-tarjeta: misma primaria por estado en tarjeta y ficha, o razón escrita | la tabla «La decisión» de arriba es la razón escrita de la TARJETA · la ficha: NO HECHO aquí → S2, SCRUM-1749 |
