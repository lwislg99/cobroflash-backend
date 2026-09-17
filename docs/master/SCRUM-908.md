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

## LA TANDA

```
ARBOL QUIETO DESDE: 14:08:24 UTC
ARBOL QUIETO HASTA: 14:12:17 UTC
# tests 7324 · # pass 7214 · # fail 0 · # skipped 110 · cero `not ok`
```

META-GUARD entero, DESPUES del cambio: 13:30:29 → 14:05:37 UTC ·
`vivas 232 · mudas 0 · ciegas 0 · rc=0`.

> Se mira `# fail` y no solo el codigo de salida.

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

# SCRUM-908b · No eran tres mudos: eran QUINCE, y van en RACHAS

**Fecha:** 17-sep-2026 · **Carril:** B · instrumentos · **Gate:** medición — **NO cierra el ticket**
**Medido contra:** `origin/main` = `5f7b994ef52020193f94560928521c73d4c9472d` · 2026-09-17T15:41:26Z
**Rama:** `scrum-908b-quien-era-el-mudo`
**Preámbulo (A1):** `prisma generate` con el CLI local · `git status` limpio · `git rev-list --count
HEAD..origin/main` = **0** al ramificar. Sin `git stash` en ningún momento (A15).

> **Obligación 0:** no hay ninguna rama `scrum-908*` viva. La anterior (`scrum-908-la-muda-intermitente`)
> está **mergeada** en `main` por el PR #1434, así que esta entrada **ANEXA** (A8) y no escribe encima.

---

## LO PRIMERO: EL RESULTADO

> **La premisa del ticket sigue viva, pero su NÚMERO estaba mal por un factor de 5.** No son «3 de 38
> runs» (7,9 %): son **15 de 72** (**20,8 %**, Wilson 95 % **[13,1 % – 31,6 %]**). Y no gotean: van en
> **dos rachas**, con 4 h 20 min de silencio en medio y 100 min de silencio después.
>
> **El ticket NO se cierra** y **el meta-guard sigue sin poder marcarse obligatorio.** Lo que cambia es
> qué hay que buscar.

---

## ① EL RECUENTO, CORREGIDO — Y CÓMO SE CORRIGIÓ

La tanda 908 de esta misma mañana consultó **8 de los fallos** de `ci.yml` y concluyó «3 mudos». Hoy
hay **28 fallos** desde el merge de la 866, y se han consultado **los 28, uno a uno**, por
`/actions/runs/{id}/jobs`, mirando el `conclusion` del job `meta-guard`:

| | |
|---|---|
| runs de `ci.yml` desde el merge de la 866 (08:35:37Z) | **160** |
| `success` (meta-guard verde **por inferencia**) | 47 |
| `failure` consultados uno a uno | **28** |
| → de ésos, job `meta-guard` en **rojo** | 🔴 **15** |
| → job `meta-guard` verde (el rojo era build+tests) | 10 |
| → el job `meta-guard` **no existe** en ese run | 1 |
| → el job `meta-guard` salió **cancelled** (veredicto desconocido) | 2 |
| cancelados / en curso (veredicto **desconocido**, no se cuentan) | 85 |
| **denominador con veredicto conocido** | **72** |

> ⚠️ **La inferencia se declara, igual que la declaró la tanda anterior:** los 47 `success` se cuentan
> verdes porque un run no sale «success» con un job en rojo; no se consultaron uno a uno. Los 85
> cancelados **no entran en ninguna dirección**. Si se contaran sólo los 25 verificados de verdad
> (15 mudos + 10 verdes), saldría 60 % — y sería un número peor, porque los fallos están
> sobre-muestreados por construcción.

**Por qué el 3 estaba mal, y no fue mala suerte:** aquel censo tomó su población de UNA página de la
API y se quedó con 76 runs y 8 fallos. Los otros 20 fallos no se descartaron: **no se vieron**. Es
exactamente A3 —*un cero no significa «está limpio», significa «no he mirado»*— cometido por el
instrumento que perseguía justo eso. Lo cazó re-pedir la población y leer su `total_count`.

---

## ② 🔴 LO QUE DE VERDAD REENCUADRA EL TICKET: NO ES UN GOTEO, SON RACHAS

Las horas de los 15 mudos, en orden:

