# SCRUM-1511 · Las 14 marcas «ancladas»: sus citas a Jira existen todas, y cinco no dicen lo que la marca afirma

**Medido contra:** `origin/main` = `fc639ef96164b56ae99c129b7202c56c66abdaf4` (árbol medido) · 2026-10-08T01:38:43Z (hora de GitHub); al cerrar, `origin/main` ya iba en `c1bad3c34e5ac6379d2b7fadd9615fd5d2b5d189`.

A9: sin fallo que generalice — el único tropiezo del tramo (un guion escrito por heredoc perdió una barra invertida) lo paró node con un error de sintaxis antes de medir nada.

Lo hace J4 (equipo de Javier), a continuación de SCRUM-1502 tramo 2. Sólo mide: no toca `scrum921c`,
`tests/_respaldo-de-firma.mjs`, `SIN_RESPALDO` ni ninguna marca, y no escribe ninguna cita nueva. El
estado medido es el de hoy: **28**.

## 0 · En corto

| pregunta | medido |
|---|---|
| marcas ancladas | **14**, con 18 citas, 13 pares ticket + comentario distintos |
| ¿existe el ticket? | 13 de 13 |
| ¿existe ese comentario EN ese ticket? | 13 de 13 |
| ¿el comentario atribuye la decisión al fundador, sobre eso mismo? | **9 marcas sí** (3 con reserva) · **5 marcas no** |
| control: dos citas fabricadas, mezcladas a ciegas en la lista | las dos salieron como inexistentes (una por comentario, otra por ticket) |
| rastreables | 149: 147 nombran ticket (159 distintos), 2 sólo una ruta de `docs/` |
| ¿existen esos 159 tickets? | 159 de 159; el fabricado número 160 salió como inexistente |
| ¿dicen lo que la marca afirma? | **NO MEDIDO** |

Ninguna cita de hoy es inventada: el riesgo que abrió el caso C de SCRUM-1502 (una cita a un
comentario que no existe pasa por anclada) es real en el mecanismo y **no ha ocurrido** en el árbol.
Lo que sí ha ocurrido es otra cosa: cinco marcas ancladas citan un comentario que existe y que
atribuye la firma a OTRO (firma delegada, o decisión del orquestador).

## 1 · De dónde sale la lista

De `veredictos()` del propio trinquete. Como no lo exporta, `evidencias/scrum1502b/veredictos.mjs`
copia su fuente a una carpeta temporal, le añade la línea que lo exporta y la importa; el fichero
seguido no se toca. Control: los recuentos por nivel coinciden con `porNivel()` (14 · 149 · 24 · 28).
La lista de pares, con los dos fabricados dentro, está en
`evidencias/scrum1502b/ancladas-con-dos-fabricadas.json` (sin el texto de las marcas).

## 2 · Las 14, una a una

Veredicto: **a** = el comentario atribuye la decisión al fundador sobre eso mismo · **b** = habla de
eso, y la firma es delegada o de otro. No hubo ninguna «habla de otra cosa» ni «no verificable».

| marca | cita | veredicto | qué dice el comentario (resumido, sin literal) |
|---|---|---|---|
| `src/modules/fiscal/evidencias/paquete.ts:174` | SCRUM-1252 comentario 17726 | a | respuesta literal del fundador, firma una línea |
| `src/modules/fiscal/verifactu/registro.builder.ts:629` | SCRUM-1258 comentario 17713 | a | elige entre dos versiones, con su respuesta literal |
| `tests/scrum514-aprobado-y-aplicado.test.mjs:943` | SCRUM-1258 comentario 17713 | a | ídem |
| `public/dashboard/js/invoicesView.js:209` | SCRUM-825 comentario 17446 | a | respuesta literal a tres decisiones; sostiene la D1 |
| `tests/scrum1027-atajo-flag-off-sin-documento.test.mjs:194` | SCRUM-825 comentario 17446 | a | ídem, D1 y D2 |
| `tests/scrum411-exports-inalcanzables.test.mjs:68` | SCRUM-1404 comentario 18840 | a, con reserva | atribuye cuatro decisiones al fundador; no transcribe sus palabras |
| `tests/scrum582-seleccion-multiple-clientes.test.mjs:187` | SCRUM-1135 comentario 17449 | a | respuesta literal |
| `tests/scrum895b-literales-firmados.test.mjs:1` | SCRUM-895 comentario 15699 | a, con reserva | se titula firma del fundador; dice que delegó la elección y aprobó lo recomendado, sin sus palabras |
| `scripts/guard-pasos-del-editor.mjs:1` | SCRUM-915 comentario 15790 | a, con reserva | sostiene la opinión citada; la otra afirmación del bloque apunta a `docs/prototipos/SCRUM-915/`, sin abrir |
| `src/modules/metrics/domain/actividadEquipo.ts:1` | SCRUM-1341 comentario 17825 | **b** | dice expresamente que lo decide el orquestador y no el fundador. La marca atribuye la firma a SCRUM-1337, que el bloque nombra sin comentario y no se abrió |
| `tests/scrum755-el-contador-que-cuadro-solo.test.mjs:113` | SCRUM-915 comentario 15868 | **b** | firma de microcopy por delegación al orquestador. Es el choque más directo: la marca atribuye esos cuatro textos al fundador |
| `public/dashboard/js/quotesView.js:401` | SCRUM-915 comentario 15868 | **b** | la misma firma delegada. La frase de la marca habla de la v3 del prototipo y apunta a `docs/prototipos/SCRUM-915/`; el ancla del bloque respalda otra cosa |
| `tests/_asignacion-bloques-presupuesto.mjs:30` | SCRUM-915 comentario 15868 | **b** | ídem |
| `tests/scrum601-copy-del-documento-vs-flag.test.mjs:87` | cinco citas | **b** en tres | SCRUM-895/15699 y SCRUM-1216/17347 son **a**; SCRUM-887/15675, SCRUM-920/15992 y SCRUM-1257/17444 son firma delegada |

