# SCRUM-494 · El guard deja de aconsejar DECLARAR lo que hay que DES-EXPORTAR

**Medido contra:** `origin/main` = `d09d48632f24593988db767a9dfb3972bde9981e` · 2026-08-12T12:02:13+01:00
**Fecha:** 12-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Cero exports retirados.** Este ticket mide y aconseja bien; retirarlos es otra pasada.

---

## 0 · Paso 0

| | |
|---|---|
| `main` antes / después del fetch | `bf549141…` → `e6313edf775fdbf97661d7a223e6d6b1f9b19e6d` |
| `main` al cerrar, tras mezclarlo dentro | `d09d48632f24593988db767a9dfb3972bde9981e` |

* `EXPORTADO_SOLO_PARA_EL_TEST` **no existía en ninguna ref** (`git log --all -S`, tras refrescar
  todas las remotas con `git fetch origin "+refs/heads/*:refs/remotes/origin/*"` — `git grep
  --remotes` no existe en esta máquina).
* Rama relacionada: `scrum-441-metodo-en-invoice`, último commit **`f6658357`, Luis,
  2026-08-12 11:51:13 +0100** («Merge de main antes de declarar verde»).

### 🔴 La premisa (d): el número, medido ANTES de construir nada

**De los 160 con uso interno, 124 tienen como único importador externo un fichero de `tests/`.**
No es cero, así que el ticket se sostiene.

> **Contado así:** importadores por AST (`ImportDeclaration` **más** el destructuring de
> `await import()`) sobre `src/` + `tests/`, excluyendo su propio módulo. «Uso interno» = alguna
> declaración de nivel superior del fichero lo referencia, vía `grafoInterno`. Sin una sola lista a
> mano ni heurística de nombres.

Al cerrar, tras mezclar `main`: **191 declarados** (SCRUM-488 cableó uno), grupos
**159 / 19 / 9 / 4 = 191** ✔, y **los que sobran siguen siendo 124**.

---

## 1 · Son DOS ejes, y éste es el segundo

| | Eje | Cómo se decide |
|---|---|---|
| ① | **por qué existe** — `_huerfanos-declarados.mjs` | categorías declaradas **a mano**: es un juicio |
| ② | **¿sobra el `export`?** — `_export-que-sobra.mjs` | **se mide, no se juzga** |

Colgar la sub-categoría del eje ① fue el error del intento anterior: con el orden decidido,
`metodoDeclarado` no habría caído en ella. **Una categoría puede estar bien nombrada y colgar del
sitio equivocado del árbol.**

## 2 · 🔴 El orden de las preguntas vive como DATO

**CANON:** en una taxonomía, lo que cumple dos criterios cae **en la primera que se pregunte**. Por
eso `ORDEN_DE_PREGUNTAS` es un array con el `porQue` de cada pregunta, y no una escalera de `if`:
un orden que solo existe en el flujo de control es un orden que el siguiente refactor cambia sin
enterarse.

| # | Pregunta | Por qué va ahí |
|---|---|---|
| 1 | ¿lo importa algo que **no** es un test? | cierra el caso: el `export` hace falta |
| 2 | ¿lo usa **su propio módulo**? | 🔴 va **antes** que la del test (decisión de los fundadores): el uso interno es la explicación más fuerte, y preguntarlo después mandaría a la casilla equivocada todo lo que es las dos cosas |
| 3 | ¿lo único que entra de fuera es un test? | sin uso interno suele ser un **motor esperando cable** |
| 4 | ni lo usa su módulo ni lo importa nadie | el porqué es del eje ①, no de éste |

**Y se prueba que el orden manda:** hay una autoprueba que invierte las preguntas 2 y 3 sobre el
mismo caso sintético y comprueba que la clasificación **cambia** (`USO_INTERNO` → `SOLO_SU_TEST`).
Si no cambiara, el orden sería decorativo.

## 3 · La sub-categoría

```
EXPORTADO_SOLO_PARA_EL_TEST  (cuelga de USO_INTERNO, y solo de ahí)

  el `export` sobra cuando el símbolo YA SE USA DENTRO de su módulo
  Y lo único que entra de fuera es su test.
```

Ahí el `export` no le sirve a ningún consumidor: **el consumidor real está dentro.** Ésa era
exactamente la forma de `metodoDeclarado`.

## 4 · 🔴 El consejo — y no se queda en «quítale el `export`»

