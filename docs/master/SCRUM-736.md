# SCRUM-736 · Los suelos de la tanda envejecían solos, y el aviso era un `console.log`

**Medido contra:** `origin/main` = `026677a1bd8260ce073648680a8eb7d7003f4b39` · 2026-09-16T05:38:33+01:00

**Carril:** instrumentos · suelos · **Gate:** sin gate — corre en `npm test`, y el CLI en CI

---

## PASO 0 · el defecto está VIVO, y se comprueba corriendo

Sobre el **TAP real** de la tanda de hoy (`# tests 6903`), bajando el total en 441 tests y pasándolo
al instrumento escrito para cazar exactamente eso:

```
con el suelo declarado (SUELO_TESTS = 6246):
    [suelo de la tanda] ✅ suelo 6246 · total actual 6462 · margen 216        exit 0
```

**Cuatrocientos cuarenta y un tests podían desaparecer y salía en verde.** Y lo único que lo
insinuaba era una línea del camino verde — `Subir el suelo a N es una línea, y lo puede hacer
cualquier sesión` — impresa en cada ejecución desde el 8-sep. Ocho días. Nadie la subió.

Con la red puesta, el mismo TAP:

```
    [suelo de la tanda] 🔴 LA TANDA ESTÁ 92 TEST(S) POR DEBAJO DEL SUELO: 6462 corridos,
    suelo 6554 (DERIVADO: el árbol declara 6756 y se exige el 97%).                exit 1
```

## ② El censo de suelos, con su población y su control

El instrumento pasa su control antes de contar: ve un suelo comparado, **absuelve** el declarado y
no comparado, y **absuelve** el que sólo aparece en un comentario (la trampa de autorreferencia de
SCRUM-693/694).

| | |
|---|---|
| `.mjs` leídos en `tests/` y `scripts/` | **1127** |
| suelos declarados a mano (constante numérica **usada en una comparación**) | **72** |
| ficheros que declaran alguno | **52** |
| · con el margen **MEDIBLE** aquí | **2** |
| · margen **NO MEDIDO** | **70** |

### El reparto de márgenes — ¿caso o patrón?

| margen | % de la población | suelo | dónde |
|---|---|---|---|
| **6257** | 90,6 % | `SUELO_TOTAL = 646` vs 6903 | `scripts/_evidencia-tanda.mjs:234` |
| **657** | 9,5 % | `SUELO_TESTS = 6246` vs 6903 | `scripts/_suelo-de-la-tanda.mjs:108` |

**Es un patrón, y la forma exacta del patrón es ésta: DOS números a mano sobre la MISMA población
—el `# tests` del TAP— que se llevan 10× entre ellos.** El de 646 estaba **dominado**: no podía
hablar nunca antes que el otro, así que una tanda con el 90 % de los tests fuera le pasaba por
debajo. Un suelo dominado no es un suelo: es una línea de código que parece una protección.

⚠️ **Los otros 70 no se cuentan como hallazgo: su margen NO está medido aquí**, y eso no es cero.
Este censo sólo sabe contar la población de los dos de la tanda. Esa familia **ya la midió
SCRUM-810b**, y su conclusión está escrita allí: casi todos son suelos de **escáner ciego** con la
holgura puesta a propósito y explicada en su propio comentario. No se reabre.

## ③ La red, y por qué no es ninguna de las dos salidas obvias

### Lo que se midió antes de elegir nada

`tests-declarados` en `origin/main`, un commit por día, con el **mismo censo** del trinquete
derivado de SCRUM-810b (`testsDeclaradosEn`, AST, SCRUM-708):

```
2026-08-17  3595        2026-09-04  5293  +395        2026-09-09  6358  +167
2026-08-19  3627  +32   2026-09-05  5405  +112        2026-09-15  6729  +371
2026-08-20  3847  +220  2026-09-06  5617  +212        2026-09-16  6756  +27
2026-08-24  3935  +88   2026-09-07  5828  +211
2026-09-01  4081  +146  2026-09-08  6191  +363    14 pasos · suben 14 · BAJAN 0
2026-09-02  4728  +647  2026-09-03  4898  +170    media +226/día · pico +647
```

Control: **15 valores distintos en 15 árboles** — la sonda se mueve, así que el «no baja nunca» no
es un cero de no haber mirado.

🔒 **Eso refuta las dos salidas obvias, con números y no con opinión:**

- **una banda de margen no sirve.** Al ritmo medido, un 5 % de holgura caduca en **1,5 días** y un
  25 % en **7,5**. Cualquier banda devuelve el trinquete a mano que se sube por inercia, sólo con
  más ceremonia.
- **«subirlo al número de hoy» caduca mañana**: +226 al día.

### Y por qué esto NO es «derivarlo del árbol»

El encargo lo prohíbe con razón: derivar un suelo de la población que ese suelo vigila lo borra —
coincidiría siempre consigo mismo y no podría caer nunca. **Aquí son dos poblaciones
independientes**, y por eso la comparación sí puede caer:

