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

`posixADrive(destino)`, nueva, usada dentro de `cwdDelComando` (único sitio donde el string del
`cd` se convierte en `cwd`): si `destino` tiene forma `/<letra>/…` y estamos en `win32`, se traduce
a `<letra>:/…` ANTES de que nadie más lo use. Todo lo que consume `entorno.cwd` (`ficheroQueSePierde`,
el chequeo de junctions, `descarteGit`) queda arreglado de un solo golpe, sin tocar cada consumidor.

No se ensancha nada: sigue devolviendo `base` cuando no hay `cd`, y una ruta ya nativa (`D:/x/y`,
como la usaba SCRUM-454) no se toca.

## 3 · Verificación — rojo antes, verde después (A21/A23)

Test nuevo: `tests/scrum1091-guard-cwd-posix.test.mjs` (4 casos), con un repo Git desechable y el
caso EXACTO del ticket: `cd "/<letra>/…" && echo "NUEVO TEXTO QUE TRUNCA" > victima.md`, sin pasar
`cwd` por `opciones` (para que `cwdDelComando` lo calcule de verdad, no un doble).

- **Con el defecto restaurado a mano** (quitando la llamada a `posixADrive`): 2/4 en rojo —
  la letra se duplica (`d:\c\…`) y la redirección que trunca **no bloquea** (`false !== true`).
  Reproduce EXACTAMENTE lo medido por J6.
- **Con el arreglo aplicado**: 4/4 en verde.
- Suite completa de guards (`scrum454`, `scrum744`, `scrum746`, `scrum774`, `scrum176`, `scrum176b`,
  `scrum569`, más el nuevo): **91 pass**, 3 fallos — los tres por `ERR_MODULE_NOT_FOUND: 'typescript'`
  (el worktree se creó sin `npm install`; no tocan `guard-dangerous.mjs` ni dependen de este cambio).
  Ningún test que ejercita el guard cambió de resultado más allá de lo esperado.

## 4 · Lo que NO se tocó, a propósito

- El segundo defecto del ticket (`descontarTexto` con heredoc sin comillas + `$(`) — reportado por
  J6 como "de vuestro diseño", no se decide ni se toca en este ticket: es otro cambio, con su propio
  riesgo de ensanchar o estrechar el guard.
- La lista de patrones bloqueados/permitidos: sin cambios.
