# SCRUM-763 · Restaurar el fuente no es restaurar el árbol

**Fecha:** 6-sep-2026 · **Carril:** instrumentos · **Gate:** sin gate — el guard corre en `npm test`

**Medido contra:** `origin/main` = `590e019d2dedb4a951237e37396d7b0c265bef23` · 2026-09-05T18:41:33+01:00

---

## PASO 0 — EL CONTROL QUE DECIDE, REPRODUCIDO ANTES DE TOCAR NADA

Con `src/core/utils/utils.ts` y `tests/utils.test.mjs` (puramente técnicos: ni fiscal, ni dinero,
ni flags). Cada paso con su código de salida real:

| paso | acción | resultado |
|---|---|---|
| 0 | línea base | tests **exit 0** |
| 1 | muto el `.ts` (`'&lt;'` → `'&LT;'`) | sha del fuente cambia |
| 2 | `npm run build` | **exit 0**, sha de `dist` cambia |
| 3 | tests | **exit 1** — `dist` lleva la mutación |
| 4 | **restauro SÓLO el fuente** | `Buffer.compare(fuente, ORIGINAL)` = **0** ← *«restauración verificada»* |
| 5 | 🔴 **sin recompilar, vuelvo a medir** | tests **exit 1** · `Buffer.compare(dist, ORIGINAL_dist)` = **-1** |
| 6 | control positivo: recompilo | build exit 0 · tests **exit 0** · dist compara **0** |

**El paso 4 y el paso 5 son la misma foto.** La verificación por bytes del fuente da verde sobre un
árbol que sigue mutado. No miente sobre lo que mide —el fuente **está** restaurado—: miente sobre
lo que se cree que mide. Con esa foto delante, una sesión estuvo a punto de publicar la conclusión
**contraria a la real**.

### Y la frontera muerde por el otro lado — también medido aquí

`noEmitOnError` está **desactivado** en `tsconfig.json`. Metiendo un `TS2353` a propósito:

```
build exit = 2
src/core/utils/utils.ts(275,43): error TS2353: Object literal may only specify known properties…
Buffer.compare(dist, dist_ANTES) = 1          ← tsc EMITIÓ pese al error
grep -c "__sonda763" dist/core/utils/utils.js → 2
```

**El build falla y aun así escribe `dist/`.** Un `dist/` puede reflejar un fuente que no compila, y
el único aviso es el código de salida — que es justo lo que se pierde detrás de un `| tail`.

---

## LO QUE SE HIZO

### ① El detector — `npm run frontera:dist`

[scripts/frontera-dist.mjs](scripts/frontera-dist.mjs) compara cada `.ts` de `src/` con su `.js` de
`dist/` **transpilándolo con el compilador y el `tsconfig` del propio proyecto**.

**La forma se eligió midiendo, no prediciendo** (el ticket lo pedía así):

| criterio | resultado medido |
|---|---|
| `ts.transpileModule` vs lo que emitió `tsc`, sobre los 269 `.ts` | **269 iguales byte a byte · 0 distintos** |
| coste de transpilar los 269 | **1,7 s** (~6 ms por fichero) |
| marca de tiempo | **descartada**: `touch` la engaña y un reloj hacia atrás la vuelve loca |

Es **derivado del propio build** —mismo compilador, mismas opciones— y no un segundo criterio que
pueda divergir de él. Escalón 2, no escalón 3.

### ② La restauración, en el meta-guard, cubre el árbol ejecutable

En `scripts/meta-guard-mutaciones.mjs`, cuando el fichero que la declaración muta **se compila**:

- **PUERTA 2, antes de tocar nada:** se exige que `dist/` **ya corresponda** al fuente. Si no, no se
  muta: es **CIEGO con el motivo delante**, en vez de dictar **MUDO** sobre un guard sano —
  la falsa acusación de SCRUM-748, por la otra cara.
- Al mutar, se emite también su `.js` a `dist/`.
- En el `finally` se restauran **los dos** y **se verifican los dos por bytes**. Si cualquiera de
  los dos no cuadra, sale con **código 3** gritándolo.

