# SCRUM-1713 · El motivo del SII en la respuesta de las rutas de J1 (cinturón de D1)

**Medido contra:** `origin/main` = `4eea7720bae9c2584a2d2312358d0566f779f1a5` · 2026-11-12T10:31:12Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum1713-el-motivo-sii-en-la-respuesta.test.mjs`

Sesión `jv-j1ds` (puesto J1), 12-nov-2026, por encargo del orquestador `cobroflash-backend-a0`.
Decisión del fundador en SCRUM-1713 c.21583: ① el literal firmado (SCRUM-1585 c.20539) se ve en
Inicio o en la barra, que es de S1 (el motivo en `/me`) y S2 (la pantalla): NO entra aquí; ② el
cinturón de J1, sí, dentro del GO de SCRUM-1585 c.20531 y sin texto nuevo.

## ① Qué entra

- `POST /admin/invoices` (factura suelta): con el modo en `receipt`, el 409 lleva
  `motivoSiiSinEmision(merchant) ?? 'factura_suelta_no_disponible'`. Con el flag apagado, el código
  de siempre. El `message` no cambia.
- `POST /admin/invoices/:id/rectify`: no tenía puerta de modo; el embudo lanzaba `sii_*` y el `catch`
  respondía 500 `internal_error` (medido en rojo, por la ruta). Ahora pregunta a `motivoSiiSinEmision`
  antes de pedir número y contesta 409 con su código. El embudo sigue siendo la puerta que manda.
- Sólo `invoicesAdmin.routes.ts` (J1). Ni sellado, ni XML, ni huella, ni registro, ni los dos ficheros
  que congela `scrum523d`.

## ② Qué NO entra

- La pantalla (decisión ①): la medición de los caminos está en SCRUM-1713 c.21580, y las líneas para
  S1 y S2, en el comentario de entrega.
- Con el flag apagado, una R1 de un merchant español sigue dando 500 si llega al embudo
  (`invoicing_es_disabled`); no es de este ticket.

## ③ Cómo se midió

- Rojo primero, por la ruta montada en express con `requireRole` y por HTTP: 4 de 7 caen sobre `main`
  (la R1 con el 500), los 3 controles pasan. Con el arreglo, 7 de 7.
- `tsc -p . --noEmit` con tipos: salida 0.
- Dirigida: 10 ficheros (este, 523d, 1585, 308 ×2, 289b, 237, 976, 1387, 1051d), 96 casos, 96 pasan.
- Mutaciones: 3 declaradas en `MUTACIONES_QUE_ME_TUMBAN`. Mi driver con `aplicarUna` salió **CIEGO**
  en las 3 (la pasada limpia no le devolvió nombres): NO CORRIDAS. Las corre el meta-guard.
- Sin medir: ninguna base, nada en yaqu.app, la suite entera.
