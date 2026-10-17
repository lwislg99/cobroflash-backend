# SCRUM-1549 · El cerrojo de identidad, sin armar: si mañana se pone `--exigir-identidad`, de 159 sesiones con hook caen 158 — todo el trabajo real del equipo de Javier, su orquestador incluido

**Medido contra:** `origin/main` = `e2be1c9fda3b5ceac853b4d376f5664ac8e4df67` · 2026-10-14T07:58:10Z

A9: aviso → A10 «Una prohibición sin mecanismo es una frase.» — no se pudo comprobar: el mecanismo es armar `--exigir-identidad` en `.claude/settings.json`, y armarlo está PROHIBIDO en este encargo (lo deciden los dos jefes: `settings.json` es de los dos equipos)

J6 (sesión `jv-j6k`, equipo de Javier), por encargo de su orquestador (`cobroflash-backend-2e`). **Es LECTURA:**
no se ha tocado `carril.mjs`, `identidad.mjs`, ningún hook, `settings.json`, `src/`, el esquema ni ninguna base.
Entran este registro y `docs/master/evidencias/SCRUM-1549/` (tres guiones de sólo lectura y sus tres salidas).
Este registro cubre la parte «cerrojo» del ticket; la puerta muerta (`ALTERADO`) es su otra mitad y aquí sólo
se vuelve a medir porque decide si la mesa es un canal.

## 0 · La respuesta corta

| Pregunta | Respuesta medida |
| --- | --- |
| Población | **367** trabajos del registro `~/.claude/jobs/*/state.json` (18-sep → 14-oct; 0 ilegibles, 0 sin `state.json`) + **7** vivos en `claude agents --json` (incluye el orquestador interactivo, que no está en el registro) |
| Caen por forma de nombre (sin mesa) | **363 de 367**. Pasan 4, y las 4 son `j6-test-*` del 23-sep (pruebas del lanzador, no trabajo). **Trabajo real que pasa por su nombre: 0** |
| Caen de verdad (lo que dijo el hook al arrancar) | Desde que el hook aparece en los transcripts (07-oct 17:54Z): **159** sesiones, **158 «SIN IDENTIDAD»**, 1 con identidad (`jv-j6k`, ésta: su mesa se escribió a mano 1 s antes de lanzarla) |
| Vivas ahora (07:5xZ) | **7**: pasan 5 (las cinco con mesa escrita a mano hoy), **caen 2**: el orquestador `cobroflash-backend-2e` y `jv-j3g` |
| ¿Cae Luis? | **Por forma, NO**: `sesion-0..5`, `sN-…` y `orquestador` pasan. Pero **sus sesiones no están en esta población** (0 de 367: corren en otra máquina) y sus nombres `cobroflash-backend-NN` **sí caen**. Y el interruptor es común: ver §2 |
| ¿Es la mesa un canal suficiente? | **No, hoy no.** La escribe una mano (5 de 200 worktrees, ninguna por el generador), la puerta que debería escribirla está muerta y, aun reinstalada, no la escribiría con la configuración actual; y una mesa **sella cualquier nombre** que no declare otro puesto por su forma (§3) |

## 1 · La población

Guion: `docs/master/evidencias/SCRUM-1549/poblacion.mjs` (salida entera en `poblacion-2026-10-14.txt`). Lee cada
`state.json` igual que `leerTrabajos` de `scripts/equipo/latido.mjs` (nombre = `name` o el `-n` de `respawnFlags`),
abre su transcript (`linkScanPath`, primeros 4 MB) y saca **lo que el hook `identidad.mjs` le dijo al arrancar** —
una medición del momento, no una simulación— y aparte lo que diría `puestoDeNombre` con el nombre solo.

**Por forma de nombre** (sobre 367):

| Forma | Cuántos | Sin mesa, con `--exigir-identidad` |
| --- | --- | --- |
| `jv-jN…` (`jv-j1`, `jv-j3i`, `jv-j6k`…) | **329** | **caen todos** |
| `jv-…` otro (títulos sin `-n`: «jv-orquestador startup»…) | 11 | caen |
| otra («j4 orchestrator bootstrap», «billing and verifactu», `prueba-lanzador`…) | 19 | caen |
| sin nombre | 4 | caen |
| `jN-…` / `puesto-jN` | 4 | pasan — y son `j6-test-detached`, `j6-test-branch`, `j6-test-jira-check`, `j6-test-strict` (23-sep) |
| `sesion-N` / `sN-…` (Luis) | **0** | — no hay ninguna en esta máquina |

