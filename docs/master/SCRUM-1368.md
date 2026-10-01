# SCRUM-1368 · El latido avisa cuando el último despliegue ha FALLADO

**Medido contra:** `origin/main` = `36071b72e69f04d3b7b39f2942c899f7f27037ae` · 2026-10-01T13:13:22Z

A9: comprobación → `tests/scrum1350-latido.test.mjs`

Carril S5. Sólo `scripts/equipo/latido.mjs` y su test.

## Lo que pasó

El despliegue de `36071b72` (merge de #2091, mío) pasó a `failure` en Railway a las 13:08:19Z, 28 s
después de crearse. `yaqu.app/version` servía `425065aa`, el commit anterior: producción en pie y un
commit por detrás de `main`.

El latido, corrido a las 13:15Z desde `origin/main`, dijo:

    ✅ DESPLIEGUE · 5 despliegues mirados · el último: 36071b72 → failure

El dato estaba escrito y la sección salía en verde. `seccionDespliegue` sólo avisaba de un
`in_progress` de más de 10 min. Lo vi porque leí la línea entera, no porque el instrumento lo cantara.

## El cambio

Si el despliegue MÁS NUEVO tiene `failure` o `error` como último estado, la sección avisa: dice el sha
y que producción sigue en lo anterior. Sólo el más nuevo: un fallo viejo con un despliegue bueno o en
marcha por delante no avisa.

## Comprobado

| Qué | Resultado |
|---|---|
| Dirigida `tests/scrum1350-latido.test.mjs` | 27 tests, 27 pasan |
| El latido real, desde este árbol, 13:13Z | `🔴 DESPLIEGUE … el ÚLTIMO despliegue (36071b72) terminó en failure` |
| El caso real (`failure, in_progress, in_progress` en el más nuevo) | avisa, salida 1 |
| `error` en el más nuevo | avisa |
| Fallo en el anterior, éxito en el más nuevo | no avisa |
| Fallo en el anterior, el más nuevo en marcha | no avisa |
| Mutación: quitar la comprobación | cae el test nuevo |

## Lo que NO entra, y no sé

- **Por qué falló el despliegue de 36071b72.** No tengo los logs de Railway. #2091 toca un script del
  equipo, un test y documentación; 28 s es poco para un build. No lo he reintentado: es producción.
- **Cuántos commits va producción por detrás** (pedido por el orquestador): no está. Hace falta leer
  `yaqu.app/version` y compararlo con `main`; queda para el relevo.
- Medido por el orquestador: de 40 despliegues del día, 1 `failure`. No es sistemático.
- El latido sigue leyendo lo que Railway le dice a GitHub, no lo que sirve `yaqu.app`. Que `main` y
  `/version` discrepen sin que haya un estado `failure` no lo ve esta sección.

## Mis errores

1. La sección la construyó este puesto hoy mismo (SCRUM-1350) pensando en un solo modo de fallo, el
   atasco, porque era el que se había medido. El fallo a secas no estaba porque no se había visto.

---

# SCRUM-1368 · segunda parte: cuántos commits va producción POR DETRÁS de main

**Rama:** `scrum-1368b-prod-por-detras` · **Carril:** S5 (s5-1octd) · **Fecha:** 1-oct-2026
**Medido contra:** `origin/main` = `31688d6b550ea0bbc1b99b381fdf857b821bdec9` · 2026-10-01T13:29:00Z

A9: comprobación → `tests/scrum1350-latido.test.mjs`

La primera parte (#2093) entró en `main` a las 13:26:59Z mientras esto se escribía sobre su rama: por
eso va en rama nueva y no como un commit más de aquélla.

## Qué faltaba

El aviso decía «main NO está desplegado» y mandaba a mirar `yaqu.app/version` a mano. Sin la cifra no
se sabe si el rojo importa: no es lo mismo un commit de documentación que cuatro con código.

## El cambio

- El latido lee `https://yaqu.app/version` (15 s de plazo) y pregunta a GitHub cuántos commits tiene
  `main` por delante de ese sha (`compare/<sha>...main` → `ahead_by`).
- La cifra va **siempre** en la población de DESPLIEGUE, y dentro del aviso cuando el último
  despliegue falla.
- Tres respuestas distintas, y ninguna se puede leer como otra: `N commit(s) POR DETRÁS` · `ES la
  punta de main (0 commits por detrás)` · `NO PUDE LEER qué sirve producción` / `NO SUPE contar`.
  Una página de error o un sha corto en `/version` no son un sha (`shaDeVersion`).
- `todo()` pasa a ser asíncrona para poder usar `fetch`; no se lanza un segundo proceso.
- **Cronómetro.** La última línea del latido dice cuánto tardó cada tramo y cuántas veces llamó a
  `gh`. No arregla la lentitud: hace que la próxima pasada lenta diga DÓNDE se fue el tiempo.

## Comprobado

| Qué | Resultado |
|---|---|
| Dirigida `tests/scrum1350-latido.test.mjs` | 28 tests, 28 pasan, 0 saltados |
| El latido real desde este árbol, 13:28Z | `producción sirve 2cb81e32: 2 commit(s) POR DETRÁS de main`, con el último despliegue `in_progress` |
| Contraste a mano | `/version` daba `2cb81e32…`; `main` era `31688d6b` (el merge de #2093 y su commit: 2) |
| Cronómetro, misma pasada (13 PR abiertos) | 32,7 s: PR 16,6 s (28 llamadas a gh) · main 3,8 s (5) · despliegue 3,5 s (7) · logs de los rojos 8,4 s (3) · resto 0,4 s |

## Lo que NO sé

- **Por qué a veces tarda 245 s.** Una sola pasada medida, y fue de las rápidas. Lo que sí dice: el
  coste son las llamadas a `gh` (~0,6 s cada una, dos por PR abierto) y los logs de los rojos (~2,8 s
  cada uno). Cada llamada tiene 60 s de plazo: una que se cuelgue explica un minuto entero. Hipótesis,
  no medición; la línea del cronómetro lo dirá la próxima vez que ocurra.
- El caso `failure` con cifra real no lo he visto en producción: hoy el último despliegue no estaba
  en fallo. Está cubierto por el test, no por una pasada real.
- Que `main` y `/version` discrepen SIN ningún `failure` sigue sin avisar: la cifra sale en la
  población, bajo etiqueta verde si no hay otra cosa. No he puesto umbral porque ir 1-2 commits por
  detrás durante un despliegue es lo normal y no tengo medido cuánto dura eso.

## Mis errores

1. Metí el cronómetro con un reemplazo desde PowerShell y se comió los `$` de las plantillas: el
   fichero quedó con un error de sintaxis. Lo cazó `node --check` antes de correr nada. Estaba
   avisado en el traspaso («texto largo a fichero, no por PowerShell») y lo repetí.