Lo que esto NO dice: que esos cinco textos estén sin firmar. La firma delegada existe como mecanismo
(regla 30, SCRUM-861) y la pregunta de si cuenta como firma del fundador sigue abierta: es la misma
por la que el trinquete deja fuera las once marcas del asesor. Dice que **el comentario citado no
sostiene la palabra que la marca usa**.

## 3 · ¿Se puede comprobar un ancla sin red, contra el árbol?

Sí, parcialmente, y está medido (`evidencias/scrum1502b/ancla-en-el-arbol.mjs`, 15 pares, 1.393 `.md`):

| criterio | los 13 reales | los 2 fabricados |
|---|---|---|
| el id del comentario está en el registro del PROPIO ticket (`docs/master/SCRUM-<n>.md`) | 13 de 13 | 0 de 2 |
| el id está en cualquier `.md` de `docs/` | 13 de 13 | 1 de 2 (coincide con otro número) |

El primero separa; el segundo no. Límites del primero: comprueba que el registro y la marca dicen el
mismo id, no que Jira lo diga; quien invente una cita puede inventar también la línea del registro; y
no dice nada sobre el contenido, que es donde han fallado las cinco de §2.

## 4 · Sobre si el trinquete debe comprobar el ancla contra Jira (opinión, la decide un jefe)

- Que salga a Jira: no. Hoy da 0 salidas y pasa igual con todas bloqueadas; con red sería un ciego más
  cada vez que Jira no responda. Y existencia no era el problema: 13 de 13 existen.
- Que deje de llamarse «anclado» lo que sólo es una forma: sí, y es lo único que lo medido pide. El
  nivel dice «cita bien escrita», no «aprobación que consta».
- La comprobación de §3 se puede añadir sin red y cazaría el caso C. No cazaría ninguna de las cinco
  de §2: ésas sólo se ven leyendo el comentario.

Las tres tocan `scrum921c` o su apoyo: no se aplican aquí.

## 5 · Errores propios y lo que NO se ha hecho

- **Los comentarios de Jira no los abrí yo: los abrió un subagente**, con la lista y los dos fabricados
  mezclados sin decirle cuáles eran. Yo comprobé que los dos fabricados salieron como inexistentes, que
  ningún ticket devolvió menos comentarios que su total (lo declara él), y la frase de las cinco marcas
  en el árbol. No reabrí ningún comentario por mi mano.
- La existencia de los 159 tickets la midió otro subagente, por lotes, cotejando a ojo las claves
  devueltas; su control (una clave inexistente no tumba la consulta: se omite en silencio) pasó.
- **El contenido de las 147 rastreables con ticket no se ha mirado.** Si la proporción de las ancladas
  (5 de 14) se repitiera, serían decenas; no está medido y no se extrapola.
- No se abrieron SCRUM-1337, SCRUM-346, SCRUM-1232 ni `docs/prototipos/SCRUM-915/`.
- Del 404 no se separa «no existe» de «sin permiso»: Jira da el mismo mensaje.
- Un guion escrito por heredoc perdió una barra invertida; node lo paró con error de sintaxis.
- Tanda completa: no corrida. El cambio es este registro y ficheros bajo `docs/master/evidencias/`.
