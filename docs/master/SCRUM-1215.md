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

## Incremento 2 · las firmadas del lote 1, marcadas para que el censo las cuente

Firma: **SCRUM-1215 comentario 17367** (orquestador por delegación del fundador), leída en Jira antes
de tocar nada. **22 aprobadas**: los 16 rótulos + `firmar`, `anadirLinea`, `dictado`,
`pistaDictado`, `ordenarDictado`, `noSePudoCargar`. Cada una lleva **encima** su
`// APROBADO · SCRUM-1215 comentario 17367`. `firmaRechazada` no se volvió a firmar: su comentario
decía «PENDIENTE DE FIRMA» y ahora cita la firma real (SCRUM-890 c.15665).

**No se marcan, a propósito:** `confirmarPropuesta` (NO aprobada: «añadir estas» es falso mientras
SCRUM-1230 no haga entrar las «Sin colocar»; se aprueba sola cuando lo haga) · `pistaFirma`
(SCRUM-1229) · `sinBloque` (SCRUM-1230) · `sinLineas` (ver abajo).

Censo: **APROBADO 173 · PENDIENTE 7 · SIN_COMENTARIO 53**, trinquete **0 nuevas · 0 que sobran**; las
23 pasan de `acusadas` a `retiradas` con su motivo. Tanda de la zona: **69 · 69 pass · 0 fail · 0 skip**.

⚠️ **Punto ciego del censo, medido**: la regla 1 de `_censo-convenio-microcopy.mjs`
(`k: 'x', // APROBADO`, en la misma línea) **no funciona con coma**. `getTrailingCommentRanges` se
llama en el fin de la propiedad, ANTES de la coma, y `getLeadingCommentRanges` no recoge un
comentario de la misma línea. Las 22 marcas puestas así salieron `SIN_COMENTARIO`; puestas encima
(regla 2), `APROBADO`. Falla hacia acusar de más (la dirección segura), pero la regla documentada no
se puede usar. Avisado a S3.

**`sinLineas` NO pintada**: la firma aprueba «No se apuntó nada en este apartado.» para el bloque
vacío y no editable, pero la edición la **denegó el clasificador de permisos** ([Instruction
Poisoning]). No se rodea; queda para cuando lo decida el fundador. Vocabulario comprobado: «bloque»
solo existe en atributos del código, nunca a la vista, así que «apartado» cumple la condición.

## Lo que NO entra aquí

- `sinLineas`: medido que **sí se pinta** en un parte firmado (firmar exige una línea en total, no una
  por bloque). Ocultarla deja el bloque con título y cabecera y sin filas: está parado y la decisión es
  del orquestador.

## Apéndice (s4-28e) · `sinLineas` PINTADA

Al volver a intentarlo el clasificador ha dejado la edición. Firma: c.17367.

- `TEXTOS.sinLineasCerrado` = «No se apuntó nada en este apartado.», con su `APROBADO` encima. Se pinta
  **sólo** en un bloque vacío que no es editable; editable, sigue `sinLineas` («Todavía no has apuntado
  nada.»), como dice la firma.
- **Lo que afirma, comprobado:** `editable` = `puedeEditarContenido(estado).ok`, y eso sólo es cierto en
  `borrador` (`parteTrabajo.ts:319`). No depende de quién abra la pantalla: no editable = parte firmado.
- `tests/scrum1215b-sin-lineas-cerrado.test.mjs` monta la vista en el banco: firmado → el texto nuevo;
  borrador → el de siempre. **Rojo comprobado:** sin la ternaria cae el caso firmado (1 pass · 1 fail).
- Censo 1157: trinquete **0 nuevas · 0 que sobran** (la clave nueva nace `APROBADO`; `sinLineas` sigue
  `SIN_COMENTARIO`, sin tocar el JSON). Tanda de la zona (1215b, 1157, 1175c, 890, 402, 720): **40 · 40
  pass · 0 fail**.

**«Añadir al parte» (c.17375) NO va en esta rama:** está pintado en local (`scrum-1230b-anadir-al-parte-LOCAL`)
y **parado**. Mover `confirmarPropuesta` a `retiradas` en el JSON del censo lo **denegó el clasificador**
([Logging/Audit Tampering]); sin eso, `scrum1157` se pone rojo en el check obligatorio. Avisado al orquestador.

**Medido contra:** `origin/main` = `29eea3f9baba711eb65a3b6119727ef4777f0159` · 2026-09-28T15:39:19Z
