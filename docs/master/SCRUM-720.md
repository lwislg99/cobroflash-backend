# SCRUM-720 · Los 21 rótulos firmados del parte, y el control que mira lo PINTADO

**Medido contra:** `origin/main` = `d9f60f7e89cc600e4d518af50ad2a977ed1876ba` · 2026-09-04T14:07:39+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-720-rotulos-del-parte`

**LA VÍCTIMA: el profesional que abre el parte en producción y ve 26 corchetes.** El fundador firmó
**21** rótulos y se aplicaron literales, con su registro en
`docs/microcopy/2026-09-04-SCRUM-720-rotulos-del-parte.md` (mecanismo de SCRUM-709: un fichero por
aprobación, sin índice).

**EL MECANISMO SE VACÍA, NO SE RETIRA.** Las dos constantes —`M` en la pantalla del parte y
`MARCA_ASIGNADOS` en el selector— siguen vivas, y hay un control que cae si desaparecen: el rótulo
que alguien añada mañana sin firmar tiene que seguir saliendo marcado.

**QUEDAN DIEZ SIN FIRMAR, y eran más de los 21 que el fundador sospechaba.** Van listados con su
literal exacto, fichero y línea en el registro de la aprobación. No se inventan, no se borran y no se
dejan sueltos.

## El arreglo de fondo: el control cambia de sitio

El censo de SCRUM-402 decía **1** mientras la pantalla enseñaba **26**, y **las dos cifras eran
correctas**: ese censo cuenta literales con la marca en el FUENTE, y la vista la factoriza en una
constante que concatena 26 veces. Un número honesto sobre el fichero, y una pantalla llena de
corchetes.

`tests/scrum720-marcadores-en-lo-pintado.test.mjs` **ejecuta la pantalla y cuenta los marcadores en
lo que PINTA**, en tres estados —borrador, firmado y sin líneas—, con el banco de DOM de la casa y
sin dependencias nuevas (regla 36). Hoy pinta **1**: «Firmado. El contenido ya no se toca.». El
trinquete no puede subir, y con el parte en borrador salen 0 — quedarse en ese estado habría dado un
cero de mentira.

**SUELO:** si la pantalla no pintara nada, contar marcadores sobre una cadena vacía daría cero y
parecería una buena noticia. Se exige que pinte contenido real antes de contar.

⚠️ **LO QUE ESE BANCO NO ALCANZA, dicho aquí y no descubierto en producción:** de los diez que
quedan, cinco viven en caminos que `renderParte` no pinta (el pad de firma, el error al cargar, la
propuesta del dictado) y cuatro están en otra pantalla. El trinquete **no los vigila**.

## Un guard que había que reapuntar, no relajar

`SCRUM-650d` exigía que **todos** los textos del selector llevaran marcador — cierto el día que se
escribió, porque no había ni uno firmado. Ahora uno lo está. Convertirlo en «los que yo diga» habría
sido relajarlo; se apunta al **HECHO**: sin marca sólo si **consta aprobado**, y eso no se declara
—se comprueba contra el registro con `constaAprobado` (SCRUM-709/710, por identidad y no por
subcadena). Queda más fuerte que antes: un texto sin marca y sin aprobación sigue cayendo.
