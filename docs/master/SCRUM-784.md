# SCRUM-784 · El cuarto veredicto del meta-guard

**Fecha:** 6-sep-2026 · **Carril:** instrumentos · **Gate:** sin gate — el guard corre en `npm test`

**Medido contra:** `origin/main` = `c8462a8d09931c1afb5613fdc29c8143c8980db2` · 2026-09-06T11:50:46+01:00

---

## PASO 0 — EL ROJO, REPRODUCIDO ANTES DE TOCAR NADA

Mutando la puerta de `scripts/_puerta-de-entrada.mjs` a `return true` (con eso, el `import` que
`scrum765` hace del meta-guard ejecuta su bloque principal **dentro del proceso del test**):

```
LÍNEA BASE  : 7 pasados · 0 caídos
  ¿«CONTRASTE: la puerta NO abre…» en verde? true

🔴 VEREDICTO DE HOY : MUDA
   el guard NO cayó. Test que debía ponerse rojo: «CONTRASTE: la puerta NO abre…»

── qué emite node:test con la mutación puesta ──
  pasados (0):
  caídos  (1):
     · "C:\\Users\\Javier Pereira\\cobroflash-b5\\tests\\scrum765-la-puerta-y-el-suelo.test.mjs"
```

**MUDA sobre un guard que se puso rojo.** `cayo()` busca el nombre declarado entre los caídos, y
cuando el radio de la mutación mata el fichero, `node:test` emite **un solo** `test:fail` cuyo
`name` es **la ruta del fichero**.

## LAS TRES FORMAS, MEDIDAS CON EL MISMO GUARD Y LA MISMA LÍNEA

| caso | pasados | caídos | qué son los caídos |
|---|---|---|---|
| A · sin mutar | 7 | 0 | — |
| B · un test cae, el fichero **vive** | 4 | 3 | **nombres de test** |
| C · el fichero **muere** | 0 | 1 | **la RUTA del fichero** |

**Se distinguen por DATO, no por adivinanza.** Y B enseña de paso el otro lado del agujero: la
declaración nombra **un** test y caen **tres**.

### Por qué SCRUM-748 no lo tapaba

Aquella cerró el fichero que muere en la **pasada limpia**: PUERTA 1 exige el test en verde antes
de mutar. Aquí la línea base está **verde** —7 pasados— y el fichero muere **después** de mutar.

---

## LO QUE SE HIZO

`murioElFichero(resultado, guard)` contesta una pregunta **distinta** con un dato **distinto**:
¿hay entre los caídos uno que resuelve al fichero del propio guard? Si el test declarado no cayó
**y** el fichero murió → **cuarto veredicto**.

⛔ **`cayo()` NO se ha tocado.** Sigue exigiendo el nombre declarado, ni uno más, y hay guard que
lo sujeta: relajarlo a «cualquier rojo vale» pone en rojo
`⛔ cayo() sigue exigiendo EL NOMBRE declarado`.

### La comparación es por `realpathSync.native`, y eso lo decidió una medición

La primera versión comparaba con `path.resolve` sobre una raíz escrita a mano y dio **false** sobre
el caso C. **Aquel `false` era un defecto de mi medición** —la raíz llevaba la unidad en minúscula
y `node:test` emite `C:`—, pero destapó una fragilidad real. Medido sobre la misma ruta escrita de
las dos formas:

```
realpathSync(C:\…)        vs realpathSync(c:\…)        → NO son iguales   (conserva la unidad)
realpathSync.native(C:\…) vs realpathSync.native(c:\…) → SÍ son iguales   (la normaliza)
```

Por eso `native`: normaliza la unidad **y** enlaces y nombres cortos 8.3 — lo mismo que hizo falta
en la puerta de SCRUM-765. **Control negativo medido:** un NOMBRE de test no resuelve a ningún
fichero, así que el caso B no puede disparar el cuarto veredicto.

---

## 🔴 LA DECISIÓN QUE NO ES MÍA: ¿CAÍDA O CEGUERA?

Cambia el código de salida, así que vive en **una** constante, `MUERTE_CUENTA_COMO`, y no repartida
por el código. **Los dos lados, con un caso real cada uno, sobre el mismo guard:**

| | ① a favor de **CAÍDA** | ② a favor de **CEGUERA** |
|---|---|---|
| la mutación | la puerta abre para todos | un error de sintaxis en `frontera-dist.mjs` |
| relación con lo que el guard vigila | **es exactamente el defecto** manifestándose | **ninguna**: el guard ni lo nombra |
| lo que ve el instrumento | `0 pasados · 1 caído` = la ruta | `0 pasados · 1 caído` = la ruta |
| veredicto | FICHERO MUERTO | FICHERO MUERTO |

