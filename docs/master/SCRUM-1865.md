# SCRUM-1865 · El trinquete de zona: canarios PRIMERO, y la pared de la tanda sube por su propia regla

**Medido contra:** `origin/main` = `2a6675c978794595696f87fb1a7ed3e52f904adb` · 2026-11-25T14:52:39Z

A9: sin fallo que generalice — las dos curas se vieron en rojo antes de darlas, y cada mutación tumba su caso y sólo el suyo.

Puesto S5 (dueño de `scripts/_trinquete-de-zona.mjs` y `scripts/_trinquete-de-zona-hijo.mjs` por decisión de Javier del
24-oct, `docs/equipo/dos-equipos.md` §3.3). Rama `scrum-1865-canarios-primero`. Encargo del orquestador (25-nov, tarde).

## La causa (medida por S3, en la descripción del ticket — no la he vuelto a medir en el CI)

- `scripts/_trinquete-de-zona-hijo.mjs:63` — pared de la tanda de 15 min. El comentario de :54 ya ordenaba subirla «si una
  pasada normal llega a ~12 min»; el 25-nov la normal iba de 10 a 15.
- `scripts/trinquete-de-zona.mjs:85` — la lista se arma `[...deLaTanda, ...canarios]`: los canarios van en la COLA, que es lo
  que la pared corta.
- Sin resultado del canario en una zona, la repesca a solas tampoco lo compara (la clave del cortado es la ruta del fichero,
  y a solas esa clave no vuelve) → `juzgarCanarios` «NO SE PUDO COMPARAR» → **CIEGO**.
- Afectadas ese día: 1825, 1798c, 1863, 1847, 1822 (+3 sin abrir). Verdes de control: 1807, 1840, 1780, 1809.

## Las dos curas

1. **Canarios primero, dentro del instrumento.** `canariosPrimero()` en `scripts/_trinquete-de-zona.mjs`, aplicada por
   `medirEnZona` a toda lista que mide. Está ahí y no en la línea de órdenes para que el veredicto de los centinelas no dependa
   de que ningún llamador se acuerde. Se reconocen por las dos cosas a la vez (fuera del árbol Y nombre de uno de `CANARIOS`):
   un fichero de `tests/` no puede adelantarse aunque se llame igual. Sólo cambia el ORDEN; quién es canario para el
   autocontrol lo sigue decidiendo `rutaClave`. `scripts/trinquete-de-zona.mjs` no se toca (sin fila en §3, `dos-equipos.md:379`).
2. **Pared de la tanda 15 → 24 min** (`PARED_TANDA_MS`, línea fechada en el hijo). 24 = 1,6 × 15, el mismo margen que se
   escribió el 15-oct para la regla. No relaja nada (regla 41): la pared no decide veredictos, sólo cuándo se deja de esperar.
   - **Consecuencia que va en el mismo commit:** el job `trinquete-zona` de `.github/workflows/ci.yml` pasa de
     `timeout-minutes: 45` a `60`. Con dos pasadas de 24 min (48) y 45 de techo, el job habría muerto sin veredicto ANTES de que
     la pared hablara — peor que hoy. `ci.yml` es de S5 (`dos-equipos.md:72`). Coste: el job corre en paralelo y no es el check
     obligatorio; los 15 min extra sólo se gastan en una pasada que de verdad se va a la pared.

## Rojo primero

Banco nuevo `tests/scrum1865-canarios-primero.test.mjs` (fichero propio: mide al cargar, como `scrum1494`, SCRUM-935d).
Tanda SEMBRADA LENTA: `availableParallelism()` ficheros que tardan 15 s (uno más que los huecos del hijo), pared sembrada de
4 s, y los canarios DETRÁS, en el orden de la línea de órdenes. Mismo camino que el job: tanda → comparar → repesca → autocontrol.

