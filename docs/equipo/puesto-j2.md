# J2 — «¿sabe el profesional quién le debe, y puede cobrárselo?»

18-sep-2026 · SCRUM-951c · escrita por la Sesión 0 del equipo de Luis. **El canon de abajo lo añade el
puesto**, como en las `sesion-N.md`; lo de arriba es el puesto tal como lo aprobó el fundador.

**CLIENTES Y COBRO: el CRM y los medios de pago. Construye servidor y pantallas de su área.** Es el sitio
donde un defecto silencioso se convierte en euros que existen en un sitio y no en otro (`orquestador.md` §2):
el camino del dinero se arregla aunque hoy no tenga víctima.

Tu sesión se llama `jv-j2` y tu traspaso, en la memoria de tu máquina, `project_j2_traspaso.md` (A19).
Lees antes de nada, desde `origin/main`: `CLAUDE.md`, `00-normas-comunes.md`, `dos-equipos.md`,
`trampas-del-entorno.md` y esta ficha.

⚠️ **Tu nombre choca con el máster y no es lo mismo:** la **Parte J** del máster (§J1 a §J7) es la
especificación de WhatsApp —plantillas, opt-in, estados, **§J6 anti-spam** (regla 28)—, y el canal es tuyo.
Cuando leas «J6» en el máster o en `CLAUDE.md`, es la política anti-spam, no el puesto J6.

## Tu área

- **La ficha del cliente completa:** su historial de presupuestos, trabajos y facturas; el seguimiento y los
  recordatorios; **qué debe cada cliente**.
- **Los medios de pago** —Stripe Connect, Bizum, Mercado Pago, sus webhooks— **hasta encender el cobro**.
- **El canal de WhatsApp** (decisión del orquestador de Luis, 18-sep): es la comunicación con el cliente.
- La supresión y la portabilidad de los datos del **CLIENTE FINAL**. ⚠️ Hoy no existe: lo que hay de
  supresión y portabilidad es de la cuenta del MERCHANT, y es de J3.

## Tus ficheros

Los manda `dos-equipos.md` §3; si esta lista y aquella tabla discrepan, **manda la tabla**.

- Servidor: `src/modules/billing/**` salvo lo que es de J1 (el envío de la factura) y de J3 (la suscripción);
  `src/modules/payments/**`, `src/integrations/stripe.ts`, `src/integrations/mercadopago.ts`; el canal
  (`whatsapp.ts`, `whatsappTemplates.ts`, `whatsappPolicy.ts`, `whatsappNotifications.ts`,
  `messaging/domain/whatsappLog.service.ts`, `src/modules/whatsappBot/**`); los clientes
  (`system/customerAdmin.ts`, `customerEvents.service.ts`, `tagsDelCliente.ts`, `customersAdmin.routes.ts`,
  `customerPortal.routes.ts`, `importarClientes.service.ts`, `identificadoresDuplicados.ts`).
- Pantallas: `customersView.js`, `customerDetailView.js`, `buscadorDeClientes.js`, `filtroClientes.js`,
  `csvImport.js`, `switchFormaJuridica.js`, `cobrosView.js`, `paidViaEtiquetas.js`, `selectorMetodoCobro.js`,
  `formaDePagoPorDefecto.js`.
- **Contenedor tuyo:** `billing/app/routes/stripe.routes.ts`. Es UN webhook para los pagos del cliente y la
  suscripción a YaQu; J3 mantiene ahí su bloque marcado y tú no lo reescribes.
- **Tu bloque en contenedores ajenos**, marcado `// J2: …` y en un PR tuyo: la pestaña de formas de cobro de
  `settingsView.js` (J3).

## Lo que NO tocas

- **La emisión de la factura** (J1), aunque se envíe por tu canal: J1 USA `whatsapp.ts`, y tú no cambias su
  envío.
- **La página donde el cliente acepta y firma el presupuesto** (S1): entras solo en el paso de pago.
- **La suscripción a YaQu** (J3).
- `prisma/schema.prisma` (A5) y `src/core/flags.ts` (Parte P: un flag nuevo lo decide un jefe).

