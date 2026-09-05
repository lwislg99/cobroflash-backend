# SCRUM-745 · Un guard mudo se lee perfectamente bien

**Fecha:** 4-sep-2026 · **Carril:** herramienta / meta-guards · **Gate:** el script, fuera de `npm test`

**Medido contra:** `origin/main` = `a84680db458feb0db41fdd63e227bb22ea012daf` · 2026-09-04T23:10:00Z

---

## 0 · EL BLOQUEO, contestado primero

**SCRUM-719 no lo cubre. Medido, no supuesto.**

| | SCRUM-719 (`censo:mudez`) | SCRUM-745 |
|---|---|---|
| población | los guards que llaman a `soloEjecutable` (73) | cualquier guard que declare su mutación |
| mutación | **una, uniforme**: vaciar el filtro | **una por guard**, declarada por él |
| qué mide | ceguera ante un fuente **vacío** | que el guard distinga **mención de uso** |

Comprobado en el árbol: `scrum740` y `scrum741` **no llaman a `soloEjecutable`**, así que para el
censo de 719 son **NO APLICA** — invisibles. Y el defecto es otro: **sobrevive con el fichero
lleno**. Vaciar el fuente pondría rojos a estos guards (dirían «no encuentro»), o sea que
saldrían **VIVOS y sanos** justo mientras estaban mudos.

De ahí que la mutación tenga que ser **por guard**: la única que caza a un guard es la que imita
exactamente el defecto que ese guard promete cazar.

---

## 1 · EL DEFECTO

Tres trinquetes escritos el mismo día nacieron mudos, los tres por comparar por **texto** en vez
de por identidad:

```js
if (!src.includes('leerSiSigueAhi')) …    // el import mantiene la palabra viva
if (/throw new Error/.test(cuerpo)) …     // `if (false)` lo deja escrito e inalcanzable
```

El `import` y el comentario que **explica la regla** dejan el nombre en el fichero aunque la
llamada haya desaparecido. Los tres seguían **verdes sobre el defecto que venían a vigilar**.

🔴 **Se leen perfectamente bien.** Ninguna revisión los habría cazado: no hay nada raro que ver.
A los tres los encontró lo mismo —inyectar el defecto y exigir el rojo—, y eso hoy **depende de
que a alguien se le ocurra**. Ése es el hallazgo, no los tres guards.

---

## 2 · LA RESPUESTA: sí se puede, y aquí está la prueba

Un guard declara, **en su propio fichero**:

```js
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'tests/x.test.mjs', de: '<ancla exacta>', a: '<reemplazo>',
    cae: '<nombre del test que TIENE que ponerse rojo>' },
];
```

Vive junto al guard **a propósito**: un registro central se queda atrás en cuanto alguien mueve un
guard, y lo que no está al lado no se actualiza.

`npm run meta:mutaciones` las **lee por AST** —importarlas ejecutaría sus tests, y un meta-guard
que ejecuta lo que va a mutar se mete en su propia carrera—, aplica cada una, corre el guard,
**exige el rojo**, restaura en un `finally` y **verifica byte a byte** contra los bytes de disco
(SCRUM-570: el blob no sirve de referencia en un fichero normalizado). Si no puede restaurar,
sale con código 3 gritándolo.

### 🔴 DEMOSTRADO EN LOS DOS SENTIDOS, sobre un guard real ya en `main`

| estado de `scrum740` | resultado |
|---|---|
| trinquete **por identidad** (como está) | `vivas 2 · mudas 0` — **EXIT 0** |
| trinquete **por texto** (como nació) | 🔴 **lo caza y lo nombra** — **EXIT 1** |

```
🔴 GUARDS MUDOS — pasan en verde sobre el defecto que dicen vigilar:
  · scrum740-carrera-por-el-arbol.test.mjs · el guard NO cayó.
    Test que debía ponerse rojo: «TRINQUETE: todo el que barre el árbol lee con el helper»
```

