# SCRUM-437 · Los cuatro cortes por longitud del censo, acotados por estructura

**Medido contra:** `origin/main` = `4cc5e0451e7e5706acaf6e1acd9b5aed6065f523` · 2026-08-10T17:48:16+02:00
**Rama:** `scrum-437-ventanas-fijas`

**10-ago-2026, 17:48 CEST (UTC+0200)** · commit `946fabfdcb138814693fb2f66e8193e5358c85d4`

Sale del censo de SCRUM-435. Se arreglan **los cuatro de la familia A** — ventana sobre código
fuente. **Los 18 de la familia B no se tocan**: cortan lo que se imprime, no lo que se afirma.

## 1 · Veredicto de cada uno, con números

| guard | bloque real | ventana fija | lo vigilado | ¿dentro? | margen |
|---|---:|---:|---|---|---:|
| `scrum153d…:79` | **931** | 600 `[-400,+200)` | `detail-section` en **+95** | sí | **91** |
| `scrum153d…:133` | **114** | 260 | `pending` +52 · `R1` +28 · `J-` +82 | sí | 146 |
| `scrum296…:279` | **412** | 500 | `LIBRO_COPY` en **+236** | sí | 254 |
| `scrum298…:107` | **108** | 220 | `": null"` en **+101** | sí | 113 |

**Ninguno estaba ciego por truncamiento hoy.** Pero el de SCRUM-403 tampoco lo estaba el día uno:
se quedó ciego **cuando el modelo creció**. El margen más estrecho eran **91 caracteres** — un
comentario de tres líneas.

*(Corrección a mi propio censo de SCRUM-435: el de 298 es `+ 220`, no `+22`. Mi salida truncaba a 84
caracteres y lo mostró cortado. Se dice porque el número era el argumento del ticket.)*

## 2 · 🔴 Uno SÍ estaba ciego — y por el motivo contrario: miraba de MÁS

`scrum153d…:79` hacía `slice(i - 400, i + 200)`: **cuatrocientos caracteres ANTES del ancla**. En ese
trozo previo hay un `detail-section` **de otra sección**, así que el assert pasaba con **prueba
ajena**.

**Medido:** quitando `detail-section` de dentro del bloque de la zona de anular, el guard **seguía
verde**.

> No estaba ciego por truncamiento, como el de SCRUM-435. Estaba ciego **por abarcar al vecino**:
> una ventana que incluye al de al lado demuestra lo del de al lado.

**Desde cuándo:** `122c649`, **28-jul-2026** («SCRUM-153 (c): la UI de anular, separada de R1 a
proposito»). **Trece días** sin verificar lo que decía verificar.

**Qué pasó por delante mientras dormía: nada.** Comprobado — la zona de anular **sí** usa
`detail-section` hoy (offset 95 de su bloque de 931). El requisito se cumple; lo que no existía era
la verificación. **Se dice igual: «no pasó nada» solo se sabe mirando.** No genera hallazgos que
reportar.

## 3 · El arreglo

Un solo extractor compartido, `tests/_bloque-estructural.mjs`: `bloqueDeLlaves` · `sentencia` ·
`ramaDeCase` · `desdeLaSeccionAnterior`. Vive aparte por lo mismo que el códec de backup de
SCRUM-242: **dos guards que hacen la misma derivación en dos sitios acaban divergiendo**, y el día
que diverjan uno estará mintiendo sin que nadie lo note.

Todas devuelven `null` cuando no localizan el bloque, y **`null` es un dato**: quien llama se declara
ciego en vez de seguir afirmando sobre un trozo cualquiera.

## 4 · Verificación — tres por guard

| guard | mecanismo (cae) | control negativo (no cae) |
|---|---|---|
| 153d:79 | la zona deja de usar `detail-section` | **300 caracteres insertados ANTES del ancla** — justo lo que la ventana vieja no sabía distinguir |
| 153d:133 | se ofrece anular sobre una **rectificativa** | sin tocar nada |
| 296:279 | el título **escrito a mano** en `app.js` | sin tocar nada |
| 298:107 | un modo desconocido cae **a un modo**, no a `null` | sin tocar nada |

**Suelo:** con el extractor devolviendo `null`, los tres ficheros caen y `153d` saca sus **dos**
mensajes de «ESCÁNER CIEGO». Sería ridículo repetir aquí el defecto que perseguimos.

**Un rojo que no salió a la primera:** el de 296 se quedó verde porque la rama tiene **dos**
`LIBRO_COPY` y mi inyección cambió una. **Caso mal elegido, no guard de sobra** — es la primera
hipótesis de la casa y esta vez acertó. Repetido escribiendo el título a mano de verdad: cae.

## 5 · La familia B, intacta

El diff lo demuestra: desaparecen **4** líneas con `.slice(` y **no se añade ninguna**. Los 18
truncados de mensaje siguen exactamente igual.

## Lo que NO toca

`prisma/schema.prisma` · el camino de emisión · el trinquete de SCRUM-435, ya entregado.

Ficheros: `tests/_bloque-estructural.mjs` (nuevo) · `tests/scrum153d-ui-anular.test.mjs` ·
`tests/scrum296-pantalla-libro.test.mjs` · `tests/scrum298-modo-visible.test.mjs`.
