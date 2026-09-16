# SCRUM-349 · El trinquete de copy escaneaba los comentarios, y eso se pagaba escribiendo peor

**Fecha:** 6-ago-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `76f4bf5f49df2c759cf612f031e5a4dd44bc374b` · 2026-08-06T01:01:24+01:00

**Tanda:** 1879 tests, 1812 pass, 0 fail, 67 skipped

> **Un guard que obliga a escribir peor las explicaciones para no despertarlo cobra un impuesto
> sobre la claridad del código.**

## 1 · La medición, antes de construir nada

El asesor afirmó que el trinquete de SCRUM-299 «ya obliga a reformular explicaciones para
esquivarlo». Eso es comprobable, así que se comprobó antes de aceptarlo.

**Qué escanea.** `recolectarCopyPublico` leía el **fichero entero**: `public/**` (salvo
`public/dashboard/`), `src/modules/messaging/**/*.ts` y `src/integrations/whatsapp.ts` — 21 ficheros,
9 de ellos en `src/`.

| De `src/`, lo que entra en el censo | |
| --- | --- |
| Bytes escaneados | **99.496** |
| De ellos, comentario | **24.466 = 24,6 %**, en **281 bloques** |
| Bloques que mencionan «factura/recib» | 11 |
| Comentarios que disparan **hoy** | **0** |
| Comentarios que dispararon **alguna vez** (53 revisiones de esos ficheros, historia completa) | **0** |

Casi una cuarta parte de lo que ese guard mira en `src/` no puede llegar a ninguna pantalla.

**Explicaciones visiblemente reformuladas para esquivarlo: UNA, y con línea.**

`src/modules/messaging/domain/lifecycle.service.ts:156` explica por qué el email de al lado no
enumera el documento fiscal — y **para explicarlo no puede nombrarlo**:

> «La enumeración de lo que sigue funcionando **NO usa el posesivo del documento fiscal**, y no es un
> olvido: el trinquete de SCRUM-299 lo caza como PROMESA»

Lo que quiere decir es «no dice **“tus facturas”**». Medido: escrito así, **el guard se pone rojo**.
La perífrasis no es estilo, es el peaje. El propio comentario termina con «el texto cedió»: lo que
no dice es que la explicación cedió también.

**Y el guard se contorsionó en la dirección contraria**, que es la misma factura al revés: el
detector excluye a propósito «recibo/recibos» del patrón de entrega, y el test lleva como control
negativo `'el PDF del recibo/factura' // comentario whatsapp.ts`. **Un comentario acabó dentro del
diseño del detector.**

*El número podría haber salido cero, y se habría reportado cero.* Salió uno, verificado dos veces:
la frase clara dispara, la escrita no.

## 2 · El arreglo: se enmascara lo que no llega a pantalla

Nunca el fichero entero. Literales donde lo vigilado es texto, AST donde hay estructura:

| Extensión | Qué se conserva |
| --- | --- |
| `.ts` · `.js` | **solo** literales de cadena y plantilla (AST). Fuera los comentarios **y el código**: un `const facturaUrl` tampoco es copy |
| `.html` | fuera los `<!-- -->`; y dentro de cada `<script>` de JavaScript se aplica lo mismo — son **28 KB** de script en línea, si no el agujero se muda ahí |
| `.json` `.xml` `.webmanifest` `.txt` | intactos: no tienen canal de comentario donde esconder una explicación, y su contenido **es** el dato publicado |

**Enmascarar, no recortar.** El texto devuelto mide **exactamente lo mismo** y conserva cada salto de
línea, así que los `:linea` que reporta el detector siguen siendo los del fichero real. Un número de
línea que miente es peor que no darlo: manda a alguien a la línea equivocada y le hace concluir que
el guard se equivoca.

`promesasDeFactura` **no se ha tocado**. El baseline y el trinquete bidireccional tampoco: siguen
contando lo mismo, sobre menos texto. Efecto medido: de 241.343 bytes brutos quedan 107.470 de copy
real; el control positivo de `index.html` («presupuesto») sigue en **35**, ni uno menos.

## 3 · El rojo que decide — una prueba, dos mitades, el MISMO texto

Las tres frases prohibidas se prueban **dos veces cada una**, cambiando solo dónde viven:

| | Como COMENTARIO que explica la prohibición | Como LITERAL que llega a pantalla |
| --- | --- | --- |
| «Aquí tienes tu factura…» | **verde** ✔ | **rojo** ✔ |
| «Recibes la factura en tu correo» | **verde** ✔ | **rojo** ✔ |
| «Factura #F-128» | **verde** ✔ | **rojo** ✔ |
| dentro de un `<script>` de una página | **verde** ✔ | **rojo** ✔ |
| en un comentario `<!-- -->` | **verde** ✔ | (el `<body>`: **rojo** ✔) |

Cada mitad «verde» lleva delante su control: **se comprueba que ese mismo texto SÍ dispara sin
enmascarar**. Si no, el caso habría dejado de reproducir el defecto y el verde no significaría nada.

Y sobre el fichero real, sin tocarlo: se le inyecta en memoria la explicación clara —la que hoy no
se puede escribir— y el guard aguanta; se le inyecta la promesa en el **copy** del email y el guard
cae. La misma medición, las dos direcciones.

## 4 · Suelos

* **Si el extractor no encuentra ni un literal, falla.** Enmascarar es peligroso justo por ahí: un
  extractor que devuelve todo en blanco deja el censo sin nada que mirar y el trinquete verde para
  siempre. Se exige que **encuentre** literales, no que no reviente — y por fichero, para que uno
  ciego no se esconda detrás del total.
* **Enmascarar no mueve una sola línea**: mismo largo y mismo número de líneas, fichero a fichero.
* **El defecto existía**: si `bruto` y `texto` fueran iguales, todo lo demás aprobaría sin significar
  nada. Se exige que el enmascarado quite algo, y que en `src/` quite más de la mitad.

🔴 **El segundo suelo cazó un defecto que la vista no ve.** El enmascarado usaba
`Array.from(codigo, …)`, que itera por **puntos de código**: cada emoji de un comentario (`⚠️`, `🔴`)
se convertía en **un** espacio donde ocupaba **dos** unidades UTF-16, y el texto salía más corto con
todos los offsets de detrás corridos. Los índices de TypeScript son unidades UTF-16; ahora el
enmascarado también. Sin ese suelo, el guard habría reportado líneas falsas en silencio.

### Verificado en rojo

| Sabotaje | Sale rojo |
| --- | --- |
| Se desactiva el enmascarado (vuelve a escanear el fichero entero) | ① el comentario, el caso de `lifecycle` y el control de que el defecto existía |
| El extractor devuelve **todo en blanco** | el SUELO, ② el literal y el `<script>` |
| Vuelve a contar por puntos de código | el suelo de las líneas, **nombrando `lifecycle.service.ts`** |
| El HTML deja de enmascarar los `<script>` | el caso del `<script>` |
| El HTML deja de enmascarar los `<!-- -->` | el caso del comentario HTML |
| Se rompe el detector (`PATRONES_PROMESA` vacío) | **6 tests**, incluidos los dos de SCRUM-299 |

🔴 **Un sabotaje destapó un hueco de mi propia cobertura**: quitar el enmascarado de comentarios
`<!-- -->` **no ponía rojo a nadie**, porque hoy ningún comentario de `public/` dice «factura» y el
corpus real no reproducía el caso. Se añadió el caso y el sabotaje ya cae. *Un guard sin caso de
prueba no está vigilando: está esperando a que alguien escriba el comentario que lo despierte.*

## Lo que NO cubre

* **No se toca `lifecycle.service.ts`.** La perífrasis de `:156` **ya puede deshacerse** —el test lo
  demuestra sobre el fichero real— pero reescribirla es entrar en `src/` de otro ticket sin
  necesidad. Queda como acción disponible para quien lo tenga abierto.
* **No se toca el detector ni el baseline.** `promesasDeFactura`, `DEUDA_ORIGINAL` y el trinquete
  bidireccional son los mismos: lo que cambia es **sobre qué texto** corren.
* **La exclusión de «recibo» sigue puesta.** Ya no hace falta *por el comentario* de
  `whatsapp.ts:851`, pero sigue siendo correcta para copy real («el recibo» es un sustantivo, no el
  verbo recibir). Quitarla sería otra medición.
* **No se revisa si hay más guards que escanean ficheros enteros.** Éste tenía víctima medida; saber
  si hay otros es otro ticket.

## Ficheros

* `tests/_copy-publico.mjs` — `enmascararNoPantalla()` y `literalesDeJs()`; el censo devuelve ahora
  `texto` (lo que llega a pantalla) y `bruto` (el fichero), para que el suelo pueda comparar.
* `tests/scrum349-copy-no-comentarios.test.mjs` — **nuevo**, 7 tests: tres suelos, las dos mitades
  del rojo que decide, el caso del HTML y la víctima medida.