- **Sin las curas** (commit base `2a6675c97`): 2 rojos de 3.
  - «con la cola CORTADA…»: `CIEGO como el 25-nov` — los cuatro canarios «NO SE PUDO COMPARAR: su resultado falta en alguna
    zona, también a solas», el mensaje literal del job. Cada canario salió `cortada` con la ruta por nombre.
  - «CONTROL…»: `la pared de la tanda es 15 min`.
  - El SUELO (la pared salta en las dos zonas) en verde: el sembrado siembra.
- **Con las curas:** 3/3, ~10 s.
- **Control:** tanda RÁPIDA (8 ficheros + 4 canarios, mismo orden, SIN topes): no salta la pared, autocontrol OK, y la pared
  que el hijo declara es la de la tanda (2 min × 12 = 24, así que `min()` no la esconde).

## Mutaciones (catálogo en el test)

| Mutación | Rojo |
|---|---|
| ① `const enOrden = canariosPrimero(ficheros, raiz);` → `const enOrden = ficheros;` | sólo «con la cola CORTADA…» |
| ② `PARED_TANDA_MS = 24 * 60_000` → `15 * 60_000` | sólo «CONTROL…» |

Las dos anclas casan una vez cada una; aplicadas a mano, restauradas con `git checkout` y `git status` limpio.
`meta-guard-mutaciones.mjs --solo-censo`: 0. Vecinos (`scrum813`, `scrum1494`, `scrum1621`, `scrum1339s` + éste): 57/57.

## Lo que NO dice esto

- Que el CI ya no salga CIEGO: lo dirá la primera pasada del job tras el merge. Si una pasada normal llega a ~19 min, se sube
  otra vez por la misma regla.
- La cola cortada sigue sin compararse: los ficheros del final que la pared corte salen en «NO PUDE COMPARAR» / «SIN INFORME
  ENTERO», contados. Lo que cambia es que ya no ciegan el autocontrol.

---

# APÉNDICE · SCRUM-1865 · veredicto de campo de las dos curas (27-nov-2026, relevo de S5)

**Medido contra:** `origin/main` = `b627357327a4d595c8116baa38183ca967160fda` · 2026-11-27T08:17:39Z

A9: sin fallo que generalice — el método se vio cazar en el control positivo (los 15 CIEGO del 25-nov) antes de leer la población buena.

Encargo del orquestador (26-nov, noche): «¿algún CIEGO de canario tras las curas? ¿la pared cortó alguna cola?». Población: TODOS los
runs de `ci.yml` creados el 26-nov (UTC), con el job `trinquete-zona` de cada uno y su log; control positivo, el 25-nov antes del
merge de #3457 (15:11:16Z). Leído con `gh api` (runs del workflow por fecha de creación → jobs → log del job), por un guion de un solo
uso en el tmp del job, no en el árbol. «Pasadas» = los dos «… N pruebas · S s» de la línea de órdenes; la pared nueva es 1.440 s.

## Veredicto

**Ningún CIEGO tras las curas, y la pared no ha cortado ninguna cola.**

| población | runs | con veredicto | VERDE | CIEGO | cancelados | sin job | pasada más larga | job más largo |
|---|---|---|---|---|---|---|---|---|
| 25-nov ANTES del merge (control) | 111 | 76 | 61 | **15** | — | — | — | — |
| 25-nov DESPUÉS del merge | 18 | 12 | 12 | 0 | — | — | **1.440 s** (1 run) | 37 min |
| **26-nov entero** | **56** | **40** | **40** | **0** | 12 | 4 | 980 s (68 % de la pared) | 32,9 min (techo 60) |
| 27-nov hasta las 08:05Z (parcial) | 18 | 8 | 8 | 0 | 1 | 1 | 913 s | — |

- **El método caza (control positivo):** los 15 CIEGO del 25-nov son TODOS de antes del merge, y los 15 con una pasada en la pared
  vieja (900 s en 13; 903-907 en 2). Su motivo, literal del log: «el canario `canario-fijado.test.mjs` NO SE PUDO COMPARAR: su
  resultado falta en alguna zona, también a solas». Es la avería que describió S3.
