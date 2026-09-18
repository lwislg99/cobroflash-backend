# SCRUM-933 · El caso que mata la segunda mutación de `scrum864c`

**Medido contra:** `origin/main` = `41bad7c83d84ba2cddcf267480bbd7bcd9bc0b2c` · 2026-09-18T08:29:26+00:00

*(Las pasadas de mutación van de 08:20 a 08:35Z; la hora del ancla es la de la última tanda de bancos.)*

**Rama:** `scrum-933-el-caso-de-la-segunda-mutacion`

> ⛔ **No se ha quitado ninguna mutación de la lista.** Las dos siguen declaradas, con su `de` y su
> `a` byte a byte como estaban. Una mutación que sobrevive es información: decía qué parte del
> censo no estaba vigilada, y lo que se ha hecho es vigilarla.
> ⛔ `scripts/_censo-mkdtemp.mjs` intacto: sha256 `54093b3b…6c86d` antes y después de cada pasada.
> ⛔ `src/` intacto · sin estado ni flag nuevos (27) · sin dependencias (36).
> ⛔ Los dos ficheros pendientes de Javier (`docs/master/evidencias/scrum864/censo.json` y
> `salida-censo.txt`) siguen fuera del commit.

---

## 1 · PASO 0 · la muda estaba viva hoy

Antes de escribir nada, con `scrum864c` tal como estaba en `main`:

| pasada | ① | ② | ③ | código de salida |
|---|---|---|---|---|
| sin mutar | ✔ | ✔ | ✔ | **0** |
| mutación 1 (`finally` deja de reconocerse) | ✖ | ✔ | ✖ | **1** |
| 🔴 mutación 2 (`return false` → `return true`) | ✔ | ✔ | ✔ | **0** |

La segunda declaraba que la tumbaba el test ①, y con ella puesta ① seguía verde.

## 2 · Por qué sobrevivía · ninguno de los tres tests podía verla

El censo empareja cada temporal con sus borrados **por el nombre de la variable**:

```js
const suyos = borrados.filter((b) => {
  if (!b.ids.has(d.nombre)) return false;   // ← la mutación 2 lo pone a `true`
  return d.dentro ? b.porDirname : true;
});
```

Con `true`, **cualquier** `rmSync` del fichero cuenta como limpieza de **cualquier** temporal.

- **① no puede verla:** en sus nueve casos el único `rmSync` borra justo la variable del temporal.
  Así que «sólo vale mi borrado» y «cualquier borrado vale» le dan la misma respuesta.
- **③ no puede verla:** la mutación sólo mueve llamadas HACIA `GARANTIZADA`. Quita acusaciones y
  no añade ninguna, y sobre un árbol que ya está en cero no hay ninguna que quitar.
- **② tampoco:** sigue viendo al menos una `GARANTIZADA`.

Y es la dirección peligrosa: un fichero que **no borra su temporal** pero borra otra cosa en un
`finally` saldría `GARANTIZADA`. El guard daría por buena una fuga.

## 3 · El caso nuevo · ①b «el borrado de otro no es el mío»

Un test propio, no tres casos más dentro de ①, como anticipaba la pista del encargo: un test que
muere con una mutación no tiene por qué morir con otra. Son cuatro fuentes fabricadas que sólo se
diferencian en **qué variable** borra el `finally`:

| forma | espera | con la mutación 2 |
|---|---|---|
| **CONTROL:** el `finally` borra MI variable | `GARANTIZADA` | `GARANTIZADA` (no se mueve) |
| el `finally` borra OTRA variable; la mía, nunca | `SIN_LIMPIEZA` | 🔴 `GARANTIZADA` |
| la mía, por el camino feliz; el `finally` es de otra | `NO_GARANTIZADA` | 🔴 `GARANTIZADA` |
| ruta DE DENTRO; el `finally` sube con `dirname`… desde otra | `SIN_LIMPIEZA` | 🔴 `GARANTIZADA` |

El control está para que un `SIN_LIMPIEZA` de abajo no pueda salir de un censo que ha dejado de
reconocer el `finally` en esta forma.

## 4 · El `cae` de la mutación 2 cambia, y por qué no es aflojar el guard

`cae` es el test que el meta-guard **exige** ver en rojo. Nombraba ①, que no caía, así que la
declaración afirmaba algo falso. Ahora nombra ①b, el test que sí cae. `de` y `a` no se han tocado,
y la mutación 1 tampoco.

## 5 · Los controles, EJECUTADOS

Dos sondas **independientes** en `docs/master/evidencias/scrum933/`:

- `mutar-y-correr.mjs` aplica la mutación y corre el guard con `node --test` a pelo. No comparte
  código con el meta-guard.
