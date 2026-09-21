# Instalación del orquestador autónomo — guion paso a paso (SCRUM-899)

> Lo ejecuta el **orquestador**, con la autorización expresa del fundador y **con todas las sesiones paradas**
> (poner al día el checkout cambia CLAUDE.md, hooks y skills, que cargan todas). La Sesión 5 mide después de
> cada paso. Cada paso trae: **orden**, **comprobación** (si no da lo esperado, se PARA y no se sigue) y
> **cómo se deshace**.
>
> Medido para este guion el 17-sep-2026 sobre `origin/main` = `262fd05f`. Si pasa un día o más, se repite la
> medición del paso 0 antes de empezar.
>
> 🔴 **SCRUM-951a (18-sep-2026): esta guía es la de la máquina de LUIS**, con su checkout compartido y sus
> valores. Para una máquina que no ha visto nada —la de Javier— la guía es
> **`docs/equipo/instalacion-maquina-nueva.md`**, y ninguna ruta de aquí vale allí. Desde 951a el equipo sale del
> `config.json` (prefijo, puestos, orquestador, tandas, prompt, traspasos), no del código; los valores del equipo
> de Luis están en el paso 4. Y un dato medido: **esta guía no se ha ejecutado nunca** (no existía
> `C:/Users/Admin/AppData/Local/yaqu-equipo` el 18-sep).

**Rutas** (Windows; en Git Bash, con barras normales):

| | ruta |
|---|---|
| checkout del fundador (`REPO`) | `D:/MILLONARIO/cobroFlash/cobroflash-backend` |
| instalación (`INST`) | `C:/Users/Admin/AppData/Local/yaqu-equipo` |
| copia de seguridad (`RESP`) | `C:/Users/Admin/AppData/Local/yaqu-equipo-respaldo` |
| binario de Claude | `C:/Users/Admin/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe` |

⚠️ **Es `claude.exe` y no `claude.cmd`:** sin shell, Node no ejecuta `.cmd`.

---

## Requisitos previos

### Espacio en disco (medido el 17-sep-2026)

| qué | cuánto | cómo se midió |
|---|---|---|
| poner al día el árbol del checkout compartido (paso 2) | **+43 MB** (de 33,8 MB / 864 ficheros a 76,8 MB / 3044) | suma de los tamaños de blob de `git ls-tree -r -l HEAD` frente a `origin/main` |
| objetos de git que trae el `fetch` | ya descargados (pack de 75,9 MiB) | `git count-objects -vH` |
| `npm install` en el checkout compartido | **no se hace** (paso 2) | — |
| un `node_modules` real, por si hiciera falta en otro sitio | **0,40 GB** | tamaño de `wt-839f/node_modules` |
| instalación en `C:` (`INST`) | < 1 MB, más `arranque.log` | tres `.mjs`, el prompt, `config.json`, `arranque.cmd` |

**Mínimo:** **D: con 1 GB libre** (árbol, `git` y margen) y **C: con 1 GB libre**. Se comprueba con
`Get-PSDrive -PSProvider FileSystem` antes del paso 1. Si no llega, se PARA. El 17-sep llegó a haber **136 MB** en D:.

🔴 **El `node_modules` del checkout compartido NO se toca.** El 17-sep, **88 worktrees** colgaban de él por junction.

### Convención de nombres (decidida por el orquestador el 17-sep)

- `orquestador` y `sesion-0` … `sesion-5`, **sin prefijo**. Desde SCRUM-951a la lista blanca de
  `scripts/equipo/sesion.mjs` es prefijo + puesto y sale del `config.json` (paso 4); para el equipo de Luis los
  nombres **no cambian**. Un puesto que no esté declarado no entra: el 18-sep corría una `sesion-2b`, y para
  lanzarla o pararla con el lanzador tendría que estar en `--puestos`.
- La sesión de prueba lanzada a mano como `0` (f4dfafd0) se relanza como `sesion-0` en cuanto el lanzador esté instalado.

### Lo que ve el fundador (prueba de relevo de la S0, orquestador, 17-sep ~14:57Z)

- Una sesión de fondo **no aparece en la barra lateral de la extensión de VS Code** ni en sus grupos.
- Se ve con `claude agents` y se abre con `claude attach <id>`, desde un terminal.
- Las autorizaciones escritas por el fundador en el chat de una sesión VIEJA **no se heredan**: se repiten en la nueva, o
  se escriben en el chat «fundador» para el orquestador.

### ¿Puede funcionar sin poner al día el checkout compartido?

