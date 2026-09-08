# SCRUM-716 · El vigía decía «al día» cuando NO había podido mirar

**Medido contra:** `origin/main` = `2c161c38cfba4ad81479dd302a933412d496f58c` · 2026-09-04T12:30:44+02:00
**Rama:** `scrum-716-vigia-no-dice-al-dia-sin-mirar`

## PASO 0 (regla 39) · el defecto sigue vivo HOY

El hallazgo era del 3-sep y `main` se ha movido tres veces desde entonces. Recomprobado sobre
`main` de hoy, con la función pura:

```
conoceElCommit: true, shaDeMain: null   →   veredicto: al-dia   salida: 0
   «producción dice 2d826de6 · `main` está en ? · sin hueco»
```

**Nadie lo había arreglado.** Sale VERDE habiendo impreso «`main` está en **?**».

🔒 Y lo peor no es el texto: **con salida 0 no aparece ni en rojo**. El guard construido para que
no vuelvan a pasar nueve días sin desplegar callaba justo cuando no sabía. El rojo de las PR de
ayer era el camino que **sí** funciona.

## El enumerado · cuántos caminos emiten veredicto sin las dos puntas

La comparación necesita **dos** commits: el que dice producción y el que dice `main`. Se enumeran
los doce estados posibles y se cuenta cuáles emitían veredicto sin tenerlos.

| # | Camino | Antes | Ahora |
|---|---|---|---|
| 1 | producción no responde | ⚠️ ciego · 2 | ⚠️ ciego · 2 |
| 2 | producción responde vacío | ⚠️ ciego · 2 | ⚠️ ciego · 2 |
| 3 | `/version` no publica un sha de 40 (el fallback de `env.ts`) | ⚠️ ciego · 2 | ⚠️ ciego · 2 |
| 4 | el clon no conoce el commit de producción | ⚠️ ciego · 2 | ⚠️ ciego · 2 |
| **5** | **`origin/main` NO se resuelve** | 🔴 **al-día · 0** | ⚠️ ciego · 2 |
| **6** | **`origin/main` resuelve a algo vacío** | 🔴 **al-día · 0** | ⚠️ ciego · 2 |
| **7** | **las dos puntas, pero no se pudo CONTAR el hueco** | 🔴 **al-día · 0** | ⚠️ ciego · 2 |
| 8 | hay hueco pero no se pudo fechar el más antiguo | ⚠️ ciego · 2 | ⚠️ ciego · 2 |
| 9 | producción corre algo que no está en `main` | 🔴 atrasado · 1 | 🔴 atrasado · 1 |
| 10 | sin hueco | ✅ al-día · 0 | ✅ al-día · 0 |
| 11 | hueco dentro del margen | ✅ al-día · 0 | ✅ al-día · 0 |
| 12 | hueco pasado el margen | 🔴 atrasado · 1 | 🔴 atrasado · 1 |

**Eran TRES, no uno.** El enumerado los contó; no se supusieron.

## La causa, en una línea

```js
if (!commitsPorDelante) {   // ← `null` (no se pudo contar) y `0` (no hay hueco), por la misma puerta
```

Es la confusión de la casa entre **«no medido» y «cero»** — esta vez dentro del propio vigilante,
y en el fichero que lleva escrito: *«Esto NO es "producción está al día": es que no se ha podido
comprobar. Un vigilante que confunde las dos cosas es peor que ninguno.»*

## El arreglo

**SUELO 4 · la otra punta.** Los tres suelos existentes miraban lo que dice *producción*. Faltaba
mirar `main`: sin `origin/main` resuelto no hay contra qué comparar. Pasa en CI de verdad — en un
checkout de PR, `origin/main` puede no existir como rama de seguimiento.

**Y `null` deja de ser `0`:** `commitsPorDelante == null` es ciego; `=== 0` es «sin hueco».

## Los rojos

| | Resultado |
|---|---|
| el test contra el mecanismo de HOY | **2 de 7 fallan**, nombrando los dos caminos verdes-ciegos |
| tras el arreglo | **8 de 8 en verde** |
| **CONTROL POSITIVO** · dos puntas y sin hueco | sigue «al día», salida 0 |
| **CONTROL POSITIVO** · hueco dentro del margen | sigue verde — no se vuelve ruidoso |
| **CONTROL NEGATIVO** · 30 h de hueco | sigue cantando, con las horas y los commits |
| **CONTROL NEGATIVO** · producción fuera de `main` | sigue cantando |

Un vigía que se pone ciego **siempre** es tan inútil como uno que se pone verde siempre — y se
desactiva antes, porque molesta todos los días. Por eso los cuatro controles.

Y el suelo del propio enumerado: si diera **un** camino, o si todos dieran **el mismo** veredicto,
falla — la regla se cumpliría por no encontrar nada.

## El vigía real, después

```
[vigilante de despliegue] https://yaqu.app/version
producción dice ad3d3889 · `main` está en 2c161c38 · 0.9 h de hueco (margen 6 h)
   3 commit(s) sin llegar. Un despliegue en curso se lee así.
exit 0
```

Un despliegue en curso, leído como lo que es.

## ⚠️ Lo que este ticket NO arregla, y es otro hecho

El **rojo de ayer en las PR #989 y #990** es distinto: el checkout del PR no traía el commit de
producción, así que el script se declaró ciego **correctamente** (camino 4). Eso se arregla en el
**job** —fetch más profundo, o traer la ref— **no en el script**, y va en su propio commit.

Medido ayer: ninguna de las dos ramas contenía `2d826de6`, que llegó a `main` a las 11:18.

## ⛔ No tocado

El `continue-on-error: true` del job (es de Javier, y está así a propósito) · el contrato de
`GET /version` · `scripts/db-push-prod`.

---

# SCRUM-716b · El JOB, que es donde estaba el otro rojo

**Medido contra:** `origin/main` = `382439a16a3888c24e4678d560c3e1429194e085` · 2026-09-04T13:40:00+02:00
**Rama:** `scrum-716b-job-del-vigia`

