# Evidencias PRE-DEMO (A9.5) — 5-jul-2026

Barrido Playwright/CDP completo con viewport móvil REAL 390×844@2x
(`scripts/capture-demo.mjs`, commit del barrido: ver git log de esta carpeta).

- 01-14: BO completo (Home con Personalizar, cotización rápida + modal dictado,
  crear, listas, clientes, productos, cobros, informes con funnel por fuente,
  solicitudes, gastos, proveedores, equipo, configuración con fair-use W2).
- 15-18: flujo del CLIENTE (firma 326,70 € es-ES, selector de pago, recibo
  celebratorio con reseña, 404 con marca).
- a83-home-handoffs-390: tarjeta "🔔 Te esperan en WhatsApp" (A8.3, con sesión
  de handoff temporal creada y borrada para la captura).
- a93-settings-fairuse-390: contador fair-use 300/mes (A9.3, política W2).
- Bot: la suite A8.4 es la evidencia funcional (docs/evidencias/ext2/a84-suite.txt,
  11/11 en verde, 17 mensajes simulados, 0 llamadas a Meta).

Hallazgos del barrido final: 0 P0 · 0 P1 nuevos (los P1 de móvil se cazaron y
arreglaron en A6.6; A9.4 cerró contraste AA y targets de las páginas del cliente).
