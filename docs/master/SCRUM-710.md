# SCRUM-710 · `constaAprobado` compara el hecho, no la forma

**Medido contra:** `origin/main` = `9747d16ad1699b57b6738728e938b530d006f1b8` · 2026-09-04T08:28:14+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-710-consta-por-identidad`

**LA VÍCTIMA: quien pregunte si un texto está aprobado y reciba un «sí» que nadie firmó.** El agujero
lo declaré yo al cerrar SCRUM-709 y era peor de lo que dije: no era hipotético. Hay literales
aprobados de dos palabras —«Mano de obra», «Materiales», «Guardar precios», «Precio por unidad»— y
sus trozos aparecen en la prosa del propio registro.

**🔒 UN PREFIJO NO ES UN NOMBRE, Y UNA SUBCADENA TAMPOCO.** Cuarta cara de la misma avería en una
semana: `data-view="parte*"` por prefijo, `window.renderParte` dentro de `renderPartesOficinaView`,
un guard apuntando al alias en vez de a la función, y esta subcadena.

**EL MECANISMO.** No se busca dentro del texto del registro: se **extraen las unidades delimitadas**
en las que el registro escribe un literal y se compara por **identidad**. Los delimitadores se
midieron antes de tocar nada, y no se inventan aquí:

- **celda de la columna «Texto aprobado»** — así están escritas las 18 aprobaciones conocidas del
  registro congelado;
- **línea de cita (`>`)** en `docs/microcopy/` — así lo escribe el mecanismo nuevo.

Y las **citas del congelado NO cuentan**: ese fichero usa `>` para avisos, y aceptarlas convertiría
cada nota en un texto «firmado por el fundador». Hay control para eso.

**ME EQUIVOQUÉ AL ELEGIR EL CASO, Y QUEDA ESCRITO.** El mecanismo viejo buscaba la **consulta dentro
del documento**, así que una frase más larga que el literal —«Materiales del almacén central»— no
colaba: no está escrita en ninguna parte. Lo que colaba era lo contrario, una consulta **corta**.
Mis primeros cuatro casos pasaban con los dos mecanismos y no probaban nada; **lo tumbó mi propio
aserto de discriminación**, que exige que los casos se cuelen con el mecanismo viejo. Los buenos:
`Vuelve a intentarlo` (cola de un literal aprobado), `de obra` (trozo de «Mano de obra»),
`Precio por` (**prefijo** de «Precio por unidad») y `Libro registro` (prosa).

**CONTROL POSITIVO, ENUMERADO:** las **21** aprobaciones conocidas se siguen encontrando **una a
una**, incluidos los cuatro cortos. Apretar el matching **no tiró ninguna**. Si lo hubiera hecho, el
arreglo estaría mal y el aserto lo dice por su nombre en vez de esconderlo.

## El número en prosa: derivado donde podía mentir, intacto donde es historia

**El barrido.** 165 afirmaciones de cantidad sobre marcadores en `tests/`, `docs/`, `scripts/`,
`src/` y `public/`. Casi todas son la justificación de **una entrada concreta** —«se cuenta 1 y son
cinco textos»— y son ciertas y fechadas. Lo que puede envejecer sin que nadie lo note es el **total
global**, y de ésos quedaba **uno vivo**: el suelo del escáner de SCRUM-402, que decía «hay 36
medidos» cuando el censo suma 13. **Ahora se deriva** del censo declarado, que es lo que el propio
trinquete obliga a mantener al día. Un número derivado no puede envejecer.

**Y una distinción que no es la misma para todos los números:** los **suelos de alcance** («>= 100
ficheros leídos», «> 400 leídos») **se escriben a mano a propósito** y NO se derivan — derivarlos
haría que añadir un fichero subiera el listón solo y el suelo no podría caer nunca. Es la lección que
SCRUM-377 dejó escrita en este mismo árbol.

**Los dos números del registro congelado (13 y 38) NO se tocan.** Son historia fechada y eran
ciertos cuando se escribieron; corregirlos falsificaría el registro. El fichero ya avisa de que está
congelado.

## El patrón que se copia

`aprobacionesDeMicrocopy()` queda documentada en `docs/microcopy/README.md`, en una sección dirigida
a **quien vaya a escribir el próximo lector**: usar el buscador compartido en vez de abrir un fichero
por su ruta, comparar por identidad y no por subcadena, y que un barrido vacío se declare ciego.
`tests/scrum654` **no se toca**: es carril ajeno (regla 9) y hoy funciona porque el registro viejo se
conservó entero.