```
08:46:13 · 09:27:06 · 09:33:58
        ── 4 h 20 min SIN NINGUNO ──
13:54:06 · 13:54:59 · 13:55:45 · 14:01:56 · 14:03:24 · 14:10:22 · 14:10:27 · 14:10:39 · 14:13:09
14:21:43 · 14:24:26 · 14:33:03
        ── 100 min SIN NINGUNO (hasta 16:13Z) ──
```

**Doce mudos en 39 minutos.** Partido por la mitad y contando sólo los runs con veredicto conocido:

| ventana | runs con veredicto | mudos |
|---|---|---|
| 14:20:05Z – 14:34Z | 4 | **3** |
| 14:34Z – 16:13Z | 10 | **0** |

🔒 **Un proceso del 20 % por run, independiente, no se agrupa así.** Una tasa por run explica un
goteo; no explica 4 h 20 min de cero seguidas de 12 en 39 minutos. Lo que se agrupa así es algo que
**es verdad de `main` durante una ventana y deja de serlo** — determinista, no aleatorio.

**Y eso cambia la búsqueda entera.** «¿Qué mutación falla el 20 % de las veces?» y «¿qué tenía `main`
entre las 13:54 y las 14:33?» son preguntas distintas, y la primera —la que este ticket lleva
persiguiendo— manda a hacer N pasadas locales, que es precisamente lo que no encuentra nada.

> ⚠️ **Lo que NO se ha conseguido probar:** cuál es esa propiedad del árbol. Que las rachas existan no
> basta, y aquí se para. El único candidato que se llegó a probar —una base común de `main`— **no
> vale**: el mudo de las 14:33 ya llevaba dentro dos merges posteriores al de los otros dos, así que
> no comparten base. Y el meta-guard entero sobre el árbol de merge del PRIMER mudo de la racha
> (`06144bdc4d`) se **interrumpió por reloj en la mutación 48 de 232**: eso NO es «no reprodujo»,
> es «no llegué a mirar» (④).

---

## ③ LA ATRIBUCIÓN A «LA MUTACIÓN #2 DE scrum859» NUNCA SE MIDIÓ

El encargo dice «la mutación #2 de scrum859 cae MUDA ~1 de cada 7 veces». Medido hoy:

- El meta-guard sale con **código 1 = MUDO** cuando **alguna** de sus **232** mutaciones no cae. Las
  anotaciones del check-run confirman el `1` en los tres mudos de la última racha (ni 2 = ciego, ni
  3 = no restaurado), pero **no dicen cuál**.
- **Ningún canal legible sin admin dice qué guard fue.** Los cuatro, medidos:

| canal | ¿legible por una sesión? | lo que devolvió |
|---|---|---|
| log del job | **NO** | `403 · Must have admin rights to Repository` |
| anotaciones del check-run | **NO** | sólo `Process completed with exit code 1.` |
| `output.summary` del check-run | **NO** | `""` — y probado contra un job de `avisador-rojo`, que **sí** escribe `$GITHUB_STEP_SUMMARY` |
| comentario del `avisador-rojo` | **NO** | sólo avisa del check **OBLIGATORIO** «build + tests», y el meta-guard no lo es |

🔴 **El último es un círculo cerrado, y es el nudo del ticket:** el aviso legible sólo cubre los checks
obligatorios; el meta-guard no puede ser obligatorio hasta que se explique la muda; y la muda no se
puede explicar porque su veredicto no llega por ningún canal legible.

> **Consecuencia sobre la entrega de la tanda anterior:** SCRUM-908 añadió a `porQueNoCayo` un
> diagnóstico de cuatro casos «para que la próxima muda se explique sola». Funciona —se ha visto
> funcionar en local, y se ve abajo— pero **escribe en el único sitio que ninguna sesión puede leer**.
> Tal como está, se explica sola para nadie. No es un defecto del texto: es del canal.
>
> **NO se ha construido el canal.** El que sí se lee es un comentario automático en el PR, y un envío
> automático nuevo es **regla 28 / J6**: pasa por su tabla y por el fundador, no por aquí.

---

## ④ LA REPRODUCCIÓN LOCAL: N DECLARADA ANTES, Y CERO

**N se declaró antes de correr, no después de ver el resultado.**

