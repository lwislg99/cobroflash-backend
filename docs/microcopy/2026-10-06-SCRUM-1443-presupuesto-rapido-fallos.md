# Presupuesto rápido: qué se lee cuando algo falla

**Aprobado por el orquestador por delegación del fundador** el 6-oct-2026 — SCRUM-1443 comentario 18307.

**Aprobado por el orquestador por delegación del fundador** el 6-oct-2026 — SCRUM-1443 comentario 18313.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. El comentario 18307 sustituye al
18284 de ese mismo día, que no se podía construir. El 18313 añade el tercer texto y corrige el aviso de «sin teléfono»,
que venía de SCRUM-1198 (comentario 18206, 2-oct-2026).

`{quote}` es la palabra del país en minúscula: «presupuesto» en España y Argentina, «cotización» en México, Colombia,
Perú y Chile.

## Texto aprobado, literal

Falla al crear, y no se ha guardado nada (comentario 18307):

> No hemos podido crear tu {quote}. Vuelve a intentarlo.

El documento está guardado y del envío no se sabe nada (comentario 18307):

> Hemos guardado tu {quote}, pero no sabemos si el WhatsApp ha salido. Pregúntale a tu cliente antes de volver a enviarlo.

El documento está guardado y el teléfono del cliente no es válido (comentario 18313):

> Hemos guardado tu {quote}, pero el teléfono de este cliente no es válido, así que el WhatsApp no ha salido. Corrige el teléfono y vuelve a enviarlo.

El documento está guardado y el cliente no tiene teléfono (comentario 18313):

> No hemos podido enviar el WhatsApp porque este cliente no tiene teléfono. Hemos guardado tu {quote}.

## Dónde se pinta

`public/dashboard/js/homeView.js`, el presupuesto rápido de Inicio.

- Los dos primeros, en la alerta del modal, que se queda abierto.
- Los dos últimos, en un aviso fuera: el modal se cierra y se abre el presupuesto guardado.

Si el servidor manda una frase para la persona, se lee la del servidor (`mensajeParaPersona`); estos textos son lo que
se lee cuando no la manda.

## La regla que sale de aquí

En esta pantalla ningún pronombre apunta al documento. La palabra cambia de género según el país, así que lo que haya
que nombrar se nombra («el WhatsApp», «el teléfono») y del documento se habla en voz activa («hemos guardado tu…»).

## Qué decía antes

En los dos primeros casos se leía el error tal cual: «API 500: internal_error», o «Failed to fetch». En el tercero,
«API 400: invalid_phone_format». El de «sin teléfono» decía «No hemos podido enviarlo porque este cliente no tiene
teléfono. El presupuesto se ha guardado.».
