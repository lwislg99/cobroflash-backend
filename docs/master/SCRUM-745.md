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