**Coste: 4 s con dos mutaciones.** Fuera de `npm test` por el subproceso por mutación — misma
decisión que `censo:mudez` y los guards de navegador. La red que **sí** corre siempre es
`tests/scrum745-comparar-por-identidad.test.mjs`.

**Salidas:** 0 todo vivo · 1 algún guard mudo · 2 no supe medir (ciego) · 3 no pude restaurar.

---

## 3 · EL CENSO — y por qué no puede hacerse por texto

Hacerlo con `grep` sería **el defecto midiéndose a sí mismo**: un barrido de `includes(` casaría
la propia cabecera que explica la prohibición. Se hace **por AST y por lo que el código hace** —
una llamada a `.includes()` con un literal que **es un identificador**, sobre una variable que
trae el **fuente de un fichero**.

| | |
|---|---:|
| población | **649** ficheros `.test.mjs` |
| cota bruta (todo `.includes('<identificador>')`) | **214** en 125 ficheros |
| 🔴 **superficie de riesgo** (sobre el fuente de un fichero) | **29** en **24** ficheros |

⚠️ **Es una superficie de riesgo, no una lista de defectos.** Preguntar por un identificador sobre
un fuente es **correcto** cuando lo que se afirma es «este nombre aparece», y **defectuoso**
cuando lo que se quiere afirmar es «este nombre se usa». Esa diferencia está en la **intención**
del guard y no se puede leer del código, así que el censo no la juzga: la acota y deja el número
a la vista.

**No se congela la lista**, se vigila que el detector siga **viendo**. Un trinquete sobre el
número obligaría a tocar este fichero en cada PR que añada un guard legítimo, y un guard que
estorba en cada PR acaba desactivado (la lección de SCRUM-402).

**CONTROL NEGATIVO del detector**, tres formas que NO son este defecto y no puede acusar: un
`.includes` sobre una **lista**; sobre un fuente pero preguntando por una **frase** (no un
identificador); y la forma **correcta**, `llamadasA(src, 'x') > 0`.

---

## Lo que NO cubre

1. **Sólo hay UN guard declarando** (`scrum740`, con 2 mutaciones). El mecanismo se adopta guard a
   guard: no se han rellenado los 24 ficheros de la superficie de riesgo, porque **una declaración
   escrita sin comprobar que de verdad tumba al guard sería peor que ninguna** — parecería
   cobertura. Cada una hay que medirla, y son de otros carriles.
2. **`npm run meta:mutaciones` no está en CI.** Debería ir donde está `guards:visuales`, pero
   añadir un job es superficie de otro carril y no lo abro por mi cuenta.
3. **El censo no distingue intención**, y está dicho arriba. Los 29 no son 29 defectos.
4. **Una declaración puede caducar**: si el ancla desaparece del fichero, el meta-guard lo reporta
   como CIEGO (no como mudo), que es lo correcto — pero nadie garantiza que se actualice.
5. **No se ha medido la superficie fuera de `tests/`** (`scripts/`, hooks).

## HALLAZGOS FUERA DE ALCANCE

* La misma forma existe con `.test()` de regex sobre un fuente (`/nombre/.test(src)`), que el
  censo de hoy **no cuenta**: el detector mira `.includes()`. Es la otra mitad de la superficie y
  no está medida.

## Ficheros

* `scripts/meta-guard-mutaciones.mjs` — **nuevo**. El lector por AST y el ejecutor con su
  restauración verificada.
* `tests/scrum745-comparar-por-identidad.test.mjs` — **nuevo**, 6 tests: el lector, su control
  negativo, que el mecanismo existe y es ejecutable, y el censo con su suelo.
* `tests/scrum740-carrera-por-el-arbol.test.mjs` — declara sus dos mutaciones.
* `package.json` — `meta:mutaciones`, con su nota de por qué no sustituye a `censo:mudez`.

---
---

# APÉNDICE · SCRUM-745 FASE B · el meta-guard a CI, y la mitad que faltaba

