# La pista del pad cuando firma el técnico

Aprobado por el orquestador por delegación del fundador · SCRUM-1215 comentario 18205

Firmado el 2-oct-2026. La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

> Firma con el dedo dentro del recuadro.

## Dónde se pinta

- `public/dashboard/js/parteDetailView.js`, `TEXTOS.pistaFirmaTecnico`: bajo el título del pad de firma, cuando quien
  firma el parte es el técnico.
- `public/dashboard/js/signaturePad.js`: es también la pista del pad cuando quien lo abre no pasa ninguna.

## Lo que no cambia

Cuando firma el cliente —en el parte y en el albarán— la pista sigue siendo «Pide al cliente que firme con el dedo
dentro del recuadro.» (`docs/microcopy/2026-09-04-SCRUM-720-rotulos-del-parte.md`). El albarán la pasa él: antes la
tomaba del valor por defecto del pad.

## Por qué

La pista del cliente es una instrucción para el profesional («pide al cliente…»). Dicha al técnico que firma su propio
parte, es falsa. SCRUM-1229 se la quitó; desde entonces firmaba sin pista.
