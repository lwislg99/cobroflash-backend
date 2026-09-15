# Sesión 2 — «¿esta pantalla está bien construida?»

Las vistas del panel. Mide el DOM RENDERIZADO, no el fuente.
Construyó la lista de Trabajos y un guard que compara lo que el front
pide contra lo que el router atiende — dos conjuntos reales, no una
lista disfrazada de mecanismo.

TRAMPA RECURRENTE: su propio banco. Reportó once controles «tapados»
que eran su fondo de pruebas, y un botón «ciego» que era su arranque.
No había avería: había banco.

## Al canon el 9-sep-2026, del SCRUM-832

🔒 **«Una fuga que se evita por disciplina vuelve. Una que se evita porque el
código no tiene acceso al dato, no.»**

El caso: «no existe» y «no es tuyo» tenían que contestar exactamente lo mismo, o
la lista de ids se convierte en un directorio de la competencia. No se consiguió
acordando no distinguirlos: se consiguió haciendo que el `catch` **no lea la
variable del error**. Si no la mira, no puede ramificar por el motivo, y las dos
respuestas no pueden divergir ni por descuido.

Y el test tardó dos intentos en apuntar a eso. «Un solo `catch`» y «el `catch` no
tiene `if`» eran PROXIES: las dos se pusieron rojas contra código correcto. La
propiedad era la tercera.

🔒 **«Lo que funciona por casualidad se rompe el día que alguien hace lo
correcto.»**

El caso: la lista de Presupuestos pintaba el título a mano —«Presupuesto #12»— en
vez de pasar por el router. Al mandarla por el router, que era lo correcto, el
título pasó a «Presupuestos», el plural, en la ficha de UNO. Porque
`quotesDetailView.js` sólo corrige el título al número real **si ya empieza por
«Presupuesto #»**. Nadie había escrito ese contrato: se cumplía porque el camino
viejo, por otro motivo, ponía justo esa cadena.

Corolario para esta sesión: cuando un sitio hace algo a mano y sus cuatro
hermanas no, antes de enderezarlo hay que preguntarse **qué depende de esa mano**.

## Y por qué existen los guards de navegador

> «Lo habría entregado roto si no lo llego a medir en navegador.»

Es el caso de arriba, y es el argumento entero. El router se leía bien. El test
sobre el fuente pasaba. Los dos títulos —el bueno y el malo— se leen igual en el
código, porque la diferencia la pone una regex que vive en OTRO fichero y sólo
actúa en tiempo de render. Sin abrir un navegador, el defecto era invisible.

Es la misma familia que SCRUM-515 (un aviso pintado con `appendChild` y borrado
por un `innerHTML` cuatro líneas después, con el test en verde porque el texto SÍ
estaba en el fichero) y SCRUM-541 (un `aria-label` bien puesto y uno mal puesto
se ven igual en el fuente). Cada vez que alguien proponga quitar un guard de
navegador «porque ya hay un test», éste es el contraejemplo.
