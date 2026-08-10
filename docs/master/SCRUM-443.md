# SCRUM-443 · el toast de error se puede leer entero, y se puede quitar

**Medido contra:** `origin/main` = `64df19c2dfe9694a96bd264c3c4e2e3ad77b0855` · 2026-08-10T19:48:22+02:00

**10-ago-2026** · sesión 1 · **UI vanilla (regla 4)** · sin gate, corre en `npm test`

Un profesional recibe un error, empieza a leerlo y **el mensaje desaparece por la mitad**. No puede
recuperarlo ni pararlo. Se queda sabiendo que algo falló y sin saber qué.

## PASO 0

### Lo medido en SCRUM-405 y que no se repite

Errores a **5.000 ms fijos** · el mensaje de error más largo del producto son **136 caracteres
≈ 7,5 s de lectura** · `showToast` **no registraba listener, no pintaba cierre y no tenía
`cursor:pointer`** · `border-radius: 999px`, pensado para una línea.

### Lo que faltaba medir — el censo de toasts, ENUMERADO

| tipo | cuántos | más largo | mediana |
|---|---|---|---|
| **error** | 12 | **136 car (~7,5 s)** | 33 car |
| ok | 30 | 56 car (~3,1 s) | 30 car |
| warn | 3 | 86 car (~4,7 s) | 65 car |

45 con literal medible + **6 por constante** (los cuatro de `mensajeDescargaFallida`, de 101 y 109
car tras SCRUM-405, y `OB_MSG_CATALOGO_FALLO`). El censo declara los seis en vez de dar 45 como si
fueran todos.

**La duración sale de aquí, no de un número que suene bien.** Y no acaba siendo fija: se deriva de
la longitud de cada mensaje (abajo).

### Dónde se pinta y qué tapa

`position: fixed; bottom: 90px; left: 50%`, `z-index: 400`, `max-width: min(92vw, 480px)`. La barra
de navegación inferior de móvil (`.sidebar-nav-bottom`) vive en `bottom: 0` con ~56 px de alto, así
que **el toast queda por encima de ella y no la tapa**. Lo que tapa es contenido de la página a esa
altura — y ése es justo el motivo de que alargarlo exija poder cerrarlo.

### ¿Existe ya un patrón de cierre en la casa? **Sí, y se reutiliza**

`.modal-close` con `&times;`, en **seis** componentes (`aiQuoteAssistant`, `csvImport`,
`customersView`, `expensesView`, `homeView`…). No se inventa un segundo botón de cerrar con otra
pinta y otro tamaño.

## Las tres cosas

### ① Duración derivada de la longitud

`TOAST_MS_BASE (1500) + largo × TOAST_MS_POR_CARACTER (60)`, con **suelo en los 5.000 ms que ya
había** —esto sólo puede alargar— y tope en 15.000.

`MS_POR_CARACTER` sale de la velocidad de lectura (~3,3 palabras/s a ~5,5 car/palabra ≈ 18 car/s
≈ 55 ms/car), redondeada al alza. `MS_BASE` es el tiempo de darse cuenta de que ha aparecido algo
antes de empezar a leerlo.

**Los avisos de ÉXITO no se tocan: 3.000 ms exactos**, con test propio. Un «guardado» quiere irse
rápido, y es lo que más fácil se rompe al tocar esto.

### 🔴 Y el tope destapó que yo había reconstruido el defecto

El primer intento recortaba a 15 s. Con un mensaje de 300 caracteres —que necesita ~16,7 s— **el
tope cortaba por debajo de lo legible**: o sea, el mismo defecto original un escalón más arriba. Lo
cazó el propio guard de este ticket.

La salida no era subir el tope hasta que cupiera el mensaje más largo imaginable —un aviso de 25 s
tapando la pantalla es intrusivo—, sino: **si un aviso no cabe en el tope, lo que no puede hacer es
irse solo.** Devuelve `null` y se queda hasta que lo cierren. Ahora que los errores llevan botón,
quedarse es honesto. Con su guard: **lo que no se autocierra siempre tiene que poder cerrarse**, y
los `ok`/`warn` —que no llevan botón— nunca pueden devolver `null`.

