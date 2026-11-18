# SCRUM-1708 · El runbook de mesas, al día con lo que el lanzador hace hoy

**Medido contra:** `origin/main` = `6881a0d27e8b4e337bd55175c3068791c8304c69` · 2026-11-18T07:49:17Z
**Sesión:** S0 (dueña del texto del runbook, SCRUM-1295), worktree `s0-1708`, rama `scrum-1708-runbook-mesas-al-dia`.
Solo papel: el código no se toca (lo dice el ticket).

**PASO 0: el desfase existe hoy.** Medido leyendo el código, no el ticket:
- `scripts/equipo/sesion.mjs` `mesaDelLanzamiento`: sin `config.mesas` → `cwd: config.repo`, veredicto `SIN-MESA`
  (SCRUM-1298c). Con `mesas` y una mesa que no se prepara → `cwd: config.repo`, veredicto `MESA-FALLIDA` con `fallo`
  (SCRUM-1298d). Bien → `MESA`. El runbook decía «sigue heredando la carpeta de quien lanza», y que
  `SIN-IDENTIDAD` / `MESA-DENTRO-DEL-REPO` paraban el lanzamiento: las dos cosas son falsas hoy.
- `lanzar` y `relevar` imprimen los dos el campo `mesa` (`sesion.mjs`, salidas `LANZADA` / `RELEVADA`).
- `scripts/equipo/aparcar.mjs`: `--hasta` y `--motivo` obligatorios; la marca vence en `--hasta`, y una sesión
  del puesto lanzada después (por `createdAt`) la anula. `sala.mjs`: sin marca, un puesto parado sale `VACIO`;
  con marca, `APARCADO`, que no es un aviso. El runbook no lo nombraba, y el paso «equipo parado» lo necesita.
- La instalación de hoy: `config.json` con claves `repo, claude, prefijo, puestos, orquestador, tandas, prompt,
  traspasos`, **sin `mesas`**. Así que todo lanzamiento de hoy es `SIN-MESA`, y eso es lo normal, no una avería.
  En `D:/MILLONARIO/cobroFlash` hay `mesa-s3`, `mesa-s5`, `mesa-control-s5`.
- SCRUM-1295 ya está en `main` (la condición 0.1 del runbook decía «hoy NO»). `.claude/settings.json` corre
  `carril.mjs` sin `--exigir-identidad`, así que el paso 8 sigue sin dar.

**Qué cambia en `docs/equipo/runbook-mesas.md`:** la cabecera lleva fecha, SHA y el estado medido; 0.1 al día; una
condición 0.6 nueva para aparcar con `--hasta`/`--motivo` en el mismo bloque en que se para; el paso 2 con el
comportamiento real y la tabla de los tres veredictos (`MESA` · `SIN-MESA` · `MESA-FALLIDA`, con los `fallo`
posibles y qué se hace con cada uno); la comprobación 0 del paso 4, que es leer el veredicto; el paso 6, con
marcas que vencen y se anulan al lanzar; la marcha atrás, en dos filas que dicen lo de hoy; y «lo que no sabe»,
al día.

| aceptación (literal) | dónde se ve |
|---|---|
| El runbook describe los tres veredictos (MESA · SIN-MESA · MESA-FALLIDA) con lo que significa cada uno. | `docs/equipo/runbook-mesas.md`, paso 2, tabla «Los tres veredictos de la mesa» |
| El paso 2 y la marcha atrás reflejan el comportamiento real (quitar `mesas` del config = arrancar en repo, no «heredar la carpeta»). | el mismo fichero: paso 2 y «Cómo se vuelve atrás» |
| Referencias: SCRUM-1298 c.21540 y docs/master/SCRUM-1298.md (apéndice 11-nov). | este registro y el runbook nombran 1298c/1298d; el código citado es el de `sesion.mjs`, que es lo que manda |

A9: sin fallo que generalice — solo papel, puesto al día contra el código leído; ningún error mío que contar
