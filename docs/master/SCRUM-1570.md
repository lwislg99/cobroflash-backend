# SCRUM-1570 · main con guards de navegador en rojo y en CIEGO, uno a uno

## SCRUM-1570b · `guard:marcadores-en-pantalla` deja de estar CIEGO: la lista que decide qué vistas piden id

**Medido contra:** `origin/main` = `b26de3f68dbbd529751a539134ff65cfeb00c93f` · 2026-10-21T12:44:27Z (hora de GitHub al escribir: 2026-10-21T12:48:36Z; el diagnóstico se hizo sobre `fe65a8b7fca8b1e42448c8134e26d880d96b9ba7`, y entre los dos sólo entraron #2630, #2632 y #2634, que no tocan ninguno de los ficheros de abajo)
A9: comprobación → `scripts/guard-marcadores-en-pantalla.mjs`

Puesto J3 (`jv-j3p`) · árbol `j3p-1570b` · rama `scrum-1570b-marcadores-ficha-gasto`. Encargo del orquestador del
equipo de Javier (`cobroflash-backend-5f`), 21-oct-2026. Carril: `scripts/guard-marcadores-en-pantalla.mjs` sale
**SIN CERRADURA** en `node scripts/carriles.mjs de` (fila general de `scripts/`); la pantalla que vigila
(`expensesView.js`, S2) **no se toca**.

### Lo que decía el CI

Job `118721406690` (run `39449841582`, sha `fe65a8b7f`, log de 89.339 B bajado con `--allow-escape-sequences`):
38 guards · 35 verdes · 1 CIEGO · 2 rojos. Este guard: `93 casos recorridos · 0 lanzaron`, y **3 pares ciegos**,
los tres de la misma vista:

    expenses-detail · con-datos → no pintó ningún nodo
    expenses-detail · sin-datos → no pintó ningún nodo
    expenses-detail · error → no pintó ningún nodo

Repetido en local (Edge de Windows), igual: salida 2, los mismos 3 pares.

### La causa, medida por contenido

- `expenses-detail` entra en el `switch` de `public/dashboard/js/app.js` con #2545 (SCRUM-1156c, merge
  `196453e15`, 17-oct 22:10Z): `git log -S"case 'expenses-detail':"` da ese único commit.
- El guard deriva las vistas del router, pero **qué vistas piden id era una lista a mano** (`conArg`, seis fichas).
  La séptima no entró, así que el banco llamaba `renderExpenseDetailView(cont)` sin id.
- La ficha hace lo correcto sin id: `if (expenseId == null || expenseId === '') return;` (SCRUM-1560, mismo
  commit). No pinta nada, y el guard lo dice: CIEGO. **La pantalla no tiene nada mal; el banco sí.**
