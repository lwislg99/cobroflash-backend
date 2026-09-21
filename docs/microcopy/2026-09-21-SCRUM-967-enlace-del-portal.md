# SCRUM-967b · el enlace del portal del cliente, en el correo y tras firmar el parte

**Aprobado por el orquestador por delegación del fundador** el 2026-09-21 — SCRUM-967 comentario 16055.

## Los literales, tal cual se pintan

**L1** · correo del presupuesto, debajo del botón «Ver y firmar presupuesto»
(`src/modules/messaging/domain/email.service.ts`, `sendQuoteEmail`, ranura `bajoElBotonHtml`):

    Todos tus presupuestos y pagos con {negocio} están en tu portal de cliente.

«tu portal de cliente» es el enlace a `/cliente/:portalToken`.

**L3** · pantalla «¡Parte firmado!», debajo de «Recibirás tu copia por WhatsApp.»
(`src/modules/jobs/app/routes/albaranPublic.routes.ts`, JS de éxito de la firma remota):

    Ahí tienes tus presupuestos y pagos con {negocio}.

y el botón:

    Abrir mi portal de cliente

`{negocio}` = razón social o nombre del negocio. En LATAM, «presupuestos» sale de
`locale.quotePlural` en minúscula («cotizaciones»).

## Qué cambió respecto a la propuesta

- Fuera la palabra «facturas» de los dos textos: con la facturación española apagada, prometer al
  cliente «sus facturas» es un claim fiscal (regla 7).
- **L2 no se construye**: iba en la página «Ya aceptaste este presupuesto», un GET que contesta a
  cualquiera que tenga el enlace del presupuesto. Riesgo no aceptado.

## Lo que queda sin firmar en estas pantallas

Nada nuevo. El enlace por WhatsApp (la otra mitad de SCRUM-967) espera: es texto de plantilla de Meta.
