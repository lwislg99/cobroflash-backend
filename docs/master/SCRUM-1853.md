# SCRUM-1853 · los tests que pasan CSS al filtro de comentarios sin decir que es CSS

## SCRUM-1853 · parte J2 · los dos llamadores de J2 leen el CSS por su ruta

**Medido contra:** `origin/main` = `2a6675c978794595696f87fb1a7ed3e52f904adb` · 2026-11-25T15:01:42Z

Puesto J2, sesión jv-j2fa, rama `scrum-1853-llamadores-css-de-j2`, por encargo del orquestador J (reparto en
SCRUM-1853 c.22788). Carril: `carriles.mjs de` contesta NO-PUDE-MIRAR en los dos (tests de ticket); manda
la etiqueta `area-j2` de SCRUM-1145 y SCRUM-1587 según c.22788 (no la he releído en Jira).
`tests/_guard-texto.mjs` (J6) no se toca; los otros 12 llamadores, tampoco.

### Qué cambia, por llamador

Los dos leían `public/dashboard/css/styles.css` con `fs.readFileSync` y se lo pasaban a `ejecutableDe` con
`almohadillaEsComentario: false` y sin `barraDobleEsComentario: false`. Como leen por su ruta, la cura es
`leerFuente(ruta, { ancla })`, que decide las dos cosas por la extensión (`almohadillaComenta`,
`barraDobleComenta`). Misma ancla; `donde` pasa a ser la ruta. `fs` sólo servía para esa lectura y su
import se quita; el comentario gana una línea con el porqué, así que la llamada sigue en la línea que
cita `docs/master/SCRUM-1851.md:68-69`.

| llamador | antes | después |
|---|---|---|
| `tests/scrum1145-pestana-sitios.test.mjs:275` | `ejecutableDe(fs.readFileSync(…styles.css), { ancla: '.c360-pestanas', donde: 'styles.css', almohadillaEsComentario: false })` | `leerFuente(path.join(RAIZ, '…styles.css'), { ancla: '.c360-pestanas' })` |
| `tests/scrum1587-reenviar-correo-cobros-44.test.mjs:37` | `ejecutableDe(fs.readFileSync(…styles.css), { ancla: \`${SELECTOR}::before\`, donde: 'styles.css', almohadillaEsComentario: false })` | `leerFuente(path.join(RAIZ, '…styles.css'), { ancla: \`${SELECTOR}::before\` })` |

### Los controles (guion suelto en TEMP, fuera del árbol, por encargo)

El guion reproduce a mano, literal, la llamada de antes y la de después de cada test, con el
`tests/_guard-texto.mjs` de este árbol, y las comprobaciones del propio test copiadas.

(a) `styles.css` de hoy (385.822 B, sha256 `fd30c40e…cacc1f6`): en los DOS llamadores, antes y después dan
196.042 caracteres, 1.907 llaves de cierre y el mismo sha256
`cbcdcb0a2f02f6d150ececf8ca34a7c6062b16afa091eef6375821ac469d0cb8`: idéntica byte a byte. Y la comprobación
de cada test pasa antes y después.

(b) Sembrado en TEMP, una regla con su ancla y `background:url(https://x/y.png)` dentro, y otra regla
detrás (2 llaves en la fuente):

- 1145: `.c360-pestanas { display: flex; background:url(https://x/y.png) }` + `.otra-cosa { flex-wrap: wrap; }`.
  Antes: 1 llave de 2, y la regex del test (`/\.c360-pestanas\s*\{[^}]*flex-wrap:\s*wrap/`) da VERDADERO
  leyendo el `flex-wrap` de la regla de al lado: un verde falso. Después: 2 de 2 y FALSO.
- 1587: `<SELECTOR>::before { content: ""; position: absolute; inset: -8px 0; background:url(https://x/y.png) }`
  + `<SELECTOR> { position: relative; }`. Antes: 1 llave de 2, la regla del botón desaparece dentro del
  cuerpo del `::before` y la comprobación de `position: relative` da FALSO: un rojo falso. Después: 2 de 2
  y VERDADERO.

(c) Control del sembrado: el mismo fichero con `url(x/y.png)`, sin barra doble → antes y después iguales en
los dos (90 y 194 caracteres). La diferencia de (b) la pone la `//`, no otra cosa.

### Verdes (en este árbol, `node --test` por fichero, TAP a un fichero fuera del árbol)

- `scrum1145`: 13 casos, 12 ok y 1 saltado (el de la ruta real: `sin LIBRO_PG_URL`, ajeno al CSS); los
  mismos 13 nombres y resultados que la base sin tocar.
- `scrum1587`: 2 de 2, iguales a la base.
- `scrum700`: 5 de 5. Filtros propios 91 con tope 91: no sube (cifra sacada con una copia del censo en
  TEMP; mis dos ficheros no son de filtro propio ni antes ni después).
- `scrum719`: 37 de 37, tras `npm run censo:mudez -- --escribir`.
- `scrum237`, `scrum976`, `scrum854`, `scrum1294`, `scrum267` y `npm run guards:entrada`: en la entrega de
  SCRUM-1853 en Jira, con su población.

**Corrección al encargo:** decía «`censo:mudez -- --escribir` sólo si cambia la clase». Hace falta siempre
que se toca el fichero: la ficha guarda la huella del fichero, y el censo dijo «A medir: 2 de 148». Clase
VIVO → VIVO en los dos; en `tests/_veredicto-mudez.json` sólo cambian sus dos huellas.

### Lo que NO he medido

- Que el test de verdad caiga con el sembrado: el sembrado se corrió contra la réplica de cada llamada, no
  contra el fichero de test (no se toca `styles.css` del árbol).
- El guion de control no está en git: vive en TEMP, como pedía el encargo. Lo que hace falta para
  repetirlo está arriba (llamadas, sembrados, cifras).
- La suite entera: no la corrí (el encargo lo prohíbe); sólo los ficheros nombrados aquí.
- La etiqueta `area-` de SCRUM-1145 y SCRUM-1587: la tomo de c.22788.

A9: sin fallo que generalice — el defecto era latente (0 de 8 `.css` con `//` fuera de un comentario) y la cura no se apoyó en ninguna suposición sin medir: el único desacuerdo con el encargo (la huella del censo de mudez) lo destapó el propio censo antes de empujar.