**Por lo que dijo el hook** (sobre 367): 158 «SIN IDENTIDAD» · 1 con identidad · 200 sin hook en el transcript
(todas anteriores al 08-oct 00:32Z: los commits que añaden y registran el hook son del 29-sep y del 01-oct —fecha
de escritura, no de entrada en `main`, que no se ha medido— y el hook no aparece en un transcript hasta el 07-oct) · 8 sin transcript. **Las 208 sin hook no se pueden juzgar por lo que vieron**: sólo por su forma, y por
su forma caen todas menos las cuatro de prueba.

**Hoy:** las 4 sesiones lanzadas a las 07:44Z (`jv-j3i`, `jv-j4g`, `jv-j2l`, `jv-j1l`) arrancaron con «SIN
IDENTIDAD»; su mesa se escribió a las 07:47:47Z, tres minutos después. Como `carril.mjs` relee la mesa en cada
llamada, desde ese momento **pasan**. El hook de arranque no se repite, así que su contexto sigue diciendo «no
construyas» aunque la cerradura ya las reconozca.

**Vivas** (`vivos.mjs`, salida en `vivos-2026-10-14.txt`), con `identidad()` de `carril.mjs` y el transcript real:

| Sesión | Nombre que lee la cerradura | Mesa | Con `--exigir-identidad` |
| --- | --- | --- | --- |
| `cobroflash-backend-2e` (interactiva, en el checkout compartido) | **ninguno** (`null`: el transcript no lleva `agent-name`) | no | **CAE** |
| `jv-j3g` | `jv-j3g` | no | **CAE** |
| `jv-j3i`, `jv-j4g`, `jv-j2l`, `jv-j1l`, `jv-j6k` | el suyo | sí (a mano) | pasan |

⚠️ **El orquestador caería también**: armado, no podría usar Edit/Write en ningún fichero, ni los suyos.

## 2 · Luis

Medido con la función, no con su población (`controles.mjs`, salida en `controles-2026-10-14.txt`):

| Nombre | `puestoDeNombre` sin mesa |
| --- | --- |
| `sesion-0` … `sesion-5` | S0 … S5 — **pasa** |
| `s1-14oct`, `s5-29c`, `s3-14oct-a` | S1, S5, S3 — **pasa** |
| `orquestador`, `orquestador-luis` | ORQ — **pasa** |
| `cobroflash-backend-57` (citado como nombre real de su equipo en `scripts/equipo/sesion.mjs`, comentario de `validarNombreDeLectura`) | **null — CAE** |
| `sesion-6` | null — cae |

**Por forma, la plantilla de Luis pasa.** Lo que NO se ha medido es su población: en el registro de esta máquina hay
**0** sesiones suyas, así que «Luis no cae» es una lectura del código, no un recuento. Y no cambia la conclusión de
quién decide: `--exigir-identidad` se arma en `.claude/settings.json`, que **está en git y carga en las sesiones de
los dos equipos**; no hay forma de armarlo sólo para uno.

## 3 · La mesa `.yaqu-puesto.json` como canal

**Quién la escribe:** `node scripts/carriles.mjs mesa <PUESTO> <dir> --nombre <n>` (`scripts/carriles.mjs`, orden
`mesa`), y la puerta `scripts/equipo/sesion.mjs` sólo la llama desde `prepararMesa`, **y sólo si `config.mesas`
existe**. Está en `.gitignore` (línea 160, comprobado con `git check-ignore -v`).

**Hoy no la escribe la puerta**, medido:
- `node <instalación>/sesion.mjs estado` → `ALTERADO` (re-medido 07:5xZ: la copia instalada es del 28-sep y no
  es idéntica a `origin/main`).
- Su `config.json` lleva `repo, claude, prefijo, puestos, orquestador, tandas, prompt, traspasos`: **ni `mesas` ni
  `identidades`**. Sin `mesas`, la puerta **no escribe mesa** (hereda el cwd); sin `identidades`,
  `puestoDeIdentidad('jv-j1', …)` da `null`. **Reinstalarla, sola, no daría identidad a nadie.**
