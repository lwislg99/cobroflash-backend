# SCRUM-409 · Los fixtures salen del merchant demo

**Fecha:** 9-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `64c19884a97d240544a203df81a67b33744c1724` · 2026-08-09T20:34:56+02:00

## El defecto

El merchant **1 es el DEMO**, y el producto se comporta distinto con él: `whatsappPolicy` corta por
`DEMO_MERCHANT_ID`, el PDF lleva marca de agua, la pasarela se desvía. Un fixture con ese id
**desactiva comprobaciones sin tocar ningún guard**, y el test sigue verde midiendo otra cosa.

## El censo, derivado

| | |
|---|---|
| ficheros de test con `merchantId: 1` | **24** (57 ocurrencias) |
| de ellos, que PRUEBAN el demo (derivado de importar `isDemoMerchant` / `DEMO_MERCHANT_ID` / `DEMO_SAFE_NUMBERS`) | **2** |
| cambiados a un id inventado | **22** (55 ocurrencias) |

⚠️ El encargo hablaba de 25 ficheros y «11 mencionan el demo». Medido: **10** contienen la palabra
«demo» y `merchantId: 1`, pero solo **2** importan su mecanismo. Los otros 8 la mencionan en prosa
— por eso la lista se deriva de los imports y no de la palabra.

⚠️ **SCRUM-407 ya estaba arreglado** por otra sesión: `scrum399-hambre-del-lote` usa hoy
`merchantId: 7`.

## 🔴 Los tres tests que rompieron — y NINGUNO era el hallazgo que buscábamos

El encargo decía: si cambiar el merchant rompe un test, ese test pasaba por la rama demo del
producto. **Rompieron tres, y los tres eran artefactos de mi sustitución.** Lo digo entero porque
un falso hallazgo aquí habría mandado a alguien a buscar un defecto que no existe:

| test | por qué rompió | veredicto |
|---|---|---|
| `scrum207-conciliacion` · «los seis cubos» | su fila 6 **ES el cubo del demo** (`huecoDemo`), y no importa nada del demo: clasifica con un mapa de merchants | **mi error**: la derivación por import no lo veía. Devuelto al id 1 y **marcado** |
| `scrum302-presupuesto-y-fotos` · multi-tenant | el merchant entra por `handle({ merchantId })`, y la **espera** seguía en 1 | **mi error**: sustitución parcial |
| `scrum312-importador-clientes` · duplicado | el merchant es un **argumento posicional** `importarClientes(1, …)`, invisible para `merchantId: 1` | **mi error**: mismo motivo |

**Cero tests pasaban por la rama demo.** El hallazgo real es sobre el método: el id del demo viaja
en más formas que `merchantId: 1`, y una sustitución mecánica desincroniza el test sin revelar
nada del producto.

## El guard

Un fixture nuevo no puede usar el id del demo, **salvo** en los ficheros derivados como pruebas de
ese comportamiento, o en una línea **marcada a la vista**:

    merchantId: 1,  // MERCHANT DEMO A PROPOSITO (SCRUM-409): <por qué>

Dos señales y no una, **porque una sola falló**: la derivación por import no veía el caso de
`scrum207`. La marca no es una allowlist muda: va pegada al sitio y dice por qué.

* **Suelo:** menos de 100 ficheros de test → falla. Y un control positivo sintético comprueba que
  el detector **ve** un `merchantId: 1` y **no** se deja engañar por uno en un comentario.
* **Se excluye a sí mismo**: nombra `DEMO_MERCHANT_ID` para poder derivar, así que se
  auto-eximiría — la trampa de auto-referencia de siempre.
* **Rojo verificado:** un fixture nuevo con el demo cae nombrando
  `scrum343-cabecera-gastos-unica.test.mjs:2` con su línea.

## Lo que NO cubre

* **Solo ve `merchantId: 1`.** Un merchant demo pasado como argumento posicional o por otra
  variable no lo detecta — es justo lo que me rompió `scrum312`, y queda como hueco declarado.
* No mira `tests/*.ts` (no hay) ni fixtures fuera de `tests/`.

---

# FASE 2 (13-ago-2026) - El detector estaba CIEGO en CRLF, y por eso paso a AST

> ADVERTENCIA: la entrada de arriba es de otra sesion (9-ago-2026) y NO se toca: esto se
> ANEXA. Casi la borro con un `cat >`. El registro se conserva ENTERO, siempre.

---

# FASE 2 (13-ago-2026) - El detector estaba CIEGO en CRLF, y por eso paso a AST

