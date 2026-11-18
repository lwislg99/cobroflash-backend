# SCRUM-1751 — «¿Empezar una visita nueva?»: se pregunta antes de crear el parte de otra visita

**Puesto:** S4 · **Rama:** `scrum-1751-aviso-visita-nueva` · 17-nov-2026
**Skill UI:** cargada (`yaqu-premium-ui`). `DESIGN.md` y la Parte AB no se releyeron en esta sesión: el cambio no trae token, color, sombra ni clase nueva; usa el modal de la casa (`jobsModal`) y las clases que ya tenía.
**Medido contra:** `origin/main` = `e5145bc54e9709de09ac362a6d6c4d156bb32ac4` · 2026-11-17T17:11:57Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `scripts/capturas-aviso-visita-nueva.mjs`

## Qué pasaba

Las dos puertas al parte crean uno cuando no encuentran un borrador que abrir: «Abrir parte», en la fila del trabajo en curso de la lista, y «+ Nuevo parte», en la ficha. Con el último parte del trabajo ya firmado lo creaban sin decir nada. Quien entraba a mirar lo de la visita anterior salía con un parte vacío recién creado.

Visto corriendo antes de tocar nada: el test nuevo, sobre el código de `main`, cae en 10 de sus 16 casos (commit `470ca2aa0`), todos por lo mismo: se pulsa la puerta, se crea el parte y no sale ningún aviso.

## Qué cambia

- `public/dashboard/js/jobDocsReparto.js`, junto a `borradorDeHoy`: la regla `pideAvisoDeVisitaNueva` (último parte firmado y ningún borrador), el texto `AVISO_VISITA_NUEVA` y `avisarDeVisitaNueva`, que lo pinta en `jobsModal`. Una sola regla y un solo aviso para las dos puertas.
- `public/dashboard/js/jobsView.js` y `public/dashboard/js/jobDetailView.js`: cada puerta, antes de crear, pregunta a la regla. Si toca avisar, el alta sale del botón «Crear parte nuevo»; «Cancelar», Escape o pulsar fuera cierran sin crear nada.
- Con un borrador, todo como estaba: la lista abre el borrador; la ficha abre el de hoy y, si el borrador es de otro día, crea sin avisar. Sin ningún parte, crea sin avisar.
- Si falta `jobsModal`, no se crea nada: sale el aviso de fallo que ya había.

`jobDetailView.js` y `jobDocsReparto.js` son del carril de S2; las dos puertas van con S4 por este encargo del orquestador.

## El texto

Firmado por el orquestador por delegación (SCRUM-1656 c.21978), en SCRUM-1751. Ficha: `docs/microcopy/2026-11-17-SCRUM-1751-aviso-visita-nueva.md`. Título, cuerpo y «Crear parte nuevo» son nuevos; «Cancelar» es el que `jobsModal` ya ponía.

## El test

`tests/scrum1751-aviso-de-visita-nueva.test.mjs`: 16 casos. Dos sobre la regla sola (9 combinaciones de partes) y 14 sobre las dos puertas montadas con los scripts reales del panel: sale con firmado y sin borrador, con el texto literal y sin crear; «Crear parte nuevo» crea uno y lo abre; «Cancelar» no crea y deja la puerta viva; si el alta falla se dice; no sale con borrador ni sin partes; en la ficha, tampoco con un borrador de otro día; en la lista, tampoco por el firmado de otro trabajo.

Auditado por mutación sobre `102a7e1df`, con la base en verde (16 de 16):

| mutante | resultado |
|---|---|
| la regla ignora el borrador | cae |
| el cuerpo pierde una palabra | cae (2 casos, y `scrum514` contra la ficha) |
| crea sin esperar al clic | cae |
| la regla avisa sin partes firmados | cae |
| «Crear parte nuevo» deja de ser la primaria | cae |

Dos tests que ya existían cambian con el comportamiento, y se dice:

- `tests/scrum1700-abrir-parte-y-partes-por-valorar.test.mjs`, caso ③ «sin borrador (sólo uno firmado)»: exigía crear a secas. Ahora exige que no cree ni navegue sin preguntar y que cree al aceptar. Es el cambio que pide el ticket, no un test relajado: lo que ataba (no abrir el firmado, crear el de este trabajo) sigue atado.
- `tests/scrum412-primaria-nunca-es-sm.test.mjs`: «Crear parte nuevo» se declara como botón de modal, con su motivo, igual que el de «Agendar».

## Capturas

En `docs/master/evidencias/SCRUM-1751/`, sacadas por `scripts/capturas-aviso-visita-nueva.mjs` con datos de prueba, sobre el árbol ya fusionado con `main`:

| captura | el aviso | botones |
|---|---|---|
| `aviso-lista-390.png` | 390×184, hoja inferior, cabe | 80×44 y 133×44 |
| `aviso-ficha-390.png` | 390×184, hoja inferior, cabe | 80×44 y 133×44 |
| `aviso-lista-1280.png` | 420×170, centrado, cabe | 80×30 y 133×30 |
| `aviso-ficha-1280.png` | 420×170, centrado, cabe | 80×30 y 133×30 |

En las cuatro, el texto no se corta y no hay desplazamiento horizontal. Los 44 px a 390 los da el bloque de SCRUM-1745 (`.jobs-modal`), que entró en `main` con #3193: antes de fusionar, este mismo aviso medía 30.

## Lo que salió mal (A9)

El script de capturas dio «el aviso NO salió» a 390, una pasada sí y otra no. Lo achaqué a la carga de la máquina y subí la espera de 5 a 20 s: seguía fallando. Hasta que el propio script dijo dónde había caído el clic no se vio la causa: desplazaba la puerta al centro con desplazamiento suave y pulsaba con la pantalla aún moviéndose, así que el clic caía en la tarjeta de la fila y navegaba a la ficha. No era el producto. Ahora el script desplaza sin animación, espera a que la puerta lleve cinco fotogramas quieta y, si el aviso no sale, dice qué había bajo el clic y adónde se navegó. Cuatro pasadas seguidas, 4 de 4.

## Lo que NO está medido

- Nada en yaqu.app: la rama no está desplegada. La regla 42 queda pendiente (en la cuenta de QA hay un parte firmado, el #22, y uno en borrador, el #23).
- Con lector de pantalla no se ha probado. El modal lleva `role="dialog"` y el foco entra en «Crear parte nuevo».
- La tanda completa la juzga el CI; aquí se corrió la dirigida.
