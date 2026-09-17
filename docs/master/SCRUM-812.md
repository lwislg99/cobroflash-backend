# SCRUM-812 · El meta-guard cuenta a los que DECLARAN, y su «0 mudas» se lee como si los cubriera a todos

**Fecha:** 17-sep-2026 · **Carril:** B · instrumentos · **Gate:** 🔴 **MIDE Y PROPONE. NO AMPLÍA.**
**Medido contra:** `origin/main` = `1df4b9b9d67b2a1ed9d919bd7e746d6aae2dd219` · 2026-09-17T14:46:30Z
**Rama:** `scrum-812-las-dos-poblaciones`
**Preámbulo (A1):** `git status` limpio y sin merge a medias antes de nada ·
`git rev-list --count HEAD..origin/main` = **0** al ramificar.

> **Obligación 0:** sin rama `scrum-812*`, sin commit con ese número en `main`, sin expediente →
> causa **(a)**, nunca empezado.

---

## LA PREMISA SIGUE VIVA (el ticket es del 7-sep y han pasado diez días)

Comprobado en el código de hoy, no heredado. `censoDeDeclaraciones` —el censo del que sale la
línea que publica el meta-guard— recorre `tests/` y **sólo se queda con los que declaran**:

```js
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.mjs'))) {
  const { buenas, incompletas } = lecturaDeDeclaraciones(…);
  if (buenas.length || incompletas.length) out.push({ guard: f, … });   // ← el filtro
}
```

**Un guard que no declara no entra en el denominador ni para bien ni para mal.** El ticket no está
caducado.

---

## ① LAS TRES CIFRAS — y por qué son tres y no dos

Evidencia ejecutable: `docs/master/evidencias/SCRUM-812/censo-812.mjs` · salida completa en
`salida-censo-812.txt`. **El lector es el de la casa** (`censoDeDeclaraciones`,
`lecturaDeDeclaraciones`): un censo con su propia idea de qué es una declaración daría un número
distinto del que decide si CI pasa.

| | |
|---|---|
| ① ficheros de test que **existen** en `tests/` | **879** |
| ② **nombran** `MUTACIONES_QUE_ME_TUMBAN` en su texto | **82** |
| ③ los que el **meta-guard ve** y mide | **79** (243 declaraciones) |

**La tercera cifra existe porque ② y ③ no coinciden**, y eso había que mirarlo: tres ficheros
nombran el símbolo y el lector no los devuelve. Revisados uno a uno — **ninguno es una declaración
invisible**, que era el riesgo:

| fichero | por qué no lo ve el lector |
|---|---|
| `scrum708-el-fichero-que-no-corre` | lo nombra para **declarar EN PROSA por qué NO declara** |
| `scrum606-albaran-desde-presupuesto` | lo nombra en un comentario: las corrió **a mano** el 5-sep y anotó lo que salió |
| `scrum836-ancla-de-mutacion-viva` | lo **genera como texto** en un fixture (es el guard que vigila las declaraciones) |

> 📌 `scrum708` es el precedente que hacía falta para la pregunta de abajo: **el árbol ya sabe
> declarar una imposibilidad en prosa.** *«El defecto que vigila es renombrar o mover un fichero, y
> una mutación de SCRUM-745 es una sustitución de texto: no puede imitarlo. Media declaración
> parece cobertura, así que no se pone ninguna y queda dicho por qué.»*

### 🔴 ¿Hueco o imposibilidad? — los 800 que no declaran, separados

| | n |
|---|---|
| ⛔ **imposibilidad DECLARADA** en prosa | **2** |
| ⚠️ **gateados** (`QA_DB_TEST`, `LIBRO_PG_URL`…): el job del meta-guard corre **sin base por diseño**, así que saldrían **CIEGOS**, no mudos | **73** |
| ⚪ no ejercitan código del repositorio: **no hay nada que mutar** que les afecte | **19** |
| 🔴 **se pueden mutar y no declaran** | **706** |
| **suma** | **800 ✅ cuadra** |

### ¿Anteriores al mecanismo, o nacidos después?

| | n |
|---|---|
| **anteriores** a SCRUM-745 (4-sep-2026, `f2b71ca4`) | **650** |
| **nacidos DESPUÉS** y aun así sin declarar | **145** |
| sin fecha de alta legible → **NO CLASIFICADO** | **5** |

> **CONTROL, y desarma la excusa fácil:** de los 79 que **sí** declaran, **7 nacieron antes** de
> SCRUM-745. Si ninguno lo hubiera hecho, «es anterior al mecanismo» explicaría el hueco entero.
> Con siete que sí, no lo explica: se puede declarar hacia atrás, y algunos lo hicieron.

---

## 🔴 EL LÍMITE, ANTES QUE EL NÚMERO: «GUARD» NO ESTÁ DEFINIDO EN EL ÁRBOL

El enunciado pregunta cuántos **guards** existen. Buscado: **no hay ni una línea en `docs/` ni en
el máster que diga qué distingue un guard de un test cualquiera.** Y eso no es un detalle — es lo
que decide si el número significa algo.

