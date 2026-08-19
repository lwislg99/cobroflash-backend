# SCRUM-521 · El resolvedor de importadores dejaba de ver los que entran por `dist/`

**Fecha:** 19-ago-2026 · **Carril:** instrumentos de alcance · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `11636c07d991cc602175d8a0cdcc255e3b357191` · 2026-08-19T10:42:24+01:00

**Paso 0.** `docs/master/SCRUM-521.md` no existía. Búsqueda **por contenido** (`quienLoImporta`,
`path.join`, el propio `_alcance-desde-entradas.mjs`): sólo lo consume
`tests/scrum411-exports-inalcanzables.test.mjs` (dos llamadas, líneas 469 y 474) y nadie lo había
arreglado bajo otro número. **La premisa se verificó ejecutando, no leyendo** — y hubo que
corregirla; ver abajo.

## 1 · 🔴 LA PREMISA ERA CIERTA EN EL MECANISMO Y FALSA EN EL ALCANCE

El ticket decía: «*compara barras `/` contra `path.join`. En Windows devuelve `[]` SIEMPRE*».

**El mecanismo, confirmado.** `resolver()` tenía **dos salidas con separadores distintos**:

| rama de `resolver()` | qué devolvía | ejemplo medido |
| --- | --- | --- |
| normal (`./x`) | `path.resolve` → separador **nativo** | `C:\Users\…\src\core\storage\dirs.ts` |
| `dist/`→`src/` | `comoSrc + '.ts'`, heredando `norm` → **`/`** | `C:/Users/…/src/modules/system/domain/puertaClienteReal.ts` |

`quienLoImporta` comparaba contra `path.join(raiz, moduloRel)`, que en Windows da `\`. Así que
casaban las de la rama normal y **se perdían las de la rama `dist/`**.

**El alcance, NO.** `quienLoImporta` no devolvía `[]` siempre: devolvía listas **incompletas**.
Medido sobre el árbol antes de tocar nada:

```
ficheros analizados ............... 257
ARISTAS de import (con módulo) .... 1399
  casan con path.join (se ven) .... 1396
  SE PIERDEN por el separador .....    3
  ¿suman? ......................... SÍ
