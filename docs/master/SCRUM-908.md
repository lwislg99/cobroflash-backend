# SCRUM-908 · La muda intermitente: no reproduce aquí, y el instrumento ya no puede callarse por qué

**Fecha:** 17-sep-2026 · **Carril:** B · instrumentos · **Gate:** medición — **NO cierra el ticket**
**Medido contra:** `origin/main` = `755d23997bd55ce7aa6d6a1cb6a98616926dfd7e` · 2026-09-17T14:03:57Z
**Rama:** `scrum-908-la-muda-intermitente`
**Preámbulo (A1):** `git status` **limpio** y sin `MERGE_HEAD`/`REBASE_HEAD` antes de nada; 24
worktrees listados, ninguno de ellos éste a medio merge. `git rev-list --count HEAD..origin/main`
= **0** al ramificar.

> **Obligación 0:** la única rama `scrum-908*` es ésta. La 665c quedó **apartada con un commit en
> su propia rama** (`scrum-665c-el-enchufe`), nunca con `git stash`.

---

## LO PRIMERO: EL RESULTADO, Y QUÉ NO ES

> **No he reproducido la muda.** 51 mediciones locales, cero. El ticket **NO se cierra**: su
> criterio es N pasadas sobre la misma base dando VIVA **en CI**, y eso no se ha conseguido. **El
> meta-guard no se puede marcar obligatorio todavía.**

Lo que sí sale de esta tanda son tres cosas medidas, y una de ellas reencuadra el ticket entero.

---

## ① NO ERA «NO SE ARREGLÓ»: ERA «SE ARREGLÓ A MEDIAS», Y SE PUEDE MEDIR

| | runs con el meta-guard rojo |
|---|---|
| **ANTES** del merge de SCRUM-866 (`aa0b4d29`, 08:35:37Z) | **19 de 24** |
| **DESPUÉS** | **3 de 38** |

Los 19 anteriores no se han verificado uno a uno; se muestrearon **tres** (`35200497934`,
`35198790433`, `35196660979`) y **los tres eran del job `meta-guard`**. Antes del arreglo la muda
era prácticamente constante; ahora es ~8%.

**Eso cambia qué hay que buscar.** «Por qué no se arregló» y «qué queda del 8%» son búsquedas
distintas, y la primera manda a revisar el aserto —que ya se arregló y funciona— en vez del
mecanismo que queda.

### 🔴 Y LA EVIDENCIA DEL PAR NO PROBABA LO QUE PARECÍA

El encargo apoyaba la intermitencia en dos pares «misma base, distinto veredicto». Verificado por
API:

```
35205183959  MUDA    head 6441f65e  rama scrum-orquestador-en-piedra
35205023311  limpio  head 7bb55a08  rama scrum-881-el-detector-sin-fecha
```

**Son PRs distintos, con `head_sha` distinto.** Compartir *base* no es compartir *árbol*: cada uno
es un merge diferente. Ese par, por sí solo, **no demuestra no-determinismo sobre el mismo árbol**
— demuestra que dos árboles distintos dan veredictos distintos, que es otra cosa y tiene otras
causas posibles.

La intermitencia **sigue siendo real**, pero se sostiene en el recuento de arriba, no en el par.

### Los candidatos, descartados CON MEDICIÓN

| candidato | veredicto | cómo se descartó |
|---|---|---|
| el arreglo no llegó al árbol medido (staleness) | **descartado** | los tres mudos llevan `aa0b4d29` en su merge. El único cuyo *head* es anterior (`eefd3d5d`) **no tocó** `scrum859`, `scrum267` ni `SCRUM-244.md` respecto a su propio antepasado, así que el merge toma la versión arreglada |
| la rama modificó lo que se mide | **descartado** | ninguno de los tres toca esos tres ficheros |
| duración / carga del runner | **descartado** | mudos **568, 559, 393 s**; verdes **592, 496, 572, 574 s**. El más rápido de todos es mudo |
| contenido del PR (más entradas en `docs/master`) | **descartado en la medida de lo posible** | 30 pasadas sobre el merge de uno (4 ficheros tocados) y 20 sobre el otro (**555 entradas** en `docs/master`): cero mudas |
| este guard corre AISLADO y en CI va dentro de 232 mutaciones | **descartado** | una pasada del meta-guard **entero**: `vivas 232 · mudas 0 · ciegas 0` |

---

## ② SE MIDIÓ DONDE SE MIDE DE VERDAD — Y ÉSE ES EL SUELO

**La población de CI**, por API sin credenciales (el repositorio es público):

| | |
|---|---|
| runs de `ci.yml` desde el merge de la 866 | **76** |
| success | 31 |
| **cancelled** | **36** |
| failure | 8 |
| en curso | 1 |

Los **36 cancelados** confirman el aviso: el CI de `main` se cancela en cadena con merges seguidos,
y de ésos **no se puede leer el veredicto del meta-guard**. De los 8 fallos, se consultó el job
`meta-guard` uno a uno:

```
35205804657  failure   ← MUDA     35208941163  success  (rojo: build + tests)
35205183959  failure   ← MUDA     35207970681  success  (rojo: build + tests)
35201476082  failure   ← MUDA     35204650154  success  (rojo: build + tests)
                                  35200535850  success  (rojo: build + tests)
                                  35200894834  (el job no existe en ese run)
```

**Los tres mudos son exactamente los que el encargo nombraba.** Y el denominador sale mejor
fundado: **3 de 38** runs con veredicto conocido (≈ **7,9 %**), no 3 de 22.

