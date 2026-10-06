# SCRUM-1474 · El latido sabe que un puesto fue relevado, y no lo llama «contestada»

**Rama:** `scrum-1474-latido-relevo` · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `8dcc6d2ad6cab55e9b550220868b12adc82eb40e` · 2026-10-06T13:14:31Z (hora de GitHub)

A9: comprobación → `tests/scrum1474-latido-relevo.test.mjs`

Carril S5: `scripts/equipo/latido.mjs` y un test. Encargo del orquestador del 6-oct-2026 (~13:03Z), tras
correr él el latido.

## Qué arregla y qué no

Arregla que el cementerio **se pueda leer**: 25 renglones pasan a 6, y cada uno lleva la orden que lo
apaga. Y que SESIONES deje de decir «nadie vuelve» de un PR cuyo puesto tiene a otra sesión trabajando
que lo sabe.

No decide si una pregunta está contestada. El registro no lo sabe, y lo medido abajo dice que tampoco se
puede deducir.

## Qué pasaba

Latido de las ~13:00Z del 6-oct:

```
🔴 CEMENTERIO · 299 trabajos leídos · 25 pregunta(s) sin contestar (…) · 6 de hoy (están en SESIONES) · 0 marcada(s) como contestadas
   · s0-27c (3d123ada) · hace 8.0 días · espera: …      ← y 24 renglones más
🔴 SESIONES · …
   · s1-6octc (e6d4e28c, done) ya NO trabaja y el PR #2209, cuya rama scrum-1465b-frases-del-envio EMPUJÓ, sigue ROJO-OBLIGATORIO: nadie vuelve
```

- El orquestador contesta **relanzando el puesto** con la respuesta en el encargo nuevo. A una sesión que
  ya salió no se le puede contestar, y su pregunta se queda en el registro.
- `s1-6octd` llevaba ese rojo en su encargo y estaba trabajando: «nadie vuelve» era falso.
- `latido.mjs contestada <id> <dónde>` existía desde SCRUM-1357 (1-oct) y llevaba **0 usos**.

## Lo que se pidió primero, y por qué no se ha hecho así

Se pidió: una pregunta sale del 🔴 si existe una sesión más nueva del mismo puesto (cubo RELEVADA).

Medido antes de construir, sobre el registro de la máquina (299 trabajos, 31 preguntas en el aire, 0
`state.json` ilegibles):

| Criterio | Pasan | Qué dice |
|---|---|---|
| Hay una sesión posterior del mismo puesto | **31 de 31** | Sale siempre: no separa nada |
| …aplicado a las ocho preguntas del 27 al 29-sep por las que nació el cementerio | **8 de 8** (relevo a las 0-40 h) | El 1-oct no habría avisado de ninguna |
| El encargo del relevo nombra una referencia de la pregunta (ticket o PR) | 15 de las 15 que llevan alguna · 16 no llevan ninguna | Tampoco separa: el relevo nombra el ticket porque sigue con él |

Un puesto se relanza siempre; que se relance no dice nada de la pregunta. Devuelto al orquestador con la
medición y tres salidas. **Decidido por él el 6-oct (~13:10Z): la B** — el aviso lo apaga su marca, no una
inferencia, y marcar tiene que costar una orden por puesto.

## Qué cambia

| Antes | Ahora |
|---|---|
| Un renglón por pregunta (25) | Las que tienen relevo y están sin marcar, **plegadas: un renglón por puesto** (6), con la más vieja, la más nueva y quién relevó |
| Marcar: `contestada <id>`, una a una | `contestada s<puesto> "<dónde>"` marca **todas** las abiertas de ese puesto |
| La orden había que saberla | Cada renglón plegado la imprime entera, y la que enseña las preguntas completas (`preguntas s<puesto>`) |
| — | La orden pegada sin rellenar el hueco (`"<dónde está la respuesta>"`) no marca nada y lo dice |
| Una pregunta marcada… | …**sigue en el libro**, con dónde se contestó. Sólo deja de avisar |
| Las bloqueadas de hoy salían en SESIONES aunque estuvieran marcadas | Marcadas no se repiten (se cuentan). Con relevo y sin marcar, su renglón lleva la orden |
| «nadie vuelve» en cuanto la que empujó deja de trabajar | Sólo si en ese puesto no **trabaja** una sesión posterior |
| — | Si trabaja y se le ha nombrado el PR (`#n`, `pull/n` o su rama, en su encargo o en un mensaje de otra sesión): no es aviso, y la sección dice quién y desde cuándo |
| — | Si trabaja y nadie se lo ha nombrado: sigue 🔴 — «nadie le ha dicho que es suyo» |
| — | Si no se puede leer qué se le dijo: 🔴 «no pude leer», ni lo uno ni lo otro |

Los cubos (`preguntasDelLibro`): MARCADA · SIN RELEVO · RELEVADA · NO SE PUEDE SABER (el nombre no dice el
puesto, o la pregunta no tiene fecha). El cubo **ordena** la salida; el 🔴 lo sigue teniendo todo lo que
no está marcado. La línea de población lleva, siempre que hay una relevada:

