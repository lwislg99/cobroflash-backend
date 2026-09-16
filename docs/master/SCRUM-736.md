# SCRUM-736 · Los suelos de la tanda envejecían solos, y el aviso era un `console.log`

**Medido contra:** `origin/main` = `713a29b738966ecb524a25fffbb842e9f3d09a52` · 2026-09-16T05:57:02+01:00

**Carril:** instrumentos · suelos · **Gate:** sin gate — corre en `npm test`, y el CLI en CI

**Tanda:** 6916 tests · 6806 pass · **0 fail** · 110 skipped (todos gateados por entorno y con su
motivo declarado) · **exit 0** · `guards:entrada` 26/26.

⚠️ El código de salida se lee **del fichero donde se escribió**, no de la línea «exited with code»
de la tarea de fondo: ésa es la del último eslabón de la cadena. Pasó hoy en esta misma rama — la
notificación decía 0 y la tanda había salido **1** con tres rojos. Es la familia de SCRUM-850.

---

## PASO 0 · el defecto está VIVO, y se comprueba corriendo

Sobre el **TAP real** de la tanda del 16-sep-2026 (`# tests 6903`), bajando el total en 441 tests y pasándolo
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
día         sha       tests   delta        día         sha       tests   delta
2026-08-17  71d63575   3595                2026-09-06  7418b7fe   5617   +212
2026-08-19  946582c1   3627    +32         2026-09-07  b521d0a7   5828   +211
2026-08-20  3f79d048   3847   +220         2026-09-08  0269e8cd   6191   +363
2026-08-24  adb8a9df   3935    +88         2026-09-09  07ccd16c   6358   +167
2026-09-01  f67d9449   4081   +146         2026-09-15  1f18293e   6729   +371
2026-09-02  b1ae3fd9   4728   +647         2026-09-16  026677a1   6756    +27
2026-09-03  eb5774af   4898   +170
2026-09-04  8e590fc2   5293   +395         14 pasos · suben 14 · BAJAN 0
2026-09-05  590e019d   5405   +112         media +226/día · pico +647
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

### 🟢 Y se vio funcionar solo, en la misma vuelta

Entre la primera medición y el merge de `main`, el árbol pasó de declarar 6756 tests a 6769. El
suelo efectivo subió **de 6554 a 6566 sin que nadie tocara un número**:

```
antes del merge:  ✅ suelo 6554 · total actual 6903 · margen 349 · derivado
tras mezclar main: ✅ suelo 6566 · total actual 6910 · margen 344 · derivado
```

Eso es exactamente lo que el número a mano no podía hacer, y lo que llevaba ocho días pidiéndole a
quien leyera el log.

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

### 🔴 Dos errores míos en el control que decide, y el segundo era el peligroso

**① El primero, de encuadre.** Medía el hueco entre el número a mano y el derivado —315 tests— y lo
comparaba con los 441 del enunciado. Salió **rojo**, y tenía razón: ésa no es la cantidad que
importa. Lo que importa es si una pérdida de 441 **desde una tanda sana** cae, y eso se mide contra
el total corrido, no contra la distancia entre los dos suelos.

**② El segundo casi lo empujo, y era un rojo intermitente a ocho horas vista.** La corrección de ①
sacaba los tres números del árbol **vivo** y exigía que `declarados − 441` siguiera por encima del
número a mano. Tras mezclar `main` lo medí: con 6769 declarados, a esa precondición le quedaban
**82 tests** de margen — **menos de media jornada** a +226/día. O sea que había arreglado un aviso
que nadie mira instalando un guard que se pondría rojo solo antes de la mañana siguiente; y un rojo
intermitente enseña a relanzar la tanda y acaba relajado. Exactamente lo que el encargo avisaba.

Arreglado **congelando el caso en literales**, que es el escarmiento que ya dejó escrito SCRUM-775:
las cifras medidas el 16-sep-2026 (`declarados 6756`, `TAP 6903`, `suelo 6246`) no envejecen ni
dependen de lo que crezca el árbol. Y sobre el árbol vivo se asserta sólo lo que es
**permanentemente** cierto y que además se refuerza con el tiempo: que el derivado vaya por encima
del número a mano, y que un total justo por debajo del derivado caiga.

### 🔴 Tres rojos más que sacó la tanda entera, y los tres eran míos

**① SCRUM-237 · mi negación era un verde permanente.** Para probar que el camino verde ya no imprime
la tarea, había escrito un `doesNotMatch(/Subir el suelo/)`. Si esa frase desapareciera del todo del
árbol, el aserto pasaría **para siempre sin comprobar nada** — es el patrón `scrum73`. Arreglado con
su **hermano del token**: primero se comprueba que el patrón SÍ caza la frase retirada, y además el
sujeto se verifica **por contenido** (el detalle tiene que decir de dónde sale el suelo), no sólo por
ausencia.

**② SCRUM-737 · me cazó dos cifras sin ancla, el mismo guard cuya jerarquía estoy aplicando.** El
censo pasó de 81 a 83. Las dos eran mías, y se arreglaron **por escalones distintos**, que es el
punto de esa jerarquía: la del TAP se **ancló** con su fecha (④), y la que decía «el 3% son hoy 208
tests» se **reformuló para que no diga número** (②) — lo calcula el propio veredicto en cada
ejecución. ⚠️ Las otras dos cifras que ese guard lista en ficheros que toco (`_evidencia-tanda.mjs`
y el histórico de `_suelo-de-la-tanda.mjs`) **ya estaban** y no se tocan: son de otro carril
(regla 9), y el censo seguía en 81 con ellas dentro.

**③ SCRUM-533 · CRLF en dos ficheros que toca la rama.** `_evidencia-tanda.mjs` (553 líneas) y
`verificar-evidencia-tanda.mjs` (84). Guardados en LF, sin tocar `.gitattributes` — eso sería apagar
la alarma justo cuando suena por algo mío. **No hay commit de esto**: el blob ya estaba en LF y sólo
estaba sucio el disco, que es lo que `core.autocrlf` rematerializa en cada checkout en esta máquina.
Se anota porque el siguiente que toque esos dos ficheros se lo va a encontrar igual.

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