🔴 **SON INDISTINGUIBLES DESDE DENTRO.** El dato es idéntico. Elijas lo que elijas, será lo
correcto para uno de los dos casos y lo incorrecto para el otro.

**La asimetría de las consecuencias sí se puede enunciar:**

- Con **`'caida'`**, el caso ② se certifica como «el guard vigila» por un paréntesis mal puesto en
  otro fichero, **y el job sigue verde**. El error es **silencioso**, que es la forma que esta casa
  persigue desde SCRUM-745.
- Con **`'ciega'`**, el caso ① tumba el job y obliga a acotar la mutación o a declararla. El error
  es **ruidoso** y cuesta fricción.

**Coste medido de elegir hoy: cero.** En la pasada completa del árbol,
`vivas 69 · mudas 0 · ciegas 0 · ficheros muertos 0`: **ninguna declaración de hoy dispara el
cuarto veredicto**. La elección no mueve ningún número actual; decide qué pasará la próxima vez.

**Puesto PROVISIONALMENTE en `'ciega'`** mientras se decide, por el lado que falla ruidoso. Cambiarlo
es una palabra en una línea.

---

## EL OTRO LADO DEL MISMO AGUJERO — medido, y **NO es esto**

Cuando una mutación **nombra** un test, ¿qué pasa con el resto del fichero si también se cae? Hasta
hoy, nada: el meta-guard sólo miraba el test nombrado.

**Medido en la pasada completa: 55 tests cayeron ADEMÁS del nombrado, repartidos en 33
declaraciones de 17 guards distintos.**

**El cuarto veredicto NO lo cubre**, y no es un descuido: son preguntas distintas. El cuarto
veredicto contesta «¿murió el fichero?»; esto contesta «¿qué MÁS se rompió?». En los 33 casos el
fichero **vivió**, así que el cuarto veredicto no llega a mirarlos.

⚠️ **Y no está claro que sea un defecto.** Un colateral suele ser legítimo: dos tests que miran el
mismo defecto desde dos sitios caen juntos, y eso es cobertura, no ruido. Convertir «cayó algo más»
en un veredicto haría rojo un árbol sano. Lo que sí faltaba era **el número**, así que el
instrumento ahora lo IMPRIME y no cambia ningún veredicto:

```
ℹ 55 test(s) cayeron ADEMÁS del nombrado. Ninguno cambia un veredicto: se cuentan porque
  hasta hoy eran invisibles.
```

**Decidir qué hacer con los colaterales es otro ticket.** Aquí sólo dejan de ser invisibles.

---

## LOS CONTROLES

| control | resultado |
|---|---|
| 🔴 **El que decide** — el caso de la puerta | **MUDA** antes → **FICHERO MUERTO** después. **Nunca MUDO.** |
| ✅ **Positivo** — una mutación que de verdad deja al guard mudo | sigue saliendo **MUDA** |
| ✅ **Contraste** — un test cae y el fichero vive | sigue saliendo **VIVA** |
| ✅ **Contraste** — las vivas del árbol | `vivas 69 · mudas 0 · ciegas 0 · ficheros muertos 0`; **ninguna se ha movido** |

El control positivo es el que más importaba: si tras el arreglo ya nada saliera mudo, se habría
roto el veredicto que sostiene todo lo demás. Provocado a mano con una mutación sin efecto sobre
nada que el guard mire → **MUDA**.

---

## TESTS

- [tests/scrum784-el-cuarto-veredicto.test.mjs](tests/scrum784-el-cuarto-veredicto.test.mjs)

## MUTACIONES DECLARADAS

| mutación | qué prueba |
|---|---|
| `murioElFichero` → `false` siempre | se vuelve al MUDO falso del ticket |
| `murioElFichero` → cualquier caída vale | el cuarto veredicto se comería a los otros tres |
| volver a `realpathSync` sin `.native` | la unidad en minúscula rompería la comparación |
| 🔴 `cayo()` relajado a «cualquier rojo vale» | el sello de goma que el ticket prohíbe |

---

## HUECOS DECLARADOS

- **La decisión CAÍDA/CEGUERA no la pone esta sesión.** Está en `MUERTE_CUENTA_COMO`, con los dos
  casos medidos arriba.
- **Un fichero que muere a MITAD** de la ejecución (no al cargar) no está medido: los dos casos
  provocados aquí dan `0 pasados`. Si en ese caso `node:test` emitiera además nombres de tests, el
  cuarto veredicto no se dispararía y volvería a salir MUDA. No he sabido provocarlo.
- El detector cree a `node:test` cuando dice que el caído es un fichero. Un test **cuyo nombre
  fuera literalmente la ruta de su propio fichero** se leería como una muerte. No existe en el
  árbol y no parece un riesgo real, pero queda dicho.
- Los **55 colaterales** se cuentan, no se juzgan. Qué hacer con ellos es otro ticket.
