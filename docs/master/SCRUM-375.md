# SCRUM-375 · Un fallo de LECTURA se presentaba como un fallo de ESCRITURA

**Fecha:** 5-ago-2026 · **Carril:** A (camino de dinero) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `5843684c98e8f8a1b1cef1c3334fc4a094f84d19` · 2026-08-05T23:2x+01:00

**Tanda:** 1805 tests, 1738 pass, 0 fail, 67 skipped

## El defecto

El `catch` del marcado en bloque de facturas envolvía **también** al `await reload()` que iba
DESPUÉS del POST. Si la escritura salía bien y fallaba la recarga, la pantalla decía **«No se han
podido marcar como pagadas» cuando sí se marcaron**.

Es camino de dinero, y el daño va en las dos direcciones: el profesional vuelve a pulsar sobre
facturas que ya están pagadas, o se va creyendo que no ha cobrado.

## El arreglo, y por qué está donde está

`reload()` sale del `try` del POST. A partir de que la escritura ocurre, **el mensaje tiene que
decir que se marcaron, pase lo que pase con la recarga** — y la recarga rota tiene su propio aviso,
en tono `warning`, diciendo que la lista puede estar vieja.

Los tres desenlaces los decide `resultadoMarcadoEnBloque`, **puro y exportado**, y eso no es
decoración: el fallo de este ticket **no se ve leyendo la pantalla**, se ve preguntando «¿qué dice
cuando la escritura fue bien y la recarga no?». Dentro del listener esa combinación no se puede
provocar sin un navegador; en una función pura sí, y el test la provoca.

| Escritura | Recarga | Tono | Qué dice |
| --- | --- | --- | --- |
| falla | — | `error` | «No se han podido marcar como pagadas…» (texto FIRMADO en SCRUM-373) |
| va | falla | `warning` | se marcaron, pero la lista puede estar vieja (**microcopy nueva, con marcador**) |
| va | va | `success` | «✓ N facturas marcadas como pagadas.» |

Un `.alert` sin tono está **oculto** por CSS (`styles.css:1667`), así que el tono tampoco es
decoración — es la lección de SCRUM-303/350 aplicada aquí.

De paso, el recuento pasa a resolver **singular y plural de verdad** (`1 factura marcada` /
`3 facturas marcadas`), sin `(s)`.

## Verificado en rojo

Seis sabotajes, revertidos byte a byte:

| Se quita la cosa vigilada | Sale rojo |
| --- | --- |
| **El `reload()` vuelve dentro del `try` de la escritura** | ③ el guard AST del `try` |
| **Con la recarga rota se dice que el marcado falló** | ① el que decide, y ② |
| El fallo de escritura deja de decirse | ② el simétrico |
| Dos desenlaces dicen lo mismo | ② (la pantalla dejaría de informar) |
| Vuelve el `(s)` al recuento | el del plural |
| La microcopy nueva pierde su marcador | el de regla 30 |

El primero y el segundo son las dos mitades del defecto: uno es la **forma** (el `reload()` dentro
del `try`) y otro el **efecto** (el mensaje que miente). Cada uno tiene su rojo porque arreglar solo
la forma dejaría el mensaje a merced del siguiente que reordene el bloque.

## 🔴 El censo que pedía el ticket: el patrón está en 5 sitios más, pero NO es el mismo defecto

Buscados por AST todos los `try` que contienen una escritura (`POST/PUT/PATCH/DELETE`) **y** una
recarga:

| Fichero:línea | Qué hace |
| --- | --- |
| `albaranDetailView.js:136` · `:171` · `:202` · `:214` · `:238` | `await apiRequest(POST…)` y después `recargar()` dentro del mismo `try` |

**Parecen el mismo caso y no lo son**, y la diferencia estaba en una palabra: allí `recargar()` **no
lleva `await`** (`albaranDetailView.js:104`: `const recargar = () => renderAlbaranDetailView(...)`,
que es `async`). Como no se espera, **su rechazo NO entra en ese `catch`**: se convierte en una
promesa rechazada sin gestionar.

Así que el desenlace es distinto:

* **Aquí (arreglado):** la recarga falla → la pantalla decía que **la escritura** falló. *Mensaje
  engañoso.*
* **Allí (sin tocar):** la recarga falla → la pantalla no dice **nada**, se queda con el mensaje de
  éxito y la ficha desactualizada delante. *Silencio y datos viejos.*

Los dos son «el fallo de la lectura se cuenta mal», pero el arreglo no es el mismo, y en el segundo
hay que decidir además qué se le dice al profesional. **No se han tocado**: el ticket pedía contarlos
y contarlos es lo que se ha hecho.

## Lo que NO cubre

* **No hay prueba en navegador.** El decisor se prueba puro; que el listener lo llame bien se
  comprueba por AST (el `reload()` fuera del `try`). Falta el paso por un DOM real.
* **La microcopy del aviso de recarga está sin firmar** y lleva su marcador.
* **Los cinco de `albaranDetailView.js` siguen igual**, por decisión del asesor.

## Ficheros

* `public/dashboard/js/invoicesView.js` — el decisor puro, la copy y el `reload()` fuera del `try`.
* `tests/scrum375-recarga-no-es-escritura.test.mjs` — **nuevo**, 5 tests.
* `tests/scrum373-avisos-facturas.test.mjs` — su lector ahora resuelve la constante, sin perder el
  atado a la ranura (el intercambio sigue saliendo rojo, comprobado).
