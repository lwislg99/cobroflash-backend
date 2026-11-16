# SCRUM-1718 · Los 11 temporales declarados de SCRUM-1621 → `temporal()`, y la lista de 1396c se retira a cero

**Fecha:** 12-nov-2026 · **Carril:** A (S3, tests y bancos) · **Gate:** sin gate · **Rama:** `scrum-1718-temporales-de-1621`
**Medido contra:** `origin/main` = `02aa1a42d537959e00944efd9fd2d7824d4fa1bb` · 2026-11-12T19:31:14Z
A9: comprobación → `tests/scrum864c-el-temporal-no-vuelve.test.mjs`
**Tanda:** ver «Pruebas» abajo
**Skill UI:** no cargada · no cambia ningún fichero de `public/`

## Qué pasaba

`scripts/_mkdtemp-declarados.json` (SCRUM-1396c) tenía 11 entradas, todas `retira: SCRUM-1621`, y SCRUM-1621 estaba
Finalizada con esa pieza sin hacer (abrió el orquestador del equipo de Javier, desde SCRUM-1396 c.21596).

## Qué se hizo

1. **Los 11 sitios pasan a `temporal()` / `borrarTemporal()`** de `tests/_temporal.mjs` (commit `9e03f54c9`, sesión
   anterior de S3): `scrum1263`, `scrum1289b`, `scrum1424`, `scrum252`, `scrum454`, `scrum709`, `scrum726`, `scrum811c`,
   `scrum839d`, `scrum839e`, `scrum899`. Los 11 ficheros: mismos nombres de test y en verde antes y después.
2. **La lista queda vacía y se retira con su test** — decisión del orquestador del equipo de Luis, opción (a). Lo manda el
   propio diseño del guard, `scrum1396c-los-declarados-solo-bajan` (el test retirado), línea 85 (①):

       `🔴 la lista de ${RUTA_SITIOS_DECLARADOS} está vacía: se arreglaron todos. Retira este test y la lista con ella.`

   **Excepción de carril DECLARADA (regla 37):** 1396c es instrumento del equipo J (SCRUM-1396, carril J6). Va en este
   mismo PR porque el cambio de 1718 lo haría caer. Aviso previo al push en SCRUM-1718 c.21810, con referencia a 1396.
   Se retiran:
   - `scripts/_mkdtemp-declarados.json` y el test `scrum1396c-los-declarados-solo-bajan` (4 test(), 3 mutaciones);
   - en `docs/master/SCRUM-1396.md`, las 5 rutas de ese test pasan a su nombre corto con «(retirado en SCRUM-1718)»: lo
     exige `tests/scrum391-guards-declarados-presentes.test.mjs` («lo que se corrige es la entrada»);
   - de `scripts/_censo-mkdtemp.mjs`, lo que sólo servía a la lista: `RUTA_SITIOS_DECLARADOS`, `MOTIVOS_DE_SITIO`,
     `QUIEN_RETIRA`, `leerSitiosDeclarados`, `contraSitiosDeclarados`, `subeRespectoA` y el import de `contraDeclarados`
     (queda un comentario que dice qué vivía ahí y por qué se fue);
   - su entrada en `scripts/_sin-fila-declarados.json`;
   - y se apuntan en `RETIRADAS_A_PROPOSITO` (`scripts/_suelo-contra-main.mjs`): `scrum1396c` 3 → 0 y
     `tests-declarados` 13448 → 13444.
3. **El centinela hacia delante es ③ de `tests/scrum864c-el-temporal-no-vuelve.test.mjs`**, que ahora exige
   `fugasDe(censo)` = 0 sin lista. Hereda de 1396c ③ el **control positivo sembrado** (un ESCAPA fabricado que tiene que
   salir como fuga) y la **mutación de `fugasDe`** (quitarle `sinDueno`), que sobre un árbol en cero sólo quita
   acusaciones y sin el sembrado no la vería nadie. Las otras dos mutaciones de 1396c mutaban la lista retirada.

## Censo, medido (no deducido)

| medida | en `origin/main` | en la rama |
|---|---|---|
| entradas de `_mkdtemp-declarados.json` | 11 | — (retirada) |
| fugas de esos 11 ficheros (`clasificaFuente` ≠ GARANTIZADA) | **11** | **0** |
| fugas totales del árbol (`fugasDe(censar())`) | 11 (las declaradas) | **0** |
| llamadas `mkdtemp*` nuestras / GARANTIZADAS / ficheros mirados | — | 210 / 210 / 3711 |

La medida de `origin/main` clasifica con el censo de la rama el contenido de cada fichero en `origin/main`
(`git show origin/main:<f>`). La lista nació con 28 (17 J6 + 11 SCRUM-1621, c.21095); J6 retiró las suyas en 1396d/e.

## Pruebas

| prueba | resultado |
|---|---|
| `scrum864c` + `scrum1396` + `scrum1480f` + `scrum745` + `scrum810` + `scrum810b` | 41 / 41 verde |
| mutación `fugasDe` sin `sinDueno`, puesta a mano y restaurada | 864c ③ **cae**; el resto de 864c, verde |
| suelos contra la base de fusión (810/810b) sin los renglones de `RETIRADAS_A_PROPOSITO` | **caen** nombrando `scrum1396c` 3 → 0 y `tests-declarados` 13448 → 13444 (es su control: la retirada se ve) |
| tanda completa `tests/*.test.mjs` | ver el comentario de entrega en SCRUM-1718 |

## Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| migrar esos 11 al ayudante `temporal()`/`borrarTemporal()` de la casa | los 11 ficheros de `tests/` listados arriba (commit `9e03f54c9`) |
| Cada uno que se migre sale de la lista: el trinquete solo deja bajar | la lista llegó a 0 y se retiró; `tests/scrum864c-el-temporal-no-vuelve.test.mjs` ③ = 0 fugas |
