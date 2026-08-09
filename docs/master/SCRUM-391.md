# SCRUM-391 · Guards huérfanos: el mecanismo en main y su vigilante en una rama

**Fecha:** 9-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `7fae90fc9ba4cbfa41034c6d1d99b2cdaa353e44` · 2026-08-09T18:05:00+02:00

> **ENTREGA PARCIAL Y DECLARADA.** Está el **mecanismo que impide que vuelva a pasar** —lo que el
> encargo llama «lo que de verdad cierra este ticket»— con sus rojos por `$?`. **No está** la
> extracción de los guards que deben entrar: se identifican abajo con su motivo.

## El guard que cierra el ticket

`tests/scrum391-guards-declarados-presentes.test.mjs`. La pregunta que responde es la del encargo:
**¿está en el árbol lo que decimos que nos vigila?**

**Derivado de la constancia, no de una lista.** Cada `docs/master/SCRUM-<n>.md` declara los tests
del ticket (convención de SCRUM-273), así que la fuente es esa misma constancia: se leen las rutas
`tests/*.test.mjs` que las entradas nombran y se exige que **existan**.

- **No inspecciona literales de código**, sino RUTAS de fichero en markdown. Una ruta no puede
  «pasar a ser una expresión», así que la trampa del ternario / `||` / objeto indexado —que mordió
  tres veces— **no aplica aquí**. Es la única forma que encontré de que el detector no pueda
  quedarse ciego de esa manera.
- **NO hay allowlist.** Si una entrada declara un test que ya no debe existir, lo que se corrige es
  **la entrada**: es la constancia que dejó de ser cierta.
- El **suelo es un número a mano** (`MINIMO_ENTRADAS`, `MINIMO_DECLARACIONES`). Derivarlo del propio
  directorio haría que borrar entradas bajara el mínimo y el suelo dejara de serlo (lección de
  SCRUM-379).

### Lo que devuelve hoy

**103 entradas · 135 declaraciones · 4 HUÉRFANOS.**

### Verificación, por `$?`

| Qué | `$?` |
|---|---|
| Rojo por el mecanismo: se saca `scrum387-censo-reparto` (su mecanismo sigue en main) | **1**, NOMBRANDO la entrada y el fichero |
| Suelo: desaparece `docs/master/` | **1**, con el ENOENT y la ruta — nunca «están todos» |
| Suelo: el detector ve menos declaraciones de las que hay | **1** («solo 135 … en 103 entradas») |
| Control negativo: declaraciones que sí existen | no salta |

## 🔴 EL GUARD ESTÁ ROJO EN MAIN, y el defecto es real y AJENO

Los cuatro huérfanos son de **SCRUM-300 (C5)**, ticket vivo de otro carril:

```
SCRUM-300.md → tests/scrum300-albaran-campos.test.mjs
SCRUM-300.md → tests/scrum300-albaran-firmado-por.test.mjs
SCRUM-300.md → tests/scrum300-microcopy-firmante.test.mjs
SCRUM-369.md → tests/scrum300-albaran-firmado-por.test.mjs
```

Y **el mecanismo SÍ está en main**: `firmadoPorNombre`, `firmadoPorCalidad` y `lugarEntrega` están
en el schema (me lo descubrió un build roto por cliente Prisma viejo). O sea, **es exactamente el
defecto de este ticket**, en vivo.

Dos de los tres viven en `scrum-300-firmado-por`, sin mergear. **`scrum300-albaran-campos.test.mjs`
no existe en NINGUNA rama**: esa declaración nombra un test que nunca se escribió.

**No lo arreglo (regla 9):** ni traigo sus tests ni corrijo su entrada. Decide el carril de C5 —
traer los tests o corregir la constancia—. Hasta entonces este guard **no puede mergearse verde**,
y eso no es un defecto del guard: es el guard haciendo su trabajo el primer día.

## Los 16, uno por uno

| Guard | Veredicto |
|---|---|
| `scrum166-un-solo-comando` | **SE RETIRA.** Su DoD pedía eliminar `test:staging:gated`; main lo conserva **a propósito**, con el motivo escrito en `package.json` (`"//test:staging"`: ~8 documentos citan uno u otro nombre). Aquí el guard no falta: **sobra**. |
| `scrum195-url-bd-sin-fuga` | **ENTRA.** Main tiene `scrum226-url-credencial-en-argv`, que vigila **el argv**; el huérfano vigila que un **mensaje de error** no imprima la URL. **Son fugas distintas** — y la del huérfano es la que costó rotar una credencial de producción. |
| `scrum245-sin-listas-blancas` | **ENTRA.** Los tres `scrum245-*` de main vigilan otra cosa (el `merchantId` del llamador, la exención demo). El huérfano vigila el requisito J0: **ningún envío se decide comparando el destino contra una lista**. No está cubierto. |
| `scrum222-assert-arranque` | **YA EXISTE CON OTRO NOMBRE**: `tests/scrum222-deriva-arranque.test.mjs`, sobre `src/core/db/schemaDrift.ts`. |
| `scrum222-manifest` | **SE RETIRA.** Vigila `prisma/schema-manifest.json`, que **no existe en main**. Sin mecanismo no hay nada que vigilar. |
| `scrum340-contador-plazas-reales` | **YA EXISTE CON OTRO NOMBRE**: `tests/scrum330-contador-solo-activas.test.mjs`. El censo acertó: **lo construyó el 330**. |
| `scrum253-adopcion-mismo-dueno` | **YA EXISTE**: `tests/scrum253-adopcion.test.mjs`. |
| `scrum216-tipo-rectificativa` | **YA EXISTE**: `tests/scrum216-tipo-rectificativa-sin-defecto.test.mjs`. |
| `scrum295-modelo-303` (×2) | **YA EXISTEN**: `scrum295-modelo-303.test.mjs` y `scrum295-modelo-303-postgres.test.mjs`. |
| `scrum300-*` (×3) | **PENDIENTE, y es el rojo de arriba.** Mecanismo en main, guards sin mergear. **Carril de C5** (regla 9). |
| `scrum329-legal-pagina-publica` | **SE RETIRA.** El mecanismo **no está en main**: F2 se aparcó sin terminar. Un guard sin mecanismo no vigila nada. |
| `scrum172-tenencia-nullable` | **PENDIENTE DE MEDIR.** `MODELOS_POR_MERCHANT` sí está en main; **`TENENCIA_NULLABLE_CUBIERTA` no**. El guard exige una declaración que no existe: entra solo si se construye esa lista, y eso es alcance nuevo, no precisión. |
| `scrum224-sw-revalida` | **PENDIENTE DE MEDIR.** Main tiene `scrum224b-sello-build`, `scrum274-huella-estaticos` y `scrum274-shell-alineado`; hay que comprobar por contenido si alguno cubre la revalidación del SW. |

## Lo que falta para cerrar

1. **Extraer** `scrum195-url-bd-sin-fuga` y `scrum245-sin-listas-blancas` (se EXTRAEN, no se mergean
   las ramas), con su **rojo probado en main**.
2. Medir por contenido `scrum172` y `scrum224`.
3. Que el carril de C5 resuelva sus cuatro declaraciones — y entonces este guard entra verde.

Ficheros: `tests/scrum391-guards-declarados-presentes.test.mjs` (3, nuevo).
