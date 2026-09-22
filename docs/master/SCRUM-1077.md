# SCRUM-1077 · Modelo 390 (resumen anual de IVA) — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — lo que ya existe

Ningún fichero de `src/` contiene `390` en sentido fiscal (grep sin resultados). No existe módulo.

## Por qué no se puede construir hoy — medido, no supuesto

Este es el ticket con **más dependencias sin cumplir** de todo el lote, y las tres están
declaradas por el propio ticket:

1. **SCRUM-1039** (orden ministerial del 390 + Q-C8): «Tareas por hacer», sin commit ni rama —
   igual que el resto del lote.
2. **SCRUM-1063** (el cálculo del 303): bloqueado (ver
   [`docs/master/SCRUM-1063.md`](./SCRUM-1063.md), mismo PR) por el mismo motivo. El ticket lo
   dice explícito en el punto 2 de su aceptación: **«el anual sale de sumar los cuatro trimestres
   del cálculo del 303, sin fórmula propia»** — sin el 303 completo no hay nada que sumar.
3. **Q-C8**, sin responder en `docs/producto/CONTABILIDAD.md:86`.

## Siguiente paso exacto

Ninguno para J1. Es el último eslabón de la cadena del lote: solo tiene sentido abrirlo después de
que SCRUM-1039, Q-C8 y SCRUM-1063 estén resueltos, en ese orden.

## STOP respetado

No se ha construido nada. Solo lectura y este documento.
