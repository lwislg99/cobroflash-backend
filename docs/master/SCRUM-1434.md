# SCRUM-1434 · un `gh api` caído ya no pone ROJO `zona-roja.yml`, ni se lee como «no hay comentario»

## 17-oct-2026 · S5 · `set +e` explícito y la búsqueda del comentario separada de la elección

**Medido contra:** `origin/main` = `e59be9fa384b5bb1d4fbaa6d429a32a5a8a6be8d` · 2026-10-17T23:47:27Z

Ancla de `node scripts/equipo/ancla.mjs` · rama `scrum-1434-zona-roja-gh-api-sin-tumbar`.

A9: comprobación → `tests/scrum1434-zona-roja-gh-caido.test.mjs`

### Lo que había
La 3 del censo de S0 en `docs/master/SCRUM-1123.md`: `zona-roja.yml:113-115` buscaba su comentario
con `ID=$(gh api … 2>/dev/null | head -1)`. El paso decía «`set -e` NO», pero Actions lo invoca con
`bash -e {0}` (log de la corrida 35366350410, medido por S0) y el propio paso pone `pipefail`. Si
`gh` fallaba, el paso moría antes de su `exit 0`: el workflow que promete no salir rojo nunca, rojo.

### Por qué no bastaba un `|| true`
`gh` deja el cuerpo JSON del error en stdout (medido en SCRUM-853). Con `|| true`, el paso sobrevive
pero el `ID` es el error y se hace un PATCH a ciegas; y si la lectura saliera vacía, «no pude
buscarlo» se lee como «no hay ninguno» y se crea un comentario NUEVO en cada push, justo lo que la
sección 4 del paso existe para impedir. Es la familia de «no pude mirar» = «no hay nada».

### El arreglo (sólo `.github/workflows/zona-roja.yml`, carril S5 por `dos-equipos.md:167`)
- **`set +e -uo pipefail`**: el `-e` que pone Actions se QUITA a mano. El comentario por fin es verdad,
  y cualquier orden sin guardar que se añada mañana tampoco puede pintar el job de rojo.
- **Leer y elegir, separados**: `if ! IDS="$(gh api …)"; then IDS="?"; fi`, se toma la primera línea
  sin tubería, y un `case`: vacío → POST · sólo dígitos → PATCH · cualquier otra cosa → NO escribe,
  y lo dice con `::warning title=Zona roja::` (se ve en el PR) y en el resumen del job.

### Los dos sentidos
El job, por contrato (cabecera del fichero, SCRUM-168), **no cae nunca**: «cuando de verdad toca»,
aquí, no es un rojo sino que el aviso SALGA y COMENTE. El test ejecuta el `run:` REAL con `bash -e`,
un `gh` y un `git` falsos y el detector real, en un temporal fuera del repo:

| Escenario | Esperado | Sobre `main` (e59be9fa) | Con el arreglo |
|---|---|---|---|
| `gh` cae al buscar | sale 0, no escribe, `::warning` + resumen | **status=1, ROJO** | ✔ |
| `gh` devuelve basura con 0 | no la usa como id | **PATCH con la basura** | ✔ |
| el paso empieza por `set +e` | sí | **no** | ✔ |
| la escritura falla | sale 0 y lo dice | ✔ | ✔ |
| sin comentario previo | UN POST | ✔ | ✔ |
| con comentarios `123`,`456` | PATCH al 123, ningún POST | ✔ | ✔ |
| PR fuera de la zona roja | ninguna llamada a `gh` | ✔ | ✔ |

Suelos: hay bash, ve `node`, el `gh` falso falla como el real; y `bash -e -c 'set -uo pipefail;
X=$(false | head -1)'` muere (si no muriera, el «gh cae» saldría verde también sobre el fichero viejo).

Mutaciones (`MUTACIONES_QUE_ME_TUMBAN`, cuatro), cada una aplicada con Edit sobre el árbol commiteado,
medida y devuelta; `git status` limpio después:

| Mutación | Cae |
|---|---|
| `set +e -uo pipefail` → `set -uo pipefail` | «el paso se quita a mano el -e…» |
| `IDS="?"` → `IDS=""` | «gh caído al buscar…» (hace POST) |
| `*[!0-9]*)` → `__nunca__)` | «gh responde basura…» |
| `ID="${IDS%%$'\n'*}"` → `ID="$IDS"` (aislada) | «con comentario previo: lo ACTUALIZA…» |

### Lo que NO se ha hecho
- Las otras dos del censo de S0 (`vigia-despliegue.yml:214`, `vigia-atascados.yml:220`): fuera de
  este ticket; salen rojo sin decir por qué, pero nunca verde en falso.
- No se ha visto una corrida real del workflow con `gh` caído: lo que hay es el `run:` real ejecutado
  con un `gh` falso. El PR de este ticket es la primera corrida con el fichero nuevo.
