# SCRUM-1318 · La entrada aparcada de los endpoints de envío describía un defecto ya arreglado

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T02:17:52+01:00

1-oct-2026 · **J4** (equipo de Javier), por encargo del orquestador (`cobroflash-backend-5b`).
[Escrito por J4, recogiendo la orden que el fundador dio al orquestador; así consta en Jira SCRUM-1318:]
**Javier, 1-oct-2026: «1-Ok arreglala hoy».**

A9: comprobación → `tests/scrum1318-resend-dice-si-salio.test.mjs`

## Qué pasaba

`src/core/http/sendEndpointDeclarations.ts` aparcaba `POST /admin/team/:id/resend` en
`SEND_ENDPOINTS_PENDING` con esta ficha: «la ruta responde {ok:true} SIEMPRE, sin campo `sent`».
SCRUM-131 arregló la ruta y el servicio, y no sacó la entrada. El plazo de la lista venció el
30-sep, y desde el 1-oct `tests/scrum128-send-endpoints-fail-closed.test.mjs` tumba la tanda de
cualquier PR por una ficha que ya no era cierta.

## Primero, si la ficha tenía razón — medido por EFECTO

Declarar un `sent` que la ruta no devolviera sería mentir en el fichero que existe para lo contrario,
así que antes de mover nada se ejecutó la ruta. `tests/scrum1318-resend-dice-si-salio.test.mjs`
corre la ruta real, `resendInvite` e `inviteTeamMember` reales; dobla sólo la base y el emisor único
de correo (el último eslabón), y **no va gateado**:

- el proveedor contesta que el correo no salió → 200 con `sent: false`, `error: 'email_send_failed'`
  y su texto;
- sin proveedor configurado → 200 con `sent: false`, `error: 'not_configured'`, sin llamar al emisor;
- el correo sale → `{ ok: true, sent: true }`;
- miembro inexistente o suspendido → 404 y 409, sin `sent`.

Los 4 pasaron sobre el código de `origin/main`: **la ficha estaba caduca, el contrato existe.**

Y el test habría visto el defecto viejo. Tres mutaciones sobre el compilado, las tres caen: la ruta
respondiendo `{ok:true}` fijo (caen 3 casos); el `catch` de `inviteTeamMember` devolviendo
`sent: true` (cae el del proveedor); sin proveedor devolviendo `sent: true` (cae el suyo).

El front también mira el campo: `public/dashboard/js/teamView.js` decide el aviso por
`r.sent === false`. Leído, no ejecutado en navegador.

## Qué cambia

- La entrada se **mueve** a `SEND_ENDPOINTS_DECLARED` (`top-level`, `email`), con su motivo.
- `SEND_ENDPOINTS_PENDING` queda vacía, con la historia de la entrada en un comentario.
- `SEND_ENDPOINTS_PENDING_MAX`: 1 → 0, mismo commit.
- En el guard, el recuento exacto de declaradas: 9 → 10, mismo commit, como pide su propio mensaje.
- **No se toca** `SEND_ENDPOINTS_REVISAR_ANTES_DE`, ni la ruta, ni el servicio, ni ningún texto.

## El guard sigue mordiendo con la lista vacía

Con el cambio: 4 de 4, «8 rutas /admin huelen a envío · 10 declaradas · 0 aparcadas» y «sin
pendientes». Mutaciones sobre el compilado de las declaraciones:

| Mutación | Qué cae |
| --- | --- |
| volver a aparcar una ruta | «ha CRECIDO: 1 > 0» |
| aparcar una y subir el tope a 1 | «CADUCÓ el plazo»: la fecha vencida sigue ahí y dispara en cuanto hay algo |
| quitarla de declaradas sin declararla | «HUELE A ENVÍO SIN DECLARAR» y «DECLARACIÓN MUERTA» |

Rojo de partida visto en local y en el CI de #2031: «CADUCÓ… Hoy 2026-10-01 · plazo 2026-09-30 · quedan 1».

## Lo que NO arregla

- **El otro plazo vencido** (`tests/scrum55-admin-fail-closed.test.mjs`, 13 rutas `/admin` sin
  clasificar) es SCRUM-1317 y espera al fundador. Con este cambio la tanda pasa de 2 fallos a 1:
  **el check obligatorio sigue en rojo y nada se mergea todavía**, este PR incluido.
- `tests/scrum131-resend-honesto.test.mjs` sigue gateado por `QA_DB_TEST`; no se ha tocado.

## Hallazgos al lado, NO tocados (A7)

- `docs/YAQU_MASTER.md` (línea 795-797) sigue diciendo que esta ruta «traga el error» y está
  «aparcado en `SEND_ENDPOINTS_PENDING`». Es la misma ficha caduca, en el master: lo cambia quien
  puede cambiar el master.
- Las listas a mano de `tests/scrum128-frontend-mira-sent.test.mjs` y
  `tests/scrum128-frontend-census.test.mjs` no incluyen el fragmento de esta ruta ni el de
  `/admin/soporte`: el guard del front no vigila que esas dos llamadas miren `sent`. Hoy la de
  equipo lo mira.
- Nada comprueba que la `duda` de una entrada aparcada siga siendo cierta: ésta llevaba caduca
  desde que se cerró SCRUM-131. Queda dicho en el comentario de la lista.

## Medido

Tanda dirigida, 33 ficheros (los que leen los ficheros tocados, más `scrum237`, `scrum976`,
`scrum391`, `scrum267`, `scrum273`, `scrum1294`, `scrum377`, `scrum55`): 240 tests · 237 pass ·
**1 fail** · 2 skip. El fallo es «SCRUM-55: la lista de pendientes mengua», el otro plazo vencido,
que este ticket no cubre. Los 2 saltos son los gateados por `QA_DB_TEST`. La tanda completa la
corre CI.
