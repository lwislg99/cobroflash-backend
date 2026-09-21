# SCRUM-963 · la puerta de `main`: qué protege hoy y qué se propone exigir

**Fecha:** 20-sep-2026 · **Carril:** S5 · automatización, eficiencia e infraestructura
**Medido contra:** `origin/main` = `35d25d1c58954930b529ad9f736878018c0f9870` · 2026-09-20T19:40:59Z (GitHub)
**Rama:** `scrum-963-ruleset-preparado` · **Worktree:** `wt-963`

🔴 **Este documento NO aplica nada.** Prepara el cambio, mide su efecto y lo deja listo para que lo
apruebe y lo ejecute un jefe. Cambiar el ruleset afecta al merge de todo el equipo y de los dos
equipos: no es una decisión de esta sesión.

## ① Lo que ya estaba medido (18–20 de septiembre, no se ha vuelto a medir)

- **56 de 60 merges (93 %)** entraron con algún check en `failure` o `cancelled`. Ventana 17-sep
  19:43Z → 20-sep 14:15Z, 60 PR, 0 ciegos, 0 sin checks.
- Por check: `meta-guard` **55/60** malas · `guards de navegador` **13/60** · `trinquete zona` 3 ·
  `vigía del despliegue (informativo)` 2 · **`build + tests` 0**.
- 🔴 **El mecanismo, que es la respuesta de verdad:** `main` **no tiene protección clásica**
  (`/branches/main/protection` devuelve 404, «Branch not protected»). La protege un **RULESET**.
  Así que el auto-merge nunca se saltó nada: **esos checks no estaban puestos de puerta.**

  ⚠️ Trampa medida, y vale para todo el equipo: preguntar sólo por la protección clásica da 404, y
  **un 404 ahí no significa «no hay protección»**. Hay que mirar `repos/<r>/rulesets`.

## ② El ruleset tal como está HOY, literal

`protect-main`, id **18770370**, `enforcement: active`, `bypass_actors: []`,
`current_user_can_bypass: "never"`. Copia entera en
`docs/master/evidencias/scrum963/ruleset.json`. Lo que decide:

    required_status_checks: [ "build + tests (con banco desechable)" ]   ← UNA sola
    strict_required_status_checks_policy: false
    required_approving_review_count: 0
    allowed_merge_methods: ["squash", "merge"]
    reglas: deletion · non_fast_forward · pull_request · required_status_checks

O sea: **una sola puerta, y es la única que sale 0 malas de 60.** La puerta existe y funciona; lo
que no hace es filtrar nada de lo que nos preocupa, porque lo que nos preocupa no está puesto.

## ③ Medido HOY · ¿puede `meta-guard` ser puerta, ahora que SCRUM-935 está en `main`?

Ésta es la pregunta que decide, y antes de 935 la respuesta era no: el job moría en su techo de 10
minutos en 55 de 60 PR, y marcarlo obligatorio habría bloqueado al equipo entero. Con 935 dentro:

| dónde | `meta-guard` | duración | veredicto |
|---|---|---|---|
| push a `main` del propio merge de 935 (run 35517842596) | `success` | **11:07** | pasa del techo viejo |
| PR #1537 (`scrum-944b`) | `success` | **12:01** | pasa del techo viejo |
| PR #1538 (`scrum-915`) | `success` | **11:57** | pasa del techo viejo |

**Tres de tres, y las tres por encima de 10 minutos.** Con el techo anterior las tres habrían
salido `cancelled`. Es poca muestra —lo digo yo, que la tomé— pero es la muestra que hay, y va en
la misma dirección que el perfil de 935 (p50 11:06 · p95 13:06 · máx 14:16 contra el techo nuevo
de 30).

## ④ Medido HOY · qué pasaría con los 15 PR ABIERTOS

Instrumento: `docs/master/evidencias/scrum963/efecto-ruleset.mjs`; salida entera en
`efecto-963.txt`. **Población: 15 PR abiertos · 15 medidos · 0 NO PUDE MIRAR.**

- **Hoy ya están bloqueados 13 de 15** por la única puerta que hay. De esos 13, **diez no tienen
  NINGÚN check** en su commit de punta: son PR de julio y agosto cuya rama es anterior a los
  workflows de hoy. Ya estaban muertos antes de esta propuesta.
- **Sólo 2 pueden mergearse hoy:** #1153 y #972, los dos con `build + tests` en `success`.
- Exigir `meta-guard` **bloquearía esos 2**: #1153 lo tiene en `failure` y #972 no lo tiene
  siquiera. O sea: **el efecto real de la propuesta sobre lo abierto son 2 PR viejos que nadie
  está mergeando esta tarde.**