> ADVERTENCIA: la entrada de arriba es de otra sesion (9-ago-2026) y NO se toca: esto se ANEXA.
> Casi la borro con un `cat >`. El registro se conserva ENTERO, siempre.

**Medido contra:** `origin/main` = `d17e54260a953bcb19cd3382a6577d8b312f2d28` · 2026-08-13T09:40:00+02:00
**Rama:** `scrum-222-deriva-al-dia` · **Ninguna base tocada.**

> **Este documento sobrevive a su propio arreglo.** El parche que lo originó está SUPERADO por la
> versión de AST que entró en `main` el mismo día. Se escribe igual, porque **un arreglo superado se
> tira y el motivo por el que hizo falta, no.**

---

## 1 · El defecto: el guard estaba CIEGO en todo fichero con CRLF

La versión anterior leía el fichero como texto y quitaba los comentarios así:

```js
texto.split('\n').forEach((linea, i) => {
  const sinComentario = linea.replace(/\/\/.*$/, '');
```

**Con CRLF eso no quita nada.** `split('\n')` deja un `\r` al final de cada línea, y entonces
`/\/\/.*$/` **no casa**: el `.` de una expresión regular **no incluye `\r`**, y el `$` sin la bandera
`m` exige fin de cadena. El `replace` devuelve la línea intacta.

Consecuencia: su promesa —*«se mira el CÓDIGO, no los comentarios»*— **era falsa en todo checkout de
Windows**. Lo destapó `main` en rojo por `scrum508:76`, una línea que es **solo un comentario**:

```js
// 7 y no 1: el guard de SCRUM-409 lee un `merchantId: 1` como el merchant DEMO y salta.
```

El guard se cazó a sí mismo en la frase que explica su propia prohibición — la trampa de
auto-referencia, esta vez con una capa más: **el mecanismo que debía evitarla existía y no
funcionaba**, y no funcionaba solo en la mitad de los árboles.

## 2 · Por qué esto justifica dejar de leer texto

No es que la regex estuviera mal escrita: es que **quitar comentarios con una regex es un problema
que hay que resolver bien cada vez**, y falla en silencio. La versión de AST que entró en `main`
—`ts.isPropertyAssignment` / `ts.isNumericLiteral`— es **inmune por construcción**: no quita
comentarios porque **no los ve**; un comentario no es un `PropertyAssignment`. Y de paso compara el
VALOR y no el prefijo, así que `1.5` deja de contar como el merchant demo.

> Un guard de texto necesita acordarse de quitar comentarios. Uno de AST no puede olvidarse.

## 3 · Lo que SÍ se midió de la versión nueva, y sale limpio

En la versión de `main` queda un `const lineas = texto.split('\n')` (línea 77) que alimenta dos
campos del hallazgo: `texto:` y `marcada:`. La pregunta era si el `\r` los estropea. **No.**

| caso | `includes(MARCA)` |
|---|---|
| marca en medio, LF | `true` |
| marca en medio, CRLF | `true` |
| marca **al final**, LF | `true` |
| marca **al final**, CRLF | **`true`** |
| **control negativo** · línea sin marca, CRLF | `false` |

`includes` busca **subcadena y no está anclado**, así que el `\r` queda *después* de la marca y nunca
la rompe — que es justo lo contrario de un `$` en una regex. Y `trim()` se come el `\r` para `texto:`.

**Control positivo sobre datos reales:** hoy hay **3 marcas** en el árbol —`scrum207:37`,
`scrum409:21` y `scrum409:55`— **las tres en líneas CRLF y las tres reconocidas**. El defecto no
existe ahí.

## 4 · Veredicto de esta rama

`scrum409-fixtures-sin-merchant-demo` en `origin/main` limpio (`npm ci` + build): **rc=0 · 6 tests ·
6 pass · 0 fail.** El arreglo del `split(/\r?\n/)` **ya no hace falta y no entra**: el conflicto se
resuelve **quedándose con la versión de `main`**, sin forzar la mía.

⚠️ **En código NO se suma.** Un «aceptar los dos cambios» aquí habría dejado los dos detectores
corriendo a la vez y cada `merchantId` contado dos veces. Sumar es la regla de `docs/master/*.md`,
que son registro; el código se ELIGE, y se elige midiendo.

## 5 · Y el dato para el censo de ramas

**Es el duplicado nº 6 del mes: dos carriles arreglando el mismo guard el mismo día sin saberlo.**
Ninguno de los dos podía verlo — no hay nada que avise de que otra rama toca tu fichero. Este caso es
el **argumento nº 1** del censo de ramas pendiente: el coste no es el trabajo tirado (una línea),
es que **los dos arreglos eran correctos y solo uno podía entrar**.
