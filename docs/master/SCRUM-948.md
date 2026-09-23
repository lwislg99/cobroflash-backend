# SCRUM-948 · el paso «Traer main» en el job `build + tests` de ci.yml

**Fecha:** 22-sep-2026 10:26Z · **Carril:** S5 · instrumentos/CI
**Medido contra:** `origin/main` = `171be5dc33df669bd52ad3ae8bd65cc0c95de9e9` · 2026-09-22T08:26Z
**Rama:** `scrum-948-traer-main-ci` · **Worktree:** `wt-s5-948`
**Decisión del fundador:** comentario Jira 16270 (21-sep) — GO en dos tiempos: ① medir en local qué
dice `scrum810` sobre `main` con `BASE`; ② si sale verde, PR con el paso.

## ① Medido ANTES de tocar ci.yml (condición del GO)

`tests/scrum810-el-suelo-a-la-primera.test.mjs` + `tests/scrum810b-los-suelos-derivados.test.mjs`,
con `origin/main` presente en este clon (`BASE` no nulo, así que NINGÚN caso se gatea):

    13 pass · 0 fail · 0 skipped

**Verde.** El suelo derivado no tiene nada que decir hoy sobre `main`. Cumple la condición del
fundador para seguir con el paso ②.

## ② El arreglo

Una línea (con su bloque de explicación, igual que las otras tres del mismo fichero): el paso
**«Traer `main`»** (`git fetch --no-tags --prune --no-recurse-submodules origin
+refs/heads/main:refs/remotes/origin/main`), añadido al job `test` (l.149-158) justo después del
`actions/checkout@v4` con `fetch-depth: 0` y antes de `actions/setup-node@v4`.

**Por qué `fetch-depth: 0` solo no basta** (mismo patrón que documentan los otros tres jobs,
l.395-403, l.788-790): en `pull_request`, `actions/checkout` trae la historia completa de la rama
del PR, pero **no crea** `refs/remotes/origin/main` — eso sólo lo hace el `fetch` explícito. En
`push` a `main` sobra (el checkout ya la crea al comprobar `main` mismo), pero el job también
corre en PR (l.29 `push:` — el trigger completo no se ha mirado línea a línea, pero los otros tres
jobs con el mismo problema corren en los mismos eventos y esa es la explicación que ya está escrita
en el fichero).

## Medido después

- YAML: revisado a mano contra los otros tres bloques idénticos del mismo fichero (mismo
  comando, misma indentación) — no hay parser YAML instalado en este árbol (`js-yaml`/`yaml`
  ausentes de `node_modules`) para una validación automática; no se ha instalado uno nuevo
  (dependencia nueva = decisión del fundador, regla de la casa).
- `npm run guards:entrada`: 11 guards, verde.
- No se ha podido ejercer el CI real (eso sólo lo mide GitHub Actions al empujar): el control por
  efecto es que este PR, al entrar, corra ese paso y el resto del job sin cambiar de duración
  apreciable — se pide comprobarlo en el propio run de este PR.

## Lo que NO se ha hecho

- ⛔ No se toca `skip` de scrum810/810b — el gate era correcto, sólo faltaba el `fetch`.
- ⛔ No se sube ni se baja ningún suelo (regla 41).
- ⛔ No se toca qué comprueba el job ni su duración con ningún otro cambio.