### ② Cierre a mano

Botón `.modal-close` reutilizado, **sólo en los errores**: son los únicos que duran lo bastante como
para estorbar. Un «guardado» de 3 s con una aspa al lado es ruido.

### ③ La forma deja de asumir una línea

`border-radius` pasa a `14px` cuando el mensaje no cabe en una línea (>45 car), y sigue en `999px`
cuando sí. Con tres líneas, los extremos curvos se comen las esquinas del texto.

## Verificado en rojo — con la inyección comprobada EN DISCO

| inyección | lo que dijo |
|---|---|
| **bajar la duración** de error (volver al fijo) | *«HAY ERRORES QUE SE VAN ANTES DE PODER LEERSE: exportView.js — 136 car · se le dan 5000 ms y necesita ~7556 ms (le faltan 2556 ms)»*, con el texto entero |
| **un mensaje más largo** que el de calibración | *«ha aparecido un error de 210 caracteres y la calibración se hizo contra 136… este assert existe para que ese crecimiento no pase desapercibido, que es como se rompió la duración fija de 5 s»* |
| **arrastrar a los de éxito** | *«un aviso de ÉXITO ha cambiado de duración… son otra cosa y molestan si se quedan»* |
| **SUELO**: el escáner deja de ver toasts | *«el censo encontró 0 toasts… estaría dando un verde sobre casi ningún mensaje»* |

⚠️ El cuarto hubo que **rehacerlo**: el primer intento no llegó al disco por el escapado del shell y
el test salió VERDE. Un rojo que sale verde porque la mutación no se escribió es una prueba **no
ejecutada**, no una prueba superada. Se repitió con un script que verifica la escritura.

## El test que fija el MOTIVO y no el número

Un test que dijera «la duración es 10.000» se arregla con un `10000` y vuelve a romperse con el
siguiente mensaje largo — **que es exactamente cómo llegamos aquí**. Así que lo que se afirma es la
RELACIÓN: *todo mensaje de error tiene que caber en su propia duración*, recorriendo los mensajes
**reales** del árbol. Un mensaje nuevo entra solo en la comprobación. Y el guard de calibración
avisa si aparece uno más largo que los 136 contra los que se calibró.

## Microcopy — reutilizada, y PENDIENTE DE TU CONFIRMACIÓN

El cierre lleva `aria-label="Cerrar"`. **No es redacción nueva**: es el literal exacto que ya usan
`invoiceDetailView.js:663`, `jobDetailView.js:2016` y `settingsView.js:1273` con este mismo patrón.
Reutilizar no es inventar (regla 30), y es el mismo criterio que aceptó SCRUM-427 al reutilizar la
microcopy de Presupuestos.

⚠️ Se pidió marcador. **No se ha puesto, y el motivo es que aquí sería peor que en ningún otro
sitio**: un lector de pantalla leería en voz alta «PENDIENTE microcopy oficial» a alguien que sólo
quiere cerrar un aviso. Si prefieres otra palabra, es una línea — pero un marcador ahí hace daño.

## Lo que NO toca

**Ningún texto de ningún mensaje** — esta tarea cambia el contenedor, jamás el contenido; tampoco
los dos aprobados hoy en `api.js`. Ni `prisma/schema.prisma`, ni el camino de emisión, ni el CSS
compartido (`.modal-close` se reutiliza tal cual, con los ajustes de tamaño y color **inline** para
que se vea sobre el rojo del toast sin tocar la clase de nadie).

## Ficheros

* `public/dashboard/js/api.js` — `duracionToast`, el botón de cierre y la forma.
* `tests/scrum443-toast-legible.test.mjs` (nuevo, 11 tests, sin gate).
