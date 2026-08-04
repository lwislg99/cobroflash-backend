# SCRUM-253 · ADOPCIÓN: un dueño hereda su propio turno, y la identidad distingue sesión de máquina

**Fecha:** 4-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `24e0e4f336119797cc40e45f29fadc34d399352a` · 2026-08-04T11:27:30+02:00
**Tanda:** 1196 tests, 1129 pass, 0 fail, 67 skipped

## El defecto

`adquirirLock` preguntaba **una** cosa y actuaba como si hubiera preguntado dos:

```js
if (vigencia.vigente) return { ok: false, motivo: 'ocupado' }
```

SCRUM-266 arregló la **caducidad** que decide ese `vigente`. La **propiedad** —de quién es— no la
miraba nadie. Son dos preguntas distintas sobre el mismo lock, y solo había respuesta para una.

Consecuencia: **tu propio turno vivo te bloqueaba a ti.** `turno:tomar` para sostener la base,
lanzas la tanda, y el runner se da `exit 5` contra sí mismo. La herramienta que SCRUM-232 hizo
para poder mirar el turno **sin** lanzar una tanda impedía justo lo siguiente que ibas a hacer.

## Lo que hace difícil el ticket

La causa es que el dueño se medía con el PID —`idDeSesion(os.hostname(), process.pid)`— y **el
PID cambia entre los procesos de una misma sesión**. Una sesión no se reconocía a sí misma.

La salida obvia es quitar el PID y comparar por máquina. **Eso es exactamente SCRUM-258:** dos
sesiones distintas del mismo equipo pasarían a ser el mismo dueño, se adoptarían el turno la una
a la otra y las dos escribirían sobre la misma base — el desastre que SCRUM-188 existe para
impedir. *Aflojar la identidad hasta que el bug desaparezca hace desaparecer también el
mecanismo.*

## La decisión: **la sesión es DÓNDE trabaja, no quién la ejecuta**

El id pasa a ser `host` + un token derivado de la **raíz del árbol de trabajo**. Cumple las dos
condiciones que hacían falta, y ninguna le pide nada al humano:

1. **Dos procesos de la misma sesión comparten el árbol.** El `turno:tomar`, el runner y los
   hijos del runner corren desde el mismo directorio — `spawnSync` se llama **sin `cwd`**
   (comprobado en el código), así que los hijos heredan el del padre. Los tres calculan el mismo
   id sin exportar ni copiar nada.
2. **Dos sesiones concurrentes trabajan en árboles distintos.**

Y el punto 2 **no es una convención que me esté creyendo**: el árbol de trabajo ya es la unidad
que dos sesiones concurrentes no pueden compartir, y no por este ticket. `dist/` es del árbol; el
recibo de la tanda es `.claude/evidencia-tanda.json`, relativo al árbol; y **SCRUM-182 existe
precisamente para delatar** que los artefactos de un árbol se movieron bajo los pies de una tanda.
Dos tandas en el mismo directorio ya se destrozan el `dist/` y el recibo. Esta identidad no crea
esa frontera: **le pone nombre a una que ya estaba.**

### Medido, no argumentado

| desde | dueño |
|---|---|
| `wt-253`, proceso A | `DESKTOP-T5MONF5.cc9175b270` |
| `wt-253`, proceso B (otro PID) | `DESKTOP-T5MONF5.cc9175b270` |
| `wt-253`, **hijo** lanzado sin `cwd` | `DESKTOP-T5MONF5.cc9175b270` |
| `wt-265` | `DESKTOP-T5MONF5.a4ca185471` |
| checkout principal | `DESKTOP-T5MONF5.609815b9ee` |

Mismo host en las cinco. Estable entre procesos, distinto por árbol.

### Se retira `YAQU_LOCK_DUENO` como canal de identidad

Era la variable que el runner exportaba a sus hijos, y de ella salían **dos** defectos:

* **Quien tomaba el turno a mano y no la exportaba se veía a sí mismo como AJENO.** Lo dejó
  anotado la sesión 4 en SCRUM-260, en el propio código: *«quien tomó el turno a mano con
  `turno:tomar` y NO exporta `YAQU_LOCK_DUENO` se verá a sí mismo como ajeno […] el arreglo de
  verdad es el de 253»*. Esa nota se cierra en este ticket.
* **Una identidad que se DECLARA se puede AFIRMAR.** Cualquiera podía escribir el id de otra
  sesión y adoptar su turno vivo. Una identidad se deriva de un hecho; no se pide por parámetro.
  Es la misma lección de SCRUM-266: no supongas un dato que puedes leer.

### Y la propiedad se responde en UN sitio

La pregunta «¿es mío?» se contestaba en **cuatro** —el runner, el CLI, la barrera gateada y el
rastro de limpieza— y tres lo hacían con su propio `===` contra la variable. Ahora todas pasan por
`esMiTurno(lock, dueño)`. Es la misma forma que SCRUM-266 le dio a la caducidad, sobre la otra
pregunta.

## Tres desenlaces, y ninguno es el otro

`reclamado` era `Boolean(lock)` a secas, así que adoptar el turno propio se habría anunciado como
«se lo he quitado a alguien».

| situación | resultado |
|---|---|
| turno libre | ni `adoptado` ni `reclamado` |
| turno **ajeno** caducado | `reclamado` — se le quitó a alguien |
| turno **propio** vivo | `adoptado` — sigo con el mío |

Un mensaje que confunde las dos cosas miente sobre quién está escribiendo en la base, y esta línea
se lee justo cuando hay dudas sobre eso.

