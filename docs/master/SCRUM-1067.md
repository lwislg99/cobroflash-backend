# SCRUM-1067 · Modelo 347 (operaciones con clientes y proveedores) — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — lo que ya existe

Ningún módulo ni fichero de `src/` o `public/dashboard/js/` contiene `347` ni `modelo347` (grep sin
resultados). El propio ticket lo dice: «el 347 no existe en YaQu». Confirmado.

## Por qué no se puede construir hoy — medido, no supuesto

La aceptación (punto 1) exige **«descargar y citar la orden y responder Q-C8»**. El umbral de
importe que decide quién entra en el 347 — el dato central de todo el ticket — está
**explícitamente sin citar**: «A quién obliga, a partir de qué importe y qué operaciones entran:
Q-C8 sin responder y SIN cita: el umbral NO se escribe en el código ni en el ticket hasta
citarlo». Medido igual que en 1063/1065: SCRUM-1039 «Tareas por hacer», Q-C8 sin respuesta en
`docs/producto/CONTABILIDAD.md:86`.

Escribir el agrupador por NIF sin el umbral sería construir una pantalla que no sabe a quién debe
mostrar — el propio ticket lo prohíbe en su punto 2 («el umbral que fije la orden citada decide
quién aparece»).

## Qué SÍ mide algo reutilizable

Los NIF de clientes ya existen en `Customer` y los de proveedores en `Provider` (verificado en
`prisma/schema.prisma`); agrupar por NIF con formatos distintos (con/sin guiones) es un problema de
normalización de texto que no depende de ninguna cita — pero construirlo aislado, sin el umbral que
decide quién aparece en el listado, no cumple la aceptación del ticket y se descarta como
adelanto parcial: dejaría un agrupador sin la pieza que el propio ticket señala como el dato que
lo justifica.

## Siguiente paso exacto

Ninguno para J1 hasta SCRUM-1039 + Q-C8 (concretamente, el umbral y qué operaciones entran).

## STOP respetado

No se ha construido nada; ni datos de cliente exportados ni tocados. Solo lectura y este
documento.
