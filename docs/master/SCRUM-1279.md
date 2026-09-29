# SCRUM-1279 · La firma ve lo que firma: la landing pinta las cláusulas, la cabecera y las Observaciones

**Medido contra:** `origin/main` = `e75b94ca8755bd5d27981940c5ff4c01b2df8695` · 2026-09-29T16:41:09Z

Carril S1 (`quoteDecisionLanding.routes.ts`, `docs/equipo/dos-equipos.md:120`) · rama
`scrum-1279-landing-pinta-clausulas`. Sale de la auditoría del viaje «el cliente acepta» (hallazgo H3).

## El defecto

`GET /pay/quote/:token` no pintaba las cláusulas de cierre, ni `docHeaderText`, ni `docFooterText`
(«Observaciones»), y el PDF archivado sí: el papel afirmaba que el cliente aceptó lo que no vio.

## Arreglo

`renderQuoteDetail` saca los tres de `paramsDePresupuestoParaPdf` —el MISMO constructor que alimenta
al PDF— y las cláusulas de `clausulasParaDocumento` (el MISMO filtro: quita las excluidas y las que no
tienen título y texto). `loadQuote` añade `clausulasPresupuesto` al `select` del merchant.

- Cabecera: tras la validez y antes de las líneas, **sin rótulo** (como el PDF, decisión 2-sep-2026).
- «Observaciones» (`TITULO_OBSERVACIONES`, importado del PDF, aprobado 2-sep-2026) y las cláusulas: tras
  las condiciones de pago, **antes** del bloque de firma. Cada cláusula con el título del profesional
  en mayúsculas (CSS), como `c.titulo.toUpperCase()` en el PDF.
- **Cero texto nuevo** (regla 39): no hay rótulo de sección —el PDF tampoco lo tiene— ni aviso de excluida.
- Cláusulas en una caja abierta con `max-height: 45vh` y scroll propio: se ven sin desplegar nada y no
  alejan la firma. Sin configuración no se abre nada.

## Test — `tests/scrum1279-la-firma-ve-las-clausulas.test.mjs`

Monta la landing por su ruta (`dist`) y genera el PDF de la MISMA fila con
`generateQuotePdf(paramsDePresupuestoParaPdf(fila))` (la cadena de `/pay/quote/:token/pdf`), leído con
`_texto-del-pdf.mjs`. Cada cláusula CONFIGURADA se busca en los dos: tiene que estar en los dos o en
ninguno, con el mismo título, texto y orden. Casos: 4 pintables + 1 vacía; una excluida (SCRUM-1180);
**control** sin cláusulas ni textos (ningún `data-doc`); escape del texto del profesional.

- Rojo contra `e75b94ca`: 3/4 caen (el control pasa, como debe).
- Mutante «sin excluidas» (`clausulasParaDocumento(…, null)`): lo caza el caso 3.

## Móvil — medido en navegador (chrome-headless-shell, 360 px, cinco cláusulas de ~600 caracteres)

Banco: `docs/master/evidencias/scrum1279/banco-360.mjs` (landing REAL de `dist` + sonda).
Captura: `docs/master/evidencias/scrum1279/landing-360-cinco-clausulas.png`.

| ventana | scrollWidth / clientWidth | caja | contenido de la caja | botón «Firmar y aceptar» |
|---|---|---|---|---|
| 360×740 | 345 / 345 (sin scroll horizontal) | 333 px | 1364 px | y=1290 de 1597 |
| 360×1900 | 345 / 345 | 855 px | 1364 px | y=1812 de 2119 |

Sin la caja, las cláusulas empujarían el botón ~1030 px más abajo.

## Fuera de alcance

SCRUM-799 (el PDF se regenera con los datos de hoy), del fundador. La página de rechazo usa el mismo
`renderQuoteDetail` y también enseña ahora las cláusulas: coherente, sin texto nuevo.

## Tanda completa (dos rojos míos, arreglados en el código)

- SCRUM-888d (huella byte a byte de la página SIN descuento): mis `${…}` en líneas propias añadían saltos
  aunque no hubiera nada que pintar. Pegados a la línea anterior: sin cabecera, Observaciones ni cláusulas
  la página es byte a byte la de antes. Huella intacta.
- SCRUM-553 (extractores con el `>` pegado): los del test nuevo leen con hueco para atributos.
- Queda el 1216b ajeno (crash del proceso en Windows, ya en manos del orquestador).
