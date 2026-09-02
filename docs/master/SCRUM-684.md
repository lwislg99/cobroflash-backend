# SCRUM-684 · el dictado, cableado — y el aviso que la medición puso en singular

**Medido contra:** `origin/main` = `69300b6662752e8fe624b1f6ee6b555f02e3a3f2` · 2026-09-02T19:53:12+02:00

---

## 0 · PASO 0

```
git ls-tree -r --name-only origin/main | grep -iE 'partes.routes|parteDictado'
  → src/modules/jobs/app/routes/partes.routes.ts
  → src/modules/jobs/domain/parteDictado.ts                              [exit 0]

¿YA cableado?  grep -rn 'parteDictado' src/ public/ (fuera de su módulo)  → vacío [exit 1]
CONTROL POSITIVO del mismo barrido: `parteTrabajo` → 3 importadores       [exit 0]
```

**No estaba cableado.** No es la octava.

---

## 1 · La microcopy que faltaba: `Falta la cantidad — ponla tú`

Aprobada en **singular** después de que la medición desmintiera la primera versión. La historia
está en `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` (addendum «la tercera») y resumida en
`parteDictado.ts`: se aprobó primero en plural dando por hecho que era un resumen, se midió que
`cantidadesRetiradas` trae **una entrada por línea** y **puede traer exactamente una**, se paró, y
el fundador la cambió. **El dato mandó el texto.**

Se pinta **una vez en cada línea** a la que le falta la cantidad. Un resumen («3 líneas sin
cantidad») sería un texto distinto y se aprueba aparte: hay un aserto que cae si vuelve el plural.

---

## 2 · El cable

```
POST /admin/partes/:id/dictado
  → suggestLineasDeParte  (ai.service.ts)   ── el texto al modelo
  → sanearDictadoDelParte (parteDictado.ts) ── la protección, sobre el dictado ORIGINAL
  → devuelve { propuesta, avisos }          ── y NO ESCRIBE NADA
```

Lo que escribe en el parte sigue siendo el `PATCH` de siempre, y solo cuando el técnico confirma.
La ruta lleva el mismo candado que el `PATCH` (`puedeEditarContenido`): proponerle líneas a un
parte firmado sería enseñar un camino que el paso siguiente cierra con un 409.

**El campo es un `<textarea>` normal.** El técnico dicta con el **micrófono del teclado de su
móvil**: funciona en iPhone y Android, es gratis y **el audio no sale del teléfono**. Para este
campo, *no hacer nada es la funcionalidad*.

**Sin red no se bloquea:** sin clave, con el modelo caído o con una respuesta ilegible, la ruta
devuelve la propuesta **vacía con su motivo y un 200**. Un 500 le diría «se ha roto» cuando lo
único que pasa es que no hay ayuda.

---

## 3 · Verificación — los tres rojos

**Commit de todo ANTES de inyectar: `bc09146d5a337f251317e617e93417d232c212ed`** (verde, 4.561 · 4.482 pass).

| rojo inyectado | resultado |
|---|---|
| **el cable se salta el saneador** y se fía del prompt | 🔴 **1 cae, exit 1** — *««Canalización con canaleta» ha cruzado el cable con cantidad 3»* |
| **`SpeechRecognition` en la vista** | 🔴 **1 cae, exit 1**, y solo esa |
| **un importe en la línea propuesta** | 🔴 **1 cae, exit 1** — *«el símbolo del euro, el precio unitario»* |

El primero es el que importa: con el modelo devolviendo un `1` y un `3` que el dictado no dice, la
propuesta vuelve **sin cantidad en las dos líneas**. El prompt lo pide; el saneador lo garantiza.

> 🔴 **El guard de la voz lee el código SIN COMENTARIOS**, porque la propia vista explica por qué no
> usa `SpeechRecognition` y un guard de texto se caza a sí mismo en el comentario que explica la
> prohibición. Lleva su suelo (el despojador tiene que seguir viendo `pintarDictado`) y su control
> positivo (sobre `new webkitSpeechRecognition()` tiene que saltar).

---

## 4 · 🔴 Hallazgo: el detector de dinero de SCRUM-652c NO cazó el importe inyectado

Al inyectar el tercer rojo, **mi control negativo cayó y el suyo no**. Verificado el motivo leyendo
su test (`scrum652c-parte-en-el-movil.test.mjs:213`): escanea `contenedor.innerHTML` **después de
`renderParte`**, con su razón escrita — *«se busca en el MARCADO PINTADO, no en el fichero: es la
única forma de afirmar “no se ve”»*.

Ese razonamiento es correcto para lo que mide, pero deja un punto ciego: **el dinero que viva en un
camino que ese render no ejercita le es invisible**, y la propuesta del dictado es exactamente uno
de esos caminos.

Los dos son complementarios, no redundantes:

| | qué mira | qué se le escapa |
|---|---|---|
| SCRUM-652c | el marcado **pintado** por `renderParte` | dinero en un camino que ese render no ejercita |
| SCRUM-683b (éste) | el **fichero** de la vista | podría acusar a un comentario (por eso el de la voz despoja) |

**No se toca el suyo** (regla 9, carril de SCRUM-652 fase C). Con el de este ticket, el árbol queda
cubierto por los dos lados; queda dicho por si su cobertura se quiere ampliar en su propio carril.

---

## 5 · Declaraciones que movió el cable

* **SCRUM-411: 9 → 8**, y **recontado ejecutando** `analizar()` sobre el árbol de hoy: **126 módulos
  de dominio, 289 alcanzables, 8 inalcanzables**. `parteDictado.ts` ya no está. Queda `revision.ts`.
  La entrada anterior prometía «baja cuando `parteDictado.ts` tenga consumidor» y **no prometía un
  número**: por eso no ha hecho falta corregirla.
* **SCRUM-55**: la ruta declara rol de Operario, con motivo. Es trabajo de campo puro y no abre
  ninguna puerta a dinero.
* **Huérfanos declarados**: `aLineaDelParte` entra como `MOTOR_EN_ESPERA` (la confirmación viaja hoy
  por el `PATCH`), y **`cantidadRespaldadaPorElTexto` pierde el `export`** — su consumidor real está
  dentro del módulo. Sus **11 asertos** pasan a medir por la superficie pública.

## 6 · 🔴 Hallazgo de otro carril, reportado y NO arreglado (regla 9)

`validarLineasDelTecnico` (`partes.routes.ts`, SCRUM-652 fase C) acepta `Number.isFinite(unds)` —o
sea, **0 y negativas**— mientras `aLineaDelParte` exige `> 0`. Las dos guardan la misma frontera y
no comprueban lo mismo. Tocar la validación de esa ruta cambiaría el comportamiento de una pantalla
ya mergeada por otra sesión: **se reporta**.

## 7 · El detector de enriquecimiento: NO se construye (decisión, no olvido)

Se propuso marcar las descripciones cuyas palabras no aparecen en el dictado, para que el técnico
mire ahí primero. **El fundador lo descartó con el motivo que se dio al proponerlo**: reformular
legítimamente («Sustitución de videograbador» por «sustituir el videograbador») marcaría casi todas,
y **un detector que acusa a los sanos se desactiva**. Queda escrito como decisión.

La descripción sigue protegida solo por que **el técnico confirma** — y la línea del prompt que
prohíbe completar marcas **es un consejo, no un mecanismo**. Está dicho en `parteDictado.ts`.
