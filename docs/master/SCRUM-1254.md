# SCRUM-1254 · El reaper de Claude Code y la tanda en segundo plano → `trampas-del-entorno.md` §7

**Medido contra:** `origin/main` = `ebe2b932c0a4e07352516487df5146cd1a37abfc` · 2026-10-14T08:55:07Z

Escrito por la Sesión 0 (`s0-14octc`).

A9: sin fallo que generalice — la añade a posteriori la S0 de la tarde del 14-oct, porque el guard de SCRUM-1294 la pedía y faltaba; el traspaso de la sesión que hizo el trabajo no recoge ningún tropiezo de esta entrega

## Qué se ha hecho

J6 (equipo de Javier) midió la trampa el 28-sep-2026 y se la reportó a la S0, que es la dueña de
`docs/equipo/trampas-del-entorno.md`. Ahora está escrita en §7 (Windows), con su condición y con cómo se
comprueba.

## Lo que cambia respecto al texto que se propuso

- **Duración en primer plano: 4,2 y 4,3 min**, no «3,6-4,3». Las tandas de 3,6 y 3,8 min eran de **segundo**
  plano (`SCRUM-1244.md` §⑤, tabla, filas T11-inactiva y T11-final).
- Pone «la herramienta de shell» donde la propuesta decía «Bash», porque en esta máquina hay sesiones que usan
  PowerShell.
- La condición «sólo si no hay otras sesiones trabajando» se queda marcada como **no medida**, tal como la
  declaró J6.

## Lo que no se ha hecho

- No se ha vuelto a medir el reaper: las cifras son las de J6 en `SCRUM-1244.md` §⑤.
- No se toca `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP`, que es configuración del equipo de Javier.