## PASO 0 · seguía pasando

SCRUM-716 ya está en `main` (el `SUELO 4` está dentro). El job ya llevaba `fetch-depth: 0`.
**Y no basta.**

## Medido reproduciendo el checkout, no deducido

Se reprodujo lo que hace `actions/checkout@v4` en un `pull_request`: traer **una sola ref** con
toda su historia. Contra el remoto de verdad:

```
¿resuelve origin/main?           NO
producción dice                  5bfc1136…
¿está su commit en el clon?      NO
→ ⚠️ NO SUPE MIRAR: el commit de producción no existe en este repositorio.   exit 2
```

**Faltaban las dos cosas a la vez.** El script hacía lo correcto declarándose ciego; lo que
faltaba se lo tenía que dar el job.

⚠️ **Y el banco mintió primero:** la primera versión apuntaba el `origin` del clon de prueba al
**checkout local, que está 1.933 commits atrás**, así que `origin/main` resolvía a `5749f2f1`. La
misma trampa de siempre, esta vez dentro del instrumento. Se rehízo contra el remoto real antes de
concluir nada.

## El arreglo, y el control que decide

Un paso, antes de llamar al vigía:

```yaml
- name: Traer `main` (el vigía compara contra él)
  run: git fetch --no-tags --prune --no-recurse-submodules origin +refs/heads/main:refs/remotes/origin/main
```

**Veredicto REAL en el mismo banco, después:**

```
producción dice 5bfc1136 · `main` está en 382439a1 · 0.7 h de hueco (margen 6 h)
   6 commit(s) sin llegar. Un despliegue en curso se lee así.
exit 0
```

Ya no es «no supe mirar»: es una lectura.

**CONTROL NEGATIVO** — con `main` ya traído y un `/version` que no responde:

```
⚠️ NO SUPE MIRAR: no se pudo leer `/version` de producción.
```

Arreglar el fetch **no** convierte una ceguera legítima en un veredicto inventado.

## 📌 El workflow PROGRAMADO no lo necesita

`vigia-despliegue.yml` se ejecuta sobre `main`, así que `actions/checkout` ya crea
`refs/remotes/origin/main`. **Por eso aquél funcionaba y éste no.** Hay un test que impide
añadírselo «por simetría»: hacerlo escondería la razón por la que el otro sí lo necesita.

## ⛔ No tocado

El `continue-on-error: true` (hay test que lo comprueba) · `scripts/vigilante-de-despliegue.mjs` ·
ninguna base.
---
---

# APÉNDICE (7-sep-2026) · Se vuelve a pedir el verde ciego: YA ESTÁ ARREGLADO. Medido, no leído

**Carril:** despliegue · instrumentos · **Gate:** sin gate — módulo puro, y una ejecución real del vigía
**Medido contra:** `origin/main` = `349350c8a7a34f24e9263aba1ca2af36e3cb4a91` · 2026-09-07T02:06:56+01:00
**Tanda:** 5749 tests, 5647 pass, 0 fail, 102 skipped (salida 0)

## C0 · Obligación 0 · Esto ya está hecho, y está en `main`

`git ls-remote --heads origin` **completo** (536 refs) y contenido de `main`:

| qué | dónde | estado |
|---|---|---|
| el arreglo del verde ciego | **dentro de `main`** | ✅ hecho — la rama `scrum-716-vigia-no-dice-al-dia-sin-mirar` se mergeó y se borró |
| esta entrada (`SCRUM-716.md`) | en `main` desde el 4-sep | ✅ existe, con el enumerado y los cuatro controles |
| SCRUM-716b (el job) | en `main` | ✅ hecho, y es el que la propia entrada declaraba pendiente |
| `constanciaDeEjecucion` | en `main` (llegó con SCRUM-727) | ✅ existe |
| `scrum-716c-historial-del-vigia` | **VIVA, sin mergear, 1 commit** | ⚠️ de otra sesión — **no se toca** |

**Y no se da por bueno porque lo diga el documento.** Todo lo de abajo está ejecutado hoy contra
el módulo de `main`.

## C1 · Obligación 1 · Los caminos que emiten veredicto, contados y ejecutados

Cada fila es una llamada real a `veredictoDeDespliegue`. «Puntas» son los dos commits que la
comparación necesita: lo que dice **producción** y lo que dice **`main`**.

| # | camino | prod / main | veredicto | salida |
|---|---|---|---|---|
| 1 | producción NO RESPONDE | ✗ / ✓ | `no-supe-mirar` | 2 |
| 2 | producción responde VACÍO | ✗ / ✓ | `no-supe-mirar` | 2 |
| 3 | `/version` devuelve algo que NO es un commit (el fallback de `env.ts`) | ✓ / ✓ | `no-supe-mirar` | 2 |
| 4 | el commit de producción NO está en el clon | ✓ / ✓ | `no-supe-mirar` | 2 |
| **5** | **`origin/main` NO se resuelve** — *el verde ciego del ticket* | ✓ / **✗** | **`no-supe-mirar`** | **2** |
| **6** | **`origin/main` resuelve a VACÍO** | ✓ / **✗** | **`no-supe-mirar`** | **2** |
| **7** | **las dos puntas, pero no se pudo CONTAR el hueco** | ✓ / ✓ | **`no-supe-mirar`** | **2** |
| 8 | hay hueco pero no se pudo FECHAR el más antiguo | ✓ / ✓ | `no-supe-mirar` | 2 |
| 9 | producción corre algo que no está en `main` | ✓ / ✓ | `atrasado` | 1 |
| 10 | sin hueco | ✓ / ✓ | `al-dia` | 0 |
| 11 | hueco dentro del margen (0,9 h) | ✓ / ✓ | `al-dia` | 0 |
| 12 | hueco pasado el margen (30 h) | ✓ / ✓ | `atrasado` | 1 |

