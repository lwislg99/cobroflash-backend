# El parte: firma guardada en este móvil, y la pregunta antes de firmar encima

Aprobado por el orquestador por delegación del fundador · SCRUM-1426 comentario 18232

Firmado el 2-oct-2026. La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Textos aprobados, literales

**La caja**, la misma del albarán y sin tocar:

> Solo en este móvil
>
> La firma está guardada solo en este móvil. Si lo pierdes, se pierde.

**La pregunta antes de reemplazar**, dos variantes:

> Ya hay una firma del cliente de este parte guardada en este móvil. Si firmas otra vez, la nueva sustituye a la anterior.

> Ya hay una firma del técnico de este parte guardada en este móvil. Si firmas otra vez, la nueva sustituye a la anterior.

## Dónde se pintan

`public/dashboard/js/parteDetailView.js`:

- la caja, **dentro de la caja de la firma a la que pertenece** (cliente o técnico). El literal no dice de quién es la
  firma; lo dice el sitio. Pintada fuera de esa caja dejaría de estar firmada;
- la pregunta, al pulsar el botón de firmar de un recuadro cuya firma ya está guardada en este móvil
  (`TEXTOS.yaHayFirmaGuardadaCliente` y `TEXTOS.yaHayFirmaGuardadaTecnico`).

## Por qué dos preguntas y no una

La cola del móvil guarda la firma del cliente y la del técnico por separado. Puede haber una, la otra o las dos, y hay
que decir cuál se va a sustituir.

## Decidido con la firma

«Falta la firma del cliente.» y «Falta la firma del técnico.» no se pintan mientras esa firma esté guardada en el
móvil: falta en el servidor, no en la mano de quien la acaba de recoger.
