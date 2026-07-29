# SCRUM-213 · Matriz de dispositivos AB6 — semáforo fiscal

> **La celda que faltaba.** SCRUM-210 midió a **390 px** y el CSS tiene su breakpoint en
> **480 px**: todo lo que vive por encima estaba sin mirar. Aquí se cubre.
>
> Ejecutado el **29-jul-2026** sobre `scrum-213-matriz-ab6` (apilada sobre
> `scrum-210-semaforo-front`). Solo front, cero backend.

## La regla que sale de aquí, y vale para toda captura futura

**Ninguna captura cuenta sola.** La primera de SCRUM-210 salió **vacía y con buena pinta**: las
rutas del banco estaban rotas, el JS no cargaba, el PNG pesaba **16 KB en vez de 73 KB**. Lo cazó
la consola, no la vista — *una captura sin contenido se lee igual que un diseño minimalista*.

Desde ahora **cada captura va con una comprobación que NO es mirarla**. Aquí son cuatro, y cada
una caza un fallo que la vista no distingue:

| Comprobación | Qué fallo caza que la vista no |
|---|---|
| **Peso del PNG** | El render vacío. 16 KB y 100 KB se parecen en miniatura; en bytes no. |
| **`ERRORES_JS`** | El módulo que no cargó. Un bloque ausente se ve como «diseño limpio». |
| **Recuento de elementos** (`BLOQUES_*`, `PIES_AMBAR`, `BOTONES`) | La pieza que falta en UN tamaño. Si un pie de ámbar desaparece a 768 px, en la captura larga no se nota. |
| **`ALTURA_MIN` y `DESBORDE_*`** | El target por debajo de 44 px y el corte lateral. Medir en píxeles, no estimar a ojo. |

## La matriz

Cada corrida imprime sus medidas **en la propia página** (`MEDIDA>>`, visible al pie de cada
captura): la evidencia y su comprobación son el mismo artefacto y no pueden desincronizarse.

| Dispositivo | Ancho | Captura | Peso | Comprobación no visual |
|---|---|---|---|---|
| **Android gama media** | 360 px | [android-360.png](android-360.png) | 102.010 B | `ERRORES_JS=0 · BLOQUES_ROJO=2 · BLOQUES_AMBAR=3 · PIES_AMBAR=3 · BOTONES=7 · ALTURA_MIN=44 · DESBORDE_HORIZONTAL_BLOQUES=0 · DESBORDE_HORIZONTAL_PAGINA=false · VERDE_DEVUELVE=null` |
| **iPhone** | 390 px | [iphone-390.png](iphone-390.png) | 100.994 B | `ERRORES_JS=0 · BLOQUES_ROJO=2 · BLOQUES_AMBAR=3 · PIES_AMBAR=3 · BOTONES=7 · ALTURA_MIN=44 · DESBORDE_HORIZONTAL_BLOQUES=0 · DESBORDE_HORIZONTAL_PAGINA=false · VERDE_DEVUELVE=null` |
| **Tablet** | 768 px | [tablet-768.png](tablet-768.png) | 103.746 B | `ERRORES_JS=0 · BLOQUES_ROJO=2 · BLOQUES_AMBAR=3 · PIES_AMBAR=3 · BOTONES=7 · ALTURA_MIN=44 · DESBORDE_HORIZONTAL_BLOQUES=0 · DESBORDE_HORIZONTAL_PAGINA=false · VERDE_DEVUELVE=null` |

**360 y 390 caen por debajo del breakpoint; 768 por encima.** Los tres números de bloques y
botones son IDÉNTICOS en los tres anchos: no se pierde ninguna pieza al cruzar la frontera, que
era justo el riesgo que este ticket venía a descartar.

## Los seis casos de cada captura

Los tres estados, más los dos estreses que pedía AB6:

1. 🔴 **ROJO · sin líneas** — botón deshabilitado + explicación siempre visible.
2. 🔴 **ROJO · meses distintos** — el rojo de texto más largo, y el único con acción propia.
3. 🟠 **ÁMBAR · plazo vencido + importe 9.999,99 €** — el importe grande va en el botón de la
   acción, que es donde aparece de verdad. **El componente del semáforo no tiene hueco para
   importes**, así que lo que se estresa es el layout donde vive, no el aviso.
4. 🟠 **ÁMBAR · plazo vencido con TEXTO LARGO** — `mesLabel` es la única variable del copy
   aprobado, así que el estrés se mete **por el hueco que el copy ya tiene**: no se inventa
   microcopy nuevo para probar (regla 30). A 360 px envuelve a 8 líneas sin cortar ni desbordar.
5. 🟠 **ÁMBAR · cliente sin NIF** — con su hueco `[PENDIENTE ASESOR]` sin pintar, como debe.
6. 🟢 **VERDE** — el botón y nada más. `VERDE_DEVUELVE=null` lo confirma sin depender de la vista.

## Lo que se ve al cruzar el breakpoint

- **≤ 480 px** — acciones en **columna**, a ancho completo. El pulgar no tiene que apuntar.
- **≥ 480 px** — acciones en **fila**, alineadas a la derecha, `min-width: 160px`. En las tres
  medidas `ALTURA_MIN=44`: el cambio de dirección no encoge el target.

**Una decisión deliberada, no un descuido:** en fila, el botón verde (la alternativa segura) queda
a la IZQUIERDA del secundario, cuando la convención occidental pone la acción principal a la
derecha. Se mantiene así porque **el orden del DOM manda sobre la convención**: invertirlo
visualmente dejaría el orden de foco y de lector de pantalla al revés que el orden visual
(WCAG 1.3.2 / 2.4.3). La jerarquía la comunica el color, que sí es coherente en los tres anchos.

## Lo que NO cubre esta matriz

Para que nadie la dé por más completa de lo que es:

- **No se han probado los otros ejes de AB6**: merchant sin logo, cliente sin WhatsApp, ni los
  estados empty/error/loading. El semáforo no tiene ninguno de esos hoy (no carga datos: el
  módulo es síncrono y sin red hasta que se cablee SCRUM-207), pero conviene decirlo en vez de
  dejar que se lea como cubierto.
- **No es un navegador real de Android ni un iPad**: es `chrome-headless-shell` al ancho CSS de
  esos dispositivos. Caza layout, desbordes y targets; no caza fuentes del sistema ni gestos.
- **Sin `prefers-reduced-motion`**: el componente no anima nada, así que no aplica.

## Cómo se reproduce

Banco de QA en el scratchpad de la sesión (`banco213.html`), cargando el **CSS y el JS reales**
de la rama — no una maqueta: si el banco tuviera su propia copia, podría salir verde mientras la
app está rota. Se rendiza con `chrome-headless-shell` a `--window-size=<ancho>,<alto>` y se
extraen las medidas con `--dump-dom | grep -oE 'ANCHO=[0-9][^<]*'`.

> ⚠️ El `grep` va anclado a `ANCHO=[0-9]` a propósito. Sin el dígito casa también **el código
> fuente del script** que hay en la misma página, y devuelve `ANCHO=' + window.innerWidth` — una
> medida que parece una medida y no lo es. Pasó al montar esta matriz.
