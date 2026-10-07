# SCRUM-1492 · Lo que una casilla numérica no entiende no borra el valor guardado, y se dice (S4)

**Medido contra:** `origin/main` = `73ce872cbcb6c914355830fd6b358e30aa066c77` · 2026-10-07T07:44:39Z
A9: comprobación → `tests/scrum1492-lo-que-no-es-un-numero-no-borra-lo-guardado.test.mjs`

Carril S4 (`public/dashboard/js/parteDetailView.js`) · rama `scrum-1492-lo-que-no-es-un-numero-no-borra-lo-guardado`.

**Skill UI:** cargada (`yaqu-premium-ui`) en esta sesión, antes de editar la vista. Sin marcado, clases, tokens ni estilos nuevos: el aviso es el que ya existía para un campo que no se guarda; cambian sus textos, cuándo sale y un atributo (`min`) de dos casillas.

## El defecto

Medido en yaqu.app el 6-oct (descripción del ticket, 13 filas). Con «2» guardado en Desplazamiento, teclear `1e`, `-`, `.` o `,` y salir de la casilla mandaba `{"desplazamientos":null}`: el servidor borraba el 2 con un 200, la ficha no decía nada y la casilla seguía enseñando lo tecleado. Lo mismo en Kilómetros. Una casilla `type="number"` entrega `value === ''` tanto si está vacía como si lo que tiene no es un número; lo que distingue los dos vacíos es `validity.badInput`, y la vista no lo miraba.

## Lo firmado

Aprobado por el orquestador por delegación del fundador, 7-oct-2026 — SCRUM-1492 comentario 18633. Ficha: `docs/microcopy/2026-10-07-SCRUM-1492-casilla-numerica-del-parte.md`.

- Texto nuevo, Kilómetros: «No se ha guardado. Kilómetros es un número, como 12 o 12,5».
- Desplazamiento dice el de SCRUM-1491 (c.18517), tal cual: la firma lo extiende a este caso, y dice por qué.
- Conducta: con `badInput` no se manda nada · la casilla vuelve a lo guardado · también si estaba vacía de antes.

## Lo construido

- En el cable de las casillas (`alCambiar`): si `casilla.validity.badInput`, la casilla vuelve a su valor guardado, se cuelga el aviso y no se llama a `guardarCampo`.
- `TEXTO_SI_NO_ES_UN_NUMERO`: una entrada por casilla numérica de la cabecera. Una casilla numérica nueva sin la suya no tendría qué decir, y el test la caza.
- `TEXTOS.kilometrosEsUnNumero`, con su marca de aprobado.

## De paso, en el mismo PR: los códigos de rango de la ruta

