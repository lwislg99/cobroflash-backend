# SCRUM-1549 · La puerta `sesion.mjs`, re-medida el 24-oct: sigue muerta, y lo que la mantiene muerta es una tarea programada que nunca arranca (la ruta lleva un espacio)

**Medido contra:** `origin/main` = `091e4d765ba13083b93fb6c168ffbd70fb1f1563` · 2026-10-24T10:51:00Z (`Date:` de GitHub)

A9: aviso → A10 «Una operación que no se ejecutó se lee exactamente igual que un éxito.» — no se pudo comprobar: el defecto está en `scripts/equipo/instalar.mjs:79` (carril S5) y en las tareas programadas de esta máquina, y este encargo es SÓLO MEDIR; quien lo arregle lleva su test con una ruta con espacio

J3 (sesión `jv-j3bb`, equipo de Javier), por encargo de su orquestador (`cobroflash-backend-95`). **Es LECTURA:** no se ha
reinstalado nada, no se ha tocado ninguna tarea programada, `config.json`, `sesion.mjs`, ningún hook, `settings.json` ni
ninguna base. Lo único que se ha EJECUTADO es `sesion.mjs estado` (sólo lectura), funciones puras de `sesion.mjs` e
`instalar.mjs` de `origin/main` importadas desde un temporal fuera del árbol (su `principal` va bajo la guarda
`process.argv[1]`), y consultas de `schtasks` / `Get-ScheduledTask`.

⚠️ **Este registro CREA el fichero.** El PR #2435 (`jv-j6k`, 14-oct, la parte «cerrojo») también lo crea y sigue
abierto: el que entre segundo choca. Su tramo es otro y va entero en su PR; aquí no se copia.

## 0 · La respuesta corta

| Lo que pide el ticket | Hoy, medido |
| --- | --- |
| 1 · Reinstalar la copia y ver `estado` contestar | **SIN HACER.** `node <instalación>/sesion.mjs estado` → `{"ok":false,"veredicto":"ALTERADO",…}`, código 2 |
| 2 · Que la puerta muerta se NOTE | **SIN HACER.** Nada fuera de la propia puerta mira su `ALTERADO`; el hook de identidad sigue mandando a ella |
| 3 · Decisión del fundador (una o varias por puesto) | **DECIDIDA** el 14-oct (c.19615: la (B), «varias por puesto»). **SIN CONSTRUIR**: `validarNombre` sigue aceptando sólo `jv-j1`…`jv-j6` |

**El ticket NO está resuelto por efecto.** No lo cierra nadie con lo que hay.

## 1 · Lo que el ticket da por cierto y ya no lo es