**🔴 EL QUE DECIDE:** ¿algún camino dice «al día» sin las dos puntas? **NINGUNO.** Los únicos
`al-dia` son el 10 y el 11, y los dos tienen las dos puntas resueltas.

**Suelos del propio enumerado**, porque una regla se cumple sola si no encuentra nada:
`12 caminos ejercitados` (si diera 1, el barrido está roto) y `3 veredictos distintos`
(si todos dijeran lo mismo, tampoco probaría nada). Los dos verdes.

## C2 · Obligación 2 · El verde ciego NO SE REPRODUCE, y eso es el hallazgo

Se pidió enseñarlo corriendo. **No se puede**, y ésa es la respuesta:

```
entrada  : conoceElCommit: true, shaDeMain: null
veredicto: no-supe-mirar   salida: 2
título   : ⚠️ NO SUPE MIRAR: no se pudo resolver `main` en este repositorio.
detalle  : Producción dice estar en 2d826de6, pero no hay contra qué compararlo:
           `git rev-parse origin/main` no devolvió un sha. Suele ser un checkout sin la rama de
           seguimiento (un PR) o un `git fetch` que falta.
           Esto NO es «producción está al día»: es que no se ha podido comprobar.
           Un vigilante que confunde las dos cosas es peor que ninguno.
```

Donde el ticket esperaba `al-dia · 0`, hoy sale `no-supe-mirar · 2`. La frase que el fichero
llevaba escrita como prohibición **ahora la dice el veredicto**.

### Y el vigía de verdad, ejecutado hoy — el control positivo en el mundo real

```
[vigilante de despliegue] https://yaqu.app/version
producción dice 349350c8 · `main` está en 349350c8 · sin hueco
vigía · 2026-09-07T01:29:14Z · al-dia · prod=349350c8 · main=349350c8 · hueco=0.0h · commits=0
salida real: 0
```

No se ha vuelto ciego siempre, que era el otro modo de fallo: con las dos puntas y sin hueco dice
«al día» y sale 0.

### ⚠️ Y una corrección de mi propio instrumento, que casi acusa al producto

La primera pasada dio el camino 11 como `atrasado` y **30.000 horas** para un hueco de 30 h. No
era el vigía: `epochDelPrimeroSinDesplegar` y `ahoraEpoch` van en **segundos** (`%ct` de git,
`Math.floor(Date.now()/1000)`, y el módulo divide entre 3600), y mi ayudante pasaba milisegundos.
Se detectó por el `30000`, que no se parecía a nada. Corregido antes de concluir.

## C3 · Obligación 3 · Qué haría falta para distinguir CONGELADO de RETRASADO (descrito, NO construido)

Esto sí está sin hacer. El vigía de hoy es **sin memoria**: cada ejecución mira un instante y no
sabe nada del anterior, así que sólo puede decir «hay hueco» — no puede decir si ese hueco se está
cerrando. Las dos lecturas del 6-sep son el caso exacto:

```
20:21 UTC → prod ff4e1c4a · main 388dc045 · hueco  9,5 h ·  8 commits
22:12 UTC → prod 50312d32 · main c6c84261 · hueco 10,4 h · 10 commits
```

**Producción SE MOVIÓ** (`ff4e1c4a` → `50312d32`): desplegaba, sólo que más despacio de lo que se
mergeaba. El vigía pintó las dos igual, «atrasado», y eso mandó a buscar un healthcheck que no
estaba roto.

**El discriminador es el que ya está en el encargo, y es barato:** dos lecturas consecutivas con
**`prod` DISTINTO** significan que despliega (retraso); con **`prod` IGUAL**, que no (congelado).

Lo que haría falta, en tres piezas y por orden de coste:

1. **Persistir la lectura anterior.** La materia prima YA EXISTE y está medida: `constanciaDeEjecucion`
   (en `main` desde SCRUM-727) escribe por ejecución `prod=`, `main=`, `hueco=`, `commits=` y la
   fecha. Lo que falta es que ese renglón **sobreviva** al job y que alguien lo **lea**: hoy nadie
   lee una constancia anterior — medido, los únicos consumidores son el propio script y su test.
2. **Una función pura que compare dos lecturas** y devuelva `DESPLEGANDO` / `CONGELADO` /
   `NO_SUPE_MIRAR`, con la misma disciplina que el resto del módulo: sin reloj, sin red, sin git, y
   con el tercer valor **obligatorio** — sin lectura anterior no hay comparación, y eso no es
   «congelado», es que no se sabe. Es el mismo error que este ticket vino a arreglar, por la otra
   cara: confundir «no medido» con un veredicto.
3. **Un veredicto distinto para cada uno.** Congelado con hueco pasado el margen es lo que costó
   nueve días y debe cantar; **retrasado con producción moviéndose no debería bloquear cinco ramas
   media jornada.** Qué salida tiene cada uno es decisión del fundador, no mía: cambia qué checks
   se ponen en rojo.

**🛑 NO SE CONSTRUYE.** La obligación 4 pide autorización explícita del fundador con esas palabras,
y en este encargo no aparece. Además, **la pieza 1 pisa exactamente lo que hay vivo en
`scrum-716c-historial-del-vigia`** (sin mergear, 1 commit, toca `_vigilante-de-despliegue.mjs`,
`vigilante-de-despliegue.mjs` y este mismo fichero). Construirlo aquí sería dos sesiones sobre los
mismos ficheros — SCRUM-774.

## C4 · Los cuatro controles del encargo, ejecutados

| control | resultado |
|---|---|
| 🔴 **EL QUE DECIDE** · `origin/main` sin resolver → nunca verde | `no-supe-mirar` · **2** ✅ (antes: `al-dia` · 0) |
| ✅ **POSITIVO** · dos puntas y sin hueco | `al-dia` · **0** ✅ — y confirmado con el vigía real |
| ✅ **NEGATIVO** · dos puntas y CON hueco (30 h) | `atrasado` · **1**, `horas 30`, «commits de `main` que producción no dice tener: 10» ✅ |
| ✅ commit ausente del clon | `no-supe-mirar` · **2** ✅ |

