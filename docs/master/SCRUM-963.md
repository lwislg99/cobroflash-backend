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

---

# SCRUM-963b · 25-sep-2026 · el techo de `guards-visuales` (10 min) sube a 20, MEDIDO

**Fecha:** 25-sep-2026 16:50Z (GitHub) · **Carril:** S5
**Medido contra:** `origin/main` = `cab692d54fd183fb737d00365ee5dcdd3d6ea257` · 2026-09-25T16:38:35Z
**Rama:** `scrum-1123-vigia-avisa-de-verdad` (junto con SCRUM-1123, mismo lote de sesión)
**Encargo:** el orquestador pidió construir el arreglo de la SESIÓN ANTERIOR (comentario Jira
16987, 25-sep 16:31Z): 21/60 push a `main` (35 %) cancelados porque `guards-visuales` choca con su
propio `timeout-minutes: 10`, indistinguible en la lista de checks de un cancelado real.

## PASO 0 · ¿es un cuelgue o es que ya no cabe?

El comentario 16987 dejaba la pregunta abierta («si `guards-visuales` necesita más presupuesto, o
si el cuelgue de fondo es lo que hay que arreglar»). Medí antes de tocar nada:

- **`fueraDeLaTanda()` (la lista real que corre este job) da 37 guards hoy.** El comentario de
  cabecera del job en `ci.yml` (SCRUM-522, 24-ago-2026) sigue diciendo «nueve guards» — la lista
  ha crecido ×4 y ese número nunca se revisó.
- **Ningún guard individual se acerca a su propio tope** (`GUARDS_VISUALES_TOPE_MS`, 240 s por
  guard vía `spawnSync`, `guards-visuales.mjs:50`). Log completo del run cancelado 36160342546:
  los 37 guards van de 2,8 s a 25 s cada uno, todos `verde`. **No hay ningún guard colgado.**
- Ese mismo run (36160342546) corrió los 37 guards en serie, terminó de verdad —imprimió
  `DEFECTOS (salida 1) · guard:objetivo-tactil` como último renglón— y GitHub lo canceló
  **una fracción de segundo después**, con el veredicto ya en el log y tirado igual.
- **Tres runs de `main` en verde** (no cancelados, para descartar que sea sólo el caso malo),
  duración total del job completo (`gh api .../actions/runs/<id>/jobs`):

      36007466639 · 9 min 26 s
      35905842967 · 9 min 35 s
      35894300030 · 9 min 45 s

  **Un run SANO deja hoy 15-35 s de margen sobre el techo de 600 s.** Eso, con la varianza que ya
  documentaba SCRUM-522 para la misma tanda (con el runner cargado, el doble de tiempo — 50 s →
  102 s con nueve guards), explica el 35 % medido sin necesidad de ningún cuelgue.

**Conclusión: es aritmética, no un cuelgue.** El arreglo correcto es subir el techo del JOB, no el
tope de cada guard (`TOPE_MS` sigue en 240 s, sin tocar) ni investigar un cuelgue que no existe.

## El arreglo

`.github/workflows/ci.yml`, job `guards-visuales`: `timeout-minutes: 10` → **`20`**. Con el peor
caso medido en 9 min 45 s, 20 min deja el doble de margen sobre el caso sano y cubre la varianza
de carga documentada (que casi duplica el tiempo). Comentario añadido en el propio fichero con la
medición completa, para que quien vuelva a tocar esto no repita el PASO 0.

**No se toca**: el criterio de ningún guard (regla 41), el tope individual de 240 s por guard, ni
el ruleset — este job sigue sin ser obligatorio (② de arriba: la única puerta real es
`build + tests`), así que subir su techo no cambia cuánto tarda un PR en poder mergearse.

## Medido después

- `js-yaml` parsea `ci.yml` sin error tras el cambio (mismo método que SCRUM-1123, mismo commit).
- `npm run guards:entrada`: verde (ver informe conjunto de la tanda).
- **No se ha podido ejercer el efecto real en CI**: eso sólo lo mide GitHub Actions al empujar y
  con el paso de tiempo (los cancelados por timeout son ~35 % de la muestra, no el 100 %, así que
  hace falta ventana para volver a medir la tasa). Control por efecto pendiente: repetir la medida
  de la Sesión anterior (población de 60 push a `main`, `gh run view --json jobs`) dentro de unos
  días y comprobar que la categoría «cancelled por timeout-minutes propio» baja de 21/60.

## Lo que NO se ha hecho

- ⛔ No se ha tocado `TOPE_MS` (240 s por guard) ni el arnés de `guards-visuales.mjs`.
- ⛔ No se ha corregido el comentario «nueve guards» en la cabecera del job (SCRUM-522):
  documentación desfasada, sin víctima hoy más allá de confundir al próximo lector — se deja
  anotado aquí en vez de abrir un tercer hallazgo en la misma tanda (tope de 3, regla A7).
- ⛔ No se ha tocado el ruleset ni `cancel-in-progress` de `main`.
- ⛔ El resto de SCRUM-963 (meta-guard obligatorio) sigue bloqueado en SCRUM-836/908, sin cambio
  desde el 24-sep (comentario 16776) — no se remide en esta tanda.