**Es parte del procedimiento, no una recomendación que alguien recuerde**, que es lo que pedía el
ticket.

### ③ ✅ EL CONTRASTE QUE EXIGE EL TICKET

`destinoEnDist()` devuelve `null` para todo lo que no se compila —`.mjs`, el front vanilla de
`public/`, los scripts, los `.d.ts`, un `.ts` fuera del `rootDir`— y entonces **no se compila
nada**. De las 36 declaraciones del árbol, **31 son de esa clase y no pagan ni un milisegundo**.

Si el arreglo obligara a compilar donde no hace falta, encarecería todas las mutaciones de la casa
por un caso que no aplica. No lo hace, y hay un test que lo sujeta.

---

## EL CENSO DE EXPOSICIÓN (punto 3 del ticket)

**Población: 36 declaraciones. Sobre la frontera: 5.**

| guard | fichero mutado |
|---|---|
| `scrum596-la-nota-interna-no-sale` | `src/modules/quotes/domain/presupuestoParaPdf.ts` |
| `scrum596-la-nota-interna-no-sale` | `src/modules/system/app/routes/quoteDecisionLanding.routes.ts` |
| `scrum631-la-unicidad-tiene-vigilante` | `src/index.ts` |
| `scrum631-la-unicidad-tiene-vigilante` | `src/index.ts` |
| `scrum641-nombre-cogido-sin-500` | `src/modules/products/app/routes/products.routes.ts` |

📌 **Esto CORRIGE la premisa del ticket**, que decía «hasta ahora las mutaciones documentadas han
sido sobre `.mjs`/`.js`». Tras mezclar `main`, **ya había cinco sobre TypeScript**. La exposición
no era hipotética: estaba puesta.

**Sobre el «si el censo da cero, falla declarándose ciego»:** se aplica con la regla de la casa —
*cero sobre población vacía no es un cero*. El suelo va sobre la **población** (36 declaraciones), y
el guard exige además **al menos una expuesta**, para que un futuro «0 expuestas» obligue a decirlo
a mano en vez de pasar por un cero cualquiera.

---

## LA VERIFICACIÓN QUE PIDE EL TICKET

| control | resultado |
|---|---|
| 🔴 **El que decide** — mutar `.ts`, compilar, revertir sin recompilar | bytes del fuente **VERDE (0)** · `frontera:dist` **ROJO (268/1)** · tests **exit 1** |
| ✅ **Positivo** — con la recompilación de por medio | frontera **269/269** · tests **exit 0** |
| ✅ **Positivo** — el detector con el árbol al día | **269 corresponden · 0 no · 0 sin dist**, exit 0 |
| ✅ **Rojo provocado** — un `.ts` mutado sin recompilar | **268 · 1 · 0**, exit 1, **nombrando el fichero** |
| ✅ **Contraste** — mutación sobre `.mjs` | **sin compilación**: `destinoEnDist` → `null` |
| ✅ **Meta-guard completo tras el cambio** | **vivas 36 · mudas 0 · ciegas 0** en dos pasadas idénticas, y el árbol —fuente **y** `dist`— restaurado: 269/269 |
| ✅ **PUERTA 2 provocada dentro del meta-guard** | con `dist` desajustado a propósito: **CIEGO con el motivo**, exit 2, en las dos pasadas |

### La PUERTA 2, provocada de verdad (no leída)

Se mutó `src/modules/products/app/routes/products.routes.ts` —fichero de una declaración real
(`scrum641`)—, se compiló, y se **revirtió el fuente sin recompilar**:

```
Buffer.compare(fuente, ORIGINAL) = 0   ← VERDE por bytes del fuente
Buffer.compare(dist,   ORIGINAL) = 1   ← dist DESAJUSTADO
```

El meta-guard **no mutó nada** y salió con **2**:

> `scrum641…` · `…products.routes.ts` se compila a `…products.routes.js`, y el árbol ejecutable NO
> corresponde al fuente (no-corresponde). Los tests de este guard medirían un código que no es el
> que hay escrito, así que NO se ha mutado nada. Compila (`npm run build`) y vuelve a correrme.

