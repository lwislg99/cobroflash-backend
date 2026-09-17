# SCRUM-900 · El push de Claude salía con el GITHUB_TOKEN del checkout: su CI no arrancaba nunca

**Fecha:** 17-sep-2026 · **Carril:** S5 · automatización
**Medido contra:** `origin/main` = `7769e39d05e68b8f1b9f2e5a06072e8cb2d08ddb` · 2026-09-17T09:16:35Z
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
