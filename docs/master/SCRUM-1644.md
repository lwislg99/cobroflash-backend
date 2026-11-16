# SCRUM-1644 · El plazo de `scrum113` caducó y tumbó el obligatorio en todos los PR: reclasificar y avisar antes

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-03T07:43:05Z

A9: comprobación → `tests/scrum113-migracion-fixtures.test.mjs`

Lo escribe S3 (equipo de Luis), por encargo de su orquestador. Fichero tocado: sólo `tests/scrum113-migracion-fixtures.test.mjs`.

## La decisión, con quién la tomó

- `MIGRAR_ANTES_DE` la fijó el fundador el 23-jul-2026, y el fichero dice que moverla «vuelve a requerir su OK».
- El 3-nov-2026 el fundador delegó sus decisiones en el orquestador. Literal: **«todo lo que tenia que decididr yo decidelo tu si puedes»**. Es el turno `type:user` `6b2bcf7c-aa53-4a8d-9d10-ab31e3faa10b`, ts `2026-11-03T07:38:24.106Z`, de la transcripción `ed676fd1-feb4-4658-bda2-01f4bf9fb3fc.jsonl`. Lo he buscado y leído en el fichero; no lo copio del encargo.
- Con esa delegación, el orquestador eligió la **opción ②** de este ticket (reclasificar, no sólo mover la fecha) y la fecha **2026-12-15**. Su motivo: seis semanas, para que el dueño de la consolidación fiscal pueda coger `scrum17`. **La fecha la eligió él, no S3.**
- Lo que la delegación NO cubre, y aquí no hacía falta: ningún permiso. Este cambio no ha necesitado ninguno.

## Qué cambia

| | antes | ahora |
|---|---|---|
| `MIGRACION_PENDIENTE` | 3: `scrum17`, `scrum74`, `webhooks-idempotencia` | **1**: `scrum17` |
| `MIGRACION_MAX` | 3 | 1 |
| `FUERA_DEL_PLAZO` (nueva) | — | `scrum74` → `EXCEPCION_PERMANENTE` · `webhooks-idempotencia` → `BLOQUEADA` por `SCRUM-63`, cada una con su motivo |
| `FUERA_DEL_PLAZO_MAX` (nueva) | — | 2, con igualdad exacta: sólo mengua |
| `MIGRAR_ANTES_DE` | `2026-10-31` | `2026-12-15` |
| aviso antes de caducar | no había: el guard sólo hablaba el día después | a `DIAS_DE_AVISO` = 14 días o menos sale un diagnóstico y una línea `::warning`. **No bloquea** |
| día después del plazo | falla | **falla igual**: mismo mensaje, mismo assert |

Los dos reclasificados siguen contados y vigilados. El test «ningún fichero NUEVO» acepta las dos listas, y nada más. `FUERA_DEL_PLAZO` tiene las dos mitades del trinquete, igual que la lista de pendientes: tope exacto, y una entrada que deje de crear merchants a mano tiene que salir. Además se comprueba que cada entrada tenga una clase cerrada y su motivo, que una `BLOQUEADA` diga de qué ticket depende, y que ningún fichero esté en las dos listas a la vez.

El plazo se juzga ahora con una función pura (`veredictoDelPlazo` / `comprobarPlazo`) que recibe `hoy`. Sus casos se prueban con una fecha fija en cualquier máquina, y el fichero sigue sin leer el entorno (`scrum702`). Una fecha que no se pueda leer **lanza**: no cuenta como «en plazo».

## Los controles, medidos en este árbol

| control | resultado |
|---|---|
| ① rojo primero: el fichero de `origin/main` hoy | `tests 3 · pass 2 · fail 1` → «CADUCÓ… Hoy 2026-11-03 · plazo 2026-10-31 · quedan 3» |
| ② después del cambio | `tests 11 · pass 11 · fail 0` · «pendientes de migrar: 1/1 · plazo 2026-12-15 · faltan 42 día(s)» |
| ③a un fichero NUEVO sembrado en `tests/` (`zz-sembrado-1644.test.mjs`, que crea un merchant a mano) | `fail 1`, y nombra `zz-sembrado-1644.test.mjs`. Borrado después |
| ③b un cuarto fichero metido en `MIGRACION_PENDIENTE`, sin tocar el tope | cae «la lista de pendientes solo mengua» |
| ③c un fichero metido en `FUERA_DEL_PLAZO`, sin tocar el tope | cae «FUERA_DEL_PLAZO también sólo mengua» |
| ④ con el plazo REAL movido a +10 días | sale `::warning title=SCRUM-113 plazo…`, también como diagnóstico; `pass 11 · fail 0` |
| ④ a +30 días | no sale ningún aviso; `pass 11 · fail 0` |
| ④ con fecha pasada (`2026-11-02`) | `pass 10 · fail 1`, CADUCÓ |
| ④ bordes, en el propio test | el día 14 avisa · el día 15 calla · el día del plazo avisa y no cae · sin pendientes, nada · fecha ilegible, lanza |

③b, ③c y ④ también van declarados como `MUTACIONES_QUE_ME_TUMBAN`. Así el meta-guard los vuelve a ejecutar en cada CI y no dependen de que alguien repita esta tabla. Son cinco: las dos de ③, un fichero que vuelve a crear a mano (en `scrum22`), quitar el aviso y aflojar el caducado a aviso. Las cinco las he aplicado una a una con una sonda desechable, que lee por el AST del propio meta-guard (0 ilegibles, 5 leídas) y restaura byte a byte. **Las cinco caen.** Control positivo de la sonda: una mutación inocua sale **MUDA**.

## Lo que este cambio NO cierra

- Quien añada un fichero a una lista **y suba su tope en el mismo commit** sigue pasando. Es la convención aceptada en SCRUM-124: ese cambio queda en el diff y alguien lo revisa. Antes de este cambio pasaba lo mismo; con dos listas son dos líneas que mirar en vez de una.
- `scrum17` sigue pendiente, y su plazo vence el 15-dic. El aviso empezará a salir el **1-dic-2026**.
- `webhooks-idempotencia` sale del plazo, pero no se olvida: cuando SCRUM-63 se cierre, se migra. Si deja de crear a mano sin que nadie lo saque de la lista, el test lo dice.
