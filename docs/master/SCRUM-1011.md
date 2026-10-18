# SCRUM-1011 · `lanzar` decía LANZADA sobre una sesión sin proceso ni un turno

**Sesión:** s3-22a (refuerzo) · **Carril:** scripts/equipo/** · **Medido contra:** `origin/main` =
`067601b809b9601d8182bb9e3f84c6ca6b874d1b` · 2026-09-22T10:25:59Z (hora de GitHub)

## El defecto

`lanzar` (y el tramo de lanzamiento de `relevar`) se conformaban con que `claude` imprimiera la línea
«backgrounded» y con encontrar el id en `claude agents --json` UNA vez, sin comprobar `pid`. El ticket
midió 4 de 4 sesiones nuevas registradas con `pid=NINGUNO`, sin `status` y sin un solo turno, mientras
`lanzar` contestaba LANZADA con exit 0.

## El arreglo

`comprobarQueArranco(agente)` (pura): solo un `pid` numérico > 0 cuenta como arrancada — el mismo tell
de SCRUM-954. `confirmarArranque` (CLI) sondea hasta `ESPERA_ARRANQUE_MS` (8 s, pasos de 1 s) antes de
rendirse. Si nunca aparece el `pid`: `NO-ARRANCO` (exit 2), con el motivo y una nota — SIN CONFIRMAR —
de que puede ser un límite de sesiones de fondo concurrentes (la hipótesis que el propio ticket deja
en pie, sin medir). Aplicado en `lanzar` Y en el tramo de lanzamiento de `relevar` (mismo patrón, mismo
defecto, no descrito en el ticket pero medible con el mismo mecanismo).

## Lo que NO se ha hecho (declarado, no silenciado)

1. **Punto 2 del ticket — averiguar el límite de sesiones concurrentes, si existe.** Exige parar una
   sesión viva y relanzar en una máquina sin nada a medias, algo que esta sesión no puede hacer con
   seguridad desde aquí (no hay verificación de qué sesiones del equipo de Javier están a mitad de
   entrega en su máquina). Queda como el control pendiente que el propio ticket ya declaraba.
2. El aviso NO distingue «límite de sesiones» de otras causas de un arranque fallido (memoria, un
   `claude` roto, etc.): el motivo dice lo que se sabe (no llegó a tener `pid`) y NO inventa un
   diagnóstico más fino.

## Evidencia (PASO 0 corriendo, no leyendo)

`tests/scrum1007-1011-1026-relevo-lanzar-bloqueo.test.mjs`:
- `comprobarQueArranco`, pura: pid>0 → ok; sin pid, pid 0, o sin entrada → no ok.
- CLI por EFECTO, con un `claude` falso que NUNCA da pid: `lanzar` → `NO-ARRANCO`, exit 2, y se
  comprueba que sondeó MÁS de una vez (no fue un fallo a la primera).
- Control positivo: el pid aparece en el SEGUNDO sondeo (no en el primero) → `LANZADA`, en menos de
  8 s — prueba que el bucle re-sondea de verdad, no solo el caso trivial.
- Rojo confirmado contra `origin/main` sin el arreglo (`git stash`): los dos tests de EFECTO fallan
  (el control positivo daba `NO-PUDE-MIRAR` con el código viejo — leía el `sessionId` de la primera
  respuesta sin `pid`, exactamente el defecto del ticket).

## 18-oct-2026 · SCRUM-1011b · S5 · cuando `claude --bg` no confirma, la causa VIAJA

**Medido contra:** `origin/main` = `06c6289d46d5998493ec014fa26ff3353946b58b` · 2026-10-18T17:56:27Z

A9: comprobación → `tests/scrum1011b-lanzar-dice-por-que.test.mjs`

### El defecto, medido
El orquestador lanzó `sesion-0` dos veces con `sesion.mjs lanzar` y recibió las dos
`{"veredicto":"NO-PUDE-MIRAR","motivo":"claude no confirmó la sesión de fondo","salida":""}`. La sesión no
existe (`claude agents --json`), así que el fallo es real. Los dos sitios que responden así (`relevar` y
`lanzar`) guardaban sólo el final de **stdout**. **Tiraban stderr, el código de salida, la señal y el error
del propio lanzamiento**, que es justo donde un `claude` que falla deja el motivo. Fallar cerrado era
correcto. Comerse la única pista, no: la familia de «no pude mirar», un nivel más abajo.

### El arreglo (sólo `scripts/equipo/sesion.mjs` y su test nuevo)
`rastroDeClaude(r)` (exportada y pura): `status`, `senal`, `error` (el `code` del lanzamiento), `salida`
(final de stdout, 400) y `errores` (final de stderr, 800; el final, porque es donde va el error). Se usa en
los DOS sitios. **El veredicto no cambia**: sigue saliendo 2 y no se lanza nada.

### Comprobado
| corrida | resultado |
|---|---|
| test nuevo: `lanzar` y `relevar` con un `claude` falso cuyo `--bg` sale 3 escribiendo SÓLO en stderr | sale 2, `NO-PUDE-MIRAR`, `errores` trae el motivo, `status` 3, `salida` vacía |
| mutación: la línea vieja en `lanzar` | cae SÓLO el test de `lanzar` |
| mutación: la línea vieja en `relevar` | cae SÓLO el test de `relevar` |
| los 22 ficheros de test que nombran `sesion.mjs` + `scrum824` | 245/246 a la primera. El caído era mío: mi banco hacía `git show origin/main:`, y el censo de SCRUM-723 lo cuenta como referencia móvil. Ahora copia el fichero (con `core.autocrlf=false` son los mismos bytes). Con eso: 21/21 en 1011b + 723 + 824 |

### Por qué falla `sesion-0` de verdad: NO lo sé, y esto es lo que se ha descartado
Sin lanzar ninguna sesión (no es mío hacerlo, y la máquina está a ~2,4 GB libres):
- **El binario**: `config.json` de la instalación (`AppData/Local/yaqu-equipo`) apunta a
  `…/@anthropic-ai/claude-code/bin/claude.exe`; existe y contesta `2.1.302`.
- **La longitud del encargo** (Windows corta la línea de órdenes a 32 767 caracteres, y `cmd` a 8 191): el
  último encargo de S0 en el scratchpad del orquestador tiene 3 440 caracteres. Descartado.
- **Rastro en el registro**: ninguna carpeta nueva en `~/.claude/jobs` de esas dos tentativas, así que
  `claude` rechazó la orden ANTES de crear el trabajo.
- ~~MI LECTURA, sin medir: algo del estado del daemon (un nombre ocupado, o poca memoria).~~ **FALSA.** El
  orquestador corrió a mano la misma orden, con el mismo encargo, y arrancó (`backgrounded · 4b401020`),
  con la misma memoria libre.

### Medido después (18-oct ~18:10Z): es la CONFIANZA del directorio desde el que se lanza
- Los argumentos NO son: `argsLanzar` de la copia INSTALADA da `--bg -n sesion-0 --permission-mode auto
  --model opus <encargo>`, los mismos que a mano.
- La instalación no declara `mesas` → `SIN-MESA`: `claude` hereda el cwd de quien corre `sesion.mjs`.
- `~/.claude.json` (sólo su campo `hasTrustDialogAccepted`): `D:/MILLONARIO/cobroFlash/cobroflash-backend`
  → `true`; **`d:/MILLONARIO/…` (la misma carpeta, con la letra en minúscula) → `false`**; y
  `AppData/Local/yaqu-equipo` no aparece, así que no tiene la confianza dada.
- **Sonda** (una sesión de nombre desechable y prompt inerte, lanzada desde un directorio sin confianza):
  `status 1`, **stdout vacío**, y en stderr `Workspace not trusted. Run claude in <dir> once and accept the
  trust prompt, then retry.` No creó trabajo, así que no hubo nada que limpiar. Es el síntoma exacto: con
  `errores`, el primer intento lo habría dicho.
- ~~Qué cwd heredó, no lo sé: `yaqu-equipo` o `d:\…` en minúscula; los dos sin confianza.~~ **CORREGIDO por
  S5 a los minutos, medido:** `D:/MILLONARIO/cobroFlash` es de confianza y sus hijas la heredan. Una sonda
  desde `d:\MILLONARIO\cobroFlash\…` en minúscula ARRANCÓ: **la letra de unidad no cuenta**, y la entrada
  `false` de `d:/…` apunta un lanzamiento, no lo impide. Mi filtro buscaba el repo y no listó al padre:
  «no pude mirar» leído como «no hay». El cwd fue **`yaqu-equipo`** (el orquestador corrió
  `cd ".../yaqu-equipo" && node sesion.mjs …`), que no cuelga de ninguna carpeta de confianza. El
  arreglo de fondo (lanzar desde `repo`) es SCRUM-1298c.
