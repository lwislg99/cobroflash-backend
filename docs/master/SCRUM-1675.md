# SCRUM-1675 · PARTES · P0 · Lo dictado se pierde al recargar (PILOTO-1)

**S4 · 10-nov-2026 · rama `scrum-1675-dictado-sobrevive-recarga` · medido sobre `origin/main` = `5986d520a77dc7076ad86ea656e1550ee75c7215`** (hora de GitHub al medir en pantalla: 17:45Z).

**Skill UI:** no cargada · cambio de CONDUCTA sin cambio visual: ninguna clase, estilo, rótulo ni texto nuevo; la pantalla recuperada se pinta con el mismo código que la recién dictada (capturas `despues-1` y `despues-2` idénticas).

Ticket nacido del recorrido de SCRUM-1658 (parte #13 a 390). Etiquetas `piloto-1` · `equipo-luis` · `area-s4`. Carril: `public/dashboard/js/parteDetailView.js` = S4 (`dos-equipos.md:149`).

## La causa, con ruta:línea (en `5986d520a`)

| dónde | qué |
|---|---|
| `public/dashboard/js/parteDetailView.js:786` | `pintarDictado()` pinta el `<textarea>` del dictado **siempre vacío** |
| `parteDetailView.js:751` | `renderParte` lo llama en cada pintado del parte editable |
| `parteDetailView.js:1064-1100` (`ordenarElDictado`) | la propuesta sólo vive en el DOM (`[data-dictado-propuesta]`): nada la guarda |
| ningún sitio | el texto del dictado no se guarda ni en el servidor ni en el móvil (la única constancia local de la vista es la de `colaDeFirmas.js`) |

Y no era sólo la recarga: **cualquier repintado** del parte (`renderParteDetailView`) se lo llevaba igual — un campo que no se guarda (`:1548`), quitar una línea (`:1875`), un 409/404 al ordenar o añadir (`:1189`, `:1363`).

## El arreglo (sólo front, sin texto nuevo)

Un borrador **por parte, en el móvil** (`localStorage`, clave `yaqu_parte_dictado_<id>`), con lo que ya está en pantalla:

- el **texto** del dictado (se guarda en cada `input` del cuadro);
- la **propuesta** que devolvió «Ordenar en líneas» (se guarda al pintarse; si vino vacía, se quita);
- lo que el técnico **corrigió** en ella (cantidades, descripciones, «Sin colocar»), campo a campo.

Al pintar un parte editable se recupera todo y la propuesta vuelve **atada** («Añadir al parte» con su escucha — la lección de SCRUM-706; el atado es ahora una sola función, `atarLaPropuesta`, para los dos caminos). Se **borra** al «Añadir al parte» (si no, se añadiría dos veces), cuando el parte ya no se puede tocar (firmado), a los 7 días, y **al cerrar sesión**.

**Por qué en el móvil y no en el servidor:** la ruta del dictado NO escribe a propósito (SCRUM-683b ④: lo que lee una máquina no entra en un documento que se firma sin que el técnico lo mire). Guardarlo en el servidor habría sido la mitad de S1 y un cambio de esa decisión.

**Sin almacén** (ventana privada, bloqueado, lleno) todo sigue como antes: no lanza, y el dictado vive en pantalla hasta recargar.

### El cierre de sesión, y un punto ciego del censo de SCRUM-457

Lo dictado lleva datos de la obra (qué se hizo, en casa de quién). La clave está en `CLAVES_LOCALES` de `public/dashboard/js/almacenLocal.js` con **`purga: true`** y su motivo: el logout la borra. ⚠️ `almacenLocal.js` es de **S2** (no está en las excepciones de su carril): he añadido SÓLO mi entrada, marcada `SCRUM-1675 (S4)`, porque sin ella el guard de SCRUM-457 cae (y debe caer).

**Hallazgo (no es mío arreglarlo):** mi primera versión escribía con `var a = window.localStorage; a.setItem(k, …)` y el guard `tests/scrum457-logout-purga-claves.test.mjs` **salía VERDE** sin la clave registrada. El censo (`tests/_censo-almacenamiento-publico.mjs:69`) reconoce una escritura por el NOMBRE del receptor (`localStorage` / `sessionStorage`), así que un alias le es invisible: «no pude mirar» con forma de «no hay nada». Lo cambié a `window.localStorage.setItem(\`yaqu_parte_dictado_${n}\`, …)` y el guard se puso ROJO nombrando `parteDetailView.js:858`; con la entrada en el registro, verde. Va al orquestador para quien lleve los censos.

## Test que falla sin el cambio

`tests/scrum1675-dictado-sobrevive-a-la-recarga.test.mjs` — cada test «recarga» de verdad: vuelve a evaluar la vista en un contexto NUEVO con el mismo almacén del móvil.

| | con `parteDetailView.js` y `almacenLocal.js` de `origin/main` | con la rama |
|---|---|---|
| ① el texto sigue en el cuadro tras recargar | ✖ | ✔ |
| ② la propuesta vuelve, sin llamar al modelo, con «Añadir al parte» vivo, y añadir guarda y borra el borrador | ✖ | ✔ |
| ③ un parte firmado borra lo que quedaba dictado | ✖ | ✔ |
| ④ sin almacén no lanza | ✖ (en main el cuadro no tiene escucha) | ✔ |
| ⑤ la clave está registrada con `purga: true` | ✖ | ✔ |

`scrum457` (logout): 7/7 en la rama; 6/7 con la escritura sin registrar (rojo visto, ver arriba).

**Tanda entera** (`node --test --test-force-exit "tests/*.test.mjs"`, árbol con `node_modules` de sólo `typescript` y `dist` emitido con tsc): 13050 tests · 12871 pass · **15 fail** · 164 skip. Los 15, uno a uno:

| test | por qué | ¿mío? |
|---|---|---|
| SCRUM-385 ×3, SCRUM-475 ×3, SCRUM-471 | no hay CLI de Prisma ni bases en este árbol | no (entorno) |
| SCRUM-1199 ×2 | `Cannot find module …/node_modules/express` | no (entorno) |
| SCRUM-1244c, SCRUM-1321 | de entorno, ya medidos así en mis traspasos (temporal en C: con el repo en D:) | no |
| SCRUM-976 ④ | ejecuta el comando de verdad, que necesita el entorno completo; «el presupuesto se juzga en CI» | no |
| SCRUM-1266b «corregir una descripción y añadir una línea nueva» | INTERMITENTE, de tiempos (`dormir(80)` con un servidor lento doblado; no toca el dictado). Medido: **1/8 rojas con los ficheros de main, 0/8 con la rama** | no (preexistente) |
| SCRUM-1340 (`scrum811c`) y SCRUM-854 | pedían este registro con su `**Skill UI:**`; la tanda corrió antes de escribirlo | se cierran con este fichero |

## Verificación EN PANTALLA en yaqu.app

Cuenta QA (merchant 46, comprobado por `/admin/me`), parte **#11** (borrador, editable; elegido por sonda de sólo GET, `banco/sondear.mjs`). Banco `docs/master/evidencias/SCRUM-1675/banco/verificar.mjs` (playwright-core + chrome-headless-shell, service workers bloqueados). «Después» = los dos ficheros servidos desde este árbol con `route.fulfill` (control: `servidasDesdeElArbol` lista los dos). **No se escribió nada en el parte:** toda petición no-GET a `/admin/partes/**` que no fuera `/dictado` se abortaba y contaba → `escriturasAbortadas: []` en las cuatro pasadas; «Añadir al parte» no se pulsó. `/dictado` devuelve una propuesta y no guarda (683b ④).

| pasada | antes de recargar | tras recargar |
|---|---|---|
| **antes** (producción), 390 | dictado escrito · 4 líneas propuestas | **dictado `""` · 0 líneas** — el defecto, reproducido |
| **después**, 390 | dictado · 3 líneas · clave en el móvil | **dictado idéntico · 3 líneas · «Añadir al parte» presente** |
| **después**, 1280 | dictado · 4 líneas | **dictado idéntico · 4 líneas · «Añadir al parte» presente** |
| **después + corrección**, 390 (cantidad «2» en la 1ª línea) | cantidad 2 · «Añadir» encendido | **cantidad 2 · «Añadir» encendido** |

«Añadir al parte» sale apagado en las dos pasadas sin corregir, ANTES y DESPUÉS de recargar por igual: las líneas vienen sin cantidad («Falta la cantidad — ponla tú», conducta de SCRUM-1230). No es del arreglo.

Capturas en `docs/master/evidencias/SCRUM-1675/capturas/`: `antes-1-ordenado-390.png` / `antes-2-tras-recargar-390.png` (el fallo) · `despues-1-ordenado-390.png` / `despues-2-tras-recargar-390.png` · `…-1280.png` · `despues-corregido-…-390.png`, con su `.json` por pasada. El dictado de las pasadas es inventado.

**Falta:** verlo en yaqu.app ya desde `main`, cuando entre el PR — `node docs/master/evidencias/SCRUM-1675/banco/verificar.mjs antes 390 <árbol> <salida>` (con «antes» = lo que sirve producción, que entonces ya es el arreglo: tiene que dar el dictado igual tras recargar).

## Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| En yaqu.app: dictar, recargar → el texto sigue en el cuadro (a 390) | tabla de arriba, fila «después, 390» + `capturas/despues-2-tras-recargar-390.png` (con los ficheros servidos desde la rama; desde `main`, pendiente del merge) |
| Lo mismo con la propuesta ya ordenada, o un aviso que diga que se perdió (texto firmado) | la propuesta VUELVE (3/4 líneas, con lo corregido): no hace falta aviso ni texto nuevo |
| Test en `tests/` que lo fije | `tests/scrum1675-dictado-sobrevive-a-la-recarga.test.mjs`: 5/5 rojo contra main, 5/5 verde |

Fuera de alcance, sin tocar: 1676 y 1677 (los abro aparte, con la firma de SCRUM-1656), el albarán AB260007 (#52) de QA.