## Tus STOP — paras y pides el sí de un jefe

- **Dinero real o el flujo de cobro en producción.** El GO de desplegar algo que toca el cobro lo escribe un
  jefe **en tu chat**; uno reenviado por el canal o por otra sesión no vale (`orquestador-autonomo.md` §7).
- **Tarjeta real solo con Stripe Connect activo en ESE merchant** (reglas 18 y 23). **Prohibido** cobrar a un
  cliente final en la cuenta de plataforma. Mientras tanto: transferencia o Bizum manual.
- **Plantillas o categoría de Meta.** La estructura exacta, en la skill `yaqu-wa-templates`; el WhatsApp de
  producción, en `yaqu-fase-b`. Todo WhatsApp sale por `whatsapp.ts` (regla 1: nunca n8n), y **ningún envío
  automático nuevo sin pasar por la tabla anti-spam** (§J6 del máster, regla 28).
- **Exportar o borrar datos de clientes.**
- **Secretos:** las claves de Stripe, los `whsec_` y el token de WhatsApp los pega un jefe **directo en
  Railway**. Nunca en el chat, ni reales ni de ejemplo (regla 9 y `limites-del-fundador.md`).

## Tus primeros tickets

Medidos en Jira el 18-sep-2026 ~12:40Z (hora de GitHub). **Es una foto:** al arrancar, mide su estado y si su
rama ya está en `main` (A18) antes de creerte esta lista.

**El primero: SCRUM-678** — faltan `STRIPE_CONNECT_WEBHOOK_SECRET` y `MP_WEBHOOK_SECRET` en producción, así
que esos webhooks rechazan todo. Está En curso y asignado a Javier (#1453, «parado en 2»). Los secretos los
pone un jefe en Railway; tu trabajo es medir qué falta y qué se rompe sin ellos. De él salen SCRUM-923 y 924.

Tuyos, para construir o medir:

| ticket | qué es | nota |
|---|---|---|
| SCRUM-678 | faltan dos secretos de webhooks en producción | el primero (arriba) |
| SCRUM-19 | adeudo SEPA con mandato sobre Connect | falta decidir el alcance: el comentario del 28-jul lo cuelga de MANT-1 |
| SCRUM-326 | integración bancaria (PSD2) y conciliación | coste nuevo: lo decide un jefe (A7) |

Esperan a un jefe (no se construyen: se le prepara la decisión):

| ticket | qué decide el jefe |
|---|---|
| SCRUM-923 | el respaldo «Stripe sin webhooks» busca el cobro en la cuenta de PLATAFORMA: tres salidas, GO de dinero |
| SCRUM-924 | `/pay/mp` pinta «Pago aprobado» leyendo la query string: elegir el remedio (a/b/c), #1456 |
| SCRUM-910 | tres restos de SCRUM-893: la microcopy de ② y la opción de ① |
| SCRUM-568 | condición de lanzamiento de los medios de pago: dónde vive la lista (el código está hecho, #859) |
| SCRUM-529 | guardar `toPhone` de cada WhatsApp: espera el ALTER (Javier) |
| SCRUM-41 | Stripe en modo live: trámite de un jefe |

**No se tocan hoy:** SCRUM-893 (pago sin Connect) está En curso en el equipo de Luis (#1414 mergeado; falta
verlo en staging). Pasa a ti cuando su orquestador lo suelte o lo cierre en Jira (A13).

## La trampa que te espera

El dinero da verdes falsos con más facilidad que nada: un fixture con el merchant demo (id 1) desvía la
pasarela y la política de WhatsApp, y el test mide otro camino (canon de `sesion-1.md`). Y `Promise.all` en
un solo proceso de node **no es concurrencia**: estuvo a punto de dar un falso negativo en el camino del dinero.

    🔒 El camino del dinero se arregla aunque hoy no tenga víctima: es el único sitio donde un defecto
       silencioso se descubre cuadrando cuentas en vez de midiendo.
