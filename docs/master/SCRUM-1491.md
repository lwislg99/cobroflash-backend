# SCRUM-1491 · Quien teclea «1,5» en Desplazamiento lee qué vale, no «vuelve a intentarlo» (S4)

**Medido contra:** `origin/main` = `bafb07340557298cd5bfde943d81ade8823d4a78` · 2026-10-06T19:24:31Z
A9: sin fallo que generalice — el cambio se vio en rojo por mutación antes de darlo por bueno y el control del caso general va dentro del test

Carril S4 (`public/dashboard/js/parteDetailView.js`) · rama `scrum-1491-desplazamiento-es-un-numero-entero`.

**Skill UI:** cargada (`yaqu-premium-ui`) en esta sesión, antes de editar la vista. Sin marcado, clases, tokens ni estilos nuevos: cambia el texto de un aviso que ya existía y el valor de un atributo de una casilla.

## El defecto

Medido en yaqu.app el 6-oct (descripción del ticket, 6 filas, 2 ventanas). Teclear `1,5` en Desplazamiento manda `{"desplazamientos":1.5}`, la ruta contesta 400 `desplazamientos_invalido`, y la ficha enseñaba «No se ha podido guardar el cambio — vuelve a intentarlo». Repetirlo da otro 400: el texto mandaba a hacer algo que no iba a salir nunca. Lo mismo con un número que no cabe en la columna.

La casilla lo invitaba: `type="number"` con `inputmode="decimal"`, el teclado con coma para un dato que sólo admite enteros. Y `docs/master/SCRUM-1175.md` ya había tenido que escribir de este campo «es un recuento, no una duración».

## Lo firmado

Aprobado por el orquestador por delegación del fundador, 6-oct-2026 — SCRUM-1491 comentario 18517: el texto y tres conductas. Ficha: `docs/microcopy/2026-10-06-SCRUM-1491-desplazamiento-numero-entero.md`.

- El texto: «No se ha guardado. Desplazamiento es un número entero, como 1 o 2 — no el tiempo de viaje».
- Conducta 1: se decide por `err.code === 'desplazamientos_invalido'`, nunca por el mensaje.
- Conducta 2: sólo cambia el texto de ese aviso.
- Conducta 3: `inputmode="numeric"` en Desplazamiento, en el mismo PR. Kilómetros sigue en `decimal`.

## Lo construido

- `TEXTOS.desplazamientoEsEntero`, con su marca de aprobado.
- `avisarCampoNoGuardado` recibe el error del `PATCH` y elige el texto por su código. Con cualquier otro error, o sin código, escribe el general de siempre.
- La casilla de Desplazamiento se pinta con `inputmode="numeric"`.

**Un literal y no dos, y por qué.** El código `desplazamientos_invalido` tiene hoy dos causas en la ruta: no es entero, o no cabe en la columna. La vista no sabe cuál sin copiar esa regla, y la regla va a cambiar en SCRUM-1488. El texto dice lo que vale y no lo que falló: para el número que no cabe es impreciso, no falso. Un texto por causa pide un código por causa; queda pedido en SCRUM-1488.

## Verificado, ejecutando

`tests/scrum1491-desplazamiento-es-un-numero-entero.test.mjs`: la vista real en el banco, con un servidor que rechaza como entrega `apiRequest` un rechazo (`err.status`, `err.code` y el mensaje de la ruta).

VERIFICADO_ABAJO

## Sin medir

- **Un móvil de verdad.** Qué teclado saca cada sistema con `numeric` y con `decimal` no lo he visto en un aparato. Si `numeric` empeora algo en alguno, se para y se dice.
- Por qué teclea alguien `1,5`: es lectura del código y de nuestro propio prototipo, no medición con usuarios.
- Negativos: hoy la ruta los acepta (SCRUM-1488).

## No se cierra sin su gemelo

SCRUM-1488 (S1): si allí cambia qué rechaza la ruta con este código, el literal se vuelve a mirar contra la causa nueva.
