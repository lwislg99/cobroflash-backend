# SCRUM-1085 · Registrar la pregunta del EMISOR en la rectificativa para el asesor

**Fecha:** 22-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** ninguno — solo AÑADIR
**Medido contra:** `origin/main` = `763d37e5225ea4897827b1a997e34cf5e117c5c3` · 2026-09-22T22:27:30Z

## Encargo

Javier decidió hoy «lo llevamos al asesor»: si una R1 (rectificativa) debe usar los datos del
EMISOR de la factura original o los vigentes al rectificar, cuando han cambiado (domicilio,
denominación o NIF). La pregunta ya venía redactada por el orquestador; J4 la registra literal en
`docs/legal/PREGUNTAS_ASESOR.md` y `docs/legal/PREGUNTAS_ASESOR_POR_ESPECIALISTA.md`, con el mismo
formato que las preguntas vecinas. **Propone; no envía** (regla de puesto J4).

## PASO 0 (medido, no asumido)

- `git grep -n -i rectificativa` sobre los dos ficheros: nadie había registrado esta pregunta antes
  (P17 es del cliente/destinatario, no del emisor; B4/F11 son de `TipoRectificativa I/S`, ya
  cerrada).
- `git ls-remote --heads origin | grep -i rectificativa`: ninguna rama viva sobre esto.
- El contexto del encargo — «el camino de la rectificativa se dejó SIN DECIDIR a propósito, marcado
  pendiente en código» — se verificó CONTRA EL CÓDIGO, no se dio por cierto:
  `src/modules/invoicing/domain/emisorCongelado.ts` (SCRUM-665) congela el emisor al emitir, pero
  **no** tiene ningún equivalente a `congelarParaRectificativa` (que sí existe para el cliente en
  `clienteCongelado.ts`). En `src/modules/system/app/routes/invoicesAdmin.routes.ts` (ruta de
  rectificación, ~línea 1030), la R1 llama `congelarEmisorDesdeFicha(original.merchant!)` — la ficha
  VIVA, no la original — con un comentario literal: «PENDIENTE, marcado a propósito y sin resolver
  por omisión (comentario 16468 de Jira SCRUM-665, instrucción explícita de Javier)». Coincide
  exactamente con lo que decía el encargo.

## Qué se hizo

- `docs/legal/PREGUNTAS_ASESOR.md`: nueva sección **P18** insertada justo después de P17 (antes de
  la sección `RESPUESTAS`), con el mismo formato de las P11-P17 (blockquote de procedencia, cuerpo,
  sub-preguntas numeradas **1)**-**4)**, línea **Bloquea:**).
- `docs/legal/PREGUNTAS_ASESOR_POR_ESPECIALISTA.md`: nueva entrada **F16** en el bloque `1 · Asesor
  FISCAL`, después de F15 y antes del separador que abre el bloque MERCANTIL, con el mismo formato
  (**Para el asesor:** / **Desbloquea:** / **Si no se contesta:**). Contador del final actualizado:
  15→16 preguntas fiscales, 23→24 preguntas de envío.
- Los cuatro puntos de la pregunta (datos vigentes vs. originales; si cambia con el NIF/SL frente a
  domicilio/denominación y si una R1 con NIF distinto sigue siendo válida; la copia reimpresa años
  después; la obligación de conservar historial) van **literales**, tal como los redactó el
  orquestador, sólo con la ortografía restaurada (el encargo llegó sin tildes).

## Control al cerrar

- `git diff --numstat` sobre los dos ficheros de `docs/legal/`: solo inserciones, cero borrados —
  las secciones vecinas (P17, F15, el contador) quedan intactas salvo el propio contador, que se
  actualiza a propósito.
- El único STOP que aplica a este ticket es el de siempre en J4: un jefe firma antes de que la
  pregunta salga hacia el asesor. Esta entrega no la envía, solo la deja escrita en el expediente.
