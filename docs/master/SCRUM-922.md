# SCRUM-922 · `wmic` en `scrum858b` no existe en Windows 11

**Fecha:** 22-sep-2026 09:58Z · **Carril:** S5 · automatización
**Medido contra:** `origin/main` = `5588e3263847bd40ea906d325e4f83c883c24e6e` · 2026-09-22T07:58Z
**Rama:** `scrum-922-wmic-cim` · **Worktree:** `wt-s5-922`
**Decisión del fundador:** comentario Jira 16267 (21-sep) — sustituir por `Get-CimInstance Win32_Process`, no gatear.

## ① El defecto

`nodesVivosCon()` (`tests/scrum858b-la-tanda-sin-veredicto.test.mjs:85`) llamaba a `wmic`, retirado en
Windows 11. En esa máquina `execFileSync('wmic', …)` da `ENOENT` y pone la tanda entera en `rc=1`. En
esta máquina (Windows 10 Pro) `wmic` sigue existiendo, así que el PASO 0 no reprodujo el fallo — se
corrige igual porque el defecto es real en la máquina donde se midió (Sesión 6, SCRUM-732) y la decisión
ya está firmada.

## ② El arreglo

Sustituido por `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` vía `powershell.exe -Command`,
formateando cada proceso como `"<pid> <CommandLine>"` para que el filtro existente (`l.includes(aguja)`)
siga funcionando sin cambios. Se quita el `!l.includes('wmic')` porque ya no hay autorreferencia que
excluir.

## ③ Medido

- **Antes** (con `wmic`, en esta máquina donde sí existe): `tests/scrum858b-la-tanda-sin-veredicto.test.mjs`
  → 5 pass · 0 fail.
- **Después** (con CIM): mismo fichero → 5 pass · 0 fail. Comportamiento idéntico.
- **Control positivo/negativo de la sonda** (script aparte, no commiteado — sonda de verificación, no
  parte del guard): con un `node -e` vivo marcado por PID único, `Get-CimInstance` lo encuentra (1 línea);
  tras matarlo, 0 líneas. El reemplazo no es ciego.

## ④ Lo que no cubre

No se ha podido reproducir el `ENOENT` original en esta máquina (Windows 10 Pro, `wmic` aún presente):
la equivalencia se mide por comportamiento (mismo pase/fallo, misma detección de huérfanos), no
reproduciendo el rojo de Windows 11.
