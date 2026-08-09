# SCRUM-411 · Los exports de dominio que un profesional no puede alcanzar

**Fecha:** 9-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `8037a7a30049a442eb857733832c9eca0bf99ec2` · 2026-08-09T20:06:33+02:00
(anclado con `git ls-remote`, no con la ref local)

## El defecto

Un módulo de dominio **sin llamadores pasa todos los tests, entra verde, y desde fuera es
indistinguible de una función entregada**. Su ticket se cierra, y el cableado que falta deja de
estar en ninguna lista. Los cinco casos conocidos se descubrieron **por casualidad, midiendo otra
cosa**.

## 🔴 El hallazgo del ticket: LA ALCANZABILIDAD POR FICHERO MIENTE

La primera versión del censo daba `borradoMerchant.ts` por **vivo**, porque `barridoDemo.ts`
importa de él. Medido: importa **dos constantes** (`ORDEN_BORRADO_MERCHANT`, `COLGADOS_DE_CHARGE`);
**`borrarMerchant` no lo importa nadie** y ninguna ruta lo expone.

**Un módulo vivo por una constante esconde una función muerta.** El veredicto es **por export y
por alcance, nunca por módulo** — y eso lo destapó el control positivo, no mi lectura del código.

Ese caso concreto vive ahora **en la suite**, no en este informe: si el censo vuelve a mentir por
ahí, cae un test que lo nombra.

## Cómo mide

1. Camina el grafo de imports desde **`src/index.ts` y `src/app.ts`** — las entradas del proceso.
   `tests/` **no es entrada**: un módulo llamado solo por su test es justo el caso buscado.
2. Un export está vivo solo si lo importa **un fichero que a su vez es alcanzable**.
3. `export type` / `export interface` quedan fuera: no se pueden llamar.
4. Un módulo importado con `import * as` se da por vivo entero — no se puede saber qué se usa, y se
   prefiere no acusar. Es un punto ciego declarado, con su test.

## La foto: 8 módulos de dominio inalcanzables de 82

**Suelo de la medición:** 82 módulos de dominio, 199 ficheros de `src` indexados, 180 alcanzables.

### (b) Cierre en falso — ticket CERRADO, función inalcanzable → **reabiertos por el fundador**

| módulo | exports huérfanos | ticket |
|---|---|---|
| `system/domain/flagFiscal.service.ts` | `cambiarFlagFiscal`, `FLAGS_FISCALES`, `esFlagFiscal`, `ErrorCambioFlag` | SCRUM-218 |
| `system/domain/borradoMerchant.ts` | **`borrarMerchant`**, `FUERA_DEL_BARRIDO_GENERICO` | SCRUM-244 (RGPD-1) |

⚠️ El segundo **no sale como módulo inalcanzable** —dos de sus constantes sí se usan—, y por eso
estuvo a punto de no salir. Es el caso que da nombre al hallazgo de arriba.

### (a) A medio construir con ticket abierto — normal, se anota

| módulo | exports | ticket |
|---|---|---|
| `invoicing/domain/retencionIrpf.ts` | 6 | SCRUM-293 (A2) — esperando P12 y campo de schema |
| `invoicing/domain/recargoEquivalencia.ts` | 4 | SCRUM-294 (A3) — esperando **P13** (los tipos) |
| `invoicing/domain/criterioCaja.ts` | 3 | SCRUM-294 (A3) |
| `invoicing/domain/huecosSerie.ts` | — | SCRUM-291 ① |
| `jobs/domain/albaranSerie.ts` | 3 | SCRUM-306 |
| `jobs/domain/entregaPendiente.ts` | 3 | SCRUM-367 / entregas |

### (c) Código muerto — **candidato único, NO se retira**

| módulo | export | por qué queda anotado y no borrado |
|---|---|---|
| `invoicing/domain/finalInvoice.service.ts` | `buildFinalInvoice` | **Sin dueño y sin llamador**, y es del módulo de **facturación**. Un export ahí no se retira por descarte: merece veredicto propio. Queda nombrado para que alguien lo decida, no para que se caiga solo. |

## El trinquete

`MODULOS_DOMINIO_INALCANZABLES_MAX = 8`, y **solo puede bajar**. Si sube, el test cae **nombrando
el módulo nuevo**; si baja porque alguien cableó uno, el test también cae y obliga a bajar el tope
en el mismo commit — un tope con holgura es el descuadre silencioso.

## Verificación

| control | resultado |
|---|---|
| los cuatro conocidos salen (`retencionIrpf`, `recargoEquivalencia`, `criterioCaja`, `flagFiscal.service`) | ✅ |
| **control negativo**: `invoiceNumber.service` NO sale | ✅ |
| **el control que me corrigió**: `borrarMerchant` sale como huérfano aunque su fichero esté vivo | ✅ |
| suelo: sin módulos de dominio, el análisis no dice «todo bien» | ✅ |
| trinquete en rojo: un export de dominio nuevo sin llamador sube a 9 y cae nombrándolo | ✅ |
| tipos e interfaces no cuentan como export | ✅ |

## Lo que NO se ha medido — declarado

* **Los 127 exports sueltos de módulos vivos** están listados por el analizador pero **sin
  clasificar**: ahí hay constantes exportadas solo para sus tests (legítimo) mezcladas con
  funciones sin cablear. El trinquete de hoy **no los cubre**: solo cuenta módulos enteros.
* **Los tipos e interfaces quedan fuera a propósito.** No se pueden llamar.
* **Reflexión y montaje dinámico no se ven.** Un router montado por una cadena, o algo alcanzado
  por `import()` dinámico, saldría como muerto sin serlo. No se ha encontrado ninguno, pero **no se
  puede afirmar que no exista**.
* **`import * as` da el módulo por vivo entero**, así que un módulo importado así podría estar
  muerto y no saldría.
* **No se mide el alcance desde CRONS que no cuelguen de `index.ts`**, si los hubiera.

## Ficheros

* `tests/_alcance-dominio.mjs` (nuevo) — el analizador: grafo de alcance + exports por AST.
* `tests/scrum411-exports-inalcanzables.test.mjs` (nuevo) — trinquete, suelos y los controles.