- Los dos PR vivos de hoy (#1537 y #1538) **ya están retenidos por la puerta actual**
  (`build + tests` en `failure` en los dos), y su `meta-guard` sale en verde. La propuesta no los
  toca.

🔴 **La consecuencia que hay que entender antes de firmar, y no es obvia:** con
`strict_required_status_checks_policy: false`, un check obligatorio que **no existe** en el commit
se queda **pendiente para siempre**, no «aprobado». Los diez PR sin checks no se desbloquean
solos: necesitan un merge de `main` encima para que los workflows de hoy corran sobre ellos.
Exigir más checks **no empeora** eso —ya les pasa con la puerta actual—, pero lo extiende a
cualquier rama vieja que alguien quiera resucitar.

## ⑤ Medido HOY · el que NO puede ser puerta todavía

`guards de navegador (fuera de la tanda)` sale **`failure` en los dos PR de hoy** (#1537 y #1538)
y en el push a `main` del merge de 935. **Es el rojo vivo desde que entró 917c**: no es un caso
aislado, es un guard caído por el que han pasado trece merges. **Marcarlo obligatorio hoy
bloquearía TODO el repositorio.** No entra en la propuesta, y lo que lo desbloquea no es una
decisión de ruleset: es arreglar el guard. Eso tiene dueño de otro carril.

## ⑥ Medido HOY · la holgura de la única puerta real, y un aviso

Instrumento: `holgura-puerta.mjs`; salida en `holgura-963.txt`.
**Población: 100 runs de `ci.yml` · 98 con la puerta medida · 2 sin ese job · 0 NO PUDE MIRAR.**

    «build + tests (con banco desechable)» · techo timeout-minutes: 10
    p50 6:13 · p95 7:25 · máx 9:16
    por encima del 80 % del techo (8 min): 1 de 98  (run 35317708289, 9:16, success)
    conclusiones: success 70 · cancelled 21 · failure 7

Las 21 `cancelled` son el `cancel-in-progress` de `main`, que es una decisión de COSTE del fundador
y no se ha tocado. Lo que importa aquí: **la única puerta que protege `main` tiene el mismo tipo de
techo fijo que SCRUM-935 acaba de demostrar que se cruza solo**, y su peor pasada de hoy se quedó
a **44 segundos** de él. Hoy tiene holgura. No se propone tocarlo ahora —no hay dato que lo pida—,
pero cuando el máximo pase de 8 minutos de forma estable, el techo de 10 hay que subirlo, porque
el día que la puerta muera en su techo **`main` se queda sin ninguna**.

## ⑦ LA PROPUESTA, para que la firme y la ejecute un jefe

**Añadir UN check obligatorio, no tres:** `meta-guard · los guards caen cuando deben`.

Por qué sólo ése:
- Es el que más detecta de lo que se nos escapa (55 de 60 malas en la ventana medida).
- Es el único de los tres candidatos que **hoy pasa** y que **ya no muere en su techo** (③).
- `guards de navegador` está en rojo (⑤) y `trinquete zona` sólo aportó 3 malas de 60: mucho
  tiempo de espera para poca detección. Si `meta-guard` aguanta una semana en verde, se vuelve a
  mirar el trinquete con datos, no con ganas.

El JSON completo está en `docs/master/evidencias/scrum963/ruleset-propuesto.json` y es el ruleset
de hoy con **una línea más**. La orden, tal cual, en una máquina con `gh` autenticado:

    gh api --method PUT repos/lwislg99/cobroflash-backend/rulesets/18770370 ^
      --input docs/master/evidencias/scrum963/ruleset-propuesto.json

Para deshacerlo, la misma orden con `ruleset.json` (la copia de hoy) en vez del propuesto.

⚠️ **El nombre del check tiene que casar BYTE A BYTE o la puerta no existe** (un check obligatorio
que no casa con ningún job se queda pendiente para siempre, y `meta-guard · los guards caen cuando
deben` lleva un `·` U+00B7, no un guion). Comprobado contra los **6 nombres de job que devuelve la
propia API de GitHub**, no contra lo que yo escribí: los dos casan byte a byte, y el control
negativo —el mismo nombre con `-` en vez de `·`— **no casa**, que es lo que tenía que pasar.

**Lo que se nota el lunes:** los PR tardarán **unos 12 minutos** en poder auto-mergearse en vez de
unos 7, porque el auto-merge espera al check más lento y `meta-guard` lo es. No es un coste en
dinero (el repo es público y los runners estándar facturan 0), es un coste de **espera**. Quien
firme esto está comprando detección con minutos de espera, y conviene decirlo así.

## ⑧ Lo que NO he hecho, y por qué

- **No he tocado el ruleset.** Afecta al merge de los dos equipos.
- **No he vuelto a medir** los 60 merges de ①: ya estaba medido y repetirlo no cambiaba la
  decisión.
- **No he tocado `cancel-in-progress`** de `main`: es una decisión de coste del fundador.
- **No he construido lo de «un `exit 2` (ciego) no se lee como aprobado»**, que es el otro punto
  pendiente del ticket. Queda fuera a propósito: mi encargo de esta tanda era preparar el ruleset
  y medir su efecto. Sigue pendiente y con dueño por decidir.
- **No he mirado** si un job en `skipped` cuenta como aprobado para un check obligatorio. Aquí no
  hace falta saberlo —los seis jobs de `ci.yml` corren siempre, ninguno lleva `if:` a nivel de
  job— pero **dejaría de no hacer falta** el día que alguien le ponga una condición a `meta-guard`.
