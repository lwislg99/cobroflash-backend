# SCRUM-435 · El trinquete cortaba por longitud y llevaba días sin poder saltar

**Medido contra:** `origin/main` = `765062333bf017e98210f75aa4e26cdf5b0c1ab0` · 2026-08-10T17:30:50+02:00
**Rama:** `scrum-435-trinquete-muerto`

**10-ago-2026, 17:30 CEST (UTC+0200)** · commit `760276be2cf695cacc958c80492b53a75cd99caf`

## El defecto, con los números

El guard de SCRUM-403 hacía `schema.slice(i, i + 1200)` para comprobar si `Expense` había ganado sus
columnas de IVA.

| | |
|---|---|
| tamaño real de `model Expense` | **3.475** caracteres |
| ventana del detector | **1.200** |
| offset de `baseAmount` | **1.417** |
| offset de `vatRate` / `vatAmount` / `vatDeducible` | 1.681 / 1.871 / 2.108 |

**La ventana terminaba 217 caracteres antes de poder ver la primera columna que vigilaba.** El rojo
era imposible **desde el día uno**: las cuatro entraron el 10-ago y el trinquete siguió verde,
afirmando «`Expense` sigue sin dato» sobre un mundo que ya había cambiado.

> Un número fijo es **una apuesta sobre cuánto va a crecer un fichero que editan otros**, y esa
> apuesta se pierde sola: basta un comentario nuevo arriba para empujar lo vigilado fuera de la
> ventana. Es la llave que cierra sin candado.

## El arreglo

El bloque se corta por su **estructura** —`model X { … }`, contando llaves— y si no se localiza, el
guard **se declara ciego** en vez de devolver medio bloque. Que es exactamente el defecto que este
ticket persigue: un escáner que no encuentra lo que vigila y calla.

## 🔴 El aviso NO se retira sin más, y ésta es la parte que importa

El encargo decía «retira el aviso si tu propio rojo demuestra que ya no es cierto». **Mi rojo
demuestra la mitad.** Medido:

- **Las columnas están.** Las cuatro.
- **Pero tener la columna no es tener el dato.** Son `nullable`, sin `@default`, y el propio schema
  declara que **no hay backfill** — deducir la base de `amount` exige saber si lleva IVA y a qué
  tipo, y eso no está escrito en ninguna parte. Todo gasto anterior a hoy tiene `baseAmount = null`.
- **Y `reports.routes.ts:77` sigue sumando `Number(exp.amount)`**, el total con IVA.

**El hueco de SCRUM-403 sigue abierto. Lo que cambia es el MOTIVO:** ya no es «faltan las columnas»,
es «no hay datos y nadie las usa». Retirarlo habría sido cambiar un aviso falso por un silencio
falso.

Así que el test se reescribe para decir **lo que es cierto hoy**, y **el trinquete se mueve a donde
ahora vale**: salta el día que Informes empiece a usar la base — que es cuando de verdad toca
retirar la declaración y escribir el vector del lado del gasto.

*(Nota medida: SCRUM-403 **no llegó a pintar ningún aviso en la pantalla**. Su módulo se retiró por
los guards de SCRUM-389 y SCRUM-411, así que el «aviso de Informes» vivía solo dentro del test. No
hay microcopy que cambiar; si algún día la hay, se propone (regla 30).)*

## Verificación — los cuatro casos

| | caso | resultado |
|---|---|---|
| ① | **mecanismo**: `Expense` hoy, corte estructural | **salta**, nombrando `baseAmount, vatRate, vatAmount, vatDeducible` |
| ② | **control negativo**: `Provider`, sin esas columnas | **no salta** — cero falsos positivos |
| ③ | la **ventana vieja** sobre el mismo `Expense` de hoy | veía **0**. Imposible |
| ④ | **suelo**: modelo inexistente | `null` → se declara ciego |

Y tres rojos por `$?` sobre el test que se entrega: Informes usando la base —su mensaje **nombra las
columnas encontradas y qué hay que retirar**— · el escáner sin localizar el modelo · y el suelo que
demuestra que 1.200 era ciego (si el modelo encogiera, **avisa** en vez de pasar por inercia).

## El censo que cierra el ticket — otros cortes por número fijo

**Se listan, no se arreglan** (regla 9). Escaneados **404** ficheros de test, recorriendo paréntesis
anidados — la primera versión del censo **no encontraba el caso que originó este ticket**, y un
censo que no se ve a sí mismo no vale.

**A · Ventana sobre CÓDIGO FUENTE — el riesgo real** (lo que se corta es lo que luego se afirma):

| fichero | corte |
|---|---|
| `tests/scrum153d-ui-anular.test.mjs:79` | `slice(indexOf('zona-anular') - 400, … + 200)` |
| `tests/scrum153d-ui-anular.test.mjs:133` | `slice(indexOf('const puedeAnular'), … + 260)` |
| `tests/scrum296-pantalla-libro.test.mjs:279` | `slice(indexOf("case 'libro-registro':"), … + 500)` |
| `tests/scrum298-modo-visible.test.mjs:107` | `slice(indexOf('window.appModoEmision'), … + 22)` |
| ~~`tests/scrum403-beneficio-sin-iva.test.mjs:188`~~ | **arreglado aquí** |

**B · Truncado de mensaje de error — inofensivo:** 18 casos. Cortan el texto que se imprime, no lo
que se afirma. La distinción importa: tratarlos igual llenaría el ticket de ruido.

## Lo que NO toca

`prisma/schema.prisma` · el camino de emisión · **el cálculo de beneficio de SCRUM-403**, que está
entregado y correcto en su mitad · **la mitad no cableada** (el libro filtra por `createdAt` e
Informes por `paidAt`: dos poblaciones, necesita otro GO).

Ficheros: `tests/scrum403-beneficio-sin-iva.test.mjs`.
