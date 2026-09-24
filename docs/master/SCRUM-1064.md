# SCRUM-1064 · Modelo 303, la pantalla — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## Dependencia declarada por el propio ticket

El ticket dice literalmente **«ESPERA el ticket del cálculo»** y **«Depende de: “Modelo 303
completo, el cálculo”»** — es decir, de SCRUM-1063. [`docs/master/SCRUM-1063.md`](./SCRUM-1063.md)
(mismo PR) mide que SCRUM-1063 está bloqueado por SCRUM-1039 (orden ministerial sin descargar) y
Q-C8 (sin responder, `docs/producto/CONTABILIDAD.md:86`).

Además, la propia aceptación de este ticket repite el mismo gate en su punto 3: **«casilla sin
cita = no aparece»**. Sin la orden citada no hay rótulos ni casillas que pintar: la pantalla se
quedaría vacía por diseño, no por un bug, así que construirla ahora no adelanta nada verificable.

## Qué existe ya, y qué falta

`GET /admin/modelo-303` existe (`src/modules/fiscal/modelo303/modelo303.routes.ts`) y no tiene
pantalla — el propio ticket lo cita correctamente
(`docs/master/SCRUM-295.md:136-147`). No hay ningún fichero de `public/dashboard/js/` con
`modelo303` ni `modelo-303` (grep sin resultados). No hay trabajo previo que absorber ni que
duplicar: simplemente no se puede construir la pantalla de un cálculo que todavía no tiene sus
casillas finales.

## Siguiente paso exacto

Ninguno para J1 hasta que SCRUM-1063 se desbloquee (que a su vez espera SCRUM-1039 + Q-C8). Cuando
llegue, además hace falta la skill `yaqu-premium-ui` (ya declarada en el propio ticket) y la firma
del fundador para el texto y el nombre del modelo (regla 39).

## STOP respetado

No se ha tocado el cálculo, la ruta existente, ni ningún fichero de `public/dashboard/`. Solo
lectura y este documento.
