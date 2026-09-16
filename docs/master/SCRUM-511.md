# SCRUM-511 · EXENCIÓN-POR-MENCIÓN: el censo, y por qué su cero hay que saber leerlo

**Fecha:** 16-sep-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `1f18293ed08ed65f467151269c3f1f92f9d52675` · 2026-09-16T04:30:51+01:00
**Tanda:** 6865 tests, 6755 pass, 0 fail, 0 cancelled · **110 skipped, aparte** · POBLACIÓN 822 ficheros · 267 s · exit 0 — con tope duro, medida DESPUÉS del último cambio.

> **Un censo que sólo ve lo que está bien nombrado mide la nomenclatura, no el código.**

## Lo que el ticket pedía

Censar cuántos OTROS guards eximen por **mencionar** la señal en vez de por **usarla**. SCRUM-510
midió que la exención de SCRUM-409 libraba ficheros por `texto.includes('isDemoMerchant')`, aunque
la mención viviera en un comentario: *tres ficheros tenían la exención gracias al comentario que
advertía del defecto.*

⛔ **Y explícitamente: no se arregla ninguno.** Endurecer produce rojos en ficheros ajenos y eso va
uno a uno, con su clasificación. Aquí se mide y se reporta.

## 🔴 El hallazgo: el criterio obvio no vale, y lo demuestra el propio control positivo

El censo natural es buscar declaraciones cuyo **nombre** delate exención — `exento`, `excluido`,
`permitido`, `ALLOWLIST`… Da **38 declaraciones en 33 ficheros**, y **`MENCION: 0`**.

**Ese cero es falso como veredicto**, y lo caza el SUELO que el propio ticket exige (*«el censo
tiene que encontrar al menos el mecanismo de SCRUM-409»*):

| en `scrum409` el mecanismo se llama | ¿casa vocabulario de exención? |
| --- | --- |
| `usaElMecanismoDelDemo` | no |
| `pruebaElDemo` | no |
| `loMenciona` | no |

**El caso que ORIGINA el ticket es invisible para ese criterio.** Así que su `MENCION: 0` significa
«cero **entre los que se llaman así**», no «cero en el árbol» — y los dos se leen igual.

## Los DOS instrumentos, y qué vio cada uno

El ticket exige no fiarse de uno solo. No es redundancia: **discrepan justo donde está el interés.**

| | instrumento | qué mide | resultado |
| --- | --- | --- | --- |
| **A** | por **NOMBRE** (AST) | declaraciones cuyo nombre delata exención | 38 = **USO 4** + **LISTA 10** + **MENCIÓN 0** + **NO_SE_PUDO_DETERMINAR 24** |
| **B** | por **MECANISMO** (sigue el dato) | lee ficheros → decide por texto → descarta → y **no** tokeniza | **244** de 1113 |
| — | texto ingenuo | líneas con vocabulario + comprobación de texto, sin separar comentario | 44 |

**Las categorías de A suman** el total (4+10+0+24 = 38), y eso está atado por un test.

**B por sí solo tampoco es un veredicto:** 244 es demasiado grueso — cualquier test que lea un
fichero y haga un aserto con `includes` entra. Se declara, no se disfraza de hallazgo.

### 🔴 El cruce de los dos: 5 ficheros, y ninguno es el defecto

| fichero | clase | veredicto tras mirarlo |
| --- | --- | --- |
| `scrum244-cobertura-portabilidad` | INDET | **falso positivo**: `excluido` es la variable de un bucle sobre una lista ya declarada |
| `scrum615-pedir-tipo-destinatario` | INDET | **falso positivo**: `permitidos` es un `Set` de textos de UI, no de ficheros |
| `scrum629-telefono-que-no-se-destruye` | LISTA | correcta — autoexclusión del propio fichero |
| `scrum700-filtros-de-comentario` | LISTA | correcta — autoexclusión del propio fichero |
| `censo-arbitro-de-toque` | LISTA | correcta — `node_modules`, `dist`, `.git`… |

**⚠️ Y lo que el ticket pide que se diga: ninguna de las tres listas lleva el motivo escrito al
lado.** Los motivos son evidentes (autoexclusión y directorios de build) pero **evidente no es
escrito**, y el ticket exige señalarlo. No se tocan.

> La autoexclusión merece una nota: un guard que se saca a sí mismo de su propia población está
> resolviendo bien SCRUM-349 — el fichero que explica la prohibición contiene los patrones que
> persigue. Es lo contrario de un defecto.

## El veredicto

**Cero exenciones por mención vivas entre las que estos dos instrumentos saben ver.** El ticket
contemplaba este final: *«Si la respuesta es cero, el ticket se cae y es buena noticia.»*

**Pero el cero va con su límite pegado, porque sin él engaña:** el criterio por nombre es ciego ante
mecanismos nombrados de otra forma, y eso **está medido, no supuesto**. Un barrido exhaustivo de
verdad exigiría seguir el flujo de datos de cada lectura de fichero hasta su decisión, y eso es
otro ticket con su propio coste.

## Verificado en rojo — y sobre el caso REAL, no sintético

`scrum409` conserva **los dos criterios a propósito**: `loMenciona` (el viejo, por texto) y
`pruebaElDemo` (el nuevo, por AST). Se les da el mismo fichero y se mide la diferencia.

* 🔴 **EL QUE DECIDE** · un fichero que **sólo nombra la señal en un comentario** —y encima para
  advertir del riesgo— compra la exención con el criterio **VIEJO** (`true`) y **no** con el nuevo
  (`false`). Es el defecto entero, reproducido.
* ✅ **POSITIVO** · el **uso legítimo sigue eximiendo** con los dos criterios. Sin esto, «no exime
  por comentario» y «no exime nunca» darían el mismo resultado, y lo segundo sería haber roto la
  exención en vez de afinarla.
* 🔴 **MUTACIÓN** · devolver el criterio viejo **reabre el hueco**, y se comprueba que **ENTRA**:
  los dos criterios discrepan sobre el mismo fichero. Una mutación que no entra y una cobertura que
  no existe dan exactamente la misma salida.
* **AUTOPRUEBA** · distingue una exención por AST de una por `includes`, sobre fuente sintética.
* **SUELO** · el censo ve `scrum409` y lo clasifica **bien** (`miraElCodigo: true`): está corregido
  desde SCRUM-510, así que acusarlo habría sido un falso positivo sobre un guard ya arreglado. Y
  cero declaraciones en el árbol sale **CIEGO**, no verde.
* 🔴 **EL LÍMITE, ATADO** · hay un test que falla el día que el criterio por nombre empiece a ver
  `scrum409`. Ese día el cero pasa a significar otra cosa y alguien tiene que releer esta entrada.

## Lo que NO cubre

* **No se arregla ningún guard.** Ninguno lo necesita hoy, y si lo necesitara iría uno a uno.
* **El instrumento B no distingue** una decisión de exención de un aserto cualquiera sobre texto.
  Sus 244 son población de partida, no hallazgos — y por eso el veredicto sale del **cruce**.
* **Lo que no se puede afirmar:** que no exista ninguna exención por mención en el árbol. Sólo que
  no la hay entre lo que estos dos instrumentos alcanzan, con el alcance dicho arriba.

## Ficheros

* `scripts/_exenciones-de-guards.mjs` — los dos instrumentos, con el límite del primero escrito
  dentro.
* `tests/scrum511-exencion-por-mencion.test.mjs` — los controles, el suelo y el límite atado.
