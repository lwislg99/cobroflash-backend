# Ficha del cliente — el respaldo del error de la pestaña «Notas» · SCRUM-1132

**Aprobado por el fundador** el 23-oct-2026, en **SCRUM-1132** (comentario 20435: «Firmo»).

Lo transcribe en Jira el orquestador del equipo de Javier (`cobroflash-backend-62`), que hizo la
pregunta en su chat. Lo escribe aquí la sesión que aplica el texto (jv-j2at, J2): es quien lo aplicó
contando que se firmó, no la firma; la firma es el comentario.

## Texto aprobado, literal

> No se pudo guardar: inténtalo de nuevo

## Dónde se pinta

- `public/dashboard/js/customerDetailView.js`, `NOTAS_CLIENTE.TEXTOS.respaldo`: lo que dice la
  pestaña «Notas» cuando guardar una nota falla y el servidor no manda motivo en `message` (404, 500,
  sin red). Con motivo, sigue saliendo «No se pudo guardar:» + el motivo (firmado en c.19617, con
  su propia ficha en este directorio).

## Qué cambió y por qué

Hasta ahora, sin motivo, la pieza decía «No se pudo guardar:» a secas: una frase que acaba en dos
puntos y no dice qué hacer. Es el mismo literal que ya usa la ficha en el modal de edición.
