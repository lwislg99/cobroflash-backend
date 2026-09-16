# SCRUM-570 · son 1.355 ficheros, no cuatro — y la técnica que exige la casa miente en 1.336

**Medido contra:** `origin/main` = `9b49190a7ab81be5c88a32b7745623ac78c8354f` · 2026-08-20T23:33:13+01:00

> **20-ago-2026 · proceso e instrumentación. NO se normaliza nada, no se toca
> `src/core/flags.ts`, no se relaja el guard de SCRUM-533, no se cambia la configuración de git
> de nadie. Cero dependencias nuevas.**

## ① El censo: no eran cuatro ficheros con un problema

Derivado, con node leyendo **bytes** (nunca `grep`: en Git Bash normaliza al leer y da falsos
negativos, y eso ya costó una medición en SCRUM-533).

```
1.820 ficheros seguidos · 222 binarios · 242 sin ningún CR
🔴 1.355 con CR en DISCO y no en el blob
      de esos, 1.336 NORMALIZADOS por .gitattributes
      1 con CR también en el blob (la fuente de la AEAT, declarada `-text` a propósito)
```

**Los cuatro del 20-ago no eran cuatro ficheros con un problema: eran los cuatro que alguien
tocó.** El guard de SCRUM-533 sólo mira lo que la rama toca, así que muerde por sorteo. El tamaño
real —**el 74 % del checkout**— no lo sabía nadie porque sólo se descubre al morder.

## ② ¿Por qué siguen apareciendo? — y no es lo que parecía

| hipótesis | medido |
|---|---|
| `core.autocrlf` del árbol | vale `true`, pero **no** viene de este repo ni del usuario: es del **sistema** (Git para Windows lo instala así). Y **no es la causa**: `eol=lf` gana en el checkout. |
| `.gitattributes` no cubre esas rutas | **refutado**: 1.579 ficheros declaran `eol=lf`, y **1.336 de ellos tienen la copia de trabajo en CRLF**. Están cubiertos y contradicen lo declarado. |
| nunca se re-checkoutearon | **confirmado.** `git checkout-index` a un prefijo temporal, hoy, sobre esos mismos ficheros: **CR=0**. |

**La regla FUNCIONA.** Lo que pasa es que **git no reescribe retroactivamente la copia de trabajo**
cuando cambian los atributos: son ficheros que llevan en disco desde antes de que la regla les
aplicara.

### 🔴 Y de ahí sale lo que decide el punto 4: NO HAY NADA QUE COMMITEAR

El índice y los blobs **ya están en LF** — por eso `git status` da el árbol por limpio teniendo
1.355 ficheros con CR en disco. Esto **no es una normalización pendiente**: es una copia de
trabajo vieja.

Así que las cuatro salidas que planteaba la ficha se reducen:

- ~~normalizar en un commit aislado~~ → **no hay commit que hacer**. Nada que normalizar en el
  repositorio; el repositorio ya está bien.
- ~~ampliar `.gitattributes`~~ → **ya cubre 1.336 de los 1.355**. Los 20 sin regla son otra cosa
  y no explican el problema.
- **documentar la puesta a punto** → sí, y es lo que se hace: la técnica correcta, escrita donde
  la lee cada uno, más `npm run cr:limpiar` para el fichero concreto que te va a morder.
- **dejarlo y que la técnica absorba el coste** → es lo que queda, y **es lo correcto hoy**: hay
  **cinco ramas vivas**, y refrescar la copia de trabajo destruye ediciones sin guardar sin que
  el diff lo distinga. Refrescar el árbol es un acto deliberado de cada sesión, no una operación
  que haga este PR.

## ③ La técnica correcta, con sus dos casos

**Antes de tocar, siempre:** `const ORIGINAL = fs.readFileSync(F);` — los bytes de disco. Sirve
en los dos casos y es gratis.

| caso | referencia |
|---|---|
| **A · fichero NO normalizado** (`-text` o sin regla) | `Buffer.compare(disco, blob) === 0` |
| **B · fichero NORMALIZADO** (`text eol=lf`) | 🔴 **el blob no sirve**: `Buffer.compare(disco, ORIGINAL) === 0` |

Y el aviso que costó una tanda: **comprobar el blob no basta.** El guard de SCRUM-533 mira **el
disco**. Se puede tener el blob con CR: 0 —dos veces— y la tanda caída igual. No era falso: era
incompleto.