## C5 · ⚠️ Aviso de colisión

Este apéndice se añade al final de `docs/master/SCRUM-716.md`. **`scrum-716c-historial-del-vigia`
también modifica este fichero** (+63 líneas). Quien mergee segundo tendrá conflicto aquí; es un
conflicto de documento, no de código, y las dos partes son aditivas.

## C6 · No tocado

El `continue-on-error: true` del job · el contrato de `GET /version` · el job y su checkout · el
margen de 6 h · `scripts/vigilante-de-despliegue.mjs` y `scripts/_vigilante-de-despliegue.mjs`
(**cero líneas**) · la rama `scrum-716c`, que se ha leído en sólo lectura y no se ha tocado.
Esta entrega es medición y documento.
---

# APÉNDICE II (7-sep-2026) · La pieza 2, aislada — y una medición que tumba la pieza 1

**Medido contra:** `origin/main` = `0cc6a3a684f702095074bbd1ef2b7cb996f07935` · 2026-09-07T02:48:35+01:00
**Tanda:** 5777 tests, 5675 pass, 0 fail, 102 skipped (salida 0) — corrida DESPUÉS de mezclar `main`, que trajo SCRUM-764. La de antes de la mezcla fue 5758/5656/0/102.

Sigue **sin autorización** para tocar `vigilante-de-despliegue.mjs`. Aquí no se toca ni una línea.

## D1 · 🔴 Obligación 2 · La medición que hay que leer ANTES de que nadie construya

La pieza 1 era «persistir y leer la lectura anterior». **En CI no hay lectura anterior que leer,
nunca.** Medido sobre `.github/workflows/vigia-despliegue.yml`, que es el job que corre el vigía:

| lo que hace el job | consecuencia |
|---|---|
| `runs-on: ubuntu-latest` | runner **efímero**: sistema de ficheros nuevo cada ejecución |
| `actions/checkout@v4` | clon **limpio** cada vez |
| **no hay `actions/cache`** | nada se guarda entre ejecuciones |
| **no hay `upload-artifact` / `download-artifact`** | nada se sube ni se recupera |
| `permissions: contents: read` | **no podría ni escribir en el repositorio** |
| `concurrency: cancel-in-progress: true` | una ejecución puede morir a media |

**Dónde acaba hoy el renglón**, medido: `constanciaDeEjecucion` (en `main` desde SCRUM-727) hace
`console.log` del renglón y lo apunta en `$GITHUB_STEP_SUMMARY`. **Las dos cosas mueren con el
run**: viven en el log y en el resumen de ESA ejecución, no en un sitio acumulado. Y **nadie lee
una constancia anterior** — los únicos consumidores en el árbol son el propio script y su test.

**Formato de hoy**, una línea por ejecución:

```
vigía · 2026-09-07T01:29:14Z · al-dia · prod=349350c8 · main=349350c8 · hueco=0.0h · commits=0
```

**Cuánto dura:** lo que dure el log de ese run (retención de GitHub), y siempre **por run**, sin
acumular.

### Lo que esto significa para el ticket

**La pieza 1, tal como la describí, no existe todavía y no basta con «hacer que se escriba».**
Hace falta además **un sitio donde el renglón sobreviva entre ejecuciones**, y eso es una decisión
con coste y con superficie:

- **caché de Actions** (`actions/cache`) — la más barata; se desaloja sola y no es un almacén.
- **artifact retenido + `download-artifact`** — sobrevive, pero hay que decidir retención y
  encadenar la descarga.
- **un fichero en el repositorio** — exige subir `permissions` a `contents: write` en un job
  programado, que es superficie nueva y no es mía.

Ninguna se elige aquí. **Es lo que el asesor pidió contestar antes de construir: contestado, y
cambia el diseño.**

## D2 · Obligación 3 · Qué es `scrum-716c-historial-del-vigia` (leída, no tocada)

Leída con `git show`/`git diff` contra la ref remota. **Ni checkout, ni merge, ni nada que la
mueva**; sigue en `08650118`, donde estaba.

Un commit, de Luis, del 4-sep: *«el vigia deja constancia — un renglon por ejecucion, tambien en
verde»*. Añade `renglonDeHistorial` (TSV) al módulo puro y, en el runner, `console.log` **más un
`appendFileSync` a `process.env.VIGIA_HISTORIAL`**.

**¿Está ahí la pieza 1? A medias, y hoy inerte:**

| | 716c | ¿es la pieza 1? |
|---|---|---|
| formatea un renglón por ejecución | ✅ `renglonDeHistorial`, en TSV | **ya lo hace `main`** con `constanciaDeEjecucion` (SCRUM-727), en otro formato |
| lo **apenda a un fichero** | ✅ si `VIGIA_HISTORIAL` está puesta | es el primer paso real hacia la pieza 1 |
| **algo pone `VIGIA_HISTORIAL`** | ❌ nadie, en todo el árbol | sin eso no escribe nada |
| **el fichero sobrevive entre runs** | ❌ ni caché ni artifact (D1) | se lo lleva el runner |
| **alguien lo LEE** | ❌ ninguna lectura en ninguna parte | sin esto no hay comparación |

**Conclusión:** 716c **no cierra la pieza 1**, y además su mitad de «formatear» quedó
**solapada por SCRUM-727**, que llegó a `main` después haciendo lo mismo por otro camino. Lo que
aporta y `main` no tiene es el `appendFileSync` — que hoy no se activa nunca. Quien la retome
debería mirar primero si lo que quiere conservar es eso, y no el renglón.

## D3 · Obligación 1 · La pieza 2, construida y AISLADA

`scripts/_ritmo-de-despliegue.mjs` — puro: sin reloj, sin red, sin git. **No la llama nadie**, y
hay un test que lo vigila: si alguien la conecta, se pone rojo y hay que borrarlo a mano diciendo
quién autorizó.

