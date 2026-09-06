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
| comparar con `path.resolve` en vez de la ruta resuelta | comparar por TEXTO — el defecto original del detector *(esta declaración sustituyó a `.native` → `realpathSync`; ver el apéndice: aquélla sólo se caza donde hay letra de unidad)* |
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

---
---

# APÉNDICE · el rojo de CI de esta misma entrega (6-sep-2026)

**Medido contra:** `origin/main` = `0d02b637a782ae9d90a0093985699999bdca7e9b` · 2026-09-06T12:59:22+01:00

## 🔴 ROJO 1 · mi propio caso de la unidad no existe en Linux

El aserto exigía que `C:\…` y `c:\…` fueran **distintas** antes de normalizar. En el runner **no
hay letra de unidad**, así que `toLowerCase()` sobre el primer carácter no cambia nada:

```
actual:   '/home/runner/work/…/scrum784-el-cuarto-veredicto.test.mjs'
expected: '/home/runner/work/…/scrum784-el-cuarto-veredicto.test.mjs'
operator: 'notStrictEqual'
```

Reproducido antes de tocar nada, con la ruta del runner:

| | primer carácter | bajada | ¿son distintas? |
|---|---|---|---|
| Windows | `"C"` | `c:\…` | sí → el aserto se cumple |
| Linux | `"/"` | idéntica | **no → revienta** |

Es la misma familia que la puerta de SCRUM-765: **el instrumento que se escribe para probar algo
también tiene plataforma.** Y es la segunda vez en el día.

## LA VIABILIDAD, MEDIDA ANTES DE ELEGIR

| opción | ¿viable? | medición |
|---|---|---|
| construir el caso **sin depender de la plataforma** | **no**, para esa propiedad | lo que `.native` añade sobre `realpathSync` es EXACTAMENTE la unidad (`normaliza? false` vs `true`), y una letra de unidad no existe donde no la hay |
| declarar el caso **no aplicable** donde no hay unidad | sí | — |
| un caso portable para la propiedad **de fondo** | **sí** | por un ENLACE: `path.resolve` iguala? **false** · `realpath` **true** · `.native` **true** |

**Así que las dos mitades, no una.** La portable (el enlace) corre siempre y lleva la mutación
declarada; la de la unidad corre donde existe y, donde no, **lo dice por pantalla** con
`t.diagnostic()`. ⛔ Sin `skip` silencioso — y además un `skip` habría dejado el test fuera de la
pasada limpia y el meta-guard habría vuelto a decir CIEGO, o sea que no arreglaba el ROJO 2.

**Elijo las dos porque cubren cosas distintas:** la portable defiende lo que de verdad sostiene el
detector (comparar resuelto, no texto) en las dos plataformas; la de la unidad defiende lo único
que `.native` añade, allí donde existe.

## La mutación declarada cambia, y también por medición

Iba `.native` → `realpathSync`. Esa degradación **sólo se caza donde hay letra de unidad**, así que
en Linux ningún test caería, saldría **MUDA** y pondría el job en rojo por un defecto que allí no
existe. Ahora es `.native` → `path.resolve`, que la mitad portable caza en las dos.

## ✅ EL CONTROL QUE NO PODÍA FALTAR

En Windows, a mano, con restauración verificada por bytes:

| mutación | resultado |
|---|---|
| sin mutar | `ok 2` |
| `.native` → `realpathSync` | **`not ok 2`** ← la mitad de la unidad **sigue cazando aquí** |
| `.native` → `path.resolve` (la declarada) | `not ok 2` |

Bytes restaurados: `Buffer.compare = 0` en los dos.

## EL CENSO (tarea 4) — y su primera versión NO servía

Buscaba «constructos de Windows» en `tests/` y daba **19 ficheros, 16 sin declarar**. Mirándolos
uno a uno, casi todos falsos positivos — la misma clase de error que contar una exclusión como una
ejecución:

- **`'junction'` no ata a Windows**: fuera de Windows Node ignora el argumento de tipo (documentado;
  aquí sólo he medido que en Windows funciona).
- las rutas **`'C:/…'` escritas a mano son DATOS** de prueba de un parser de rutas → **INDETERMINADO**
  sin leer cada caso.
- `charAt(0).toLowerCase()` cazaba `const camel = (m) => …`, capitalizar un rótulo y ordenar
  apellidos. Nada que ver con la unidad.

**Retirado.** Queda uno estrecho y sano: *una PRECONDICIÓN que exige que la misma ruta escrita de
dos formas sea DISTINTA, en un fichero que no lo declara.*

| | |
|---|---|
| población | 786 ficheros `.mjs` de `tests/` |
| 🔴 sin declarar | **0** |
| control positivo | el aserto **exacto** que tumbó el CI → lo reconoce |
| control negativo | la **misma forma** con el discriminador puesto → no lo denuncia |

Y hubo que enseñarle a **seguir la variable**: en el caso real la transformación vive una línea
antes del aserto, y sin eso su control positivo salía rojo. Lo cazó su propio control.

⚠️ **Lo que este censo NO ve**, dicho para que nadie lo lea como «no hay dependencias de Windows en
`tests/`»: cualquier otra forma de depender de la plataforma. Sólo ve ésta.

## ROJO 2 · cayó solo, COMPROBADO

`vivas 79 · mudas 0 · ciegas 0 · ficheros muertos 0` · exit 0. La CIEGA de `scrum784` era
consecuencia del ROJO 1 —su test no estaba verde en la pasada limpia, luego no se podía mutar— y
desaparece con él. Comprobado, no supuesto.

## Tanda de cierre

| | |
|---|---|
| `npm test` | **5661 tests · 5569 pass · 0 fail · 92 skipped** |
| `frontera:dist` | 270 corresponden · 0 no · 0 sin dist |
| `meta:mutaciones` | **vivas 79 · mudas 0 · ciegas 0 · muertos 0** · exit 0 |

## Huecos declarados

- **La degradación `.native` → `realpathSync` sólo se caza en Windows**, y por eso no tiene
  mutación declarada: en Linux saldría MUDA y el rojo sería falso.
- **La mitad portable no está medida en Linux.** `fs.symlinkSync(dir, enlace, 'dir')` es la forma
  documentada allí y no exige privilegios, pero aquí sólo se ha medido con `'junction'` en Windows.
  Lo confirma la próxima pasada de CI.
- El censo es **estrecho a propósito**: ve una sola forma de depender de la plataforma.
