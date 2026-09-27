# SCRUM-1160 · En modo justificante no se ofrece facturar: «Cobrar ahora» (presupuesto) y «Cobrar el resto» (Trabajo)

**Medido contra:** `origin/main` = `37bda5dbc6991cc33a54ee7248020be30d2f977f` · 2026-09-27T15:39:53Z
**Rama:** `scrum-1160-cobrar-ahora-modo-recibo`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`).

## El defecto (medido por S0 sobre el JS servido por yaqu.app)

Un merchant ES real (`INVOICING_ES_ENABLED` en OFF, regla 24) pulsaba «💰 Cobrar ahora» en un
presupuesto aceptado y leía, en rojo y solo, `[PENDIENTE microcopy oficial]`. La cadena: el botón
delegaba en «Generar factura» sin mirar el modo → 409 `facturacion_no_disponible` del servidor
(correcto) → el front pintaba `data.message` tal cual. El segundo corte, que corrigió S0 después: la
PRIMARIA de un Trabajo terminado con saldo, «💰 Cobrar el resto», acababa en el mismo 409 de
`collect-rest` y pintaba «No se pudo completar la acción: [PENDIENTE …]».

## Qué se construyó (solo front; NO se toca `quotesAdmin.routes.ts` ni `jobs.routes.ts`)

| Sitio | Cambio |
|---|---|
| `quotesDetailView.js` · «Cobrar ahora» | No se pinta si `window.facturaFiscalDisponible()` no es verdadero. Misma comprobación que `jobDetailView.js:1540`; falla cerrado con el modo desconocido (SCRUM-905). |
| `quotesDetailView.js` · «Generar factura» y la nota «Estas condiciones no generan tramos automáticos» | No se pintan en ese modo (la nota acompaña al botón). |
| `quotesDetailView.js` · bloque «Siguiente paso» | Si se queda sin ninguna acción, no se pinta: un rótulo sin nada debajo. Con Trabajo de origen sigue saliendo con «Nuevo albarán». |
| `jobNextAction.js` · nivel 1 «Cobrar el resto» | Se SALTA en ese modo y la escalera sigue, igual que para el técnico (SCRUM-89). Vale para la lista y el detalle (fuente única). |
| `albaranAccion.js` · cinturón | `errorDeFacturarSinFirmar(data)` / `textoDeErrorDeFacturar(data, porDefecto)`: el 409 `facturacion_no_disponible`, o cualquier `message` con marcador, pinta el texto firmado. Los 409 con texto firmado propio (`COPY_ADMIN_SIN_LINEAS`, `motivoSinTramo`…) salen igual. |
| `quotesDetailView.js:970` y `jobDetailView.js` (`falloDelCta`) | Usan el cinturón en vez del `message` en crudo. |

**Texto nuevo, FIRMADO** por el orquestador (cobroflash-backend-06) por delegación del fundador
(regla 39), 26-sep-2026: «Desde tu cuenta todavía no se pueden generar facturas.» Seco a propósito:
con el flag en OFF la regla 24 prohíbe también el cobro por YaQu, así que no lleva alternativa.

El marcador se reconoce con `/\[PENDIENTE/` y no con un literal de texto: un literal con el marcador
es lo que `scrum402` cuenta como pintable, y éste sólo sirve para reconocerlo.

## Tests — rojo antes, verde después

`tests/scrum1160-cobrar-ahora-modo-recibo.test.mjs` (16 tests), ficha y escalera montadas con el
panel entero (`albaranAccion.js` de verdad, no un doble). Contra los cuatro ficheros de producto de
`origin/main`: **11 fallan y 5 pasan (16)** — medido de nuevo el 27-sep-2026 con los 16; la cifra
anterior («9 / 5») se midió con 14 tests y era falsa para este fichero. Pasan los 5 controles
positivos `fiscal`/`demo`. Fallan: los 6 de `receipt`/`null`/`undefined` (ficha y escalera), el de
MANUAL en `receipt`, los 2 del cinturón y además dos cuyo nombre dice «control»: el 3 (en `receipt`
con Trabajo de origen) cae porque también afirma que no hay «Cobrar ahora» y en main lo hay
(`1 !== 0`), y el 16 (control negativo del cinturón) cae con `f is not a function`: en main el
cinturón no existe, así que ése es rojo por AUSENCIA, no por defecto. Con el cambio: 16/16 en verde.

**Tests de otros tickets tocados, y por qué NO es «tocar tests para que pasen»:** el producto ahora
depende de un dato —el modo de emisión— que su montaje no le daba.
- `scrum984`: su montaje declara `appModoEmision = 'fiscal'`. **Ninguna aserción tocada.**
- `scrum316` y `scrum320`: su contexto vm declara `facturaFiscalDisponible: () => true` (la escalera
  de quien emite). **Ninguna aserción tocada.** El modo justificante lo mide SCRUM-1160.
- `scrum601` (trinquete de copy): `flag` 13 → 16 y `aPelo` 157 → 154, NOMBRADOS en el fichero. Los
  tres literales no cambian de texto: pasan de cubo porque `jobNextAction` es ahora portador del flag.
  **Aislado:** con `jobNextAction.js` de main y el resto de la rama, el diff del censo sale vacío.
- `scrum380`: no se tocó el test; se acortó MI código (`falloDelCta` en dos líneas) para que su
  ventana vuelva a ver `cta.className`.

## Captura a 390 px (banco serializado, Chrome headless)

- `receipt`: botones del resumen «📄 PDF · ⎘ Duplicar · ← Volver»; ni «Cobrar ahora», ni «Generar
  factura», ni «Siguiente paso» vacío, ni marcador.
- `fiscal`: igual que antes, con «💰 Cobrar ahora» y «Generar factura (100%)».

**No verificable sin credenciales:** el recorrido en yaqu.app con un merchant ES real.

## Visto y NO tocado (fuera de este ticket)

- En modo justificante, la línea de tiempo del presupuesto sigue enseñando «Facturada · Cobrada» y la
  sección «Facturas: No hay facturas generadas.».
- `jobDetailView.js:3150` (`facturar-parcial`): `if (d && d.message) setStatus('error', d.message)`,
  otro `message` del servidor pintado tal cual.
