# SCRUM-900 · El push de Claude salía con el GITHUB_TOKEN del checkout: su CI no arrancaba nunca

**Fecha:** 17-sep-2026 · **Carril:** S5 · automatización
**Medido contra:** `origin/main` = `4b88ab67fe4c36d57fa60a7e803ad9e71bb5c941` · 2026-09-17T09:32:39Z
**Rama:** `scrum-900-push-de-claude-con-la-app`
**Horas:** las de la API de GitHub.

## ① PASO 0 · ¿pasa hoy?

Sí, y solo con el bot de Claude. Runs de CI desde el 14-sep con actor `github-actions[bot]`: **6**.
- **5 con 0 jobs** (`action_required`; el «failure» que muestran varios lo escribió GitHub al cerrarse el PR):
  35200894834 (887b, 17-sep), 35138902841 y 35135663526 (839e), 35138540421 (888g), 35066869253 (853c).
- El sexto, 34955159283 (849), corrió porque lo relanzó una persona (`triggering_actor` Javierpf28, intento 2).
- Los pushes de `yaqu-bot[bot]` (la App) sí arrancan: run 35200535850, del control de SCRUM-839f.
- Caso vivo: #1383, cabeza `9ff07948` empujada por `claude[bot]` a las 08:39:50Z, con CI 35200894834 y Zona roja
  35200894814 en `action_required`.

## ② La causa, medida

`claude.yml` ya le pasaba a la acción la llave de la App (`github_token: ${{ steps.token.outputs.token || github.token }}`,
desde `c4be62b7`, 9-sep). **Ese arreglo no funcionó nunca**, porque la credencial que manda no es esa:

1. `actions/checkout@v6` con `persist-credentials` (por defecto `true`) guarda el `GITHUB_TOKEN` como
   `http.https://github.com/.extraheader` en un fichero aparte, enlazado con `includeIf.gitdir:` (log del run 35200459742).
2. `claude-code-action` busca esa cabecera en la config local para quitarla: «No existing authentication headers to
   remove». No la ve, y pone el token de la App solo en la URL remota.
3. git manda la cabecera en la primera petición, así que el push autentica como `github-actions[bot]`.

Medido en local, con control (git 2.51.0.windows.1, servidor HTTP propio, tokens falsos):
- con el `includeIf` → la 1.ª petición lleva `x-access-token:TOKEN_GITHUB_ACTIONS`; la URL con el token de la App no se usa;
- sin el `includeIf` → la 1.ª petición sale sin cabecera (401) y la 2.ª lleva `x-access-token:TOKEN_APP`;
- `git config --local --get-regexp extraheader` no devuelve la cabecera del `includeIf`: por eso la acción no la quita.

## ③ Decidido y construido

(a), decidido por el orquestador (17-sep 11:25 CEST): `persist-credentials: false` en el checkout de `claude.yml`.
(b), que el vigía nombre `ACTION-REQUIRED`, va aparte y después.

Commits de la rama: rojo `27961772` (test) → entrada de registro → **empujado primero** (#1401, cabeza `e2a5439b`,
09:21:21Z) → arreglo `546a4ebe` → corrección del test `0fa3f862`.

## ④ ROJO · POSITIVO · NEGATIVO · SUELO

- **ROJO, en el runner:** CI 35204650154 sobre `e2a5439b` (**git 2.55.0**). Cae «🔴 ROJO/POSITIVO: el push de Claude
  autentica con la llave de la App, no con el GITHUB_TOKEN del checkout». Así queda medido en la versión de git del
  runner lo que en local era 2.51.
  ⚠️ En ese mismo run cayó también **SCRUM-702**: el nombre de prueba `TOKEN_DEL_CHECKOUT_GITHUB_ACTIONS` contaba como
  lectura de `GITHUB_ACTIONS`. No es parte del defecto: se corrigió en `0fa3f862`.
- **SUELO del banco:** «el banco distingue la cabecera del checkout de la URL con la llave de la App», en verde en el
  runner (git 2.55.0) y en local (2.51). Si no llegan peticiones o los dos casos dan lo mismo, dice NO PUDE MIRAR.
- **POSITIVO:** con `persist-credentials: false` llega el token de la App (en local).
- **Mutación declarada** (`persist-credentials: false` → `true`), probada a mano: con `true` → 1 fail; **borrando la
  línea** (vuelve el valor por defecto) → 1 fail; restaurada → 3/3.
- **NEGATIVO:** de `.github/workflows/` solo cambia `claude.yml`, y solo en ese paso. Los `gh` del workflow siguen
  llevando su `GH_TOKEN`. El `git fetch` de «Traer main» no necesita credencial (el repo es público).
- **Tanda** (local, sobre `0fa3f862`): 7212 tests, 7102 pass, 0 fail, 110 skipped. La anterior, sobre `546a4ebe`,
  dio 4 fallos que cazaron mi test (scrum702, 745, 757, 765): el nombre del token y el `fichero` de la mutación, que
  no era un literal.

## ⑤ Lo que queda, y lo NO medido

- **E2E pendiente:** el primer push real de `claude.yml` después del merge tiene que salir como `yaqu-bot[bot]` y con
  jobs. No se fabrica un `@claude` (gasta uso). El ticket sigue abierto hasta verlo.
- **Consecuencia conocida:** «PR automático» ve ese push como `Bot` y **no rearma** (`EMPUJE-SIN-PERSONA`, SCRUM-839e).
  El PR ya viene armado de antes, así que no hace falta.
- Durante este PR, el avisador despertó a Claude sobre el rojo a propósito (09:31:05Z). Si empuja antes del arreglo,
  lo hará con la cuenta que falla.
- (b), que el vigía nombre `ACTION-REQUIRED`, va en otro PR.
