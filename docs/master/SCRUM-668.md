# SCRUM-668 · La base de pruebas y staging son la misma, y es la tercera vez

**Medido contra:** `origin/main` = `d9f60f7e89cc600e4d518af50ad2a977ed1876ba` · 2026-09-04T14:18:49+02:00
**Rama:** `scrum-668-staging-contaminado`

> Ticket de **diagnóstico**: se mide, se ponen las opciones con su coste y se para. La decisión
> de separar las bases es del fundador. Este commit **no cambia ninguna variable de entorno, no
> toca Railway y no borra nada** — sólo escribe el interino que el fundador decidió.

---

## 1 · PASO 0 (regla 39) — ¿coinciden HOY?

**Sí, en tres de los cuatro carriles.** Y no hace falta abrir ningún `.env` para saberlo: **lo
declara el propio repo**, en `scripts/_clave-vs-destino.mjs`, que existe justamente para eso.

| clave | host | base |
|---|---|---|
| `DATABASE_URL_STAGING` | `acela` | **`railway`** |
| `DATABASE_URL_TESTS` en `cobroflash-b1`, `b2`, `b3` | `acela` | **`railway`** ← la misma |
| `DATABASE_URL_TESTS` en `cobroflash-backend` | `acela` | `yaqu_dev_javier` |

**No es deriva: está escrito así.** El reparto por carril es deliberado (23-jul-2026, aislar los
carriles entre sí) — pero el reparto elegido hace que en tres carriles la base de pruebas **sea**
staging. SCRUM-383 ya arregló el NOMBRE (`_STAGING` → `_TESTS`, para que la clave no prometiera
una base que no era); no movió la fontanería, a propósito.

**Control positivo:** el barrido encuentra las dos claves donde ya se sabía que estaban, y las
cuatro que declara el fichero cargan. Sin eso, un «no coinciden» diría «no supe mirar».
**Suelo:** cero variables de conexión encontradas se declara ciego, no limpio — y saltó de verdad
una vez, cuando el barrido leyó rutas relativas y devolvió 0 atributos.

🔒 **No se ha impreso ninguna cadena de conexión, ni real ni de ejemplo.** El cotejo por disco se
hizo comparando hashes sha256 truncados; el cotejo bueno salió de la declaración del repo, que ya
sólo habla de host y nombre de base (R7, SCRUM-226).

## 2 · Qué escribe la suite ahí, y cuánto

| | |
|---|---|
| ficheros de test gateados por `DATABASE_URL_TESTS` / `QA_DB_TEST` | **61** |
| lo que barre `_merchant-fixture.mjs` por merchant creado | **23 modelos** |
| ¿corre esto en CI? | **No.** `ci.yml:44` declara que esas claves no entran en Actions |

O sea: la contaminación es **local y de los carriles b1/b2/b3**, no de CI.

## 3 · ¿Alguna medición reciente pudo verse afectada?

**Las de esta sesión, no — y con evidencia, no con confianza.** Todas fueron contra
**producción**: la salida de `parseBDSegura` decía `{"host":"autorack.proxy.rlwy.net", …}`, que es
`autorack`, no `acela`. De ahí salieron el censo de firmas, el `col_signature_url = 0` y el
conteo de duplicados.

**De las de otras sesiones: NO LO SÉ.** No se ha barrido quién midió qué contra `acela/railway`
ni cuándo. **«No lo sé» es un resultado; «no» sin medir no lo es**, y por eso no se escribe «no».

## 4 · Las opciones, con su coste

| | qué | coste |
|---|---|---|
| **A** | una base de test propia por carril (`yaqu_tests_b1/b2/b3`) | crear tres bases y sembrarlas — **necesita infraestructura** |
| **B** | los tres carriles a `yaqu_dev_javier`, como el principal | cero infraestructura, pero **pierde el aislamiento** que el reparto busca |
| **C** | dejarlo y declarar que staging no es sujeto de medida | gratis, pero se pierde el único entorno parecido a producción |

📌 **`assertSafeStagingUrl` no estorba a ninguna:** es allowlist de host (`acela`) y es
fail-closed. Las tres opciones siguen en ese host. **No se relaja.**

## 5 · La decisión del fundador, y dónde queda escrita

> **Interino desde el 4-sep-2026: STAGING queda declarada CONTAMINADA y NO válida como sujeto de
> medida.** Coste cero, y ya era verdad.
> **Objetivo real: la opción A**, que espera a Javier por la infraestructura.
> **Descartada la B:** cuatro sesiones escribiendo en la misma base es cambiar un problema por otro.

Anotado donde lo lea quien mida staging mañana, **no en un ticket que nadie abre**:

* `docs/RUNBOOKS.md` — justo **encima** del mapa de bases por worktree, que es lo que se consulta
  para saber a qué base apunta uno.
* `docs/MIGRATIONS_PENDING.md` — el mismo bloque. **No por simetría:** `scrum225` declara que ese
  bloque es idéntico verbatim en los dos documentos, y **cazó en rojo** el commit que sólo tocó
  uno. El guard hizo su trabajo.
* `scripts/_clave-vs-destino.mjs` — sobre el mapa que declara la colisión, porque quien mira ese
  fichero está preguntándose exactamente esto.

En los tres queda dicho lo mismo: staging **sirve igual** para correr la suite, probar una pantalla
o ensayar un `db push`. Lo que se retira es su valor como **fuente de una cifra**.

## ⛔ No tocado

Ninguna variable de entorno · Railway · ninguna base · `assertSafeStagingUrl` · el reparto por
carril · la rama `scrum-653-dos-firmas`, que sigue bloqueada esperando el ALTER de Javier.