- **El lanzador sí:** ya vive en `C:` (`INST`). `arranque.cmd` solo usa objetos y refs de git
  (`git fetch` + `git show origin/main:`), no el árbol de trabajo. Las copias de los scripts y del prompt siempre son las de main.
- **El orquestador de fondo, no del todo, por dos motivos medidos:**
  1. **La memoria de Claude Code va por carpeta de trabajo** (`~/.claude/projects/<ruta con guiones>/memory`). Si el
     orquestador trabajara desde otra carpeta, por ejemplo un worktree al día en `C:`, empezaría **sin memoria**: ni
     `MEMORY.md` ni traspasos.
  2. `.claude/settings.local.json` está **versionado**. Un worktree trae la versión de main (51 reglas), no las 59 locales
     del checkout (ni las de 899).
  Así que su carpeta de trabajo tiene que seguir siendo el checkout compartido. Sin ponerlo al día arrancaría con el
  CLAUDE.md, los hooks y las skills de hace ~4000 commits. El prompt ordena leer desde `origin/main`, pero hooks y skills
  se cargan igual. **Recomendación: ponerlo al día (paso 2), que solo cuesta +43 MB.**

---

## 0 · Medir antes de tocar nada

**Orden** (solo lectura):
```
git -C D:/MILLONARIO/cobroFlash/cobroflash-backend fetch -q origin
git -C D:/MILLONARIO/cobroFlash/cobroflash-backend branch --show-current
git -C D:/MILLONARIO/cobroFlash/cobroflash-backend rev-parse HEAD
git -C D:/MILLONARIO/cobroFlash/cobroflash-backend rev-list --count origin/main..HEAD
git -C D:/MILLONARIO/cobroFlash/cobroflash-backend status --short
claude agents --json
```

**Comprobación. Lo medido el 17-sep, que tiene que seguir igual:**
- rama `main`;
- HEAD `5749f2f159a94c7fa6c91c6ce38524800ec52f64`;
- **0** commits por delante de main (por detrás, ~4000);
- `status`: solo ` M .claude/settings.local.json`, ` M package-lock.json` y ficheros sin seguimiento. **Ninguno** de los
  sin seguimiento existe en `origin/main`: comprobado uno a uno, no chocan con el merge;
- `claude agents --json`: **ninguna** sesión de fondo `orquestador` ni `sesion-*`, y todas las interactivas del equipo
  paradas, salvo el chat que ejecuta este guion.

**Línea base de `.claude/settings.local.json`** (fichero **versionado** y con cambios locales):
- `allow` 59 · `deny` 0 · `ask` 0;
- huella de `allow` (sha256 del array ordenado, 16 caracteres) `e8aee116b8f3d308`;
- blob `9f32dd9d`.

**Deshacer:** no aplica.

---

## 1 · Copia de seguridad, fuera del repo

**Orden:**
```
mkdir -p C:/Users/Admin/AppData/Local/yaqu-equipo-respaldo
cp D:/MILLONARIO/cobroFlash/cobroflash-backend/.claude/settings.local.json C:/Users/Admin/AppData/Local/yaqu-equipo-respaldo/settings.local.json
cp D:/MILLONARIO/cobroFlash/cobroflash-backend/package-lock.json C:/Users/Admin/AppData/Local/yaqu-equipo-respaldo/package-lock.json
```

**Comprobación:** `git hash-object C:/Users/Admin/AppData/Local/yaqu-equipo-respaldo/settings.local.json` = el blob del
paso 0 (`9f32dd9d…`).

**Deshacer:** no aplica: la copia no cambia nada. Se conserva hasta cerrar el paso 3.

---

## 2 · Poner al día el checkout

Main cambia los DOS ficheros con cambios locales: a `settings.local.json` le añade `Bash(git fetch *)`, y
`package-lock.json` también cambia. Por eso un `merge --ff-only` directo **se niega**, que es un fallo seguro. Primero
se devuelven esos dos ficheros a su versión de HEAD; la copia del paso 1 guarda lo local.

**Orden:**
```
git -C D:/MILLONARIO/cobroFlash/cobroflash-backend restore --source=HEAD --worktree -- .claude/settings.local.json package-lock.json
git -C D:/MILLONARIO/cobroFlash/cobroflash-backend merge --ff-only origin/main
```

**Comprobación:**
- `git -C D:/MILLONARIO/cobroFlash/cobroflash-backend rev-list --count HEAD..origin/main` = **0**;
- `git -C … status --short` sin ` M` (solo quedan los mismos sin seguimiento del paso 0).

⛔ **En este paso NI `npm install` NI ningún script de esquema desde el checkout** ([[project-shared-checkout-stale]]).

