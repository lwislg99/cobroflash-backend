# SCRUM-1124 · tarjeta de WhatsApp: muestra insuficiente para la tasa de entrega

**Aprobado por el orquestador por delegación del fundador** el 2026-09-25 — SCRUM-1124 comentario 17002.

## El literal, tal cual se pinta

`public/dashboard/js/reportsView.js`, tarjeta de métricas de WhatsApp:

> Aún no hay suficientes envíos para calcular esto: ${sample} de ${minimo} en los últimos 7 días.

Se pinta cuando la alerta de tasa de entrega NO está activa y la muestra (`sample`) no llega al
mínimo (`minimo`) que exige `whatsappLog.service.ts`. `${sample}` y `${minimo}` son los números
reales del DTO, no texto.

## Qué cambió

🔄 CAMBIADO respecto a la propuesta («Muestra insuficiente para calcular la tasa de entrega:
`${sample}` de `${minimo}` envíos necesarios en los últimos 7 días.»): el orquestador firmó esta
versión porque «muestra insuficiente» es jerga.

Antes salía con `[PENDIENTE microcopy oficial] · ${sample}/${minimo}` y el atributo
`data-microcopy="PENDIENTE_FUNDADOR"`. Los dos se retiraron en el mismo commit que se aplicó el
texto.
