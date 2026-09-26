# SCRUM-904 · «Cobros con tarjeta» con el flag de Connect apagado

**Aprobado por el orquestador por delegación del fundador** el 2026-09-26 — SCRUM-904 comentario 17138.

## El literal, tal cual se pinta

`public/dashboard/js/settingsView.js`, `renderReadinessCard`, fila «Cobros con tarjeta» cuando
`PAYMENTS_CONNECT_ENABLED` está OFF para el merchant (`/admin/connect/status` responde
`enabled: false`):

> Aún no disponible en tu cuenta

## Qué cambió

Antes decía «Activar cobros con tarjeta · 2 min, DNI e IBAN» y ofrecía «Completar →» SIEMPRE que
`connectStatus` no fuera `'active'`, sin distinguir «el flag está apagado» de «el flag está
encendido y aún no has empezado». Con el flag apagado, la fila prometía una activación que no se
puede hacer: el clic llevaba a una pestaña donde el bloque de Connect sigue oculto
(`renderConnectCard` hace `return` si `!enabled`).

## Sin fecha, sin plazo, sin Hacienda

El texto no dice cuándo estará disponible ni por qué — regla 24/tarjeta real solo con Stripe
Connect activo (reglas 18/23). «En tu cuenta» es literalmente cierto: Connect se activa por
comerciante, no de forma global.

## Condición de construcción (no solo texto)

Con el flag OFF, la fila deja de ser clicable como completable de verdad: nace como
`<button disabled>`, sin la flecha «Completar →» y sin el listener de navegación — no solo cambia
el texto. Verificado en `scripts/guard-completar-lleva-al-campo.mjs` (comprobación ⑤), con control
positivo (flag ON: la fila se sigue ofreciendo tal cual antes).