| El ticket dice | Medido hoy |
| --- | --- |
| «muerta desde el 28-sep» | La copia instalada es, byte a byte, la de `62a58b01f` (SCRUM-1095, 26-sep): `git hash-object` = `84b432a9…`, que es el blob de `scripts/equipo/sesion.mjs` en ese commit (en el 16.º de los 24 commits que tocan el fichero; el blob actual, `fe7dc0e4…`, sale en el 1.º, control positivo del mismo bucle). El 28-sep es la fecha del FICHERO. **Muerta desde el merge #1992, `caa18b8c9`, 2026-09-29T17:39:30Z** (el commit `02e466017`, SCRUM-1282, es el primero que la deja atrás) |
| «No falta configurar nada. Lo único que falla es que la copia se quedó atrás» | **Falso por dos lados.** (a) La copia no se queda atrás por descuido: la refresca `arranque.cmd` en cada tanda, y **las tres tareas que lo lanzan no lo arrancan nunca** (§2). (b) `config.json` sigue sin `mesas` ni `identidades` (claves: `repo, claude, prefijo, puestos, orquestador, tandas, prompt, traspasos`), así que reinstalada no escribiría mesa ni daría identidad — lo midió J6 el 14-oct (#2435 §3) y sigue igual |
| «No se ha podido medir si la puerta rechazaría `jv-j1a`…» | **Medido** con `validarNombre` de `origin/main` y el `config.json` real: `jv-j3`, `jv-orquestador` → se lanzan; `jv-j3bb`, `jv-j1a`, `jv-j6k`, `cobroflash-backend-95`, `j3` → `NOMBRE-NO-PERMITIDO`. Para LEER (`validarNombreDeLectura`, SCRUM-1282) pasan todos; control: `""`, `"a b"`, `"../x"` → NO |
| Reinstalar arregla la puerta | **Sólo hasta el siguiente merge** que toque `sesion.mjs`: desde #1992 han entrado **9** (#2002, #2090, #2235, #2238, #2251, #2484, #2494, #2575, #2570 — el último, 2026-10-19T07:07:32Z). La comparación es por bytes contra `origin/main` (`sesion.mjs:877-906`), a propósito; lo que la mantiene viva es que `arranque.cmd` corra |

## 2 · Por qué no se refresca: la tarea programada parte la ruta por el espacio

`Get-ScheduledTask` de las tres tareas del equipo (leído 2026-10-24 ~10:5xZ):

| Tarea | Última ejecución | Resultado | `Execute` | `Arguments` |
| --- | --- | --- | --- | --- |
| `yaqu-equipo-jv-0825` | 24-oct 10:53 (+01:00) | `0x800710E0` | `C:\Users\Javier` | `Pereira\AppData\Local\yaqu-equipo\arranque.cmd` |
| `yaqu-equipo-jv-1330` | 23-oct 13:30 | `0x80070002` (fichero no encontrado) | `C:\Users\Javier` | `Pereira\…\arranque.cmd` |
| `yaqu-equipo-jv-1835` | 23-oct 18:35 | `0x80070002` | `C:\Users\Javier` | `Pereira\…\arranque.cmd` |
| control: `yaqu-vigia-sesiones-jv` | 24-oct 11:37 | `0x2` (código del propio script) | `node` | `"C:\Users\Javier Pereira\…\vigia-sesiones-jv.mjs"` (entre comillas) |

El ejecutable que intenta lanzar es `C:\Users\Javier`, que no existe. El control con la ruta entre comillas SÍ arranca.
Y `arranque.log`, al que `arranque.cmd` escribe en cada pasada, **no existe** en la instalación: no hay rastro de
ninguna pasada. `schtasks /query` las da como «Listo» y «Habilitado».

**De dónde sale:** `ordenesSchtasks` (`scripts/equipo/instalar.mjs:76-80`) imprime `/tr "${cmd}"` sin comillas
interiores. Ejecutada desde `origin/main`:

```
destino 'C:/Users/Javier Pereira/AppData/Local/yaqu-equipo' → … /tr "C:\\Users\\Javier Pereira\\AppData\\Local\\yaqu-equipo\\arranque.cmd"
destino 'C:/Users/Admin/AppData/Local/yaqu-equipo'          → … /tr "C:\\Users\\Admin\\AppData\\Local\\yaqu-equipo\\arranque.cmd"
```

Las comillas de fuera se las come el shell; `schtasks` recibe la ruta suelta y la parte por el espacio. **En una ruta
sin espacio (la de la guía de Luis, `C:/Users/Admin/…`) no se nota.** Que la máquina de Luis funcione: **no medido**,
se deduce de la ruta de su guía (`docs/equipo/instalacion-orquestador-autonomo.md:190`).

⚠️ **Consecuencia de arreglarlo que hay que poner delante:** `arranque.cmd`, además de copiar, lanza
`orquestador-arranque.mjs`, que **lanza el orquestador de la tanda** (`orquestador-arranque.mjs:109`, `sesion.mjs lanzar`)
salvo que haya un equipo vivo (SCRUM-959b). Hoy eso no ocurre nunca; con las tareas bien escritas ocurriría tres veces
al día, con su coste.

## 3 · Lo que ya está en main y NO resuelve el ticket

- **SCRUM-1282** (#1992): `contexto` acepta los nombres de hoy (sólo lee), y el latido lee el contexto desde un árbol
  sin pasar por la copia instalada (`scripts/equipo/latido.mjs:44-47`). Rodea la puerta para LEER; no la revive.
- **SCRUM-1298 / 1298c** (#2002, #2575): las mesas. Sólo actúan con `config.mesas`, que esta instalación no tiene.
- **SCRUM-1506** (#2492, Luis): medido que `jv-jN` no resuelve por nombre pero sí con mesa; sin construir.

## 4 · Lo que sigue vivo, con su carril (`node scripts/carriles.mjs de <ruta>`)

| Pieza | Dónde | Carril |
| --- | --- | --- |
| `/tr` sin comillas interiores | `scripts/equipo/instalar.mjs:79` | **S5** (Luis) |
| Las tres tareas de esta máquina | `schtasks` local, fuera del repo | quien manda en la máquina (la guía, paso 3) |
| El hook manda a una puerta que no mira | `.claude/hooks/identidad.mjs:28` | sin cerradura · «un jefe» |
| Nadie publica el `ALTERADO` | `scripts/equipo/latido.mjs` (o el hook) | **S5** / un jefe |
| La (B): varias sesiones por puesto | `scripts/equipo/sesion.mjs:182-186` (`validarNombre`) | **S5** |
| `mesas` / `identidades` en la instalación | `config.json` local | quien manda en la máquina |
| `--exigir-identidad` sin armar | `.claude/settings.json:33` | los dos jefes (fuera de este ticket, c.19615) |

## 5 · Preguntas ✅/❌ para el fundador

1. **¿Se rehacen las tres tareas de esta máquina con la ruta entre comillas?** ✅ `arranque.cmd` corre 3 veces al día,
   la copia vuelve a ser la de `main` y la puerta contesta — **y además se lanza un orquestador automático en cada tanda
   sin equipo vivo** (coste). ❌ La puerta sigue muerta; se refresca a mano cuando haga falta y dura hasta el siguiente
   merge a `sesion.mjs` (9 en 25 días). *Recomendación:* ✅ **sólo si quiere el orquestador automático**; si no,
   ❌ y la pregunta 2. Lo haría: quien manda en la máquina (Javier o su orquestador con su OK).
2. **Si ❌ en la 1: ¿se reinstala la copia a mano una vez, sin lanzar nada** (las cuatro copias de `arranque.cmd`, sin
   su última línea)? ✅ `estado`, `parar` y `olvidar` vuelven a funcionar hasta el siguiente merge a `sesion.mjs`. ❌ Se
   sigue lanzando con `claude --bg` a pelo. *Recomendación:* ✅, con `estado` medido antes y después. Lo haría: el
   orquestador del equipo de Javier.
3. **¿Se abre ticket a S5 para entrecomillar `/tr` en `instalar.mjs:79`, con un test de ruta con espacio?** ✅ Ninguna
   máquina con espacio en la carpeta de usuario repite esto. ❌ Queda como aviso. *Recomendación:* ✅. Lo haría: S5
   (equipo de Luis; el ticket ya lleva `aviso-a-luis`).
4. **¿Se construye que la puerta muerta se NOTE en el latido** (una línea: veredicto de `estado` + último resultado de
   las tareas), **o se cambia el texto del hook** para que no mande a `sesion.mjs` mientras esté muerta? ✅ latido: lo lee
   cada sesión al arrancar, sin texto nuevo para el usuario. ❌ / hook: toca un fichero que carga en los dos equipos.
   *Recomendación:* ✅ latido. Lo haría: S5.
5. **La (B) del 14-oct ya está firmada y lleva 10 días sin ticket propio: ¿se abre a S5** (`validarNombre` acepta
   `<prefijo><puesto><sufijo>`)? ✅ Las sesiones que se lanzan hoy (`jv-j3bb`…) podrían salir por la puerta. ❌ Mientras
   el orquestador lance con `claude --bg` a pelo, la (B) no cambia nada. *Recomendación:* ✅ **sólo después de la 1 o la
   2**: sin puerta viva, construir la (B) es construir para nadie. Lo haría: S5.

## 6 · Lo que NO se ha medido

- **Desde cuándo fallan las tareas.** Sólo se lee el último resultado; el historial del Programador no se ha mirado.
  Quién copió a mano el 28-sep: no medido.
- **Qué contestaría `estado` tras reinstalar:** no se ha reinstalado (encargo de sólo medir).
- **`0x800710E0`** de la tarea de las 08:25 (ejecutada a las 10:53): por qué ese código y no `0x80070002`, no medido.
- **El rojo de #2435:** su obligatorio cayó por **1 de 11.437** (`scrum1405c` ④, el intermitente de SCRUM-1559d;
  11.347 pass + 1 fail + 89 skipped = 11.437). Es ajeno, pero no se ha relanzado ni mirado su estado de merge hoy
  (`mergeStateStatus` = `UNKNOWN`).
- **La máquina de Luis**: nada.

## 7 · Errores propios

- Al buscar el merge que metió `02e466017` usé `rev-list --ancestry-path --first-parent … | tail -1` y me salió la
  punta de `main` (`4bab9c1fc`), no el merge: la lista de `--ancestry-path` con `--first-parent` no era la que creía. Lo
  vi porque la fecha (24-oct) no podía ser la de un cambio del 29-sep, y lo rehíce con `merge-base --is-ancestor` sobre
  cada merge del 29-sep al 5-oct. No llegó a escribirse en ninguna parte.

---

> **Segundo tramo de este registro (J6, `jv-j6k`, 14-oct, PR #2435).** Los dos tramos crean este mismo fichero; la
> unión de git los dejó uno detrás de otro sin separar y se juntan aquí a mano (SCRUM-1572). Cada tramo lleva su
> propia cabecera, su ancla «Medido contra» y su línea `A9:`; sus secciones numeradas empiezan otra vez en 0.

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

---

> **Tercer tramo de este registro (J3, `jv-j3bf`, 24-oct, 1549c).** Ejecuta el punto 2 de la decisión del fundador
> (c.20777): reinstalar a mano, una vez y sin lanzar nada, la copia de la puerta. Comentario en Jira: c.20816.

# SCRUM-1549c · La copia de la puerta, reinstalada a mano: `estado` vuelve a contestar, sin lanzar nada y sin tocar las tareas programadas

**Medido contra:** `origin/main` = `bcfc99b0d9a4f4a3aaf9d1608dce06b3d3691482` · 2026-10-24T15:30:04Z (`Date:` de GitHub)

A9: aviso → A10 «Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.» — no se pudo comprobar: la sonda que falló fue una orden a mano sobre la instalación, fuera del árbol, y ningún test del repositorio la ve

J3 (sesión `jv-j3bf`, equipo de Javier), por encargo de su orquestador (`cobroflash-backend-95`). Instalación:
`C:/Users/Javier Pereira/AppData/Local/yaqu-equipo/`. Ninguna línea de `scripts/equipo/` cambia.

## 0 · Antes y después

| | ANTES (~15:27Z) | DESPUÉS (15:29Z) |
| --- | --- | --- |
| `node <instalación>/sesion.mjs estado` | `{"ok":false,"veredicto":"ALTERADO",…}`, código **2** | `{"veredicto":"ESTADO",…}`, código **0** · 2.367 B: 0 `sesiones`, 0 `restos`, 0 `bloqueadas`, 10 `otras` |
| blob de la copia (`git hash-object`) | `84b432a9…` (el de `62a58b01f`, 26-sep) · 55.416 B | `fe7dc0e4…` = `origin/main:scripts/equipo/sesion.mjs` · 77.695 B |
| `parar jv-sonda-1549c` | ALTERADO | `NOMBRE-NO-PERMITIDO`, código 1 (no llega a `claude stop`/`rm`) |
| `olvidar jv-sonda-1549c` | ALTERADO | `NOMBRE-NO-PERMITIDO`, código 1 (no llega a `claude rm`) |
| `--ayuda` (la puerta no tiene ayuda propia) | ALTERADO | `ACCION-DESCONOCIDA` con el uso, código 1 |
| `schtasks /query /fo csv` | 208 nombres, 4 `yaqu*` | 208 nombres, 4 `yaqu*` · **0 nuevas, 0 quitadas** (control positivo: las 4 `yaqu*` aparecen en las dos) |

## 1 · Qué se hizo y qué no

- **Hecho, sólo esto:** `git show origin/main:scripts/equipo/sesion.mjs > <instalación>/sesion.mjs` (la primera copia
  de `arranque.cmd`, en bytes). Antes, comprobado que ese fichero sólo importa módulos `node:`. Copia de seguridad de
  las cuatro copias viejas en `<instalación>/copia-puerta-20261024-1549c/`.
- **No** se ejecutó `instalar.mjs` (reescribe `config.json` y `arranque.cmd`), ni `arranque.cmd` (su última línea lanza
  el orquestador). **No** se tocó ninguna tarea programada (punto 1 de c.20777), ni `config.json`, `uso.mjs` (el
  statusLine de todas las sesiones), `orquestador-arranque.mjs` o `prompt-tanda.md`.
- `parar` y `olvidar` se probaron con un nombre FUERA de la lista blanca, a propósito: con `jv-j3` podrían parar o
  borrar una sesión de verdad. Prueban que la puerta pasa la integridad y contesta; **no** prueban que paren bien.

## 2 · Lo que sigue igual

- **La puerta no ve a las sesiones de hoy:** las 10 vivas salen en `otras`, porque `jv-j1bs`, `jv-j3bf`… no están en
  la lista blanca (`jv-j1`…`jv-j6`). Es la (B), punto 5 de c.20777, de S5.
- **Vuelve a `ALTERADO` con el siguiente merge que toque `sesion.mjs`**: deducido de `puertaDeIntegridad` (compara
  por bytes contra `origin/main`), no esperado a que pase.
- `config.json` sigue sin `mesas` ni `identidades`: la puerta viva no da identidad. El hook de identidad corre sólo
  al arrancar, así que no se ha re-medido después.
- `yaqu-equipo-jv-1835` toca hoy a las 18:35. Si falla como las anteriores (ruta partida por el espacio), no pisa
  nada; no se ha esperado a verlo.

## 3 · Errores propios

- Como «antes» de `parar` corrí la copia de seguridad desde su subcarpeta y salió `NO-PUDE-MIRAR` (no hay
  `config.json` al lado): una sonda que no llegó a mirar. No se cuenta; el «antes» válido es el `ALTERADO` de
  `estado`, medido sobre la copia instalada.

---

# SCRUM-1549d · El `/tr` de las tareas, entre comillas DENTRO: la tarea ejecuta `arranque.cmd` aunque la ruta lleve un espacio, y `comprobar-instalacion` ya no da OK a una tarea partida

**S5 (equipo de Luis)** · 27-oct-2026

**Medido contra:** `origin/main` = `77ce98573b1b5e090dfcf7754c4e7960bc63b85a` · 2026-10-27T15:37:34Z

A9: comprobación → `tests/scrum1549d-tr-con-espacio.test.mjs`

Decisión: c.20777, punto 3 (*«ticket a S5 para entrecomillar `/tr` en `instalar.mjs:79`, con un test de ruta con
espacio»*). Encargado por el orquestador de Luis como «SCRUM-1000», a petición de Javier; la decisión y la medida de
la causa viven aquí, así que el tramo va aquí.

## 0 · La causa, verificada antes de arreglarla

- **Leída en el código:** `ordenesSchtasks` (`scripts/equipo/instalar.mjs:79`) imprimía `/tr "<ruta>"` para pegar en
  Git Bash. Bash se come esas comillas, y schtasks recibe la ruta desnuda.
- **Medida en bash de verdad** (test ①, sin crear tareas): con `C:/Users/Javier Pereira/…`, schtasks recibe
  `C:\Users\Javier Pereira\AppData\Local\yaqu-equipo\arranque.cmd` sin comillas.
- **Lo que schtasks hace con eso lo midió `jv-j3bb` en la máquina de Javier** (§2 de este registro): Command
  `C:\Users\Javier`, Arguments `Pereira\…\arranque.cmd`, resultado `0x80070002`. Coincide.
- **La máquina de Luis** (`schtasks /query /tn yaqu-equipo-0800 /xml`, sólo lectura, hoy): Command
  `C:\Users\Admin\AppData\Local\yaqu-equipo\arranque.cmd`, sin Arguments. Por eso el defecto vivió en main: la
  ruta de la guía no lleva espacio.

## 1 · Los sitios con el mismo defecto (no sólo la línea 79)

| Sitio | Qué tenía | Qué hace ahora |
|---|---|---|
| `instalar.mjs` `ordenesSchtasks` | `/tr "<ruta>"` | `/tr '"<ruta>"'`: comillas simples de bash con las dobles dentro; una `'` de la ruta se escapa `'\''` |
| `comprobar-instalacion.mjs` §10 | `schtasks /query /tn` → OK si la tarea **existe** | `/query /xml` y `juzgarAccionTarea`: OK sólo si Command es `arranque.cmd` entero (con o sin comillas) y sin Arguments; si no, **FALLA** nombrando lo que ejecuta |
| `docs/equipo/instalacion-orquestador-autonomo.md` §5 | las tres órdenes viejas para copiar | las nuevas, con el aviso y «se COPIAN de la salida del instalador» |

El de `comprobar-instalacion` es el que más importa: el 18-sep dio **«OK · 17 comprobaciones»** en la máquina de
Javier (SCRUM-1000 c.16194) con las tres tareas partidas. Un instrumento que pregunta si algo existe no puede ver
que no funciona. Revisados y sin defecto: `arranqueCmd` (todas sus rutas van entre comillas) y `lineaStatusLine`
(SCRUM-953).

## 2 · Cómo se mide (`tests/scrum1549d-tr-con-espacio.test.mjs`, 8 tests)

1. La orden del instalador se pasa por un **bash de verdad**, con `schtasks` cambiado por una función que escribe
   sus argumentos: se ve el `/tr` que recibiría schtasks.
2. Ese `/tr` se parte como lo partió schtasks en la máquina de Javier → XML de la acción.
3. Ese XML lo juzga `juzgarAccionTarea`, la misma función de `comprobar-instalacion`.

Rutas: **con espacio** (`Javier Pereira`), **con espacio y apóstrofo** (`Ana O'Neil`) y sin espacio. Más los dos XML
medidos (el de Javier → FALLA; el de Luis → OK) y los suelos (otro `.cmd`, argumentos de más → FALLA; sin acción →
NO-PUDE-MIRAR).

- **Control:** la orden VIEJA con espacio → FALLA, y sin espacio → OK (por eso no se notaba).
- **Mutación:** devuelto el `/tr` a la forma vieja en `instalar.mjs`, **caen 4 de 8** (los cuatro de la orden de
  hoy); restaurado, hash idéntico al de antes.
- Local: `scrum1549d` + `scrum899b` + `scrum951a` → **40 tests, 40 pass, 0 fail, 0 skipped**. `scrum951d` → 8/8.
  `scrum723` **no cargó** en mi worktree (sin `node_modules`: falta `typescript`); no toca nada de esto, lo mide el CI.
- **Dos tests cambian su cadena esperada** (`scrum899b:287-289`, `scrum951a:471,474`): fijaban la orden con el
  defecto dentro. Lo que vigilan (nombres de tarea, horas, prefijo) sigue igual.

## 3 · Lo que NO se ha medido

- **El Programador de tareas real con el `/tr` nuevo.** La mitad «con comillas» del paso 2 es un MODELO: crear una
  tarea no lo hace una sesión. La primera que se cree con la orden nueva la comprueba
  `comprobar-instalacion.mjs --destino <instalación>`, que ahora lee su XML de verdad.
- Por qué la tarea de las 08:25 de Javier dio `0x800710E0` (§2): no es este defecto, o no sólo.

## 4 · ⚠️ Antes de recrear las tareas de Javier

- **Punto 1 de c.20777 (24-oct): «No se rehacen las 3 tareas programadas. No se quiere un orquestador automático en
  cada tanda.»** El encargo de hoy dice que Javier las recreará cuando entre esto. Puede ser una decisión nueva;
  **no la he visto escrita**. Con la tarea arreglada, `arranque.cmd` lanza `orquestador-arranque.mjs` en cada tanda
  sin equipo vivo (coste).
- Recrear = `schtasks /delete /tn yaqu-equipo-jv-HHMM /f` de cada una, y después las órdenes que imprima
  `instalar.mjs` de main. **Reinstalar con `instalar.mjs` reescribe `config.json` y `arranque.cmd`** (c.20816 §1). Lo
  hace quien manda en esa máquina.

---

# SCRUM-1549f · El latido dice si la PUERTA del lanzador deja lanzar (p.4 de c.20777)

**Medido contra:** `origin/main` = `5a247020e5608fd2b21fad04bcf585694494397a` · 2026-10-29T18:02:06Z

A9: comprobación → `tests/scrum1549f-latido-puerta.test.mjs`

S5, 29-oct-2026. Viene de SCRUM-1549e (PR #2994): la puerta de `sesion.mjs` estuvo cerrada 6 h 38 min
(10:53:28Z → 17:31:43Z) y nada lo dijo. La puerta da el mismo código 2 a `ALTERADO` y a «no pude comprobar».

## 0 · Qué hace

Sección **16 · PUERTA** del latido, en `scripts/equipo/puerta.mjs`. Compara los BYTES de
`%LOCALAPPDATA%\yaqu-equipo\sesion.mjs` contra `origin/main:scripts/equipo/sesion.mjs` del `config.repo`, que es lo
mismo que compara la puerta. **No importa ni ejecuta la copia instalada y no escribe en la instalación** (es `deny`).
Tres respuestas con tres salidas:

| la copia | sale | qué dice |
|---|---|---|
| idéntica | ✅ · 0 | tamaño y sha256 |
| ATRASADA (es una versión vieja de main) | 🔴 · 1 | qué versión es (commit y fecha) y **el merge que la cerró** (el siguiente que cambió el fichero en el primer padre de main) · la orden de refresco |
| AJENA (no es ninguna versión de main) | 🔴 · 1 | si es main con UTF-16+BOM, BOM UTF-8 o CRLF, lo nombra · cuándo se escribió · la orden de refresco |
| sin instalación, sin `config.json`, main ilegible | 🔴 NO PUDE MIRAR · 2 | el motivo |

La orden de refresco son las dos líneas de `arranque.cmd` (`fetch` y `show … >`), y la sección dice **«desde cmd,
NUNCA desde PowerShell»**: el `>` de PowerShell 5.1 reescribe la codificación (medido en SCRUM-1549e). Una instalación
dentro de un árbol de git sale como puerta cerrada (`DESDE-UN-ARBOL`), igual que la contesta la puerta.

Lo que NO mira: la validación de equipo y de modelo que la puerta hace después de los bytes. Lo dice su población.
Y sólo mira `sesion.mjs`: `orquestador-arranque.mjs` y `uso.mjs` sólo los usa la tarea programada (desactivada desde el 27-oct).

## 1 · El control positivo, con datos de verdad (no del banco)

Contra la instalación de esta máquina, a las 29-oct-2026 ~18:00Z, sobre `origin/main` = `7acb753a1` del checkout compartido:

- `sesion.mjs` instalada: **81.772 B · sha256 `e96077461a593230283e4f35ea76d595d2924aa5563ec885bb2d0ffdb64e621b`**
  · blob `547e8dd62d…`, igual que main → la sección: **✅ AL DÍA**. **Si la puerta se vuelve a cerrar, se compara con esto.**
- Lo de hoy, reconstruido: la versión anterior (`75c6bd366`, 19-oct) puesta en una instalación de mentira → **«ATRASADA 1
  versión: es la de 75c6bd366 (2026-10-19T07:07:32Z) · CERRADA desde el merge 8f4d7e863 (2026-10-29T10:53:28Z)»**. Es la
  hora del cierre que midió SCRUM-1549e por otro camino.
- Main escrita en UTF-16 con BOM → «AJENA … es main ESTROPEADA: UTF-16 con BOM (el `>` de PowerShell)».
- `config.json` roto → NO PUDE MIRAR.

## 2 · Cómo se mide (`tests/scrum1549f-latido-puerta.test.mjs`, 8 tests)

Banco sintético en un temporal: un repositorio con dos versiones del lanzador y una instalación al lado. Las
mutaciones declaradas en `MUTACIONES_QUE_ME_TUMBAN` (§3) cubren: toda copia «al día», «desde cuándo» apuntando a la
versión de la copia, la copia en UTF-16 sin reconocer, y «no pude» con `pudo: true`.

## 3 · Rojos vistos

(se rellena abajo con la medición de las mutaciones)

## 4 · Lo que sigue (no en este PR)

- La tarea de **sólo refresco** cada 15 min y la (B) `s<N>-<sufijo>` de `validarNombre`: el orquestador decide que
  vayan en UN PR, DESPUÉS de que el fundador cree la tarea (escribe en la ruta `deny`). Sin su sí, no se construye.
# SCRUM-1549e · El apagón del 29-oct, medido: la puerta estuvo cerrada 6 h 38 min, y desde el 27-oct nada la reabre sola

**S5 (equipo de Luis)** · 29-oct-2026 · SÓLO MEDIR: ni `scripts/equipo/sesion.mjs` ni la copia instalada se tocan.

**Medido contra:** `origin/main` = `eafca9fe154c26d38b05a748ca816ba098943724` · 2026-10-29T17:42:01Z

A9: sin fallo que generalice — mi único tropiezo (un `git show … | git hash-object --stdin` en PowerShell dio un blob
distinto, `ad99456…`, para dos ficheros idénticos) lo cazó la segunda sonda en el mismo turno, y la trampa ya está
escrita: PowerShell recodifica lo que pasa por su tubería (`trampas-del-entorno.md` §2). Va en §3 como dato, porque
es justo el camino por el que un refresco a mano deja la puerta cerrada para siempre.

Instrumentos y salidas: `docs/master/evidencias/SCRUM-1549e/` (cada `.mjs` declara su población).

## 0 · La respuesta corta

- **Hoy:** el merge de #2981 (`8f4d7e863`, 10:53:28Z) cambió `sesion.mjs`; la primera sesión que recibió `ALTERADO`
  fue el orquestador a las 11:05:25Z; la copia se refrescó a las 17:31:43Z (fecha del fichero, reloj de la máquina,
  que va adelantado: desfase de hoy sin medir). **6 h 38 min cerrada.** Tras el refresco, copia y `origin/main` son
  idénticas: 81.772 B, sha256 `e96077461a593230283e4f35ea76d595d2924aa5563ec885bb2d0ffdb64e621b` (`comparar.txt`).
- **No es la primera vez: es la 13.ª desde la instalación (21-sep), y suman 99 h cerradas.** Las 12 anteriores se
  curaron solas en la siguiente pasada de `arranque.cmd` (de 2,8 a 16,8 h). **Ésta no podía curarse: las tareas
  programadas que corren `arranque.cmd` están desactivadas desde el 27-oct** (última línea de `arranque.log`:
  2026-10-27T12:05:04Z). El refresco vivía DENTRO del arranque automático; al apagar el arranque por su coste, se
  apagó también, sin que nadie lo dijera, el único refresco que había.
- **Desde el 27-oct, cada merge que toque `sesion.mjs` cierra la puerta SIN FECHA DE APERTURA**, hasta que una mano
  copie el fichero. Ritmo medido: 20 merges a ese fichero en 42 días (uno cada ~2 días).
- **La puerta ya distingue `ALTERADO` de `NO-PUDE-MIRAR`** (`sesion.mjs:893-911`, veredictos distintos), pero los dos
  salen con código 2 y `ALTERADO` no dice desde cuándo, qué versión es la copia ni cómo se arregla.

## 1 · Lo que costó, medido (actividad de los `.jsonl` y merges a `main`)

| hora (Z) | 29-oct: sesiones · turnos | qué pasaba |
|---|---|---|
| 09 | 7 · 565 | |
| 10 | 14 · 1.790 | 16 merges entre las 10:00 y las 12:20:37Z |
| 11 | 7 · 601 | 11:05 y 11:16: `ALTERADO` al orquestador (`alterados.txt`) |
| 12 | 1 · 24 | 12:20:37Z, último merge del día (#2984) |
| 13 | 1 · 6 | |
| 14-16 | **0** | nadie trabaja |
| 17 | 7 · 348 | tras el refresco de las 17:31 |

Población: 40 `.jsonl` de `~/.claude/projects` (sin subagentes) modificados desde el 27-oct (`actividad.txt`).
**Lo que no se ha hecho por eso — ESTIMACIÓN, no medida:** a ritmo de la mañana (16 merges en 2 h 20 min) son
~5 h × ~7 merges/h; digamos **del orden de 25-35 merges**. *Lectura mía, no medida:* la parada tiene dos causas que se
pisan: la puerta cerrada impedía relanzar, y había sesiones esperando respuesta en su `needs` (dos de ellas
preguntaban, según el orquestador, justo por refrescar `sesion.mjs`). Separar cuánto es de cada una no se puede con
estos datos.

## 2 · ¿Cuántas veces ha pasado? (`ventanas.txt`)

Cada merge a `main` que toca `scripts/equipo/sesion.mjs` deja la copia distinta de `origin/main` hasta la siguiente
pasada de `arranque.cmd` (la copia va antes de la línea que escribe en `arranque.log`). Desde la instalación
(21-sep, 07:11Z): **13 cierres** (16 merges; tres pares cayeron en la misma ventana), **99 h** en total; 12 se curaron
solos, el de hoy no. Sesiones que de verdad RECIBIERON `ALTERADO` al ejecutar la copia instalada, en 575 `.jsonl`
(433.055 líneas, 78 ejecuciones reconocidas de la puerta, `alterados.txt`): **3** (1-oct 12:10Z, tras #2002; 29-oct
11:05Z y 11:16Z). Control positivo del mismo instrumento: ve 9 `ESTADO`, 20 `LANZADA` y 12 `RELEVADA`. Los otros
cierres cayeron de noche o sin nadie lanzando, y se curaron antes de que se notaran: por eso no constaba.

## 3 · ¿Qué dice la puerta cuando está ALTERADO, y se distingue de «no pude comprobar»?

Recibido hoy, literal: `{"ok":false,"veredicto":"ALTERADO","motivo":"esta copia no es idéntica a origin/main:scripts/equipo/sesion.mjs"}`, código 2.
`NO-PUDE-MIRAR` (sin `config.json`, sin `repo`, sin `traspasos`, sin leer `origin/main`) también sale con código 2,
pero con otro veredicto: **se distinguen por el veredicto, no por el código.** Lo que `ALTERADO` no dice:
- si la copia es una versión VIEJA de `main` (lo de hoy: se arregla copiando) o no es ninguna (corrupta: BOM, CRLF,
  editada a mano);
- desde qué merge está cerrada;
- cómo se reabre. Y el camino obvio, PowerShell, la estropea: medido hoy, `git show origin/main:… | git hash-object
  --stdin` en PowerShell da `ad99456…`, y el mismo contenido leído del fichero da `547e8dd…` (el blob real). Un
  refresco con `>` o `|` de PowerShell deja la puerta en `ALTERADO` aunque se haga en el momento.

⚠️ Mejorar ese mensaje DENTRO de la puerta exige tocar `sesion.mjs`, y cada cambio a ese fichero es un cierre más.
Por eso el diagnóstico debe vivir FUERA de ella (§4, punto 1).

## 4 · ¿Se puede detectar antes, y refrescar sin una mano y sin debilitar la puerta?

1. **Detectar: sí, sin ejecutar la puerta.** El latido (punto 4 de c.20777, de S5) puede comparar los bytes de la
   copia instalada con `origin/main` (sólo lectura) y decir `VIVA` / `CERRADA · atrasada desde el merge X, hace N min`
   / `CERRADA · no es ninguna versión de main` / `NO PUDE MIRAR`, con la orden exacta del refresco. Y en el PR que toca
   `sesion.mjs`, avisar antes del merge de que, al entrar, la puerta se cierra hasta el refresco. **Ninguna de las dos
   toca la puerta ni la ruta instalada.** No construido en esta tanda (§6).
2. **Refrescar sin una mano en cada merge: sí, separando el refresco del arranque.** Un `refrescar.cmd` con sólo las
   líneas de `git fetch` y de copia que ya tiene `arranque.cmd` (sin la última, la que lanza el orquestador), corrido
   por una tarea programada cada 15 min. **No debilita la puerta:** la fuente es la misma `origin/main` (rama
   protegida, con el obligatorio) contra la que la puerta compara; la puerta sigue fallando cerrado entre el merge y
   la siguiente pasada (≤ 15 min). Coste en tokens: cero; no lanza nada. **Pero escribe en la carpeta instalada:
   necesita la decisión del fundador y que él cree la tarea UNA vez.** Una sesión no puede (regla `deny` sobre
   `yaqu-equipo/**`, y no programamos nada).
3. **Descartados, y por qué:** que `sesion.mjs` se reescriba sola al ver `ALTERADO`, o que `uso.mjs` (la barra de
   estado, que ya corre desde la carpeta instalada) copie el fichero. Las dos son código de una sesión escribiendo
   en la ruta que la regla `deny` prohíbe: el mismo rodeo con otra forma.

## 5 · La lista blanca (encargo añadido el 29-oct: «más puestos»)

- La lista NO está en el código: `validarNombre` (`sesion.mjs:182-183`) la saca de `config.json` → `puestos` de la
  instalación, hoy `orquestador, sesion-0 … sesion-5`. **Añadir un nombre ahí no toca `sesion.mjs` y no cierra la
  puerta**; pero el fichero está bajo la misma regla `deny`: lo edita el fundador.
- Una `sesion-6` arrancaría SIN IDENTIDAD: `_carriles.mjs:224` sólo reconoce `sesion-[0-5]` y `s[0-5]-<algo>`, y no
  hay carril S6 en `dos-equipos.md` §3.
- **Mi recomendación:** refuerzo = una segunda sesión de un puesto que existe, con nombre `s<N>-<sufijo>` (p. ej.
  `s2-b`), que el hook ya reconoce como S<N>. Es la (B) que el fundador firmó el 14-oct (c.19615) y el punto 5 de
  c.20777. Exige cambiar `validarNombre` → cerrar la puerta al mergear → **que vaya en el mismo PR que el refresco
  del punto 4.2, después de que la tarea exista.** Si lo que se quiere son carriles NUEVOS (S6…), es una decisión de
  organización (`dos-equipos.md`, `sesion-6.md`, los `S[0-5]` de `_carriles.mjs`), no de la lista blanca.

## 6 · Lo que NO se ha hecho ni medido

- No construido: la sección del latido (4.1), `refrescar.cmd` (4.2) ni la (B) (§5). Esperan la decisión del fundador
  sobre 4.2; 4.1 no la necesita y es lo siguiente de S5.
- El desfase del reloj de la máquina hoy: las horas del `.jsonl` y de los ficheros son del reloj local.
- Cuántos minutos tardó cada cierre anterior en notarse: sólo hay 3 `ALTERADO` recibidos.
