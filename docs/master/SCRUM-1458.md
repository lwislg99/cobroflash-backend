# SCRUM-1458 · El vigía dice cuándo `main` está parado, y la mención queda para lo grave

**Rama:** `scrum-1458-vigia-main-parado` · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `b7f31687868053b2a567f0cc200c8158ef1ecafd` · 2026-10-06T17:22:47Z

A9: comprobación → `tests/scrum1458-vigia-main-parado.test.mjs`

Carril S5: `scripts/vigia-atascados.mjs`, `scripts/vigia-pasada.mjs`, un trozo de
`scripts/equipo/latido.mjs` y dos tests. Propuesta de la S0, encargo del orquestador de Luis.
**El `.yml` del vigía no se toca.**

## Qué arregla y qué no

Arregla dos cosas:

- **El vigía no miraba `main`.** Ahora dice «`main` está PARADO» cuando lleva 48 h sin un merge.
- **La mención al dueño iba en todo aviso.** Ahora va sólo en lo grave.

No arregla que alguien lea el issue. El aviso sale en el mismo issue de siempre. Quien lo lee es el
orquestador, por el latido: por eso esta entrega toca también el latido.

## Qué pasaba

| | Medido |
|---|---|
| Parones de `main` desde el 1-sep | 2: de 136 h (9 → 15-sep) y de 88,5 h (2 → 6-oct) |
| Avisos del vigía durante el segundo | 3 (2, 3 y 5-oct), por cuatro PR. Ninguno decía «main está parado» |
| Comentarios del issue que mencionan al dueño | 43 de 43 (cifra de la S0, no recontada aquí) |

## Por qué 48 h

Huecos entre commits de `main` (first-parent) desde el 1-sep-2026. Los midió la S0 sobre 1.287 commits.
Recontados aquí sobre 1.318 (`origin/main` = `f8da1ec8…`, 6-oct ~17:16Z), con el mismo resultado:

| Hueco de… | Cuántos | Cuáles |
|---|---|---|
| 24 h o más | 5 | los dos parones, y tres de un día y pico (45,2 h, 26,2 h y 25,5 h) |
| 36 h o más | 3 | los dos parones y un fin de semana (45,2 h) |
| **48 h o más** | **2** | **sólo los dos parones** |
| 72 h o más | 2 | los mismos |

Con 48 h habrían salido dos avisos en 36 días, los dos ciertos.

## Qué cambia

### `main` parado

- La pasada lee la fecha del último commit de `origin/main` con `git log`. El workflow ya lo trae con
  historia: no hace falta tocarlo.
- Con 48 h o más entra una fila de causa `MAIN-PARADO`. No es un PR: en la memoria del issue viaja con
  el número 0, en la misma marca de siempre, y en pantalla sale como «`main`», nunca como «#0».
- Avisa **una vez al entrar** y otra **al cruzar 72 h, 168 h y cada semana**. En el mismo umbral, calla.
  Es la regla que ya tenían los PR, sin tocarla.
- Cuando `main` se mueve, la fila desaparece sin aviso.
- **Si la fecha no se deja leer, la pasada lo dice** en el cuerpo del issue («No se pudo leer la edad de
  `main`… NO dice que `main` esté al día») y sigue con los PR. Y **conserva lo que la memoria decía de
  `main`**: si no, al volver a leerlo saldría como nuevo y el aviso se repetiría, con su mención.
- El suelo de la pasada lleva un cuarto cebo: un `main` de 50 h sale parado y uno de 47 h no.

### La mención

| Fecha | Decisión |
|---|---|
| 15-sep-2026 (SCRUM-839b) | La mención va en **todo** aviso. El issue llevaba seis días con cero comentarios |
| 6-oct-2026 (SCRUM-1458, orquestador de Luis) | Va **sólo** si `main` entra parado o cruza un umbral, o si un PR cruza 72 h o más |

Los demás avisos se siguen publicando, sin mención. Las dos fechas están en la cabecera de
`vigia-atascados.mjs`, en `vigia-pasada.mjs` y dentro de los dos tests que lo guardan.

**Una lectura mía, no de la decisión:** un PR que **entra** en la lista ya con 72 h o más también lleva
mención. La decisión dice «cruza». Lo cuento como cruzarlas porque es la primera vez que el vigía lo
dice, y sin mención no volvería a sonar hasta las 168 h. Si no se quiere, es una línea de `llevaMencion`.

### El latido

El latido reconocía un aviso del vigía por su primera frase y exigía que nombrara algún PR. Un aviso
que sólo hablara de `main` lo habría dejado **ciego** («el formato del vigía ha cambiado»). Ahora:

- Lee el aviso de `main` parado.
- Lo da por **vivo mientras `main` siga parado**. Lo mide con la fecha del último commit y la misma
  función del vigía: no hay un segundo umbral.
- Si `main` volvió a moverse, el aviso se cuenta y no se enseña.
- Si no tiene la fecha, **no lo da por resuelto**: lo enseña y dice que no sabe si sigue.

## Tests

`tests/scrum1458-vigia-main-parado.test.mjs`, 11 tests. La pasada se corre de verdad, en una carpeta de
`os.tmpdir()` con un repositorio de git creado allí y su `origin/main` fechado.

El test del latido no escribe el aviso a mano: usa el que deja la pasada. Si uno cambia el formato y el
otro no, cae.

`tests/scrum839c-la-pasada-se-ejecuta.test.mjs`: el test que afirmaba «el aviso menciona a alguien» lleva
ahora las dos fechas, y el caso de 1 h sin mención.

Recuentos y mutaciones: en el comentario de entrega del ticket.

## Lo que sigue sin mirar

- **Un parón se avisa entre las 48 h y la pasada siguiente.** El vigía pasa cada ~4,9 h de mediana
  (cifra de SCRUM-1270, no recontada).
- **Si al dueño le llegan las menciones de GitHub.** No se puede mirar desde aquí.
- **La pasada contra GitHub de verdad.** Está probada en laboratorio; el workflow no ha corrido aún con
  este código. La primera pasada tras el merge lo dirá en su resumen (`main: último commit hace…`).
- La población del latido sigue diciendo «con algún PR aún abierto» aunque la alerta sea por `main`.
