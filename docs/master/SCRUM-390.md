# SCRUM-390 · La cláusula «el primer cliente real» deja de ser prosa

**Fecha:** 10-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `7efbaf03c7d2b3af7a0022dfaa678d888eca9a4d` · 2026-08-10T11:12:08+02:00

## El defecto

Varias decisiones llevaban la cláusula **«el día que entre el primer cliente real»**. Ese día **no
dispara nada**: es una condición escrita en prosa que nadie evalúa. Un aviso no impide nada, y el
día que llegue nadie va a releer el máster.

**Censo derivado**, y el número real: la cláusula aparece en **3 sitios de 2 documentos** —
`docs/YAQU_MASTER.md:1472` y `:1473`, `docs/MIGRATIONS_PENDING.md:662` — no en el código. En
`src/` y `public/` hay **cero** condiciones que la evalúen. (El encargo hablaba de nueve
decisiones; lo que el vocabulario de la cláusula encuentra hoy son esas tres apariciones, que
gobiernan la regla fechada completa y el backfill que se dejó caer.)

## Por qué NO hay un campo `Merchant.esCliente` — decisión del fundador

**Un campo que alguien tiene que acordarse de marcar tiene EXACTAMENTE el mismo modo de fallo que
la cláusula en prosa que sustituye.** Cambiar una promesa escrita por una casilla que hay que
rellenar no es un mecanismo: es la misma promesa con otra forma.

## Dos señales, porque una sola ya falló hoy

| | señal | por qué |
|---|---|---|
| ① | `stripeSubscriptionId != null` en cualquier merchant | pagar es un hecho duro, lo produce un sistema **externo** y nadie puede olvidarse de marcarlo |
| ② | más merchants que `CUENTAS_DE_PRUEBA_DECLARADAS` = **13** | la ① no basta: **un cliente real en trial que aún no ha pagado no la dispara**. Ésta sí lo caza |

**El 13 está medido**, no supuesto: `docs/MIGRATIONS_PENDING.md` lo dice al describir el nacimiento
de una columna («los 13 merchants») y SCRUM-364 lo cruzó («8 de 13 merchants sin oficio»).
**Solo puede bajar, o subir CON MOTIVO ESCRITO** en el mismo commit.

Ninguna de las dos decide nada: **avisan de que ese día llegó**, y **nombran las cláusulas** que
dependían de que no lo hubiera. Lo que se hace después lo decide una persona.

## Las tres piezas

1. `src/modules/system/domain/puertaClienteReal.ts` — el evaluador, puro.
2. `tests/scrum390-puerta-cliente-real.test.mjs` — el censo de cláusulas **derivado de los
   documentos** + el evaluador probado con datos sintéticos. **Sin base.**
3. `scripts/puerta-cliente-real.mjs` (`npm run puerta:cliente-real`) — lo único que necesita base:
   dos `count`. Solo lee, y nunca imprime la URL (`describirBD`, SCRUM-226).

## Verificación

| control | resultado |
|---|---|
| **negativo**: 13 merchants, 0 pagando → puerta cerrada | ✅ |
| **① paga**: 1 con suscripción → abre, y el aviso NOMBRA las cláusulas | ✅ |
| **② uno de más**: 14 merchants, 0 pagando → abre | ✅ |
| las dos a la vez → se declaran las dos | ✅ |
| **SUELO del censo**: si no encuentra cláusulas, FALLA | ✅ |
| **SUELO del evaluador**: un padrón ilegible **no** es «no ha entrado nadie» | ✅ |

## 🔴 Y el trinquete de SCRUM-411 me cazó a mí, el día después de escribirlo

Al añadir `puertaClienteReal.ts` el censo de módulos inalcanzables subió de 8 a 9 **nombrándolo**.
Tenía razón: su única puerta era un script, y el analizador declaraba ese punto ciego
(«no se mide el alcance desde crons que no cuelguen de `index.ts`»). **No subí el tope.** Cerré el
hueco, y de paso el analizador aprendió tres cosas reales:

* las **entradas de comando** se derivan de `package.json` (un script que nadie invoca sigue muerto);
* se siguen las aristas de esas entradas, y también cuentan como **importadores**;
* se resuelven los `import()` **dinámicos** y se traduce `dist/**/x.js` → `src/**/x.ts`.

El censo vuelve a **8/84**, sin tocar el tope.

## Lo que NO cubre — declarado

* **El analizador sigue sin ver `const { a } = await import('x')`** (destructuración de importación
  dinámica). En vez de arrastrarlo, el script importa el evaluador **estáticamente** y el hueco
  queda dicho aquí.
* **Nadie ejecuta el comando solo.** `npm run puerta:cliente-real` existe y funciona, pero no hay
  cron que lo dispare: engancharlo a uno es decisión de producto y necesita dónde avisar.
* **La ② depende de que el tope se mantenga honesto.** Si alguien lo sube sin motivo, deja de cazar.
* **No se comprueba contra producción desde aquí**: el script necesita `DATABASE_URL` y esta sesión
  no toca bases del proyecto.
* **La décima cláusula** (SCRUM-402: el rótulo de Bizum necesita microcopy antes de encender la
  bandera) **viaja ya en la lista que el script nombra**, pero no tiene guard propio que la exija.
