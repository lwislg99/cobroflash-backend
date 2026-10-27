# SCRUM-1605 · El aviso «Producción congelada» (#2455) no se cerraba nunca: ahora el vigía lo cierra cuando producción vuelve a estar al día

**S5 (equipo de Luis)** · 27-oct-2026

**Medido contra:** `origin/main` = `8d2a780369e0dc9e08e2a5552d3a24a61483aeba` · 2026-10-27T15:54:43Z

A9: comprobación → `tests/scrum1605-el-aviso-se-cierra.test.mjs`

## 0 · La respuesta corta

- **La causa, leída en el código** (`.github/workflows/vigia-despliegue.yml` de main): el paso de aviso sólo corre con
  `salida == 1` y abre o comenta. El único `gh issue close` del workflow era el del simulacro, que sólo recoge el
  Issue que abrió él mismo. Con `salida == 0` ningún paso tocaba el Issue: **el vigía no cerraba nunca lo que abría.**
- **El aviso NO mintió diez días.** `gh run list --workflow vigia-despliegue.yml`: rojo de verdad del 21-oct 19:43Z al
  23-oct 19:35Z (10 pasadas programadas, entre ellas la de las 02:16Z: `atrasado · prod=fe65a8b7 · main=82f3ea41 ·
  hueco=37.6h · commits=229`). Después, **verde en las 17 programadas del 23-oct 22:42Z al 27-oct 13:41Z**, con #2455
  abierto. La premisa del ticket («10 días con producción sana») vale desde el 23-oct por la noche, no desde el 14.
- **El arreglo:** paso nuevo «Cerrar el aviso si producción vuelve a estar al día», con la decisión en
  `decidirCierre` (`scripts/vigia-despliegue-aviso.mjs`, pura y con tests).

## 1 · Qué cierra y qué no

| Lectura del vigía | Qué hace |
|---|---|
| renglón `al-dia` + Issue abierto con la marca | comenta **desde cuándo** está sana (primera lectura `al-dia` seguida y la anterior que no lo era) y **cierra**; luego lo comprueba leyendo el estado en GitHub |
| `atrasado` con salida 0 («retrasado pero desplegando») | nada: su renglón dice `atrasado` |
| `no-supe-mirar`, simulacro, o ningún aviso abierto | nada |
| sin lista de Issues, sin marca o sin renglón legible | **no-se-sabe**: `::error::` y el run en ROJO |
| cerrado, pero GitHub no lo da por `closed` | `::error::` y el run en ROJO |

Aceptación 4: cerrado el Issue, la siguiente congelación no encuentra ninguno abierto y **crea uno NUEVO**, con la
lectura (y su fecha) en el cuerpo.

## 2 · Dos guards cayeron, y se arregló el CÓDIGO (regla 41)

- `scrum677b` prohíbe `continue-on-error` en el vigía programado, **también en un comentario**. La primera versión lo
  usaba para que «no pude cerrar» no pusiera el run en rojo. Ahora no lo lleva, y «no pude» sale en rojo, que es la
  regla de la casa. ⚠️ Consecuencia: en ese caso el latido dirá «terminó en FAILURE: NO miró», y no es exacto (sí miró,
  pero no pudo cerrar). El resumen del job dice lo que pasó de verdad.
- `scrum1123d` exige que, desde el paso de aviso hasta el final, la única `MARCA:` sea la suya. El paso de cierre va
  **antes** del aviso. Los dos se excluyen por `salida`, así que el orden no cambia nada.

## 3 · Cómo se mide

- `tests/scrum1605-el-aviso-se-cierra.test.mjs`, 9 casos: cierra sólo con `al-dia` · «al menos desde» si el historial
  no llega a la lectura anterior · falla cerrado · **las dos mitades en secuencia** (congelada → comenta · al día →
  cierra · otra congelación → crea uno NUEVO) · CLI sin `VIGIA_ISSUES_JSON` → salida 1 · cableado del YAML · una sola
  marca, la que lee el latido.
- Junto con los 8 ficheros que ya miraban este vigía: **91 tests, 91 pass, 0 fail, 0 skipped**.
- **Mutación** (base sin mutar en verde; banco temporal fuera del árbol): cerrar con cualquier veredicto → caen 4 ·
  quitar `!inputs.simulacro` → caen 2 · lista ausente tratada como `[]` → caen 2. Las tres mueren, y los ficheros
  quedaron restaurados byte a byte.

## 4 · Lo que NO se ha medido todavía

- **Que la API de GitHub acepte el cierre de verdad.** El control real es lanzar el vigía con `workflow_dispatch` sobre
  esta rama (debe cerrar #2455) y después el simulacro (sin nada abierto, debe CREAR uno nuevo y recogerlo). Lo que
  salga va en el PR y en Jira, no aquí: este registro se escribe antes del push.
- Que las pasadas programadas lleguen cada 3–6 h aunque el cron diga «cada 2 h»: se ve en la misma lista de runs,
  pero no es de este ticket.
