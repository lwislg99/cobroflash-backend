# SCRUM-1364 · El lanzador toma el modelo del config, con opus por defecto, y falla hacia arriba

**Medido contra:** `origin/main` = `426a91c4fea7a41af51676722cfe6dd05af7bc80` · 2026-10-01T12:35:49Z

A9: comprobación → `tests/scrum951a-equipo-configurable.test.mjs`

Carril S5 (`scripts/equipo/sesion.mjs` es de este puesto). Sin `src/`, sin `public/`, sin esquema.

## La decisión que se aplica, y de dónde se cita

**Fundador, 1-oct-2026, palabras literales: «caro con 6 si»** — opus, seis puestos, eligiendo entre
caro con 4 / caro con 6 / barato con 6. Está escrita en la memoria del orquestador
(`project_modelo_del_equipo_decidido.md`) y en su lista de pendientes como resuelta. A esta sesión le
llegó por el encargo del orquestador, no de boca del fundador: se cita de ahí.

Revierte la del 21-sep-2026 (SCRUM-990: todos con `--model sonnet`).

## El defecto

`sesion.mjs` llevaba `MODELO_DEL_EQUIPO = 'sonnet'` fijo en el código. Con la decisión nueva, lanzar o
relevar por la puerta oficial bajaba de modelo a los seis puestos sin decirlo; por eso hoy se lanza a
mano. Era el punto (d) del interruptor de las mesas (SCRUM-1298).

## Lo que entra

| Qué | Cómo |
|---|---|
| De dónde sale el modelo | `modeloDe(config)`: la clave `modelo` de `config.json` |
| Sin la clave | `opus` (`MODELO_POR_DEFECTO`). Ausente es «no declarado», no «ilegible» |
| Clave presente e ilegible (vacía, `null`, número, lista, con forma de flag, con espacio, mayúsculas) | `NO-PUDE-MIRAR` en la puerta: no lanza y no llama a `claude`. No se sustituye por ningún otro |
| Que no sea mudo | `lanzar` y `relevar` devuelven `modelo` en su veredicto (`LANZADA`/`RELEVADA`) |
| El flag | mismo sitio y orden medidos en SCRUM-990; `reanudar` sigue sin `--model` |

`argsLanzar` valida el modelo otra vez por su cuenta y lanza excepción si no tiene forma de modelo: el
valor viaja como un argumento y nunca puede empezar por guion.

## Comprobado

| Qué | Resultado |
|---|---|
| Dirigida: `scrum899`, `scrum899b`, `scrum951a` | 43 tests, 43 pasan, 0 saltados |
| Mutación: defecto `opus` → `sonnet` | cae «sin modelo declarado, una sesión nueva sale con `--model opus`» |
| Mutación: quitar el flag `--model` | cae el mismo |
| Mutación: `modeloDe` deja de rechazar lo ilegible | cae «un `modelo` declarado que no se deja leer PARA» |
| Mutación: `lanzar` deja de pasar `modelo` a `argsLanzar` | cae «el `modelo` del config llega al lanzamiento» |

Las cuatro aplicadas a mano, una a una, con el fichero restaurado después (`git status`: sólo los
cuatro ficheros de este cambio). Tres quedan declaradas en `MUTACIONES_QUE_ME_TUMBAN`.

No he corrido la tanda completa en local (memoria). El veredicto es el del CI.

## Lo que NO he comprobado

- **Un lanzamiento real con opus por esta puerta.** Lo probado es con el `claude` falso del banco. La
  sonda por efecto es la de SCRUM-990: tras el primer `lanzar` real, el `state.json` del trabajo tiene
  que llevar `respawnFlags: [… --model, opus]` y su jsonl un modelo opus.
- **La copia instalada no cambia hasta que esto entre en `main`** y `arranque.cmd` la refresque. Y al
  entrar, la instalada dará `ALTERADO` hasta ese refresco (toca `sesion.mjs`): es la puerta haciendo
  su trabajo, no un fallo nuevo.
- **El equipo de Javier** usa el mismo lanzador con su propio `config.json`. Sin la clave, también
  pasa a opus. Si su decisión es otra, se declara con `"modelo"` en su config; no lo he preguntado.

## Mis errores

1. Declaré dos mutaciones en `scrum899` apuntando a tests que luego escribí en `scrum951a`. Lo vi
   antes de correr nada y las moví; de haberlas dejado, el meta-guard habría buscado un test que no
   está en ese fichero.
2. Repetí una trampa que el traspaso de mi antecesora traía escrita: un comando de PowerShell con
   líneas `//` dentro, que el entorno bloquea entero. Lo leí y lo hice igual. Sin daño (no llegó a
   ejecutarse), pero es una nota leída que no evitó nada.

## Lo que queda del interruptor de las mesas

(a) #2001 de S0 · (b) `mesas` en `config.json` · (c) lanzar por `sesion.mjs`.
