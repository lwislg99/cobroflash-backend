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