**Fecha:** 4-sep-2026 · **Medido contra:** `origin/main` = `a84680db458feb0db41fdd63e227bb22ea012daf` · 2026-09-04T23:45:00Z

Las dos cosas autorizadas dentro de este carril. Va en la misma rama a propósito: amplía el mismo
censo y el mismo script, y separarlas daría una rama que no se puede mergear sin la otra.

---

## ① `meta:mutaciones` VA A CI, en job propio

**Fuera de CI era «un aviso que nadie está obligado a mirar»** (SCRUM-736). Ya está en `ci.yml`.

### 🔴 Y el job es propio por una razón medida, no por estilo

**Este guard MUTA FICHEROS DEL CHECKOUT.** Compartir job con cualquier paso que lea el árbol es
**exactamente la carrera de SCRUM-740** —un barrido leyendo mientras otro escribe—, y la sabemos
hoy porque la arreglamos hoy. Con checkout propio, lo que muta es suyo y de nadie más.

**No cuesta reloj:** los jobs de un workflow corren en paralelo, y éste tarda **4 s** con las dos
mutaciones declaradas, frente a los varios minutos del job de tests.

No compila (`npm run build`) porque ninguna mutación declarada hoy toca un guard que importe de
`dist/`. El día que una lo haga, **se enterará por el rojo y no por sorpresa**: ese guard saldría
CIEGO, no verde.

---

## ② LA MITAD DE LA REGEX — y era la mayor

| forma | sitios |
|---|---:|
| ① `<fuente>.includes('<identificador>')` | **24** |
| ② `/<literal>/.test(<fuente>)` ← **FASE B** | **51** |
| **total** | **75**, en **52** ficheros |

Población: **650** ficheros de test.

🔴 **La mitad que faltaba era el doble que la medida.** De haber dado la fase A por completa, **dos
tercios de la superficie habrían quedado fuera con el número puesto** — que es peor que no tener
número, porque un número invita a dejar de mirar.

### 🔴 El criterio NO podía ser «el patrón es un identificador»

Mi segundo trinquete mudo era `/throw new Error/.test(cuerpo)`. **Lleva espacios.** Un criterio de
«identificador» lo habría dejado escapar — y un censo que no ve el caso que lo originó no vale.

Lo que define la forma es que el patrón sea **literal puro, sin ningún metacarácter**: eso es
preguntar por texto. Una regex **con estructura** (`^\d+$`, `\bfoo\b`) está midiendo otra cosa y no
entra. Probado con ese caso exacto y con **cinco controles negativos**, incluidos una regex
estructural y una regex literal aplicada a algo que **no** es un fuente de fichero.

### ⚠️ Y se corrige la cifra de la fase A

Publiqué **29** para la forma ①. **Son 24.** La primera medición usaba un detector que además
contaba `leer(` como origen de fuente; el del test mira sólo `readFileSync`, `leerFuente` y
`soloEjecutable`. Mismo criterio en las dos formas, y el número que vale es el del test.

### El suelo mira LAS DOS RAMAS por separado

Con 51 sitios de regex, la rama `includes` podría caer a cero y **el total seguiría pareciendo
grande**. Un total sano esconde una rama muda: es la lección del censo por fichero de SCRUM-402,
aplicada al detector en vez de al corpus.

---

## Lo que sigue sin cubrir, tras la fase B

1. **Sigue habiendo UN solo guard declarando mutaciones.** Es lo caro y lo que da el valor: el
   script es media tarde, escribir cada declaración **y comprobarla** es el trabajo.
2. **La superficie fuera de `tests/`** (`scripts/`, `.claude/hooks/`) sigue sin medir.
3. **El censo sigue sin distinguir intención**: 75 no son 75 defectos. Preguntar por un nombre está
   bien cuando se afirma «aparece» y mal cuando se afirma «se usa».
4. **Quedan otras formas de preguntar por texto** que ninguna de las dos ramas cuenta —
   `indexOf(...) !== -1`, `match(...)`, `new RegExp('literal')`. No están medidas.

