# SCRUM-1278 · El banco de vistas dice cuándo una vista acabó en su pantalla de error, y el clic sube

**Medido contra:** `origin/main` = `82cb31c81e3fa7357819af7370a4fcf53bff6682` · 2026-09-29T16:04:16Z

Carril S3 (bancos). Sesiones s3-29b (WIP) y s3-29c (control positivo, registro, fuera de borrador).

## El defecto del instrumento

Al banco (`tests/_banco-vistas.mjs`) le faltaba `new Option`. `expensesView.js` reventaba dentro de
su `try`, el `catch` se tragaba el TypeError **sin `console.error`**, y la vista pintaba «No se han
podido cargar los gastos». `pintarVista` devolvía `error: null` y la consola vacía: cualquier censo
contaba los controles del cartel como si fueran la pantalla.

La cura no es solo añadir `Option`: mañana faltará otra API. Lo estructural es que el banco lo DIGA.

## Qué entra

| Pieza | Qué hace |
|---|---|
| `instrumentarCatch` | Al cargar cada script, cada `catch (x) {` y `.catch((x) => {` apunta su error (sitio, tipo, mensaje). |
| `pintarVista` → `atrapados`, `erroresDeEstaVista`, **`noMedida`** | `noMedida` salta si la vista se tragó un TypeError, ReferenceError, SyntaxError o RangeError, con su sitio. |
| `Option`, `replaceChildren`, `scrollIntoView` | Las tres APIs que faltaban (las dos primeras medidas en Gastos; la tercera, por S2 en el barrido de 1275). |
| `disparar` **sube** | `target` = lo pulsado, `currentTarget` va cambiando, `stopPropagation` corta, `focus`/`blur` no suben. Lo que DEVUELVE siguen siendo los oyentes PROPIOS (`scrum660`, `scrum915d` lo usan como «tiene oyente»). |
| `tests/scrum1278-banco-dice-no-medida.test.mjs` | ① control positivo: se QUITA `Option` y Gastos TIENE que salir con `noMedida` nombrando el TypeError · ② con `Option`, `noMedida: null` y sin cartel · ③ la subida del clic. |

## Verificado en rojo

| Mutante | Resultado |
|---|---|
| `noMedida` siempre falso | ① en rojo |
| `disparar` sin subir | ③ en rojo |
| Sin mutar | 3/3 verdes |

**Lo que antes no se podía:** sobre el `main` de hoy (con 1275 sin arreglar), montar Facturas con una
factura pendiente y pulsar la **celda** del número (`celda.disparar('click')`, sin tocar el oyente de
la fila) da `ReferenceError: cb is not defined`. Antes, el clic sintético no llegaba a la fila desde
dentro y el defecto no se reproducía en el banco.

⚠️ Premisa corregida: `e.target === cb` evalúa `cb` sea cual sea el target, así que también el clic
en la propia fila revienta. La subida es fiel de todos modos, pero no es «lo que escondía el `cb`».

## Lo que NO entra

Ningún censo usa `noMedida` todavía. Conectar `censo:tactil-panel` (y los de clics de 1179-C) es el
paso siguiente, en su propio ticket.
