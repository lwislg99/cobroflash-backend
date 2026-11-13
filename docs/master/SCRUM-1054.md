# SCRUM-1054 · Recargo de equivalencia y suplidos: qué pasa al sellar una factura con un suplido

## J1 · SCRUM-1054 · el sellado de un suplido, medido y fijado con un test DEFECTO_CONOCIDO

**Medido contra:** `origin/main` = `e1ebdcf627097b2a2efaae7b967f55b62b4b3987` · 2026-11-13T18:26:41Z (hora de GitHub; sesión J1 `jv-j1eu`, por encargo del orquestador `cobroflash-backend-63`)

A9: aviso → cicatriz J1 «Crucé los 200k (208.755) sin medirme entre el arranque (123,5k) y el primer test» — no se pudo comprobar: el hook que lo avisó vive en el scratchpad del orquestador, fuera del repositorio, y los hooks no son de este puesto

**Qué es.** La medición previa es de `jv-j1er` (Jira c.21842). Dejó una cosa sin medir: si el sellado rechaza antes la línea al 0 %. La decisión de Javier está en c.21852: el recargo se aparca como SCRUM-1053, y para los suplidos, **«Medir el sellado y fijarlo»**. Esto es esa medición y su test. **No toca `src/`, ni el esquema, ni ninguna base** (reglas 38 y 40).

**Cómo mide.** `tests/scrum1054-suplido-al-sellar-defecto-declarado.test.mjs` ejecuta el camino real de `dist/`, con el banco de `scrum1296-emitir-encola`: la base se dobla con un cliente que apunta cada llamada y guarda la fila; del camino de emisión no se dobla nada. El caso es el de c.21842: una F1 de 1.000 € al 21 % más un suplido de 100 € (IVA 0, como obliga `schemas.ts`), a un cliente con NIF.

1. Los tres portones que `ensureInvoiceForCharge` pasa antes de pedir número (`src/lib/invoicing.ts:359`, `:363` y `:367`).
2. `sellarTrasEmision` (`selladoEstado.ts:119`).
3. `registroParaRemision`.

**Qué pasa al sellar (medido):**

| pregunta | respuesta |
|---|---|
| ¿La para un portón? | **No.** Pasa los tres: el 0 % es un tipo español válido (`TIPOS_IVA_ES_BP`) y la línea no trae causa. |
| ¿Se sella? | **Sí, entera:** número, huella, QR, `vfEstado = sellado` y PDF (`puedeProducirDocumento` da sí). |
| ¿Queda a medias, con número y sin huella? | **No.** |
| ¿Su registro de alta? | **No existe.** El encolado (`selladoEstado.ts:173`) llama a `registroParaRemision`, que lanza `DesgloseNoClasificableError` en el tramo al 0 % (`registro.builder.ts:333`). `encolarRemision.ts:81` lo captura y deja **0 filas** en `vfSubmission` y **una** constancia `encolado_fallido` con motivo `excluida`. |
| ¿Qué ve el usuario? | **Nada.** `sellarTrasEmision` devuelve `sellado` y la emisión sale como buena. |

* **Un tramo al 0 % SIN marca de suplido corre la misma suerte.** El defecto es del tramo, no de la marca (lo fija un control del test).
* **De paso, sin arreglar porque es texto del camino de emisión (regla 38):** el mensaje de `registro.builder.ts:337` dice «Se bloquea la emisión», y la emisión NO se bloquea: se emite y se sella, y lo que queda fuera es su registro.

**El test** (formato `DEFECTO_CONOCIDO` de `scrum1732`). Hay **un** defecto declarado (`suplidoSelladoSinRegistro`). Lleva un control sembrado: la misma factura sin el suplido se sella **y se encola**; si no, sale CIEGO. La medida sale CAMBIADO si un portón la para, si se encola o si queda a medias (en este último caso lo nombra como lo más grave). Resultado: **4 de 4 en verde.**

**Mutaciones** (`MUTACIONES_QUE_ME_TUMBAN`, pasadas una a una con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`): **5 de 5 vivas**, con la pasada limpia en 4/4 y el árbol restaurado (`git status` solo enseñaba el fichero nuevo). Las cinco:

1. El 0 % se clasifica en vez de lanzar (la forma de S-A).
2. Un portón rechaza el suplido (la forma de quitar la casilla).
3. El sellado falla con un 0 % (la factura queda a medias).
4. La cola deja de escribir (el control sale CIEGO).
5. Se retira la declaración y el defecto sigue.

**NO medido:**

* la ruta HTTP de punta a punta;
* la factura suelta (`invoicesAdmin.routes.ts:172`, que pasa por `validarFacturaSuelta`);
* la descarga del XML (`buildVerifactuRegistrosXml` la excluye por el mismo constructor; leído, no ejecutado);
* ninguna base de datos;
* quién puede leer la constancia `encolado_fallido` desde una pantalla.

**Error mío.** Leí Jira antes que el arranque de normas (el orden va al revés; es la forma de 1730b). Además, crucé los 200k sin medirme entre el arranque (123,5k) y el primer test, y el aviso me llegó del hook del orquestador.

**Siguiente:** Javier elige entre S-A (sacarlo de la base, con GO de emisión y rótulo firmado) y quitar la casilla (c.21852). Cualquiera de las dos pone esto en ROJO, y su PR retira la declaración.
