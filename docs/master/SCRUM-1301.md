# SCRUM-1301 · un Bizum con fecha de «hoy» se rechazaba de madrugada

**Medido contra:** `origin/main` = `c8d9d6b4b784866ada0224752fb4a28bac0727f4` · 2026-09-29T18:08:02Z (J2, equipo de Javier)

A9: comprobación → `tests/scrum1301-bizum-hoy-de-madrugada.test.mjs`

## Qué pasaba

La misma fecha se validaba dos veces con dos zonas distintas:

- `chargesAdmin.routes.ts` (`confirm-bizum`): `resolverFechaDeCobro(entrada, ahora, zonaDelMerchant(charge.merchant))`.
  Con la zona del merchant desde SCRUM-1093.
- `psp.routes.ts` (el webhook, al que `confirm-bizum` reenvía la fecha como `ts`):
  `resolverInstanteDeCobro(body.ts)`, **sin zona**, así que el día natural se calculaba en UTC.

Entre las 00:00 y las 02:00 de Madrid (00:00–01:00 en invierno), el «hoy» de Madrid ya es
«mañana» en UTC. `confirm-bizum` aceptaba la fecha y el webhook la rechazaba con `fecha_futura`
400. Como axios lanza ante un 400, `confirm-bizum` caía en su `catch` y el profesional recibía
`500 internal_error`. El webhook no marca nada cuando rechaza (fail-closed), así que **no había
dato corrupto**: el cobro, sencillamente, no se podía apuntar.

La medición es de J6. La comprobé contra `origin/main`, no la volví a medir. Líneas: el `confirm-bizum`
de `chargesAdmin.routes.ts` y la rama `payment.confirmed` de `psp.routes.ts`. Los cinco casos, contra
las funciones compiladas: ① rojo (confirm acepta, webhook `fecha_futura`), y ②③⑤ ok, como dijo J6.
El ④ sale 400 ya en `confirm-bizum`. El tramo del 500 lo leí en el código (axios + `catch`), igual
que J6: **no lo he ejecutado por HTTP**.

## El permiso

Es camino de cobro: sin GO sería STOP de dinero. El GO está en la descripción de SCRUM-1301,
sección `h2. GO`. **Transcrito por el orquestador, no leído por J2**: esta sesión no puede abrir
Jira (el conector de Atlassian pide OAuth).

> Pregunta, literal: «**SCRUM-1093** (zona horaria en el camino de cobro): ¿doy GO para arreglarlo,
> o queda parado? Y si quieres saber a cuántos merchants afecta, hace falta que alguien mire la
> columna `timezone` en producción — eso solo lo puedes hacer tú.»
>
> Javier, 29-sep-2026, literal: «**3-Go para rreglarlo**»

⚠️ **El GO se dio bajo el número equivocado.** La pregunta citaba SCRUM-1093 porque el
orquestador creía que la medición de J6 era una fila de 1093. No lo es: 1093 (fila
`fechaDeCobro`, reportes / criterio de caja) es otra cosa y sigue abierta, como explica su
comentario 17594. Lo que Javier autorizó, «zona horaria en el camino de cobro», es exactamente
este defecto, y por eso J2 lo da por válido. Pero queda escrito que **el número de la pregunta no
es el de este ticket**: en seis meses, esto parecería una autorización que nadie dio.

SCRUM-1093 no se toca ni se cierra aquí.

## La decisión: el webhook recibe la zona. `confirm-bizum` sigue validando.

El GO permitía dos arreglos: que el webhook use la zona del merchant, o que `confirm-bizum` no
revalide. Elegí **el primero**:

- El webhook es la única puerta que escribe `paid_at`, y la usan también los reenviadores
  automáticos. Quitar la validación de uno de los dos lados dejaría una sola comprobación en un
  camino que hoy tiene dos. Con la zona, las dos preguntan lo mismo y coinciden.
- `confirm-bizum` tiene que seguir validando **antes** de reenviar, porque es él quien devuelve al
  profesional el 400 con su texto firmado (`fecha_futura` / «Esa fecha no puede ser posterior a
  hoy.»). Si sólo validara el webhook, ese 400 se convertiría en el 500 genérico de su `catch`.
- **No se fija `Europe/Madrid`.** La zona sale de `zonaDelMerchant(...)` para el merchant **del
  cobro** (`charge.merchantId`). Para un merchant canario, el día en UTC+0 es el correcto en
  invierno. Y un merchant sin zona declarada sigue en UTC, como antes.

## Qué cambia