> ⚠️ **De dónde sale el 38, y qué se supone:** 7 de los 8 fallos tienen el job consultado uno a
> uno. Los 31 *success* se cuentan como meta-guard verde **por inferencia** —un run no sale
> «success» con un job en rojo—, no consultados uno a uno para no agotar el presupuesto de 60
> peticiones/hora. Los 36 cancelados **no se cuentan en ninguna dirección**: su veredicto se
> desconoce, y meterlos en el denominador inventaría precisión.

### La reproducción, sobre el MERGE y no sobre mi rama

| árbol | N | VIVA | MUDA |
|---|---|---|---|
| `merge(6441f65e, 584f317f)` — el del run mudo 35205183959 | **30** | 30 | **0** |
| `542a7d37` — el del run mudo 35205804657 (555 entradas en `docs/master`) | **20** | 20 | **0** |
| el meta-guard **entero**, 232 mutaciones en secuencia | **1** | 232 vivas | **0** |
| | **51** | | **0** |

**Por qué N=30 y N=20:** con la tasa observada en CI (7,9 %), P(cero en 30) = 0,921³⁰ ≈ 8,5 %, y
con las 50 juntas ≈ 1,7 %. La línea base salió **idéntica las 50 veces** (`pass=20 fail=0 skip=0`,
`movidos=0`), así que reutilizarla en el segundo bloque no tapa nada.

> 🔴 **EL SUELO, DECLARADO:** con 51 mediciones y cero eventos, el límite superior al 95 % para la
> tasa local es ≈ 5,8 %. La de CI es 7,9 %. **No puedo afirmar que discrepen** —los intervalos se
> tocan— y desde luego no puedo afirmar que esté arreglado. Lo único que se puede decir es que
> **aquí no aparece**, y que la medición buena es la de CI.

---

## LO QUE SE ENTREGA: QUE LA PRÓXIMA MUDA SE EXPLIQUE SOLA

Si no reproduce en local y **en CI el log no se lee sin credenciales**, lo único que queda es que
lo diga el propio instrumento. Y hasta hoy decía sólo:

```
el guard NO cayó. Test que debía ponerse rojo: «…»
```

Detrás de ese «no cayó» caben **cuatro situaciones con arreglos opuestos**:

| lo que pasó | qué significa |
|---|---|
| el test **corrió y pasó** | mudez de verdad: el aserto no ve el defecto |
| el test salió **saltado** | **no corrió** — eso es CEGUERA, no mudez (la separación de SCRUM-754c) |
| el test **no aparece** | evento perdido, o el fichero murió a medias. Acusar al guard es acusar a un inocente |
| cayó con **otro nombre** | `cayo()` casa por FRAGMENTO; si el título cambió, mira donde ya no hay nada |

Ahora el mensaje las distingue, con el recuento de las dos pasadas. Forzada una muda real para
verlo —mutación inerte: cambia bytes y no comportamiento, porque sin cambio de bytes el
meta-guard sale CIEGO y no MUDO—:

```
el guard NO cayó. Test que debía ponerse rojo: «SCRUM-859 · 🔴 `INVISIBLE_HASTA_859` …»
    → en la pasada MUTADA ese test: PASÓ (corrió y no falló). Recuento: 20 pasados · 0 caídos
      · 0 saltados. Y en la LIMPIA: 20 pasados · 0 caídos.
```

> 🔴 **No cambia ningún veredicto.** Es texto añadido al mensaje que ya existía, dentro de la rama
> que ya decidía. No toca `ok`, ni el código de salida, ni la condición. Comprobado además con el
> meta-guard entero después del cambio: `vivas 232 · mudas 0 · ciegas 0 · rc=0`.

### Los controles

`tests/scrum908-la-muda-se-explica.test.mjs` — **4 pass · 0 fail · `# skipped 0`**. La lógica vive
en `porQueNoCayo`, **pura**, para ejercitarse en `npm test` en milisegundos sin mutar un fichero.

| control | qué exige | resultado |
|---|---|---|
| **SUELO** | los tres casos de prueba son de verdad distintos, y **ninguno cae** (si cayera, no sería un caso de muda) | ok |
| 🔴 **EL QUE DECIDE** | las tres situaciones dan **tres** respuestas distintas | ok |
| ✅ | el SALTADO se llama **ceguera** con esa palabra | ok |
| ✅ | sin datos de la pasada **no** se afirma que el test pasó | ok |

**MUTACIÓN declarada** (`MUTACIONES_QUE_ME_TUMBAN`): devolver el diagnóstico a una respuesta única
—lo de antes— y exigir el rojo. La corre `meta:mutaciones` en CI.

---

## ③ EL CRITERIO DE CIERRE — NO SE CUMPLE, Y NO SE DISIMULA

El ticket se cierra cuando **N pasadas sobre la misma base den VIVA siempre en CI**, con N dicho y
justificado. **Eso no se ha conseguido y no se afirma.** Lo que hay:

- la causa determinista, quitada y medida (19/24 → 3/38);
- 51 mediciones locales sin reproducir, con el suelo declarado;
- y la siguiente ocurrencia vendrá con su causa dentro, que es lo que faltaba para poder decidir.

**El meta-guard sigue sin poder marcarse obligatorio.**

---

## LO NO TOCADO

- **`tests/scrum859-…` y `tests/scrum267-…`: ni una línea.** No se ha tocado el test ni su ancla:
  el defecto que queda no está ahí, y cambiarlo habría borrado la única pista.
- **Ningún veredicto del meta-guard alterado**, ni su código de salida, ni sus topes (41).
- **Dos ramas locales de medición** (`medicion-908-merge`, `medicion-908-merge2`) reconstruyen los
  árboles de dos runs mudos. **No se han empujado**: son andamio, y se dicen para que quien repita
  el experimento sepa cómo se construyó.
- `src/` intacto · ningún estado ni flag nuevo (27) · ninguna dependencia (36) · cero producción y
  staging · `git stash` no usado · historia no reescrita.
