# SCRUM-1717 · mitad S1 · `/admin/me` manda el motivo sin emisión (`motivoSinEmision`)

**Medido contra:** `origin/main` = `5203048057ac173083b036a214043a6a3debf356` · 2026-11-12T12:32:50Z

A9: comprobación → `tests/scrum1717-me-manda-el-motivo-sin-emision.test.mjs`

Puesto S1 (equipo Luis), 12-nov-2026. Ticket abierto por el orquestador del equipo de Javier; reparto en
c.21654: S1 el motivo en `/me`, S2 el aviso en Inicio/barra con los dos literales firmados.

## Origen y decisión

Con `INVOICING_ES_ENABLED` puesto y el SII en «Sí» o «No consta», M (SCRUM-1585) deja al profesional en
`receipt`, y `/admin/me` no decía por qué: el navegador no podía distinguirlo del flag apagado. Decisión
del fundador en SCRUM-1713 c.21583 (el aviso en Inicio o en la barra); líneas exactas de J1 en c.21586:
«S1: `/me` (`src/app.ts`) devuelve el motivo (`motivoSinEmision`: `sii_declarado` / `sii_no_consta` / nada)».

## Qué cambia

`src/app.ts` (contenedor S1), bloque de `GET /admin/me`:

- Nuevo campo `motivoSinEmision: motivoSiiSinEmision(merchantParaModo)` → `'sii_declarado'` ·
  `'sii_no_consta'` · `null`. Mismo objeto (`merchantParaModo`, que ya trae `llevaLibrosPorSii` desde
  SCRUM-1594) y misma función que el modo de emisión: el navegador recibe el veredicto, no la regla.
- Sin texto. Los dos literales (SCRUM-1585 c.20539) los pinta S2.

## Cómo se midió

- `tests/scrum1717-me-manda-el-motivo-sin-emision.test.mjs`: la app real por HTTP (`_banco-camino-real.mjs`),
  con un doble de `merchant.findUnique` que HONRA el `select`. Rojo primero: 5 de 6 caían con «/admin/me
  no manda `motivoSinEmision`». Verde: 6/6. Casos: «Sí» → `sii_declarado` (modo `receipt`), «No consta» →
  `sii_no_consta`, control «No» → `null` con modo `fiscal`, flag apagado → `null` con los tres valores del
  SII, fuera de España → `null`.
- Mutaciones sobre `dist/app.js` (bytes restaurados, hash comprobado): el campo a `null` → caen 2; quitar
  `llevaLibrosPorSii` del `select` → caen 2.
- Los 166 ficheros de `tests/` que nombran `/admin/me`, `app.ts` o `motivoSiiSinEmision`, con un banco
  Postgres desechable propio (`LIBRO_PG_URL`, loopback, `*_test`) para los gateados: 1232/1232, 0 saltados.

## Sin medir

- yaqu.app: verlo allí exige encender el flag a un merchant real (regla 24). El campo con el flag apagado
  (`null`) sí se puede ver en `/admin/me` en cuanto se despliegue.
