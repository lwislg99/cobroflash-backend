# SCRUM-1540 · `ramas-borrables.mjs` ya no propone borrar una rama cuya punta viva no sabe si está en `main`

**Medido contra:** `origin/main` = `3c25452545a3b7092fb284df8a57b4f203f7a8a8` · 2026-10-14T08:18:58Z (`Date:` de GitHub).
Rama `scrum-1540-borrables-por-la-punta-viva`. Puesto: S5.

## La medida que pidió el orquestador, primero

**¿Cuántas ramas propone borrar HOY que NO deberían borrarse?** Con el guion SIN tocar, sobre el árbol
real, 14-oct-2026 ~07:59Z: propone **5**, y las **5 están bien**: su punta VIVA (leída con `ls-remote`)
es ancestro de `main` y ninguna tiene un PR abierto (9 PR abiertos leídos con `gh`). **0 mal propuestas.**
Control positivo del medidor: una rama viva sin mergear (`chore-flujo-pr`) sale «no es ancestro», y un
sha que no está en el almacén sale 128. O sea: hoy el defecto no ha mordido, y el peligro es real (abajo).

Lo que esa medida NO contesta: si alguna rama se borró ya por esta vía antes de hoy. No hay registro de
cuándo se ha corrido `--ejecutar`.

## El rojo, visto antes de arreglar (paso ① del ticket)

Remoto de juguete en `%TEMP%`: veinte ramas mergeadas cada una por su propio merge, y `scrum-1-mergeada`
recibe después un commit nuevo desde OTRO clon. En el clon que no ha hecho `fetch`, el guion sin tocar:

    CONTROL · ninguna sin mergear en la lista: ✅
    CONTROL · main fuera de la lista: ✅
    CONTROL · el reparto separa de verdad: 1 apartadas de 21 (4.8 %) ✅
    BORRABLES: 20 …
    git push origin --delete scrum-1-mergeada scrum-10-otra …

y la punta viva de `scrum-1-mergeada` (`8d6de33bbc437dc3b54ba62316c8e219feb4a8a9`, el commit sin mergear)
**ni siquiera estaba en el almacén de ese clon**.

**La causa, medida, no es la que suponía el ticket.** Este guion no llamaba a `--is-ancestor`: decidía
con `git branch -r --merged origin/main`, que lee las refs LOCALES `refs/remotes/origin/*`, y cruzaba esa
lista con los NOMBRES de `ls-remote`, nunca con sus shas. Una ref local atrasada decía «mergeada» de una
punta que ya no era la del remoto. El 128 del ticket es el mismo defecto visto desde 1539; aquí la forma
es «ref local vieja leída como verdad».

## Qué cambia

- Cada rama se juzga por su punta VIVA: el sha de `ls-remote`, contra `origin/main` resuelto UNA vez.
- `veredictoDeAncestro`: TRES respuestas. 0 dentro · 1 fuera · **todo lo demás NO SE PUEDE SABER**, y
  antes de preguntar se mira si el sha está en el clon (`cat-file -e`). El tercero NUNCA es borrable y
  sale en su propia lista con el motivo y «haz `git fetch origin` y vuelve a correrlo».
- Controles (paso ④): las sondas se prueban primero sobre casos SEMBRADOS que no escriben nada (el padre
  de main está dentro; main no está dentro de su padre; un sha inexistente no se puede saber). Si una
  falla, CIEGO. Y cada borrable se vuelve a medir con OTRA sonda: `rev-list --count <main>..<punta viva>`
  tiene que dar 0.
- `--ejecutar` relee el remoto justo antes de borrar y NO borra la rama cuya punta se movió desde la lista.
- De paso: «refs locales de más» decía 1.212 y eran **1**. Las otras 1.212 son `refs/remotes/pr/*`, refs de
  PR traídas por algún fetch, que `git branch -r` mezclaba con las de `origin`. Ahora se cuentan sólo las
  de `origin`, de un único `for-each-ref`.

Pasada real con el guion nuevo (14-oct, en seco): 162 vivas · 19 dentro · 140 fuera · **2 NO SE PUEDE
SABER** (`scrum-1115-el-remite-es-configuracion`, `scrum-1346-el-tecnico-solo-lo-suyo`: sus puntas vivas
no estaban en el clon) · BORRABLES 5, las mismas de antes.

## La trampa del orquestador: un sha fuera de los remotos NO prueba pérdida

Vale para los ÁRBOLES (sus ramas locales), no para este guion, y se dice para que no se confunda: aquí
toda rama sale del remoto, y una rama aplastada (squash) al mergear tiene su punta FUERA de `main`, así
que cae en «fuera» y no se propone. El error de este guion con un squash es del lado seguro: no la
borra aunque su contenido esté dentro. Comparar CONTENIDO (el árbol de la punta frente a `main`) es lo
que necesita el instrumento de los árboles, y no está construido aquí.

## Aceptación → dónde se ve

| aceptación (literal del ticket) | dónde se ve |
|---|---|
| ① Ver el fallo en ROJO primero | sección «El rojo» de arriba · `tests/scrum1540-borrables-por-la-punta-viva.test.mjs`, «EL CASO, lanzado» monta ese juguete |
| ② Distinguir los TRES resultados de `--is-ancestor` | `veredictoDeAncestro` · test «los TRES valores» |
| ③ Que el caso «no se puede saber» NUNCA acabe en «borrable» | test «una punta viva que este clon no tiene NO es borrable» y «EL CASO, lanzado» |
| ④ Arreglar los TRES controles; los positivos SEMBRADOS | `sondasSembradas` · test «las sondas se prueban sobre lo SEMBRADO» · segunda sonda `rev-list --count` en el guion |
| ⑤ Barrer el patrón, diciendo sobre cuántos ficheros | **NO HECHO** → queda en este ticket. No se ha barrido `is-ancestor`/`merge-base` en `scripts/` y `tests/` |
| (no medido del ticket) si alguna rama se borró ya por esta vía | **NO SE PUEDE SABER** con lo que hay: no queda registro de las corridas de `--ejecutar` |

Mutaciones declaradas en el test: 3, corridas a mano, 3 de 3 muertas con la base en verde.
`tests/scrum723-guard-contra-su-base.test.mjs`: dos declaraciones nuevas con su motivo (el `rev-parse`
del guion y el `main` sintético del test).

## Lo que no se midió

- La suite completa (sin turno): corrieron el test nuevo, `scrum637`, `scrum723`, `scrum812`, `scrum702*`
  y los 14 guards de entrada.
- El control de proporción del apartado sale hoy 🔴 en el árbol real (14 apartadas de 19, 73,7 %): ya
  salía así con el guion viejo. No es este defecto y no se ha mirado por qué.
