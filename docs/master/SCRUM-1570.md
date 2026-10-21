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
