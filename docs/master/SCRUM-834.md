# SCRUM-834 · Nada avisa a una sesión de que su PR se ha puesto rojo (última pieza del bucle)

**Fecha del expediente:** 15-sep-2026 · **Carril:** proceso (bucle automático de PRs) · **Gate:** ⚠️ **RECONSTRUIDO A POSTERIORI**

**Medido contra:** `origin/main` = `3b50990f09d0023e7654d14a24a366b7a167a4a5` · 2026-09-15T11:04:12Z
**Sha real del merge que entró sin expediente:** `4dec28eb14fc6b2d2b3abd0c3b1484b70018e197`
(PR #1233, 2026-09-09T15:15:42Z, rama `scrum-834e-censo-de-modulos`)
**Rama de esta reconstrucción:** `scrum-846-834-expedientes-reconstruidos`

---

> # ⚠️ ESTE EXPEDIENTE NO LO ESCRIBIÓ QUIEN HIZO EL TRABAJO
>
> Lo escribe la sesión de **SCRUM-854**. Todo está **derivado del árbol y de Jira**, con la fuente
> dicha en cada punto. **No se ha reconstruido ninguna medición que no se pueda verificar hoy, ni
> se ha inventado ningún rojo.** Lo que no se pudo saber está en el **§6**.
>
> 🔴 **Y el agujero era mayor de lo que decía SCRUM-854: no es un merge sin entrada, son CINCO.**
> Aquel censo miró los 60 últimos merges y sólo alcanzó la fase `e`. Las cuatro anteriores
> entraron el mismo día y tampoco dejaron registro.

---

## 1 · Qué dice el ticket (fuente: Jira, leído el 15-sep-2026)

**Título:** *«Nada avisa a una sesión de que su PR se ha puesto rojo (última pieza del bucle)»* ·
**Tipo:** Tarea · **Prioridad:** Medium · **Estado:** **Finalizada / Listo** ·
Creado 2026-09-09, actualizado 2026-09-09T10:17.

**El hueco, citado del ticket:** el workflow de `@claude` existe pero necesita que una PERSONA
escriba el comentario — *«que es justo el trabajo de mensajero que el fundador quiere eliminar»*.
Es la última de las siete piezas del bucle; cinco estaban hechas (el PR se abre solo, el
auto-merge se arma solo, CI corre, mergea en verde, la rama se borra sola).

**Las dos condiciones medidas en el ticket**, ambas necesarias para que el aviso despierte a algo:

1. **Un bot no puede despertar a Claude por defecto.** Hace falta `allowed_bots` con el nombre
   explícito. Sin eso el comentario se publica y **no pasa nada**: silencio, no error.
2. **El comentario tiene que ir con la llave de la App**, no con el `GITHUB_TOKEN`: los eventos
   creados por ese token no crean ejecuciones.

**El riesgo aceptado a sabiendas** (repositorio público), citado del ticket:
*«Allowed bots are not checked for repository permissions»* → **nunca `'*'`**, lista explícita.

**El choque que el ticket resuelve**, y que es su parte más fina: un aviso automático no puede
contener `@claude` porque dispara `claude.yml`… y aquí esa cadena **es** el mecanismo. La
resolución no es elegir, es **dejar de aplicar la regla al repositorio y aplicarla al INSTRUMENTO**:

| instrumento | despierta a | invariante que su propio script comprueba |
|---|---|---|
| Vigía de PR atascados | una PERSONA | si el cuerpo **contiene** `@claude` → aborta |
| **Avisador de rojo** (este ticket) | una SESIÓN | si el cuerpo **no contiene** `@claude` → aborta |

## 2 · Qué entró en `main`: CINCO fases, ninguna con entrada

Derivado de `git log --merges`. Las cinco, el mismo día:

| # | merge | PR | rama | ficheros |
|---|---|---|---|---|
| 1 | `16997ef4` | #1211 | `scrum-834-avisador-rojo` | `avisador-rojo.yml`, `claude.yml`, `00-normas-comunes.md`, `puerta-avisador-rojo.mjs`, su test |
| 2 | `b9477e21` | #1215 | `scrum-834b-censo-voz-del-bot` | `pr-automatico.yml`, `puerta-avisador-rojo.mjs`, su test |
| 3 | `4777217a` | #1223 | `scrum-834c-puerta-fiscal` | `avisador-rojo.yml`, `puerta-avisador-rojo.mjs`, su test |
| 4 | `40f908f6` | #1231 | `scrum-834d-tope-del-bucle` | `claude.yml`, su test |
| 5 | `4dec28eb` | #1233 | `scrum-834e-censo-de-modulos` | `puerta-avisador-rojo.mjs`, su test (`+132 / -4`) |

**Ninguna de las cinco tocó `docs/master/`.** El ticket está Finalizado en Jira y su registro no
existía hasta hoy.

## 3 · Qué dicen los commits de cada fase (citado, no reinterpretado)

* **834** (`42183044`) — pone el avisador: las dos condiciones del §1, medidas.
* **834b** (`565e94c5`) — *«`allowed_bots` se pone sobre la IDENTIDAD `yaqu-bot[bot]`, NO sobre un
  workflow. Cualquier cosa que hable como ese bot despierta a Claude si su texto lleva la
  mención.»* Trae un censo de quién habla como el bot.
* **834c** (`9a6763e1`) — el avisador **no despierta a Claude en PRs del camino fiscal**. Con un
  hecho medido dentro: *«la cadena avisador → Claude → push a la rama SE CIERRA SIN NINGUNA
  PERSONA: `claude.yml` arrancó SIETE veces en media hora con actor = `yaqu-bot[bot]`»*.
* **834d** (`c4be62b7`) — el token pasa a ser el de la App para que sus commits disparen CI.
  Motivo medido: *«el #1212 llevaba desde la víspera parado sin que nada lo dijera […] tenía CERO
  check-runs»*. ⚠️ **El asunto de este commit no lleva el número del ticket**; sólo lo lleva la rama.
* **834e** (`4dd6493a`, el del merge sin entrada) — *«la puerta fiscal deja de ser una lista y pasa
  a ser un censo»*.

### La fase `e`, que es la del merge de este expediente

**El agujero:** `RUTAS_FISCALES` no incluía `src/modules/fiscal/`, así que sus **20 de 20** ficheros
pasaban como un PR normal — ahí viven `verifactu/`, `librosAeat/`, `modelo303/` y
`evidencias/atestiguamiento`, la capa de SIF-1.

Y el motivo, dicho por su autor y que es lo mejor del commit:

> «yo conocía `invoicing/` y escribí `invoicing/`. **Una lista de rutas escrita por quien conoce el
> módulo tiene la forma de lo que él conoce.**»

**Por eso no se arregló añadiendo una ruta**, sino censando: cada directorio de `src/modules/` tiene
que estar en `MODULOS_FISCALES` o en `MODULOS_NO_FISCALES`, con **dos mecanismos**:

* **en la tanda**, un guard lee los directorios reales y falla si alguno no está clasificado;
* **en la puerta**, un módulo sin clasificar **se trata como FISCAL** — *«no saber si algo es el
  camino de emisión no es saber que no lo es»*.

El commit declara **dos rojos provocados y distintos** (`fiscal` sin clasificar → cae el suelo,
`not ok 37` y `39`; `fiscal` mal clasificado → cae el control de los 20, `not ok 36`), restaurados
byte a byte, y **41/41**.

## 4 · Lo único que esta sesión ha medido por su cuenta (15-sep-2026)

```
node --test tests/scrum834-puerta-avisador-rojo.test.mjs
# tests 41 · # pass 41 · # fail 0 · # skipped 0
```

**41/41 hoy**, el mismo número que declara el commit de la fase `e`. Es lo único de este ticket que
se puede verificar desde aquí sin fabricar nada.

## 5 · Estado de la decisión que el ticket dejaba abierta

El ticket termina con: *«Decidir si se acepta `allowed_bots: yaqu-bot[bot]` en `claude.yml` con el
riesgo declarado arriba. Sin eso, nada de lo demás llega a ejecutarse.»*

**Derivado del árbol:** `claude.yml` fue tocado por las fases 834 y 834d, y los ficheros
`avisador-rojo.yml` y `puerta-avisador-rojo.mjs` existen en `main`. **Qué valor tiene hoy
`allowed_bots` no se afirma aquí**: leerlo es trivial, pero afirmar que *esa* es la decisión del
fundador exigiría constancia de la decisión, no del fichero. Ver §6.

## 6 · 🔴 LO QUE NO SE PUDO RECONSTRUIR

1. **La decisión del fundador sobre `allowed_bots`.** El ticket la pide explícitamente como
   condición previa y está Finalizado; **no consta dónde ni cuándo se tomó**. Que el fichero tenga
   hoy un valor no es constancia de que alguien lo decidiera: es el estado del fichero.
2. **Los rojos de las fases 1-4.** Sólo la fase `e` los describe en su mensaje. De las otras
   cuatro no hay ejecución que reproducir, y no se inventan.
3. **Las siete piezas del bucle**: el ticket dice que cinco estaban hechas y faltaban dos (ésta y
   el auto-update de ramas). **No consta el estado de la séptima.**
4. **Si el avisador ha llegado a avisar de verdad alguna vez.** El ticket exige un suelo que
   demuestre por pasada que *encontraría* un PR rojo si existiera; si ese suelo corre y qué ha
   devuelto no está en el árbol.
5. **Por qué ninguna de las cinco fases dejó registro.** Cinco PRs el mismo día es un ritmo que
   invita a saltárselo, pero eso es una hipótesis mía, no un dato: no se escribe como causa.
6. **Qué cerró el ticket, y cuándo.** Jira lo marca **Finalizada / Listo**, y su última
   actualización es `2026-09-09T10:17:56+02:00` = **08:17 UTC**. Contrastado con los merges (todos
   en UTC):

   | | |
   |---|---|
   | `16997ef4` fase 834 | 07:54 — **antes** de esa actualización |
   | `b9477e21` fase 834b | 08:11 — **antes** |
   | `4777217a` fase 834c | **14:27 — después** |
   | `40f908f6` fase 834d | **15:05 — después** |
   | `4dec28eb` fase 834e | **15:15 — después** |

   O sea: **tres de las cinco fases entraron en `main` después de la última vez que alguien tocó
   el ticket**. `updated` no es necesariamente la fecha de cierre —es la última modificación—, así
   que lo único afirmable es que **el ticket no se actualizó al entrar esas tres fases**. Quién lo
   cerró y con qué criterio no consta, y no se deduce.

## 7 · Lo NO tocado por esta reconstrucción

Ni una línea de `scripts/puerta-avisador-rojo.mjs`, de su test, ni de ningún workflow. Esto es
**sólo el registro que faltaba**.
