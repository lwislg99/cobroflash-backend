# SCRUM-753 · El censo de alcanzabilidad del tablero

**Fecha:** 6-sep-2026 · **Carril:** instrumentos (censos) · **Gate:** sin gate
**Medido contra:** `origin/main` = `74aba16eb8786a7f9fa8a45325c8c0718274594a` · 2026-09-06T07:16:44+01:00
**Tanda:** 5556 tests, 5468 pass, 0 fail, 88 skipped

---

## EL TICKET, Y POR QUÉ NO ESTABA HECHO

`scripts/censo-alcanzabilidad.mjs` vivía en un scratchpad de sesión, que se borra. Antes de
escribir nada se comprobó que no estuviera ya en el árbol, y no por el número sino por el
contenido:

| comprobación | resultado |
| --- | --- |
| `git ls-remote --heads origin` filtrado por nombre de ref | 0 ramas con 753 (control positivo: `scrum-596` → 1; control negativo: `scrum-99999` → 0) |
| `git grep -n 'SCRUM-753' origin/main` | 0 menciones en 2266 ficheros |
| `docs/master/SCRUM-753.md` | no existía |
| ficheros con `alcanzab` en `origin/main` | 3, y ninguno es este censo (`exports-inalcanzables`, `ancla-alcanzable`, `albaran-si-es-alcanzable`) |

Lo que **sí** existía es el censo de SCRUM-738 (`censo-tablero-vs-arbol.mjs`), y no es lo mismo:
aquél pregunta **«¿hay evidencia que NOMBRE el ticket?»** —commits, entrada de máster, EXISTENCIA
de una rama—. Éste pregunta **«¿es alcanzable?»**.

La diferencia es el ticket entero, con los números delante:

- **4-sep-2026** — un barrido que comparaba IDENTIFICADORES dio **27 ramas «con trabajo perdido»**.
  Con `merge-base --is-ancestor` eran **13**, y doce llevaban muertas desde agosto.
- **5-sep-2026** — **nueve de once** tickets de producto asignados ya estaban en `main`. Los nueve
  figuraban en «Tareas por hacer».

---

## ① LO QUE SE ENTREGA

| fichero | qué es |
| --- | --- |
| `scripts/_censo-alcanzabilidad.mjs` | la derivación: instantánea, población, clasificación, suelo, titular |
| `scripts/censo-alcanzabilidad.mjs` | el CLI (`npm run censo:alcanzabilidad`) |
| `tests/_fixture-alcanzabilidad.mjs` | el repositorio sintético con los siete casos |
| `tests/scrum753-censo-de-alcanzabilidad.test.mjs` | el guard: 18 tests y 5 mutaciones declaradas |

Uso:

```
npm run censo:alcanzabilidad                 # barre la población derivable
npm run censo:alcanzabilidad -- 602 749 161  # pregunta por tickets concretos
npm run censo:alcanzabilidad -- --json       # para otro programa
```

---

## ② LOS TRES ESTADOS, Y EL TERCERO NO ES «NO ESTÁ»

- **DENTRO** — todas sus ramas son alcanzables desde el sha medido.
- **FUERA** — hay ramas no alcanzables, con sus commits vivos contados (`+N`).
- **NO_MEDIBLE** — no se ha podido preguntar. **Siempre con su motivo**, porque cada uno se
  acciona distinto:

| motivo | qué significa | qué hacer |
| --- | --- | --- |
| `sin rama` | hay entrada de máster y ninguna rama | mirar la corroboración: puede ser rama mergeada **y borrada** |
| `sin rama ni entrada` | **no está en la población** | es lo asignable — ver ④ |
| `número compartido` | su entrada está titulada para otro ticket | desambiguar el número antes de nada |
| `rama sin objeto en local` | `--is-ancestor` no puede contestar | comprobar el fetch |

---

## ③ 🔴 CONTROL POSITIVO — el censo sabe decir que NO

Sobre `origin/main` = `590e019d…` (6-sep-2026T05:19Z), con los seis tickets de control del barrido
de ayer, los seis salieron **FUERA**. El caso que lo define es **SCRUM-161**:

```
merges de first-parent que nombran una rama suya .... 5
  scrum-161-encender-guard · scrum-161-un-solo-remedio · scrum-161-remedio-por-clave
  scrum-161b-e2e-recibo · scrum-161-evidencia-tanda
git merge-base --is-ancestor origin/scrum-161-tanda-en-ci origin/main  →  exit 1 (NO es ancestro)
```

**Cinco merges nombran su rama y aun así la punta está fuera.** Un barrido por nombre lo habría
dado por mergeado; por eso la columna `merges` se imprime **también en la lista de FUERA**.

