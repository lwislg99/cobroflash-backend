# Paquete de evidencias — aviso: el libro del ZIP lleva sólo facturas, y su 303 no · SCRUM-1252

**Aprobado por el fundador** el 1-oct-2026, en **SCRUM-1252** (comentario 17726: «1-Firmo la linea»).

La firma no me llegó a mí: la propuesta la redactó el orquestador del equipo de Javier, que transcribió
la respuesta del fundador en ese comentario. J1c leyó el literal en Jira el 2-oct-2026 y lo copió de
allí, no de un mensaje.

## Texto aprobado, literal

Es UN texto de tres frases, que se pinta seguido. Pasa de 160 caracteres (mide 217), así que va entero
en una sola línea de cita, como pide el README para un texto firmado largo (SCRUM-1329).

> El libro registro incluye sólo facturas. Si emitiste justificantes de cobro, no aparecen aquí — pero su IVA sí está en el modelo 303 de este mismo paquete. Por eso los totales de los dos documentos pueden no coincidir.

## Dónde se pinta

Constante `AVISO_LIBRO_SOLO_FACTURAS` en `src/modules/fiscal/evidencias/paquete.ts`. Es una entrada de
`avisos`, que viaja dentro del ZIP en `manifiesto.json` (`GET /admin/evidencias.zip`).

Sale sólo cuando el lector del libro dejó fuera algún justificante del periodo (`justificantesFuera`
mayor que cero, el recuento de SCRUM-1232). Sin justificantes en el periodo, el libro y el 303 del
paquete suman lo mismo por este lado y el aviso no aparece.

Hoy el ZIP no tiene pantalla que lo ofrezca (SCRUM-1251): se llega a él por su ruta.

## Qué cambió y por qué

Texto nuevo. Antes de SCRUM-1252 el libro del paquete se leía sin filtro y llevaba los justificantes
como si fueran facturas. Al filtrarlo, el justificante sale de `libro-registro.csv` y de `indice.csv`,
pero su IVA sigue en `modelo-303.csv`, que declara lo devengado: los dos documentos del mismo ZIP
dejan de sumar lo mismo. El aviso dice por qué, y por eso el filtro y el texto entraron en el mismo
cambio.

El comentario de la firma dice que el texto son dos frases. Son tres. El texto es el del comentario,
letra a letra; lo que estaba mal contado era el número de frases.

## Queda sin firmar

Nada en este aviso. Los demás avisos del paquete son anteriores y no se han tocado.
