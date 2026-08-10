# SCRUM-433 · La dirección contraria: vistas del dispatch a las que no llega nada

**Medido contra:** `origin/main` = `a906b7a0a6119e6a1d3280ead67c18c3e5a2c5c5` · 2026-08-10T18:07:59+02:00
**Rama:** `scrum-433-dispatch-sin-camino`

**10-ago-2026, 18:12 CEST (UTC+0200)** · commit `81bd821a04ee4c0a356c933987a43428180b33ce`

> **Sobre el número:** SCRUM-433 midió `operarios` y decidió que es un alias deliberado. Su texto
> dice que *«la excepción lleva este número de ticket al lado»*, y **no tenía entrada de registro**.
> Este guard es lo que hace permanente esa decisión, así que la entrada va aquí en vez de inventar
> un número nuevo que podría colisionar. Si prefieres ticket propio, se renombra.

## Lo que faltaba

SCRUM-420 dejó **la ida**: cada entrada de la barra lleva a una pantalla que existe. Falta **la
vuelta**, que es la que se rompe en silencio: **una pantalla que existe y a la que no lleva nada**.

> Un botón roto se ve. Una pantalla a la que no llega nadie **no se ve nunca**: solo la encuentra
> quien lee el código, y por eso puede pasar meses ahí.

## La lista contra la que se mide, que es la mitad del trabajo

**No es `HASH_VIEWS`.** Ésa es la lista de vistas navegables por hash. El registro real es el
`switch` de `renderView`, y tiene casos que no están en ella. Un guard contra `HASH_VIEWS` mediría
la lista equivocada y **nacería verde con el hueco dentro** — la forma más cara de fallar, porque
parece que vigila.

## 🔴 Medido antes de escribir la regla, y cambia el diseño

Con la lectura literal —«todo `case` necesita entrada en la barra»— habrían salido **seis falsos
positivos**:

| vista | en la barra | quién la abre |
|---|---|---|
| `quotes-detail` | NO | 7 ficheros, con `renderAppView` |
| `jobs-detail` | NO | 6 ficheros |
| `invoice-detail` | NO | 6 ficheros |
| `albaran-detail` | NO | 3 ficheros |
| `customer-360` | NO | 2 ficheros |
| `export` | NO | `settingsView.js` |
| **`operarios`** | NO | **nadie — y está bien: es un alias** |

Las pantallas de **detalle** no están ni pueden estar en la barra: se abren desde su lista. **Un
guard que grita seis veces sin motivo se silencia entero, y entonces no vigila el séptimo.**

## Los tres caminos — derivados, ninguno declarado a mano

1. **entrada en la barra** (`data-view="x"`);
2. **alguien la abre** con `renderAppView('x', …)`;
3. **es un alias puro**: un `case` cuyo único cuerpo es `return renderView('otra', …)`.

`operarios` cae por el tercero **solo por su forma**. Marcarlo habría sido **acusar a la decisión de
SCRUM-136**, que lo mantiene como redirección viva porque hay enlaces y marcadores apuntando ahí.

*(Estar en `HASH_VIEWS` **no** cuenta como camino: es alcanzable escribiendo la URL, y eso no es
cómo un profesional encuentra una pantalla. Hoy no cambia nada —`export` la abre `settingsView.js`—
pero queda escrito para que no se herede por accidente.)*

## Por qué NO reutilizo `_bloque-estructural.mjs`, que es mío y de hace una hora

Aquel módulo extrae **un** bloque desde un ancla. Aquí hace falta **enumerar todas las cláusulas de
un `switch` y mirar dentro de cada cuerpo**: recorrer un árbol, no recortar un trozo. Forzarlo habría
reintroducido la misma familia de defecto por la puerta de atrás — **el `case` 24 se sale de
cualquier ventana**. El AST no tiene ventana, así que no puede mirar de menos (SCRUM-435) ni de más
(SCRUM-437).

## Verificación

| | |
|---|---|
| **mecanismo** | un `case` real sin entrada → cae **nombrando** la vista: `HAY VISTAS A LAS QUE NO LLEGA NADA: panel-secreto` |
| **control negativo (a)** | el **mismo** `case` escrito como alias puro → **no** cae |
| **control negativo (b)** | las vistas reales con entrada tampoco caen |
| **suelo** | sin localizar el `switch` → `ESCÁNER CIEGO` |

## El cruce con SCRUM-432, probado y no prometido

El núcleo es **puro**, así que se simula sacar `Plantillas` de la barra:

- **con** la pestaña que la abre → **verde**: no estorbo a la sesión 3;
- **sin** la pestaña → **rojo nombrando `templates`**, que es exactamente el control positivo que
  SCRUM-432 pide para sí mismo.

Y el guard **no menciona secciones ni cuenta entradas**, así que la reorganización no lo mueve.

## Dos correcciones mías por el camino

- **Mi primer test del cruce era TEXTUAL y se cazó a sí mismo:** marcaba `statements.length === 1`,
  que es la detección legítima del alias. Atado al texto otra vez — en el mismo turno en que arreglé
  cuatro por eso. Sustituido por uno de **comportamiento**.
- **SCRUM-237:** mi negación sobre `operarios` no tenía respaldo, y el primer hermano que puse no
  valía porque usaba `.some(===)` cuando el analizador reconoce `includes`/`match`. Corregida la
  forma sin cambiar lo que afirma.

## Lo que NO toca

El orden ni los rótulos de la barra · el guard de la ida (SCRUM-420) · `prisma/schema.prisma` · el
camino de emisión.

Ficheros: `tests/_censo-vistas-dispatch.mjs` (nuevo) · `tests/scrum433-dispatch-sin-camino.test.mjs`
(nuevo).