---
---

# APÉNDICE · SCRUM-745 (adopción) · Que ningún guard del censo pueda estar mudo sin que se vea

**Fecha:** 5-sep-2026 · **Ramificado de** `origin/main` = `28b045855d9a68f12906f218bfe78fa5e0472433`
· **entregado sobre** `origin/main` = `6fa04adc66a95509f52b3b0b38679e19c5b0baa0`

> ⚠️ **`main` se movió TRES veces mientras duraba esta tarea, y dos de ellas cambiaron el censo.**
> `78ca15a3` trajo SCRUM-751 con dos declaraciones propias y con `invoicesView.js`, que es donde
> ancla `scrum748`. `4e9e2739` trajo SCRUM-606 y SCRUM-750 con cuatro más y con
> `tests/_banco-vistas.mjs`, del que dependen los cuatro guards del nivel superior que aquí se
> declaran. `6fa04adc` trajo sólo documentos. **Se mezcló las tres veces y se volvió a medir entero
> las tres veces:** los números de esta entrada son los del árbol que se entrega, no los del que se
> empezó. Es el motivo de que la primera ancla que escribí naciera caduca a media entrada.

El hueco nº 1 de la fase B decía: *«Sigue habiendo UN solo guard declarando mutaciones»*. Se cierra
aquí, junto con los tres que dejó abiertos SCRUM-748.

> **Y la pregunta que el encargo dejaba abierta, contestada:** ninguno de los cuatro salió CIEGO al
> declararlo. Los cuatro salen **VIVOS**, o sea que **no hay ningún fichero que muera antes de
> registrar sus tests** entre los del nivel superior — con `dist/` compilado, que es lo que el job
> hace desde SCRUM-748. La ceguera de aquel día era del rótulo, no del árbol.

## 0 · El censo, antes y después

| | antes | este trabajo | en lo entregado |
|---|---:|---:|---:|
| guards que declaran | 3 | **8** | **10** |
| mutaciones declaradas | 6 | **18** | **24** |
| ejecuciones del job (línea base + mutación) | 9 | 26 | **34** |

Las doce que pone este trabajo: `scrum443` (2), `scrum641` (2), `scrum738` (2), `scrum739` (2),
`scrum743` (2) y dos más del propio `scrum745`. **La tercera columna no es mía:** los merges de la
tarde trajeron `scrum751`, `scrum606` y `scrum750`, y los tres **ya nacieron declarando**. Que el
mecanismo se adopte solo, sin que nadie vaya detrás, era el objetivo entero.

**Ninguna se ha escrito sin comprobarla:** las 24 salen `✔` en el control A, o sea que las 24 se
han aplicado, han puesto rojo al test que nombran, se han revertido, y el fichero ha vuelto byte a
byte (`sha256sum -c` sobre los nueve sujetos, después de cada pasada).

## 1 · ⛔ LO QUE NO SE PUEDE MUTAR: EL `.ts` QUE EL GUARD LEE DESDE `dist/`

`scrum739` y `scrum743` comparan cifras del front contra el backend, y el backend lo importan de
`dist/`. **El meta-guard no compila entre la mutación y la pasada**, así que mutar
`src/core/utils/utils.ts` no movería `dist/` y el guard saldría **MUDO sin estar mudo** — la
acusación falsa que SCRUM-748 vino a quitar, reintroducida por la puerta de atrás.

Las dos declaraciones se anclan por eso en lo que el guard lee **de verdad**: el `api.js` que carga
el banco de vistas en vivo, y el fuente de la vista. Queda escrito en los dos ficheros.

## 2 · 🔴 EL HALLAZGO, y me lo hice yo: **una declaración coja desaparece en silencio**

Editando `scrum739` perdí la línea `fichero:` de una declaración **ya escrita y ya comprobada**.
`mutacionesDeclaradas` la descartó con un `continue` mudo, el censo bajó de 17 a 16 y
`meta:mutaciones` **siguió verde**. La mutación había dejado de ejecutarse y **nada lo dijo**.