⚠️ El quinto merge sólo aparece si la regex admite la **letra de fase** (`scrum-161b-`). Con
`scrum-161-` a secas el control positivo habría salido con cuatro. Medido y corregido.

El control que corre en cada tanda es **sintético**, no `SCRUM-161`: fijar un ticket real
convertiría un defecto en requisito —el día que alguien mergee 161, el test exigiría que siga sin
mergearse—. Lo que sí se mide sobre el árbol vivo es que el detector **conteste las dos cosas**.

---

## ④ 🔴🔴 LO QUE ESTE INSTRUMENTO **ES**: NO PUEDE VER LO ASIGNABLE

La población se deriva de ramas remotas ya traídas + ficheros de `docs/master/`. Un ticket **sin
rama y sin entrada no entra**. Y lo asignable es exactamente lo que no tiene evidencia:

> **El conjunto que este censo no puede enumerar es, punto por punto, el conjunto para el que se
> repartiría trabajo.**

Eso no es una precaución de uso. Es la forma del instrumento, y por eso está escrito en su salida
y en su cabecera, no sólo aquí. La consecuencia de diseño es el modo de números sueltos: a un
ticket que le **nombres** se le puede contestar `NO_MEDIBLE · sin rama ni entrada`, que es una
respuesta; a los que no nombres no se les puede contestar nada, porque no se sabe que existen.

Y la lectura que sostiene todo lo demás, también dentro del fichero:

> **EL CENSO DECIDE QUÉ NO ASIGNAR, NO QUÉ ASIGNAR.** Ninguna de sus señales distingue «se
> construyó» de «se construyó LO QUE PEDÍAS». Medido el 5-sep-2026: un ticket salió entero de
> fachada y estaba parcial, y otro entero **con el alcance invertido**.

El titular agregado **no se imprime solo**: `titularConSalvedad()` devuelve el número y sus dos
salvedades en el MISMO valor, para que no se puedan separar copiando media línea. El recuento
desnudo existe (`resumenDe`) pero es un objeto, no una frase que se pegue en un informe.

---

## ⑤ EL DESAJUSTE 454/453, EXPLICADO

Quedó declarado ayer y sin explicar: `poblacion.ticketsCensados` decía 454 y había 453 filas.
**No se pierde uno entre el recuento y la presentación: se gana uno entre dos lecturas.**

`censar()` de `censo-tablero-vs-arbol.mjs` llama a `numerosDelArbol()` para construir las filas y,
al terminar, llama a `poblacionDe()` — que vuelve a llamar a `numerosDelArbol()`. Son **dos
`for-each-ref`** separados por el censo entero (el propio fichero declara ~10 min con 450 tickets)
sobre un espacio de refs **compartido por dieciséis worktrees**. Otra sesión trajo una rama en
medio.

Es el modo de fallo peor: ningún comando falla, ningún número es «erróneo», y el informe sale con
aspecto de medición dura. **La respuesta es exacta y la pregunta indeterminada** (R10).

Aquí no puede pasar por construcción: se lee **una vez**, se **congela el sha**, y población,
clasificación, corroboración y titular salen de ese mismo objeto. El guard lo fija de dos formas:
`poblacionDe()` funciona con una instantánea cuyo `raiz` no existe (si tocara el disco, reventaría),
y hay una mutación que la hace leer el disco y exige el rojo.

---

## ⑥ EL PROCEDIMIENTO, EJECUTADO Y NO RECOMENDADO

1. `git fetch origin +refs/heads/*:refs/remotes/origin/*` — **lo hace el propio script**.
2. Se congela el sha de `origin/main`; a partir de ahí el nombre no se vuelve a usar.
3. Se leen las refs **ya traídas** (`refs/remotes/origin/`) una sola vez.

El paso 1 no es una nota en la cabecera porque los worktrees comparten refs: el tuyo se mueve sin
que hagas nada. `--sin-traer` permite medir sin red, y entonces **la salida lo dice**.

**Suelo:** si ningún ticket del lote tiene rama, no se informa de nada y se sale con **2**.
Comprobado en vivo: `npm run censo:alcanzabilidad -- 9999999` → exit 2.

---

## ⑦ SE DERIVA, NO SE DUPLICA

| pieza | de dónde | por qué |
| --- | --- | --- |
| `agruparRamas` | `scripts/_censo-reparto.mjs` (SCRUM-387) | ya sabe que EXISTIR NO ES ESTAR VIVA y que `null` es INDETERMINADA |
| `numeroDeRama`, `numeroDeEntrada` | `scripts/censo-tablero-vs-arbol.mjs` (SCRUM-738) | la convención anclada, con letra de fase |
| `numeroDelTituloDeEntrada`, `patronTicket` | `tests/_censo-tickets.mjs` (SCRUM-388) | el número compartido y la frontera de dígito |

