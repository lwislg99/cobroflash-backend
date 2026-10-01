# Ficha del cliente — fusionar: lo que pasa incluye las direcciones de obra · SCRUM-1126

**Aprobado por el fundador** el 30-sep-2026, en **SCRUM-1126** (comentario 17647: «1-Sí lo firmo»).

Leído por J2 en Jira, no transcrito. Sustituye a la ranura `todoPasa` firmada en el comentario
17575. Las demás ranuras de esa firma no cambian.

## Texto aprobado, literal

`{fusionado}` es el nombre del cliente que desaparece y `{principal}` el del que se queda: datos, no texto.

> Todo lo de {fusionado} pasa a {principal}: presupuestos, solicitudes de presupuesto, trabajos, direcciones de obra, notas, cobros, partes de trabajo, mensajes de WhatsApp, correos y mantenimientos.

## Dónde se pinta

`FUSION_CLIENTE.todoPasa` en `public/dashboard/js/customerDetailView.js`, en la previsualización de
la fusión (ficha del cliente, sólo admin).

## Qué cambió y por qué

Se añade «direcciones de obra». SCRUM-1291 (PR #2008) hizo que la fusión moviera también
`customer_sites`. Hasta entonces no se movían, y por su clave ajena RESTRICT la fusión daba 500. La
frase firmada quedó incompleta por culpa de ese arreglo, no desde antes. En una acción irreversible,
una lista incompleta de lo que se mueve se lee como «eso es todo».

⚠️ **La posición la eligió el orquestador, no el fundador.** Se le preguntó si firmaba añadirlo y
se le ofreció decir dónde, pero no lo dijo. Va después de «trabajos», para seguir el orden del flujo.
Si prefiere otro sitio, cambia una palabra de posición y se vuelve a firmar.

## Queda sin firmar

Nada en esta ranura.
