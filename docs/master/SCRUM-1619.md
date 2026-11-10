# SCRUM-1619 · Dos anclas de texto de otro equipo cuelgan de `_censo-sin-consumir.mjs`: ahora se ven, y caen con su causa

**Medido contra:** `origin/main` = `c992358dc42fa7407e2960f826bd36d68bc3d47e` · 2026-10-27T15:59:09Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum1619-anclas-de-otro-equipo.test.mjs`

S0, equipo de Luis. Empezado por la sesión anterior del puesto (wip local `93ed4da22`, sin correr, SOLTAR en
SCRUM-1619 c.21083) y terminado por la siguiente. Rama `scrum-1619-anclas-de-otro-equipo`.

## Qué pasaba

`tests/_censo-vocabulario-ofrecido.mjs` (J6, SCRUM-1194d) lee `scripts/_censo-sin-consumir.mjs` (S0) y parchea una
COPIA en memoria reemplazando dos trozos literales, su array `anclas`: `cuerpoLeido: clavesLeidas(n) });` (en el
`routeDefs.push`) y `    poblacion: {` (con sus cuatro espacios, en el `return` de `censar`). Si uno no casa UNA vez,
`censarVocabulario` devuelve CIEGO y caen los seis tests de `scrum1194d`, que van en `build + tests (con banco
desechable)`. Quien editaba esas líneas no tenía nada en su fichero que se lo dijera.

## El cambio

1. **Un aviso encima de cada ancla**, en `scripts/_censo-sin-consumir.mjs`: `⚠️ ANCLA DE OTRO EQUIPO (SCRUM-1619)`,
   con el consumidor, lo que copia, con quién se cambia y qué test lo vigila. Sólo comentarios: ninguna línea de
   código cambia. El de la segunda dice además que el parche mete `rutasInternas: routes` delante, o sea que
   también depende del NOMBRE `routes`.
2. **`tests/scrum1619-anclas-de-otro-equipo.test.mjs`**: saca las anclas del consumidor por AST (lo LEE, no lo
   importa ni lo toca) y exige que cada una case 1 vez en la sonda, que lleve su aviso encima y que no haya avisos
   huérfanos. Si falla, la frase nombra el ancla, el fichero, el consumidor y con quién se cambia.
   Lleva su población declarada (si no encuentra `anclas`, cae CIEGO, nunca verde), un CASO FABRICADO (cuatro
   formas que tiene que cazar y la buena que tiene que dejar pasar, también con CRLF) y dos
   `MUTACIONES_QUE_ME_TUMBAN`.

**Lo cambié al terminarlo:** con un ancla perdida, la versión del wip daba DOS mensajes, y el segundo llamaba
huérfano al aviso y mandaba a **quitarlo**, que es justo lo que no hay que hacer. Ahora, con un ancla perdida, los
huérfanos no se juzgan (no se sabe a qué línea apuntaba el aviso) y sale una sola frase, la buena. El caso
fabricado exige que sea una.

## Visto en ROJO (control positivo, en disco, restaurado con `git restore --source=HEAD`)

| mutación en `scripts/_censo-sin-consumir.mjs` | `scrum1619` | `scrum1194d` |
|---|---|---|
| `cuerpoLeido: clavesLeidas(n) });` → `…(n), });` | cae: «el ancla «routeDefs.push» (…) casa 0 veces en scripts/_censo-sin-consumir.mjs, y tests/_censo-vocabulario-ofrecido.mjs (J6, SCRUM-1194d) exige exactamente 1: su censo sale CIEGO y cae su trinquete en el obligatorio. Deja la línea como estaba, o cámbiala junto con J6» | caen los 6: «🔴 CIEGO — el ancla «routeDefs.push» no casa una vez en la sonda de 1185 (¿cambió?)» |
| `    poblacion: {` → `    poblacion:  {` | cae, misma frase con «return poblacion» | (no corrido en esta fila) |
| el aviso del ancla 2 pierde su marca | cae: «la línea 581 (…) es el ancla «return poblacion» (…) y no lleva encima su aviso» | sigue verde (sólo comentarios) |

Y con los avisos puestos y sin mutar: `scrum1619` 3/3 y `scrum1194d` 6/6 (población 242 rutas, 55 pares, 1 PARCIAL,
14 declarados), así que los avisos no han movido el censo de J6.

**Meta-guard**, sólo para este guard (las mismas `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, filtradas a
`scrum1619`, porque el job completo no cabe en su hora, SCRUM-1620): **vivas 2/2**. Control negativo del mismo
camino: una mutación inocua en un comentario de la sonda sale **MUDA**, como tiene que salir.

## La decisión de diseño, y su coste, dichos

**El coste:** el test lee la lista del consumidor, así que **si J6 añade un ancla nueva (o deja de usar una), el
test cae en SU PR y le pide poner (o quitar) el aviso en un fichero de S0**, que es otro carril. Lo hará pidiéndolo
a S0 por Jira o como cruce declarado (`dos-equipos.md` §5).

**Por qué lo dejo así y no lo aflojo:** el defecto de 1619 es un rojo que le cae a quien NO sabe nada (edita
su fichero y se rompe el obligatorio de los dos equipos). Este coste es un rojo que le cae a quien SÍ lo sabe (está
creando el acoplamiento en ese momento), en ese PR, con la frase exacta de lo que falta. Las otras dos formas que
pesé son peores: sin la comprobación del aviso, el siguiente ancla de J6 vuelve a ser invisible y la aceptación 1
se pierde sin que nadie se entere; y dejar el aviso como diagnóstico que no cae es bajar la vara (regla 41). Si
el orquestador o Javier prefieren otra cosa, la decisión es suya: se cambia en este test, no en el de J6.

## Lo que no ve, dicho

- El parche del consumidor mete `rutasInternas: routes`: depende del nombre `routes`, que no es un ancla de texto.
  Va dicho en el aviso; si alguien lo renombra, quien cae es `scrum1194d` al importar la copia, no este test.
- Depende de que el consumidor llame `anclas` a su lista y de que el primer elemento de cada fila sea el texto
  buscado. Si J6 cambia esa forma, este test cae CIEGO, nunca verde.
- `tests/_censo-vocabulario-ofrecido.mjs` no se ha tocado.

## Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| Alguien que edite una de esas dos líneas **se encuentra el aviso** sin tener que conocer el fichero del otro equipo. | `scripts/_censo-sin-consumir.mjs`, el comentario `⚠️ ANCLA DE OTRO EQUIPO (SCRUM-1619)` encima de cada ancla; que siga ahí lo exige `tests/scrum1619-anclas-de-otro-equipo.test.mjs` |
| **Control positivo obligatorio:** se cambia una de las dos anclas a propósito y se comprueba que el aviso o el caso **efectivamente cae**, y que lo que dice al caer nombra la causa. | tabla «Visto en ROJO» de arriba; y las dos `MUTACIONES_QUE_ME_TUMBAN` del test, que juzga el meta-guard |
| No se baja ninguna vara ni se afloja ningún guard (regla 41) | el diff: sólo comentarios en la sonda y un test nuevo; `tests/_censo-vocabulario-ofrecido.mjs` y `scrum1194d` sin tocar |
