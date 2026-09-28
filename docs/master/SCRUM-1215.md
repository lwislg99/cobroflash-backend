# SCRUM-1215 · lote 1 (parte) — `yaFirmado` retirada: no la leía nadie

**Medido contra:** `origin/main` = `d2c8903c5e75c9defc732bf8f7a7eebf20e79561` · 2026-09-28T15:10:58Z
**Medido en:** sesión `s4` · rama `scrum-1215-retirar-yafirmado`

La revisión hoja a hoja del lote 1 (28 textos de `parteDetailView.js`) está en Jira, SCRUM-1215
comentarios 17360 y 17361: 24 pasan · 2 no pasan (`pistaFirma`, `sinBloque`) · 1 muerta
(`yaFirmado`) · 1 dudosa (`sinLineas`). Este incremento hace **solo** la retirada, decidida por el
orquestador (`cobroflash-backend-57`) el 28-sep.

## Qué se ha retirado y por qué

`TEXTOS.yaFirmado` («Firmado. El contenido ya no se puede cambiar.») tenía **cero consumidores**: ni
`TEXTOS.yaFirmado` ni un índice dinámico `TEXTOS[...]` en todo `public/`. El censo de SCRUM-1157 lo
daba como posible dinámico; medido a mano, no se pinta nunca.

- La clave sale del objeto, y en su sitio queda un comentario con el motivo.
- En `scripts/_censo-convenio-microcopy-declarados.json` pasa de `acusadas` a `retiradas`, con su
  motivo. **No se firmó: se borró**, y así queda escrito.

## Verificación

- Censo 1157: **233 hojas · APROBADO 150 · PENDIENTE 7 · SIN_COMENTARIO 76**, trinquete
  **0 nuevas · 0 que sobran**.
- `scrum1157`, `scrum720`, `scrum1175b`, `scrum652c`, `scrum653`: **47 tests · 47 pass · 0 fail ·
  0 skip**, tras el build.

## Lo que NO entra aquí

- `sinLineas`: medido que **sí se pinta** en un parte firmado (firmar exige una línea en total, no una
  por bloque). Ocultarla deja el bloque con título y cabecera y sin filas: está parado y la decisión es
  del orquestador.
- `sinBloque` → ticket de S2 (se pierden líneas al confirmar). `pistaFirma` → SCRUM-1229.
