# SCRUM-1546 · El oráculo de microcopy da tres estados y declara qué no comprueba de una firma delegada

**Medido contra:** `origin/main` = `fc10ff9cb3b29eb18a5da552ec18f8c551eba7b7` · 2026-10-13T15:03:42Z

A9: sin fallo que generalice — el único tropiezo de la tanda fue una prueba de escritura innecesaria sobre este mismo registro, deshecha en el acto y sin pérdida; lo que la habría evitado ya es norma (A22.1 y A23 nº 11)

13-oct-2026 · **S0** (sesión `s0-13octg`, equipo de Luis). [Escrito por la sesión, no por Luis ni por su orquestador.]

**Carril.** El oráculo (`tests/_microcopy-aprobada.mjs`) y `docs/equipo/limites-del-fundador.md` no son de la
S0. La excepción la dio el orquestador de Luis en el encargo de esta tanda (13-oct-2026): «para SCRUM-997 y
el oráculo de microcopy, y lo que esos dos nombran». La rama, el test y las
evidencias llevan el número de SCRUM-997 (sufijo d) porque el trabajo salió de la medición de su comentario
19436, con ese ticket ya cerrado. El orquestador abrió SCRUM-1546 para el oráculo el 13-oct-2026 y el
registro vive aquí desde entonces; las evidencias siguen en `docs/master/evidencias/SCRUM-997/`.

**La decisión, y de quién es.** Del orquestador de Luis, en ese mismo encargo: que el oráculo distinga tres
estados en vez de dos (aprobado · aprobado por delegación que no puede comprobar · no aprobado), **sin
cambiar el criterio**. A quién alcanza la delegación de Javier es de Javier y no se toca aquí.

## Lo pedido → dónde se ve

| lo pedido | dónde se ve |
|---|---|
| primero medir: cuáles de los ficheros que importan el oráculo se mueven con el tercer estado | `docs/master/evidencias/SCRUM-997/banco-tercer-estado.salida.txt`: 0 de 35 con el estado añadido; 20 de 35 si lo delegado dejara de contar |
| tres estados en vez de dos | `tests/_microcopy-aprobada.mjs`: `estado` en cada registro, `comoConstaAprobado`, `delegadasSinComprobar` |
| que declare lo que no puede comprobar | `NO_COMPROBADO_EN_UNA_DELEGADA`, tres líneas, y `noComprobado` en cada delegada |
| no cambiar el criterio | `tests/scrum997d-el-oraculo-declara-lo-que-no-comprueba.test.mjs`, test 2: `aprobada` vale lo de antes, ficha a ficha sobre el árbol real; y los 35 importadores, verdes sin tocar ninguno |
| control positivo: con el oráculo de dos estados las delegadas vuelven a salir «aprobada» a secas | `docs/master/evidencias/SCRUM-997/rojos-997d.salida.txt`, mutante A: caen 7 de los 8 tests |
| no tocar el camino de emisión ni un texto en pantalla | `git diff --stat origin/main...HEAD`: ningún fichero de `src/`, `public/` ni `prisma/` |

## Lo medido por esta sesión

- **Población, recontada** (la cifra heredada era 131 y 100): sobre `bc7913ff238f537c0b45e67b8cc9b8ea850ad570`,
  132 fichas en `docs/microcopy/`, 31 con la firma del fundador y 101 con firma delegada completa; ninguna
  con otra firma. Sin las líneas de Javier siguen aprobadas las 132; sin la viñeta de Luis, 31.
- **Quién importa el oráculo:** 47 ficheros seguidos por git lo nombran. Son él mismo, 35 `tests/*.test.mjs`,
  5 guiones de `tests/banco-*` y 6 ficheros de `docs/master/evidencias/`. Ninguno de `src/` ni de `scripts/`.
- **El banco, tres pasadas sobre los 35** (319 tests): base sin mutar, 35 verdes; con un campo `estado`
  añadido y `aprobada` igual, 35 verdes; con lo delegado sin contar, 20 rojos (24 tests). Esos 20 son los
  que hoy descansan en al menos una ficha delegada.
- **Los rojos del test nuevo**, seis mutantes del oráculo, cada uno con su `numstat`: mueren los seis. Tres
  de ellos (D, E, F) son el oráculo aprendiendo a mirar cada una de las tres cosas que declara no mirar: el
  test cae y dice que hay que retirar esa línea de la declaración.

## Lo que NO se ha medido, y lo que este cambio NO hace

- **No comprueba nada nuevo.** Las 101 delegadas siguen contando. Ningún guard actúa sobre el tercer
  estado: de los 35 importadores, ninguno pregunta todavía con `comoConstaAprobado`.
- **Quién firmó cada una de las 101.** Sólo consta, leído en Jira en la tanda anterior, el de la ficha de
  SCRUM-1247.
- **Una pregunta débil con `comoConstaAprobado`** (mirar sólo si devuelve algo) no la ve el trinquete de
  SCRUM-1306, que clasifica las llamadas a `constaAprobado`.
- **El banco no se puede repetir después de este PR:** muta la línea de `aprobada` que este PR reescribe, y
  al no encontrarla se declara ciego. Corre sobre el árbol anterior.
- **La tanda completa**, en esta máquina: no se ha corrido (va por turno). Corridos los 35 importadores, el
  test nuevo, los guards de entrada y los censos que leen `tests/` y `docs/master/evidencias/`; la lista, en
  el comentario de entrega.
- Nada en yaqu.app: no cambia nada que se sirva.

## Errores de esta sesión

- Para ver si añadir al registro metía un BOM, añadí una línea con `Add-Content` a este fichero y la deshice
  con `git checkout --` teniendo dos ficheros sin comitear al lado. No se perdió nada (la orden iba limitada
  a una ruta), pero es justo lo que A23 nº 11 manda hacer con `git restore --source=HEAD` y mirando el
  estado después. La prueba sobraba: el registro se escribe con la herramienta de edición.
