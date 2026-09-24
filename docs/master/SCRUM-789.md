# SCRUM-789 · `/health` devuelve el tiempo de su propio `SELECT 1`

**Medido contra:** `origin/main` = `aa60dfad423f175a47efe21b0713a6e1ea71426e` · 2026-09-21T18:25:16Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-789-health-tiempo-del-select` · **Carril:** S1
**Decisión del fundador (21-sep, comentario 16298):** SÍ — se lee en yaqu.app en vez de ejecutarlo a mano. Las salidas A/C/D quedan para J1 tras tener el número.

## Lo que cambia
`GET /health` añade `dbMs`: milisegundos (un decimal) que tarda su propio `SELECT 1` (`health.routes.ts`, ya existía). Es la latencia app→base de producción (RTT) que decide si el límite de emisiones simultáneas es urgente (RTT alto) o teórico (unidades de ms; `N_max ≈ timeout / (5 × RTT)`). Un solo número, cero PII, sin texto de usuario, sin esquema. Con la base caída no hay `dbMs` (ausente no es cero).

## Cómo se lee (tras el deploy)
`curl https://yaqu.app/health` → `dbMs`. Una muestra es ruido: leer varias (el primer `SELECT 1` tras arrancar incluye el handshake de la conexión).

## El juez: `tests/scrum789-health-tiempo-del-select.test.mjs` (sin banco)
Handler real con `prisma.$queryRaw` doblado: SUELO (ok/db up, una consulta), una espera de 40 ms sale entre 35 y 400, y en la caída no hay `dbMs`. 3 mutaciones en rojo (constante 0 · medir después de la consulta · `dbMs` en la caída); restaurado, verde.
