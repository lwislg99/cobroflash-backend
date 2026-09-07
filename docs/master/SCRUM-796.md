# SCRUM-796 · El ancla que se miraba a sí misma

**Fecha:** 6-sep-2026 · **Carril:** instrumentos · **Gate:** sin gate — los guards corren en `npm test`

**Medido contra:** `origin/main` = `95be56e4dd523b45d3046bda8cf09578ff953ab8` · 2026-09-06T21:26:35+01:00

> Sale de la recomendación de SCRUM-788, aceptada: *«arreglar el auto-chequeo del ancla, no los
> colaterales»*. Aquí no se juzga ningún colateral, no se añade ningún veredicto y no se toca
> `cayo()`, `murioElFichero()` ni `MUERTE_CUENTA_COMO`.

---

## 1 · 🔴 EL ROJO, PRIMERO

Aplicando a `scrum753` **su propia** declaración (`scripts/_censo-alcanzabilidad.mjs`,
`if (dentro.has(refname)) return true;` → `return true;`):

```
línea base: 18 pasados · 0 caídos
tras aplicar SU PROPIA mutación: 12 pasados · 6 caídos

🔴 SCRUM-753 · 🔴 el LECTOR OFICIAL de `meta:mutaciones` VE mis declaraciones
   AssertionError/ERR_ASSERTION
   «el ancla de la mutación «SCRUM-753 · … CONTROL POSITIVO …» ya no está en …: la declaración caducó»
```

El aserto de `tests/scrum753-censo-de-alcanzabilidad.test.mjs:532` comprueba que el ancla sigue en
el fichero. **El arnés acaba de sustituirla.** Cae por definición.

*(Los otros 5 caídos de esa pasada son legítimos: la mutación rompe de verdad la alcanzabilidad.)*

---

## 2 · EL ARREGLO, Y LA FORMA SE ELIGIÓ MIDIENDO

| candidata | veredicto | la medida |
|---|---|---|
| «el fichero contiene `de` **o** contiene `a`» | ⛔ **descartada** | en **5 de 81** declaraciones la sustituta **ya está** en el fichero limpio (`'    return false;'`, `'  await assertUnicidadDeNombre();'`…): ahí el aserto **no podría fallar nunca** |
| **`git show HEAD:<fichero>`** | ✅ **elegida** | el fuente del repositorio, que el arnés no toca. **0** ficheros en HEAD sin su ancla; sólo **2** fuera de HEAD |

Vive en [tests/_ancla-en-el-repositorio.mjs](tests/_ancla-en-el-repositorio.mjs), con dos formas
porque el patrón tenía dos grafías: `anclaEnElRepositorio` (¿está?) y `ocurrenciasEnElRepositorio`
(¿está **una** vez?).

**Los 2 ficheros fuera de HEAD son de `dist/`**, que git ignora por diseño: para un fichero
generado no hay original en el repositorio. El helper devuelve `medible: false` y `scrum608` **lo
dice por pantalla** con `t.diagnostic`. ⛔ Sin `skip` silencioso.

### 🔴 Mi censo del patrón estaba INCOMPLETO, y lo destapó la propia medición

Busqué `.includes(m.de)` → **6 guards**. Arreglados, el arrastre bajó de **36 a 16**, no a 9. Al
medir por qué: **7 de esos 16 eran el MISMO auto-chequeo con otra grafía** —
`src.split(m.de).length - 1 === 1`, «el ancla aparece UNA vez» — que leída del disco da **0**
mientras la mutación está puesta.

Cerradas también (`scrum586`, `scrum783`, `scrum596`), son **nueve** guards. Verificado: **no
queda ninguna grafía leyendo del disco**.

### Y una colisión de nombre, cazada al medir

Llamé al export `anclaViva` y **ya existía otro `anclaViva`** en el árbol (`scrum551`), con otra
firma y otro significado. Renombrado.

---

## 3 · EL REPARTO — y **tu expectativa era correcta**

| | SCRUM-788 | tras arreglar 6 | **tras arreglar 9** |
|---|---|---|---|
| declaraciones con colaterales | 45 | 35 | **29** |
| colaterales | 76 | 56 | **48** |
| LEGÍTIMOS | 38 | 40 | **39** |
| ARRASTRE-TEXTO | 35 | 15 | **8** |
| ARRASTRE-ESTRUCTURAL | 1 | 1 | **1** |
| INDETERMINADOS | 2 | 0 | **0** |
| **declaraciones con algún arrastre** | **31** | 13 | **8** |

**Arrastre real: 8 + 1 = 9.** La expectativa del encargo era 9 y la medida da 9. El 16 intermedio
no la contradecía: llevaba dentro los 7 restos de la misma familia.

**Los 8 que quedan son guards de texto NORMALES** —`scrum586`, `scrum748`, `scrum750`, `scrum753`,
`scrum763`, `scrum783` y `restauracion-del-arbol-ejecutable`—, más **1 estructural**
(`TypeError/ERR_INVALID_ARG_TYPE` en `scrum763`). Ésos no son el mecanismo mirándose: son tests que
aseveran sobre el texto de un fichero que la mutación cambia.

---

## 4 · LOS 2 INDETERMINADOS, CERRADOS

Eran nombres de test en **plantilla con variable** —
`` test(`SCRUM-785 · 🔴 ${quien}: se DESCUELGA…`) `` dentro de un bucle sobre *Productos* y
*Proveedores*— y mi mapeo sólo casaba literales de cadena. Ahora el clasificador construye el
patrón con los **trozos fijos** de la plantilla. **INDETERMINADOS: 0.**

---

## LOS CONTROLES

| control | resultado |
|---|---|
| 🔴 **el que decide** — su **propia** mutación aplicada | el aserto del ancla **NO cae** (antes sí) |
| 🔴 **el que decide (2)** — mutación **neutra** (dos espacios) | **18 pasados · 0 caídos** |
| ✅ **positivo** — ancla que **no está** en el repositorio | `medible true · viva **false**` |
| ✅ **positivo** — el ancla de verdad | `medible true · viva **true**` |

El positivo es el que evita romperlo por el otro lado: si tras el arreglo el aserto no cayera
nunca, sería un falso verde peor que el defecto.

---

## HUECOS DECLARADOS

- **Una edición que quite el ancla y NO se haya commiteado no se ve**: HEAD todavía la tiene. CI
  corre sobre lo commiteado; en local, la primera pasada tras commitear.
- **Las mutaciones sobre `dist/` no tienen ancla comprobable** (git lo ignora). Se declara por
  pantalla. Habría una vía: derivar el `dist` esperado del fuente en HEAD con el emisor de
  SCRUM-763. No se ha hecho: son 3 declaraciones y añade un segundo camino que mantener.
- El censo del patrón se hizo por **dos** grafías. Si aparece una tercera, este arreglo no la ve —
  y la señal sería, otra vez, un arrastre que no baja.