- La puerta sólo acepta `jv-j1`…`jv-j6`: `validarNombre('jv-j1a')` → NOMBRE-NO-PERMITIDO. Y `puestoDeNombre('jv-j1')`
  → `null` también: los nombres que la propia puerta permite **no pasan por forma**; sólo pasarían con mesa.
- Mesas que existen: **5 de 200** worktrees (las cinco de hoy), las cinco **sin** `CLAUDE.local.md` → ninguna la
  escribió el generador; son JSON de dos campos escritos a mano.

**Una mesa sella cualquier nombre.** La cerradura decide con `puesto = carpeta ?? porNombre` (`carril.mjs`,
`identidad()`); el nombre sólo para si **su forma** declara otro puesto:

| Mesa | Nombre de la sesión | `puestoDeNombre` | Cerradura (`identidad()`) |
| --- | --- | --- | --- |
| J4 / `jv-j4g` | `jv-j4g` | J4 | pasa como J4 |
| — | `jv-j4g` | null | **cae** |
| J4 / `jv-j4g` | `jv-j9z` | **null** | **pasa como J4** |
| J4 / `jv-j4g` | (sin nombre) | null | pasa como J4 |
| J4 sin campo `nombre` | `lo-que-sea` | null | pasa como J4 |
| J4 / `jv-j4g` | `j3-x` | J3 | para (discrepancia) |
| J4 / `jv-j4g` | `sesion-1` | S1 | para (discrepancia) |
| ORQ / `cobroflash-backend-2e` | `cobroflash-backend-2e` | ORQ | pasa como ORQ |
| JSON roto, o puesto `J9` | — | — | cae (carpeta rota) |

Los tres controles del orquestador **se confirman** sobre `puestoDeNombre` (J4 · null · null). **Pero el tercero no
dice lo que parece sobre la cerradura:** `puestoDeNombre('jv-j9z', mesa)` es `null` y, con esa mesa, la sesión
`jv-j9z` **pasa como J4**, porque la carpeta manda y el nombre sólo puede discrepar si declara un puesto. El campo
`nombre` de la mesa no se exige (el generador lo exige para los J; la cerradura no), y un nombre que no casa con él
no se comprueba contra nada.

Y un límite que ya declara `carril.mjs` en su cabecera: el `matcher` de `settings.json` es
`Edit|Write|NotebookEdit|MultiEdit`. Armado, una sesión sin identidad **no podría editar con Edit/Write, pero sí
escribir por Bash/PowerShell**: el cerrojo cubriría la puerta principal, no todas.

## 4 · Recomendación

**No armarlo todavía:** hoy pararía el 100 % del trabajo real del equipo de Javier (158 de 159, orquestador incluido)
y lo único que lo abre es una mesa escrita a mano que acepta cualquier nombre; antes hace falta un canal de identidad
que no sea una mano —la puerta reinstalada **con** `mesas` e `identidades` en su `config.json` y nombres que acepte, o
que `puestoDeNombre` aprenda la forma `jv-jN…` (decisión, no arreglo)— y, como `settings.json` es común, el acuerdo de
los dos jefes.

## 5 · Lo que NO se ha medido

- **La población de Luis.** 0 sesiones suyas en este registro; «su forma pasa» sale de la función.
- **Las 208 sesiones sin hook** (anteriores al 08-oct o sin transcript): qué habría dicho la cerradura se deduce de su
  forma, no de su arranque.
- **La mesa en el momento de cada sesión pasada:** la columna «HOY» del guion lee la mesa que hay AHORA en su cwd; la
  del arranque sale del texto del hook, que es la que se usa arriba.
- **Subagentes** (Agent/fork) de una sesión con mesa: comparten `CLAUDE_PROJECT_DIR` y por tanto la mesa; no se ha
  medido qué nombre lleva su transcript.

## 6 · Errores propios

- Mi primera pasada del guion salió con código 1: escribí el fichero de filas a una ruta construida con
  `import.meta.url`, que en esta máquina lleva `%20` en «Javier Pereira». La salida impresa estaba completa y el
  código decía fallo; la volví a correr con la ruta por argumento antes de usar un solo número. Y al arreglarla con
  `sed` el parche cayó a medias (quitó un espacio y dejó la línea sin la condición): lo vi al ir a editarla, no
  antes. Es la cicatriz de J6 del 14-oct otra vez: **los parches de texto, con el editor**.