- **26-nov:** las 40 pasadas con veredicto, VERDE y con los cuatro canarios en ✔. Ninguna pasada pasó de 980 s: la pared de 1.440 s
  no saltó ni una vez. Los PR que nombró el orquestador están todos (tabla): 3442/3443/3446/3447/3453/3456/3470/3471 y la ola del
  equipo J 3473-3479, y los de la cola de las 16:33Z.
- **Los 12 cancelados del 26-nov no son cortes:** el más largo duró 24,3 min (el techo del job es 60) y los 12 tienen una pasada
  POSTERIOR de la misma rama en VERDE (`cancel-in-progress`: un push nuevo sustituye al viejo). Los 4 «sin job» son runs de `main`
  cancelados antes de crear el job.
- **La única vez que saltó la pared nueva** fue el 25-nov a las 15:35Z (run 45646913052, `main`, ya con las curas): Midway 1.440 s,
  Kiritimati 728 s. Salió VERDE y **no cortó nada**: «SIN INFORME ENTERO» da 0 en las dos zonas, y la única prueba «sin comparar»
  (`tests/scrum475-ignoran-el-resultado.test.mjs`) falta TAMBIÉN en la zona que no tocó la pared (la familia del `forceExit`,
  SCRUM-1405), así que no es de la pared. Es justo el caso para el que se movieron los canarios al principio: con la pared a 15 min y
  los canarios en la cola, esa pasada habría salido CIEGO.

## Lo que NO dice esto

- La causa de los 1.440 s del 15:35Z del 25-nov: no la he buscado (el log no nombra qué fichero retuvo la pasada; `cortada` no
  aparece). Una vez en 120 pasadas (60 runs con veredicto) con las curas.
- Que no vuelva a pasar: con la cola de runners del 26-nov la pasada más lenta fue de 980 s; la regla escrita (subir la pared si una
  pasada normal llega a ~19 min) sigue en pie. La línea de órdenes no imprime si saltó la pared: aquí se ha leído como «pasada ≥
  pared». Si se quiere medir sin deducirlo, `saltoLaPared` ya viaja en la medida del hijo; falta pintarlo.
- El 27-nov está a medias (8 runs en cola o corriendo al medir).

## La población del 26-nov, run a run