- `veredicto-del-meta-guard.mjs` usa las funciones exportadas del meta-guard (`lecturaDeDeclaraciones`,
  `correr`, `aplicarUna`) sobre este guard solo. Es la única de las dos que comprueba que el `cae`
  case con el título del test.

**🔴 EL QUE DECIDE, en los dos sentidos:**

| pasada | ① | ①b | ② | ③ | salida |
|---|---|---|---|---|---|
| sin mutar | ✔ | ✔ | ✔ | ✔ | **0** · 4/4 |
| mutación 2 | ✔ | ✖ | ✔ | ✔ | **1** |

En la mutación 2 se dan la vuelta exactamente los tres casos de «otra variable», y el control no
se mueve.

**✅ POSITIVO · la mutación 1 sigue muriendo en ①**, con el mismo detalle que antes: los dos casos
con `finally` pasan a `NO_GARANTIZADA`. Arrastra además a ①b (sólo su control) y a ③. No se ha
movido el juicio: ① sigue siendo el que la caza.

**⚠️ LA MUTACIÓN ENTRÓ:** en las dos, el ancla aparece 1 vez antes, 0 después, y el sustituto 1. El
sha256 del fichero mutado es distinto: `d6e54d28…` (1) y `64003f48…` (2).

**⚠️ RESTAURADO POR SHA-256** tras cada pasada: `54093b3b…6c86d`, igual.
`scripts/_censo-mkdtemp.mjs` es `.mjs` y no se compila a `dist/`, así que no hacía falta compilar
antes de mutar (A6): el guard lo importa directamente.

**Veredicto del meta-guard sobre este guard:**

```
LÍNEA BASE · pasados 4 · caídos 0 · saltados 0 · movidos 0
· mutación 1 · ✔ VIVA · colaterales 2 (①b y ③)
· mutación 2 · ✔ VIVA · colaterales 0
vivas 2 · mudas 0 · ciegas 0  (sobre 2 declaradas en scrum864c-el-temporal-no-vuelve.test.mjs)
piezas restauradas por sha256: 1 de 1 ✔
```

La mutación 2 muere **sin colaterales**: ①b es exactamente el test que la cubre, y nada más la ve.

## 6 · Lo que esto NO dice

- **No he corrido `npm run meta:mutaciones` entero.** No deja elegir guard, y en CI tardó 7m47s. El
  recuento global que citaba el encargo («`vivas 249 · mudas 1`») no lo he medido yo, ni antes ni
  después. Lo que sí está medido es el veredicto de sus propias funciones sobre `scrum864c`.
- **No he mirado las declaraciones de otros guards.** Que dos mutaciones compartan `cae` no es un
  defecto por sí solo; lo que importa es si mueren, y eso lo mide el meta-guard.

## 7 · Errores propios

1. **La muda la metí yo.** Las dos declaraciones nacieron juntas en `8db2059e` (SCRUM-864c,
   17-sep-2026 19:22 +01:00), con el mismo `cae`. El registro de SCRUM-864 no las menciona: no
   consta que la segunda se viera caer nunca. La cazó el meta-guard, no yo.
2. **Hoy, en el primer banco**, construí la ruta del log con `new URL(import.meta.url).pathname`, que
   no decodifica `%7E`: ENOENT en las tres pasadas. Es el defecto que ya anota SCRUM-730. La
   restauración funcionó igual (sha256 idéntico las tres veces); repetí con `fileURLToPath`.
3. **Copié una cifra sin medirla.** Escribí en el comentario de ①b el `vivas 249 · mudas 1` del
   encargo, como si fuera mío. Lo quité antes de commitear.
4. Imprimí `ocurrenciasDelAncla(…)` suponiendo que devolvía un número, y salió `[object Object]`.
   El recuento de «exactamente 1» es de la otra sonda, que sí lo cuenta.
5. **Escribí el ancla de esta entrada con un formato inventado** («**Medido:** …, contra …») en vez
   del fijo `**Medido contra:**`, y lancé la tanda completa sin pasar antes `npm run guards:entrada`,
   que lo habría dicho en segundos. La tanda cayó con 9 rojos de SCRUM-267 contra este fichero; se
   corrigió el ancla, no el guard.

## 8 · Ficheros

| fichero | qué |
|---|---|
| `tests/scrum864c-el-temporal-no-vuelve.test.mjs` | el test ①b y el `cae` de la mutación 2 |
| `docs/master/evidencias/scrum933/mutar-y-correr.mjs` | la sonda independiente |
| `docs/master/evidencias/scrum933/veredicto-del-meta-guard.mjs` | el veredicto con las piezas del meta-guard |
| `docs/master/SCRUM-933.md` | esto |
