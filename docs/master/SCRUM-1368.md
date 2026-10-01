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
