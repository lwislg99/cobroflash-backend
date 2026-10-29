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

---

# SCRUM-1077b · En qué casilla del 390 va la base de la S2 del emisor — MEDIDO Y PROPUESTO, no construido

**Medido contra:** `origin/main` = `c6d3aa11f15a0a582f92b8ec4a8c9838ea426dd8` · 2026-10-24T15:40:32Z
**Rama:** `scrum-1077b-casilla-s2-390` · **Puesto:** J1 (sesión `jv-j1bx`) · **Encargo:** orquestador `cobroflash-backend-95`, 24-oct-2026 · **Decisión que lo pide:** el fundador, «Leer el impreso del 390 y proponer» (24-oct, en el chat del orquestador; no está en Jira)

A9: aviso → A10 «Lo que se deduce de NO haber visto algo no vale si algo no se pudo mirar: se queda sin juzgar.» — no se pudo comprobar: el tramo 1077a dice que el Anexo IV está en las imágenes `_14` a `_17`, pero llega de la `_13` a la `_21`, y la casilla de esta pregunta está en la `_19`; un rango de páginas copiado de un registro no pasa por ningún guard

## PASO 0

SCRUM-1063 c.20768 manda la S2 del emisor a la 122 del 303, y c.20819 (1063f) dice que en el 390 sigue sin clasificar porque «su casilla en el 390 NO está decidida». En `main` el 390 no tiene el apartado 10: `git grep` de `99`, `108`, `125` o `volumen` en `src/modules/fiscal/modelo390/` da 0, y el control positivo `sinClasificar` da 4 líneas. No hay rama `scrum-1077b*` en el remoto ni ningún PR con ese nombre. Sólo docs: no se toca código, ni esquema, ni emisión.

## El impreso vigente, leído

- **Orden consolidada:** API `legislacion-consolidada/id/BOE-A-2009-18472/texto`, leída a las 15:38Z. El Anexo I: «Se sustituye por el que figura como anexo IV de la Orden HAC/27/2026, de 22 de enero, según establece su art. 3.». Es la única mención de HAC/27/2026 en el texto.
- **La orden:** `BOE-A-2026-1761`. Art. 3: el Anexo I «se sustituye por el anexo IV de esta orden». Disposición final única: «se aplicará por primera vez: […] 2. A la declaración-resumen anual del Impuesto sobre el Valor Añadido, modelo 390, correspondiente al ejercicio 2026.»
- **Las imágenes del Anexo IV** son de la `1761_16563944_13.png` a la `_21.png` (la lista sale del HTML de la orden). La casilla está en la **`_19.png`, «Pág. 6»**, apartado **«10. Volumen de operaciones»**, recuadro «Operaciones realizadas en el ejercicio»:
  - **125 · «Operaciones sujetas con inversión del sujeto pasivo»**. Una sola cifra, sin cuota.
  - En la misma página, **108**: «Total volumen de operaciones (Art. 121 Ley IVA) (99 + 653 + 103 + 104 + 105 + 110 + 100 + 101 + 102 + 125 + 126+ 127 + 128 + 227 + 228 - 106 - 107)».
- **No es la 77 ni la 27/28.** «27/28 IVA devengado en otros supuestos de inversión del sujeto pasivo» (pág. 2, `_14`) y la 77 (pág. 5, `_18`) son del destinatario, que autorrepercute, igual que la 12/13 del 303. La 113 y la 523 (pág. 7, `_20`) son triangulares y servicios localizados.

## Las instrucciones de la AEAT

- **Para 2026 no hay.** La página del procedimiento (`sede.agenciatributaria.gob.es/Sede/procedimientoini/G412.shtml`, leída a las 15:38Z) enlaza «Instrucciones 2025» e «Instrucciones 2024», y nada más. Control: esas dos aparecen en el mismo listado. Además, `…/G412/Instrucciones_modelo_390-2026.pdf` da 404. Esa ruta la deduje yo, así que el 404 no prueba nada por sí solo.
- **Las de 2025** (`…/G412/Instrucciones_modelo_390-2025.pdf`, `last-modified` 24-feb-2026), pág. 22: «125 Operaciones sujetas con inversión del sujeto pasivo: se hará constar, el importe total de: Las entregas de oro a las que sea de aplicación la regla contenida en el artículo 84, apartado Uno, número 2º, letra b) de la Ley y las entregas de oro de inversión a que se refiere el artículo 140 de la misma Ley. Las entregas de bienes y prestaciones de servicios realizadas a que se refiere el artículo 84 Uno. 2º a), c), d), e), f) y g) de la Ley.»
- Y en la pág. 21, sobre la **99** «Operaciones en régimen general»: «Tampoco se incluirán las operaciones exentas incluidas en las casillas 103, 104 y 105 ni las operaciones incluidas en las casillas 110 y 125.»
- El rótulo de la 125 es el mismo en el impreso de 2026. Que el texto de 2026 diga lo mismo que el de 2025 **no está medido**: todavía no existe.