```
lo que el ÁRBOL DECLARA   (`test(`/`it(` por AST, SCRUM-708)  →  6756
lo que la TANDA REGISTRÓ  (`# tests` del TAP)                 →  6903
```

Una tanda a medias hunde el segundo y **no toca el primero**. Está ejercido: quitando 441 tests del
TAP, **cae**.

Y no es un patrón nuevo en la casa. Es el del bloque **④b de `_evidencia-tanda.mjs`**, que ya exige
«AL MENOS tantos ficheros como hay hoy en `tests/`» y se describe a sí mismo como **«la versión
exacta del suelo, sin número mágico»**. Lo que faltaba era aplicárselo al número de al lado.

### La decisión que sigue siendo una decisión

**Cuánta divergencia entre lo declarado y lo corrido se tolera** — `CUENTA_DEL_ARBOL_MINIMA = 0,97`.
Es una **fracción**, y por eso no envejece: crece con la suite sola.

Se elige con la relación medida delante: hoy la tanda registra **1,022×** lo que el árbol declara
(el TAP cuenta subtests y los tests que nacen dentro de un bucle, que el AST ve como una sola
llamada). 0,97 deja **5 puntos por debajo de la relación observada**: holgado para que un bucle de
más no fabrique un rojo, y suficiente para cazar que la tanda deje de dar cuenta del 3 %.

⚠️ **Y un punto es un punto:** la relación 1,022 está medida sobre **un** árbol. El suelo del guard
exige que la fracción declarada caiga en una banda creíble y, si no, lo **dice**: una relación
absurda significa que el censo por AST se ha roto, y derivar de un censo roto es peor que no derivar.

### El suelo efectivo, y qué pasa cuando no se puede medir

`sueloEfectivo()` = **el mayor** entre el número declarado y el derivado. El orden importa: el
declarado es un mínimo histórico que no baja, y el derivado se mantiene solo. Si el censo por AST no
se puede hacer, rige el declarado **y el título lo dice** — que es distinto de callarse y seguir con
un número rancio. Probado con `null`, `undefined`, `0`, `-1`, `NaN` y una cadena: el suelo **no se
mueve** y `medible` sale `false`.

## Los tres controles

| control | resultado |
|---|---|
| 🔴 **EL QUE DECIDE** | perder 441 tests: **pasa en verde** con el número a mano y **cae** con la red, con `salida = 1` (lo que bloquea en CI) y nombrando los tests que el árbol declara |
| ✅ **POSITIVO** | la tanda sana pasa, y también una rama que añade 200 y otra que añade **647** (el mayor salto medido en un día); el borde exacto pasa — el suelo es un mínimo, no un «más que» |
| 🔴 **MUTACIÓN** | devolver el margen al número declarado: **1 rojo**, y es el control que decide. Verificada **en disco** antes de creerse el resultado, restaurada byte a byte |

**SUELO:** menos de 3000 tests declarados → CIEGO. Y la fracción fuera de (0,5 · 1) → CIEGO, porque
por debajo no vigila nada y en 1 exacto cualquier bucle fabrica un rojo.

### 🔴 Un error de encuadre mío, cazado por mi propio control

La primera versión del control que decide medía el hueco entre el número a mano y el derivado —315
tests— y lo comparaba con los 441 del enunciado. Salió **rojo**, y tenía razón: **ésa no es la
cantidad que importa.** Lo que importa es si una pérdida de 441 **desde una tanda sana** cae, y eso
se mide contra el total corrido, no contra la distancia entre los dos suelos. Rehecho usando
`declarados` como **cota inferior** del total sano —SCRUM-702 midió que ningún fichero condiciona el
registro de un test al entorno, y hoy son 6903 contra 6756—, con las dos precondiciones asertadas:
que la pérdida siga quedando **por encima** del número a mano (o el defecto ya no se reproduce) y
**por debajo** del derivado (o la red no llega). Si alguna deja de cumplirse, el control lo dice en
vez de seguir afirmando.

### Lo que NO se tocó

- **Ningún tope subido.** `SUELO_TESTS` se queda en 6246 y `SUELO_TOTAL` en 646: la red no los
  mueve, los **domina** cuando el árbol pide más. No hay nada que mantener a mano.
- **No se relajó ningún guard** (regla 41). `scrum672` exige las tres cifras seguidas en el título
  (`suelo N · total actual N · margen N`) porque su promesa es que un suelo rancio se VEA: la
  procedencia se añadió **detrás**, sin mover lo que ese guard vigila.
- **`src/` intacto** · cero dependencias (36) · cero estado o flag de producto (27).
- Los 70 suelos de margen no medido: **se dejan**, con su motivo escrito arriba.

> ⚠️ **Nota de tanda:** `scrum736-…` importa `testsDeclaradosEn` de `tests/_poblacion-de-tests.mjs`,
> que es un **ayudante** y no registra tests, así que el total de la tanda **no sube** por eso. Los
> módulos de los que importa el veredicto (`scripts/_suelo-de-la-tanda.mjs`,
> `scripts/_evidencia-tanda.mjs`) tampoco son ficheros de test. Se dice porque ayer sí fue el caso.