- `src/modules/billing/domain/instanteDeCobro.ts`: `resolverInstanteDeCobro(declarada, ahora, zona?)`
  pasa `zona` a `resolverFechaDeCobro`. Sin zona, el resultado es el de antes.
- `src/modules/billing/app/routes/psp.routes.ts`, rama `payment.confirmed`: antes de resolver, lee
  `timezone` del merchant del cobro (`prisma.merchant.findUnique({ where: { id: charge.merchantId },
  select: { timezone: true } })`) y resuelve con `zonaDelMerchant(...)`.
- La respuesta al proveedor no cambia: si la fecha no vale, sigue siendo `400 { error, message }` y no
  se marca nada. Nada más del camino de cobro se ha tocado. Tampoco el camino de emisión fiscal, ni
  hay texto nuevo.

## Cómo se prueba

`tests/scrum1301-bizum-hoy-de-madrugada.test.mjs` recorre el camino real: la ruta del webhook
**compilada**, con la base doblada (el arnés de `scrum815`) y el reloj situado con `mock.timers`.
Cada caso pasa primero por `confirm-bizum` (con la zona) y luego por el webhook con su `ts`:

| # | Caso | Antes | Ahora |
|---|---|---|---|
| ① | Madrid, 31-mar 23:30Z, fecha 1-abr | **ROJO** (webhook `fecha_futura`) | confirm y webhook aceptan; `paidAt` = la fecha dada |
| ② | Madrid, 1-abr 10:00Z, fecha 1-abr | ok | ok |
| ③ | Madrid, 31-mar 21:00Z, fecha 31-mar | ok | ok |
| ④ | sin zona, 31-mar 23:30Z, fecha 1-abr | 400 en confirm | **400 en confirm** (correcto: para él es 31) |
| ④b | el mismo, directo al webhook | 400 | **400 `fecha_futura`, misma forma, nada marcado**, y consta que preguntó por el merchant |
| — | Canarias, 31-ene 23:30Z, fecha 1-feb | 400 | **400 en los dos pasos**: es lo que desmonta fijar Madrid |

① lo vi **rojo antes del arreglo** (y ④b sólo caía en su positivo, «no preguntó por el merchant»).
Después: 7/7.

**Mutaciones sobre `psp.routes.ts` (build en cada una, todas CAEN, fuente restaurado por sha256):**
Madrid fija → cae (2) · sin zona, como antes → cae · aceptar cualquier fecha → cae (2) · zona de
otro merchant (`id: 1`) → cae.

## El guard de SCRUM-397 que hubo que cambiar (regla 41: J2 paró y preguntó)

`tests/scrum397-instante-de-cobro.test.mjs` exigía el texto `/resolverInstanteDeCobro(body.ts)/` en
`psp.routes.ts`. Su intención, escrita en su mensaje, era «que el webhook lea `body.ts`». Pero el `)`
codificaba además «exactamente un argumento», y eso nunca fue lo que ese guard vino a proteger. Retorcer
el código para que el texto encajara habría sido peor que el defecto. J2 paró y el orquestador dio el sí
(por mensaje, 29-sep ~18:20Z), con cuatro condiciones. Cumplidas así:

1. **Es más estricto que antes, no menos.** Ahora exige `body.ts` como PRIMER argumento **y**
   `zonaDelMerchant(` dentro de la misma llamada. Sujeta 397 y sujeta 1301.
2. **Interrogado con mutaciones del GUARD**, que son otra población que las del comportamiento. Las
   cuatro CAEN, cada una con su mensaje: volver a ignorar `body.ts` (`new Date()` como primer argumento)
   → cae · quitar `zonaDelMerchant(` → cae · `body.ts` en segundo lugar → cae · la forma vieja de un solo
   argumento → cae (por la zona). Fuente restaurado por sha256.
3. **Va en el mismo commit que el código.** El mensaje de la aserción dice qué sujeta ahora y por qué
   cambió el patrón.
4. **¿Vive en otro sitio?** Hice `grep` de `resolverInstanteDeCobro` y de `body.ts` en `tests/` y
   `scripts/`: sólo `scrum397` exigía la forma literal.

## Lo que queda fuera

- **SCRUM-1093** (la fila `fechaDeCobro` de reportes / criterio de caja): sigue abierta, no se toca.
- **Cuántos merchants tienen `timezone` en producción:** no se ha medido. Solo lo puede mirar Javier.
- Que el 400 del webhook se convierta en un 500 en `confirm-bizum` sigue igual para los casos que
  el webhook rechace con razón. Tras este arreglo, `confirm-bizum` ya no le manda ninguno de esos.
