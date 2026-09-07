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