## El compromiso de SCRUM-249 al heredar: se SUSTITUYE

**Es la cuarta pregunta del alcance y la contesta el código que ya había — lo que faltaba era
fijarlo.** `turno:tomar` promete señales para ~15 min; la tanda que viene detrás dura ~31. Si
adoptar **conservara** el compromiso viejo, la tanda saldría **VENCIDA** a los 15 minutos y otra
sesión la reclamaría **con toda la razón**, porque el compromiso publicado diría que ya no da
señales. Sería el defecto de SCRUM-266 entrando por una puerta nueva: un turno vivo dado por
muerto.

El compromiso describe lo que corre **ahora**; al adoptar, lo que corre es otra cosa.

## Verificado en rojo — cuatro, uno por cada mitad que sostiene el ticket

* **La puerta vuelve a no mirar el dueño** (`if (vigencia.vigente)`) → cae «EL CASO REAL». Es el
  defecto original, tal cual estaba en `main`.
* **La identidad se afloja hasta ser la máquina** (token constante) → caen «IDENTIDAD ②» con el
  mensaje de SCRUM-258 y el fail-safe ③. Es el rojo que demuestra que la adopción no abrió la
  puerta del vecino.
* **El compromiso se hereda** al adoptar → cae el test del compromiso con su número (15 vs 41).
* **Vuelve el canal declarado** (`process.env.<la variable>`) → cae el guard, señalando
  `tests/_staging-db.mjs:190`.

Las cuatro inyecciones verificadas como aplicadas y compilando antes de creerme el rojo, y
revertidas; árbol limpio.

**Un rojo salió verde a la primera y la causa fue mía:** invertí la condición (`!mio` donde iba
`mio`), así que inyecté la herencia en el caso que **no** adopta. Caso mal elegido, no guard de
sobra — se rehízo quirúrgico sobre la señal y salió rojo.

## Un verde hueco cazado antes de entregar

La primera versión de «IDENTIDAD ②» comparaba `RAIZ` contra `RAIZ/..`. Ese padre **no tiene
`.git`**, así que caía al fallback por PID: el test comparaba un árbol real contra la degradación
y salía verde **por el motivo equivocado**, justo en el test que sostiene el ticket. Ahora monta
dos árboles de verdad en un temporal, comprueba con un suelo que son reconocibles, y asegura
además que **ninguno** cayó al fallback.

## La rama que ya existía

`scrum-253-adopcion-mismo-dueno` (`9e136e6`, sin PR, base 110 commits atrás). **Se midió antes de
decidir**, y no estaba vacía: tenía el eje correcto —separar `adoptado` de `reclamado` y no tocar
la puerta ajena— y un test con las dos caras. Se conserva la idea y **se descarta la
implementación**, por dos motivos: su base es anterior a SCRUM-266 y `_staging-lock.mjs` cambió
entero; y su identidad hacía de `YAQU_LOCK_DUENO` una **entrada** que el humano copia y pega — o
sea, convertía en mecanismo justo lo que la sesión 4 había marcado como el hueco.

## Lo que NO cubre

* **No se ha verificado contra staging real.** El turno lo tenía otra sesión (tanda de
  `scrum-255-anidado-wa`, vigente). Lo comprobado es la lógica con cliente inyectado, la identidad
  contra el disco de verdad y el CLI en modo `estado`; **queda sin observar la secuencia completa
  `turno:tomar` → tanda adoptando** contra la base.
* **Un turno tomado con el código ANTERIOR no se reconoce.** Lleva un id `host.PID` (se vio uno
  vivo al probar: `DESKTOP-T5MONF5.23680`), así que quien se actualice a mitad no adoptará su
  propio turno viejo: bloquea hasta el TTL. Es el comportamiento de hoy, no una regresión, y **el
  conjunto se vacía solo** en cuanto los turnos vivos se tomen con código actual.
* **Dos personas en el MISMO directorio se verían como la misma sesión** y se adoptarían el turno.
  No se defiende contra eso a propósito: en ese escenario ya se estarían pisando `dist/`, el
  recibo y el cliente de Prisma. La frontera es el árbol; si se cruza, no hay identidad que salve
  nada.
* **El guard prohíbe el canal, no vigila la derivación.** Impide que la identidad vuelva a
  declararse por entorno; no comprueba que `dueñoActual()` sea *buena*. Eso lo sostienen los tres
  tests de identidad.

## Ficheros

* `scripts/_identidad-sesion.mjs` (nuevo) — `raizDeTrabajo`, `tokenDeSesion`, `dueñoActual`, con
  el porqué de las dos condiciones y el fail-safe.
* `scripts/_staging-lock.mjs` — `esMiTurno()` nueva; `idDeSesion(host, sesion)` deja de recibir el
  PID; la puerta mira propiedad **y** vigencia; `adoptado` / `reclamado` separados.
* `scripts/test-staging-gated.mjs` — dueño derivado; retirado el export de la variable; anuncia
  ADOPTADO.
* `scripts/turno-staging.mjs` — mismo dueño derivado; `tomar` distingue adoptar de reclamar.
* `tests/_staging-db.mjs` — el aviso de turno ajeno responde con `esMiTurno`.
* `scripts/clean-staging-tests.mjs` · `scripts/_rastro-limpieza.mjs` — el rastro deja de depender
  de la variable; se cierra la nota que la sesión 4 dejó en SCRUM-260.
* `tests/scrum253-adopcion.test.mjs` (12, sin gate).
