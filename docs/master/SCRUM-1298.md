# SCRUM-1298 · Mesa fija por puesto: cada sesión arranca en su `mesa-<puesto>`, al día con origin/main

**Medido contra:** `origin/main` = `45181d233c74ee36a39db4913d9593e7e9a284df` · 2026-09-29T17:53:08Z

## El defecto
`CLAUDE.md`, `.claude/settings.json` (hooks) y `.claude/rules` se cargan del directorio de ARRANQUE
(medido por S0). Las sesiones heredaban el `cwd` de quien las lanzaba: el checkout compartido, en una
rama del 22-sep. Ninguna norma ni hook mergeado desde entonces llegaba a nadie.

## Lo medido por S5 (29-sep)
- `claude --bg` toma el `cwd` del proceso que lo lanza: control `983223e8` (`control-cwd-s5`, modelo
  haiku) lanzado desde `D:\MILLONARIO\cobroFlash\mesa-control-s5` sale en `agents --json` con ese `cwd`.
- Una carpeta fuera de ruta de confianza hace que `claude --bg` se NIEGUE: «Workspace not trusted».
  `D:/MILLONARIO/cobroFlash` es de confianza y sus hijas la heredan (el control anterior arrancó).
  Por eso las mesas van ahí; la confianza NO se escribe a mano.
- ⚠️ Resto del control sin limpiar: `claude stop/rm 983223e8` y borrar la carpeta vacía
  `D:\MILLONARIO\cobroFlash\mesa-control-s5` los DENEGÓ el permiso de esta sesión. Está en `done`.

## Lo construido
- `sesion.mjs`: `rutaDeMesa`, `puestoDeIdentidad`, `suciedadDeMesa`, `prepararMesa`,
  `mesaDelLanzamiento`. `lanzar` y `relevar` preparan la mesa (fetch → worktree `--detach` o
  checkout → CONTROL `HEAD == origin/main` → generador de identidad de S0) y lanzan `claude` con
  `cwd` en ella. `relevar` la prepara ANTES de parar a la anterior. Cualquier paso que falla = no se lanza.
- `equipoVivo` cuenta también `<mesas>/mesa-*` (si no, el guard del segundo orquestador quedaba ciego).
- `instalar.mjs --mesas <ruta absoluta>`: EL INTERRUPTOR. Sin él, todo sigue como antes y el
  veredicto dice `SIN-MESA`.
- Test `tests/scrum1298-mesa-por-puesto.test.mjs`, git real en un temporal; sus dos mutaciones
  caen con su `cae` (runner local).

## Lo que falta para el interruptor (con el equipo PARADO; no se migra nada aquí)
1. Que entre el PR de S0 (SCRUM-1295: `scripts/carriles.mjs mesa <PUESTO> <mesa>` + `.gitignore`).
   Sin él, todo lanzamiento con mesas sale `SIN-IDENTIDAD` — a propósito.
2. Añadir `"mesas": "D:/MILLONARIO/cobroFlash"` al `config.json` de la instalación.
3. Que el orquestador lance SOLO por `sesion.mjs lanzar|relevar sesion-N`: el nombre `-n` tiene que
   decir el puesto (el hook de S0 contrasta carpeta contra nombre). Hoy lanza a pelo con `sN-29x`.
4. **El modelo (decisión del orquestador, 29-sep):** `sesion.mjs` fuerza `--model sonnet` (SCRUM-990)
   y hoy se lanza con opus. El lanzador tiene que respetar el modelo pedido (parámetro explícito), no
   imponer uno; opus frente a sonnet lo decide el fundador. Hasta entonces el interruptor NO se da.
