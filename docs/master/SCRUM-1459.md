# SCRUM-1459 · El latido lee los avisos del vigía que nadie ha leído, y la línea de MAIN dice cuánto lleva parado

**Rama:** `scrum-1459-latido-lee-al-vigia` · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `39af736efc8ccf7d2966063561421855b3e4c4e9` · 2026-10-06T11:30:19Z (hora de GitHub)

A9: comprobación → `tests/scrum1459-latido-lee-al-vigia.test.mjs`

Carril S5: `scripts/equipo/latido.mjs` y un test. No toca ningún workflow ni
`scripts/vigia-atascados.mjs`. Encargo del orquestador del 6-oct-2026 (dos mensajes, ~11:25Z).

## 🔴 La pregunta que este PR tiene que contestar

**¿Qué pasa cuando nadie corre nada durante tres días?**

**Nada.** El latido es un comando: dice lo que ve cuando alguien lo lanza. Con este cambio, quien lo
lance tras un parón se encuentra delante los avisos acumulados y la edad de `main`. Durante el parón,
si no hay ninguna sesión, no hay nadie a quien decírselo y el latido no suena.

Lo único que corre sin sesión es `vigia-atascados` (workflow programado), y escribe en GitHub. El
fundador ha dicho el 6-oct que no lee GitHub. Así que hoy, **sin una sesión viva, un aviso no llega a
ninguna persona por ningún camino**. Este PR no cambia eso. El detector de parón de 48 h lo lleva S0
dentro del vigía; a quién llega es una decisión que no está tomada aquí.

Es medio arreglo: acorta el tiempo entre «alguien vuelve» y «alguien lo sabe» a un comando. No acorta
el parón.

## Qué pasaba

Medido por S0 el 6-oct y comprobado en el issue #1241 (`[vigía] PR atascados`):

| Cuándo (UTC) | Qué comentó el vigía, mencionando a `@lwislg99` |
|---|---|
| 2-oct 09:04 | #2129, #2128, #2130 y #2131 entran como SIN-AUTO-MERGE |
| 3-oct 08:36 | los cuatro cruzan 24 h |
| 5-oct 09:40 | los cuatro cruzan 72 h |

El issue tiene 43 comentarios. Los 43 son del vigía. Cero reacciones, ninguna respuesta de una persona.

El latido reusa los clasificadores del vigía desde SCRUM-1350, pero no leía lo que el vigía escribe.
Los dos miraban los mismos PR y no se hablaban.

Y la línea de MAIN decía «último con el obligatorio VERDE: …» sin fecha: 88 h sin un merge se leían
igual que un día normal.

## Qué cambia

| Antes | Ahora |
|---|---|
| El latido no abría el issue del vigía | Sección 9, **VIGÍA**: cada aviso sin leer que nombre algún PR aún abierto, con fecha, edad, los PR que siguen abiertos y el id del comentario |
| — | Un aviso cuyos PR ya están todos cerrados se cuenta en la población y no se enseña |
| MAIN: «último con el obligatorio VERDE: 2753de7a» | MAIN: «main no recibe un commit desde hace 3.7 días (88 h) (sha, fecha) · último con el obligatorio VERDE: …» |

**«Leído»** no existe en GitHub. Se define así, y la salida lo dice: el comentario tiene alguna
reacción, o una persona ha comentado después en el issue. Un comentario posterior de un bot no cuenta.
Para marcar uno: `gh api repos/lwislg99/cobroflash-backend/issues/comments/<id>/reactions -f content=eyes`.
Eso escribe en GitHub: lo hace quien lee, no el latido.

El issue se busca por su título (`[vigía] PR atascados`, el `TITULO` del workflow), no por número.

La edad de `main` **sólo se dice**; no dispara alerta. El umbral de parón es de S0 y va en el vigía:
dos umbrales para lo mismo acaban discrepando.

## Cuándo dice NO PUDE MIRAR (salida 2) y no «cero avisos»

- no se pudo buscar el issue;
- no hay ningún issue abierto con ese título (el vigía no ha corrido nunca, o alguien lo cerró);
- no se pudieron leer sus comentarios;
- la lista de PR abiertos no llegó, o llegó con cien justos (puede haber más);
- un aviso no nombra ningún PR que se sepa leer: el formato del vigía cambió;
- se pidió la fecha del último commit de `main` y no se deja leer.

## «Alertar de SIN-AUTO-MERGE»: ya estaba

Pedido en el mismo encargo. Lo hace SCRUM-1453 (#2192, mergeado el 6-oct): un PR vigilado sin
auto-merge y con 2 h o más desde su último push sale como alerta, con quién lo desarmó. La medición de
S0 («4 vigilados, cero alertas») es de antes de ese merge. No se rehace.

## Medido después

`node scripts/equipo/latido.mjs`, 6-oct-2026 ~11:30Z:

```
✅ MAIN · main no recibe un commit desde hace 20 min (39af736e, 2026-10-06T11:14Z) · 2 commits de main recorridos …
🔴 VIGÍA · issue #1241 · 43 comentarios, 43 son avisos del vigía · 43 sin leer (3 con algún PR aún abierto, 40 ya sin ninguno: no se enseñan) …
   · aviso del 2026-10-02T09:04Z SIN LEER desde hace 4.1 días · nombra 4 PR, 4 siguen abiertos: #2129 #2128 #2130 #2131 · comentario 5948735558
   · aviso del 2026-10-03T08:36Z SIN LEER desde hace 3.1 días · nombra 4 PR, 4 siguen abiertos: #2129 #2128 #2130 #2131 · comentario 5967243018
   · aviso del 2026-10-05T09:40Z SIN LEER desde hace 25.9 h · nombra 4 PR, 4 siguen abiertos: #2129 #2128 #2130 #2131 · comentario 5991934134
```

Coste: 1,1 s y 2 llamadas a `gh` la sección nueva; 1 llamada más en MAIN. El latido entero, 25,3 s.

## Tests

`tests/scrum1459-latido-lee-al-vigia.test.mjs` → 6 de 6. Con los otros cuatro del latido
(`scrum1350`, `scrum1356`, `scrum1413`, `scrum1453`): 75 de 75.

Mutaciones, con la base sin mutar en 6/6 primero:

| Mutación | Caen |
|---|---|
| M1 · una reacción no cuenta como leído | 1 |
| M2 · una respuesta de persona no cuenta como leído | 1 |
| M3 · un comentario posterior de un bot cuenta como leído | 3 |
| M4 · el aviso de PR ya cerrados se enseña igual | 3 |
| M5 · sin lista de PR abiertos se da por «ninguno abierto» | 1 |
| M6 · un aviso de formato ilegible se da por «sin PR» | 1 |
| M7 · sin issue abierto es «cero avisos» | 1 |
| M8 · la fecha de main ilegible no ciega la sección | 1 |
| M9 · la línea de MAIN no lleva la edad | 1 |
| M10 · los PR se leen de cualquier `#` del texto | 1 |

Diez de diez mueren.

## Lo que no mira

- Los avisos que el vigía deja en cada PR (`<!-- vigia-atascados:pr … -->`, el PR mudo): sólo se lee
  el issue.
- El cuerpo del issue, que el vigía reescribe en cada pasada. La lista viva de PR ya la da la sección 1.
- Si el vigía ha dejado de correr. Un issue abierto y sin avisos nuevos se lee igual con el vigía
  parado que con todo en orden.
