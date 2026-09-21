# SCRUM-970 · la cifra de guards fuera de la tanda se DERIVA, y ya no se puede escribir a mano

**Fecha:** 20-sep-2026 · **Carril:** S5 · automatización, eficiencia e infraestructura
**Medido contra:** `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b` · 2026-09-20T20:02:16Z (GitHub)
**Rama:** `scrum-970-la-cifra-se-deriva` · **Worktree:** `wt-970`

## ① El defecto, y por qué ya no valía avisar

`tests/scrum522-guards-fuera-de-la-tanda.test.mjs` guardaba **a mano** el número de guards de
navegador que quedan fuera de `npm test`, en un `assert.equal(fuera.length, 30)`, con los motivos
de cada guard en comentarios justo encima. Esa forma colisionó **ocho veces en cuatro días** (27,
28, 29, 30 y 31), siempre igual:

- dos ramas añaden un guard cada una y **las dos escriben el mismo número nuevo**;
- git marca conflicto en los **comentarios**, que son distintos → alguien lo ve y los suma;
- pero la línea del número es **idéntica** en las dos ramas, git la auto-mezcla **sin conflicto**,
  y el fichero queda mintiendo por uno.

      🔒 El conflicto que sí ves te tapa el que no.

El propio fichero ya llevaba escrito, tres veces y en mayúsculas, cómo resolverlo bien. **Se lo
dijimos a todas las sesiones y cayeron ocho.** Cuando un aviso hay que repetirlo ocho veces, el
problema no son las sesiones: es que la cifra se puede escribir a mano.

## ② EL ROJO · no se razona sobre git, se ejecuta git

Instrumento: `docs/master/evidencias/scrum970/colision-del-contador.mjs`. Fabrica **dos ramas**
—cada una añade su guard y su comentario, como hicieron 888 y 904, o 915d y 947— y hace el **merge
de tres vías de verdad** con `git merge-file`, que es el mismo motor que resuelve un merge normal.
Sobre el `scrum522` de `origin/main` tal cual:

    POBLACIÓN · cifra escrita hoy: 31
    ═══ FORMA VIEJA · la cifra a mano en el assert ═══
       ① ¿marca de conflicto?  SÍ  (git dice 1 conflicto(s))
       ② cifra tras el merge:  32   · la verdad son 33
       ⇒ 🔴 LA CIFRA ENTRÓ MAL — y el conflicto de al lado TAPA que entró mal.

Reproducido también partiendo de 30: deja **31 donde la verdad son 32**. El defecto no es una
anécdota de una tarde: es determinista y lo produce la forma del fichero.

## ③ El arreglo · ni «derivar del todo» ni «misma línea», sino las dos cosas

El ticket proponía derivar el número, y si eso perdía el trinquete, poner cifra y lista **en la
misma línea**. La forma construida cumple las dos sin elegir (y el orquestador la firmó en vez de
las suyas):

**`tests/_guards-de-navegador-declarados.mjs`** — los guards **declarados por nombre, uno por
línea**, y la cifra **derivada** de esa lista (`DECLARADOS.length`). Dos propiedades:

1. **No queda ningún número que pueda entrar mal por su cuenta.** No hay cifra que escribir.
2. **Un guard por línea, y los nuevos al final.** Dos ramas que añaden uno cada una escriben
   **líneas distintas en el mismo sitio**, así que git da **conflicto de verdad** — y la resolución
   es la de siempre y la única correcta: se quedan las dos, no se elige lado y no se calcula nada.
   Es la norma de la casa («un elemento por línea») aplicada donde más ha costado.

En `scrum522`, el `assert.equal(fuera.length, N)` pasa a ser un `deepEqual` de **qué sobra y qué
falta**. **Toda la prosa de arriba se queda**: cada comentario dice por qué entró su guard y
ninguno se tira.

## ④ El verde, la misma medida

    POBLACIÓN · tests/_guards-de-navegador-declarados.mjs · 31 guards declarados, uno por línea
    ═══ FORMA NUEVA · la cifra derivada de la lista declarada ═══
       ① ¿marca de conflicto?  SÍ  (git dice 1 conflicto(s))
       ② cifra tras el merge:  (no hay cifra escrita: se deriva)   · la verdad son 33
       ⇒ ✅ ninguna cifra pudo entrar mal

El conflicto sigue saliendo —eso es lo que se quería— pero ahora cae **donde está la cuenta**, no
al lado de ella.

## ⑤ Los controles · el trinquete no se relaja, se endurece

**POSITIVO, inyectado de verdad y en las dos direcciones** (no leído):

| qué se siembra en `package.json` | qué dice el trinquete |
|---|---|
| un `guard:falso-de-control` nuevo y sin declarar | `Sin declarar: ["guard:falso-de-control"]` · 25/26, **rojo** |
| se quita `guard:rastro-del-menu`, que sí está declarado | `Declarados que ya no están: ["guard:rastro-del-menu"]` · **rojo** |
| `package.json` restaurado (comprobado **byte a byte**, `Buffer.equals`) | 26/26, **verde** |

Antes decía «han cambiado de 30 a 31». Ahora dice **qué guard** sobra o falta, por su nombre.
**Ganar comodidad no podía perder detección**, y no la pierde: la gana.

**CONTROL DEL PROPIO TRINQUETE**, dentro del test: la lista declarada no puede estar **vacía**
—«no sobra ni falta ninguno» sería cierto sobre la nada— ni llevar **repetidos** —los conjuntos
cuadrarían y la cifra derivada dejaría de ser la cuenta—.

**NEGATIVO:** no se relaja nada ni se sube ninguna cifra «para que pase». Los otros 25 tests de
`scrum522` siguen verdes sin tocar ni uno, incluido el que exige que la lista salga **derivada de
`package.json`** y el que comprueba que el workflow invoca la puerta.

## ⑥ 🔴 Y la NOVENA colisión ocurrió mientras se arreglaba la octava

Al mergear `main` en esta rama, `SCRUM-965` ya había entrado con «30 → 31» mientras aquí había 30.
O sea: **la colisión número nueve pasó dentro del ticket que la arregla.** No es casualidad; es la
frecuencia del defecto, y vale como medida de cuánta prisa tenía.

Se resolvió como manda el propio fichero y como manda el arreglo: el comentario de 965 **se queda
entero**, su guard se apunta **en su propia línea** de la lista declarada, y el número **no se
sumó: se volvió a MEDIR** corriendo el test sobre el árbol ya fusionado → **31**.

## ⑦ Lo que NO se ha tocado

- Ningún guard, ningún `scripts/guard-*.mjs`, ningún `package.json` (los dos controles se
  revirtieron y se comprobó la identidad byte a byte).
- Los motivos de cada guard siguen en `scrum522`: la lista nueva lleva **sólo nombres**. Un fichero
  que duplicara la prosa sería otra copia que mantener y otra cosa que puede divergir.
- Nada de `src/` ni `public/` (S5 no toca producto).
