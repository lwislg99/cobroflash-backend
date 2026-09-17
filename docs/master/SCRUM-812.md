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

# SCRUM-812b · El rótulo honesto: «DECLARANTES», su denominador, el subconjunto con su límite y un trinquete

**Fecha:** 17-sep-2026 · **Carril:** B · instrumentos · **Gate:** IMPLEMENTA la propuesta de SCRUM-812
**Medido contra:** `origin/main` = `f52ff943e5a0ddff5c07aa760dbd8bc07a6acd8d` · 2026-09-17T18:39:33Z
**Rama:** `scrum-812b-el-rotulo-honesto`
**Preámbulo (A1):** `prisma generate` con el CLI local · `git status` limpio ·
`git rev-list --count HEAD..origin/main` = **0** al ramificar. Sin `git stash` (A15).

> **Obligación 0:** sin rama `scrum-812*` viva. La anterior está **mergeada** por el PR #1443, así
> que esta entrada **ANEXA** (A8) y no escribe encima.

---

## 🔴 PASO 0 · EL DEFECTO SIGUE VIVO, PERO MIS CIFRAS YA NO VALÍAN

Comprobado **corriendo**, no leyendo:

```
$ node scripts/meta-guard-mutaciones.mjs --solo-censo
censo · 81 guards · 248 declaraciones (suelos 20 / 54)
```

El rótulo sigue diciendo **«guards»** —nadie lo ha cambiado, el defecto está intacto— pero el
número **ya no es 79: es 81**, y las declaraciones **248**, no 243. En las cuatro horas entre mi
medición y esta tanda el árbol creció.

**Consecuencia, y es la que manda:** de la entrada de SCRUM-812 sobrevive lo ESTRUCTURAL (el
filtro, la ausencia de definición de «guard», la debilidad de la señal en las dos direcciones) y
**caduca todo lo ABSOLUTO**. El trinquete ④ va «en el valor de hoy», así que **todas las cifras se
re-midieron en este árbol**. Heredar el 79 habría anclado el instrumento a un árbol que ya no
existe.

| | entrada de SCRUM-812 (14:46Z) | **hoy, re-medido** |
|---|---|---|
| ficheros `.test.mjs` | 879 | **885** |
| nombran el símbolo | 82 | **84** |
| los que el meta-guard VE | 79 | **81** (248 declaraciones) |
| se titulan GUARD | 195 | **206** |
| de ésos, declaran | 18 | **18** |

---

## ① LA PALABRA · `79 guards` → `81 ficheros DECLARANTES`

El instrumento contaba bien y nombraba mal. Ahora:

```
censo · 82 ficheros DECLARANTES de 886 ficheros de test (9 %) · 252 declaraciones (suelos 20 / 54)
  subconjunto AUTODECLARADO · 207 ficheros se titulan GUARD en algún test · 19 de ésos declaran (9 %)
  ⚠️ la señal es DÉBIL EN LAS DOS DIRECCIONES: de los 82 declarantes sólo 19 se titulan guard, o
     sea que 63 declaran SIN llamarse guard. Y «guard» no está definido en el árbol: esto NO es
     un censo de guards.
```

*(82/886/252/207/19 y no 81/885/248/206/18 porque el guard nuevo de esta tanda ya está dentro del
árbol que se mide. Ver ④.)*

## ② EL DENOMINADOR · sin una lectura más, y por CONSTRUCCIÓN

`censoDeDeclaraciones` ya listaba `tests/` entero y filtraba **después**. Lo que faltaba era
publicar el listado. Se ha hecho **sin añadir ni un barrido**:

- nace `censoConPoblacion(dir)`, que hace **UN** `readdirSync` y **UNA** lectura por fichero, y
  devuelve `{ poblacion, declarantes, titulados, tituladosQueDeclaran, censo }`;
- `censoDeDeclaraciones` **se deriva de ella** y conserva su firma, así que ningún llamador se
  mueve;
- el subconjunto auto-declarado se calcula **del mismo texto que ya estaba leído para el AST**.

🔒 **La población y el censo salen del MISMO listado, así que no pueden divergir.** Publicarlas
desde dos recorridos habría sido dejar puesta la próxima contradicción — y es el escalón que la
casa pide: primero hacerlo imposible, no vigilarlo.

## ③ EL SUBCONJUNTO, CON SU LÍMITE PEGADO

Va como cifra propia y con las **dos** direcciones de su debilidad en la misma pantalla, porque
**un subconjunto sin su límite al lado se lee como un censo** — que es el defecto de la primera
línea otra vez, dos líneas más abajo:

