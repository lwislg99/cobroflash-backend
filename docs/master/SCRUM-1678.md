# SCRUM-1678 · Con el plan lleno, «Equipo» dice el límite ANTES de abrir el formulario (PILOTO-1)

**Puesto:** S1 (equipo de Luis) · **Rama:** `scrum-1678-aviso-plazas-equipo` · **Base:** origin/main `412ddc20d` (11-nov-2026 12:26Z)
**Decisión:** reasignado ENTERO al equipo de Luis por el fundador, pantalla incluida (SCRUM-1678 c.21462). Camino A de la pre-medición de S0 (c.21456).
**Medido contra:** `origin/main` = `813cfd512622f382395f464503add8c94f59c921` · 2026-11-11T15:28:36Z (rama con `main` fusionado; re-corridos ahí `scrum1678` 9/9, `scrum1342` y `scrum710b`: 34/34. Los 441 vecinos de «Medido» se corrieron sobre `412ddc20d`)
**Skill UI:** no cargada · el cambio de `teamView.js` es de comportamiento (una consulta antes de abrir el formulario) y reusa la alerta `setAlert` que la vista ya tenía: ni marcado, ni estilo, ni texto nuevo

A9: comprobación → `tests/scrum1678-plazas-antes-del-formulario.test.mjs`

## Qué cambia

| dónde | qué |
|---|---|
| `src/modules/team/app/routes/team.routes.ts` | `plazasDelPlan(req)` (recuento + regla de entitlements) y `mensajeDeLimiteDeUsuarios(maxUsers)` (los dos literales que el POST ya servía) en un solo sitio. Ruta nueva **`GET /admin/team/plazas`** → `{ plazas, usadas, lleno, mensaje }`; `mensaje` es el literal del 409 si está lleno y `null` si no. El POST usa lo mismo y conserva su 409 `user_limit` igual que antes. `GET /admin/team` no cambia de forma. |
| `src/core/http/adminOnlyRoutes.ts` | `GET /admin/team/plazas` declarada como de admin (un técnico recibe 403). |
| `public/dashboard/js/teamView.js` | el clic de «+ Añadir miembro» llama a `abrirAltaSiCabe`: consulta `/plazas` y, si viene `lleno`, enseña `mensaje` en la alerta de la vista sin abrir el formulario. Si la consulta falla, el formulario se abre como antes y el 409 sigue de red. |
| `docs/equipo/dos-equipos.md` §3.4 + `.claude/carriles.json` | el cruce S1→J3 sobre `teamView.js` declarado con su motivo y regenerado (`node scripts/carriles.mjs generar`). |
| `tests/scrum1678-plazas-antes-del-formulario.test.mjs` | 9 tests + 2 mutaciones declaradas. |

**Textos: ninguno nuevo.** Lo único que ve el usuario es el literal que el 409 ya servía (`team.routes.ts:84-85` sobre `412ddc20d`). No se usa ninguna entrada de la firma de SCRUM-1656 c.21408 porque no hace falta.

## Medido

- **Rojo primero** (el test contra `team.routes.ts` y `teamView.js` de `origin/main`, en el mismo árbol): 5 de 9 fallan. El del panel cae por lo que tiene que caer: `el clic no consultó las plazas: /admin/team`.
- **Verde:** 9/9, y `scrum1342` (el límite por plan) sigue 13/13.
- **Mutaciones**, a mano, cada una revertida después: `if (false)` en el clic del panel → cae el test 7 (el formulario se abre con el plan lleno); `lleno: false` en `/plazas` → caen 1, 3, 4 y 7 (la regla deja de ser una). `--solo-censo` las lista.
- **Vecinos:** los 53 ficheros de test que nombran los ficheros tocados (permisos admin, carriles, censo de datos, vistas del panel) → 441 tests, 436 ok, 5 saltados, 0 fallos.
- **En yaqu.app:** pendiente del merge. Se mide con la cuenta QA (plan Equipo, 5 plazas: es el CONTROL) y se apunta aquí en un apéndice.

## Lo que NO hace

- No toca el plan de nadie. La aceptación (b), que el PILOTO-1 tenga su plan decidido, es del fundador (c.21456 ①).
- No cambia «Reactivar» (`teamView.js:200`), que abre el mismo formulario y también gasta una plaza. Ahí manda el 409 de siempre. Queda fuera del cruce declarado.
