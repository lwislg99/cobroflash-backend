# El parte del operario, en tono cercano (tres rótulos)

**Aprobado por el fundador** el 12-nov-2026, en **SCRUM-1722** (comentario 21708).
Literal del fundador: «firmo lo que dices», respuesta numerada (punto 2) al mensaje del orquestador
que llevaba los tres opcionales del tono cercano propuestos por S4 en su entrega de SCRUM-1722.
Localizador del orquestador: su transcripción del 12-nov (sesión ed676fd1-feb4-4658-bda2-01f4bf9fb3fc).
**Aplicado en el mismo acto** (regla 30), en el tramo SCRUM-1722b.

## Textos aprobados, literales

| | antes | ahora |
|---|---|---|
| (a) | Firmar aquí mismo | Firma aquí, cliente |
| (b) | Firma del técnico | Firma aquí, técnico |
| (c) | Dicta lo que has hecho | Cuéntalo con tu voz |

## Dónde se pinta — cada uno en su mismo sitio, y en ningún otro

`public/dashboard/js/parteDetailView.js`:

- (a) clave `TEXTOS.firmar` — el botón del recuadro de firma del **cliente** (`data-parte-firmar`).
- (b) clave **nueva** `TEXTOS.firmarAquiTecnico` — el botón del recuadro de firma del **técnico**
  (`data-parte-firmar-tecnico`). `TEXTOS.firmarTecnico` («Firma del técnico», SCRUM-653) **se queda**:
  es también el título del pad de firma del técnico, y ese sitio no está en la firma.
- (c) clave `TEXTOS.dictado` — el título del paso del dictado (el `<label>` del campo). La pista de
  debajo, «Usa el micrófono de tu teclado. Luego lo ordenamos.», no está en la firma y no cambia.

## Lo que NO cambia

- El albarán (`albaranDetailView.js`) sigue con su «Firmar aquí mismo» (`btnFirmarAqui`): la firma
  es del parte.
- Ningún otro rótulo del parte.