SCRUM-1488 (#2249) separó los rechazos de la ruta en un código por causa (`src/modules/jobs/domain/parteRango.ts`). Cuatro nacieron sin texto en la pantalla —`desplazamientos_negativo`, `desplazamientos_no_cabe`, `kilometros_negativo`, `kilometros_no_cabe`— y caían en «No se ha podido guardar el cambio — vuelve a intentarlo», que ahí es falso: repetirlo da otro 400. Y `-3` no es `badInput` (es un número, fuera de rango): lo de arriba no lo cubría. Medido en yaqu.app el 7-oct con el JS de producción: los cuatro dicen el general.

- `TEXTO_POR_CODIGO_DE_LA_RUTA`: un código, un texto. Sustituye a la comparación suelta con `desplazamientos_invalido` de SCRUM-1491. Se mira con `hasOwnProperty`: un código que coincida con algo heredado de `Object` no es un código de la tabla.
- Los cuatro literales: FIRMA_DE_LOS_CUATRO
- `min="0"` en las dos casillas numéricas: la mitad de S4 que SCRUM-1488 dejó nombrada. Es cortesía (las flechas no bajan de 0); `-3` tecleado sigue llegando a la ruta, y se dice.
- `kilometros_invalido` sigue en el general, declarado en el test con su motivo: desde la casilla no se llega (medido: `1e999` da `badInput` y no se manda nada).

**El fallo propio que esto cierra.** Mi test de SCRUM-1491 llevaba la regla de la ruta copiada a mano en su servidor de mentira («no entero o no cabe → `desplazamientos_invalido`»). La ruta cambió y el test siguió verde afirmando algo que ya no pasa. Corregido, y el test nuevo ya no copia: LEE los códigos de `parteRango.ts` y cae si la ruta estrena uno sin texto.

## Verificado, ejecutando

`tests/scrum1492-lo-que-no-es-un-numero-no-borra-lo-guardado.test.mjs`: la vista real en el banco. El banco no modela `validity`; el test la pone a mano en la casilla, con `value` vacío, que es lo que entrega el navegador.

- **Verde:** 18 de 18, más los 8 de `tests/scrum1491-…` (26 de 26 juntos).
- **Rojo por mutación:** base verde y 21 mutantes de 22 mueren, cada uno con su `git diff --numstat` al lado. El primero es la vista de antes (no mira `badInput`): caen 8. El que vive (quitar el `return` tras el aviso) es equivalente: la casilla ya volvió a lo guardado y la comparación de debajo corta igual. Un mutante heredado apuntaba, tras traer `main`, a una línea gemela de otra función y salió «vive» en falso: se reapuntó y se repitió la tanda entera.

**En el navegador**, sobre yaqu.app (build `73ce872c`, cuenta QA, parte 9, service worker bloqueado, control del interceptor antes de tocar; a producción sólo llegan GET). El GET del parte se sirve con Desplazamiento 2 y Kilómetros 12 puestos por la sonda.

Lo que la casilla no entiende — 2 ventanas × 13 casos = 26 filas (medido el 7-oct sobre `85fad1ee`):

| se teclea | con el JS de producción | con el JS de esta rama servido encima |
|---|---|---|
| Desplazamiento `1e` · `-` · `.` · `,` · `1-2` | manda `null`, el 2 se borra, ningún aviso | no manda nada, vuelve a «2», sale el texto |
| Kilómetros `1e` · `-` · `,` | manda `null`, el 12 se borra | no manda nada, vuelve a «12», sale su texto |
| CONTROL · `3` / `12,5` / se borra a propósito | se guardan / `null` | igual, sin aviso |

Producción: 18 MAL y 8 de control bien. Rama: 26 de 26.

Los códigos de rango — 2 ventanas × 12 casos = 24 filas; el `PATCH` lo contesta la sonda con la regla de verdad de la ruta (`dist/modules/jobs/domain/parteRango.js`):

| se teclea | la ruta contesta | JS de producción | JS de esta rama |
|---|---|---|---|
| Desplazamiento `-3` | 400 `desplazamientos_negativo` | el general | su texto, 1 línea a 390 |
| Kilómetros `-5` | 400 `kilometros_negativo` | el general | su texto, 1 línea |
| Desplazamiento `3000000000` | 400 `desplazamientos_no_cabe` | el general | su texto, 2 líneas a 390 |
| Kilómetros `100000000` | 400 `kilometros_no_cabe` | el general | su texto, 2 líneas a 390 |
| CONTROL · `1,5` · `0` · `3` · `12,5` | 400 `_invalido` / 200 | el de 1491 / se guardan | igual |

Producción: 14 MAL y 10 bien. Rama: 24 de 24. En las filas de rechazo la casilla vuelve a lo guardado y hay UN aviso, `role="alert"`, entero en la ventana, sin nada encima y sin desborde.

**NO medido:** yaqu.app con el JS ya desplegado (se mira cuando mergee).

## Sin medir

- **Un móvil de verdad.** Qué deja teclear el teclado `numeric` / `decimal` de cada sistema y qué entrega su navegador. `1e` es de teclado completo.
- Las demás casillas `type="number"` del panel (cantidades de las líneas, precios de oficina): nombradas, no abiertas.
