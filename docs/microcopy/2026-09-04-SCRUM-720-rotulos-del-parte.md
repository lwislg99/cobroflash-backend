# Los rótulos de la pantalla del parte de trabajo

**Aprobados por el fundador** el 4-sep-2026, en **SCRUM-720**.
**Aplicados en el mismo acto** (regla 30).

El fundador abrió la pantalla del parte en **producción** y salían **26** marcadores a la vista del
usuario. Éstos son los veintiuno que firmó.

## Textos aprobados, literales

| Texto aprobado | Dónde se pinta |
|---|---|
| Dirección de la obra | `public/dashboard/js/parteDetailView.js` |
| REF | ídem |
| Entrada | ídem |
| Salida | ídem |
| Desplazamiento | ídem |
| Kilómetros | ídem |
| Técnicos | ídem |
| Reparación / asistencia | ídem |
| Mantenimiento | ídem |
| Instalación | ídem |
| Dicta lo que has hecho | ídem |
| Usa el micrófono de tu teclado. Luego lo ordenamos. | ídem |
| Ordenar en líneas | ídem |
| Mano de obra | ídem |
| Materiales | ídem |
| UNDS | ídem |
| Añadir línea | ídem |
| Notas | ídem |
| Todavía no has apuntado nada. | ídem |
| Firmar aquí mismo | ídem |
| Quién ejecuta este trabajo | `public/dashboard/js/jobAsignados.js` |

## El mecanismo se VACÍA, no se retira

Las dos constantes del marcador —`M` en la pantalla del parte y `MARCA_ASIGNADOS` en el selector—
**siguen vivas**, y hay un control que cae si desaparecen. Lo que se va son estos veintiún usos, no
la herramienta: el rótulo que alguien añada mañana sin firmar tiene que seguir saliendo marcado.

## ⚠️ QUEDAN DIEZ SIN FIRMAR, con su literal y su línea

No se inventan, no se borran y no se dejan con corchetes por descuido: se listan para que los firme
el fundador.

| Fichero:línea | Literal exacto |
|---|---|
| `parteDetailView.js:39` | Firma del cliente |
| `parteDetailView.js:40` | Pide al cliente que firme con el dedo dentro del recuadro. |
| `parteDetailView.js:55` | Firmado. El contenido ya no se toca. |
| `parteDetailView.js:59` | No se ha podido cargar el parte. Vuelve a intentarlo. |
| `parteDetailView.js:66` | Añadir estas líneas |
| `parteDetailView.js:67` | Sin colocar — dile dónde va |
| `jobAsignados.js:37` | Todavía no lo ejecuta nadie |
| `jobAsignados.js:38` | Solo un administrador puede cambiar quién ejecuta |
| `jobAsignados.js:39` | Todavía no hay empleados a los que asignar |
| `jobAsignados.js:40` | No se ha podido guardar quién ejecuta este trabajo |

## El control cambió de sitio, y ése es el arreglo de fondo

El censo de SCRUM-402 decía **1** mientras la pantalla enseñaba **26**, y **las dos cifras eran
correctas**: ese censo cuenta literales con la marca en el fuente, y esta vista la factoriza en una
constante que concatena veintiséis veces. Por eso el guard nuevo
(`tests/scrum720-marcadores-en-lo-pintado.test.mjs`) **no mira el fuente: ejecuta la pantalla y
cuenta los marcadores en lo que pinta**, en tres estados (borrador, firmado y sin líneas).

**Hoy pinta 1** —«Firmado. El contenido ya no se toca.»—, y el trinquete no puede subir.

⚠️ **Lo que ese banco NO alcanza, dicho aquí:** cinco de los diez viven en caminos que `renderParte`
no pinta (el pad de firma, el aviso de error al cargar, la propuesta del dictado) y otros cuatro
están en otra pantalla. El trinquete **no los vigila**; están arriba, con su literal.