**Dónde vive**, cada sitio para su lector:
- `.claude/skills/cerebro-yaqu/SKILL.md` — quien **ejecuta**; se carga siempre, sin invocarla.
- `docs/ASESOR.md` §8.b — quien **escribe** el encargo, porque **la línea equivocada está en su
  machote**: corregirla sólo para quien la ejecuta dejaría el error saliendo en cada encargo nuevo.
- El propio script: `npm run cr:tecnica -- <fichero>` da el veredicto **de ese fichero**.

## ④ El control que decide, con las dos mitades

Sobre `docs/historico/YAQU_MASTER_V4_viejo.md` (normalizado, 1.504 CR en disco, blob en LF), con
el commit `92559074` ya hecho:

```
② revertido contra los BYTES DE DISCO guardados
   técnica CORRECTA · Buffer.compare(disco, ORIGINAL) === 0  →  ✅ dice REVERTIDO (y lo está)
   técnica del BLOB · Buffer.compare(disco, BLOB)     === 0  →  ✅ dice NO REVERTIDO
                                                    ← falsa alarma sobre un fichero intacto

③ «revertido» escribiendo el BLOB
   la comprobación contra el blob dice:  ✅ revertido
   y el fichero ha cambiado: 1.504 CR menos que como estaba
   → 🔴 VERDE SOBRE UN CAMBIO QUE NADIE PIDIÓ
```

Y una cosa que hubo que medir en vez de suponer: tras escribir el blob, **`git status` marca `M`
pero `git diff --numstat` sale VACÍO**. El fichero pierde 1.504 bytes y **el diff no lo enseña** —
la forma exacta de un cambio que nadie va a revisar. Restaurando los bytes de partida, `git
status` vuelve a LIMPIO.

**Control positivo:** sobre un fichero sin CR las dos vías coinciden y ninguna denuncia. Reversión
byte a byte verificada; `git status` limpio.

## 🔴 QUINTA OCURRENCIA, EN VIVO, DENTRO DEL TICKET QUE LA MIDE

Al escribir el bloque de `docs/ASESOR.md` aparecieron sus **170 CR**. Se limpió con la
herramienta de este ticket — y eso obligó a **corregir lo que yo mismo había escrito en ella**:

> *«si git ve cambios en el fichero, NO se toca: quitarle el CR reescribe el fichero entero y una
> edición sin guardar se perdería»* ← **falso.**

Quitar los 0x0D del **contenido actual** conserva la edición; lo que la perdería es restaurar el
blob, que es justo lo que no se hace. Y el caso con edición es **el que de verdad ocurre**: el CR
se descubre cuando ya has tocado el fichero y el guard te ha tumbado la tanda. Rechazarlo ahí
habría hecho la herramienta inútil en su único caso real.

`docs/ASESOR.md`: 170 CR fuera, edición intacta, diff resultante **`+25/-0`**.

## Verificación

- **Suite:** `3942 tests · 3865 pass · 0 fail · 77 skipped`.
- **CRLF** comprobado con `Buffer` en los cinco ficheros tocados: **CR=0** en todos.
- `limpiar` se ejercita en un directorio temporal **fuera de un repositorio**, que destapó otro
  hueco: la herramienta reventaba sin repo. Ahora dice que no pudo contrastar contra el blob en
  vez de fingir la comprobación.
- Un caso comprueba que **la regla de SCRUM-565 sigue intacta** en `cerebro-yaqu`: añadir un
  bloque a una skill que se carga siempre es fácil de hacer a costa de otra cosa.

## Lo que NO se ha hecho

- **No se ha normalizado nada.** Hay cinco ramas vivas y está escrito en SCRUM-480.
- **No se ha tocado `src/core/flags.ts`.** Sigue con sus 90 CR, declarado.
- **No se ha relajado ni saltado el guard de SCRUM-533.**
- **No se ha tocado la configuración de git de nadie.** `core.autocrlf` es del sistema y ahí se
  queda: el arreglo vive en el repo.

## Ficheros

| fichero | qué |
|---|---|
| `scripts/censo-cr-en-disco.mjs` | el censo, la técnica y `--limpiar` (nuevo) |
| `.claude/skills/cerebro-yaqu/SKILL.md` | la técnica para quien ejecuta |
| `docs/ASESOR.md` | §8.b: la corrección del machote, para quien escribe el encargo |
| `package.json` | `cr:censo`, `cr:tecnica`, `cr:limpiar` + su `//comentario` |
| `tests/scrum570-cr-en-disco.test.mjs` | 8 tests |
