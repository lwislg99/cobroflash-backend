# SCRUM-252 · GUARD-PRISMA-2: «¿este cliente salió de ESTE `schema.prisma`?»

**Fecha:** 3-ago-2026 · **Carril:** B (QA/guards) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `44c1dfd30125e2a3107c5db03466c8b63dd675ab` · 2026-08-03T11:38:47+02:00

> ⚠️ **Qué es exactamente esa hora, para que el ancla no ancle a otra cosa (R14):** es el
> `committer date` del primer commit del trabajo (`17e45a1`), **no** una lectura de reloj del
> instante de la medición. Esa lectura no la tengo y no se reconstruye. Lo que sí acota: la sha
> de referencia se creó a las `2026-08-03T11:12:38+02:00` y el commit se hizo a las `11:38:47`,
> así que **toda la medición cae dentro de esa ventana de 26 minutos**.
>
> **La sha no sale de memoria:** `git reflog` de la rama dice `44c1dfd … branch: Created from
> origin/main`, y `git merge-base 44c1dfd scrum-252-procedencia-cliente` devuelve esa misma sha.
>
> Y el `55fd152` que cita esta entrada **no es esto**: es el commit histórico de sep-2025 que el
> guard persigue, no la referencia contra la que se midió el trabajo.

## El defecto

El guard de [SCRUM-235](SCRUM-235.md) compara el conjunto de nombres de COLUMNA en los dos
sentidos, y **lo declara en su cabecera**: no mira tipo, opcionalidad, `@default` ni
`@db.<nativo>`. No engañaba a nadie — pero la mitad que faltaba es real.

**Medido ejecutando, no leyendo:** con un `id Int` → `String` inyectado —ningún nombre cambia—
aquel guard sale **VERDE**. Es el caso real de `55fd152` (23-sep-2025, migración
`20250921193122_ids_autoincrement`), donde **nueve campos** pasaron de `String` a `Int` sin que
cambiara un solo nombre.

Los dos modos de fallo son distintos, y por eso importa:

* **SCRUM-235** → el cliente pide una columna que la BD no tiene. La base rechaza la consulta.
* **Esto** → la columna existe y responde; falla la **deserialización en el cliente**. La base no
  protesta: protesta el cliente, más tarde, y con un error que no nombra el schema.

## El ticket pedía menos de lo que hacía falta

Su alcance era comparar tipo y opcionalidad campo a campo con más regex. **Cubre menos y cuesta
más**: cada propiedad pide una regex nueva, y quedan fuera `@default`, `@db.<nativo>`, relaciones,
índices y `@@map`.

**La pregunta de raíz se puede responder entera.** El cliente generado guarda una **copia del
schema del que salió** (`node_modules/.prisma/client/schema.prisma`), así que comparar los dos
textos trae todo eso de golpe **sin parsear nada**.

## Se AÑADE, no sustituye

Son dos propiedades distintas y no se canibalizan:

* **SCRUM-235** verifica **lo que el cliente va a emitir** (su DMMF). Verdad de EJECUCIÓN.
* **Esto** verifica la **PROCEDENCIA**: que el cliente salió de este texto exacto.

Construir *además* el alcance literal del ticket habría sido el defecto de SCRUM-198 y SCRUM-216:
dos arneses del mismo hecho, mantenidos aparte.

## 🚨 El suelo, innegociable

`node_modules/.prisma/client/schema.prisma` es **detalle interno de Prisma, no API documentada**.
Si desaparece o cambia de sitio, el guard se pone **ROJO, jamás verde** — uno que se queda ciego en
silencio sigue firmando un verde que ya no significa nada.

**Segundo suelo, del mismo tipo:** si la normalización se comiera el texto, dos schemas cualesquiera
saldrían iguales. Se exige que lo normalizado conserve ≥100 líneas.

Y la ruta se resuelve por el **mismo camino que carga la app** (`require.resolve('.prisma/client')`),
no a mano: con `node_modules` compartido por junction entre ~79 worktrees, la ruta literal y el
módulo que se carga de verdad pueden no ser el mismo sitio.