**Mi primer recuento dio «706 sin vigilar», y ese número era MÍO, no del árbol.** Al mirar la lista
salían `billingPlan`, `flags`, `locales`, `invoiceNumber`: tests unitarios de funciones puras.
Llamarlos «guards desprotegidos» habría inventado deuda, que es exactamente lo que este encargo
prohíbe. Se retira.

Lo que sí hay es **una señal auto-declarada**: que el propio test se llame `GUARD` en su título. Es
estrecha y se queda corta a propósito — **prefiero un suelo firme y pequeño a un número grande que
no se sostiene**.

| | n |
|---|---|
| ficheros con al menos un test titulado **GUARD** | **195** |
| de ésos, **declaran** mutación | **18 (9 %)** |
| de ésos, **NO declaran** y **sí se pueden mutar** | **177** |
| · anteriores a SCRUM-745 | 139 |
| · **nacidos después** | **38** |
| el resto de los 706 → **NO CLASIFICADO**, del lado malo | **529** |

> **Y la señal es débil en las dos direcciones, que también hay que decirlo:** de los 79 que
> declaran, sólo **18** se llaman guard. O sea que 61 ficheros declaran mutación sin llamarse
> guard. El rótulo no es un censo: es lo único auto-declarado que hay.

**La respuesta a «¿hueco o imposibilidad?», con lo medido:** de los 800 que no declaran,
**94 tienen motivo** (2 imposibilidad declarada + 73 fuera del alcance del job + 19 sin nada que
mutar) y **177 son hueco sostenible** — se llaman guard, se pueden mutar y no declaran. Los otros
529 **no se puede afirmar qué son**.

---

## ② LO QUE LA CIFRA DEBERÍA DECIR — propuesta, NO implementada

Hoy el meta-guard publica dos líneas:

```
censo · 79 guards · 243 declaraciones (suelos 20 / 54)
vivas 232 · mudas 0 · ciegas 0 · ficheros muertos 0
```

🔒 **Un 100 % que no declara de qué es un 100 % es una frase, no una medida.** Las dos se leen como
«todos los guards están cubiertos» y ninguna lo dice. Lo que propongo, en orden de coste:

**① La palabra.** `79 guards` → **`79 ficheros DECLARANTES`**. Una palabra, y se acaba la lectura
equivocada: nadie confunde «declarantes» con «todos».

**② El denominador que ya tiene delante.** El instrumento **ya recorre `tests/` entero** — el
filtro de `censoDeDeclaraciones` descarta los que no declaran *después* de listarlos. Así que
publicar `79 de 879 ficheros de test (9 %)` **no cuesta una lectura más**: es el `readdirSync` que
ya hace. **Cabe en el mismo instrumento.**

**③ El subconjunto auto-declarado, como cifra propia y con su nombre.**
`195 se titulan GUARD · 18 declaran (9 %)`. Va aparte del denominador general porque mide otra
cosa, y con el rótulo delante para que nadie lo lea como «los guards».

**④ Un trinquete, con la forma que la casa ya usa.** Como `TOPE_PROSA_MUDA` en `scrum758`: fijar el
18 y exigir que **no baje**, y que si sube se re-ancle en el mismo commit. Eso convierte el número
en una cuesta hacia arriba en vez de una foto.

### 🔴 Lo que NO cabe en el mismo instrumento, y por qué

**Decidir qué ficheros son guards.** Eso no es una medición: es una definición, y el árbol no la
tiene. Mientras no exista, cualquier «X de Y guards» que publique el meta-guard será una cifra
inventada con aspecto de medida — que es el defecto que este ticket persigue, cometido por el
propio instrumento que viene a arreglarlo.

**La propuesta es publicar los dos denominadores que SÍ se pueden derivar** —ficheros de test, y
ficheros auto-titulados guard— **y no inventar el tercero.** Si el fundador quiere un censo de
guards de verdad, la decisión que hay que tomar primero es **qué es un guard**, y ésa no es mía.

> ⛔ **No se ha tocado el meta-guard.** Ni una línea. Esto mide y propone.

---

## LA TANDA

```
ARBOL QUIETO DESDE: 14:56:20 UTC
ARBOL QUIETO HASTA: 15:05:51 UTC
# tests 7363 · # pass 7253 · # fail 0 · # skipped 110
```

`npm run guards:entrada`: 26 tests, 0 fallos, `# skipped 0`.

> Se mira `# fail` y no sólo el código de salida.

---

## LO NO TOCADO

- **`scripts/meta-guard-mutaciones.mjs`: ni una línea.** El encargo dice medir y proponer; decide
  el fundador.
- **Nada de la SCRUM-908**, que sigue abierta en su rama.
- **Ninguno de los 177 ha recibido una declaración «de paso».** Escribir 177 mutaciones sin medir
  una por una si imitan el defecto que su guard vigila sería fabricar la misma cobertura aparente
  que este ticket denuncia.
- `src/` intacto · ningún estado ni flag nuevo (27) · ninguna dependencia (36) · cero producción y
  staging · `git stash` no usado · historia no reescrita.