```
ritmoDeDespliegue(anterior, actual) → { ritmo, motivo }
   DESPLIEGA    prod distinto entre las dos lecturas
   CONGELADO    prod igual entre las dos lecturas
   NO_SE_SABE   no hay con qué comparar
```

**El tercero es de primera clase, no un respaldo.** Y hoy **es el único que se emitiría**, por D1:
mientras no exista la pieza 1, lo honrado es contestar que no se sabe. Decir «congelado» la primera
vez que corre —y en CI corre siempre por primera vez— sería una alarma cantando sin haber medido:
el defecto de SCRUM-716 con otro traje.

### 🔴 El caso que me cazó mi propio test

`'1788742571305'` — el `String(Date.now())` que publica el fallback de `env.ts` cuando falta
`RAILWAY_GIT_COMMIT_SHA` — son **trece caracteres que son todos hexadecimales válidos**, así que mi
filtro `^[0-9a-f]{7,40}$` los daba por sha. Dos lecturas de ésas habrían dicho **«despliega» todas
las veces**, porque el reloj siempre avanza: la alarma diciendo que todo va bien justo cuando no se
sabe qué corre. Se rechaza lo que sea **todo dígitos**, con su precio declarado en el código: un sha
abreviado que salga todo dígitos (~2 % con 8 caracteres) se rechaza también, y se acepta porque el
error va en la dirección segura — callar de más, nunca inventar un movimiento.

### Y el prefijo, declarado en vez de escondido

Una lectura puede traer 8 caracteres (el renglón de constancia) y la otra 40 (`/version`). Se
comparan **por prefijo**, con el riesgo escrito: dos commits distintos que compartan los primeros 8
se leerían como el mismo. Exigir la misma longitud daría `NO_SE_SABE` cada vez que se comparase una
constancia con una lectura fresca — o sea siempre, que es lo que rompería la pieza.

## D4 · Los controles

| control | resultado |
|---|---|
| 🔴 los **TRES** valores, cada uno con su caso | `DESPLIEGA` (ff4e1c4a→50312d32, el caso real del 6-sep) · `CONGELADO` (mismo sha) · `NO_SE_SABE` (`null` y `undefined`) ✅ |
| 🔴 **NEGATIVO** · dos lecturas iguales NO devuelven «no se sabe» | devuelven `CONGELADO` ✅ — y las distintas, `DESPLIEGA` |
| ✅ el enumerado de los 12 caminos, sobre `main` | **sigue verde**: 12 caminos, 3 veredictos, y **ningún** «al día» sin las dos puntas ✅ |
| mutaciones declaradas | **3 de 3 VIVAS**, con el módulo restaurado byte a byte |

**Dos suelos más**, porque una regla se cumple sola si no encuentra nada: los tres valores tienen
que ser **distintos entre sí**, y el filtro de lo ilegible tiene que **seguir aceptando lo bueno**
(si rechazara todo, su «no se sabe» no significaría nada).

### ⚠️ Y una mutación mía que salió mal antes de salir bien

La primera declaración del contrato cortaba a media llamada y dejaba el fichero **sin cerrar**: el
runner dictó «EL FICHERO MURIÓ AL MUTAR» — el guard se ponía rojo, pero por un error de sintaxis y
no por el defecto. Una mutación con más radio que el defecto que imita no prueba nada. Se acotó al
bloque entero. La tercera tenía el ancla caducada por mi propio arreglo del `Date.now()`, y se
re-ancló.

## D5 · No tocado

`vigilante-de-despliegue.mjs` y `_vigilante-de-despliegue.mjs` (**cero líneas**) · el
`continue-on-error` · el contrato de `GET /version` · el job y su checkout · el margen de 6 h ·
`scrum-716c`, leída en sólo lectura y **sigue en `08650118`** · y la pieza 2 **no está conectada a
nada**.
---

# APÉNDICE III (7-sep-2026) · Construido: el vigía ya distingue congelado de retrasado

**Medido contra:** `origin/main` = `6fb51ab77713af1261dcf2e3f7819545c57c35b6` · 2026-09-07T03:16:20+01:00
**Tanda:** 5800 tests, 5698 pass, 0 fail, 102 skipped (salida 0) — corrida DESPUÉS de mezclar `main`
**Autorización:** el fundador autorizó tocar `vigilante-de-despliegue.mjs` el 7-sep-2026, con las
palabras **«Sí autorizo»**. Sin eso, nada de este apéndice existiría.

## E0 · Obligación 0 · Las dos ya estaban en main

| ticket | comprobado POR CONTENIDO | estado |
|---|---|---|
| **SCRUM-801** | `package.json` de `main` trae `"censo:respaldo-n": "node scripts/censo-respaldo-de-la-n.mjs"` con su bloque `//censo:respaldo-n`, y el script existe | ✅ **en main** |
| **SCRUM-775** | `censo-tablero-vs-arbol.mjs:136` dice `suelo.length > 0` — la forma «SÍ está»; `suelo.ok === false` no aparece | ✅ **en main** |

Por eso GitHub no ofrece nada que comparar: no hay nada pendiente que comparar.

## E1 · Las tres decisiones, aplicadas

① **716c descartada** — no se ha mezclado ni tocado; sigue en `08650118`.
② **El almacén es `actions/cache`** — sin permisos nuevos y sin escribir en el repositorio.
③ **El rechazo de todo-dígitos queda firmado**, con su precio en el código.

## E2 · Obligación 3 · Las salidas, y por qué cada número

El vocabulario **no se estrena**: es el que ya usaba el vigía —0 midió, 1 defecto, 2 no supe
mirar— y se reutiliza a propósito para que nadie tenga que aprender un cuarto código.

