# El albarán: la copia del cliente, justo después de firmar en el pad

**Aprobado por el orquestador por delegación del fundador** el 2026-10-06 — SCRUM-1460 comentario 18330.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. Ese mismo comentario
firma dónde salen los textos y descarta el envío automático desde el pad.

## Texto aprobado, literal

Cuando en la barra está «Enviar por WhatsApp»:

> El cliente todavía no tiene su copia. Envíasela por WhatsApp.

Cuando el cliente no puede recibir WhatsApp (el botón de enviar está oculto):

> No podemos enviarle la copia por WhatsApp a este cliente. Descarga el PDF para dársela.

## Dónde se pinta

`public/dashboard/js/albaranDetailView.js`: `TEXTO_COPIA_SIN_ENVIAR` y `TEXTO_COPIA_SIN_WHATSAPP`, por
`recordatorioDeLaCopia`.

Sólo en la ficha que queda al confirmar la firma en el pad («Firmar aquí mismo»), debajo de la caja «A salvo»
y encima de los botones. El primero es un `.alert info`; el segundo, un `.alert warning`. Los dos con
`role="status"` y dentro del mismo envoltorio que la caja, que es el que ya separa de la barra.

Se quita cuando el profesional pulsa «Enviar por WhatsApp» y el envío sale. Si el envío falla, se queda.

## Por qué sólo en ese momento

Es el único en que «todavía no tiene su copia» es cierto con seguridad: acaba de firmarse en el pad, y por
ese camino no sale ningún envío (SCRUM-47 lo hizo manual a propósito). La ficha no sabe si la copia se mandó:
recargada o abierta al día siguiente, la frase podría ser falsa.

## Por qué el segundo no dice «no tiene WhatsApp»

El dato que llega (`puedeRecibirWhatsApp: false`) cubre al cliente sin teléfono y al que se dio de baja. La
frase no afirma cuál.

## Lo que no cubre

- **La firma que sube desde la cola sin red** (minutos u horas después): la ficha pasa a firmada y no trae
  recordatorio. Incluye el caso en que sube con el pad abierto y la ficha se pone al día al cerrarlo.
- **La ficha recargada o reabierta.** Un recordatorio que aguante la recarga pide que el servidor diga si la
  copia salió.
- **Si el servidor no dice nada del canal del cliente**, el botón de enviar se ofrece y sale el primer texto.
  Si no se ofrece el botón y tampoco se sabe que falte el canal, no sale ninguno.
- **Firmar desde otra pantalla que no sea la ficha del albarán**, si existe ese camino.
- «A salvo — Guardado en YaQu. Ya no depende de este móvil.» no cambia.
