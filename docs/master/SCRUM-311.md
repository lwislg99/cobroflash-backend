# SCRUM-311 · La red de SCRUM-271, DERIVADA

**Fecha:** 4-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `eebc191dc75da0040f4934ccd8b92cc857726832` · 2026-08-04T16:03:42+01:00
**Tanda:** 1305 tests, 1238 pass, 0 fail, 67 skipped (`npm test` con exit **0**)
**Ficheros:** `tests/_censo-cantidad-inventada.mjs`, `tests/scrum311-cantidad-inventada-derivada.test.mjs` (9)

> **NO revierte SCRUM-271.** Lo que 271 arregló está bien. Esto **amplía su red**.

## El defecto era del guard, no del arreglo

El guard de 271 leía **dos rutas escritas a mano** (`homeView.js`, `jobDetailView.js`) — justo los
dos ficheros que 271 ya había arreglado. Su propia cabecera nombraba tres sitios más que nunca
cubrió (`expensesView`, `productsView` ×2), y `quotesView.js` tenía el patrón sin vigilancia.

**Un guard que enumera solo protege lo que ya está protegido.** Aparentaba cobertura porque su
ticket estaba Finalizada.

## Qué separa el patrón peligroso del legítimo

`<input type="number">` devuelve **cadena vacía** cuando el navegador rechaza la entrada.
`Number("")` es `0`, y `0 || 1` da **1** en silencio.

**PELIGROSO** = leer un `.value` y caer a un literal numérico **distinto de cero**.

**LEGÍTIMO** — tres familias, las 36 medidas en `quotesView.js`:

| Familia | Nº | Por qué es correcta |
|---|---|---|
| `\|\| ""` | 30 | `parseFloat("")` es `NaN` y se trata aparte con `Number.isFinite`. No inventa: se entera |
| `\|\| 0` · `\|\| "0"` | 3 | Cero significa cero: ausencia representada como ausencia |
| `\|\| "21"` | 3 | Lee el **IVA por defecto** del merchant. Caer a él **restaura lo configurado**, no inventa |

La tercera no se separa por la **forma** del literal —21 es no-cero, como el 1 peligroso— sino por
el **sujeto**: una lectura de un campo `*Default*` es un ajuste, no una entrada de línea.

**⚠️ Límite declarado:** ese discriminador se apoya en el **nombre**, no en la estructura. Es el
punto débil y va escrito en el código: un campo de defectos que no se llamara `*Default*` sería
falso positivo, y uno peligroso que sí se llamara así se escaparía. No hay discriminador
estructural sin análisis de flujo de datos, que sería más código que lo vigilado.

## 🔴 El control positivo cazó un fallo mío, y era el peor posible

La primera versión exigía que el lado izquierdo del `||` fuese un `.value` **directo**. Con eso,
el defecto **original** de 271 —`Number(l.qtyInput.value) || 1`, donde el izquierdo es una
**llamada**— **no caía**.

O sea: derivar habría **empeorado** la red que venía a ampliar. Lo cazó el control positivo que el
ticket exigía, no yo. Corregido: se mira el **subárbol**, porque la envoltura (`Number`,
`parseFloat`, `parseInt`, `String`) es justamente lo que convierte `""` en `0` y dispara el `|| 1`.

## Los sitios que la cabecera de 271 nombró y nunca cubrió: cerrados

| Fichero | Lecturas `.value` vigiladas | Hallazgos |
|---|---|---|
| `expensesView` | 13 | 0 |
| `productsView` | 32 | 0 |
| `homeView` | 21 | 0 |
| `jobDetailView` | 32 | 0 |
| `quotesView` | 92 | 1 (excepción explicada) |

**Ninguno tenía el patrón vivo.** No hay hallazgo nuevo que reportar: la cabecera de 271 los
nombraba como sitios con lecturas de input, no como defectos.

## La única excepción, EXPLICADA y con su ticket

`quotesView.js:2585` — `qtyInput.value || '1'`. **No se arregla ni se silencia:** tiene decisión del
fundador pendiente (¿puede una plantilla inventar cantidad 1?). Los tres atenuantes medidos van
escritos junto a la excepción para que nadie tenga que volver a medirlos.

Y hay un test que exige que **toda excepción viva lleve motivo, cite su ticket y siga
correspondiendo a algo**: si el sitio se arregla, la excepción debe borrarse con él. La excepción
es por **ruta + línea**, no por fichero: si el patrón reaparece en otra línea del mismo fichero, el
censo lo caza igual.

## Suelos y negativos

**Suelos:** ≥20 ficheros recorridos y ≥200 lecturas de `.value` vistas. Si cualquiera cae a cero, el
guard está ciego y lo dice — que es el defecto que este ticket cierra.

**Negativos:** las tres familias legítimas no caen, ni una a una ni sobre el fichero real de
`quotesView.js` con sus 36 usos. Un guard que las tumbe vive en rojo y alguien lo desactiva.

## Alcance del censo, declarado

Se recorre `public/dashboard/js/` — el front del pro, donde viven los formularios que producen
importes. La landing (`public/*.html`) no tiene formularios de líneas y `src/` es servidor (sin
`<input>`): quedan fuera, y queda **dicho** en vez de omitido en silencio.