A `patronTicket` **sólo se le ha añadido el `export`** — aditivo, sin efecto sobre el motor. La
alternativa era la tercera copia de «SCRUM-29 no puede casar dentro de SCRUM-298», y una copia es
cómo una de las dos se queda atrás.

**El costurón, vigilado.** `agruparRamas` agrupa con `numeroDeClave` (sin anclar) y la población
enumera con `numeroDeRama` (anclada). Son dos reglas para la misma pregunta: medido, **0
desacuerdos** sobre las refs de hoy, con control positivo de tres casos de respuesta conocida. Como
un cero medido caduca, el guard las reconcilia sobre el árbol vivo **en cada tanda**.

**Los dos clasificadores.** En producción se pregunta a granel (`for-each-ref --merged/--no-merged`,
**0,30 s**) y no rama a rama (`merge-base --is-ancestor`, **52,6 s** sobre 491 refs). Es el mismo
criterio preguntado al mismo motor de git; el árbitro exacto se conserva y el guard **compara los
dos rama a rama**, exigiendo además que hayan salido los tres valores. Con 52 s este censo no cabe
en `npm test`, y un control positivo que no se corre no controla nada.

---

## ⑧ TRES DEFECTOS PROPIOS, CAZADOS CONTRA RESPUESTAS CONOCIDAS

Ninguno se vio leyendo. Los tres salieron de enseñarle al instrumento un caso cuya respuesta ya se
sabía.

1. **`origin/HEAD` contado como rama.** `%(refname:short)` abrevia `refs/remotes/origin/HEAD` a
   **`origin`**, no a `origin/HEAD`, así que el filtro por nombre corto lo dejaba pasar. Respuesta
   conocida: `git ls-remote --heads origin` → **491**; el censo decía **492**. Un ref de más que
   sale siempre DENTRO. Se lee el refname completo y se descarta por identidad exacta.
2. **La columna `commits` contaba MENCIONES.** Sumaba por cada coincidencia de la regex. Medido:
   **15 de 3811 asuntos** nombran el mismo ticket dos veces (`Merge branch 'scrum-581-…' into
   scrum-581-…`), y esos quince salían con el doble. En los merges hoy hay **0** casos, así que el
   número no habría cambiado y el defecto habría esperado al primero. Un rótulo que dice «merges»
   tiene que contar merges.
3. **La letra de fase en la corroboración.** Sin `[a-z]?`, SCRUM-161 salía con cuatro merges en vez
   de cinco — y es el control positivo del ticket.

---

## ⑨ LAS MUTACIONES: CINCO, CORRIDAS TRES VECES

Declaradas con `MUTACIONES_QUE_ME_TUMBAN` y **derivadas del lector oficial**: el guard no cuenta
sus mutaciones a mano ni con un `grep` propio, le pregunta a `censoDeDeclaraciones()` —el mismo que
las va a ejecutar— si le ve. Ese lector está bajo sospecha, así que se le midió con un caso de
respuesta conocida: un `grep` de la constante da 9 ficheros y el lector 8; el noveno
(`scrum606`) sólo la **nombra en un comentario**. **Acierta el lector.**

`npm run meta:mutaciones`, tres pasadas: **27 vivas · 0 mudas · 0 ciegas** en las tres, exit 0.

| # | defecto inyectado | test que cae |
| --- | --- | --- |
| ① | el clasificador contesta «dentro» a todo | el control positivo |
| ② | `sin rama ni entrada` aplanado contra `sin rama` | los motivos se distinguen |
| ③ | el titular se queda con la primera línea | el titular sale con su salvedad |
| ④ | la población lee el disco en vez de la instantánea | la población no vuelve a preguntar a git |
| ⑤ | filtro por el nombre corto que git no produce | `origin/HEAD` no se cuenta como rama |

🔴 **Dos de las cinco nacieron MUDAS y se corrigieron midiendo**, no leyendo:

- **③** rompía un literal y dejaba el fichero sin compilar. Entonces el fichero de test no llegaba
  a cargar, no se imprimía ninguna línea `✖ <nombre>`, y el meta-guard dictaba **MUDO sobre un
  guard sano** — el mismo rótulo mentiroso que SCRUM-748 vino a arreglar, entrando por la puerta de
  la mutación en vez de por la de la línea base. Una mutación tiene que dejar el árbol ejecutable.
- **⑤** revertía sólo el filtro (`r.nombre !== 'HEAD'`), y con el refname completo ese filtro
  **funciona igual de bien**: no imitaba nada. El defecto real no era el filtro, era filtrar por el
  nombre que uno **cree** que produce git.

---

## ⑩ HUECOS DECLARADOS

