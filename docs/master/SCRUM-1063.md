# SCRUM-1063 · Modelo 303 completo, el cálculo — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — lo que ya existe

`src/modules/fiscal/modelo303/` (SCRUM-295, Finalizada) ya calcula el IVA **repercutido** con sus
casillas (`casillas.ts:41-48`) y ya cruza con los cobros. Este ticket pide **añadir el soportado y
el resultado** — no repetir lo que ya hay. No es un duplicado.

## Por qué no se puede construir hoy — medido, no supuesto

La propia aceptación del ticket (punto 1) lo hace depender de dos cosas, y las dos siguen sin
existir:

1. **SCRUM-1039** ("Completar las citas oficiales que faltan y llevar al asesor las nueve
   preguntas Q-C1…Q-C9") está en Jira en estado **«Tareas por hacer»**, sin ninguna rama ni commit
   asociado (`git log origin/main --grep="SCRUM-1039"` → vacío). La orden ministerial del modelo
   303 **no está descargada ni citada** en el repositorio.
2. **Q-C8** ("Plazos y modelos trimestrales… el art. 71 RIVA localizado no contiene los plazos,
   pendiente de hallar dónde están") sigue así **literalmente** en
   `docs/producto/CONTABILIDAD.md:86`, sin respuesta. Las respuestas del asesor que llegaron hoy
   (SCRUM-1079) son de **otro bloque** de preguntas (P14, A-G, P11-P17, SCRUM-143 — facturación y
   VeriFactu), no de las Q-C1…Q-C9 de contabilidad; y SCRUM-1079 en sí sigue «Tareas por hacer»,
   así que ni siquiera esas otras respuestas están volcadas todavía.

El propio texto del ticket es explícito: **«las casillas sin cita NO se rellenan»** y **«no se
escribe ninguna fórmula sin cita»** (art. 78.Tres.3.º está «por confirmar» encabezado). Escribir
el cálculo del IVA soportado y el resultado sin la orden citada sería precisamente lo que el
ticket prohíbe en su propia letra.

## Qué SÍ se puede decir ya, sin construir nada

La fórmula general (repercutido − soportado, excluyendo suplidos por LIVA art. 78.Tres.3.º) es de
sentido común contable y no cambia con la orden del modelo — pero **la casilla concreta de cada
importe sí depende de la orden**, y es lo que el ticket pide que no se adivine. Construir la resta
sin casillas sería un cálculo sin sitio donde mostrarlo (depende de SCRUM-1064, que a su vez
depende de este).

## Siguiente paso exacto

Ninguno para J1 hasta que SCRUM-1039 cite la orden del modelo 303 y Q-C8 tenga respuesta. No es un
STOP de un jefe (regla 40): es una dependencia externa (el asesor) ya declarada por el propio
ticket con la etiqueta `esperando-asesor`.

## STOP respetado

No se ha tocado `src/modules/fiscal/modelo303/`, ni ningún camino de emisión, ni `schema.prisma`.
Solo lectura y este documento.
