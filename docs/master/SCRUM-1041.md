# SCRUM-1041 · Quitar los textos «[PENDIENTE]» que se ven en el libro y en la exportación

**Medido contra:** `origin/main` = `03d12b69b69e29a63493c25a13adc3a787d3d14e` · 2026-09-22T07:28:33Z

## Alcance real, y por qué NO es el del enunciado

El ticket cita 4 sitios de `exportView.js`. El PASO 0 de esta rama (com. 16306 de SCRUM-1041)
midió que el defecto es más grande: la pantalla del Libro de registro (`libroRegistroView.js`)
también enseña el marcador, en 5 avisos (`descuadre`, `avisoIlegibles`, `avisoAjenas`,
`avisoSinNumero`, `trazaNoSellado`).

**Este ticket cierra solo el bloque A (los 4 de `exportView.js`).** El bloque B se revisó y se
dejó explícitamente SIN TOCAR: `docs/legal/PREGUNTAS_ASESOR.md` §21 registra que el fundador
separó esos 5 avisos, el 19-ago-2026, de los 16 que sí aprobó ese día, **porque afirman algo
sobre la integridad del libro registro — dictamen fiscal, no microcopy de producto** — y quedan
pendientes de que conteste el asesor, no de que los apruebe el orquestador. La delegación
permanente de microcopy (`docs/equipo/limites-del-fundador.md`) cubre «microcopy no legal»; este
bloque, por escrito y desde antes de este ticket, está clasificado como lo contrario. No hay
respuesta del asesor registrada en `PREGUNTAS_ASESOR.md` §21 a fecha de este commit.

Los comentarios 16306/16307 de Jira (de la sesión anterior, no del fundador — las sesiones
publican bajo la cuenta compartida del equipo, A13) proponían firmar también el bloque B «por
delegación del fundador en microcopy no legal». Se revirtió esa parte al encontrar la
contradicción con `PREGUNTAS_ASESOR.md` §21, que es un registro más antiguo y más específico.

## Bloque A · Aplicado (4 textos, `exportView.js`)

Card «Facturas emitidas», sin datos que refrescar en el render inicial (no llama a `apiRequest`):

| # | dónde | antes | ahora |
| --- | --- | --- | --- |
| 1 | `:87`, línea descriptiva | `[PENDIENTE microcopy oficial]` | «Un CSV con las facturas que has emitido en un trimestre.» |
| 2 | `:90`, rótulo del campo | `[PENDIENTE]` | «Año» |
| 3 | `:94`, rótulo del campo | `[PENDIENTE]` | «Trimestre» |
| 4 | `:100`, botón | `[PENDIENTE microcopy oficial]` | «Descargar CSV» |

Firmados por el orquestador por delegación permanente del fundador (microcopy no legal;
`docs/equipo/limites-del-fundador.md`), com. 16306 de SCRUM-1041 — sólo el bloque A, no el B.

**Rojo:** `tests/scrum1041-facturas-emitidas-sin-marcador.test.mjs`, test «ROJO histórico»:
reconstruye el texto de antes y comprueba que el detector (AST, por literal — mismo criterio que
`tests/scrum402-marcador-no-se-pinta.test.mjs`) SÍ lo veía.

**Verde:** el mismo fichero, 6/6 casos. Cero literales con marcador en `exportView.js`; los 5
avisos de `libroRegistroView.js` SIGUEN marcados (control positivo — si el detector se quedara
ciego, este test caería aquí antes que en cualquier otro sitio).

**Censo actualizado:** `tests/scrum402-marcador-no-se-pinta.test.mjs`, `CENSO` — `exportView.js`
SALE (tenía 1: los 4 marcadores vivían en el MISMO literal — la `innerHTML` entera — así que
contaban como uno). Entrada BORRADA, no puesta a 0 (SCRUM-424/405).

**Suite:** `npm test` corrido completo sobre el árbol con el cambio — ver el informe de entrega
de esta rama para el recuento (población + pass/fail/skip, con `--test-reporter=tap` a fichero,
SCRUM-850).

**Captura:** `docs/master/evidencias/SCRUM-1041/capturas-1041/390-facturas-emitidas.png`, 390×844,
generada con `docs/master/evidencias/SCRUM-1041/capturas-1041.mjs` (banco `_banco-lista.mjs` de
SCRUM-816, navegador real). Registro en `docs/microcopy/2026-09-22-SCRUM-1041-facturas-emitidas.md`.

## Bloque B · NO tocado (5 avisos, `libroRegistroView.js`)

Sigue con `MARCADOR`/`rotulo()` exactamente como estaba. Añadido un comentario en el fichero
apuntando a este registro y a `PREGUNTAS_ASESOR.md` §21, para que la próxima sesión que lo mire
no repita la pregunta desde cero.

**Qué falta para cerrarlo:** respuesta del asesor a las 5 preguntas de §21.1-21.5 (o del fundador,
si decide que alguna de las 5 SÍ es microcopy de producto y no dictamen). Ninguna de las dos ha
llegado a fecha de este commit.

## Hallazgo propio, destapado por este cambio (para el orquestador)

`tests/scrum451-plazo-de-red.test.mjs` (trinquete de vistas MUDAS tras vencer el plazo de red)
subió de 4 a 5: la card «Facturas emitidas» se une a la lista. No es un defecto nuevo — su
`refrescarInfo()` ya decidía, a propósito y con su comentario («si el conteo falla no bloqueamos
la descarga: el backend vuelve a validar el tope»), no avisar de un fallo de red. Lo que la
contaba como «habla» hasta ahora era el propio marcador `[PENDIENTE microcopy oficial]`, que
casaba por accidente con el regex de «dice algo» del trinquete — sin decir nada sobre la red. Al
quitarlo (bloque A de este ticket) el trinquete pasó a medir lo que la pantalla hace de verdad.
Arreglarlo de verdad pide un texto firmado para el fallo de red (regla 30), que no existe. Techo
subido de 4 a 5 con el motivo escrito en el propio test. Aparte: la nota vieja de ese trinquete
(10-ago-2026) decía «export» donde ya tocaba decir «settings» — comprobado contra HEAD antes de
tocar nada (con `git stash`), es una deriva anterior a este ticket, no causada por él.

## Servidor / CSV

Cero. `MARCA_PENDIENTE` (`librosAeat.ts:52`) se define y no se usa; las columnas del CSV llevan
rótulos reales. No se ha tocado ningún camino de emisión fiscal (regla 38: esto es lectura, no
modificación del camino).
