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

## 1-oct-2026 · por qué este PR estuvo dos días en rojo, y lo que cambió

**Medido contra:** `origin/main` = `fe5b3c18f038eb5c1200b8c067ed69d0bfda0898` · 2026-10-01T10:37:17Z

A9: aviso → A10 «Empujar no es entregar: antes de cerrar, mira el check obligatorio de tu último push, o di que no lo miraste.» — no se pudo comprobar: la comprobación (que ninguna sesión cierre con su último push en rojo sin decirlo) es SCRUM-1350 y todavía no existe; hasta que entre, esto es lo único que llega a todas las sesiones.

El PR (#2002) **nació rojo** el 29-sep: la sesión cerró sin mirar su check. No fue podredumbre — la
primera corrida, minutos después de abrirse, ya traía los cinco fallos propios. Lo que caía y lo hecho:

| Guard | Qué decía | Arreglo |
|---|---|---|
| `scrum836` (anclas) | las mutaciones de `scrum951a` apuntaban a dos líneas que este PR cambió | re-ancladas en `scrum951a` (lo que quitan sigue siendo lo mismo) |
| `scrum836d` (`cae`) | los dos `cae` de este test no eran títulos de test | ahora nombran el título |
| `scrum723` | `sesion.mjs` y este test nombran `origin/main` fuera de los argumentos de git | declarados con su motivo |
| `scrum824` | este test crea temporales que el censo no puede probar | declarado (cuelga de `temporal()`, como 951d) |
| `scrum812` | la cobertura subió | suelo 26 → 27 |

Y un cambio de conducta, pedido por S0: `prepararMesa` pasa **siempre** `--nombre <sesión>` al
generador de identidad. Sin él, el equipo con prefijo (sus `sesion-N` son `JN`) saldría 2 al lanzar.
Aserción en «una mesa que no existe nace en origin/main…».

Tanda completa en local (Windows): 9.623 tests, 9.481 pasan, 138 saltan, 4 caen — los cuatro se
declaran CIEGOS por la máquina (`scrum1093h` ×3 y `scrum1321`: el temporal está en otra unidad),
no por este cambio. El veredicto que vale es el del CI.
