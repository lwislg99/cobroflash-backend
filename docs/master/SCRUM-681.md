# SCRUM-681 · Esperar la condición, no el reloj

**Medido contra:** `origin/main` = `54a03c4e687d5c359dfa9b7ec84d931b0fda4f42` · 2026-09-02T15:00:00+02:00
**Rama:** `scrum-681-esperar-la-condicion` · **Ninguna base tocada.**

## 🔴 Dos datos del encargo no cuadran contra el árbol, y el peor lo di yo

### 1 · `scrum268` NO duerme 120 s. No duerme nada.

Sus dos `setTimeout(60000)` (`:85` y `:147`) viven **dentro de literales de cadena**: son código
**sintético** que se le pasa a un analizador estático, no esperas que se ejecuten. El tercer 60.000
(`:133`) tampoco es una espera: es el **tope del test**.

**Medido: el fichero tarda 2,0 s.**

> **La «propina de 120 s» que prometí en SCRUM-673 no existe.** La saqué de un `grep` y la presenté
> como medida. Es exactamente el error que el fundador acababa de corregir en sí mismo —dar un
> fichero sin medirlo—, cometido por mí en el mismo intercambio. **No se toca nada ahí: no hay nada
> que arreglar.**

### 2 · `bot-suite` tiene TRES esperas de 1.500, no dos

`:168`, `:180` y `:310`. Más dos pequeñas de 100 y 120 ms que son el **sondeo de sus propios
ayudantes**, y ésas están bien.

## Y el defecto real es mucho mayor que las tres esperas

| | medido |
|---|---|
| `await waitOutbox(...)` | **23 llamadas** |
| `await settle()` | **12 llamadas** |
| llamadas que miran lo que `waitOutbox` devuelve | **0** |

`waitOutbox` devolvía `outbox.length` **pasara lo que pasara** al vencer su techo, y `settle` salía
del bucle igual. Como nadie mira el valor, **un techo vencido sí producía veredicto** — en 35
sitios, no en tres.

## La cura: `tests/_espera-quieta.mjs`, con las tres propiedades

1. **Se espera a la CONDICIÓN.** El plazo es solo el techo, no la medida.
2. **Un techo vencido LANZA `NoMedido`**, diciendo qué se esperaba y que el número es **hasta dónde
   se miró**, no lo que tardó.
3. **No se puede afirmar «no llegó nada más» mientras siguen llegando cosas.** `esperarQuieto` exige
   que el buzón esté QUIETO; si al vencer seguía moviéndose, eso es NO MEDIDO.

### Por qué las tres esperas fijas eran peores que un tope que se pasa

Las tres sostenían asserts **NEGATIVOS** — «no debe responder de nuevo», «no duplica», «debe estar
MUDO». Un tope que se pasa da un **rojo por lentitud, y un rojo se ve**. Una espera fija no
ralentiza el test: **le hace comprobar algo que todavía no ha ocurrido**, y sobre un negativo eso
sale **VERDE**. Un verde que no prueba nada.

## El control que decide

El test reproduce el caso real y comprueba que **la espera fija daría verde justo donde la nueva
dice NO MEDIDO**. Si el mecanismo viejo aprobara lo mismo, el control no probaría nada.

**Commit de seguridad previo a las inyecciones:** `0112dd96e5e3657f868f3e38bc5316e8b13449a9`.

| inyección | resultado |
|---|---|
| el techo vencido vuelve a devolver en silencio | `rc=1` · *Missing expected rejection* |
| vuelven las tres esperas fijas a `bot-suite` | `rc=1` · *«quedan 3 espera(s) fija(s)…»* |

## El número que pediste, y es pequeño

| | |
|---|---|
| dormido SIEMPRE por las tres esperas | **4.500 ms** |
| cota superior con `settle()` ya quieto | ~1.020 ms cada una |
| **ahorro** | **~1,4 s por tanda**, y **solo cuando `bot-suite` corre** |

**No son los 120 s que prometí.** Y hay que decir lo que de verdad justifica el ticket: **no es el
tiempo, es el verde falso**. Con la máquina cargada, esos tres asserts pasaban **sin haber
comprobado nada**, y los 23 `waitOutbox` decidían sobre buzones a medio llenar.

## Verificación

- Suite entera **con la máquina vacía**: `fail 0`.
- Suite entera **con carga** (16 procesos en 8 núcleos): **4506 tests, `fail 0`**.
- El fichero del ticket bajo carga: 7/7.

## Hueco declarado

🔴 **`bot-suite` NO se ha ejecutado.** Está gateado tras `BOT_SUITE_TEST=1` y arrastra
`_staging-db.mjs`, o sea que **corre contra la base de staging**, y la regla permanente lo prohíbe.
Comprobado que **parsea** y que **sigue saltando gateado**. Que la cura se comporte bien contra el
bot real es verificación de despliegue, no de esta tanda.

## Lo que NO se ha tocado

`whatsapp.ts:141,149` (ahí el plazo protege una llamada externa de verdad) · el grupo 1 (SCRUM-679)
· `guard-contraste` · `prisma/schema.prisma` · `scrum268`, porque **no tenía el defecto**.