- El primer CIEGO observado en CI es `4d4c43773` (#2548, 22:33Z), que no toca `public/`: es el **primer run del
  job de navegador después de #2545**, no la causa. En el run de `196453e15` no hay job de navegador.

### El arreglo (sólo el banco del guard)

1. **Pide id la vista cuyo `case` llama a su render con `state.<algo>`**, leído sin comentarios y por líneas
   (A23 ②③). La lista a mano desaparece.
2. **SUELO nuevo:** si ninguna vista sale con id, CIEGO («las fichas de detalle no se estarían mirando»). Y la
   cabecera **declara la población**: qué vistas reciben id.
3. El banco sirve la forma que la ficha lee (`{ item: {...} }`). Con la forma genérica habría pintado la caja vacía
   y se habría dado por mirada.

Nada se relaja: el censo (`CENSO`), el control negativo y los techos no cambian.

### Lo que se ha corrido (Edge local, Windows)

| medición | resultado |
|---|---|
| base (`origin/main`) | salida 2 · 0 hallazgos · **3 ciegos** (`expenses-detail` ×3) |
| con el arreglo | salida 0 · 0 hallazgos · 0 ciegos · **29 vistas × 3 estados, 93 casos** (igual que antes: la población no cambia) |
| vistas con id, derivadas | **7**: las 6 de la lista vieja + `expenses-detail`. Conjunto comparado, no recuento |
| 🔴 rojo R2 · marcador `[PENDIENTE microcopy oficial]` sembrado en la cabecera de la ficha (numstat `1 1 expensesView.js`) | guard nuevo: **salida 1**, «VISTA NUEVA CON MARCADOR: `expenses-detail` pinta 2» · guard de `main` con la misma siembra: **salida 2, CIEGO** — no lo habría visto nunca |
| 🔴 rojo R1 · la expresión rota a propósito (numstat `1 1`) | **salida 2**, «ninguna vista del router recibe id» |
| árbol tras cada siembra | `git restore --source=HEAD` + `git status --porcelain` vacío |
| `node --test` de scrum1313, scrum1336, scrum1294, scrum237*, scrum976* | 45 tests · 45 pass · 0 fail · 0 skipped |
| `censo-bancos-fijados.mjs` antes y después | misma salida (2) y mismo tamaño; cambian números de línea de este guard y «titulo» 135→136 por el banco nuevo. Ningún test lo fija |

**Error mío, confesado:** la primera siembra de R1 no se aplicó (el `sed` no casó, numstat vacío) y el guard salió
verde. Lo cazó mirar el `numstat` antes de leer el resultado (A23 ⑧); se repitió con un patrón que sí casó.

### NO medido

- **En el runner de CI no se ha visto todavía**: se verá en el job de navegador de este PR.
- Que un comentario con una llamada `state.<id>` no cuente: está construido así (recorte por líneas), **no se ha
  sembrado** ese caso.

### Los otros dos rojos de SCRUM-1570 NO van aquí

- `guard:escalera-por-estado`: causa medida en #2561 (SCRUM-1562d, carril **S4**, equipo de Luis). Va al ticket.
- `guard:cls-barra-anuncio`: causa en la carga de la fuente de la landing; el arreglo es una decisión visual. Va al
  ticket.

## SCRUM-1570b (relevo) · el guard deja de fabricarse su filtro de comentarios: `soloCodigo`

**Medido contra:** `origin/main` = `b10c9b6ca79e2f0b38368098615dc98140bc063d` · 2026-10-21T13:18:39Z (hora de GitHub al escribir: 2026-10-21T13:19:49Z; los rojos de abajo se midieron sobre `3c60a7fd0147eb56d36f5089ecc9c70e2dcbd2ee`, y entre los dos no entra ninguno de los ficheros de este tramo)

A9: comprobación → `tests/scrum694-los-guards-migrados.test.mjs`

Relevo de jv-j3p (PARADA) por jv-j3s, puesto J3. Encargo del orquestador `cobroflash-backend-5f`, con GO para
seguir sin leer Jira en esta sesión (sin MCP de Atlassian): la entrega va a SCRUM-1570 por su mano.

**El rojo.** El obligatorio de #2636 caía en 1 de 12.015 (dato del orquestador, no recontado):
`scrum694` «no entra NINGÚN filtro de comentarios nuevo», 40 sobre un tope de 39. El nº 40 era el recorte por
líneas que el tramo de arriba añadió en `vistasDelRouter()` (`l.replace(` + el corte en `//` hasta fin de línea).

**El arreglo.** `app.js` se lee entero con `soloCodigo()` de `tests/_solo-codigo.mjs` (el filtro de la casa,
SCRUM-694; ya lo importan tres ficheros de `scripts/`), y el `case` se recorre sobre ese texto. Conserva longitud
y líneas, así que el `matchAll` de los `case` no se descoloca. Ni el tope ni `scrum694` se tocan.

| medición (Edge local, Windows) | resultado |
|---|---|
| derivación con el filtro a mano vs. con `soloCodigo`, sobre el `app.js` real (67.818 B) | las mismas **27** vistas y las mismas **7** con id; conjunto comparado: `IGUALES: true` |
| `scrum694` con el arreglo | 7 tests · 7 pass · 0 fail |
| 🔴 `scrum694` con el guard de la punta vieja (`0e4eb2dcd`) sobre el árbol fusionado (numstat `5 6`) | 6 pass · **1 fail**: «hay 40 guards fabricándose su filtro de comentarios, y el tope es 39» |
| guard con el arreglo | salida 0 · 0 hallazgos · 0 ciegos · 29 vistas × 3 estados, **93 casos** · con id: 7 |
| 🔴 R2 de jv-j3p repetido: marcador en el `h2` de la ficha del gasto (numstat `1 1 expensesView.js`) | **salida 1**, «VISTA NUEVA CON MARCADOR: `expenses-detail` pinta 2» |
| 🔴 sin `expenses-detail`: el `state.expenseId` de la llamada del router SÓLO dentro de un comentario de bloque (numstat `1 1 app.js`) | **salida 2**, con id: 6, «3 par(es) CIEGOS», los tres de `expenses-detail` |
| la misma siembra con el guard de la punta vieja | **salida 0, verde**, con id: 7 — el comentario de bloque le colaba un `state.` |
| árbol tras cada siembra | `git restore --source=HEAD` + `git status --porcelain` vacío |

**De paso:** la última fila cierra el «NO medido» del tramo de arriba («que un comentario con una llamada
`state.<id>` no cuente: no se ha sembrado»). Sembrado, el recorte por líneas NO lo cumplía con un comentario de
bloque: daba verde con el router sin pasar el id. Con `soloCodigo` sale CIEGO. Lo arregla el mismo cambio.

**Error mío, confesado:** la primera vuelta del contraste la escribí con `git show … > fichero` encadenado al
commit; el hook `guard-dangerous` la bloqueó entera (truncar un fichero versionado) y no corrió nada, commit
incluido. Se rehízo con `git restore --source=<sha>`, que no trunca.

### NO medido

- **En el runner de CI**: se verá en el obligatorio y en el job de navegador de este empujón.
- El job «guards de navegador» seguirá rojo por `cls-barra-anuncio` y `escalera-por-estado` (otros carriles):
  el veredicto de este tramo es obligatorio verde + `guard:marcadores-en-pantalla` verde, no el job entero.
