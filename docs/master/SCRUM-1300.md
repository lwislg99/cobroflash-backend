# SCRUM-1300 · El modelo de trabajo nuevo: que un fallo se convierta en comprobación y no en nota

Registro de máster del ticket. Un fichero por número (A8); cada tramo nuevo se ANEXA debajo.

## SCRUM-1300 · «no se ha podido verificar» exige el dato recibido (14-oct-2026)

**Medido contra:** `origin/main` = `db28dc0a6a8f0520d82991d5a11d76589f582c66` · 2026-10-14T17:31:58Z

Puesto S0 (3ª tanda del 14-oct). Encargo del orquestador: escribir en las normas el fallo que midió la
S3 ese día, con su cifra dentro, y decir si se puede sostener con un guard. No abre ticket: va colgado de
éste porque es justo lo que 1300 pide, un fallo convertido en norma en el camino por defecto.

**Qué entra**

| fichero | qué |
|---|---|
| `docs/equipo/00-normas-comunes.md` A3 | la norma entera: el dato recibido (ruta, cuenta, código, cuerpo, hora) o «no lo he intentado»; la cifra (0 de 7); el alcance real del paywall y del tope de usuarios |
| `docs/equipo/00-normas-siempre.md` A10 | la frase corta. Este fichero lo importa `CLAUDE.md` con `@`: llega sola a toda sesión |
| `docs/equipo/trampas-del-entorno.md` §PowerShell | de paso: `[IO.File]` con ruta relativa también ESCRIBE en otro árbol, no sólo lee |
| `docs/equipo/cicatrices/S0.md` | dos cicatrices de esta tanda |

**De dónde sale la cifra.** De la auditoría de la S3 del 14-oct, transcrita por el orquestador en
SCRUM-1367 c.19747: 7 comentarios culpaban a la cuenta QA caducada; 0 ciertos, 2 falsos por ruta, 4
deducidos del código y 1 dudoso. No la he recontado: la cito con su origen.

**Los datos de la norma, medidos aquí** (sobre el código, no contra producción):

- `requireActivePlan` está montado en 4 sitios: `src/app.ts:355` (`POST /quote/create`), `src/app.ts:570`
  (`POST /admin/quotes/:id/send-whatsapp`), `src/modules/jobs/app/routes/albaranes.routes.ts:1238` y
  `:1255`. Dos instrumentos: `git grep` y el censo por AST de `tests/_censo-aviso-vs-bloqueo.mjs`
  (`censarEjecucionDelVencimiento`: 4 montajes sobre 127 rutas de escritura). Ningún `app.use` lo monta.
- `POST /admin/quotes/:id/accept` (`quotesAdmin.routes.ts:137`) no lo lleva.
- `trial` admite 1 usuario (`src/core/entitlements.ts:18`); al tope, invitar da 409 `user_limit`
  (`src/modules/team/app/routes/team.routes.ts:78-81`), y esa comprobación no mira la caducidad.

**¿Se puede sostener con un guard? En parte.**

- **El DATO, sí, y el guard ya existe:** `tests/scrum337-aviso-atado-al-bloqueo.test.mjs` compara por
  identidad los montajes del censo con su lista declarada. Control, en el worktree:
  - BASE: 10 de 10.
  - MUTANTE (un quinto `requireActivePlan` en `POST /:id/accept`): 9 de 10. Cae «si cambia lo que el
    producto HACE al vencer…» y nombra `quotesAdmin.routes.ts::POST /:id/accept`.
  - Restaurado: 4 montajes otra vez.
  Así, si el paywall cambia, la norma no se queda diciendo cuatro rutas sin que nadie lo vea. No ata el
  TEXTO de la norma a la lista: quien amplíe el paywall tiene que tocar las dos cosas, y el guard sólo le
  obliga a mirar los avisos.
- **La CONDUCTA, no.** Lo que un comentario afirma de producción vive en Jira, fuera del repositorio, y
  ningún test lo lee. Un guard de texto sobre `docs/master/` buscando «403» o «no se pudo» casaría por
  la forma de la frase, que es el defecto de la A10 de SCRUM-1372. No lo he construido.

**Error propio (A9).** Dos, y el primero es el fallo que esta norma describe:

1. En mi tabla de la criba (`criba-14oct.md` §3) puse 1476 como BLOQUEADO citando «`POST /quote/create`
   da 403 `trial_expired`» de `docs/master/SCRUM-1367.md`, que lo había deducido del código. Era cierto
   para CREAR, pero no lo había recibido nadie, y 1476 no necesita crear: le basta aceptar un borrador.
   El orquestador lo devolvió a «Por hacer».
2. La primera pasada del mutante escribió en el checkout COMPARTIDO (`[IO.File]::WriteAllText` con ruta
   relativa tras un `cd`). El test del worktree salió 10/10 y casi declaro el guard ciego. Lo vi porque el
   censo, leído directamente, sí contaba el quinto montaje. Estuvo cambiado en el compartido unos 25 min.
   Al verlo: `git diff --numstat` daba `1 1` (sólo mi línea), lo deshice con el reemplazo inverso y
   `git status` del fichero quedó vacío.

A9: aviso → cicatriz S0 «Copié a mi tabla de la criba que `POST /quote/create` daba 403 `trial_expired`, sacado de un registro ajeno que lo había deducido del código, y con eso marqué 1476 como bloqueado: el orquestador tuvo que revertirlo. Lo que un registro dice de producción se copia con su «leído» o su «recibido», nunca sin él.» — no se pudo comprobar: lo que un comentario afirma de producción vive en Jira, y ningún test del repositorio lo lee
