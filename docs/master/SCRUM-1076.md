# SCRUM-1076 · Calendario de plazos con estado — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — lo que ya existe

Ningún fichero de `src/` o `public/dashboard/js/` contiene `calendario` en sentido fiscal (grep sin
resultados relevantes). No hay tabla en `prisma/schema.prisma` para un estado
«pendiente/llevado al asesor» por modelo y trimestre.

## Por qué no se puede construir hoy — medido, no supuesto

La aceptación (punto 1) exige **explícitamente**: «Solo tras SCRUM-1039: las órdenes de los
modelos descargadas, los plazos citados literalmente y comprobados por el script con control
negativo, y Q-C8 respondida». El propio ticket ya trae la prueba de que hoy no hay fecha
verificable: cita `CONTABILIDAD.md §4 (Q-C8)` diciendo que «el art. 71 RIVA localizado no contiene
los plazos» y da como contraejemplo medido (por un subagente, sin releer) el calendario de Billin
con fechas de 2024 dentro de un calendario de 2026 — exactamente el defecto que este ticket
existe para evitar. Medido igual que el resto del lote: SCRUM-1039 «Tareas por hacer», Q-C8 sin
respuesta en `docs/producto/CONTABILIDAD.md:86`.

El punto 3 de la aceptación repite el mismo criterio que el resto del lote: «sin cita, la fila no
aparece». Sin ninguna fecha citada, el calendario no tendría ninguna fila que pintar.

## Siguiente paso exacto

Ninguno para J1 hasta SCRUM-1039 (plazos citados y comprobados por su propio script con control
negativo) y Q-C8. Depende también de qué modelos existan ya (303/130/111-115/347/390): si algunos
de ese lote siguen sin construir cuando esto se desbloquee, el calendario nace con menos filas de
las que el ticket imagina.

## STOP respetado

No se ha inventado ninguna fecha ni estado. Solo lectura y este documento.
