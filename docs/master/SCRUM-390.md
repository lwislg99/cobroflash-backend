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
| **② uno de más, probado de verdad**: tope 12 contra 13 reales → cae nombrando los dos números | ✅ |
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

## ⚠️ Y un guard mío que se medía contra sí mismo

El control negativo usaba `CUENTAS_DE_PRUEBA_DECLARADAS` **en los dos lados**, así que se movía con
la constante: bajé el tope a 12 para probar el rojo de la señal ② y **el test siguió verde**. Un
guard medido contra sí mismo no mide nada. Ahora el número de hoy va como **literal medido**
(`MERCHANTS_HOY = 13`) y cualquier cambio del tope lo pone en rojo nombrando los dos números.

## Dónde avisa — decisión del fundador, 10-ago-2026

Se engancha al **cron diario de mantenimientos** (10:00) como **paso aparte y DESPUÉS**, y cuando
la puerta se abre **avisa al fundador por WhatsApp** con la Meta Cloud API que el producto ya usa.

| descartado | por qué |
|---|---|
| **log solo** | con el backup se aprendió que algo que solo escribe en un log es algo que nadie ejecuta. Un aviso que nadie lee es prosa otra vez — el defecto del ticket |
| **arranque** | un `exit(1)` por esto tiraría el servicio. **La puerta avisa, no frena** |
| — | **WhatsApp** porque ya está construido (regla 36: cero dependencias nuevas) y es el canal que el fundador lee |

**Las cuatro condiciones, cumplidas y probadas:**

* **(a) No tumba el cron.** `avisarSiEntroClienteReal` **no lanza nunca**: devuelve su fallo. Un
  vigilante que rompe lo que vigila es peor que no tenerlo. Probado con un envío que revienta.
* **(b) No spamea, y el criterio está ESCRITO.** Avisa el **día de la apertura** y luego **una vez
  por semana**. La cadencia se **DERIVA** del `createdAt` del primer merchant que dispara la señal
  — porque **no hay dónde guardar el estado sin tocar el schema**: `WhatsAppMessage` exige
  `merchantId` (un aviso interno no tiene merchant, y meterle el del demo es lo que SCRUM-409 acaba
  de prohibir) y la unión de acciones de `AuditLog` está CERRADA (regla 5). ⚠️ Su límite, dicho: si
  el cron no corre el día 0, esa notificación se pierde y la recoge el recordatorio semanal.
* **(c) Solo al fundador.** El número sale de `ALERTA_FUNDADOR_TELEFONO` (Railway); **aquí no se
  escribe ninguno**. El envío va **sin `merchantId`** —un test lo exige— para que no pueda colgar
  de ningún merchant (regla 28). Sin la variable, el paso **no manda nada y lo dice**.
* **(d) Rojo por el mecanismo:** quitar el enganche del cron → cae nombrando *«LA PUERTA EXISTE Y
  NADIE LA EVALÚA»*, que es el defecto que este ticket vino a cerrar.
* **(e) Microcopy propuesta, no escrita.** El texto sale con `[PENDIENTE microcopy oficial]` y un
  test lo exige: **la regla 30 no tiene excepción por destinatario**. Propuesta:

  > «Ha entrado el primer cliente real (motivo). Estas decisiones dependían de que no lo hubiera:
  > …lista de cláusulas…»

## La décima cláusula: la copia de seguridad (SCRUM-242)

Añadida a la lista que el aviso nombra, con su dato medido: el panel de Railway dice hoy, literal,
**«No Backups — this service's volume does not have any backups»**, y PITR solo existe en el plan
Pro. **Cero copias del proveedor, cero copias propias ejecutándose (0 invocaciones, probado) y ninguna
fuera de la infraestructura.**

⚠️ **Corregido el 10-ago:** el motivo decía además «ningún camino de restauración», y eso **ya no
es cierto** — la sesión 4 probó la restauración contra la base desechable y existen §R14 y
`scripts/backup-restore.mjs`. La cláusula **sigue abierta** por su otra mitad, que no se ha movido:
**el fichero del que volver no existe**, porque nadie dispara el volcado. Se corrige porque un
motivo que exagera se descarta entero el día que alguien comprueba una de sus partes.

Hoy no urge **porque los datos de producción son desechables** — la misma regla fechada que esta
puerta vigila. El día que la puerta se abra es **letal**, y además **incumplimiento fiscal**: las
facturas emitidas y los albaranes firmados hay obligación de conservarlos. Por eso va aquí y no a
una lista de tareas: es exactamente el tipo de condición que este mecanismo existe para no olvidar.

## Lo que NO cubre — declarado

* **El analizador sigue sin ver `const { a } = await import('x')`** (destructuración de importación
  dinámica). En vez de arrastrarlo, el script importa el evaluador **estáticamente** y el hueco
  queda dicho aquí.
* **El comando suelto (`npm run puerta:cliente-real`) sigue siendo para mirar a mano**; el que
  avisa solo es el paso del cron.
* **La ② depende de que el tope se mantenga honesto.** Si alguien lo sube sin motivo, deja de cazar.
* **No se comprueba contra producción desde aquí**: el script necesita `DATABASE_URL` y esta sesión
  no toca bases del proyecto.
* **Las cláusulas que el aviso nombra son CUATRO** (regla fechada, backfill, SCRUM-402 y
  **SCRUM-242 · la copia de seguridad**), y un test exige que la de la copia esté. Ninguna tiene
  guard propio que la haga cumplir: el mecanismo avisa de que ese día llegó, no las resuelve.
