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