| situación | salida | por qué |
|---|---|---|
| sin hueco | **0** | no hay nada que diagnosticar |
| veredicto ciego | **2** | ni se pudo medir el hueco; el ritmo no lo rescata |
| producción **fuera de `main`** (hueco sin medir) | **1** | un force-push o un despliegue a mano; el ritmo no lo explica |
| hueco medido + **DESPLIEGA** | **0** | es el 6-sep: va por detrás pero va. **Se dice, no se calla — pero no se pone en rojo** |
| hueco medido + **CONGELADO** | **1** | el caso de los nueve días. **Este número no se abarata por nada** |
| hueco medido + **NO_SE_SABE** | **2** | hay hueco y no se sabe si se cierra. Ni verde ni congelado: ceguera |

🔴 **La regla que evita el OTRO modo de fallo:** el ritmo **sólo califica un `atrasado` con hueco
medido**. Sin ella, cada ejecución con la caché vacía saldría en 2 estando todo perfecto — y un
vigía que se pone ciego siempre se desactiva antes que uno que se pone verde siempre, porque
molesta todos los días. Tiene su test y su mutación.

## E3 · Obligación 4 · El 6-sep, reproducido — y el resto, de extremo a extremo

**Como test** (`scrum716-ritmo-de-despliegue.test.mjs`), con los datos de aquel día y usando el
veredicto REAL, no uno de mentira:

```
20:21 → prod ff4e1c4a · main 388dc045 · hueco  9,5 h ·  8 commits
22:12 → prod 50312d32 · main c6c84261 · hueco 10,4 h · 10 commits

ANTES  (veredicto suelto)  → atrasado · salida 1     ← bloqueó cinco ramas media jornada
DESPUÉS (calificado)       → RETRASADO, PERO DESPLEGANDO · salida 0
```

**Y el vigía ENTERO ejecutado**, con un `/version` de mentira que devuelve **commits reales** de la
historia de `main` y el historial de verdad en disco:

```
  ① caché vacía + 33,6 h de hueco  -> salida 2   CIEGO (ni verde ni congelado)
  ② producción quieta + 33,6 h     -> salida 1   CANTA
  ③ producción movida + 15,5 h     -> salida 0   NO BLOQUEA

  historial acumulado:
    vigía · …02:19:27Z · atrasado · prod=4c0dcc5d · main=6fb51ab7 · hueco=33.6h · commits=208
    vigía · …02:19:28Z · atrasado · prod=4c0dcc5d · main=6fb51ab7 · hueco=33.6h · commits=208
    vigía · …02:19:28Z · atrasado · prod=10225d66 · main=6fb51ab7 · hueco=15.5h · commits=101
```

⚠️ **Y la primera versión de esta prueba no probaba lo que decía.** Cogió los commits por posición
y el caso ③ salió con **5,8 h de hueco — dentro del margen**: el veredicto era «al día» y el ritmo
ni llegaba a intervenir, así que el 0 era correcto por el motivo equivocado. Se rehízo eligiendo
los commits **por edad, con suelo** (los dos por encima del margen), y entonces ③ da 15,5 h de
hueco y sale 0 **porque producción se movió**, que es lo que había que demostrar.

## E4 · Lo construido

| fichero | qué |
|---|---|
| `scripts/_ritmo-de-despliegue.mjs` | `salidaConRitmo` (la decisión), `lecturaDeLaConstancia` y `ultimaLectura` (leer el historial) |
| `scripts/vigilante-de-despliegue.mjs` | lee el historial, califica, escribe el renglón y sale con `final.salida` |
| `.github/workflows/vigia-despliegue.yml` | `actions/cache` (caché rodante) + `VIGIA_ESTADO` |
| `.gitignore` | `.vigia/` — estado de ejecución, no fuente |

**El historial se lee HACIA ATRÁS**, y no es un detalle: si la ejecución anterior salió ciega, su
renglón lleva `prod=?` y no es una lectura — pero la de antes puede serlo. Quedarse sólo con la
última línea tiraría una medición buena por culpa de una ejecución ciega.

## E5 · Los controles

| control | resultado |
|---|---|
| 🔴 **EL QUE DECIDE** · el 6-sep, antes y después | `atrasado · 1` → `RETRASADO, PERO DESPLEGANDO · 0` ✅ |
| 🔴 **CONGELADO DE VERDAD** · prod igual, pasado el margen | `🔴 PRODUCCIÓN CONGELADA · 1` ✅, y con su mutación declarada |
| ✅ **NO_SE_SABE** en la primera ejecución (caché vacía) | `2` — ni verde ni congelado ✅, medido también ejecutando el vigía |
| ✅ el enumerado de los 12 caminos | **sigue verde**: ninguno dice «al día» sin las dos puntas ✅ |

**17 tests** en el fichero y **7 mutaciones declaradas, las siete VIVAS** — incluida la peor, la que
apaga la alarma de los nueve días. El módulo quedó restaurado, comprobado ancla por ancla.

## E6 · 🔴 Un trinquete que saltó, y se DECIDE

`npm test` se puso en rojo con **dos guards de SCRUM-727**, y los dos fijaban el **texto**
`v.salida`:

- `el AVISO sigue siendo condicional`
- `la constancia NO cambia el veredicto ni la salida`

**Las dos propiedades que protegen siguen vivas**: la anotación sigue dentro de su `if`, y la
constancia sigue sin decidir nada. Lo que cambió es de dónde sale el código de salida, y ese
segundo decisor —el ritmo— **está autorizado y declarado**.

No se ensancha la lista: se re-apuntan **a la propiedad**. El primero acepta `v.salida` o
`final.salida` y **sigue cayendo** si alguien vuelve incondicional la anotación. El segundo pasa a
comprobar por AST el argumento de `process.exit` y exige además que **`constancia` no aparezca en
él** — cosa que el `match` anterior no comprobaba, así que queda **más estricto que antes**.

## E7 · No tocado

`continue-on-error: true` · `permissions` · `concurrency` · el contrato de `GET /version` · el
margen de 6 h · `scrum-716c` (sigue en `08650118`) · ningún árbol ajeno.


---

