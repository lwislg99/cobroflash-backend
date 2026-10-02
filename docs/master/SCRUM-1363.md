# SCRUM-1363 · La tanda dirigida no ve los censos que recorren el árbol: qué tests cubren lo que has tocado

**Medido contra:** `origin/main` = `64dc3211d039cedece0cccf9fa3fcaf7d491319d` · 2026-10-01T13:03:31Z

A9: comprobación → `tests/scrum1363-tests-que-cubren.test.mjs`

Carril S3 (instrumentos). Sesión s3-1oct-b. Por encargo del orquestador.

## El defecto

Con la máquina justa de memoria la tanda completa muere en local, y lo que se corre antes de empujar
es una dirigida armada a mano: «los tests que nombran el fichero que he tocado». Un PR cayó en CI por
`scrum713c` (estilos escritos desde JS: 337 contra un techo de 336) con su dirigida local en verde.
`scrum713c` hace `readdirSync` de `public/dashboard/js` y no nombra ningún fichero: **ninguna
selección por nombre lo incluye nunca**.

PASO 0: no había nada en `scripts/` ni en `package.json` que seleccionara tests por lo tocado.

## Qué entra

| Pieza | Qué hace |
|---|---|
| `scripts/_tests-que-cubren.mjs` | Lee por AST cada test y los módulos que importa. Tres cubos por test: **NOMBRA** (la ruta, o el nombre suelto del fichero en una cadena del código), **RECORRE** (lista un directorio que lo contiene, también a través de un «caminante» de otro fichero) y **NO SÉ** (lista algo que no se resuelve leyendo, o le pide la lista a git). |
| `scripts/tests-que-cubren.mjs` | El comando. Sin argumentos toma lo que la rama cambia respecto a su base más lo que hay sin commitear. Dice población, cubos, selección, y los tocados que ningún test cubre a la vista. `--porque` explica cada uno. `--lanzar` los corre. |
| `npm run tanda:dirigida` | El camino por defecto: calcula y lanza. Nadie elige la lista. |
| `tests/scrum1363-tests-que-cubren.test.mjs` | El guard, en el obligatorio. |

El cubo NO SÉ entra **siempre**: «no sé qué lee» no es «no lee esto».

## Medido sobre el árbol

| Fichero tocado | Por nombre (a mano) | Por el comando | `scrum713c` |
|---|---|---|---|
| `public/dashboard/js/albaranDetailView.js` | 26, sin `scrum713c` | 388 de 1.170 (192 nombran · 51 recorren · 145 no sé) | **entra**, RECORRE `public/dashboard/js` |
| `prisma/schema.prisma` | 157 | 253 (109 nombran · 144 no sé) | no le toca |

Los que salen «por nombre» y no por el comando se abrieron uno a uno en la muestra: mencionan el
fichero en un COMENTARIO, o casan por subcadena («schema» dentro de una URL de `schemas.xmlsoap.org`).

## Lo que NO hace, dicho

- **No sustituye a la tanda completa.** El juez es el CI.
- **Es estático.** Una ruta compuesta en ejecución con trozos que no están escritos no se ve. Por eso
  existe el cubo NO SÉ, y por eso es grande: 145 a 176 tests entran siempre. Los mayores culpables
  son módulos compartidos que listan por parámetro (`_arbol-quieto`, `_puerta-de-entrada`,
  `frontera-dist`) y los `git ls-files`. Es la lista por la que seguir si se quiere encoger.
- **La selección sigue siendo un tercio de la tanda** para una vista del panel, porque
  `tests/_banco-vistas.mjs` las carga todas y eso es dependencia de verdad.
- **No mide sus propios fallos.** Un test que caiga en CI y que la dirigida no hubiera seleccionado
  es un fallo del selector; contarlos contra los rojos reales es el siguiente ticket.
- **Que se use** es norma, y las normas son de S0. Aquí queda el comando por defecto.

## Error propio

La primera versión daba por RECORRE cualquier directorio que el test nombrara, y por NO SÉ a todo el
que importara un módulo con un `readdirSync` sobre un parámetro: 515 seleccionados de 1.170 para una
vista, 258 de ellos por «no sé». No era fail-closed, era ruido: una dirigida de media tanda no la
corre nadie. Se separó «lista este directorio» de «lo nombra», y los caminantes se resuelven donde
se les llama. Lo que lo destapó fue contar la POBLACIÓN de cada cubo antes de dar el comando por
bueno, no el caso de `scrum713c`, que salía bien desde el principio.

Y un segundo, que cazó el propio comando: la pasada parcial trajo en rojo `scrum258` («estado en una
ruta fija del temporal») contra `scripts/tests-que-cubren.mjs`, que escribía su TAP en una ruta fija
de `os.tmpdir()`. Ahora va a un temporal único que se borra al salir, y quien quiera conservarlo lo
pide con `--tap=<fichero>`. Ninguna selección por nombre habría corrido `scrum258` por tocar ese script.

## Probado en ROJO

| Mutación (`git diff --numstat` 1 1) | Cae |
|---|---|
| deja de apuntar los directorios listados | 4 de 5: el caso real, el comando, los cubos y el fail-closed |
| lo que no se resuelve deja de ir a NO SÉ | 2 de 5: los cubos y el fail-closed |

## Lo que se corrió

El guard nuevo (5 tests), sus dos mutaciones, y los vecinos: `scrum273`, `scrum1294`, `scrum548`,
`scrum702`, `scrum723`, `scrum824`, `scrum1349` y `guards:entrada`.

**El lanzamiento real NO se completó, y se dice.** `--lanzar` sobre `docs/equipo/orquestador.md`
seleccionó 180 de 1.179 y arrancó con 2 ficheros a la vez; pasados diez minutos el sistema mató el
proceso por falta de memoria en la máquina (no fue un fallo del comando). En el TAP parcial había
747 tests en verde y 7 caídos. El camino de `--lanzar` queda probado por piezas (recuento del
TAP, `dist/` viejo, concurrencia) y **sin una pasada entera vista**. La tanda completa, la del CI.