Es literalmente *«media declaración es peor que ninguna: parece cobertura»* —la frase con la que
nació este mecanismo— cometida **dentro del mecanismo**. Y no lo cazó ninguna revisión: lo vi
leyendo el fichero por otra cosa.

**Cerrado, y DERIVADO en vez de duplicado** (el escalón): `mutacionesDeclaradas` pasa a derivarse de
`lecturaDeDeclaraciones`, que devuelve las buenas **y las cojas con el campo que les falta**. Una
coja ya no es «una menos»: es **CIEGO** con nombre y motivo, y el job sale con su código 2.

## 3 · ③ EL VIGILANTE Y SU CONTROL YA NO CUELGAN DEL MISMO CLAVO

`paso()` y `cayo()` leían los dos el reporter `spec`. Cambiar `--test-reporter` los cegaba **a los
dos a la vez**: el defecto de SCRUM-742 dentro de la herramienta que lo persigue.

**Primero se midió el escalón, que es lo que manda:**

| escalón | ¿disponible? | medido |
|---|---|---|
| ① hacerlo **imposible** | **SÍ** | `run()` de `node:test` entrega eventos `test:pass`/`test:fail` con el nombre dentro. Sin reporter no hay reporter que cambiar. |
| ② **derivar** de algo que exista | no | Barrido de `scripts/` y `tests/_*.mjs`: **no existe ningún parser de salida del runner en la casa**. El único era éste. |
| ③ duplicar con guard | — | habría sido vigilar la constante del reporter: justo el escalón que se evita. |

Se hizo el ①. Y **se provocó el caso que decide antes de escribirlo** (regla 13): un fichero que
muere al cargar emite **exactamente un** `test:fail` cuyo `name` es la **ruta del fichero**, jamás
el nombre de un test. Los dos lectores dicen NO — que es la conjunción de la que SCRUM-748 hizo
nacer el CIEGO. La discriminación no sólo sobrevive: pasa de casar **texto** a casar **dato**.

Un trinquete nuevo (*«los dos lectores NO cuelgan de ningún reporter»*) impide volver atrás, y lleva
su propia mutación declarada: si el reporter reaparece en el código, cae.

## 4 · Los tres controles, medidos hoy con el lector nuevo

Los tres, **repetidos sobre el árbol que se entrega** (censo de 24), no sobre el que se midió antes
de los merges:

| control | resultado | salida |
|---|---|---:|
| **A** · árbol como está | `vivas 24 · mudas 0 · ciegas 0` | 0 |
| **B** · `dist/` apartado | `vivas 14 · mudas 0 · ciegas 10` — **ninguna acusación falsa** | 2 |
| **C** · un MUDO real inyectado en `scrum738` | `vivas 23 · mudas 1 · ciegas 0`, nombrando guard **y** test | 1 |

Las diez CIEGAS del control B son exactamente los cinco guards que cargan el banco de vistas en el
nivel superior, dos declaraciones cada uno. **Cero MUDAS es el dato**: sin `dist/` el instrumento
deja de poder medir y lo DICE, en vez de acusar.

**El C sigue siendo el que decide:** si al cambiar el lector todo se hubiera vuelto CIEGO, el
instrumento habría dejado de acusar y el arreglo sería peor que el defecto.

## 5 · ⚠️ EL RELOJ DE ESTA MÁQUINA NO SEPARA LAS DOS IMPLEMENTACIONES

Llegué a dar por bueno «`run()` es 2,6× más lento» tras una pasada de cada. **Era ruido, no un
dato.** Con muestras pareadas y alternadas sobre el MISMO árbol y las mismas 17 declaraciones:

| | pasadas (s) | mediana |
|---|---|---:|
| `run()` | 136 · 58 · 68 | **68 s** |
| `spawnSync` | 53 · 65 · 154 | **65 s** |