**a) 🔴 El suelo del censo hermano es una decoración, y está medido.**
`scripts/censo-tablero-vs-arbol.mjs:136` hace `if (p.ticketsCensados === 0 || (suelo && suelo.ok === false))`,
pero `comprobarSuelo()` devuelve un **array** (`[]` en un árbol sano). `suelo.ok` es `undefined`, y
`undefined === false` es siempre falso: **esa mitad del suelo no se ha podido disparar nunca**.
Sólo queda en pie la condición de población vacía.

No se arregla aquí. Es un cambio de comportamiento del CLI de SCRUM-738 —cambia cuándo sale con
código 2— y ese carril no es el mío (regla 9). El arreglo es de una línea (`suelo.length > 0`) y
hoy sería un no-op, porque el árbol está sano; mañana no.

**b) El punto ciego de la alcanzabilidad no se cierra, se declara.** Una rama parada sobre un
commit viejo de `main` es ancestro **trivialmente** y sale DENTRO sin aportar nada. El estado sigue
siendo DENTRO —es lo que git contesta— y la fila lo marca `sinCorroborar` cuando ningún merge
nombra una rama suya. La señal de corroboración cubre **945 de 1025 merges** (unidad: commits de
merge de la cadena first-parent; árbol `cobroflash-b16`, `origin/main` = `590e019d…`,
6-sep-2026T05:10:58Z): existe, y le faltan 80.

**c) `rama sin objeto en local` no ocurre hoy en el árbol real** (medido: 0 indeterminadas), porque
las refs locales siempre tienen su objeto. Es un guard sobre un caso que no se da — así que **se
provocó**: el banco lleva una ref escrita a mano apuntando a un sha inexistente. Una garantía sobre
un caso que no se ha provocado es una predicción.

**d) La tanda gateada (`npm run test:staging:gated`) NO se ha corrido.** Necesita base de staging y
tomar su turno; este trabajo no toca ninguna ruta de BD, ni schema, ni el camino de emisión. Los 88
saltados de `npm test` declaran su motivo y **suman 88**: 78 piden base real
(`QA_DB_TEST`/`AN_DB_TEST`/`BOT_SUITE_TEST`), 9 piden `LIBRO_PG_URL`, y 1 salta por `EPERM` al
crear un enlace en Windows sin elevación.

---

## ⑪ LA TRAMPA DEL «PARCIAL», Y QUÉ SE HA DECIDIDO

El `PARCIAL` de SCRUM-388 se detecta leyendo la **prosa** de la entrada de máster
(`MARCAS_SIN_CONECTAR`: «sin conectar», «sin llamadores»…). Eso tiene una asimetría medida:

> Un ticket que declare su hueco **con otras palabras** sale ENTERO; uno honesto que use el
> vocabulario de la casa sale PARCIAL. **La señal premia la sinceridad con la etiqueta peor.**

**Decisión: este censo NO emite `PARCIAL` y no hereda esa señal.** No es un olvido y por eso está
escrito en el instrumento:

1. La alcanzabilidad **no puede ver el alcance**. Un `PARCIAL` aquí sería una opinión sobre
   completitud emitida por un detector que sólo sabe si unos objetos son alcanzables.
2. Y heredar una señal cuya dirección está invertida sería importar el defecto a un segundo sitio,
   que es exactamente lo que este ticket evita al derivar en vez de copiar.

Lo que sí se hace es no dejar el hueco sin nombre: la señal **sigue viviendo donde está**
(`tests/_censo-tickets.mjs`, SCRUM-388) y la asimetría queda aquí registrada. Arreglarla —clasificar
por si queda mecanismo construido y sin conectar, en vez de por vocabulario— cambia el veredicto de
ese motor para todo el mundo y es su carril, no el mío. **Lo que no se puede hacer es leer
`ENTERO`/`PARCIAL` como una medida de completitud**, y menos usarlo para cerrar.

---

## ⑫ UN AVISO DE MEDICIÓN, PORQUE ME MORDIÓ

La primera tanda tras la segunda mezcla de `main` dio **3 fallos, los tres míos**. No eran un
defecto: `npm run meta:mutaciones` seguía corriendo en segundo plano y tenía **mi propia mutación ⑤
viva en el árbol** en ese instante (`git diff` lo enseñó literalmente). El meta-guard restaura en un
`finally` y verifica bytes, así que el árbol quedó intacto — pero **una tanda corrida en paralelo
con algo que muta el árbol no mide el árbol que crees**. Se repitió sin nada en paralelo: 0 fallos.

`main` se movió **tres veces** durante esta sesión (`590e019d` → `7f8c48d8` → `2c155141` →
`74aba16e`). Cada mezcla fue seguida de su tanda; el ancla de arriba se tomó con `fetch` inmediato.