| banco | N declarada | resultado |
|---|---|---|
| mutación **#2** de scrum859, misma base | **40** | **40 vivas · 0 mudas** · 273 s |
| sonda del flujo de eventos, pasada LIMPIA | **60** | **una sola firma** las 60: `pass=20 fail=0 skip=0 movidos=0`, y el test nombrado apareció **60/60** |
| meta-guard **entero** sobre `06144bdc4d` (árbol del primer mudo de la racha) | 1 | **48 de 232 · todas VIVAS** · interrumpida por reloj (~90 min para 48 en esta máquina; las 232 habrían costado ~7 h) |

**Los dos controles del banco, antes de creerle un solo cero:**

| control | qué exige | resultado |
|---|---|---|
| **positivo** | las dos mutaciones declaradas de scrum859 caen sobre `main` | VIVA · VIVA |
| 🔴 **negativo (el que decide)** | una mutación **INERTE** —cambia bytes, no comportamiento— tiene que salir **MUDA**, o el banco no sabe decir MUDA y su cero no vale nada | **MUDA**, con el diagnóstico de SCRUM-908 dentro: «en la pasada MUTADA ese test: PASÓ (corrió y no falló)» |

**La línea base se reutilizó** dentro del bloque de 40 —una sola pasada limpia para las 40 mutadas— y
se **re-verificó al final**: idéntica (`pass=20 fail=0 skip=0 movidos=0`). Reutilizarla no tapa nada
porque las 60 pasadas de la sonda ya habían medido que no se mueve. El árbol quedó **limpio**
(`git status` vacío) tras las 40.

### Los sospechosos del encargo, descartados UNO A UNO con su evidencia

| sospechoso | veredicto | la evidencia |
|---|---|---|
| **CACHÉ** (`dist/` obsoleto) | **descartado** | `destinoEnDist()` devuelve `null` para todo lo que no sea un `.ts` bajo `rootDir` (`scripts/frontera-dist.mjs:84`). La mutación vive en `tests/scrum267-…test.mjs`: **no cruza la frontera**, y `node:test` carga ese fichero directo, no desde `dist/`. Aun así se hizo `npm run build` (exit 0) antes del meta-guard entero, como hace CI |
| **TIEMPO** (timeout que corta) | **descartado** | el paso mutador tardó **511 / 549 / 556 s** en los tres mudos y **555 s en un VERDE**: el verde es más lento que dos mudos. El `timeout` por fichero de `correr()` son 300 s para un fichero que corre en ~4 s, y un timeout emitiría `test:fail` — o sea contaría como CAÍDA (viva), no como muda |
| **ORDEN de ficheros** | **descartado en lo que alcanza** | `correr()` llama a `run({ files: [UN solo fichero] })`: no hay orden entre ficheros que alterar. Y el mismo guard aislado (40 pasadas) y dentro de la secuencia de 232 dio lo mismo |
| **pérdida de eventos por `forceExit: true`** *(sospechoso NUEVO, no estaba en la lista)* | **descartado en local** | era el candidato con mejor pinta: `run()` se llama con `forceExit`, y un evento perdido en la pasada mutada da exactamente «NO APARECE» → MUDO. La sonda de 60 pasadas lo buscó y **el recuento no se movió ni una vez**, ni bajo carga |
| la rama muda modificó lo que se mide | **no explica** | las tres de la última racha tocan ficheros de guard, y dos tocan guards **que declaran mutaciones propias** (`scrum899`, `scrum899b`, `scrum738`) — pero `scrum738` sobre el árbol de merge de su propio run mudo salió **VIVA** |

**Las anclas ENTRAN:** las dos mutaciones declaradas aparecen **exactamente una vez** en
`tests/scrum267-ancla-de-medicion.test.mjs`, y el fichero **no tiene CRLF** en disco. Una sustitución
que no entra sale CIEGA, no muda, y no se ha visto ninguna ciega.

### 🔴 EL SUELO, DECLARADO: QUÉ ACOTA CADA CERO Y QUÉ NO

- **40 pasadas de la mutación #2 con cero eventos** → techo 95 % (una cola) = **7,2 %**.
- Sumadas a las **51** de la tanda anterior: 91 pasadas → techo **3,2 %**. *(Poblaciones no idénticas:
  aquellas 51 fueron sobre otros dos árboles. Se dan las dos cifras y no se promedian.)*
