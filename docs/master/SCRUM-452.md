# SCRUM-452 · El PDF de un v:3 imprime el cliente, el emisor y su NIF **QUE SE SELLARON**

**Fecha:** 10-ago-2026 · **Carril:** fiscal/evidencias · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `2e12c2f784615db647a5f35d18ebfeafe6f69c07` · 2026-08-10T20:15:12Z

**Paso 0:** `docs/master/SCRUM-452.md` **no existía** en `origin/main` ni en ninguna rama remota
(barrido con `git cat-file -e origin/<rama>:...` sobre `git ls-remote --heads`). Premisa comprobada
sobre el árbol: el PDF **resolvía los cinco y consumía dos**.

> ✅ **GO del fundador (regla 38).** Toca el camino de emisión: sin esa línea no se podía hacer.
> ⛔ **Y por eso entra en el MISMO PR que v:3**: hoy no existe ni un sobre v:3 —el primero nace con
> el despliegue— y el PDF se rehace en cada deploy. Mergear v:3 antes que esta pieza abriría una
> ventana en la que cada albarán firmado nace con la incoherencia dentro.

## 1 · La víctima, en una línea

Un cliente corrige su razón social. El PDF de su albarán **v:3** imprimía la **NUEVA** mientras el
sello certificaba la **ANTIGUA** — y el verificador decía que todo cuadra, **porque el sello no
mentía: mentía el papel**. El documento que el profesional le enseña al cliente y la prueba que lo
respalda decían cosas distintas, y nadie se enteraba hasta que alguien las comparaba.

## 2 · Qué entra, y es poco a propósito

v:3 ya congelaba los **cinco** campos dentro del sobre; el PDF solo consumía **dos** (`obra` y
`referenciaTrabajo`). Ahora consume los tres que faltaban: **`cliente` · `emisor` · `emisorNif`**.

**No se sella nada nuevo.** Cambia lo que se **PINTA**, no lo que se **SELLA**: ninguna receta,
ningún hash, ningún sobre tocado. Era darle **superficie** a un motor que ya estaba.

### Y no es solo que ahora lleguen: es que **ya no puede llegar otra cosa**

`generateAlbaranPdf` deja de recibir `merchant.name`, `merchant.legalName`, `merchant.taxId`,
`customer.name` y `customer.legalName`. **No es limpieza — es la corrección**: un campo que no se
recibe no se puede pintar por descuido. Antes bastaba una línea distraída para deshacer esto; ahora
hace falta cambiar la firma, y eso se ve en el diff.

| Puerta | Qué entra | Por qué |
| --- | --- | --- |
| **Los cinco sellados** | `obra` · `referenciaTrabajo` · `cliente` · `emisor` · `emisorNif` | los resuelve `contenidoSegunVersion` según la versión del sobre |
| **Lo que el sobre NO congela** | `merchant.address` · `merchant.whatsappPhone` · `merchant.logoUrl` · **`customer.taxId`** | el sello no los nombra, así que **no puede contradecir al papel** |

**Se conserva el `|| '—'`** en las dos líneas. El sobre congela `null` y el papel lleva imprimiendo
la raya desde SCRUM-67: quitarla cambiaría lo que ve un cliente en un documento que firma.

## 3 · 🔴 v:1 y v:2 no cambian ni un byte

Sus sobres **no tienen bloque congelado**, así que `contenidoSegunVersion` les devuelve las **mismas
fuentes vivas** con las mismas cadenas `||`. Cambia **por qué puerta entran**, no lo que valen. Test
explícito en los **dos** sentidos: imprimen su valor vivo **y** no imprimen el sellado. Un albarán
**sin firmar** manda el campo de hoy: es un borrador, no una versión rara.

## 4 · El PDF de WhatsApp — el que se queda el CLIENTE

`albaranWhatsApp.service.ts:61` llama a `ensureAlbaranPdf(albaran.id)` **sin `force`**: la misma
composición que el `GET`. Cubierto con guard propio: si el envío se buscara su propio camino al
generador —llamando a `generateAlbaranPdf` directamente— cae, porque entonces el papel que se lleva
un tercero se compondría con las filas de hoy.

## 5 · Verificación · sobre el DOCUMENTO, no sobre la base

Se genera el PDF de verdad y se lee su texto (`_pdf-texto.mjs`, SCRUM-300). Un test que comprobara
la fila diría que el dato está bien **guardado**, que es otra cosa.