# ✅ ENMIENDA (8-sep-2026) · SCRUM-716c · LA MEMORIA NO SOBREVIVÍA A SU PROPIO AVISO

**Rama:** `scrum-716c-el-cache-del-vigia` · **Árbol:** `cobroflash-b22`
**Medido contra:** `origin/main` = `7d2d45bd568c4c924bb04cb82a4369e4e070fe79` · 2026-09-08T02:27:15+01:00

> Va **dentro de esta entrada y no en un fichero propio** porque el guard de SCRUM-273 lo
> exige y su motivo es correcto: el nombre `SCRUM-<n>.md` es lo que garantiza que dos tickets
> nunca escriban el mismo fichero. Esto no es un ticket nuevo — es un defecto sobre el
> mecanismo que este ticket construyó.
# 🔴 OBLIGACIÓN 0 · ¿HAY YA RAMA CON ESTE NÚMERO?

**Se pregunta al REMOTO, no a Jira**, y **por nombre de rama**, no con un `grep` suelto — un
`grep 716` casa con SHAs por coincidencia y fabrica paradas falsas.

```
git ls-remote --heads origin | grep -E "refs/heads/scrum-716(-|$)"
   → refs/heads/scrum-716-el-verde-ciego = 8de07cb3108ff76e99188a55136e48ae1c807961
git merge-base --is-ancestor 8de07cb3 origin/main
   → MERGEADA
```

**Hay rama, y está MERGEADA: 0 commits sobre `main`, 0 ficheros, 0 líneas.** Es una rama muerta que
GitHub no borró al cerrar su PR, no trabajo sin integrar. La comprobación se paró y se preguntó
antes de seguir; el fundador confirmó que lo que se trae es un **defecto sobre código vivo**, no una
reconstrucción del ticket.

📌 De aquí salió la enmienda a la propia Obligación 0, ya adoptada para toda la casa: **existir y
contener trabajo sin mergear son cosas distintas**, y sólo la segunda es motivo de parar. Sin la
segunda línea, cada rama muerta sin limpiar bloquea su ticket para siempre.

---

# EL HECHO

Medido en CI dos veces el 8-sep-2026:

```
vigía · atrasado · prod=15fb3b2f · main=b07546cf · hueco=17.1h · exit 2
«no hay lectura anterior con la que comparar. NO es congelado: es que nadie ha mirado antes.»
```

Y el desenlace, que es lo que lo convierte en ticket: **producción SÍ estaba desplegando.** El
último verde de Railway era `4d9576fa`, el de SCRUM-814. O sea el caso **RETRASADO PERO
DESPLEGANDO** — exactamente el que SCRUM-716 construyó para no confundir con CONGELADO.

**El instrumento tenía el dato correcto y la conclusión imposible**, por no tener con qué comparar.

---

# 🔴 LA MEDICIÓN · ¿no se guarda, o se guarda y no se restaura?

**Ninguna de las dos, y son DOS causas distintas en DOS workflows.** Mirado en los propios
workflows, no deducido.

## (a) `ci.yml` — el vigía de CADA PR **no tenía memoria en absoluto**

```
acotado el job `vigia-despliegue` de ci.yml:
   actions/cache  → NO
   VIGIA_ESTADO   → NO
```

SCRUM-716 le dio la lectura anterior al workflow **programado** y **no a éste**. Así que el vigía
de cada PR corría con `rutaEstado = ''` —sin lectura anterior **por construcción**— y en cuanto
producción iba por detrás contestaba NO SE SABE. **No es «se guarda y no se restaura»: es que nunca
hubo caché.**

Es la misma asimetría que ya mordió en SCRUM-716b, y el propio `ci.yml` la nombra sin darse cuenta:
*«El workflow PROGRAMADO no necesita esto»* —lo dice del `git fetch` de `main`—, pero la diferencia
entre los dos jobs era más grande de lo que ese comentario recoge.

## (b) `vigia-despliegue.yml` — el programado la tenía, pero **guardaba sólo en verde**

Usaba `actions/cache@v4` **a secas**. Medido en la definición de la acción, no de memoria:

```yaml
# actions/cache@v4 · action.yml
runs:
  using: 'node20'
  main: 'dist/restore/index.js'
  post: 'dist/save/index.js'
  post-if: "success()"
```

Y el vigía **falla el job a propósito**: ése es su mecanismo de aviso, escrito en su propia cabecera
—*«El aviso es el propio job en rojo»*—. Se cruzan las dos cosas y sale esto:

| vigía | ¿corre el post? | ¿se guarda la lectura? |
|---|---|---|
| VERDE | sí | **sí** |
| ROJO | **no** | **NO** |

🔴 **La memoria se guardaba sólo cuando no hacía falta, y nunca cuando sí.** En cuanto producción se
quedaba atrás el vigía se ponía en rojo, no guardaba, y la ejecución siguiente volvía a no tener con
qué comparar. NO_SE_SABE perpetuo.

## ¿Desde cuándo?

`git log -S "actions/cache" -- .github/workflows/vigia-despliegue.yml` → **una sola entrada**:
`8de07cb3`, **7-sep-2026 03:36**. O sea que este exit 2 tiene **un día**, no semanas.

🔴 **Y NO SE HA PERDIDO NINGÚN «CONGELADO» LEGÍTIMO**, que era la pregunta que había detrás. Sin
lectura anterior el vigía **tampoco puede emitir CONGELADO**: emite NO_SE_SABE, que también es rojo
(salida 2). El job estaba en rojo de todas formas. Lo que se perdió no es la alerta: es la
**discriminación** — y, en el job de PR, la credibilidad de un vigía que sale rojo en todas.

---

# EL ARREGLO

## (a) El programado: `restore` al principio, `save` **con `if: always()`** al final

`actions/cache/save@v4` es un paso **normal** (`main:`, sin `post` y sin `post-if` — comprobado en
su `action.yml`), así que `always()` basta y se ejecuta también cuando el vigía ha cantado.

## (b) El de cada PR: lectura anterior, **en SÓLO LECTURA**

