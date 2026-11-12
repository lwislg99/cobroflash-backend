# SCRUM-1720 · El aviso de fallo de Mercado Pago no devuelve a «failed» un cobro pagado

**Medido contra:** `origin/main` = `2c52196fddfdee2f2875c38d51642785d2566812` · 2026-11-12T17:50:29Z (cabecera `Date` de GitHub; sesión `jv-j2c3`, J2)

A9: comprobación → `tests/scrum1720-mp-fallo-no-pisa-pagado.test.mjs`

## 0 · El permiso

GO CONDICIONADO de Javier en SCRUM-1720 c.21767: primero se reproduce con la sonda de SCRUM-1292
c.17635; si se confirma, la MISMA barrera que SCRUM-1292 (#2006) puso en `/webhooks/psp`, y nada más
del flujo de cobro; si no, no se toca el código.

## 1 · La reproducción (antes de tocar `src/`)

Test nuevo que monta la ruta COMPILADA (`dist/.../mpWebhook.routes.js`) con la base, la firma y la API
de Mercado Pago dobladas. El doble hace cumplir el `where` (lanza P2025 si `id` o `status` no casan),
como el de SCRUM-1292. Pasada sobre el código sin tocar, TAP: 5 casos, 4 pasan, 1 cae, 0 saltados.

| # | Caso | Sin arreglo | Con arreglo |
| --- | --- | --- | --- |
| ① | `paid` + `rejected` | sigue `paid`, 0 escrituras | igual |
| ② | `paid` + `cancelled` | sigue `paid`, 0 escrituras | igual |
| ③ | CONTROL POSITIVO `pending` + `rejected` | `failed`, 1 escritura con su evento | igual |
| ④ | se LEE `pending` y se paga antes de escribir | **queda `failed`** 🔴 | sigue `paid`, 0 escrituras |

**Lo que se reproduce y lo que no, dicho por separado:**

- El caso secuencial —un cobro que YA está `paid` cuando llega el aviso— **NO se reproduce**: el `if
  (charge.status === 'pending')` de entrada lo para. Aquí, a diferencia de `/webhooks/psp` en
  SCRUM-1292, la primera barrera sí existía. Es lo que ya decía jv-j4ay en SCRUM-1292 c.21626.
- La carrera entre lectura y escritura **SÍ se reproduce** (④): el `update` con `where: { id }` a
  secas pisa el cobro pagado. Es el defecto que el ticket nombra (la segunda barrera que falta).

## 2 · El arreglo

`src/modules/billing/app/routes/mpWebhook.routes.ts`, sólo la rama `rejected`/`cancelled`: el `where`
lleva `status: { in: ESTADOS_QUE_UN_FALLO_PUEDE_PISAR }` (la lista compartida de
`domain/estadoDelCobro.ts`, la misma de `psp.routes.ts`), y el P2025 se reconoce con
`esFilaQueNoCasa`: se dice en el log y no se escribe nada. Cualquier otro error se relanza al `catch`
de siempre. A Mercado Pago se le sigue contestando 200 al principio, como antes. No se toca la rama
`approved`, ni importes, ni otros webhooks.

## 3 · Lo que se corrió

- Rojo primero: ④ cae sin arreglo (`actual: 'failed'`, `expected: 'paid'`), 4/5. Con arreglo, 5/5.
- Mutaciones del catálogo (`MUTACIONES_QUE_ME_TUMBAN`, aplicadas con `aplicarUna` de
  `scripts/meta-guard-mutaciones.mjs` vía `docs/master/evidencias/SCRUM-1339/r-mutar.mjs`): 2 de 2
  VIVAS (quitar la condición del `where`; relanzar el P2025). Árbol restaurado (`git status`).
- `tsc -p .` con tipos: salida 0.
- Guards vecinos, elegidos a mano (30 ficheros: scrum553, 237, 976, 1387 ×3, 1292, 1315, 489, 1436f,
  502, 100, 473, 1403, 1235, 931, 267, 273, 1294, 1415, 411, 737, 745, 723, 812, 921c, 1177, 747, 85 y
  el nuevo): TAP, 284 casos, 279 pasan, 0 caen, 5 saltados (gateados por base: 4 de scrum1403 y 1 de
  scrum85, no son de este cambio). `guards:entrada`: 15 de 15 en verde. Los 4 de árbol entero de
  SCRUM-1560 (195, 414, 694, 710b): 33 de 33.
- Suite entera local: NO CORRIDA (10 sesiones a la vez; hace de tanda el obligatorio de CI).

**Lo que NO se ha medido:** producción no se ha mirado (Mercado Pago no está activo para ningún
merchant español, regla 23; en SCRUM-1292 c.17637 había 0 cobros pagados). La carrera se simula con
el doble, no con dos peticiones reales contra una base.
