# SCRUM-843 · un ancla que no caduca — el guard que se quedaba ciego al mergearse el ticket que lo justificaba

**Medido contra:** `origin/main` = `5c35a66d5752bf4f28c5dca340379c68c860757e` · 2026-09-09T17:36:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-843-un-ancla-que-no-caduca`
**Carril:** front / instrumentos · guards de navegador
**Re-medido al cerrar:** 15-sep-2026 11:16 · `origin/main` = `0e85fe33b1a00b0f9a0b874cc30622faa4c3ca4d`
— el ancla que caduca **seguía intacta** en main (`scripts/guard-lista-trabajos.mjs:369-375`) y
nadie había tocado el fichero desde el 9-sep. El defecto no se arregló solo, y el ticket sigue
teniendo víctima: se comprueba antes de cerrar, no se supone.

## La víctima

**Todas las sesiones a la vez.** El job «guards de navegador» de CI corre en cada PR contra main y
también en cada push a main. `guard:lista-trabajos` se declaraba **CIEGO** (salida 2) y lo ponía en
rojo. Un tapón común, de la familia de SCRUM-830.

## PASO 0 · qué está rojo en main, medido a mi hora

`origin/main` `2484eee7`, worktree limpio, los tres jobs de `ci.yml` corridos a mano:

| job | resultado |
|---|---|
| build + tests | **6.415 tests · 0 fail** ✅ |
| guards de navegador | 18 guards · 16 verdes · **2 no verdes** 🔴 |
| meta-guard | **CIEGO** 🔴 — `scrum716-ritmo-de-despliegue`: el ancla no está en `scripts/_ritmo-de-despliegue.mjs` |

Los dos no-verdes: `guard:objetivo-tactil` (salida 1) y `guard:lista-trabajos` (salida 2).

### Tres sesiones midieron tres rojos distintos, y dos no eran el mismo

La Sesión 4 vio `SCRUM-804 · el censo cuadra rama a rama` sobre `01fb6b77`. **No es reproducible
aquí**: corrí ese test **en su mismo SHA** y da 15/15. Entre `01fb6b77` y mi `2484eee7` sólo
entraron SCRUM-840 y SCRUM-842, que no tocan nada de eso. Ese test cuenta **ramas remotas**, y las
refs son de cada clon: el mío tiene `refs/remotes/origin/HEAD` y `for-each-ref` da 112 por los dos
formatos, sin discrepancia. **Su rojo es de su clon, no de main.**

## El bisect: los dos rojos de navegador entran en el MISMO commit, y no es el mío

| commit | `guard:objetivo-tactil` |
|---|---|
| `af3c50d8` — main justo antes del #1214 | **salida 0** |
| `45e30121` — merge del #1214 (SCRUM-831) | **salida 1**, dos problemas |

Y `guard:lista-trabajos` sale 2 ya en `45e30121`, que es el commit que lo trajo: **nació rojo en
main**. Mi SCRUM-832 (`a51a5947`) no añade ninguno — en main de hoy salen exactamente los mismos dos.

## 🔴 El hallazgo: no era «main está rojo». Era TODO PR rojo

Lo que lo demuestra es un control barato: corrí el guard en una rama mía que **sólo tocaba
`docs/equipo/sesion-2.md`** —ni una línea de front— y dio **salida 2, el mismo mensaje**.

El mecanismo, leído en el fuente. El guard llevaba dentro su propio **control positivo**, y estaba
bien pensado: antes de creerse los «idéntico» de las listas hermanas, exigía que **Trabajos sí
saliera distinta** del punto de partida. Si saliera igual, el comparador estaría mirando otra cosa
y esos verdes no valdrían nada.

```js
const tA = await huella(puertoMain, '/trabajos20');   // el árbol de la BASE
const tB = await huella(puerto,     '/trabajos20');   // el árbol de HOY
if (tA.sha === tB.sha) nosupe('Trabajos sale IDÉNTICA a origin/main…');
```

Ese control sólo puede cumplirse en **la rama que cambia esa lista, y sólo mientras no se ha
mergeado**. En cuanto SCRUM-831 entró en main:

- sobre **main**, `merge-base(HEAD, origin/main)` **es** HEAD → compara main consigo mismo;
- sobre **cualquier otra rama**, la base ya trae el cambio dentro → idéntica.

🔒 **Es un control positivo que caduca con el ÉXITO del trabajo que lo justificaba.** Es la familia
que ya conocíamos —un suelo que depende de que el defecto siga existiendo— con una vuelta de tuerca.

Y la ironía está medida: ese job corre en push a main **precisamente** para cazar «dos PR verdes
que juntos ponen main rojo» (lo dice `ci.yml` en su propio comentario). Uno de sus guards no sabía
medir en esa pasada.

## El arreglo: no se le quita el control, se le cambia de qué depende

⛔ **Regla 41 respetada: no se ha relajado nada.** El control positivo no se retira —es lo único que
impide que los «idéntico» sean un verde por no haber mirado—. Se sustituye por **dos calibraciones
que fabrica el propio guard**, y entre las dos cubren lo que cubría la vieja y algo más:

**Ⓐ ¿el comparador distingue contenidos?** Dos rutas del **mismo** servidor que pintan listas
distintas tienen que dar huellas distintas. Caza un `huella` que lea el selector equivocado, que
lea antes de pintar, o que devuelva siempre lo mismo.

**Ⓑ ¿son de verdad dos árboles?** El guard planta un **centinela** dentro de la copia temporal de la
base —un fichero que sólo existe ahí, nunca en el repositorio— y exige que el servidor de la base lo
sirva y el de hoy dé **404**. Caza el fallo que de verdad daba miedo: los dos servidores apuntando
al mismo sitio, que hace que todo salga «idéntico» sin haber comparado nada.

Ninguna de las dos deja de ser cierta al mergear nada.

Trabajos pasa a **decirse**, no a juzgarse: en la rama que la toca cambiará, en main y en las demás
no. Eso es información, no un veredicto.

### Y había una SEGUNDA copia del mismo defecto, que nadie había visto

El examen de Albaranes —«su cambio tiene que ser EL DECLARADO»— estaba **anidado dentro** del `else`
del control caducado, y exigía además `a.sha !== b.sha`: Albaranes tenía que diferir de la base.
Mismo defecto, y no se había manifestado nunca porque el primero saltaba antes.

Las dos propiedades que examina —una acción en `.cell-actions` y el Trabajo en `.cell-trabajo`— son
**absolutas**: o están en lo que se pinta hoy, o no están. No necesitan ningún diff contra git. Se
le quita esa condición y **se le añade el suelo que le faltaba**: con 0 filas, «no tiene la acción»
sería cierto por no haber pintado, que no es lo mismo.

## Los tres rojos, corridos

| inyección | qué debe pasar | qué pasó |
|---|---|---|
| `huella` devuelve una constante | Ⓐ salta | **NO SUPE MIRAR · Ⓐ**, salida 2 (y Ⓑ siguió verde: son independientes) |
| los dos servidores al MISMO árbol | Ⓑ salta | **NO SUPE MIRAR · Ⓑ**, salida 2 — y las tres hermanas decían «idéntico», que es el vacío exacto |
| Albaranes no pinta nada | suelo, **no** defecto | **NO SUPE MIRAR**, salida **2** y no 1 |

Y el verde que importa: **salida 0 en una rama que no toca Trabajos**, que es donde antes daba 2.

## El trinquete, para que no vuelva

`tests/scrum843-el-ancla-que-no-caduca.test.mjs`, 4 tests. La regla en una línea:

> 🔒 Ningún «NO SUPE MIRAR» puede dispararse porque el árbol de HOY coincida con el de la BASE.

El detector saca de dónde viene cada huella (`puertoMain` / `puerto`) y marca toda condición que
mezcle las dos y desemboque en `nosupe`. **No se prueba contra el defecto real** —está arreglado, y
un detector roto daría el mismo verde—: se le da **el código exacto que había**, escrito dentro del
test, y se le exige cazarlo. Con control negativo: comparar dos árboles **no** es, por sí solo, un
ancla; lo prohibido es declararse ciego porque coincidan. Sin esa distinción, el trinquete
empujaría a retirar el control en vez de arreglarlo — lo contrario de la regla 41.

Probado en rojo: devuelto el ancla vieja al guard → cae; restaurado → verde.

### 🔴 Y el detector me mordió a mí primero

La primera versión acotaba la condición con `[\s\S]*?`, y el `if` de una comparación **legítima**
enganchaba con el `nosupe(` de otro bloque cien líneas más abajo: acusaba de un ancla que no
existía. Se acota con `[^{}]` — una condición no lleva llaves, y el `{` de su bloque es el punto
fijo que impide saltar de un `if` al `nosupe` de otro.

## Lo que NO se toca

`guard:objetivo-tactil` es del carril de la Sesión 4 (#1214): sus dos problemas están en
`renderJobDetailView` —5 objetivos cortos donde el censo de SCRUM-787 midió 6, y la excepción
`BUTTON.btn-primary` caducada—. Reportado en SCRUM-843 y **no tocado** (regla 9).
