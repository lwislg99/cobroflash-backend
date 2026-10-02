# SCRUM-1385 · La sección MAIN del latido mira el CI de main, no el check de la rama del PR

**Rama:** `scrum-1385-latido-main-mira-main` · **Carril:** S5 (s5-1octd) · **Fecha:** 1-oct-2026
**Medido contra:** `origin/main` = `3017ae0c8008e93ed3ff230ebf64bbebd44b6e2a` · 2026-10-01T14:02:00Z

A9: comprobación → `tests/scrum1350-latido.test.mjs`

Carril S5. Sólo `scripts/equipo/latido.mjs` y su test.

## Qué pasaba

La sección recorría `commits?sha=main` y buscaba el obligatorio en los check-runs de cada commit. Esa
lista trae todos los commits alcanzables desde `main`, también los de las ramas ya mergeadas, y la
punta de un PR lleva el verde de su PR.

Medido el 1-oct ~13:28Z: `✅ MAIN · último con el obligatorio VERDE: 4048a415`. `4048a415` es la punta
de la rama de #2093. Sus seis check-suites tienen `head_branch = scrum-1368-latido-despliegue-fallido`;
ninguna es de `main`. El latido le atribuyó a `main` el verde del PR antes de mergear.

## El cambio

- MAIN recorre las corridas de `ci.yml` sobre `main` por `push` (`actions/workflows/ci.yml/runs`) y lee
  el job obligatorio de cada una. `commitsDeCorridas` descarta lo que no sea `push` a `main`, aunque
  la consulta cambie.
- Una corrida cancelada no se abre: se cuenta y se dice.
- Sin la lista de corridas, o sin poder leer los jobs de una que sí corrió, la sección sale ciega.

## Medido: por qué se cancelan los CI de main

El orquestador midió 18 de 30 cancelados. A las 13:48Z eran 21 de 30 (más 5 `failure`, 2 `success` y
2 sin acabar).

| Qué | Dato |
|---|---|
| Jobs de una cancelada (36870787175) | 0: nunca arrancó |
| Cuándo se cancela cada una | 1-2 s después de crearse la siguiente |
| Concurrencia en `ci.yml` | `group: ci-${{ github.ref }}`, `cancel-in-progress: false` en `main` |
| Las 3 `failure` que abrí (36868764493, 36866436425, 36863272671) | el job obligatorio dio `success`: el rojo es de la corrida, por los informativos |

`cancel-in-progress: false` protege a la corrida que ya corre. Pero GitHub guarda una sola corrida
PENDIENTE por grupo de concurrencia, y la sustituye cuando llega otra. Lo dice el comentario del
propio `ci.yml`. Con un merge cada 2-5 minutos y una tanda de unos 10, corre una de cada varias. No
es un fallo de configuración: hace lo que dice.

Consecuencia: la punta de `main` se acaba comprobando cuando paran los merges; los commits
intermedios, no. Un rojo de `main` se ve tarde y sin saber qué merge lo trajo.

## El latido antes y después (misma hora, ~14:00Z)

| | Línea de MAIN |
|---|---|
| Antes (`origin/main`) | `4 commits de main recorridos · último con el obligatorio VERDE: <punta de una rama> · 3 commit(s) más nuevos sin veredicto` |
| Después | `9 commits de main recorridos (sus corridas del CI por push, no los checks de las ramas) · último con el obligatorio VERDE: 31688d6b · 8 commit(s) más nuevos sin veredicto (6 con su corrida CANCELADA: no se comprobaron ni se van a comprobar)` |

## Comprobado

| Qué | Resultado |
|---|---|
| Dirigida `tests/scrum1350-latido.test.mjs` + `tests/scrum1356-latido-enganchado.test.mjs` | 54 tests, 54 pasan, 0 saltados |
| Una corrida de PR o de otra rama | no cuenta; si es lo único verde, la sección sale ciega |
| Canceladas | se cuentan sin pedir sus jobs; se para en el primer veredicto |
| Todas canceladas | aviso: ninguno con veredicto |
| El latido real desde el árbol | la línea de arriba |

## Lo que NO resuelve

- **«8 commits sin veredicto, 6 cancelados» sale bajo ✅.** No le he puesto umbral de aviso: con 21 de
  30 canceladas avisaría en cada pasada y se dejaría de leer, y no tengo medido qué número separa lo
  normal de lo raro. Es un dato correcto bajo una etiqueta verde; lo sé y lo dejo dicho. Decidir el
  umbral es de quien lee el latido.
- **Que cada commit de `main` tenga su corrida.** Se arregla con un grupo de concurrencia por sha en
  `main`. Cuesta minutos de Actions y revierte la opción B de SCRUM-935b (decisión del 21-sep, fijada
  por `tests/scrum935b-main-no-cancela.test.mjs`). No lo toco: es del fundador.
- El verde del obligatorio vale lo que vale: el 1-oct, 13 de 38 tandas verdes perdieron tests
  (SCRUM-1384). Esta sección dice si el job dio `success`, no si corrió todos sus tests.

## Mis errores

1. La sección la construyó este puesto (SCRUM-1350) y llevaba el día entero dando por verde de `main`
   el verde de una rama. Lo vi al comprobar por qué el latido nombraba un sha que acababa de empujar
   yo a una rama: no lo buscaba.
