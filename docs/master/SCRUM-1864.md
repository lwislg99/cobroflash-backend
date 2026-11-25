# SCRUM-1864 · los dos `.input` de la ficha de FACTURA a 44 px de toque, por contenedor

**Medido contra:** `origin/main` = `2a6675c978794595696f87fb1a7ed3e52f904adb` · 2026-11-25T14:55:29Z (base de la rama y árbol medido; hora de la cabecera `Date:` de `gh api -i zen`)

A9: sin fallo que generalice — la técnica es la de 1843/1849 y el rojo se vio antes de la cura; el único tropiezo (el `className` supuesto de «← Volver a facturas», `btn btn-secondary btn-sm`, era `btn-secondary btn-sm`) lo corrigió el propio test antes de la primera corrida

**Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar la hoja). Sin tokens, clases, componentes ni textos nuevos: una regla de tamaño acotada a su contenedor. **Microcopy:** ninguna.

Jefe: orquestador J (`cobroflash-backend-2d`). Puesto: J1 (jv-j1kw). Regla: SCRUM-1845 c.22728.

## Qué son los dos campos (medido con el banco de vistas, no leído del censo)

| campo | quién lo pinta | tipo | en qué estado sale | dónde |
|---|---|---|---|---|
| fecha «¿Cuándo lo has cobrado?» | `pintarFechaDeCobro` (`invoicesView.js`), llamado en `invoiceDetailView.js` | `date`, id `fecha-cobro-factura` | sólo factura `pending` | `.detail-next > div > .form-group > .input` |
| Etiquetas | `montarEtiquetasDelDocumento` (`etiquetasDelDocumento.js`, de S2; no se toca) | `text` | todos | `.detail-page > .detail-section > .input` |

El censo de 1845 los vio con los datos de su contrato (factura 21); el test monta una factura `pending` propia, que es el estado que pinta los dos.

## Antes y después (árbitro `__areaDeToque`, toque en px)

| elemento | clase | qué es | ¿primaria? | 390 antes → después | 929 antes → después | 1280 antes → después |
|---|---|---|---|---|---|---|
| fecha de cobro | `.input` | campo | no aplica | 36 → **44** | 36 → **44** | 36 → **44** |
| Etiquetas | `.input` | campo | no aplica | 34,6 → **44,6** | 34,6 → **44,6** | 34,6 → **44,6** |
| «← Volver a facturas» | `.btn-secondary.btn-sm` | botón de cabecera | **no** | 31 → 31 | 31 → 31 | 31 → 31 |
| Etiquetas del PRESUPUESTO (control) | `.input` | campo de otra ficha | no aplica | 34,9 → 34,9 | 34,9 → 34,9 | 34,9 → 34,9 |

**EXENTO:** «← Volver a facturas» es `.btn-sm` y no es la acción primaria de la ficha (la primaria vive en «Siguiente paso»): `DESIGN.md:171` («Única excepción, y es deliberada: `btn-sm`») y SCRUM-1845 c.22728. Se mide y se queda.

Capturas: `docs/master/evidencias/SCRUM-1864/1864-ficha-factura-{antes,despues}-{390,1280}.png`.

## La cura

Bloque `/* J1: SCRUM-1864 … */` en `public/dashboard/css/styles.css`, justo debajo del de 1843. Dos reglas, sólo `min-height:44px`:
`.j1-prog ~ .detail-next > div > .form-group > .input` (0,4,0) y
`.detail-page:has(> .detail-section > .j1-prog) > .detail-section > .input` (0,5,0). `.input` global (0,1,0) no fija alto. El ancla `.j1-prog` sólo la escribe `invoiceDetailView.js` (lo comprueba el caso ② del test); la ficha del presupuesto, que comparte `.detail-page`, `.detail-next` y Etiquetas, no la pinta y no cambia (caso ①, control medido). Sin JS, sin texto nuevo.

Test: `tests/scrum1864-ficha-factura-inputs-44.test.mjs`. Rojo antes de la cura: `tests 2 · pass 0 · fail 2` (① «la fecha … mide 36 px de toque a 390 px»; ② sin bloque). Verde después: `tests 2 · pass 2 · fail 0`. Controles: los dos campos existen con `.input` y su tipo, la fuente cargó (5 caras), un campo sembrado de 34 px sale corto, el exento no cambia, el presupuesto no cambia.

`scripts/guard-objetivo-tactil.mjs`: NO cubre esta ficha (sus vistas: Customer360, Customers, JobDetail, Providers, Quotes, Settings). No se endurece ni se le añade cobertura.

## Lo que NO medí

- El selector «¿Cómo lo has cobrado?» (`pintarSelectorMetodo`, `select.form-control`, de J2): sólo sale con las opciones del arranque, y ni el censo ni este banco las sirven. No está medido; no cuenta como cero.
- yaqu.app: no verificado allí (llega con el despliegue tras el merge).
- Las capturas y la tabla antes/después salen de un guion de un solo uso fuera del árbol (`C:\Users\Public\tmp-jv-j1kw\capturas.mjs`); el instrumento que queda en git es el test, que mide lo mismo.
- No corrí la suite entera (el encargo lo prohíbe): sólo la dirigida que nombra la entrega.