- de los **207** que se titulan GUARD, sólo **19** declaran;
- y de los **82** declarantes, sólo **19** se titulan guard → **63 declaran sin llamarse guard**.

El «63» se **deriva** (`declarantes − tituladosQueDeclaran`), no se pega a mano, y su guard lo
comprueba sobre cifras fabricadas: con 80 y 20 tiene que decir 60.

---

## ④ 🔴 EL TRINQUETE — Y AQUÍ MI MEDICIÓN TUMBA MI PROPIA PROPUESTA

`SUELO_GUARD_QUE_DECLARAN = 19`, en `tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs`, con
la forma de `TOPE_PROSA_MUDA`: rojo si **baja**, y si **sube** hay que subirlo y re-anclar.

**La propuesta aprobada pedía un tope «tipo `TOPE_PROSA_MUDA`», y `TOPE_PROSA_MUDA` es un tope
sobre una zona CIEGA.** El análogo aquí serían los que se titulan GUARD y **no** declaran: hoy
**188**. Medí el ritmo antes de clavarlo, y no se sostiene:

| altas de ficheros titulados GUARD **sin** declarar | |
|---|---|
| 17-sep | **7** |
| 16-sep | **7** |
| 15-sep | **12** |

Un tope ahí se pondría rojo **a diario**, y sus dos únicas salidas verdes serían:

1. **escribir una declaración sin medir** si imita el defecto que su guard vigila — que es
   justamente lo que este ticket PROHÍBE, porque fabrica cobertura aparente; o
2. **subir el tope**, que es apagar el aviso.

🔒 **Un trinquete cuyas salidas son una acción prohibida o su propio interruptor no es un
trinquete.** Y hay precedente del coste: **A12** — un barrido correcto dejó el check obligatorio
en rojo para los 22 PR abiertos a la vez.

**El 19 sí se sostiene.** Medido: se mueve ~**1 al día** (uno el 15-sep, uno el 16, uno el 17), y
sólo cambia cuando alguien adopta el mecanismo en un guard nuevo —buena noticia, una línea para
re-anclar— o cuando alguien **QUITA** una declaración, que es retirar cobertura en silencio y es
exactamente el descuido que un trinquete debe convertir en decisión.

> ⚠️ **ESTE FICHERO ES UNO DE LOS 19, y está declarado en el ancla.** Titula sus tests GUARD y
> declara sus mutaciones, así que entra en la población que mide: antes de escribirlo eran **18**;
> el 19 lo hace él. Un instrumento que se cuenta a sí mismo no está mal **si lo dice**; lo que
> estaría mal es publicar 18 después de haber añadido el decimonoveno.

> ⚠️ **Y por qué el suelo no se deja por debajo de la realidad:** está medido en este mismo árbol.
> `SUELO_GUARDS` dice **20** sobre **82** declarantes reales. Ya no puede cazar nada: es
> decoración. Un suelo que no se re-ancla se convierte en eso.

---

## LOS CONTROLES

| control | qué exige | resultado |
|---|---|---|
| ✅ **POSITIVO** (el del encargo) | al cambiar el rótulo, los declarantes se cuentan **igual** | **81 · 248** antes y **81 · 248** después. Cambió el nombre, no la medición |
| 🔴 **ROJO del trinquete** | perturbarlo lo pone rojo; en su valor, verde | **18 → exit 1** · **20 → exit 1** · **19 → exit 0** |
| 🔴 **SUELO** | población CERO se declara **CIEGO**, no «0 declarantes» | `sueloDePoblacion({poblacion:0})` devuelve motivo con «no he mirado nada»; con población, `null`. **Es función PURA** y el bloque principal la usa: así se le exige el rojo en milisegundos, como `sueloDelCenso` |
| 🔴 **MUTACIÓN: ¿entró?** | las cuatro declaradas tumban al test que nombran | **4 de 4 VIVA** (`vivas 4 · mudas 0 · ciegas 0`), y el árbol quedó limpio |
| 🔴 **negativo del control nuevo** | indentar la constante → rojo, y por el aserto correcto | **exit 1** con el `AssertionError` esperado, no con un error de carga |

**Unicidad de las anclas, medida:** las tres del instrumento aparecen **exactamente 1 vez**. La
cuarta aparece **2 veces por construcción** —la constante, y la declaración que la cita para poder
mutarla— igual que `TOPE_PROSA_MUDA` en scrum758. `replace` toma la primera, o sea la constante,
**porque va antes del array**; y como eso era suerte y no contrato, ahora hay un test que lo
exige: si la primera ocurrencia deja de estar en columna 0, rojo.

