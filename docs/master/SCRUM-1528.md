# SCRUM-1528 · El motivo declarado de `POST /auth/register` decía una defensa que la ruta ya no necesita

**Medido contra:** `origin/main` = `eebc104d9e955cdd67b31ad2d24a50cc9b849a7b` · 2026-10-13T12:11:58Z (hora de GitHub)

A9: comprobación → `tests/scrum1528-el-motivo-de-la-ruta-de-alta.test.mjs`

S1 (sesión `s1-13octc`, equipo de Luis). Lo levantó el orquestador del equipo de Javier, que no tocó el
fichero por ser de este carril (`node scripts/carriles.mjs de src/core/http/publicAccessDeclarations.ts`
→ S1).

## El defecto, visto hoy antes de tocar

`src/core/http/publicAccessDeclarations.ts:116`, en `origin/main`:

    reason: 'mismo diseño anti-enumeración que /auth/login',

Y el handler de esa ruta (`src/modules/auth/app/routes/auth.routes.ts:44`, leído, no modificado: es de J3):

    router.post('/register', (_req, res) => {
      return res.status(409).json({ error: 'registration_closed', message: '…' });
    });

No lee la petición. Contesta lo mismo a cualquiera, así que no hay nada que enumerar: el motivo describía
una defensa contra un ataque que la ruta ya no puede sufrir desde SCRUM-1515.

## Lo que cambia

Una cadena. El `kind` (`no-sensitive-resource`) se queda: sigue siendo cierto, y con más razón.

    reason: 'alta cerrada (SCRUM-1515): responde siempre el mismo 409 registration_closed, sin leer la petición ni consultar ninguna cuenta; no hay :id en la URL',

El ticket no decía qué poner («no os estamos diciendo qué poner»). La entrada no se retira porque la ruta
sigue registrada, y `tests/scrum98-public-access-fail-closed.test.mjs` exige que toda ruta pública
registrada esté declarada.

El motivo de `/auth/login` (línea 110, el otro «anti-enumeración» del fichero) **no se ha tocado ni se ha
evaluado**: esa ruta sí lee la petición.

## La comprobación que no había

Un `reason` es prosa: no falla cuando deja de ser verdad, que es como este caducó sin que nadie lo viera.
`tests/scrum1528-el-motivo-de-la-ruta-de-alta.test.mjs` ata las dos cosas que el motivo nuevo afirma del
handler, leídas del handler por AST: que no usa su parámetro de petición y que contesta
`registration_closed`. El día que el alta se reabra, el handler volverá a leer la petición y el test caerá
pidiendo otro motivo.

Lo que NO hace: no comprueba el `kind` ni vigila los motivos de las demás rutas. Es una ruta, no un censo.

## Lo medido

| qué | resultado |
|---|---|
| compilación (`npm run build`) | sale 0 |
| el test nuevo | 2 de 2 |
| el control del lector, dentro del test | ve que `/auth/login` SÍ lee la petición |
| EN ROJO, con el defecto real: el motivo viejo puesto en la copia compilada (`dist/`, sin tocar `src/`) | el caso 1 cae y node sale 1; restaurado idéntico |
| EN ROJO, fabricado, dentro del test: motivo viejo sobre ruta cerrada, y motivo nuevo sobre ruta reabierta | 1 y 2 afirmaciones que no cuadran |
| los que leen la declaración o la ruta (`scrum98`, `scrum55`, `scrum1515`, `scrum275`, `scrum1202`, `scrum94`) con el nuevo | 7 ficheros, 20 casos: 18 pasan, 0 caen, 2 saltan |

## Lo que NO se midió

- La tanda completa no se corrió en local: la corre el obligatorio del PR.
- Cuáles son los 2 saltos de esos siete ficheros y por qué: no lo miré. No son del fichero nuevo, que no
  lleva ninguno.
- El rojo real falla en la primera de las dos aserciones del caso 1 (el motivo viejo no afirma nada que el
  test sepa leer). La segunda aserción, con ese mismo motivo, sólo está vista en el rojo fabricado.
- `yaqu.app`: nada que ver allí. La cadena no sale en ninguna respuesta; la lee `scrum98`.

## Aceptación → dónde se ve

El ticket no trae lista de aceptación. La que he trabajado, escrita al cogerlo (comentario de Jira):

| aceptación | dónde se ve |
|---|---|
| el `reason` de `POST /auth/register` describe lo que la ruta hace hoy | `src/core/http/publicAccessDeclarations.ts`, la entrada de `/auth/register` |
| si el handler vuelve a leer la petición, algo se pone rojo | `tests/scrum1528-el-motivo-de-la-ruta-de-alta.test.mjs` |
| la declaración sigue cuadrando con las rutas registradas | `tests/scrum98-public-access-fail-closed.test.mjs`, verde con el cambio |
