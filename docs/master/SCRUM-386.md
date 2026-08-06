# SCRUM-386 · las hojas del albarán salen de `renderJobDetailView` — la última deuda de C2

**Fecha:** 6-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `4b4f30a6bcfb4ffd75694f781704865510336580` · 2026-08-06T12:57:30+02:00
**Tanda:** 1957 tests, 1890 pass, 0 fail, 67 skipped

> ⚠️ **ENTREGA PARCIAL, declarada.** Se mueven `openAlbEditorSheet` y su cadena.
> **`openFacturarParcialSheet` NO se mueve:** toca el camino del dinero y sacarla obliga a
> cambiar su firma, que es condición de parada de la regla 38. El diff está preparado y va con la
> pregunta al fundador.

## El defecto

Las dos hojas vivían ANIDADAS dentro de `renderJobDetailView`. Por eso la página del albarán
(SCRUM-302) no podía hacerlas: solo **navegar** hasta la fila del Trabajo, y la fila tenía que
conservar sus botones para no dejar callejones sin salida. C2 lo dejó escrito como deuda.

## La medición, ANTES de mover (AST, no grep)

Aquí es donde una mudanza se convierte en reescritura sin avisar: una función que capturaba cinco
cosas del ámbito y ahora recibe tres **no es la misma función**, aunque el diff parezca inocente.

| Función | Líneas | Captura del ámbito de la vista |
| --- | --- | --- |
| `openFacturarParcialSheet` | 121 | 2 — `setStatus`, `refresh` |
| `openAlbEditorSheet` | 45 | 1 — `buildAlbEditor` |
| `buildAlbEditor` | 339 | 4 — `cur`, `albTotalesJS`, `refresh`, `setStatus` |
| `albTotalesJS` | 10 | **0** — viaja sola |

**Hallazgo de alcance:** el ticket nombra dos funciones, pero `openAlbEditorSheet` no se puede
mover sin arrastrar `buildAlbEditor`, y **`buildAlbEditor` tiene DOS llamadores** — el segundo,
`openAlbCrearSheet`, no está en el ticket. Se queda anidado y solo pasa el contexto: adaptar una
llamada no es cambiar comportamiento.

## Cómo se garantiza que es mudanza y no reescritura

El contexto se recibe **desestructurado con los mismos nombres** (`const { cur, refresh, setStatus }
= ctx;`). Así el cuerpo no cambia ni un carácter, y eso se puede **comprobar comparando textos**
en vez de leyendo: las tres funciones movidas salieron IDÉNTICAS al original con la sangría
normalizada (10, 339 y 45 líneas).

## El guard mira el ÁMBITO, no el texto

Anidada y a nivel de módulo se escriben **igual salvo la sangría**, así que un guard de texto pasa
en verde en los dos casos. `tests/scrum386-hojas-fuera.test.mjs` usa un parser y comprueba **dos
cosas distintas que hacen falta las dos**:

1. que estén declaradas a nivel de módulo;
2. que **no capturen nada** del ámbito de la vista — se puede sacar una función y dejarla usando
   un nombre de fuera: entonces está «fuera» pero sigue **atada**, y llamarla desde otra pantalla
   revienta con un `ReferenceError`.

Más un SUELO: si el parser no ve al menos 8 funciones de módulo, falla — un guard que no encuentra
nada se lee igual que uno que pasa.

## Rojo por el mecanismo (por `$?`, uno a uno)

| Inyección | Resultado |
| --- | --- |
| `openAlbEditorSheet` vuelve DENTRO | exit 1 · «ha vuelto DENTRO de renderJobDetailView» |
| `buildAlbEditor` deja de recibir `cur` | exit 1 · «está fuera pero atada… ReferenceError» |
| «Editar líneas» deja de pasar el contexto | exit 1 · «esperaba DOS pasos de contexto y hay 1» |

**Y un guard mío nació malo:** el test de los llamadores buscaba la llamada entera con un regex
multilínea (`buildAlbEditor\(bodyEl,[^;]*?…`) y salía **roja con el código correcto**, porque
`[^;]*?` no puede cruzar los `;` del objeto de opciones. El fallo estaba en el instrumento, no en
lo medido — la misma clase de error que un `grep` apuntado a un fichero que no existe. Ahora se
cuentan los pasos de contexto, que es el hecho, y no la forma de escribirlos.

## Lo que NO hace, y no es olvido

No cablea la página del albarán para que las llame. **Qué botones quedan en la fila es decisión de
producto** y va en su ticket; aquí solo se garantiza que **ya se puede**. El guard lo declara en su
cabecera para que nadie lo dé por cubierto.