Un consejo que manda des-exportar **sin decir cómo se sigue probando** manda a la siguiente persona
a un callejón: lo quita, el test deja de compilar, y lo vuelve a poner. El guard habrá gastado un
rojo para nada.

> **El patrón que lo hace posible ya existe en la casa y no estaba en ninguna guía.**
> `tests/scrum441-metodo-declarado.test.mjs` lo declara en su cabecera: **mide por la SUPERFICIE
> PÚBLICA**. Se prueba el export que sí tiene consumidor, y el símbolo de dentro queda cubierto por
> él. Eso es lo que permitió des-exportar `metodoDeclarado` sin dejar a su test sin objeto.

Lo escribió quien resolvió aquel caso; aquí queda **en el sitio donde alguien lo va a leer**: dentro
del mensaje del guard.

Y el consejo **contrario** también se dice: para un motor esperando cable el mensaje **avisa de que
NO hay que des-exportarlo**. Sin ese aviso, quien acaba de leer el otro consejo cierra una puerta
declarada.

## 5 · Verificación

| | Qué | |
|---|---|---|
| 🔴 **AUTOPRUEBA** | fuente sintética con los cuatro casos: sobra · producción · motor en espera · nadie | ✅ |
| 🔴 **AUTOPRUEBA DEL ORDEN** | invertir las preguntas **cambia** la clasificación | ✅ |
| 🔴 **SUELO** | cero casos → **falla declarándose ciego**, no pasa en verde | ✅ |
| **CONTROL NEGATIVO** | `avanzar` **no** cae — está declarado en `SCRUM-475.md` §6 como motor a la espera de su webhook | ✅ |
| **CONTROL POSITIVO** | ningún export con importador de producción cae (rompería el build) | ✅ |
| **Los grupos SUMAN** | 159 + 19 + 9 + 4 = 191 | ✅ |
| **Nunca un solo instrumento** | ① índice de importadores por AST · ② grafo interno del fichero · ③ el censo de huérfanos ya existente | ✅ |

### Los rojos por el mecanismo, probados

| Mutación | Cae diciendo |
|---|---|
| el consejo vuelve al viejo | *«EL GUARD ESTÁ MANDANDO DECLARAR ALGO CUYO `export` SOBRA … el registro deja de señalar lo que importa»*, con el consejo textual que dio |
| se quita el patrón de la superficie pública | *«manda quitar el `export` y no dice cómo se sigue probando … lo quita, el test deja de compilar, y lo vuelve a poner»* |

**Suite:** línea base **3.401 · 3.324 pasan · 0 fallos · 77 saltados**, medida aparte apartando el
fichero nuevo del glob (no se borró nada del disco). `guards:entrada` en verde.

## 6 · Huecos declarados

* **No se retira ni un `export`.** Va con la regla de la **intersección** que acordaron los
  fundadores: un símbolo solo se toca si **los dos** instrumentos de alcance coinciden.
* **El censo cubre los huérfanos declarados, no todo `src/`.** Un export con uso interno y solo su
  test que **no** sea huérfano no entra en el número — el guard sí lo clasifica cuando lo caza,
  porque el clasificador funciona export por export.
* **«Su test» se mide como «cualquier fichero bajo `tests/`».** Exigir que el nombre del test
  corresponda al del módulo sería una heurística de nombres, y el encargo la prohíbe con razón.
* **Los 19 de ② y los 9 de ③ no se tocan**, y su consejo sigue siendo declarar.
* **El eje ① sigue siendo un juicio.** Esto no lo mecaniza ni lo pretende.

## 7 · Lo que NO se ha tocado

`tests/_alcance-dominio.mjs` ni ningún fichero del carril ajeno · el criterio de **detección** del
guard (funciona: cazó `metodoDeclarado` minutos después de nacer) · los 19 de ② y los 9 de ③ ·
`prisma/schema.prisma` · ninguna dependencia nueva.

## 8 · Ficheros

* `tests/_export-que-sobra.mjs` (nuevo) — el eje ②, el orden como dato, el consejo y su autoprueba.
* `tests/scrum494-export-que-sobra.test.mjs` (nuevo) — 12 tests.
* `tests/scrum411-exports-inalcanzables.test.mjs` — el mensaje del trinquete pasa a dar **un consejo
  por export**; la detección no se toca.
* `docs/master/SCRUM-494.md` — esta entrada.
