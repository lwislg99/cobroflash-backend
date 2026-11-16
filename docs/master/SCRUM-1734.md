# SCRUM-1734 · `merge=union` y el job `conflicto-de-registro` también para `docs/equipo/cicatrices/*.md`

## 16-nov-2026 · SCRUM-1734 · CAMBIO: una ficha de cicatrices en conflicto ya no deja el PR DIRTY
**Medido contra:** `origin/main` = `37947dc1522a094320a4499eac28800f38cdc659` · 2026-11-16T15:52:40Z
A9: comprobación → `tests/scrum839d-union-solo-en-el-registro.test.mjs`

### El defecto (medido por J4 el 13-nov, en el ticket)
En 105 pasadas del job desde el 11-nov, 8 PR chocaron con `main` SOLO por una ficha de cicatrices y el
job los dejó en `NO-EMPUJA · FUERA-DE-REGISTRO`. Cada ficha es una lista a la que se añade al FINAL: dos
ramas del mismo puesto chocan siempre en la última línea, y la resolución es quedarse con las dos.

### Lo que cambia (el diseño del ticket, sin variaciones)
- `.gitattributes`: `docs/equipo/cicatrices/*.md merge=union`. Solo el primer nivel (`*` no cruza `/`).
- `scripts/conflicto-de-registro.mjs`: `RUTA_DE_REGISTRO` = `^docs/(?:master|equipo/cicatrices)/[^/]+\.md$`.
  Las dos cerraduras no cambian: un fichero fuera de esas dos listas y no se empuja; y el merge se rehace
  con los atributos de `main` y tiene que salir limpio.
- `tests/scrum839d-union-solo-en-el-registro.test.mjs`: la DECLARACIÓN admite esas dos reglas y ninguna
  más (y comprueba que las dos casan con `RUTA_DE_REGISTRO`); el EFECTO exige `union` en
  `cicatrices/S5.md` y `unspecified` en `cicatrices/sub/S5.md`, `cicatrices/S5.txt`,
  `docs/equipo/sesion-5.md`, `docs/equipo/nuevo.md` y en todas las centinelas de antes (`src/**` incluido).
- Comentarios de `conflicto-de-registro.yml` y mensaje del commit del job: nombran las dos listas.

### Lo que el ticket dejó sin medir: la MISMA línea en las dos ramas
Medido en el test «la MISMA cicatriz añadida por las dos ramas…»: git la da por cambio idéntico, LIMPIO
antes de llegar a `union`, así que no hay nada que empujar y la línea queda una vez.

### Comprobado
| corrida | resultado |
|---|---|
| `scrum839d` + `scrum839e` + `scrum1572` + `scrum480` | 48/48, 0 saltados |
| las 9 mutaciones declaradas de `scrum839d` (6 de antes + 3 nuevas), aplicadas una a una | 9/9 tumban el test que nombran; ficheros restaurados byte a byte (la #8 sale «muda» en mi corredor solo porque el TAP escapa `\#1318` en el nombre: su test cae) |
| mutación nueva · `RUTA_DE_REGISTRO` sin cicatrices (el defecto de hoy) | cae «POSITIVO (SCRUM-1734): dos cicatrices añadidas al final…» |
| mutación nueva · `(?:master\|equipo)` (todo `docs/equipo`) | cae «NEGATIVO (SCRUM-1734): docs/equipo fuera de cicatrices no es registro» |
| mutación nueva · la línea de `.gitattributes` quitada | cae el EFECTO (suelo de `cicatrices/S5.md`) |

### Control contra merges REALES de `main`
Los 32 merges de `origin/main` desde el 10-nov que tocan `docs/equipo/cicatrices/`, rehechos con
`mezclar()` de sus dos padres: como los ve GitHub (sin atributos), con la regla de `main` de entonces y con
la de esta rama, y la ficha que saldría comparada con la que dejó la persona.
- **10 merges resueltos A MANO** que chocaban solo en cicatrices (o en cicatrices + `docs/master/`):
  `71f23a490`, `a90247b84`, `d6eedcf1d`, `6ec50a401`, `a1a7cf9eb`, `d1dd62da5`, `4726fad50`, `07b6184a8`,
  `0f71adb23`, `116ce52a0`. Con la regla de entonces, CONFLICTO los 10; con la nueva, LIMPIO los 10, y cada
  ficha sale con el MISMO número de líneas y las mismas líneas que la persona (comparadas como conjunto,
  no por orden: el orden que deja `union` es el suyo, y `scrum1294` valida línea a línea).
- **Control negativo real:** `6c907e678` chocaba en `cicatrices/J1.md` + `SCRUM-1051.md` + un `.ts` de
  `src/modules/invoicing/` + un test → sigue en CONFLICTO con la regla nueva, y la cerradura 1 no lo
  empujaría (fuera del registro).
- **Control de que el instrumento distingue:** `ef5915c2c` chocaba solo en `docs/master/SCRUM-1723.md` y
  ya salía LIMPIO con la regla de entonces.
- Los 8 PR del ticket están todos cerrados a 16-nov (11 PR abiertos en total): no queda ninguno vivo con
  el que mirarlo. La aceptación 1 (`EMPUJADO` en el log del job) se verá en el primer PR que choque solo
  por cicatrices tras el merge.

### Lo que NO se hace
- Ni una cicatriz por fichero (la alternativa del ticket): más grande y no hace falta.
- `scrum1294`, la A9 y las fichas de cada puesto no se tocan.