**Fail-closed y con la salida escrita en el propio mensaje.** Y después: fuente `0`, `dist` `0`,
frontera 269/269.

---

## TESTS

- [tests/scrum763-restaurar-el-arbol.test.mjs](tests/scrum763-restaurar-el-arbol.test.mjs)

El rojo se inyecta **en memoria** (`correspondencia()` acepta el texto del fuente), así que el guard
no escribe un byte en el árbol: un guard que muta el árbol para probarse deja abierta justo la
pregunta de este ticket.

## MUTACIONES DECLARADAS

| mutación | qué prueba |
|---|---|
| que `correspondencia` conteste siempre `'corresponde'` | el verde falso del ticket, metido dentro del instrumento que vino a cerrarlo |
| que `destinoEnDist` devuelva siempre `null` | que sin frontera desaparece el contraste, y todo volvería a medir el árbol de antes |

---

## DE PROPINA: LA HIPÓTESIS DE SCRUM-754, CONVERTIDA EN MEDICIÓN — Y **NO** REPRODUCIDA

El comentario de [SCRUM-754](https://yaqu.atlassian.net/browse/SCRUM-754) proponía que la
oscilación del meta-guard (1.ª pasada CIEGAS, las tres siguientes VIVAS) pudiera venir de un `dist/`
desincronizado, y pedía provocarlo a propósito: *«si la primera pasada da CIEGAS y las siguientes
VIVAS, está reproducido»*.

**Provocado exactamente así** (el experimento de la PUERTA 2 de arriba), con **dos pasadas
consecutivas** del trabajo completo:

| pasada | veredicto |
|---|---|
| 1.ª | `scrum641` **CIEGA** · exit 2 |
| 2.ª | `scrum641` **CIEGA** · exit 2 — **salida idéntica byte a byte** |

**NO OSCILA.** Y el motivo es mecánico y comprobable: el meta-guard **no compila nunca**, así que un
`dist/` desajustado sigue desajustado en la pasada siguiente. Nada se cura solo entre pasadas.

🔴 **Esto NO cierra SCRUM-754.** Lo que hace es descartar la hipótesis *en su forma simple*: el
desajuste por sí solo no basta. Para producir la oscilación haría falta, además, **algo que
recompile entre pasada y pasada** — y `npm test` empieza por `npm run build`, o sea que una sesión
que corriera la suite entre dos pasadas del meta-guard sí curaría el árbol sin darse cuenta. **Eso
no está medido.** El ticket sigue abierto y la dueña sigue siendo la sesión del meta-guard.

Dato lateral, en la misma dirección: con el árbol sano, dos pasadas consecutivas dieron
`vivas 36 · mudas 0 · ciegas 0` **idénticas**. Suma **once** pasadas seguidas sin oscilar
(9 anteriores + 2). Sigue siendo acumulación de pasadas buenas, que **no es una explicación**.

---

## HUECOS DECLARADOS

- ⚠️ **Este instrumento contesta «¿`dist/` corresponde al fuente?», NO «¿el fuente compila?».** Lo
  segundo sólo lo dice el exit code de `npm run build`, y está medido arriba que **tsc emite aunque
  falle**. No se ha imitado esa comprobación porque cuesta un build entero (16–32 s medidos).
- **La restauración de `dist/` del meta-guard no tiene guard propio en la suite.** Está ejercitada
  de forma continua por las **5 declaraciones sobre TypeScript** que ya existen —el trabajo completo
  las muta, emite y restaura en cada pasada— y verificada en las mediciones de hoy (`vivas 36` en
  dos pasadas, árbol 269/269 después). La **detección** (PUERTA 2) sí está provocada a mano, arriba.
  Pero un test que provoque la RESTAURACIÓN directamente exigiría fabricar un `.ts` y su `dist/`
  dentro de la suite, y **no se ha escrito**.
- El detector cubre `src/` ↔ `dist/`. **No** cubre otros pasos de compilación: hoy no hay más.
- El reparto del coste del meta-guard (76 s → 236 s) entre este cambio y la varianza de la máquina
  **no está medido**. Ver [SCRUM-765.md](docs/master/SCRUM-765.md).
