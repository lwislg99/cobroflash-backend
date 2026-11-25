# SCRUM-1847 · la lista de Clientes (`renderCustomersView`) a 44 px de toque (AB6)

**Medido contra:** `origin/main` = `bdd808ebe9bae708028e8aab87c52bc7b0ee6a28` · 2026-11-25T03:07:33Z (hora de GitHub; al escribir, 03:15:29Z y main ya en `e28f3582ec13e3c6102245a33bab02e4e7fa2370`, que sólo añade en `styles.css` un bloque de la ficha 360, lejos de éste)
A9: comprobación → `tests/scrum1847-clientes-44.test.mjs`
**Skill UI:** no cargada · error mío: no la abrí antes de editar `styles.css` (la misma omisión que mi cicatriz J2 del 2026-11-21); el cambio es sólo `min-height`/`min-width` dentro de un contenedor, con la regla de DESIGN.md (excepción de `btn-sm`) leída en SCRUM-1845 c.22728, y sin color, tipografía, espaciado ni texto

jv-j2ev (J2). Nace de la lista J del censo de SCRUM-1845 (rama `scrum-1845-censo-tactil-por-carril`, PR #3431) y de la decisión del fundador SCRUM-1845 c.22728.

## PASO 0

0 commits en main con SCRUM-1847, 0 ramas `scrum-1847*` (control positivo en el mismo `ls-remote`: `scrum-1843-marcar-cobrada-44` y `scrum-1845-censo-tactil-por-carril`, vivas), 0 PR del ticket (la búsqueda «1847» devuelve el PR #1847, que es de SCRUM-1174), sin registro previo. Etiquetas `area-j2` y `equipo-javier`. `customersView.js` es de J2; `styles.css` es contenedor de S2 y J2 añade su bloque marcado.

## La regla (c.22728)

Un `.btn-sm` que NO es la primaria de su pantalla se queda (DESIGN.md, la excepción de `btn-sm`, de Luis, SCRUM-368); un `.btn-sm` que hace de primaria y todo lo demás por debajo de 44 se cura.

## Antes y después (px de toque, árbitro `__areaDeToque`, Edge de esta máquina)

Lo da el propio test (`t.diagnostic`): `evidencias/SCRUM-1847/rojo.txt` (antes) y `evidencias/SCRUM-1847/verde.txt` (después). Lista con los 3 clientes de `CLIENTES_DE_MUESTRA`; lista vacía con `paginaDeVista` sin clientes.

| elemento | clase | ¿primaria? | 390 antes → después | 1280 antes → después | qué |
|---|---|---|---|---|---|
| «Nuevo cliente» | `BUTTON.btn-primary` | sí | 45 → 45 | 37 → 45 | curado |
| buscador | `INPUT.input` | — | 45 → 45 | 39 → 45 | curado |
| «Todas las etiquetas» | `SELECT.input` | — | 45 → 45 | 39 → 45 | curado |
| «Más recientes» | `SELECT.input` | — | 45 → 45 | 39 → 45 | curado |
| teléfono (×3) | `A.contacto-link` | — | 45 → 45 | 41,8 → 44 | curado |
| 💬 (×3) | `A.contacto-link.contacto-link--icono` | — | 45 → 45 | 37 → 45 | curado |
| «+ Añadir cliente» (lista vacía) | `BUTTON.btn-primary.btn-sm.clientes-vacio-cta` | sí (de la lista vacía) | 30,7 → 44,7 | 30,8 → 44,8 | curado; el censo no lo vio (su banco tenía clientes) |
| «⬆ Importar clientes» | `BUTTON.btn-secondary.btn-sm` | no | 45 | 37 | exento por c.22728 |
| «⬇ Clientes CSV» | `A.btn-secondary.btn-sm` | no | 45 | 37 | exento por c.22728 |
| «Editar» (×3) | `BUTTON.btn-secondary.btn-sm` | no | 44,6-44,8 | 36,5-36,9 | exento por c.22728 |
| «Portal» (×3) | `BUTTON.btn-secondary.btn-sm` | no | 44,6-44,8 | 36,5-36,9 | exento por c.22728 |
| «📊 Historial» (×3) | `BUTTON.btn-ghost.btn-sm` | no | 44,6-44,8 | 36,5-36,9 | exento por c.22728 |

Los 21 del censo: 10 curados (1 + 1 + 2 + 3 + 3) y 11 exentos (2 + 9). Los exentos siguen con lo de SCRUM-1149 (36 en escritorio, 44 en móvil): el caso ① del test lo comprueba como CONTROL a 1280 (ninguno sube a 44). A 390 los diez ya daban 44 o más antes de la cura: el defecto era de escritorio, como decía el censo («929»).

## La cura

Bloque `/* J2: SCRUM-1847 … */ … /* J2: fin del bloque SCRUM-1847 */` en `public/dashboard/css/styles.css`, con el ancla de SCRUM-1149 (`.data-card:has(> .barra-seleccion)`), sólo `min-height`/`min-width`, sin JS, sin texto, sin clase nueva en el marcado y sin tocar `.input`, `.btn-primary`, `.btn-sm` ni `.contacto-link` globales. Pesa (0,3,0) y gana a `.btn.btn-sm` (0,2,0).

🔴 **Error mío, cazado por el test:** puse el bloque primero justo detrás del de 1149 y el buscador y los `select` se quedaron en 39 a 1280. Lo ganaba la regla J2 de SCRUM-1584/1592b (`… .data-card-toolbar > .input { min-height: 38px }`, peso (0,4,0), más abajo en la hoja), que no busqué antes de escribir. El bloque va ahora DETRÁS de ésa, con un selector de la barra del mismo peso que gana por orden; la regla de 1584 no se reescribe (también fija `#c360-meta`, de la ficha 360). `tests/scrum1592-campos-clientes-44.test.mjs` sigue verde (4/4).

## Comprobaciones

- `tests/scrum1847-clientes-44.test.mjs`: ROJO antes de la cura (0 de 3) y VERDE después (3 de 3). ① la lista a 390 y 1280 (suelos: ≥ 10 a curar y ≥ 11 exentos pintados, un botón sembrado de 30 px sale corto, la fuente cargó); ② la lista vacía; ③ sin navegador: cada selector cuelga del ancla, ninguno toca un `.btn-sm` que no sea `.clientes-vacio-cta`, sólo hay `min-height`/`min-width`, y el ancla `barra-seleccion` sólo la escribe `customersView.js` (sobre todo `.js`/`.html` de `public/`). El troceo del CSS es el de la casa (`ejecutableDe`, `almohadillaEsComentario: false`) con la cuenta de llaves de 1843b.
- `scripts/guard-objetivo-tactil.mjs` cubre esta pantalla (PANEL, desde SCRUM-782) a 929 y 390: 0 cortos en los dos anchos, `EXCEPCIONES_PANEL` ya vacía; no queda sobrante que endurecer. Su mínimo a 929 es 36 (`MINIMO_ESCRITORIO`), así que la cura de escritorio a 44 no la ve él: la ve el test nuevo. El guard salió **2 (CIEGO), no verde**: 4 «FUENTE ROTA en /» (3 de 41 caras de la landing no bajaron en esta máquina). No lo comparé contra main sin mi cambio.
- Capturas: `evidencias/SCRUM-1847/antes-390.png`, `antes-1280.png`, `despues-390.png`, `despues-1280.png` (guion `evidencias/SCRUM-1847/capturas.mjs`). A 390 antes y después pesan lo mismo (65.992 B): nada cambia en móvil.

## Lo que no está medido

- 929, el ancho del censo: el test mide 390 y 1280; a 929 sólo lo midió el guard, contra 36.
- DESIGN.md pide 36 en escritorio; el ticket y la tanda AB6 (1841, 1843) curan a 44 en todas las anchuras. Sigo al ticket; si el fundador quiere 36 en escritorio, el bloque se quita entero.
- La barra de selección (aparece al marcar una fila; su campo de etiquetas es `.input` y entra en la regla) no se ha medido: el test monta la lista sin seleccionar, como el censo.
- yaqu.app: no verificado (sin desplegar).

# SCRUM-1847b · relevo: el motivo del salto, dentro de la llamada (jv-j2ez, carril J2)

**Medido contra:** `origin/main` = `c83ebdbea13a426c2a3e3b5655fca37567d62300` · 2026-11-25T03:47:21Z (hora de GitHub; los tests corrieron sobre la punta de la rama, `a07fb887db1d77bf8c15f6564b719a775547f85d` más este cambio, 3 commits por detrás de ese main; `git merge-tree` con main sale limpio)

A9: comprobación → `tests/scrum419-ci-declara-lo-que-no-corre.test.mjs`

**Qué cayó:** el PR #3433 salió rojo en CI por un caso, el de SCRUM-456 («todo salto declara su motivo»), que vive en el test de SCRUM-419. Su criterio (`declaraMotivo`) es estructural: la expresión del `skip:` tiene que llevar dentro un literal de cadena. Los casos ① y ② de este test pasaban `{ skip: SALTO }`, una constante: el motivo existía, pero el guard lee el fuente y en la llamada sólo ve un identificador.

**Qué cambia:**
- `tests/scrum1847-clientes-44.test.mjs`: la expresión del motivo va DENTRO de las dos llamadas a `test()`, como en el test de SCRUM-1841, y la constante desaparece (no la usaba nadie más). Ni el guard ni los nombres de los casos cambian.
- `tests/_veredicto-mudez.json`: una línea, la de este fichero, con su generador (`npm run censo:mudez -- --escribir`, 1 medido de 144). La clase sigue VIVO; sólo cambia el hash, de `a018d8aa199adae5` a `2bb0372d3e28a5bc`. Va fuera de los dos ficheros del encargo porque el test de SCRUM-719 cae en rojo si no se regenera («el fichero cambió desde la medida»). Es consecuencia mecánica del arreglo, y no se edita a mano.

## Comprobaciones (1847b)

| qué | antes | después |
|---|---|---|
| `tests/scrum419-ci-declara-lo-que-no-corre.test.mjs` | 7 de 8, el que cae nombra los dos casos (el mismo rojo que CI) | 8 de 8 |
| `tests/scrum1847-clientes-44.test.mjs` | — | 3 de 3, 0 saltados (hay navegador en esta máquina) |
| 237, 976, 700, 1294, 267 (guards de suite, juntos) | — | 42 de 42 |
| `tests/scrum719-el-suelo-de-los-doce.test.mjs` | 36 de 37 (el hash) | 37 de 37, después de regenerar el veredicto |
| `npm run build` (`tsc`, con tipos) | — | salida 0 |

## Lo que no está medido (1847b)

- La suite entera no se ha corrido: el encargo lo prohibía.
- La rama del salto (sin navegador) no se ha ejercitado: aquí hay navegador, así que no he visto el motivo impreso en el TAP. Lo que demuestra que ahora lo declara es el guard de SCRUM-419, que lee el fuente.
- El test de SCRUM-419 no está entre los 21 de `npm run guards:entrada`, y por eso este salto pasó en local y sólo cayó en CI. Meterlo ahí no es de este carril ni de este encargo: se lo digo al orquestador.