**Deshacer:**
```
git -C D:/MILLONARIO/cobroFlash/cobroflash-backend reset --keep 5749f2f159a94c7fa6c91c6ce38524800ec52f64
```
Después, el paso 3 con la copia. `--keep` no pisa cambios locales; si hubiera alguno, se niega.

---

## 3 · Devolver las reglas: la UNIÓN de las locales y las de main

No se copia la versión local encima, porque perdería la regla nueva de main. Tampoco se deja la de main, que
perdería las 59 locales.

**Orden** (un solo `node`; escribe el fichero con las reglas de los dos lados, sin duplicados):
```
node -e "const fs=require('fs');const F='D:/MILLONARIO/cobroFlash/cobroflash-backend/.claude/settings.local.json';const main=JSON.parse(fs.readFileSync(F,'utf8'));const local=JSON.parse(fs.readFileSync('C:/Users/Admin/AppData/Local/yaqu-equipo-respaldo/settings.local.json','utf8'));const u=[...new Set([...(local.permissions.allow||[]),...(main.permissions.allow||[])])];const out={...main,...local,permissions:{...main.permissions,...local.permissions,allow:u}};fs.writeFileSync(F,JSON.stringify(out,null,2)+'\n');console.log('allow',u.length)"
```

**Comprobación:**
- `allow` = **60**: las 59 de la línea base más `Bash(git fetch *)`, medido el 17-sep;
- `deny` 0 · `ask` 0;
- todas las 59 del paso 0 siguen dentro: el conjunto de la copia ⊆ el conjunto final.

**Deshacer:**
```
cp C:/Users/Admin/AppData/Local/yaqu-equipo-respaldo/settings.local.json D:/MILLONARIO/cobroFlash/cobroflash-backend/.claude/settings.local.json
```

---

## 4 · Instalar

Requiere la regla de UN SOLO USO `Bash(node scripts/equipo/instalar.mjs *)`.

**Orden** (desde el checkout, ya al día; los valores del equipo de Luis, SCRUM-951a):
```
node scripts/equipo/instalar.mjs --destino C:/Users/Admin/AppData/Local/yaqu-equipo --repo D:/MILLONARIO/cobroFlash/cobroflash-backend --claude C:/Users/Admin/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe --sin-prefijo --puestos orquestador,sesion-0,sesion-1,sesion-2,sesion-3,sesion-4,sesion-5 --orquestador orquestador --tandas 08:00,13:05,18:10 --prompt docs/equipo/prompt-tanda-orquestador.md
```
La carpeta de los traspasos la calcula el instalador desde `--repo`
(`C:/Users/Admin/.claude/projects/D--MILLONARIO-cobroFlash-cobroflash-backend/memory`) y se niega si no existe.

**Comprobación:**
- la salida es `"veredicto": "INSTALADO"`, con el `config`, las tres órdenes de `schtasks` y la línea del `statusLine`;
- en `INST` están `config.json` (con `repo`, `claude`, `prefijo` `""`, `puestos`, `orquestador`, `tandas`, `prompt` y
  `traspasos`), `arranque.cmd`, y las copias de `origin/main`: `sesion.mjs`, `orquestador-arranque.mjs`, `uso.mjs` y
  `prompt-tanda.md` (cada tanda las vuelve a copiar);
- `arranque.cmd` tiene `cd /d "D:\MILLONARIO\cobroFlash\cobroflash-backend"` **antes** de la línea `node`;
- `node scripts/equipo/comprobar-instalacion.mjs --destino C:/Users/Admin/AppData/Local/yaqu-equipo` sale sin
  `FALLA` ni `NO-PUDE-MIRAR` (las tareas saldrán como `AVISO` hasta el paso 5).

**Deshacer:** borrar a mano la carpeta `C:\Users\Admin\AppData\Local\yaqu-equipo`. El hook bloquea `rm -rf` con ruta
absoluta fuera del workspace.

---

## 5 · Las tres tareas diarias

Requiere la regla de UN SOLO USO `Bash(MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-*)`.

**Orden:**
```
MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-0800 /st 08:00 /tr "C:\Users\Admin\AppData\Local\yaqu-equipo\arranque.cmd"
MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-1305 /st 13:05 /tr "C:\Users\Admin\AppData\Local\yaqu-equipo\arranque.cmd"
MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-1810 /st 18:10 /tr "C:\Users\Admin\AppData\Local\yaqu-equipo\arranque.cmd"
```

⚠️ **Sin `MSYS_NO_PATHCONV=1`, Git Bash convierte `/create` en una ruta y falla** (medido). Desde PowerShell lo frena el
clasificador.