- **El meta-guard entero: NI UNA pasada completa.** Se cortó en la mutación 48 de 232. Una pasada
  entera ya no acotaría casi nada —su techo al 95 % sería del 95 %—, y media pasada acota **cero**.
  Se cuenta como trabajo empezado, no como evidencia.

**Y AQUÍ VA EL AVISO DE MEDICIÓN QUE HAY QUE LEER ANTES DE COMPARAR:** el 20,8 % de CI es **por RUN,
sobre 232 mutaciones**; las 40 pasadas son **por MUTACIÓN, sobre UNA declaración**. **No son la misma
magnitud y no se comparan.** Lo único que se puede decir con intervalo es condicional:

> **SI** el mudo de CI fuera siempre la #2 de scrum859, entonces local (**≤ 7,2 %**) y CI
> (**[13,1 % – 31,6 %]**) **no se tocan**, y la divergencia SÍ se afirmaría: sería un fenómeno de CI.
> **Pero ese «si» no está medido** (③), así que la divergencia **no se afirma**. Para compararlas de
> verdad hacen falta N pasadas del meta-guard **entero** en local, y eso cuesta ~1 h por pasada en
> esta máquina.

> ⚠️ **La tanda anterior y ésta NO se contradicen estadísticamente:** su 3/38 tenía Wilson 95 %
> [2,7 % – 20,8 %], que contiene el 20,8 % de hoy. Lo que se corrige no es su intervalo: es su
> **recuento** (8 fallos consultados de 28) y su **lectura** de que el fenómeno gotea.

---

## ⑤ EL CRITERIO DE CIERRE — SIGUE SIN CUMPLIRSE, Y AHORA SE SABE POR QUÉ NO SE PUEDE

HECHO era: «con N pasadas en local y en CI sobre la misma base, la mutación cae SIEMPRE». **No se ha
conseguido**, y no se disimula. Pero hoy se sabe que la mitad de CI **no es alcanzable con las
herramientas de una sesión**: el veredicto de CI es ilegible sin admin, por los cuatro canales.

Lo que deja esta tanda para quien siga:

1. el recuento bueno: **15 de 72**, no 3 de 38, con los 28 fallos consultados uno a uno;
2. la **estructura de rachas**, que manda buscar una propiedad del árbol y no una probabilidad;
3. cinco sospechosos descartados con medición, incluido uno nuevo (`forceExit`);
4. y el nudo nombrado: **el canal**, no la muda.

**Marcar el meta-guard obligatorio sigue siendo acción del FUNDADOR** en Settings → Branches
(SCRUM-836 ②, `docs/master/SCRUM-836.md:92-99`): ninguna sesión puede hacerlo desde el código. Y sigue
sin poder hacerse.

---

## LO QUE ME SALIÓ MAL (A9)

1. 🔴 **Lancé 60 pasadas llamándolas «en reposo» sin mirar la máquina.** No lo estaba: 53 procesos
   `node` y **55 MB** de RAM libres, de las otras sesiones de este equipo. Lo descubrí a mitad, porque
   el ritmo cayó de 4 s a 40 s por pasada. La medición **vale** —y de hecho vale más, porque buscaba
   una carrera y la carga la favorece— pero **la etiqueta que le puse era falsa** y la habría
   entregado así. Aquí se llama «bajo carga», que es lo que fue.
2. **Empecé a buscar la causa en las ramas mudas** porque sus nombres la sugerían
   (`scrum-804g-la-mutacion-muda-de-738` tocando `tests/scrum738-…`). Era una correlación de nombres,
   no una medición; se midió y salió **VIVA**. Gastó una pasada y un checkout.
3. **Estuve a punto de construir el canal del `$GITHUB_STEP_SUMMARY`** dándolo por legible. Lo medí
   antes: devuelve `""`. Si no lo hubiera medido, habría entregado un canal que no se lee — un verde
   prestado, pagado por otro.

---

## LO NO TOCADO

- Ni una línea de `src/`, ni del camino de emisión fiscal, ni de `prisma/schema.prisma`.
- Ningún texto que vea el usuario: cero cambios de microcopy, landing o bot (regla 39 / A7).
- Ningún guard aflojado ni suelo bajado (regla 41). **No se ha cambiado el instrumento**: esta tanda
  sólo MIDE.
- Ningún canal de envío automático nuevo (regla 28 / J6): se propone y se para.
- Sin `db push`, sin tocar staging, sin turno de base.
