# SCRUM-1101 · El guard de acreditación INVOICING_ES deja rastro de cada ejecución

**Medido contra:** `origin/main` = `00179a513a5fb11ca12d61fe25b1b2dec26b51ca` · 2026-10-23T09:33:48Z
**Rama:** `scrum-1101-rastro-por-ejecucion` · **Puesto:** J6 (sesión `jv-j6ai`; el hook de arranque dijo «SIN IDENTIDAD», SCRUM-1498, y se siguió por orden del orquestador) · **Encargo:** orquestador `cobroflash-backend-62`, 23-oct-2026

## PASO 0 — qué había hecho y qué no

- `git log origin/main --grep=SCRUM-1101`: 0 commits. Ramas `scrum-1101*` en el remoto: 0. PR que lo citen: 0 (el único resultado de la búsqueda, #1942, es de SCRUM-1259 y solo lo nombra). `docs/master/SCRUM-1101.md`: no existía.
- Por CONTENIDO: `scripts/guard-acreditacion-invoicing-es.mjs` ya existía (SCRUM-1097, `34aa2d254`) y cumplía cuatro de las cinco líneas del enunciado: solo lectura por lista blanca verificada por AST, sin credenciales en el fichero, «cero medido» distinto de «no se pudo medir», y exclusión nombrada del demo. **Faltaban dos cosas:** ningún `writeFile`/`appendFile` (la línea «Deja registro escrito de cada ejecución») y la confirmación explícita del destino al estilo de `cambiar-flag-fiscal.mjs` (solo comparaba el host con una constante; nadie tenía que NOMBRARLO).
- SCRUM-1109 decidió que, en el envoltorio PROGRAMADO, el rastro es el email. Eso no cubre al guard cuando lo lanza una persona a mano, que es lo que pide este ticket. El envoltorio no se toca: importa `medirAcreditacion`, no `principal`.

## Lo que se hizo — sin cambiar QUÉ consulta ni qué decide

- `ejecutar({ argv, env, crearPrisma, hosts })` exportada; `principal()` la llama con lo de verdad. `hosts` existe solo para los tests; la CLI no lo expone.
- **Rastro:** un fichero JSONL por ejecución en `ACREDITACION_REGISTRO_DIR` (por defecto `~/.yaqu/registro-acreditacion-invoicing-es/`, fuera del árbol), creado con `wx` (nunca pisa otro). Líneas `inicio` → `conectando` (ANTES de construir el cliente) → `final` con `fecha`, `destino`, `host` (`describirBD`: host/base, sin usuario ni contraseña), `consulta`, `recuento` (`null` si no se midió), `suelo`, `acreditados`, `veredicto` (LIMPIO / HALLAZGO / CIEGO / ABORTADO) y `exit`. Escritura síncrona, con el proceso vivo.
- **Toda salida deja rastro**, también sin bandera, con host inesperado o sin confirmación. **Si el rastro no se puede escribir, no se mide** (CIEGO, exit 2, sin construir el cliente).
- **Confirmación:** `ACREDITACION_CONFIRM=<host>` tiene que ser el host al que apunta la URL; si no, ABORTADO antes de construir el cliente. Se suma a la comprobación de host esperado que ya había, no la sustituye.
- La consulta impresa y la registrada salen de la misma constante (`CONSULTA_TEXTO`). El envoltorio de 1109 tiene la suya, con el mismo texto: no se ha unificado para no tocar su fichero.

## Cómo se probó — sin producción ni staging

`tests/scrum1101-rastro-de-cada-ejecucion.test.mjs`, 11 casos. Destinos: URL fabricadas a `127.0.0.1:1` con un usuario y una contraseña inventados; «banco» = carpeta temporal fuera del árbol, una por caso, que se borra al acabar. Uno de los casos usa el `PrismaClient` REAL contra `127.0.0.1:1` (sale CIEGO, `recuento: null`, y el fichero no lleva ni usuario ni contraseña). Otro lanza la CLI de verdad con los hosts reales: el 127.0.0.1 no pasa por el de producción, aborta sin conectar y deja su fichero. Control positivo SEMBRADO: la credencial fabricada sí está en la URL que se le da, así que «no está en el fichero» no se cumple sobre el vacío.

**Rojo:** antes del código, el fichero no cargaba (faltaban los exports). Eso es un rojo débil; el que cuenta es la mutación, sobre el commit `62f114da28b2487dd5f82bbff15c11ac1dffacd8`, con `git diff --numstat` en cada fila y restaurado con `git restore --source=HEAD` (árbol limpio después):

| mutación | pass / fail (de 11) |
|---|---|
| base sin mutar | 11 / 0 |
| M1 · quitar la línea `conectando` | 9 / 2 |
| M2 · quitar la confirmación del host | 9 / 2 |
| M3 · `host = url` en vez de `describirBD(url)` | 8 / 3 |
| M4 · si el rastro falla, medir igual | 10 / 1 |
| M5 · quitar la línea `final` | 4 / 7 |
| M6 · `recuento: 0` en el CIEGO | 10 / 1 |

Censos de la casa que podían moverse con un script y un test nuevos (1185, 1320, 195, 237, 411, 414, 710b, 711, 723, 808, 812, 850, 850b, 921c, 976): **154 de 154 en verde, 0 saltados**, en local. Con los de 1097 y 1109: 54 de 54. **La tanda completa no la corrí en local**: la dice el obligatorio del PR.

**No medido:** ninguna ejecución contra staging ni producción (por encargo). Que la carpeta por defecto exista y se pueda escribir en la máquina de quien lo lance, tampoco: si no, sale CIEGO y lo dice.

## El primer obligatorio salió ROJO, y el fallo era mío

PR #2707, punta `4db1c95d26273556049fb7b742aeee723bab38ed`, run 39933135569, job «build + tests»: **12.219 casos = 12.129 pass + 1 fail + 89 saltados** (suman). El único rojo: `tests/scrum824-temporales-fuera-del-arbol.test.mjs`, «el conjunto de ficheros SIN PROBAR no crece», con mi test como fichero nuevo. El `writeFileSync` del caso «si el rastro NO se puede escribir» escribía en una ruta sacada de `banco()`, y el censo de temporales no sigue una llamada a otra función: no podía demostrar que cayera fuera del árbol. Ese censo no estaba en la lista que corrí en local.

Arreglo en el TEST, no en el censo: ese caso crea su temporal en el propio cuerpo, con `os.tmpdir()` a la vista. `clasificaFuente` pasa de `DESCONOCIDO` a `TMP` en esa línea, y scrum824 + scrum1101 salen 20 de 20 en local, con el caso «SIN PROBAR» presente y en verde.

A9: comprobación → `tests/scrum824-temporales-fuera-del-arbol.test.mjs`