### El regex de scrum765, y por qué cambiarlo NO es aflojar un guard

`tests/scrum765-la-puerta-y-el-suelo.test.mjs` exigía `/censo · \d+ guards · \d+ declaraciones/`.
Su propósito lo dice su propio mensaje: **«el script ha salido sin decir nada: la puerta no ha
abierto»** — es un control de ARRANQUE, con la línea del censo como ancla; no vigila la palabra
«guards». Se re-mide al texto de hoy y queda **más específica**, porque exige además el
denominador:

```
/censo · \d+ ficheros DECLARANTES de \d+ ficheros de test \(\d+ %\) · \d+ declaraciones/
```

> Si el arreglo hubiera pasado por **quitar** ese aserto o por hacerlo más laxo, esto sería un
> STOP (regla 41) y no se habría tocado.

---

## LO QUE SE REPORTA Y NO SE ARREGLA (A7)

1. **`SUELO_GUARDS = 20` y `SUELO_DECLARACIONES = 54` están muertos**: la realidad es **82** y
   **252**. Subirlos es una decisión sobre cobertura, no un arreglo de paso.
2. **`TOPE_PROSA_MUDA` (scrum758) tiene la MISMA trampa latente** que acabo de cerrar en la mía: su
   ancla se cita a sí misma y nadie vigila que `replace` toque la constante. Hoy funciona por el
   orden del fichero. Si alguien mueve el array, sale MUDO acusando a un guard sano.
3. El hueco auto-declarado sigue en **188**, y sigue sin poder cerrarse sin medir uno a uno.

## LO NO TOCADO

- ⛔ **No se define «guard».** El árbol no tiene esa definición, es del fundador, y publicar «X de
  Y guards» sin ella sería cometer dentro del instrumento el defecto que el ticket denuncia. Lo
  que se publica es que **NO es un censo de guards**.
- ⛔ **Ninguna de las 188 declaraciones que faltan.** Escribirlas sin medir una a una si imitan el
  defecto que su guard vigila fabricaría la misma cobertura aparente.
- ⛔ **Ni los 73 gateados ni los 19 sin nada que mutar.**
- Ningún veredicto ni código de salida del meta-guard cambia: sólo se añade el suelo de población
  (que sale CIEGO donde antes salía un 0 mudo) y se reescribe el rótulo.
- `src/` intacto · cero texto de usuario (regla 39) · ningún flag ni estado nuevo (27) · ninguna
  dependencia (36) · cero producción y staging · sin `db push` · historia no reescrita.

---

## LO QUE ME SALIÓ MAL (A9)

1. 🔴 **Empecé a implementar con el 79 heredado de mi propia entrada de hace cuatro horas.** El
   PASO 0 lo cazó: eran 81. Si no lo hubiera corrido, habría anclado el trinquete a un árbol que
   ya no existía — el defecto exacto de A1, cometido sobre mi propia medición.
2. 🔴 **Escribí `tituladosQueDeclaran` con un criterio distinto del que usa el rótulo**
   (`buenas || incompletas` frente a `buenas`). Hoy dan el mismo número, y por eso era peligroso:
   dos criterios que coinciden hoy son la próxima contradicción con fecha. Corregido a un solo
   criterio antes de correr nada.
3. 🔴 **Estuve a punto de anclar el trinquete en 18** — el valor de antes de escribir mi propio
   fichero, que es uno de los que cuenta. Lo medí después, no antes: son 19.
4. **Describí mi trinquete con la letra del encargo sin comprobarla.** El encargo decía «baja una
   unidad → salta; súbelo → no salta»; medido, el mío salta también al subir (forma de la casa:
   un suelo por debajo del real es decoración). Lo digo en vez de acomodar la descripción.
5. 🔴 **Puse la tanda en rojo por SCRUM-737, y en el sitio más tonto: al EXPLICAR el defecto.**
   Mis comentarios citaban el rótulo viejo literalmente —con su cifra dentro— y el censo de
   «cifras sin ancla» subió de 81 a 83. La cabecera de ese guard advierte exactamente de esto:
   *«un guard de texto se caza en el comentario que explica la prohibición, y la salida no es
   eximirse: es describir la cifra sin escribirla»*. Arreglado por el **escalón ②** de su propia
   jerarquía (reformular: una frase sin número no se desincroniza), NO tocando el censo ni
   subiendo el congelado — eso habría sido regla 41. Censo de vuelta en **81**, cero líneas mías.
   Y era doblemente mío: un comentario que cita una cifra del día es lo mismo que el PASO 0 acababa
   de cazarme con el 79.
