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

---

# SCRUM-1077a · El borrador del 390 como suma de los cuatro 303, sin pantalla

**Medido contra:** `origin/main` = `0e86dada4887f1ac54ce0ed5cad3c53c99c72c1c` · 2026-10-24T10:11:51Z
**Rama:** `scrum-1077a-borrador-390` · **Puesto:** J1 (sesión `jv-j1bi`) · **Encargo:** orquestador `cobroflash-backend-95`, 24-oct-2026 · **Decisión:** Jira c.20726 («Sí, como D2»), a la pregunta de c.20725

A9: aviso → A10 «Una idea de un jefe es una hipótesis con su literal, no una orden de construir.» — no se pudo comprobar: la frase «mismo criterio que ya rige el 303 y el 390» vivía en un comentario de Jira (SCRUM-1066 c.16699) y ningún guard del repositorio lee Jira

## PASO 0

D2 (SCRUM-1012 c.16226 y SCRUM-1066 c.16699) nombra 130/111/115/347, y el 390 no estaba. Se paró y se preguntó (c.20725), y el fundador contestó en c.20726. En `main`: 0 commits y 0 ramas `scrum-1077*`.

## Qué hay (carril J1, `src/modules/fiscal/**`)

- `src/modules/fiscal/modelo390/modelo390.ts` · `construirModelo390`: recibe los cuatro `Modelo303` y los suma. No lee facturas ni gastos, y no hay un segundo cálculo.
- `src/modules/fiscal/modelo390/modelo390.repo.ts` · `leerModelo390`: llama cuatro veces a `leerModelo303`, una por trimestre. El filtro por merchant y por fechas es el del 303.
- `src/modules/fiscal/modelo390/casillas.ts`: cada casilla con su fuente.
- Sin ruta, sin pantalla y sin texto nuevo que vea el usuario. Los avisos van como códigos y el aviso obligatorio es el del 303. Tampoco toca esquema ni emisión: `modelo303/` se lee y no se toca.

## Las casillas y su cita

Orden EHA/3111/2009, consolidada (`https://www.boe.es/buscar/act.php?id=BOE-A-2009-18472`), Anexo I: «Se sustituye por el que figura como anexo IV de la Orden HAC/27/2026, de 22 de enero, según establece su art. 3. […] Téngase en cuenta que será aplicable por primera vez a la declaración-resumen anual correspondiente al ejercicio 2026». Las casillas se leyeron en las imágenes del Anexo IV (`1761_16563944_14.png` a `_17.png`), el 24-oct-2026, con el método de 1039b.

| 390 | sale de | página |
| --- | --- | --- |
| 01/02 · 03/04 · 05/06 (4 · 10 · 21 %, régimen ordinario) | Σ 01/03 · 04/06 · 07/09 del 303 | pág. 2 |
| 33/34 «Total bases y cuotas IVA» | Σ de las filas de arriba (= Σ 27) | pág. 2 |
| 47 «Total cuotas IVA y recargo…» | = 34: el recargo no se rellena | pág. 2 bis |
| 48/49 «… interiores de bienes y servicios corrientes» | Σ 28/29 | pág. 3 |
| 50/51 bienes de inversión | **vacías**, `sin_dato_de_bien_de_inversion` (como 30/31) | pág. 3 |
| 64 «Suma de deducciones» | Σ 45 | pág. 4 |
| 65 «Resultado régimen general (47 - 64)» | 47 − 64 (= Σ 46) | pág. 4 |
| 84 · 86 · 95 | **vacías**, `el_303_deja_vacias_de_la_64_a_la_71` (transcritas en 1039b; no las releí) | — |

- **Desglose del deducible por tipo (190/191, 603/604, 605/606…): no se rellena.** El 303 da el total 28/29, no el desglose por tipo, y sacarlo sería volver a leer los gastos. Va con `sinDesglosePorque`.
- **Antes de 2026, no hay borrador** (`modelo390_sin_impreso_citado`): el impreso anterior no se ha leído.
- **Año en curso** (hora de Madrid): `provisional: true` y el motivo `año_en_curso`.
- **Rectificativas:** van con el aviso `rectificativas_sin_casilla_propia`. El libro no las distingue y caen en la fila de su tipo, no en la 29/30 «Modificación de bases y cuotas». Lo decide el asesor (aceptación 5).

## Aceptación → dónde se ve

| aceptación | dónde se ve |
| --- | --- |
| 1 · orden citada, 303 completo | la cita, arriba · el 303 de `main` |
| 2 · un solo cálculo, Σ trimestres = anual | `tests/scrum1077-borrador-390.test.mjs` (igualdad casilla a casilla, contra el 303 real) |
| 3 · cada importe con su casilla citada | `casillas.ts` + el test de casillas |
| 4 · «borrador para tu asesor», nada se presenta | NO HECHO como texto: pide firma (regla 39). Viaja `avisoObligatorio` del 303 |
| 5 · rectificativas y bienes de inversión «no incluido» | `avisos` (códigos) |
| 6 · año natural, Madrid, año en curso provisional | test «año en curso, en hora de Madrid» (23:00Z del 31-dic ya es 2027) |
| 7 · sólo lectura | test del lector: sólo `find*` |
| `npm test` completo | NO CORRIDO en local (10 sesiones a la vez): lo juzga el obligatorio |

## Lo que se corrió, con su población

- **Test nuevo:** 10 tests, 10 pass, 0 fail. Cifras del ticket: 210+105+0+42 = 357, 63+21+0+10,5 = 94,5 y 65 = 262,5.
- **Mutaciones:** 11 declaradas, 11 vivas, 0 mudas y 0 ciegas. Las pasó un conductor temporal (fuera del árbol) que lee las declaraciones con `mutacionesDeclaradas` de la casa y muta `dist/`, no `src/`. Su control sembrado, sin cambio de comportamiento, salió MUDA, como debía. Los `dist/` comprobados byte a byte después. **No corrí** la pasada entera de `meta:mutaciones`.
- **Rojo primero:** las 11 mutaciones. Sobre el `main` sin el módulo, el test no arranca (el import falla), y eso es CIEGO, no rojo.
- `tsc --noEmit`: 0 errores. Los censos de sin-consumir (1185, 411, 1480e): 38/38.

## Mis errores

- Para arreglar mi conductor de mutaciones pasé código por `node -e` desde bash, y el escapado me rompió el fichero. Lo vi al leer la salida y lo rehice con la herramienta de edición. Es la cicatriz J1 del 1-oct, otra vez: fuera del árbol, sin daño en el repo.
