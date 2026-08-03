# SCRUM-255 · los 5 sondeos fire-and-forget pasan al punto de sincronización (+ SCRUM-256, absorbido)

**Fecha:** 3-ago-2026 · **Carril:** B (QA) · **Gate:** sin gate el helper; los 5 migrados son gateados

**Medido contra:** `origin/main` = `b8094d77544a69f4b78e14be9382008f593f578f` · 2026-08-03T13:10:28+02:00

> La hora es el `committer date` del primer commit del trabajo, no una lectura de reloj del
> instante de la medición — misma advertencia que en [SCRUM-252](SCRUM-252.md). La sha sale de
> `git reflog`: `b8094d7 … branch: Created from origin/main`.

## El defecto

Cinco tests esperaban **con un reloj** a una escritura que nadie espera:

| Test | Sondea | Escritura |
|---|---|---|
| `a55-window-quote` | `whatsAppMessage` | `recordWaMessage` |
| `scrum47-enviar-albaran-wa` | `whatsAppMessage` | `recordWaMessage` |
| `scrum49-firma-remota` | `whatsAppMessage` | `recordWaMessage` (×2 sitios) |
| `scrum52-operario` | `auditLog` | `recordAudit` (×2 sitios) |
| `scrum66-tipo-operacion` | `auditLog` | `recordAudit` |

Es la forma que [SCRUM-250](SCRUM-250.md) retiró de `scrum115`, donde **el mismo código cayó en
dos tandas y no cayó en la tercera**: la variable era la latencia de staging, no el diff.

## Lo que se midió antes de construir, y cambió el trabajo

**Los 3 de WhatsApp encajan directos.** Los 2 de auditoría **no**, y no por un detalle:

```ts
export function recordAudit(params): void {
  prisma.auditLog.create({ ... }).catch((e) => console.error(...));
}
```

`recordAudit` devuelve **`void`**. La promesa se crea y **se tira DENTRO de la función**. La
premisa que sostiene la Capa 1 de SCRUM-250 —*«el fire-and-forget no es "no hay promesa", es "hay
una promesa y nadie la recoge"»*— es **literalmente falsa** para auditoría: envolver la exportación
desde fuera devuelve `undefined`.

Lo que sí funciona es envolver el delegate `prisma.auditLog.create`. **Helper hermano**
(`tests/_audit-log-sync.mjs`), con el porqué escrito **dentro del propio helper**.

**Es viable porque hay solo DOS `auditLog.create` en todo `src/`**, los dos en `audit.service.ts`
(`:253` en `recordAudit`, `:270` en `recordAuditOrThrow`): envolver el delegate no deja ninguna
escritura fuera ni recoge nada ajeno.

## Absorbe SCRUM-256

Los **11 llamadores** de `recordAudit` quedan cubiertos **sin excepción**, porque `recordAudit`
**no es `async`**: invoca `prisma.auditLog.create` de forma síncrona y le cuelga un `.catch`, así
que envolver el delegate recoge la promesa aunque la función la tire. **256 se cierra sin código.**

## `esperarAlMenos(n)`

`recordAudit` puede colgar de un fire-and-forget **anidado**, con un `await` por medio:

```
ensureJobForQuote(quote.id).catch(() => {})   ← el llamador NO espera
   └─ await prisma.job.create(...)             ← un await POR MEDIO
        └─ recordAudit({ operario_asignado })  ← aquí nace la promesa
```

Ahí `esperar()` drena lo ya empezado —que es nada— y su suelo da un **rojo con el diagnóstico
equivocado**: «el log ya no pasa por aquí», cuando la verdad es «aún no ha empezado».
`esperarAlMenos` espera a que **arranque** y luego a que termine; si ya arrancó, no espera nada.

> ⚠️ **Medición que NO coincide con el contexto recibido, dicha y no enterrada.** En `scrum52` el
> test hace `await ensureJobForQuote(...)` **directo**, no por HTTP; y en `scrum66` la ruta llama a
> `recordAudit` **antes** de `res.json`. Con los dos tests **tal como están escritos**, `esperar()`
> habría bastado. Se usa `esperarAlMenos(1)` igualmente porque es correcto en **los dos** casos y
> elimina un riesgo que no puedo descartar ejecutando (son gateados). **El caso anidado sí es real
> en producción**: los 3 llamadores de `ensureJobForQuote` van sin `await`.

## Punto ciego, declarado en el helper

Los dos `recordAuditOrThrow(..., tx)` —**`factura_emitida`** y **`cambio_flag`**, los dos
**fiscales**— son invisibles para cualquier envoltura de `prisma.auditLog`, porque `tx.auditLog` es
otro objeto. No necesitan sincronización (van esperados dentro de su transacción), **pero una
aserción NEGATIVA sobre ellos pasaría en vacío**. Los dos `exportacion_fiscal` sí se ven: usan el
cliente global.

**Un helper que no declara qué no ve promete de más.**

## `scrum66:91` se INVIERTE, no se migra

Allí había `await sleep(400)` — «margen para un (no) audit async». Un punto de sincronización
espera a que algo **termine**; ahí la expectativa es que **no haya nada que esperar**, y `esperar()`
además **lanza** (su suelo existe para avisar de lo que aquí sería el resultado bueno).

La afirmación correcta es `interceptadas === 0`: **inmediata**, y más fuerte que contar filas tras
dormir — dice que la escritura **no llegó a nacer**. Va escrito en el test y en el helper para que
nadie lo «arregle» migrándolo.

## Una ventana por caso

No una abierta de principio a fin: el suelo `interceptadas === 0` solo protegería al primer caso —
para el segundo el contador ya no sería cero aunque su escritura no hubiera nacido.

## Verificado en rojo

`tests/scrum255-audit-log-sync.test.mjs` (17) **con dobles y SIN GATE** — una red que solo se
ejercita con staging levantada no es una red. Tres inyecciones, revertidas:

1. no encolar la promesa → caen 6;
2. no despertar a `esperarAlMenos` → **cuelga hasta la red de 60 s** y caen 2, lo que de paso
   demuestra que la red convierte «colgado para siempre» en «rojo con motivo»;
3. quitar el suelo → caen 2.

## Límite declarado

**Los 5 migrados son gateados y no se han podido ejecutar aquí** (hacen falta staging y el turno).
Lo comprobado sin gate: **cargan**, sus imports resuelven, y **no queda ni un sondeo ni una espera
plana** en los cinco ficheros.

## Ficheros

* `tests/_audit-log-sync.mjs` (nuevo)
* `tests/scrum255-audit-log-sync.test.mjs` (17, sin gate)
* `tests/a55-window-quote.test.mjs`, `scrum47-enviar-albaran-wa`, `scrum49-firma-remota`,
  `scrum52-operario`, `scrum66-tipo-operacion`

Suite **1118, 0 fallos**.
