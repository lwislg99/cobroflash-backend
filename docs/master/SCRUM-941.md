# SCRUM-941 · Normas: A22 (caracteres de control con `\x`) y el párrafo de A18 sobre los suelos de «no reproducido»

**Medido contra:** `origin/main` = `16733a223b3d09d3fdf03bf03c67a2b278b4906c` · 2026-09-18T06:37:44Z
**Rama:** `scrum-941-normas-a22-y-suelos` · **Carril:** consultoría (Sesión 0), dueña de `docs/equipo/00-normas-comunes.md` · **Encargo:** orquestador, 18-sep-2026
**Solo docs.** El guard que sostiene la A22 va aparte, en **SCRUM-942** (carril de la Sesión 3), y el arreglo de los ficheros afectados también.

⏱ Horas de GitHub (cabecera `Date:` de `gh api -i zen`).

## Qué cambia

- **A18**: un párrafo nuevo. Un suelo de «no reproducido» limita lo que el cierre AFIRMA, no si el ticket se cierra. Nace de SCRUM-858, cuyo suelo prohibía cerrar un ticket con el trabajo hecho.
- **A22** (nueva): los caracteres de control se escriben con `\x`, nunca con `\u`, y se cuentan después de escribir.
- **A10**: una frase nueva, «Un carácter que no se ve no lo caza una revisión: lo caza un recuento».
- El diff es **+66 / −0**: solo se añade; no se toca ni una línea existente.

## A22 · lo medido

| qué | cómo | resultado |
|---|---|---|
| ¿`\uXXXX` aterriza literal? | Escribir un fichero con la herramienta de escritura y contar los bytes | 7 de 7 secuencias `\u` → carácter literal (ESC, NUL, BEL, TAB, DEL, `é`…); `\x07`, `\x1b`, `\033` → intactas (3 de 3) |
| ¿`main` llegó a llevar un ESC? | `git grep -I -l -P "\x1b"` por cada commit de primer padre del 17-sep, de 18:00Z a 21:35Z | 16 merges seguidos, de #1467 (19:08:18Z) a #1480 (20:11:08Z); limpio desde #1481 (20:11:25Z) |
| ¿Hay ESC hoy? | Mismo barrido sobre `16733a22` | 0 ficheros de texto |
| ¿Otros bytes de control hoy? | `git grep -c -P "[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]"`, por extensión y **sin** `-I` | 11 ficheros de 2.858 de texto (de 3.215 en total) |
| ¿Cuáles importan? | Los 11, uno a uno | 806 (1 NUL), 807 (4 NUL), `_censo-tickets` (4 × 0x1F), SCRUM-428 y SCRUM-484 (0x08); los otros 6 son volcados de PDF y `estructura*.txt`, dados por legítimos **sin abrirlos**, y así se declara |
| ¿806/807 se ven en un diff? | `git diff --numstat <commit>~1 <commit>` del commit de entrada | «- -»: git los trata como binarios |

**Control positivo:** el mismo barrido ve el ESC en los commits históricos `5a2064b9`, `3c9b27ac` y `07be0f55`, y 0x1B dentro de 332 PNG. No está ciego. **Coste:** 0,23 s sobre el árbol entero.

**Error propio (A9):** el primer recuento de población, con `git ls-tree` y globs, dio «0 ficheros de texto», y lo iba a leer como población. Lo cacé porque ese 0 no cuadraba con los 11 resultados, y lo rehice filtrando por expresión regular: 2.858.

## A18 · lo medido

- El suelo de SCRUM-858, leído en crudo en la descripción del ticket: «si no se consigue reproducir el cuelgue, se declara así y no se cierra el ticket». El reporter del ticket es la cuenta de Javier, no el orquestador.
- La expresión «no se cierra el ticket» sale en Jira en 3 tickets (858, 846 y 626), los tres cerrados. Con «suelo» + «reproduce» y sin cerrar hay 1 (SCRUM-927), y su redacción no la he revisado. Hoy no hay ninguna víctima viva.
- El orquestador acepta aplicarse la corrección al redactar tickets. Eso va en su ficha (`orquestador.md`), que no es de la Sesión 0.

## Comprobación del propio cambio

El fichero resultante lleva 0 bytes de control, 0 CR y ningún BOM. La A22 se ha aplicado a su propio texto.