## Diferencia con la 122 del 303

La 122 es «Información adicional» y no suma en nada. La 125 del 390 **sí entra en un total**, el 108 (volumen de operaciones, art. 121 LIVA), y **saca la S2 de la 99**. Hoy YaQu no rellena ni la 99 ni la 108, así que llevar la S2 a la 125 no cambia ninguna otra casilla. Si algún día se rellenan, la S2 tiene que quedar fuera de la 99 y dentro de la 108.

## Propuesta para el fundador (NO construida)

- ✅/❌ **La base de la S2 del emisor va a la casilla 125 del 390**, como suma de las cuatro 122 del 303. Es el mismo cálculo (aceptación 2) y depende de que 1063f (#2855) entre antes.
  - **Con ✅:** la S2 sale de `sinClasificar` del 390 y la 125 lleva su cita. La liquidación (33/34, 47, 64, 65) no cambia, porque la S2 no tiene cuota. El aviso firmado de la S2 (c.20797) sale sólo si alguna S2 queda fuera de la 122. Se construye en 1077c, encima de 1063f.
  - **Con ❌:** la S2 se queda como hoy en 1063f: en `sinClasificar` del 390, con su trimestre, y la pone el asesor.
- **Riesgo en los dos casos:** la 125 (y la 122) se limitan al art. 84.Uno.2º y al oro, y la factura no guarda la letra del supuesto, así que la 125 recogería toda S2. Lo deduzco del enunciado. No está medido sobre facturas.

## Lo que no se ha hecho

No hay código ni tests, ni nada en yaqu.app. **Suite local: NO CORRIDA** (sólo docs). Sólo corrí los guards de registro.

---

# SCRUM-1077c · La base de la S2 del emisor, a la casilla 125 del 390

**Medido contra:** `origin/main` = `9eb740a4286ee02faedd071dddfab55ddae0d515` · 2026-10-24T15:56:00Z
**Rama:** `scrum-1077c-s2-casilla-125` · **Puesto:** J1 (sesión `jv-j1bz`) · **Encargo:** orquestador `cobroflash-backend-95`, 24-oct-2026 · **Decisión:** Jira c.20833 («Sí, a la 125»), a la pregunta de c.20828 (1077b)

A9: sin fallo que generalice — el rojo salió por el motivo esperado, las 15 mutaciones vivas y el control sembrado MUDA; lo único que no cuadró fue el encargo, que pedía un guard de 1064c que no existe (abajo), y eso se dice, no se corrige aquí

## PASO 0

En `main`: 0 commits `SCRUM-1077c` y ninguna rama `scrum-1077c*`. Esta rama sale de `origin/scrum-1063f-s2-casilla-122` (#2855, OPEN, sin mergear) y lleva mezclada `origin/scrum-1077b-casilla-s2-390` (#2860, OPEN, sólo docs) para que este tramo vaya detrás del suyo. **Depende de los dos.** #2858 (1065c, OPEN) cambia `tests/scrum1077-borrador-390.test.mjs:156`; este tramo no toca ese fichero, y si #2858 entra antes, se mezcla `main`.

## Qué cambia (carril J1, `src/modules/fiscal/modelo390/`)

- `casillas.ts`: `CASILLA_INVERSION_SUJETO_PASIVO_390 = '125'`, con la cita del impreso (Orden HAC/27/2026, Anexo IV, pág. 6, `1761_16563944_19.png`, «10. Volumen de operaciones») y de las instrucciones de 2025, pág. 22, leídas en 1077b. `FUENTE_390` cita ahora también la `_19`.
- `modelo390.ts`: el 390 lleva `volumenDeOperaciones.inversionSujetoPasivo` = `{ casilla: '125', base: Σ de las cuatro 122, operaciones }`, cada operación con su factura y su trimestre. Se quita el bucle de 1063f que las metía en `sinClasificar`.
- La S2 que el 303 deja FUERA de su 122 (la que trae cuota) sigue en el `sinClasificar` del 303, y llega al 390 con su trimestre y sin entrar en la 125.
- **No cambia:** la liquidación (33/34, 47, 64 y 65), `modelo303/`, ningún texto que vea el usuario, ni el esquema ni la emisión. **La 99 y la 108 no se abren** (c.20833).
- `scripts/_sin-consumir-declarados.json`: una entrada más, la del export nuevo, detrás de las de 1077.
- `tests/scrum1063f-s2-casilla-122.test.mjs`: su caso del 390 decía «sigue declarando la S2 (sin casilla decidida en el anual)». c.20833 lo deja sin objeto, y ahora comprueba que la S2 de la 122 llega a la 125 con su trimestre. Los otros 10 casos del 303 no se tocan.

## Aceptación (c.20833) → dónde se ve

| aceptación | dónde se ve |
| --- | --- |
| la base de la S2 del emisor va a la 125, como suma de las cuatro 122 | `tests/scrum1077c-s2-casilla-125.test.mjs`, «cifras a mano: la 125 es la suma de las cuatro 122» |
| la 125 lleva la cita del impreso | `casillas.ts` + «la 125 es la del impreso LEÍDO, y la fuente cita su página» |
| deja de ir sin clasificar | «la S2 de la 125 deja de ir sin clasificar» |
| la liquidación no cambia (33/34, 47, 64 y 65) | «la liquidación (33/34, 47, 64 y 65) no cambia con la S2»: cifras a mano y el mismo año sin S2 |
| la 99 y la 108 no se abren | «la 99 y la 108 no se abren…», con control positivo (el barrido ve la 125) |
| el test del 303 (1063f) sigue verde | `tests/scrum1063f-s2-casilla-122.test.mjs`: 11/11 |
| yaqu.app | NO HAY NADA QUE VER: el 390 no tiene ruta ni pantalla |

## Cifras a mano

T1: mano de obra 800 al 21 % + S2 1.000 + gasto 100 al 21 % · T2: nada · T3: S2 500 · T4: mano de obra 200 al 21 % + S2 250.
**125 = 1.000 + 500 + 250 = 1.750** · 05/06 = 1.000/210 · 33/34 = 1.000/210 · 47 = 210 · 64 = 21 · 65 = 189, igual con S2 que sin ella.

## Lo que se corrió, con su población

- **Rojo primero:** el test nuevo contra el `dist/` sin el cambio dio 7 tests, 1 pass y 6 fail. Pasa la de la liquidación, que ya cuadraba antes. Las 6 caen por el motivo esperado: la 125 no existe y la S2 sale en `sinClasificar`. Su control (el 303 real pone 1.000, 0, 500 y 250 en la 122) pasa.
- **Dirigida:** 23 ficheros (1077c, 1077, 1063b-f, 237, 976, 824, 836, 419, 702, 700, 719, 1415, 1185, 411, 1480e, 622, 1387, 1066c, 1066e), 254 tests: 254 pass, 0 fail, 0 skipped. Por ticket: 1077c 7/7, 1063f 11/11 y 1077 10/10.
- **No existe ningún guard de 1064c:** `git grep` de «1064c» en `tests/`, `scripts/` y `docs/master/` de `origin/main` da 0. El control, el mismo `git grep` de «SCRUM-1077» en `tests/`, encuentra `scrum1077-borrador-390.test.mjs`.
- **Mutaciones:** 15 declaradas (4 de 1077c y 11 de 1077), 15 vivas, 0 mudas y 0 ciegas. Las corrió un conductor temporal, fuera del árbol, con `mutacionesDeclaradas`, `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`. Su control sembrado (cambiar sólo un comentario de `modelo390.ts`) salió MUDA. `meta:mutaciones --solo-censo`: 809 declaraciones y salida 0. **No corrí** la pasada entera.
- `tsc --noEmit`: 0 errores.
- **Suite entera local: NO CORRIDA** (10 sesiones a la vez). Juzga el obligatorio.