módulos que pierden importadores ..    2
importadores invisibles ...........    2
```

Las tres aristas perdidas, nombradas:

```
scripts/guard-aviso-bizum.mjs    --decidirAvisoBizum--> src/modules/billing/domain/avisoBizumSinTelefono.ts
scripts/puerta-cliente-real.mjs  --evaluarPuerta-----> src/modules/system/domain/puertaClienteReal.ts
scripts/puerta-cliente-real.mjs  --textoDelAviso-----> src/modules/system/domain/puertaClienteReal.ts
```

Las tres son `scripts/*.mjs` importando el **build** (`../dist/…`). Es coherente con el mecanismo:
sólo esa rama producía `/`.

> Se deja escrito porque cambia lo que hay que vigilar. Un guard construido sobre «falla siempre»
> daría verde sin probar el caso que de verdad falla — y en una máquina Windows, que son todas.

## 2 · 🔴 EL NÚMERO QUE SE PIDIÓ ANTES DEL CÓDIGO: **1 cero falso**

De las 3 aristas perdidas, sólo **una** dejaba una lista realmente vacía:

| export | antes | ¿era cierto? |
| --- | --- | --- |
| `puertaClienteReal.ts::textoDelAviso` | `[]` | **NO** — lo importa `scripts/puerta-cliente-real.mjs` |
| `puertaClienteReal.ts::evaluarPuerta` | `["…/avisoPuerta.service.ts"]` | incompleta, no vacía |
| `avisoBizumSinTelefono.ts::decidirAvisoBizum` | `["src/app.ts"]` | incompleta, no vacía |

**`textoDelAviso` era el único «cero» falso vivo del árbol.** Un `[]` ahí se lee como «no lo importa
nadie», que en un censo de alcance significa «se puede borrar».

## 3 · MEDICIÓN DEL DAÑO HACIA ATRÁS · **ninguna entrada se apoyó en el cero falso**

Buscado en `docs/master/` y en los consumidores del resolvedor:

| dónde | resultado |
| --- | --- |
| entradas de máster que citen `textoDelAviso` / `puertaClienteReal` como sin importadores | **0** |
| llamadas a `quienLoImporta` en la suite | 2, ambas en `scrum411:469` y `:474` |
| ¿alguna de esas 2 se apoyaba en un cero falso? | **NO** — son sobre `referral.service.ts`, y su `[]` es legítimo (nadie lo importa vía `dist/`) |
| ¿hereda el censo `censarAlcance` el defecto? | **NO** en los casos medidos: los tres salen `ALCANZABLE` por otras vías |

**No hay nada que listar como historia contaminada, y por tanto nada que corregir** (habría sido
STOP 4). El cero falso existía pero nadie llegó a citarlo — se cierra antes de que alguien lo
hiciera.

## 4 · Lo que se construyó

**① Una sola normalización, en un solo sitio.** Se arregla en `resolver()`, que es **la única puerta
por la que salen todas las rutas**: ahora toda salida pasa por `path.normalize`. Normalizar en el
consumidor habría repartido el defecto en tantos sitios como llamadas, y el que se olvidara volvería
a fallar en silencio — *un `replace` por llamada no es un arreglo, es una copia*.

**② El suelo, que es lo que decide el ticket.** `quienLoImporta` ya no puede contestar `[]` cuando lo
que pasa es que no ha podido mirar. Cuatro puertas, y cada una lanza diciendo **CIEGO**:

| suelo | antes | ahora |
| --- | --- | --- |
| no existe `src/` | `[]` | lanza |
| el módulo preguntado no existe | `[]` | lanza |
| corpus vacío (0 ficheros) | `[]` | lanza |
| el nombre **no es un export** del módulo | `[]` | lanza, y **enumera lo que sí exporta** |

El último es el que cierra el agujero de verdad: así es como un typo se convertía en un huérfano
declarado, y de ahí en un borrado.

**③ El vacío legítimo sigue existiendo.** Un resolvedor que nunca devuelve vacío no distingue mejor
que uno que siempre lo devuelve; `huerfano` sigue dando `[]`, sin lanzar.

## 5 · La evidencia

| Requisito | Dónde |
| --- | --- |
| **Control positivo**, enumerado uno a uno | `usado → ['src/app.ts']` y `soloScript → ['scripts/mide.mjs']`, con `deepEqual`. Sin enumerar, «ya no está vacío» y «devuelve cualquier cosa» dan el mismo verde. |
| **Control negativo** distinguible del ciego | `huerfano → []` **sin lanzar**, frente a los cuatro casos que sí lanzan. |
| 🔴 **Los dos separadores** | el mismo caso con `src/modules/lib.ts` y `src\modules\lib.ts` tiene que dar `deepEqual`. Es el test que decide: uno que sólo corriera con el separador de esta máquina daría verde con el defecto puesto. |
| **SUELO** | los cuatro casos de arriba, cada uno con su `assert.throws(/CIEGO/)`. |
| **Autoprueba sobre fuente sintética** | árbol temporal propio con respuesta conocida (3 exports, 1 importador por `src/`, 1 por `../dist/`, 1 huérfano). |
| **Cuadre** | `con + sin = total`, y además los nombres concretos — porque `0 + 0 = 0` también cuadra. |

> La fuente sintética es **propia y no la de SCRUM-411**: aquélla no tiene ningún `scripts/*.mjs`
> que importe vía `../dist/`, y añadírsela cambiaría el veredicto de `motorMuerto` y rompería **su**
> autoprueba por un motivo que no es suyo.

## 6 · Línea base de `npm test`, sobre esta rama

| | tests | pass | fail | skip |
| --- | --- | --- | --- | --- |
| **Base** (worktree nuevo sobre el ancla) | 3685 | 3608 | **0** | 77 |
| **Al cerrar** | 3691 | 3614 | **0** | 77 |

`npm ci` volvió a saltarse el postinstall (`npm warn allow-scripts`); el cliente de Prisma se
regeneró con `npm run prisma:generate` y **se comprobó** que decía «Generated Prisma Client».

## 7 · El rojo, probado por el mecanismo

**SHA del commit en verde previo a la mutación: `<PENDIENTE>`.**
