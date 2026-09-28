# SCRUM-1230 · Lo dictado que la máquina no supo colocar ya no se pierde al confirmar

**Medido contra:** `origin/main` = `4583f537880241f948a78c9ee274d1b1a59c59a0` · 2026-09-28T15:29:40Z
**Medido en:** sesión `s4` · rama `scrum-1230-colocar-lineas-dictadas`

## El defecto

El dictado propone líneas en su bloque; las que la máquina no sabe colocar van bajo «Sin colocar —
elige mano de obra o materiales». La línea **no tenía con qué elegir**, y `lineasConfirmadas` la
descartaba al pulsar «Añadir estas líneas». **El técnico dictaba, confirmaba, y eso desaparecía sin
aviso.** Pérdida de datos del profesional, por la vía por la que más apunta.

## El arreglo (`parteDetailView.js`, solo)

- Cada línea «Sin colocar» lleva **dos fichas: Mano de obra / Materiales**. Son las mismas fichas del
  tipo de intervención (`.parte-tipo` / `.parte-tipo-ficha`, 48 px, CSS ya existente) y los mismos
  rótulos de los bloques (`ETIQUETA_BLOQUE`): **ni texto ni clase nuevos**.
- `lineasConfirmadas` mete la línea en el bloque elegido.
- **Sin elegir, no se confirma**: «Añadir estas líneas» se bloquea mientras quede una sin bloque, y
  `confirmarLoDictado` tampoco guarda (respaldo). Lo que falta lo dice el rótulo del grupo, que
  **ahora sí se puede cumplir**.

## Verificación — el viaje

`tests/scrum1230-colocar-lineas-dictadas.test.mjs`, panel entero en el banco: pintar → dictar →
«Ordenar en líneas» (la propuesta llega por `fetch`) → elegir «Materiales» en la línea → confirmar →
mirar el `PATCH` que sale.

- **Rojo antes**, con `origin/main`: 2/2 caen (no hay con qué elegir; se puede confirmar sin elegir).
- **Verde:** 2/2. La línea llega al `PATCH` con `bloque: 'materiales'` y sus unidades, sin llevarse
  por delante lo que ya había. Sin elegir, el botón está bloqueado y, aunque se pulse, no sale `PATCH`.
- **Visual, medido:** captura a 360 px con el marcado real y las hojas del panel. Las fichas bajan a
  su propia fila (`flex-wrap` en la línea) con 48 px de alto.
- Tanda de la zona (135 ficheros + censos 1157 y 1185): **1315 · 1314 pass · 0 fail · 1 skip** (el
  gateado de BD de SCRUM-992, ajeno y declarado).

## Lo que NO resuelve, y por eso `confirmarPropuesta` NO se marca como aprobada

La firma de SCRUM-1215 (c.17367) dejaba «Añadir estas líneas» aprobada sola **cuando entraran
todas**. Con esto entran todas las «Sin colocar», pero **una línea SIN CANTIDAD sigue sin entrar**
(avisada en su línea con el texto del servidor). El botón aún no añade todas las que enseña, así que
la condición no se cumple entera y el texto sigue sin firmar.

**NO VERIFICABLE en yaqu.app** desde S4 (lectura de producción denegada).

## Apéndice (s4-28e) · los dos flecos de SCRUM-1215 c.17377, dentro de 1230

**Medido contra:** `origin/main` = `59012d2309adbd8569fc047bcd880f453ade523a` · 2026-09-28T15:42:33Z

El orquestador decidió que van aquí: los dos son «lo dictado se pierde en silencio». **Sin texto nuevo.**

1. **El aviso de la cantidad sigue a la línea como está AHORA.** Antes sólo se pintaba si la propuesta
   llegaba sin cantidad; si el técnico borraba a mano una que venía, la línea no entraba y no lo decía.
   Alcanzable, medido: es un `<input type="number">` sin nada que impida vaciarlo. `sincronizarAvisosDeCantidad`
   pone o quita el mismo `<em data-falta-cantidad>` con el texto del SERVIDOR (`avisos.cantidadesRetiradas`,
   que viaja en `data-aviso-cantidad` del botón), en cada `input` del campo.
2. **Con ninguna línea lista, el botón se apaga**, igual que cuando falta el bloque. Antes se pulsaba y
   `confirmarLoDictado:962` no hacía nada ni decía nada.

Tests nuevos en `scrum1230-colocar-lineas-dictadas.test.mjs` (4/4). **Rojo comprobado por mutación**: sin la
sincronización del aviso cae su test (3 pass · 1 fail); sin el apagado, cae el suyo (3 · 1). Tanda de la zona
(1230, 683b, 889, 889b, 402, 720, 1157, 725*, 706*): **75 · 75 pass · 0 fail**.

**NO VERIFICABLE en yaqu.app** todavía: no está mergeado.