Y eso es una decisión, no un descuido:

- una rama de PR **puede restaurar** las cachés de la rama por defecto — de ahí sale la lectura que
  dejó el programado sobre `main`;
- pero **no debe guardar**: lo que escribiera se queda en el ámbito de su propia rama, invisible
  para `main`, y le ensuciaría sus siguientes pasadas con lecturas tomadas desde un contexto que no
  es producción-contra-main.

⚠️ **Y depende del arreglo (a)**: si el programado no guarda, aquí no hay nada que restaurar y el
vigía de PR sigue diciendo NO SE SABE. Correctamente —es la verdad— pero queda dicho para que nadie
lea (b) como una garantía por sí sola.

## ⛔ Lo que NO cambia, y es la mitad del ticket

- **Los tres veredictos siguen siendo tres.** NO_SE_SABE **no** pasa a verde.
- **La primera pasada de todas SIGUE diciendo NO_SE_SABE**, y tiene su test. Eso no es un fallo: es
  la verdad.
- El vigía sale con **el mismo código** que antes; el job sigue en rojo cuando toca. Lo único que
  cambia es que **la lectura sobrevive**.
- El job de PR sigue siendo `continue-on-error: true`: un check bloqueante le cerraría la puerta a
  la rama que viene a arreglar el despliegue que él mismo mide.

---

# LOS CONTROLES

`tests/scrum716c-la-memoria-del-vigia.test.mjs` — **8 casos, 8 en verde.** Y guardan el
**TRANSPORTE**, que es lo que nadie probaba: 716 ató la DECISIÓN a conciencia y el defecto estaba en
que la lectura no llegaba de una ejecución a la siguiente.

## 🔴 El control que decide, ejecutado de EXTREMO A EXTREMO

No con dos lecturas puestas a mano: con el **CLI de verdad**, corrido **dos veces**, contra un repo
de usar y tirar de tres commits viejos, un `/version` propio en `127.0.0.1` y un `VIGIA_ESTADO` real
entre medias.

| Escenario | Resultado exigido |
|---|---|
| dos lecturas · producción **se mueve** | **exit 0** y dice `RETRASADO, PERO DESPLEGANDO` |
| dos lecturas · producción **quieta**, pasado el margen | **exit 1** y dice `PRODUCCIÓN CONGELADA` |
| **primera pasada de todas** | **exit 2**, NO SE SABE — y tiene que seguir saliendo |
| `/version` inalcanzable | **exit 2**, `no-supe-mirar`, jamás «al día» |

Con su **suelo del transporte**: se comprueba que tras la primera pasada el historial tiene
**exactamente un renglón**, y tras la segunda **dos**. Sin eso, el control mediría otra cosa.

## 🔴 Y una invariante estructural, para que no vuelva a pasar

Lo que dejó pasar este defecto es que 716 le dio memoria a **un** workflow y no al otro, y nada
comprobaba la pareja. Ahora hay un barrido: **todo job que le dé `VIGIA_ESTADO` al vigía tiene que
tener su paso de caché, y si guarda, el guardado no puede depender de que el vigía haya ido bien.**
Con suelo: el barrido tiene que encontrar exactamente los dos workflows conocidos — cero no sería
«todo correcto», sería que no ha mirado.

## Los rojos, probados por MUTACIÓN

| Mutación inyectada | Qué cayó |
|---|---|
| vuelve `actions/cache@v4` a secas | **2**: el del programado y la invariante estructural |
| se le quita el `if: always()` al guardado | **2**: los mismos |
| el vigía de PR se queda sin `VIGIA_ESTADO` | **2**: el del PR y la invariante |
| 🔴 NO_SE_SABE pasa a **verde** | **3**: los dos controles y el POSITIVO de la primera pasada |
| CONGELADO deja de cantar | el control del otro sentido |

Cada mutación **comprobada presente en el fichero** antes de correr nada.

---

# 🕳️ Tres tropiezos propios, escritos porque son el mismo patrón

1. **Un interbloqueo que no fallaba: se colgaba.** El test levantaba el `/version` en su propio
   proceso y llamaba al vigía con `execFileSync`, que **bloquea el bucle de eventos**: el servidor
   no podía contestar y el hijo esperaba su `fetch` para siempre. Sin síntoma —ni rojo ni verde—.
   Arreglado con `execFile` asíncrono, y el porqué queda escrito en el test.
2. **Una aserción que se cazaba a sí misma, por tercera vez en esta sesión.** El SUELO negaba
   `/al día/` sobre la salida… y el vigía, cuando no puede mirar, **explica** que «esto NO es
   producción está al día». Es la lección de SCRUM-349: se mira el **veredicto**, que es legible por
   máquina, no la prosa que lo explica.
3. **Un ancla de medición que casi miente.** Al corregir el formato del ancla se usó
   `git rev-parse origin/main`, que ya se había movido — habría anclado contra un commit contra el
   que no se midió. Va el `merge-base` real de la rama.

# 🕳️ Huecos declarados

1. **Nada de esto se ha ejecutado en un runner de GitHub.** Los guards del workflow son
   **estructurales sobre el YAML** —con suelo—, y el control de extremo a extremo corre el CLI, no
   la caché de Actions. Que `actions/cache/save` guarde de verdad con el job en rojo se apoya en su
   `action.yml` (medido) y **lo confirmará la primera pasada real en CI**, no esta sesión.
2. **No se ha podido contar cuántas ejecuciones salieron en exit 2**, porque eso vive en la API de
   Actions y aquí no hay `gh`. Lo que sí está medido es la **ventana**: desde `8de07cb3`
   (7-sep 03:36), o sea un día.
3. **El caso de la caché EVICTADA no se ejercita.** GitHub retira las cachés no usadas en 7 días; si
   eso pasa, el vigía vuelve —correctamente— a NO_SE_SABE en su siguiente pasada. Es el
   comportamiento diseñado, pero aquí no se ha reproducido.
