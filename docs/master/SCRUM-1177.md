# SCRUM-1177 · Las citas a una red que no existe

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T15:58Z

S3 · rama `scrum-1177-citas-a-redes-que-no-existen` · worktree `wt-s3-1367e` (hora del `Date:` de GitHub).

## Qué mentía

Un comentario de test que dice «esto se mide en tal guard» cuando ese guard no ha existido nunca. Quien
lo lee se cree que hay red, y nadie comprueba lo que el comentario dice que se comprueba.

## Cuánto

Censo de las líneas de COMENTARIO de los `.mjs/.js/.cjs` seguidos de `tests/` y `scripts/` (1.843
ficheros, 113.214 líneas de comentario), buscando entre comillas de código rutas `tests/…` o
`scripts/…`, ids de test (`scrumNNNx`) y `npm run x` que no existen. Control positivo: las dos citas del
ticket salen.

| clase | cuántas | qué se hace |
|---|---|---|
| red que **nunca existió** | **3** | se corrigen (abajo) |
| ejemplo o marcador de una API (`tests/x.mjs`, `scripts/X.mjs`, `npm run X`…) | 8 | declaradas, una a una |
| temporal que crea un test mientras corre (`tests/__tmp-emite-sin-sellar.ts`) | 1 | declarada |
| fichero retirado a propósito en SCRUM-773, nombrado como historia | 5 | declaradas |
| `test:pass`/`test:fail`… tomados por scripts de npm | 35 | **falso positivo de mi primer patrón** (son eventos del reporter de Node): se retiró el patrón, no se cuentan |

Las tres redes, con `git log --all -- <ruta>` vacío (no se borraron: no existieron):

1. `tests/scrum783-seleccion-sobrevive-navegacion.test.mjs:115` — «la visibilidad de verdad se mide en
   navegador» con un guard de la barra de selección. **Ahora dice:** nadie la mide en navegador; las
   reglas de la cascada las fija `tests/scrum792-barra-alcanzable-en-movil.test.mjs` (que existan en su
   `@media`, no que ganen). Es la opción 2 del ticket; la 1 (medirlo) queda **sin hacer**, abajo.
2. `tests/scrum720b-el-nav-abre.test.mjs:16` — atribuía a un `scrum652f` que no existe lo que mide el
   «SUELO DEL NAV» de `scrum652d`. Corregida la cita.
3. `tests/scrum832-atras-vuelve-a-la-lista.test.mjs:18-19` — **no venía en el ticket; la encontró el
   censo.** «El atrás de verdad se mide en» un guard que nunca existió. **Ahora dice:** el «atrás» de una
   ficha a su lista no lo mide nadie; `guard:rastro-del-menu` pulsa «atrás», pero entre pantallas del menú
   (leído en `scripts/guard-rastro-del-menu.mjs:122-134`).

## La red nueva

`tests/scrum1177-la-red-citada-existe.test.mjs`, en el check obligatorio. Trinquete de dos mitades: una
cita rota sin declarar cae, y una declarada que ya no aparece también cae (sobra). Suelo: > 1.000
ficheros y > 50.000 líneas de comentario leídas. Control del detector con un árbol fabricado (una rota,
una buena, una en código que no cuenta, y `npm run`).

Rojo por mutación, sobre `af4c8b5a3f0d63a2eb7c44e5f44ab7329221910d` (el árbol entero comiteado antes):

- se re-introduce en `scrum832` la cita al guard inexistente → cae el caso 2, nombrando
  `tests/scrum832-atras-vuelve-a-la-lista.test.mjs:18`;
- se añade una DECLARADA que no corresponde a nada → cae el caso 3, nombrándola.

Deshecho con Edit (`git diff` vacío después).

## Lo que no mira, declarado

Un comentario al final de una línea de código; una cita sin comillas de código; los `.md`. Y si lo
citado CORRE en el check obligatorio: eso es SCRUM-1178.

## Sin hacer

- La medición de la barra de selección en un navegador (opción 1 del ticket) y la del «atrás» de una ficha
  a su lista. Las dos son piezas visibles sin red; los comentarios ya lo dicen en vez de esconderlo.
