# SCRUM-1091 · `guard-dangerous.mjs` traduce `/<letra>/…` antes de resolver rutas

**Fecha:** 26-sep-2026 12:01Z (GitHub) · **Carril:** S5 · automatización y eficiencia
**Medido contra:** `origin/main` = `942e90d1f84dd6d7fcf5fa92aad48f36758c2d87` · 2026-09-26T12:01:41Z
**Rama:** `scrum-1091-guard-cwd-posix`

> ⛔ `src/` intacto. Sólo se tocó `.claude/hooks/guard-dangerous.mjs` (una función) y se añadió un
> test nuevo. No se ensancha ninguna lista de patrones; el segundo defecto que reporta el ticket
> (`descontarTexto` con heredoc sin comillas) es ortogonal y NO se toca aquí — es diseño aparte.

## 0 · El encargo, en una línea

Con `cd "/c/…" &&` delante (la forma en la que el propio prompt de arranque dice a toda sesión de
esta máquina que anteponga cada comando), la regla 5 del guard —redirección que trunca un fichero
existente— nunca bloqueaba: fallaba ABIERTO, en silencio, justo en el caso que más importa.

## 1 · Causa, confirmada ejecutando (no leyendo)

En Windows, `path.isAbsolute('/c/Users/…')` ya da `true`. `cwdDelComando` devolvía ese destino
POSIX **sin traducir**, y `ficheroQueSePierde` (y cualquier otro consumidor de `cwd`) hacía
`path.resolve(cwd, destino)`, que trata un `cwd` con esa forma como **relativo al drive actual** y
duplica la letra: `C:\c\Users\…`, una ruta que nunca existe. El `catch` de `lstatSync` sobre esa
ruta inventada leía el ENOENT como «no hay nada que perder» — exactamente la misma familia de
error que SCRUM-1095 (un «no supe mirar» leído como «esto es lo que hay»).

Reproducido con el hook real, antes de tocar nada:

```
cwdDelComando('cd "/d/…/yaqu-1091-xxx" && echo hola', 'Z:/donde-sea')
→ '/d/…/yaqu-1091-xxx'                              (sin traducir)
path.resolve('/d/…/yaqu-1091-xxx', 'victima.md')
→ 'D:\d\…\yaqu-1091-xxx\victima.md'                 (con el proceso corriendo en D:; la letra se duplica)
```

## 2 · El arreglo — un solo punto, donde J6 lo propuso

`posixADrive(destino, plataforma)`, nueva, usada dentro de `cwdDelComando` (único sitio donde el
string del `cd` se convierte en `cwd`): si `destino` tiene forma `/<letra>/…` y `plataforma` es
`win32`, se traduce a `<letra>:/…` ANTES de que nadie más lo use. Todo lo que consume `entorno.cwd`
(`ficheroQueSePierde`, el chequeo de junctions, `descarteGit`) queda arreglado de un solo golpe, sin
tocar cada consumidor. `cwdDelComando` gana un tercer parámetro `plataforma = process.platform`
—opcional, retrocompatible— SOLO para que el test pueda forzar `'win32'` en cualquier host; en
producción sigue siendo siempre el `process.platform` real, nunca inyectado.

No se ensancha nada más: sigue devolviendo `base` cuando no hay `cd`, y una ruta ya nativa (`D:/x/y`,
como la usaba SCRUM-454) no se toca.

## 3 · Verificación — rojo antes, verde después (A21/A23), y por qué hay DOS grupos de test

`.github/workflows/ci.yml` corre todo en `ubuntu-latest`: no hay ningún runner Windows en este
repo. El defecto depende de `path.isAbsolute`/`path.resolve` **nativos** de Windows, así que una
reproducción con `fs` real solo puede darse en un host `win32` de verdad — en Linux, `/c/…` es
sencillamente una ruta POSIX válida y no hay letra que duplicar.

`tests/scrum1091-guard-cwd-posix.test.mjs` (8 casos):

- **① Determinista, corre en CUALQUIER host** (4 casos): con la `plataforma` inyectable y
  `path.win32` explícito —sin tocar el disco—, prueba la traducción en sí: `/d/Users/…` → `d:/Users/…`
  en `win32`, sin tocar en cualquier otra plataforma, y una ruta ya nativa intacta. Incluye la
  reproducción PURA del defecto (`path.win32.resolve('/d/…', 'victima.md')` duplica la letra sin la
  traducción) para que quede medido sin depender del host.
- **② End-to-end, solo tiene sentido en `win32`** (4 casos): repo Git desechable + el caso EXACTO
  del ticket, `cd "/<letra>/…" && echo "NUEVO TEXTO QUE TRUNCA" > victima.md`, sin pasar `cwd` por
  `opciones` (para que `cwdDelComando` lo calcule de verdad). En cualquier otro host declara el
  motivo del salto (`{ skip: '…' }`, nunca un salto silencioso — A3) en vez de fallar sin sentido o
  de mentir pasando en verde por casualidad.

**Medido en ESTA máquina (win32), que es donde el defecto y el arreglo viven de verdad:**

- **Con el defecto restaurado a mano** (quitando la llamada a `posixADrive`): 2/8 en rojo —
  la letra se duplica (`d:\c\…`) y la redirección que trunca **no bloquea** (`false !== true`).
  Reproduce EXACTAMENTE lo medido por J6.
- **Con el arreglo aplicado**: 8/8 en verde, CERO skips (el host es `win32` de verdad).
- **Simulado con `process.platform` forzado a `'linux'`** (control de que el skip declarado
  funciona y no se confunde con un fallo): 4 pass (el grupo ①) + 4 skip con motivo + 0 fail —
  así es exactamente como se verá en el CI real de este repo.
- Suite completa de guards (`scrum454`, `scrum744`, `scrum746`, `scrum774`, `scrum176`, `scrum176b`,
  `scrum569`, más el nuevo): **91 pass**, 3 fallos — los tres por `ERR_MODULE_NOT_FOUND: 'typescript'`
  (el worktree se creó sin `npm install`; no tocan `guard-dangerous.mjs` ni dependen de este cambio).
  Ningún test que ejercita el guard cambió de resultado más allá de lo esperado.

## 4 · Lo que NO se tocó, a propósito

- El segundo defecto del ticket (`descontarTexto` con heredoc sin comillas + `$(`) — reportado por
  J6 como "de vuestro diseño", no se decide ni se toca en este ticket: es otro cambio, con su propio
  riesgo de ensanchar o estrechar el guard.
- La lista de patrones bloqueados/permitidos: sin cambios.