| run | creado (Z) | rama | job (min) | pasadas +14 / −11 (s) | veredicto |
|---|---|---|---|---|---|
| 45800756785 | 10:22 | `scrum-1833b-equipos-rutas-y-logica` | 21 | 601 / 602 | VERDE |
| 45802891053 | 10:36 | `main` | 28.9 | 861 / 814 | VERDE |
| 45802956982 | 10:36 | `scrum-1867-backlog-j-26nov` | 28.6 | 837 / 819 | VERDE |
| 45805238176 | 10:51 | `main` | 31.4 | 917 / 902 | VERDE |
| 45806741281 | 11:01 | `scrum-1833c-pestana-equipos` | 10.6 | — | cancelado |
| 45808369903 | 11:11 | `scrum-1833c-pestana-equipos` | 2.6 | — | cancelado |
| 45809008017 | 11:15 | `scrum-1833c-pestana-equipos` | 21.4 | 621 / 607 | VERDE |
| 45824105874 | 12:54 | `scrum-1833c-pestana-equipos` | 32.9 | 980 / 932 | VERDE |
| 45826550559 | 13:10 | `main` | 31.6 | 928 / 909 | VERDE |
| 45854629442 | 16:00 | `scrum-1833e-recorrido-staging` | 19.2 | 561 / 547 | VERDE |
| 45857409116 | 16:17 | `main` | 32.3 | 953 / 925 | VERDE |
| 45859812294 | 16:33 | `scrum-1840-bizum-oculto` (#3442) | 13.8 | — | cancelado |
| 45859818202 | 16:33 | `scrum-1818-activar-plan-servidor` (#3443) | 30.4 | 890 / 877 | VERDE |
| 45859829088 | 16:33 | `scrum-1856a-salto-con-503` (#3453) | 18.7 | 545 / 533 | VERDE |
| 45859828454 | 16:33 | `scrum-1807-apartados-s1` (#3446) | 21.4 | 627 / 608 | VERDE |
| 45859831176 | 16:33 | `scrum-1807e-editor-apartados` (#3456) | 9.9 | — | cancelado |
| 45859832665 | 16:33 | `scrum-1809-candado-workflow` (#3447) | 32.6 | 950 / 945 | VERDE |
| 45861590291 | 16:44 | `scrum-1807e-editor-apartados` (#3456) | 21.6 | 632 / 609 | VERDE |
| 45861878045 | 16:46 | `scrum-1840-bizum-oculto` (#3442) | 24.4 | 725 / 686 | VERDE |
| 45861976172 | 16:47 | `scrum-1502-censo-marcas` (#3470) | 7.6 | — | cancelado |
| 45863101227 | 16:54 | `scrum-1502-censo-marcas` (#3470) | 31.8 | 946 / 901 | VERDE |
| 45863159589 | 16:55 | `scrum-1870-generador-panel` (#3471) | 28.1 | 819 / 803 | VERDE |
| 45863191573 | 16:55 | `scrum-1868b-borrar-cliente-pantalla` (#3472) | 17.4 | — | cancelado |
| 45864266702 | 17:02 | `scrum-1868a-borrar-cliente-servidor` (#3473) | 26.1 | 760 / 744 | VERDE |
| 45864317283 | 17:03 | `scrum-657b-preguntas-normativas` (#3474) | 21.2 | 629 / 599 | VERDE |
| 45865791358 | 17:12 | `scrum-1868b-borrar-cliente-pantalla` (#3472) | 14 | — | cancelado |
| 45866478817 | 17:17 | `main` | 30.1 | 891 / 861 | VERDE |
| 45866759553 | 17:19 | `main` | — | — | run cancelado antes de crear el job |
| 45867884262 | 17:27 | `scrum-1868b-borrar-cliente-pantalla` (#3472) | 25 | 736 / 709 | VERDE |
| 45868228648 | 17:29 | `scrum-1872-borde-trimestre-zona-merchant` (#3475) | 25.1 | 727 / 708 | VERDE |
| 45868283187 | 17:30 | `scrum-1055c-senal-cobro-sin-fecha` (#3476) | 28.5 | 849 / 803 | VERDE |
| 45868337210 | 17:30 | `scrum-1055d-pregunta-asesor-r1-recc` (#3477) | 24.3 | — | cancelado |
| 45868500037 | 17:31 | `scrum-1523d-recuento-y-textos-portal` (#3478) | 24.9 | 731 / 717 | VERDE |
| 45868702233 | 17:33 | `main` | — | — | run cancelado antes de crear el job |
| 45869328257 | 17:37 | `scrum-1055e-senal-en-la-pantalla-del-libro` (#3479) | 20.4 | 618 / 565 | VERDE |
| 45871693067 | 17:54 | `scrum-1055d-pregunta-asesor-r1-recc` (#3477) | 1.3 | — | cancelado |
| 45872561216 | 18:01 | `main` | 20.8 | 605 / 598 | VERDE |
| 45872786123 | 18:03 | `scrum-1055d-pregunta-asesor-r1-recc` (#3477) | 27.3 | 795 / 787 | VERDE |
| 45873128071 | 18:05 | `scrum-1868a-borrar-cliente-servidor` (#3473) | 7.5 | — | cancelado |
| 45873156426 | 18:05 | `scrum-1868b-borrar-cliente-pantalla` (#3472) | 2.7 | — | cancelado |
| 45874842498 | 18:18 | `main` | — | — | run cancelado antes de crear el job |
| 45874959312 | 18:19 | `main` | — | — | run cancelado antes de crear el job |
| 45875429792 | 18:22 | `main` | 24.2 | 719 / 681 | VERDE |
| 45875836492 | 18:25 | `scrum-1868a-borrar-cliente-servidor` (#3473) | 21.3 | 638 / 597 | VERDE |
| 45875838813 | 18:25 | `scrum-1868b-borrar-cliente-pantalla` (#3472) | 12.4 | — | cancelado |
| 45877680888 | 18:39 | `main` | 21.2 | 626 / 598 | VERDE |
| 45877734112 | 18:39 | `scrum-1868b-borrar-cliente-pantalla` (#3472) | 31.7 | 933 / 910 | VERDE |
| 45900676663 | 21:48 | `scrum-1806-r42-en-vivo` | 31.4 | 919 / 910 | VERDE |
| 45900713742 | 21:49 | `scrum-1840-r42-en-vivo` | 32.1 | 960 / 907 | VERDE |
| 45901816919 | 21:59 | `scrum-1805e-ficha-movil` (#3482) | 31 | 911 / 891 | VERDE |
| 45902047650 | 22:01 | `main` | 21 | 616 / 594 | VERDE |
| 45902270718 | 22:03 | `main` | 24.3 | 709 / 693 | VERDE |
| 45902491009 | 22:05 | `scrum-1857-casillas-tactiles` (#3483) | 28.6 | 838 / 819 | VERDE |
| 45902892505 | 22:09 | `scrum-1805-editor-modo-factura` (#3484) | 31.3 | 921 / 904 | VERDE |
| 45902922573 | 22:09 | `scrum-1809-candado-workflow` (#3447) | 24.8 | 735 / 701 | VERDE |
| 45905556702 | 22:33 | `main` | 31.4 | 914 / 914 | VERDE |

## El control positivo: los 15 CIEGO del 25-nov (todos antes del merge)

| run | creado (Z) | rama | job (min) | pasadas +14 / −11 (s) | veredicto |
|---|---|---|---|---|---|
| 45543965640 | 04:01 | `scrum-1848-ajustes-planes-44` | 31.6 | 900 / 880 | **CIEGO** |
| 45574886818 | 08:16 | `scrum-1840-bizum-oculto` (#3442) | 31.7 | 900 / 891 | **CIEGO** |
| 45576205684 | 08:25 | `scrum-1811-vigia-lista-procesos` | 32.6 | 907 / 876 | **CIEGO** |
| 45581223372 | 08:59 | `scrum-1822-candado-explicado` | 31.5 | 900 / 885 | **CIEGO** |
| 45584071424 | 09:17 | `scrum-1843-marcar-cobrada-44` | 32.1 | 900 / 900 | **CIEGO** |
| 45585334688 | 09:25 | `scrum-1837b-esquinas` | 31.9 | 900 / 893 | **CIEGO** |
| 45587695426 | 09:40 | `scrum-1824b-r42-en-vivo` | 33.8 | 900 / 898 | **CIEGO** |
| 45589772004 | 09:53 | `main` | 31.9 | 900 / 893 | **CIEGO** |
| 45589976903 | 09:55 | `scrum-1847-clientes-44` | 32.8 | 903 / 900 | **CIEGO** |
| 45620976145 | 13:11 | `scrum-1863-aviso-cancelar-cobro-390` | 31.8 | 900 / 879 | **CIEGO** |
| 45623864611 | 13:28 | `scrum-1825-dataset-proxy` | 32 | 900 / 896 | **CIEGO** |
| 45623877773 | 13:28 | `scrum-1798c-medidor-mutaciones` | 31.9 | 900 / 894 | **CIEGO** |
| 45631401306 | 14:11 | `scrum-1782b-rotulo-factura-como` | 32.9 | 903 / 893 | **CIEGO** |
| 45640919615 | 15:03 | `main` | 31.6 | 900 / 875 | **CIEGO** |
| 45642222872 | 15:10 | `scrum-1853-llamadores-css-de-j2` | 31.8 | 900 / 892 | **CIEGO** |

## El run en que saltó la pared nueva

| run | creado (Z) | rama | job (min) | pasadas +14 / −11 (s) | veredicto |
|---|---|---|---|---|---|
| 45646913052 | 15:35 | `main` | 37 | 728 / 1440 | VERDE |
