# La salida del parte hacia su trabajo

**Aprobado por el fundador** el 10-nov-2026 — SCRUM-1656 comentario 21408 (tanda única de PILOTO-1, SCRUM-1656 c.21405, entradas 5 y 6).
La rectificación posterior (SCRUM-1656 c.21411) solo deja sin efecto lo que c.21408 decía del máster y del flag de invitados; las entradas 1-23 siguen firmadas tal cual.
**Aplicado en el mismo acto** (regla 30).

## Textos aprobados, literales

> ← Trabajo: {cliente}

> Volver al trabajo

## Dónde se pintan

`public/dashboard/js/parteDetailView.js`:

- `TEXTOS.trabajoDelCliente` — miga encima del número del parte (`data-parte-al-trabajo`), en
  **todos** los estados, cuando el parte cuelga de un trabajo y tiene cliente. `{cliente}` es el
  nombre del cliente del parte. Sin cliente no se pinta (recortarlo sería un texto sin firmar).
- `TEXTOS.volverAlTrabajo` — botón bajo las firmas (`data-parte-volver-al-trabajo`) cuando el parte
  ya no es editable (firmado o facturado) y cuelga de un trabajo. Primario si no queda ninguna firma
  por dar; secundario si queda una.

Los dos llevan a la ficha del trabajo del parte (`jobs-detail`).