La dispersión **dentro** de una implementación (53 → 154 s) es mayor que la diferencia **entre**
ellas. Conclusión honesta: **NO MEDIBLE en esta máquina**, que no es «cuestan lo mismo». Es la
lección de SCRUM-520/671/673 —el reloj de pared no es un instrumento aquí— aplicada a mi propia
decisión, y por poco no la aplico.

**La unidad estable es la EJECUCIÓN, no el segundo:** el job pasó de 9 a 34 ejecuciones. La línea
base es 10 de esas 34 (29 %); antes era 3 de 9 (33 %). **La línea base no ha encarecido nada en
proporción — ha bajado**, porque los guards nuevos declaran de media más de una mutación cada uno y
la pasada limpia se comparte entre todas las suyas. Ésa es la contestación al encargo —«si el job se
pone lento, mide cuánto»—: en ejecuciones, ×3,8; en segundos, **no medible en esta máquina**.

## Lo que NO cubre

1. **Sigue sin haber suelo sobre el NÚMERO de declaraciones.** Una coja ya se denuncia; un
   `MUTACIONES_QUE_ME_TUMBAN` **borrado entero** de un fichero no lo vería nadie: ese guard
   simplemente deja de estar en el censo, y el censo no sabe cuántos debería tener.
2. **El coste real en el runner sigue sin medir.** Los números de arriba son de esta máquina, y
   esta máquina ya ha demostrado que no separa 65 de 136 s.
3. **La superficie fuera de `tests/`** (`scripts/`, `.claude/hooks/`) sigue sin declarar nada.
4. **Los ficheros que llaman a `cargarDashboard` DENTRO de un test** no se han tocado: pierden un
   test y no el fichero, así que no producían la confusión de SCRUM-748. Ninguno declara.

## HALLAZGOS FUERA DE ALCANCE — para el asesor

* ✅ **`main` estuvo ROJO unas horas, y ya no. No hace falta ticket.** Con `origin/main` en
  `28b04585`, `scrum402-marcador-no-se-pinta` fallaba **en el árbol limpio**:
  `invoicesView.js: 1 → 2` marcadores pintables. Lo atribuí apartando mis cambios con `git stash`,
  que es lo que separa «lo he roto yo» de «ya estaba». **Al mezclar `78ca15a3` pasa a verde:** lo
  cerró SCRUM-751, que subió el censo y firmó el rótulo en el mismo commit. Queda escrito porque el
  hecho —`main` en rojo durante horas— es real aunque la causa ya no exista.
* 🟠 **La puerta de entrada del meta-guard nunca casa en Windows.** Compara `import.meta.url`
  (`file:///C:/…`) contra `file://` + `process.argv[1]` (`file://C:\…`): **siempre falso aquí**. El
  script sólo arranca por el respaldo `endsWith('meta-guard-mutaciones.mjs')`. Lo destapé al
  renombrar una copia para medir: salió **exit 0 en 0,88 s sin haber medido nada** — un cero
  silencioso. Si alguien renombra el script, el job pasa a verde sin ejecutar una sola mutación.
* 🟠 **El `grep` de retornos de carro es un instrumento FALSO en este Git Bash.** Devolvió
  exactamente `wc -l` en los cinco ficheros que miré —el patrón se queda vacío y casa con todas las
  líneas—. Medido con Node sobre bytes, el árbol es **LF puro, CR = 0**. Cualquier censo de CR hecho
  así publica un 100 % de falsos positivos.

## Ficheros

* `scripts/meta-guard-mutaciones.mjs` — `run()` en vez de reporter; `lecturaDeDeclaraciones` y la
  denuncia de la declaración coja.
* `tests/scrum443-…`, `scrum641-…`, `scrum738-…`, `scrum739-…`, `scrum743-…` — **+2 mutaciones
  declaradas cada uno**, todas comprobadas.
* `tests/scrum745-comparar-por-identidad.test.mjs` — fixtures estructuradas, el trinquete del
  reporter, el de la declaración coja, y **+2 mutaciones propias** (4 en total).
