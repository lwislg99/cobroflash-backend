# SCRUM-830 · El suelo medía ramas vivas, y la automatización dejó de producirlas

**Fecha:** 9-sep-2026 · **Carril:** instrumentación · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `da5ac06ac169fca5d3692a63b10b01a6aed7d3d6` · 2026-09-09T09:28:00+02:00
**Preámbulo:** `prisma generate` rc=0 · `HEAD..origin/main` = 0 · **`npm run build` rc=0**

---

## 1 · 🔴 PASO 0 · la premisa del ticket era medio falsa, y eso cambia el arreglo

El ticket dice que **el suelo de 558 exige y hay 98**. Medido hoy sobre el árbol limpio:

```
ramas remotas HOY : 105        ← no 98
`total > 100`     : PASA       ← ese suelo NO es el que falla
tests en rojo     : 3, no 4
```

**El suelo del número no era el que caía.** Lo que caía eran **anclas por identidad a tickets
concretos** cuyas ramas se habían borrado al mergear:

| lo que fallaba | por qué |
| --- | --- |
| control positivo enumerado | `SCRUM-821` sin rama → `SIN RASTRO`, o sea «no lo veo» |
| el árbitro | sólo 4 sujetos de los 5 nombrados: «un árbitro sin sujetos no arbitra nada» |
| control negativo | «sólo 10 tickets con todas sus ramas mergeadas. Había 464» |

La causa **sí** es la del ticket —«Automatically delete head branches»—, pero el sitio por donde
muerde es otro, y por eso el arreglo no podía ser tocar el 558.

## 2 · Lo que el guard viejo cazaba, dicho ANTES de tocarlo

El ticket pide poder decirlo, y se puede: `total > 100` cazaba **que el barrido no llegara a las
ramas** — un `ls-remote` vacío, un fetch que no trajo nada — y que eso se leyera como «nadie tiene
trabajo vivo». Ese trabajo **sigue vigilado y por dos sitios**: `censo.suelo` (cero población) y el
`vivas > 0` / `enMain > 0` de la línea siguiente.

Lo que ha dejado de tener sentido es **la magnitud**: con borrado automático, las refs vivas ya no
miden el tamaño de la casa — miden **cuántos PR hay abiertos ahora mismo**, que sube y baja cada
día. Por eso no se sube a 98: caducaría igual.

## 3 · La forma que gana: una SEGUNDA FUENTE que sólo crece

No cabía en `_suelo-contra-main.mjs` tal cual —aquél compara una medición en **dos árboles**, y
aquí la población no está en ningún árbol—, pero **su principio sí**: derivar de `main`, **porque
main sólo crece**.

Una rama borrada desaparece de `ls-remote`, **pero su nombre queda escrito para siempre en el
asunto del commit de merge que la trajo**. Eso ya estaba escrito en la casa: `docs/equipo/sesion-0.md`
lo dice —*«una rama mergeada y borrada solo sobrevive en el mensaje del merge»*— y el propio
`_rastro-del-ticket.mjs` declaraba el hueco al pie. Era la excepción; la automatización la volvió
el caso normal.

**Medido el 8-sep-2026:**

```
merges en main            : 1660
ramas recuperadas         : 1009   (60,8 %)
refs vivas                :  105
poblacion total           : 1113 · enMain 1022 · vivas 91 · indeterminadas 0
tickets                   :  691 · con TODAS sus ramas mergeadas 622 (90,0 %)
```

Se clasifican `en-main` **por construcción** y no preguntándole a `alcanzabilidadDe`: ese
clasificador va a granel **por refname**, así que a una rama que ya no existe le contesta `null`
—indeterminada— y sería falso. Comprobado con `git merge-base --is-ancestor`: el commit que las
trajo **es** un commit de la principal. Y el árbitro del propio SCRUM-804, que compara clase a
clase contra `merge-base`, pasa en verde con las 1.113.

## 4 · Los dos números que quedaban, cambiados de magnitud

Ninguno se sube ni se borra: **dejan de medir tamaño y pasan a medir si el instrumento ve.**

| antes | ahora | por qué no caduca |
| --- | --- | --- |
| `total > 100` («había 558») | ramas recuperadas / merges ≥ **20 %** (medido 60,8 %) | una razón es independiente de la escala, y main sólo crece |
| `soloMergeadas > 10` («había 464») | sobre los tickets del censo ≥ **25 %** (medido 90,0 %) | ídem, y caza el fallo contrario: un clasificador que conteste «viva» a todo lo deja en cero |

La razón nueva vigila **el modo de fallo que la automatización puso encima de la mesa**: que el
lector de asuntos de merge se quede mudo —otro texto de GitHub, o squash en vez de merge— y los
tickets entregados vuelvan a salir `SIN RASTRO`.

## 5 · El control positivo que el ticket exige, corrido

`tests/scrum830-la-rama-que-ya-no-esta.test.mjs`, con banco de juguete para provocar lo que en el
árbol real no se puede provocar:

```
✔ SUELO · sobre el árbol REAL recupera ramas, y las dos fuentes NO se solapan
✔ una rama mergeada y BORRADA se recupera, y su sha ES ancestro (comprobado con merge-base)
✔ lee las DOS formas de asunto, y NO se inventa una rama del merge que no la nombra
✔ una rama VIVA no la toca esta fuente — si no, entraría como `en-main` teniendo trabajo encima
✔ 🔴 si el lector se queda MUDO, la proporción lo dice (tres merges sin nombre → razón 0)
✔ ✅ y con asuntos normales NO habla: un suelo que salta siempre se desactiva
```

**Y el rojo con el mecanismo viejo**, apagando la segunda fuente en su único punto: caen **los 4
del 804 y 5 del 830**, y siguen verdes los que no dependen de ella. Discrimina.

## 6 · Tres guards ajenos, y uno destapó algo

- **SCRUM-723 ①** me cazó comparando contra una referencia móvil. Tenía razón y **cambié el
  código, no el guard**: se mide contra la base de la rama. De paso, `baseDeLaRama` devuelve un
  **objeto** `{ sha, ref }` y pasárselo entero a `git log` hacía que el lector devolviera un mapa
  vacío **sin quejarse** — un cero con pinta de dato. Lo cazó mi propio suelo.
- **SCRUM-723 ②** · 📌 **el hallazgo**: `scripts/_rastro-del-ticket.mjs` ya nombraba la referencia
  móvil **antes** de que yo lo tocara y **no estaba declarado**. No se veía porque ese test tiene
  **dos aserciones y `assert` para en la primera**: mientras la de arriba estuvo roja, la lista de
  abajo llevaba desactualizada sin que nadie lo supiera. Declarado ahora, con esa nota dentro.

## 7 · Lo que NO se ha tocado

`_censo-alcanzabilidad.mjs` y `_censo-reparto.mjs` —congelados por sus guards— no se tocan: la
segunda fuente es **aditiva** y se les entrega en su formato de entrada. No se ha rebajado ningún
umbral, no se ha retirado ninguna comprobación y no se ha tocado `prisma/schema.prisma`.
