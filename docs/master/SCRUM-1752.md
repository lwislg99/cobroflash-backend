# SCRUM-1752 — Los tres avisos de la casilla dicen «Desplazamientos», y su rótulo ya no parte el paréntesis a 390

**Puesto:** S4 · **Rama:** `scrum-1752-avisos-desplazamientos-plural` · 17-nov-2026
**Skill UI:** cargada
**Medido contra:** `origin/main` = `e5145bc54e9709de09ac362a6d6c4d156bb32ac4` · 2026-11-17T17:41:52Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum1752-avisos-desplazamientos-plural.test.mjs`

## La firma

**Orquestador, por delegación del fundador, 17-nov-2026 — SCRUM-1752 comentario 21987** (la delegación
general de firma es SCRUM-1656, comentario 21978). S4 propuso los tres literales antes de escribir nada
y se aprobaron tal cual. Ficha: `docs/microcopy/2026-11-17-SCRUM-1752-avisos-desplazamientos-plural.md`.

## El defecto, medido

Desde SCRUM-1746 la casilla del parte se rotula «Desplazamientos (nº de viajes)». Dos cosas quedaron
fuera de aquel ticket y están en su registro como pendientes:

1. **Los tres avisos de la casilla seguían en singular.** En yaqu.app (cuenta QA, parte #23, 390×844),
   bajo la casilla «Desplazamientos (nº de viajes)» el aviso decía «No se ha guardado. Desplazamiento es
   un número entero, como 1 o 2 — no el tiempo de viaje».
2. **A 390 el rótulo se partía por dentro del paréntesis:** «Desplazamientos (nº de» / «viajes)», en el
   borrador (#23) y en el firmado (#22).

PASO 0: sin rama ni commit de SCRUM-1752 en `origin`. El test nuevo, sobre `main`: 4 rojos de 5 (el
quinto fija lo que no cambia y sale verde).

## Lo que cambia

| fichero | qué |
|---|---|
| `public/dashboard/js/parteDetailView.js` | los tres literales, una letra cada uno, con su marca `APROBADO · SCRUM-1752 comentario 21987`. |
| `public/dashboard/css/styles.css` | bloque de S4: `.parte-horas-par .parte-campo-rotulo { text-wrap: balance; }`. |
| `docs/microcopy/2026-11-17-SCRUM-1752-avisos-desplazamientos-plural.md` | la ficha de la firma. |
| `tests/scrum1752-avisos-desplazamientos-plural.test.mjs` | el test, rojo primero. |
| `tests/scrum1491-…`, `tests/scrum1492-…`, `tests/scrum1746-…` | fijaban los literales en singular, letra a letra: pasan a fijar los aprobados hoy. No se relaja ninguna comprobación; cambia el texto esperado, con su firma. |
| `docs/master/evidencias/SCRUM-1752/c1752-parentesis.mjs` | la acción del banco que lee por dónde se parte el rótulo y qué dice el aviso. |

| aviso | antes | ahora |
|---|---|---|
| no es un número entero | «No se ha guardado. Desplazamiento es un número entero, como 1 o 2 — no el tiempo de viaje» | «No se ha guardado. Desplazamientos es un número entero, como 1 o 2 — no el tiempo de viaje» |
| negativo | «No se ha guardado. Desplazamiento es 0 o más» | «No se ha guardado. Desplazamientos es 0 o más» |
| no cabe | «No se ha guardado. Ese número es demasiado grande para Desplazamiento» | «No se ha guardado. Ese número es demasiado grande para Desplazamientos» |

El verbo se queda en «es», como en los avisos gemelos de Kilómetros: la palabra nombra la casilla.

**El paréntesis.** `text-wrap: balance` reparte las líneas de un texto que ya ocupa más de una, y el
salto cae entre el nombre y su unidad. No cambia el texto, el tamaño de letra ni el ancho del par. Ni un
color ni un token nuevo.

## Medido en la página real, antes de empujar

Banco H6 (`paso2.mjs`) + `c1752-parentesis.mjs`, cuenta QA, rol admin. «Antes» es lo que sirve
producción; «después», producción con `parteDetailView.js` y `styles.css` de esta rama servidos encima
(el testigo de la acción confirma en cada pasada qué código corre).

| pasada | líneas del rótulo, borrador (#23) | líneas del rótulo, firmado (#22) |
|---|---|---|
| antes · 390 | «Desplazamientos (nº de» / «viajes)» | «Desplazamientos (nº de» / «viajes)» |
| después · 390 | «Desplazamientos» / «(nº de viajes)» | «Desplazamientos» / «(nº de viajes)» |
| después · 360 | «Desplazamientos» / «(nº de viajes)» | «Desplazamientos» / «(nº de viajes)» |
| después · 320 | «Desplazamientos» / «(nº de viajes)» | «Desplazamientos» / «(nº de viajes)» |
| después · 1280 | una línea | una línea |

Sin desborde horizontal en ninguna. El aviso, a 390, tras teclear «1e» en la casilla: antes
«…Desplazamiento es un número entero…»; después «…Desplazamientos es un número entero…». Escrituras de
todas las pasadas: sólo `POST /admin/entorno`.

## Verde

- `tests/scrum1752-…` + los tres tests adaptados: 36 de 36.
- La tanda dirigida de la rama, en el informe de entrega.

## Lo que NO está hecho o no se ha medido

- **Regla 42:** falta verlo en yaqu.app tras el merge.
- **Los avisos de «negativo» y «no cabe» no se han visto en la página real**, sólo en el test: para
  sacarlos hay que mandar el número a la ruta, y eso es una escritura. El de «número entero» sí.
- **Un navegador que no reparta líneas** (Safari anterior a 17.5, Firefox anterior a 121): el rótulo se
  parte como antes. No se ha medido en ninguno; sólo Chromium con emulación.
- **Hallazgo, fuera de este ticket:** con la casilla VACÍA, teclear «1e» y salir no saca el aviso en
  Chromium: el navegador no dispara `change` (para él el valor sigue siendo «»), la casilla se queda
  enseñando «1e» y no se guarda ni se dice nada. La acción despacha el `change` a mano para leer el
  literal, y lo declara. Con un dato ya guardado el aviso sí sale (SCRUM-1492). No medido en un móvil
  de verdad. Avisado al orquestador, que lo ha abierto como SCRUM-1754.

## Lo que salió mal por el camino (A9)

- **El primer rojo no era del producto.** El árbol nació sin `dist/` y los cinco casos cayeron con
  `MODULE_NOT_FOUND`, también el que fija lo que NO cambia. Ese caso es el que lo delató: un test de
  «rojo primero» en el que cae hasta el control no ha medido nada. Compilado, el rojo fue el bueno
  (4 de 5).
- **Dos rojos míos que sólo sacó la tanda ancha**, y por poco: el sistema la mató por falta de memoria
  con 3 lotes de 4 hechos (600 ficheros de 723), y los leí del TAP que dejó. (1) `SCRUM-514`: las fichas
  de SCRUM-1491 y SCRUM-1492 seguían citando con `>` el literal en singular, y una cita en una ficha es
  un texto firmado que el código debe pintar; pasan a decir que ya no es el vigente, sin `>`, con la
  firma que lo sustituye. (2) `SCRUM-700`: mi test estrenaba su propio filtro de comentarios; usa el de
  la casa (`soloEjecutable`). Los otros tres rojos de esos lotes son de entorno y ya conocidos
  (`SCRUM-1199` ×2 y `SCRUM-476`). **El cuarto lote (123 ficheros) no llegó a correr aquí**: lo cubre el
  CI. Después, en estrecho: `scrum514`, `scrum700`, `scrum1334`, `scrum1294`, `scrum1233g`, `scrum1157`
  y el test nuevo, 68 de 68.
- **El lector del aviso salió vacío dos veces** y la acción lo dio por CIEGO (código 1), no por limpio:
  buscaba el texto por toda la página y el aviso no había llegado a pintarse (el hallazgo de arriba).

## Tres rojos del CI tras el push (17-nov-2026, PR #3198, run 44143134291) — los tres de esta rama

- `SCRUM-709`: las fichas de 1491 y 1492 nombraban el fichero de la ficha nueva, y eso es un índice a mano. Ahora dicen «con su ficha en esta carpeta».
- `SCRUM-1395`: el test nuevo llamaba a `soloEjecutable` sin suelo. Pasa a `ejecutableDe` con el selector de ancla.
- `SCRUM-1395b`: el test nuevo no tenía ficha en `tests/_veredicto-mudez.json`. Regenerado con `npm run censo:mudez -- --escribir`.

Los tres estaban en el lote que no llegó a correr en local (la tanda de 723 la mató la memoria). Después: 16 ficheros en estrecho, 178 de 178.