## Las cuatro normalizaciones, con su porqué

La copia del cliente **no es byte a byte**: Prisma la guarda formateada (40 227 bytes en el repo,
39 270 en el cliente).

1. **Fin de línea** — plataforma, no schema.
2. **Espacios** — el formateador **alinea en columnas**; es la mayor parte de esos 957 bytes.
3. **Comentarios** — y no es cosmética: sin recortarlos, cambiar un comentario pondría en rojo la
   suite de **todos** los worktrees, que comparten `node_modules` por junction. Un guard que grita
   sobre un árbol sano se desactiva en una tarde.
   Que recortar es seguro se comprobó **contándolo, no razonándolo**: el schema tiene **273 cadenas
   entrecomilladas y 0 con `//` dentro**.
4. **Orden de atributos** — Prisma canonicaliza `@db.Text @map(x)` como `@map(x) @db.Text`. Es el
   **único** reordenamiento que hace, medido: con las otras tres quedaban 6 líneas distintas y las
   6 eran esto.

Ninguna opera sobre otra cosa que la PRESENTACIÓN.

## Defecto real encontrado en la propia construcción

El orden de atributos se extraía con `/@[\w.]+(\([^)]*\))?/g`, que corta en el **primer** `)`. Con
`@default(autoincrement())` truncaba y, al reconstruir la línea con los trozos reconocidos, **lo de
fuera se perdía en silencio** — texto descartado sin avisar es donde se esconde una diferencia.

**Lo cazó el rojo de `55fd152` al exigir la línea EXACTA en el mensaje**; un `assert` de «cae» a
secas lo habría dejado pasar. Ahora es un escáner que respeta paréntesis anidados y comillas, con
test de regresión.

## El test de la ruta con espacios: era el TEST, no el helper

CI (`ubuntu-latest`) daba rojo donde local (Windows) daba verde. **El helper está bien** — con la
URL construida como en SCRUM-235 (`pathToFileURL(p).href`) devuelve `true` aunque la ruta lleve
espacio; `fileURLToPath` decodifica.

**El test estaba mal, de dos formas:**

1. Construía la URL concatenando `` `file:///${ruta}` ``. En Windows la ruta empieza por `C:` y sale
   válida; en Linux empieza por `/` y sale `file:////tmp/…` con **cuatro barras** →
   `ERR_INVALID_FILE_URL_PATH` → el `catch` devuelve `false`. **El mismo test medía cosas distintas
   según dónde corriera.**
2. **Ni siquiera probaba el peligro que decía probar**: un espacio literal no es lo que produce
   `import.meta.url`, que viene percent-encodeado.

Se adopta la forma de SCRUM-235 sin reinventar, más un `assert.match(url, /%20/)` para que el test
no pueda degradarse otra vez a «concatenar y no probar nada» — vigila su propio modo de fallo.

## Enganche

`pretest`, `pretest:staging`, `pretest:staging:gated` y `guard:prisma`, al lado del de 235, que
queda **intacto**. Comprobado de extremo a extremo: con el schema roto `npm test` aborta con
`exit=1` y el mensaje **nombra la línea cambiada**. Hay un test que exige que el enganche siga ahí:
escrito y nunca ejecutado no protege nada.

**El control «árbol sano → verde» corre en `npm test` contra el cliente real**, para que una deriva
futura del formateador se cace en la suite y no en la noche de alguien.

## Límite declarado de la medición

No se pudo ejecutar el camino Linux en la máquina de desarrollo (Windows rechaza una URL `file://`
sin letra de unidad). La evidencia de que pasa en CI es la identidad con el constructo de SCRUM-235,
verde ahí, y que `pathToFileURL` es nativo de plataforma por construcción.

## Ficheros

* `scripts/_prisma-procedencia-guard.mjs`
* `package.json` (4 enganches)
* `tests/scrum252-procedencia-cliente.test.mjs` (16)

Suite **1059, 0 fallos**.
