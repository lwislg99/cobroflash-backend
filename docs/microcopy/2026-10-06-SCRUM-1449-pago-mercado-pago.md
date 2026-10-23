# Pago con Mercado Pago — los avisos que lee el cliente final · SCRUM-1449

**Aprobado por el fundador** el 6-oct-2026, en **SCRUM-1449** (comentario 18285, cuenta de Luis Lara).

Leído por J2 (sesión `jv-j2x`) en Jira el 23-oct-2026, en ADF. Los nodos de texto del comentario
están copiados en `docs/master/evidencias/SCRUM-1449/firma-c18285.json`, y el test
`tests/scrum1449b-la-pagina-de-mercado-pago.test.mjs` compara contra ellos lo que pinta la ruta.
El cotejo del fichero contra los bytes del código anterior: `procedencia.mjs` y su salida, al lado.

## Textos aprobados, literal

> Ahora mismo no se puede pagar con Mercado Pago. Contacta con el profesional.

> Error al conectar con Mercado Pago. Inténtalo de nuevo.

> Tu pago está siendo procesado.

El segundo ya estaba en el código y el comentario lo deja igual («se queda igual»); el tercero es
un recorte de «Tu pago está siendo procesado. Te notificaremos pronto.». El cierre del primero es
el de «Cobro vencido» de la misma página.

## Dónde se pinta

- `src/modules/billing/app/routes/payMp.routes.ts`, `GET /pay/mp/:token`: el primero con el 503
  (sin token de Mercado Pago en la plataforma) y el segundo con el 502 (Mercado Pago no contesta),
  los dos en página (`avisoMpHtml`) y no en texto plano. El texto va como titular y como `<title>`.
- El mismo fichero, `GET /pay/mp/:token/result` con el cobro pendiente: el tercero.

Ningún enlace del producto lleva hoy a `/pay/mp/<token>` (medido en SCRUM-1449 por J1, 7-oct).
