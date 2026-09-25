# SCRUM-1038 · el botón «leer el ticket» y sus tres avisos

**Aprobado por el orquestador por delegación del fundador** el 25-sep-2026 — SCRUM-1038 comentario 16942.

**Aplicado en el mismo acto** (regla 30). La delegación es la permanente de
`docs/equipo/limites-del-fundador.md`, sección «Delegación permanente», línea de microcopy. Esta ficha
**no** lleva la firma del fundador.

## Texto aprobado, literal

> Leer el ticket

> Leyendo…

> Has llegado al máximo de 5 lecturas de ticket hoy. Escribe los datos a mano.

> No hemos podido leer este ticket. Escribe los datos a mano.

## Dónde se pintan

`public/dashboard/js/expensesView.js` — constantes `TEXTO_LEER_TICKET`, `TEXTO_LEYENDO_TICKET`,
`AVISO_TOPE_LECTURAS_TICKET` y `AVISO_LECTURA_TICKET_FALLIDA`.

- **«Leer el ticket»** — etiqueta del botón `#exp-leer-ticket`, en el alta/edición de gasto, junto al
  selector de foto. Empieza escondido; aparece al elegir una foto.
- **«Leyendo…»** — la misma etiqueta mientras la lectura está en curso (el botón queda deshabilitado).
- **El aviso del tope** — en la caja `#exp-error` (la que ya existía) cuando el servidor contesta
  `lecturas_agotadas` (5 lecturas por merchant y día natural de Madrid, `LECTURAS_TICKET_POR_DIA`).
- **El aviso de fallo/lectura vacía** — misma caja, para cualquier otro código de error del servidor
  (`ai_not_configured`, `ai_bad_key`, `ai_cuota_*`, `ai_could_not_parse`, `ai_provider_error`,
  `internal_error`, fallo de red) y para una lectura que llega `ok:true` pero con la propuesta
  ENTERAMENTE vacía (foto borrosa, sin texto, o que no es un ticket). En los dos casos el formulario
  queda tal cual estaba: nada se borra ni se sobreescribe.

## Qué cambió

Nada: es texto nuevo. El endpoint (`POST /admin/expenses/leer-ticket`, SCRUM-912) ya existía y
ninguna pantalla lo llamaba.

## Lo que queda sin firmar en esta pantalla

El aviso de foto que no se abre (`AVISO_FOTO_NO_SE_ABRE`, ya firmado en SCRUM-947) se reutiliza tal
cual cuando la reducción de la foto falla antes de llegar al servidor; no es texto nuevo de este
ticket. Nada más de esta pantalla cambia en SCRUM-1038.
