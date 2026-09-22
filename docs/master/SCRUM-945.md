# SCRUM-945 · el vigía avisaba «sin cambios a peor» si el entorno traía color

**Fecha:** 18-sep-2026 · **Carril:** S5 · automatización
**Medido contra:** `origin/main` = `16733a223b3d09d3fdf03bf03c67a2b278b4906c` · 2026-09-18T06:38Z
**Rama:** `scrum-945-node-p-sin-color` · **Worktree:** `wt-s5-vigia`
**Horas:** de GitHub (cabecera `Date` de `gh api -i zen`).

## ① El defecto

`node -p` imprime el resultado con `util.inspect`, y `util.inspect` **colorea** números, booleanos y `undefined`
cuando el entorno trae `FORCE_COLOR`, **también si la salida va por una tubería**. Una captura
`VAR="$(node -p …)"` recibe entonces los códigos de escape junto al valor.

Se anotó el 17-sep como un defecto de dos campos numéricos (`NCHECKS`, `MINUTOS`) de un registro que el paso
siguiente parsea por posición, y por eso no llevaba ticket. **Al medirlo apareció uno peor**, en la l.213 de
`vigia-atascados.yml`:

    EMPEORA="$(node -p "require('./veredicto.json').empeora")"
    if [ "$EMPEORA" = "true" ] && [ -s aviso.md ]; then   # avisa
    …
    else  # «SIN CAMBIOS A PEOR — reescrito en silencio, sin notificar»

Con color, `EMPEORA` vale `\x1b[33mtrue\x1b[39m`, que no es igual a `"true"`, y el vigía **cae en la rama de
«no empeora» y no avisa a nadie**. Una alarma que se equivoca hacia «todo tranquilo» es peor que no tener alarma:
el silencio se lee como calma.

Hoy no rompe: los runners de Actions no traen `FORCE_COLOR`. El día que lo traigan, rompe callado.

## ② Medido

Node v24.8.0, cada forma con y sin `FORCE_COLOR=1`:

| forma | sin color | con color |
|---|---|---|
| número (`node -p "7"`) | 1 byte | 11 bytes, 2 ESC |
| booleano | 4 bytes | 14 bytes, 2 ESC |
| cadena concatenada | limpia | limpia |
| `String(número)`, `String(booleano)` | limpia | limpia |

Equivalencia viejo/nuevo medida en bash para **las 7 capturas reales**, con entradas de muestra: idénticas sin
color; con color, las 3 del vigía pierden el escape y las 4 de `conflicto-de-registro.yml` ya salían limpias
(son cadenas).

## ③ El censo, y por qué hace falta el guard

Censo de `node -p|-pe|--print` **capturado** (`$(…)`) en `.github/workflows/`: **7** — 3 en `vigia-atascados.yml`
(`NCHECKS`, `MINUTOS`, `EMPEORA`) y 4 en `conflicto-de-registro.yml` (`ACCION`, `COMMIT`, `CAUSA` y el resumen de
«NO SE TOCA»).

🔴 **El censo a mano encontró 6. La séptima la encontró el guard**: el resumen de la l.184 de
`conflicto-de-registro.yml`, metido dentro de un `echo` y por eso invisible a quien busca `VAR="$(node -p`. Ese es
el argumento de que el guard exista: «ya lo he mirado yo» se equivocó en uno de siete el mismo día.

`node -e "console.log(…)"` en workflows: 3 sitios (`ci.yml:364`, `claude.yml:275`, `vigia-atascados.yml:105`),
los tres imprimen cadenas → no afectados. Lo que va al log sin capturar (`vigia-atascados.yml`, paso del
veredicto) tampoco: nadie lo compara.

## ④ El arreglo

- Las 7 capturas, envueltas en `String(…)`. Las de `conflicto-de-registro.yml` hoy no colorean; se envuelven para
  que la regla sea una sola y el guard la pueda exigir sin excepciones.
- `tests/node-p-capturado-sin-color.test.mjs`:
  - **censo**: toda captura en un workflow va en `String(…)`, con **población ≥ 7** (un censo que no encuentra
    nada no ha mirado);
  - **control del detector**: capturas inyectadas sin envolver se marcan, y una línea que solo imprime al log no
    cuenta;
  - **control de comportamiento**: con `FORCE_COLOR=1`, `node -p 7` y `node -p true` SÍ traen escape en este Node,
    y `String(…)` lo quita. Si un día Node deja de colorear, este aserto cae y avisa de que la regla ya no
    protege de nada que exista.
- **Mutante**: la l.213 sin `String` → el guard cae nombrando `vigia-atascados.yml:220`.

## ⑤ Lo que no cubre

`node -p` fuera de `.github/workflows/` (scripts `.mjs`, `package.json`): el censo no encontró ninguno capturado en
el bucle. Si aparece, el guard no lo ve — su población es la de los workflows.
