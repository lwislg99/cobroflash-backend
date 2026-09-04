# SCRUM-718 · `ts.createScanner` a pelo ve la mitad de los comentarios

**Medido contra:** `origin/main` = `c9cf435b20287ad7a0dc02a3a17d3fe182dfa372` · 2026-09-04T17:25:14+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-718-escaner-con-parser`

## PASO 0 (regla 39) — remedido, el defecto sigue

`src/app.ts`: **352** líneas empiezan por `//`, el escáner a pelo ve **148**, el parser completo
**395**. Sin contexto sintáctico no sabe si un `/` abre una expresión regular o divide, y en cuanto
se desorienta **deja de ver comentarios hasta el final del fichero**.

## El censo, por AST y con control positivo

**Tres usuarios**, y el barrido encuentra los dos que sabíamos que estaban (`scrum387` y `scrum709`)
—si no los encontrara, estaría roto, no es que no hubiera usuarios—:

| Usuario | Qué le pide | ¿Le afecta? |
|---|---|---|
| `tests/scrum387-procedencia-aprobacion.test.mjs` | comentarios, su texto y sus posiciones | **Sí.** Carril ajeno (regla 9): se mide y se reporta |
| `tests/scrum709-microcopy-por-fichero.test.mjs` | lo mismo | **Sí. Migrado aquí** |
| `tests/_solo-codigo.mjs` | literales de cadena y comentarios, **y ya usa además el parser completo** | Menos expuesto |

## Cuánto pierde: por fichero, no un porcentaje medio

Sobre los **344** ficheros de `src/` y `public/`:

- escáner **13.122** comentarios · parser **21.056** → **pierde 7.934, el 37,7 %**
- se pierde en **147 de 344** ficheros
- el peor: `public/dashboard/js/jobDetailView.js`, **32 de 895** — se desorienta al **18 %** del fichero

**Y lo que costaba a los dos guards que miran la marca «aprobado por el fundador»:** veían **40 de
las 56** marcas y **12 de las 13** citas a documentos. Ésa es la respuesta a «¿algún guard concreto
está por debajo de lo que declara?»: **sí, los dos**.

## La trampa gemela, y por qué las sondas no bastaron

Si el parser tuviera su propio defecto, comparar «antes vs ahora» diría «de acuerdo» **en el error**.
Se comprobó **contra el hecho** con nueve sondas independientes: el parser las pasa las nueve.

**Pero el escáner también las pasa las nueve** — así que las sondas **no discriminan**, y una prueba
que pasa con los dos mecanismos no prueba ninguno. El desvío **no se reproduce en un fragmento
pequeño**: necesita un fichero real, con su tamaño y su mezcla de barras. Por eso el caso
discriminante del guard es un fichero **del árbol**, `jobDetailView.js`, donde el escáner ve menos de
la mitad — con suelo, por si algún día el parser dejara de ver.

## Y un falso positivo mío, encontrado por el camino

Al migrar, mi control dio por **rota** una cita: `public/dashboard/js/api.js → docs/Sprint`. No lo
estaba: la ruta real es `docs/Sprint Scrum/SESION_ACTUAL_SCRUM-69.md` y **mi clase de caracteres no
admitía el espacio**, así que la cortaba en «docs/Sprint». La clase de SCRUM-387 sí lo incluye; se
corrigió. Es justo la cita número 13, la que el escáner no veía: **invisible primero y mal leída
después**.

Los suelos suben con lo medido: de `>= 30` marcas a `>= 50`, y de `>= 10` citas a `>= 12`. El suelo
viejo pasaba en verde sobre un recuento corto, que es la peor forma de un suelo — tranquiliza
exactamente cuando no debería.
