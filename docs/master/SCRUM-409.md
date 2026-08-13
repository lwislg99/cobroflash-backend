# SCRUM-409 · Por qué un guard de fixtures dejó de leer texto — el motivo, aunque el código se tirara

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