**Comprobación:** `MSYS_NO_PATHCONV=1 schtasks /query /tn yaqu-equipo-0800` (y las otras dos) muestra la tarea con
«Diariamente» y su hora.

**Deshacer:** `MSYS_NO_PATHCONV=1 schtasks /delete /tn yaqu-equipo-0800 /f` (y las otras dos). Comprobar con `/query` que
dice «no puede encontrar».

---

## 6 · Regla permanente, límite de uso y retirada de las pruebas

**Orden** (el fundador, o el orquestador con su «sí» explícito):
- añadir la regla PERMANENTE `Bash(node C:/Users/Admin/AppData/Local/yaqu-equipo/sesion.mjs *)`;
- retirar las de UN SOLO USO de los pasos 4 y 5;
- retirar las de prueba de 899:
  - `Bash(claude --bg -n control-899-*)`, `Bash(claude stop control-899-*)`, `Bash(claude rm control-899-*)`;
  - `Bash(schtasks /create /sc once *)`, `Bash(schtasks /delete *)`;
  - `Bash(MSYS_NO_PATHCONV=1 schtasks /create /sc once *)`, `Bash(MSYS_NO_PATHCONV=1 schtasks /delete *)`, `Bash(MSYS_NO_PATHCONV=1 schtasks /query *)`;
- **el fundador**, en un chat: `/config` → **`autoContinueAtUsageLimit` encendido**. Si queda apagado, una sesión de fondo
  que llega al límite se queda en un diálogo, o sea bloqueada.

**Comprobación:**
- el JSON es válido;
- la regla permanente está una vez;
- no queda ninguna `control-899` ni `/sc once`;
- el recuento se dice y se apunta.

**Deshacer:** restaurar las reglas desde la copia del paso 1 y repetir el paso 3.

---

## 7 · Primera tanda, A MANO y con UNA sola sesión

**Orden:**
```
cmd //c "C:\Users\Admin\AppData\Local\yaqu-equipo\arranque.cmd"
```

**Comprobación:**
- la **última línea** de `C:/Users/Admin/AppData/Local/yaqu-equipo/arranque.log` es JSON con `"tanda": {"veredicto": "LANZADA", "nombre": "orquestador", …}`;
  - si dice `ALTERADO`, `DESDE-UN-ARBOL` o `NO-PUDE-MIRAR`, se PARA y se lee el motivo: la puerta ha hecho su trabajo;
- `claude agents --json`: **una** sesión `orquestador`, `kind: background`, sin `waitingFor` (unos 75 s después);
- `ListAgents` la lista como `orquestador`;
- desde el chat que ejecuta el guion, un `SendMessage` a `orquestador` pidiéndole que diga qué es → contesta por el canal;
- `C:/Users/Admin/AppData/Local/yaqu-equipo/sesiones.json` tiene `orquestador` con un `sessionId` **completo** (UUID).

**Deshacer:**
```
node C:/Users/Admin/AppData/Local/yaqu-equipo/sesion.mjs parar orquestador
```
Devuelve `"veredicto": "PARADA"`, y después `claude agents --json` ya no la lista.

---

## 8 · Cambio de chat

1. El chat del orquestador actual escribe su traspaso en memoria y **deja de repartir**. Su cron provisional ya está borrado
   (CronList vacío desde el 17-sep 15:45 CEST).
2. El fundador abre un chat **nuevo**, `/rename fundador`, y habla con `orquestador` por `SendMessage`.
   Medido: un mensaje por nombre a una sesión de fondo llega, y ella contesta al chat que le escribió.
3. El chat anterior del orquestador se cierra.

**Comprobación:** `ListAgents` muestra `fundador` (interactivo) y `orquestador` (fondo), y ningún otro chat que reparta.

**Deshacer:** parar `orquestador` (paso 7) y volver a repartir desde el chat anterior.

---

## Riesgos, dichos antes

- **Versión de Claude Code:** lo de SCRUM-899 se midió en 2.1.263 y el binario ya va por 2.1.274, porque se actualiza solo.
  Si la primera tanda no se comporta como el paso 7, lo primero es mirar la versión.
- **Orquestador vivo y parado:** la tanda contesta `YA-VIVA` y no lo despierta. Reanudar una sesión viva arranca una copia.
- **PC apagado o sin sesión iniciada:** no hay tanda.
- **Integridad:** la puerta protege de una copia desfasada o tocada por accidente, no de una reescritura deliberada
  (`docs/master/SCRUM-899.md` §③).