> RELEVADA = el puesto siguió con otra sesión; NO dice que la pregunta se contestara

## Por qué en los PR sí se mira si «se lo han dicho»

Un PR tiene número y rama: se puede buscar. Medido el 6-oct con el #2209 sobre las 19 sesiones con
actividad en el día:

| Dónde se busca | Sesiones que lo nombran |
|---|---|
| En su encargo (primer mensaje de una persona) | 1 de 19: `s1-6octd`, su relevo |
| En todo su transcript | 4 de 19 (la que lo empujó, el relevo y dos que listaron los PR) |

Se usa lo que a la sesión **le han dicho** (encargo y mensajes de otras sesiones), no lo que ella vio por
su cuenta. Un número a secas no vale: `2209` también es un ticket, una hora o un trozo de SHA.

Con el #2131, que el orquestador pega en el estado general de varios encargos, lo nombran 7 de 19. Por
eso la frase es «a quien se le ha nombrado: eso dice que lo sabe, no que lo vaya a arreglar».

## Medido después

`node scripts/equipo/latido.mjs`, 6-oct-2026 ~13:10Z, mismo registro:

```
🔴 CEMENTERIO · 299 trabajos leídos · 25 pregunta(s) sin contestar (de más de 24 h, o de una sesión ya parada): 0 SIN RELEVO · 25 RELEVADA(S) sin marcar, plegadas en 6 puesto(s) · 0 que NO SE PUEDE SABER · 6 de hoy (están en SESIONES) · 0 marcada(s) como contestadas (siguen en el libro) · RELEVADA = el puesto siguió con otra sesión; NO dice que la pregunta se contestara: el aviso sólo lo quita la marca
   · s0 · 3 pregunta(s) RELEVADA(S) y SIN MARCAR (la más vieja de hace 8.0 días, la más nueva de hace 3.8 días) · la más nueva es de s0-2octb y su puesto siguió con s0-6oct (2026-10-06T10:35Z) · si ya están despachadas → node scripts/equipo/latido.mjs contestada s0 "<dónde está la respuesta>" · para leerlas enteras → node scripts/equipo/latido.mjs preguntas s0
   · s1 · 3 … · s2 · 3 … · s3 · 4 … · s4 · 6 … · s5 · 6 …
```

El #2209 ya no se podía ver en vivo: su relevo había empujado y pasó a ser dueña. Se repitió el caso
contra el registro real, quitándole al relevo sus empujes como a las 13:05Z:

```
POSITIVO · #2209 → (sin alerta)
   población: · 1 PR de una sesión que ya no trabaja lo lleva el relevo de su puesto, que TRABAJA y a quien se le ha nombrado (#2209 → s1-6octd, arrancó 2026-10-06T12:53Z): eso dice que lo sabe, no que lo vaya a arreglar
NEGATIVO · #9876 → s1-6octc (e6d4e28c, done) ya NO trabaja y el PR #9876, cuya rama scrum-9999-rama-que-nadie-nombra EMPUJÓ, sigue ROJO-OBLIGATORIO: en su puesto trabaja s1-6octd (arrancó 2026-10-06T12:53Z), pero ni su encargo ni ningún mensaje que haya recibido nombran el #9876 ni su rama: nadie le ha dicho que es suyo
```

No se ha marcado nada en el libro de la máquina: las seis órdenes las da el orquestador, que es quien
sabe dónde contestó.

## Tests

`tests/scrum1474-latido-relevo.test.mjs` → 13 de 13. Con los del latido que ya había
(`scrum1350`, `scrum1356`): 67 de 67, sin tocar ninguno.

Mutaciones declaradas en `MUTACIONES_QUE_ME_TUMBAN`, con la base sin mutar en 13/13 primero y el árbol
comiteado (`52c5e05f`). Siete de siete en rojo, y el árbol limpio después:

| Mutación | Caen |
|---|---|
| M1 · el relevo vuelve a apagar el aviso | 3 |
| M2 · que trabaje alguien en el puesto basta, sepa o no que el PR es suyo | 2 |
| M3 · un relevo que ya no trabaja cuenta como «alguien vuelve» | 1 |
| M4 · no poder leer qué se le dijo cuenta como «no se lo han dicho» | 1 |
| M5 · la marca de un puesto se lleva las de los demás | 2 |
| M6 · una pregunta sin puesto reconocible se da por relevada | 2 |
| M7 · un número a secas vale como «nombra el PR» | 1 |

## Lo que sigue sin mirar

- Si la pregunta se contestó. La marca es la palabra de quien la pone, con el sitio que diga.
- Una sesión sin fecha de arranque en su `state.json` no cuenta como relevo de nadie.
- Una bloqueada sin `needs` no entra en el libro y no se puede marcar: sigue saliendo.
- Que al relevo se le nombrara el PR de pasada, en un estado general, y no como encargo.
- El hook de arranque (`latido-arranque.mjs`), cuando la pasada completa no llega a tiempo y tira de sus
  dos secciones locales, no cruza PR: ahí no hay «nadie vuelve» que matizar. Sí recibe ya el libro, para
  no repetir las bloqueadas de hoy que estén marcadas.
