# SCRUM-1594 · `llevaLibrosPorSii` en los 6 `select` de S1 que alimentan `getEmissionMode`

## 29-oct-2026 · S1 · los 6 sitios de la tabla del ticket, y fuera el `as any` de la landing

**Medido contra:** `origin/main` = `5deff8b3b7b0f8a8d3cd037baabbca454ea7aa29` · 2026-10-29T09:42:29Z

A9: sin fallo que generalice — cambio aditivo de seis `select` y una llamada; no salió nada mal que enseñe algo fuera de este ticket.

**Por qué:** lo pide SCRUM-1585 (J1), que hace `llevaLibrosPorSii` OBLIGATORIO en `MerchantLike`. Éste va
ANTES que aquél en `main`.

**Aditivo, medido:** `git grep -n llevaLibrosPorSii origin/main -- src` no lo encuentra en ninguno de los
cuatro ficheros. Ninguna de esas rutas lo lee hoy, y los dos consumidores del `merchant` en el camino de
emisión (`congelarEmisorDesdeFicha`, `sellarTrasEmision`) copian campo a campo: el campo de más no llega a
nada que se guarde ni se selle.

| fichero | sitio |
|---|---|
| `src/modules/jobs/app/routes/albaranes.routes.ts` | `select` del merchant antes de `getEmissionMode` (`getEmissionMode` en la 484) |
| `src/modules/jobs/app/routes/albaranes.routes.ts` | ídem `facturar-parcial` (1345) |
| `src/modules/jobs/app/routes/albaranes.routes.ts` | ídem el tercero (1547) |
| `src/modules/jobs/app/routes/jobs.routes.ts` | `select` de `consolidar-albaranes` (1670) |
| `src/app.ts` | `select` de `merchantFull` y `merchantParaModo` |
| `src/modules/system/app/routes/quoteDecisionLanding.routes.ts` | `select` de `loadQuote` y la llamada sin `as any` ni `?? {}` |

El `?? {}` de la landing se va con el `as any`: `Quote.merchant` es relación obligatoria
(`merchant Merchant @relation(...)`), así que nunca se usaba. Y tras el `if (!loadedQuote) return` el
compilador ya sabe que no es `null`.

**Cómo se comprobó que basta (sonda, NO comiteada):** se puso en local `llevaLibrosPorSii: boolean | null`
obligatorio en `MerchantLike` y se corrió `tsc --noEmit`.
- Sin este cambio: 17 errores, 7 de ellos en estos 4 ficheros (la landing no salía: el `as any` la escondía).
- Con este cambio: 11 errores, **ninguno en los 6 sitios**.
- Quitada la sonda, `tsc --noEmit` sale 0.

Los 11 que quedan son de otros carriles (`lifecycle.service.ts` ×3, `weeklyDigest.service.ts`,
`invoicesAdmin.routes.ts` ×2, `merchantAdmin.ts`, `encolarRemision.ts`, `invoiceNumber.service.ts`,
`whatsappIncoming.routes.ts`) **y uno de S1 que no está en la tabla del ticket: `src/app.ts:802`**,
`isDemoMerchant(merchant)` con `select: { id, email }` en el barrido del demo. Ése no llama a
`getEmissionMode`. Sólo cae si SCRUM-1585 deja `isDemoMerchant(m: MerchantLike)` con el campo obligatorio.
No se toca aquí: se le avisa a J1 por el orquestador.