| | Qué | |
| --- | --- | --- |
| **🔴 EL TEST** | v:3 con las filas vivas cambiadas → el papel imprime **lo sellado** y **no** lo vivo. Los tres, uno a uno y **nombrados** | ✅ |
| **🔴 AL FIRMAR** | papel y sobre dicen **lo mismo** en los tres. Si divergieran ahí, divergirían desde el segundo cero y lo demás sobraría | ✅ |
| Control negativo | v:1 y v:2 **sin cambios**, en los dos sentidos · un borrador manda el de hoy | ✅ |
| Control negativo | un v:3 con los nombres sellados a `null` imprime **la raya**, no la razón social viva — con control positivo de que la raya **no** sale cuando sí hay nombre | ✅ |
| Lo no sellado | `address`, `whatsappPhone` y el **NIF del cliente** se siguen imprimiendo | ✅ |
| Guards de AST | el servicio **no le pasa ningún nombre vivo** al PDF · el PDF **ya no sabe derivarlo**, porque no recibe con qué | ✅ |

### Los rojos por el mecanismo — **nombran el campo**, no «el PDF no cuadra»

Cada mutación comprueba que **cambió el fichero que se dice** antes de correr la tanda.

| Mutación | Cae diciendo |
| --- | --- |
| `emisor` vuelve a leerse en vivo | *«EL PAPEL NO IMPRIME EL EMISOR…»* (+5 tests) |
| `emisorNif` vuelve a leerse en vivo | *«el papel no imprime el NIF del emisor»* (+4) |
| `cliente` vuelve a leerse en vivo | *«EL PAPEL NO IMPRIME EL RECEPTOR…»* (+5) |
| el servicio vuelve a mandar los vivos | *«EL SERVICIO LE PASA `customer.name` AL PDF…»* |
| se retira el `\|\| '—'` | *«el valor de «Emisor:» no es la raya: " Calle Fiscal 1"»* |

### 🔴 Dos veces me equivoqué yo, y las dos quedan escritas

**① Un rojo falso por subcadena.** El escenario usaba «Fontaneria Pereira» para lo sellado y
«Fontaneria Pereira SL CORREGIDO» para lo vivo —lo realista—, y `contiene(papel, sellado)` daba
**verdadero encontrándolo DENTRO del vivo**. El test acusaba al código de lo contrario de lo que
hacía. Hay ahora un **suelo** que exige que los pares sean disjuntos.

**② Un VERDE bajo mutación.** Quitar el `|| '—'` del emisor pasaba en verde: el test miraba «los 40
caracteres tras `Emisor:`» y ahí dentro cabía el `Receptor: —` de la línea siguiente — encontraba la
raya **del otro campo**. *Ante un verde bajo mutación, el primer sospechoso es la mutación; era el
test.* La ventana se acota ahora entre rótulo y rótulo.

## 6 · 🔴 Un hueco que salió al hacer esto, y no era pequeño

Al cambiar la fuente, el papel salió con **«Emisor:» y «Receptor:» VACÍOS** con la fixture vieja —
**y la tanda entera siguió verde**. Ningún test comprobaba los dos campos que identifican a las
partes del documento: **quién entrega y quién recibe**. Se comprobaba el lugar de entrega, la
referencia, las fechas, el firmante… y no ellos.

Cubierto en `scrum300-albaran-campos.test.mjs` y no en el fichero de 452, porque **no es de v:3**:
es del PDF del albarán, sea de la versión que sea.

## 7 · Lo que se escribe y NO se arregla

Los **cuatro** que el sobre no congela siguen leyéndose en vivo, **y es correcto**: sobre ellos el
sello no afirma nada, así que no puede contradecir al papel.

> 🔴 **`merchant.logoUrl` merece su línea:** congelar la URL **no congela la imagen** que hay detrás.
> Ninguna opción futura lo arregla sin guardar el fichero — ni siquiera un v:4.

Ampliar los campos congelados (sería un **v:4**) queda **descartado por ahora**: es otra decisión, y
más cara. Si algún día se toma, conviene saber que hoy es más barata que nunca — **cero sobres v:3
emitidos**.

## 8 · Microcopy

**Ninguna, y está decidido por el fundador:** un albarán fechado y firmado lleva los datos de aquel
día **por definición**. Una leyenda explicándolo añade ruido a un documento que el cliente firma.

## 9 · Lo que no se ha tocado

El sellador · el verificador · las recetas · ningún hash · `computeAlbaranContentHash` · los cinco
guards de v:3 · `prisma/schema.prisma` · ninguna factura emitida · ningún sobre v:1 o v:2.
