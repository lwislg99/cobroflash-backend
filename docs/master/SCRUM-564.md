# SCRUM-564 · Las 28 afirmaciones del copy publicado — diez son falsas para un merchant nuevo

**Medido contra:** `origin/main` = `9f25dab94118e256e16512a612ed0e9044718839` · 2026-08-20T22:30:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — mismo criterio R14.

**20-ago-2026** · **Carril:** B (landing) · **Gate:** sin gate, corre en `npm test`

**Alcance:** dos módulos, un generador, un documento generado y dos tests. **No se corrige ni se
reescribe ningún texto de la landing.** No se toca `scripts/censo-etiquetas-pegadas.mjs` (S1) ni
`scripts/_guard-afirmacion-fiscal.mjs` (S2, SCRUM-537) — comprobado antes de empezar: ninguna rama
activa toca esos ficheros, así que **no hay cruce que declarar**.

---

## PARTE 1 · Las seis aprobadas, registradas — y la séptima, declarada fuera

Decisión del fundador, 20-ago-2026. El registro de SCRUM-563 pasa de **41 a 52 entradas**: cinco
de un nodo (`F4-4`, `F4-5`, `F5-1`, `F5-4`, `F6-1`) y **seis de `F6-6`**, que está seis veces en el
marcado, una por gremio.

**Sin tocar el texto de ninguna.** «PROPUESTA · » sigue en `F5-1` y «Tu oficio» sigue siendo «Tu
oficio»: las dos son decisiones abiertas y **aprobado significa aprobado tal cual**.

### 🔴 F6-6 · el primer caso que no es una cadena plana, y sienta precedente

«Empezar gratis →» **no existe como secuencia contigua de bytes**. En el marcado es:

```html
<a class="p-link" href="/register.html">Empezar gratis <span class="ar">→</span></a>
```

Dos nodos de texto por tarjeta, **doce en total**. Buscar la cadena en el fichero daría «no está»,
y eso se leería como *«alguien cambió el texto»* — el falso rojo más caro que puede dar este
mecanismo.

**Cómo se ha resuelto:** una vía nueva, `via: 'texto-del-elemento'`. Se recompone el **texto entero
del elemento** que nombra el identificador —lo que el visitante lee de corrido— y se compara con
`===` y `Buffer.compare` como todo lo demás. No se guarda un trozo ni una descripción: se guarda lo
aprobado, tal cual.

**La regla, escrita porque sienta precedente:** `texto-del-elemento` vale cuando el texto aprobado
abarca **varios nodos del mismo elemento**. NO sirve para juntar texto de elementos distintos —eso
sería inventar una frontera que el marcado no tiene— ni para partir uno en trozos. Las cinco
entradas de un solo nodo van igualmente por esa vía: **una regla uniforme se comprueba, una
excepción se olvida.**

Un test fija que hoy la cadena **no** es contigua, para que el día que lo sea, alguien lo mire.

### 🔴 F4-1 sigue PENDIENTE, y su ausencia está DECLARADA

«El ERP por WhatsApp para los oficios» **no** está en el registro. Y como un texto que falta y uno
que se dejó fuera se leen igual, se declara en `NO_APROBADAS` con su motivo: **afirma la categoría
del producto y necesita aprobación Y ancla**, las dos del fundador. Un test comprueba que sigue
fuera y que `estadoDe()` la sigue devolviendo `PENDIENTE`.

---

## PARTE 2 · SCRUM-564

## ① El extractor: contar 28 y medir 12 habría sido peor que no medir

El censo del bloque F mira `h1|h2|h3|p|li`. En estas cinco secciones eso ve **37 de 136** textos, y
en `#faq` es **casi ciego**: las preguntas van en `<details>/<summary>`. Medido: **las 5
afirmaciones de `#faq` y las 9 de `#probar` caen todas fuera de ese esquema.**

Así que aquí la unidad es **cualquier elemento que contenga texto directamente**, con el mismo
esquema de identificadores derivados (`sección/etiqueta#orden`) para poder cruzarlo con todo lo
demás. Un test lo fija: si algún día las afirmaciones de `#faq` caben en el esquema viejo, es que
el marcado cambió y hay que volver a mirar por qué se amplió.

> ⚠️ **136 y no 148:** la diferencia son los **doce nodos de los seis «Ver más →»**, retirados por
> decisión del fundador y ya en `main`. **Las 28 afirmaciones no cambian**: ninguna era un «Ver más».

## ② Las anclas: se reutiliza el mecanismo, no se monta un tercero

`anclaViva()` de SCRUM-551 (**el símbolo existe**) y `alcanzabilidad()` de SCRUM-558 (**un merchant
nuevo llega a él**). Las dos condiciones, las mismas funciones, importadas.

🟢 **Y el veredicto se DERIVA de ellas**, no lo escribo yo en cada entrada. Importa: si la etiqueta
fuera a mano, el día que alguien encienda un flag seguiría diciendo lo de ayer.

## ③ El reparto

| grupo | cuántas |
|---|---|
| ✅ verdad hoy, con ancla viva y alcanzable | **15** |
| 🟡 verdad hoy, sin ancla de código | **1** |
| 🔴 **falsa o no verificable** | **10** |
| ⚪ descartadas (falso positivo del léxico) | **2** |
| **total** | **28** |

**Ninguna sin declarar.** Un test lo exige: una afirmación sin declarar y una verdadera se leen
igual.

## ④ 🔴 Las diez falsas — y son todas la misma puerta

`PAYMENTS_CONNECT_ENABLED` y `BIZUM_MANUAL_ENABLED` están **apagadas por defecto**
(`src/core/flags.ts`), así que para un merchant nuevo el único medio de cobro es la
**transferencia** — y diez textos publicados enumeran tres.

**Es exactamente lo que hizo descartar la fila del cobro con tarjeta en la comparativa de F5**
(SCRUM-332): reglas 18 y 23 del máster. Allí la regla dura funcionó y la fila no se escribió; aquí
el copy es anterior a la regla y lleva meses vivo.

| identificador | texto |
|---|---|
| `como/p#4` | «Tarjeta, Bizum o transferencia — él elige, tú cobras. Los pendientes se reclaman solos.» |
| `todo/p#3` | «Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado…» |
| `precios/li#3` | «Cobro con tarjeta, Bizum y transferencia» |
| `precios/p#2` | «Solo si cobras con tarjeta:» |
| `precios/p#4` | «Bizum y transferencia:» |
| `probar/span#15` | «Paga como quiera» |
| `probar/span#16` | «Tarjeta, Bizum o transferencia.» |
| `probar/span#42` | «Tarjeta» |
| `probar/span#44` | «Bizum» |
| `faq/div#3` | «Todo: presupuestos, firma y cobro, más clientes…» |

🔴 **La que más pesa es `precios/li#3`**: va en **la lista de lo que incluye el plan, al lado del
precio**. Y `precios/p#2` anuncia la **comisión** de un medio de cobro que un merchant nuevo no
puede usar — la frase entera del elemento es «Solo si cobras con tarjeta: 0,9 %. Bizum y
transferencia: 0 €.»

⚠️ **No se ha tocado ni una palabra.** Llevan meses publicadas y un cambio precipitado sobre copy
vivo es peor que la afirmación. Van delante del fundador, que es lo que pedía el ticket.

## ⑤ Las dos que sí preocupaban, medidas

- **`todo/h2#1` «Seis herramientas. Una sola app.»** → `IDENTIDAD` + cifra acoplada. **¿Son seis?
  Sí: dice 6, hay 6 `.prod` en `#todo`.** Su ancla no es un símbolo del código sino un **recuento
  del marcado**, y por eso va al grupo 🟡 con el ancla declarada. Ya llevaba trinquete desde
  SCRUM-555, entre las cifras acopladas.
- **`precios/p#2` «Solo si cobras con tarjeta: 0,9 %…»** → 🔴 **falsa**, por
  `PAYMENTS_CONNECT_ENABLED=false`. Es la misma zona que obligó a descartar la fila de F5.

## ⑥ Punto 5 · el léxico es suelo, no techo — las dos que se descartan

Revisadas **con el texto literal delante**, y descartadas con su motivo:

- `probar/div#1` «app.yaqu.app · Nuevo presupuesto» — marca `IDENTIDAD` por la palabra «app», y es
  la **barra de direcciones de un navegador simulado** dentro de la demo. Enseña una URL.
- `faq/summary#1` «Ya mando presupuestos por WhatsApp gratis. ¿Para qué esto?» — marca `CONDICION`
  por «gratis», y es la **pregunta del cliente**. Lo gratis que nombra es WhatsApp.

⛔ **No se toca el léxico para que dejen de aparecer.** SCRUM-555 midió que un léxico ajustado a las
frases de hoy da falsa sensación de vigilancia; lo que sostiene esto es la lista revisada a mano.

## ⑦ Lo que queda fuera de alcance — declarado, no callado

**108 textos** de las cinco secciones. Motivo, en `FUERA_DE_ALCANCE`: *no afirman ninguna
capacidad, condición ni identidad — sólo pueden ser feos, no falsos.* Se **cuentan** porque «no
revisado» y «no existe» se leen igual si nadie escribe la diferencia.

| sección | textos | afirman | fuera de alcance |
|---|---|---|---|
| `#como` | 9 | 4 | 5 |
| `#todo` | 15 | 3 | 12 |
| `#precios` | 26 | 7 | 19 |
| `#probar` | 75 | 9 | 66 |
| `#faq` | 11 | 5 | 6 |
| **TOTAL** | **136** | **28** | **108** |

## ⑧ Verificación

**SUELO** — tres. Las cinco secciones existen y ninguna sale vacía; el censo llega a **28 exactas**
(menos → mide a medias, más → afirmación nueva sin mirar, y **las dos direcciones fallan nombrando
la diferencia**); y el extractor alcanza donde el del bloque F es ciego.

**CONTROL POSITIVO** — todas las anclas vivas del bloque F **siguen saliendo vivas** con el mismo
mecanismo que este fichero reutiliza. Si dejara de reconocer lo que ya reconocía, sus 15 «con
ancla» no valdrían nada. Y un control negativo: un ancla inventada y un símbolo inexistente en un
fichero que sí existe salen las dos como **no vivas**.

**ROJO POR EL MECANISMO** — sobre `1dda46796ca36b77deeaaf022b80865d94ca4c40`, con el fichero
verificado idéntico al **blob** antes de empezar:

| inyección | parte | ¿cae? |
|---|---|---|
| una letra de una aprobada («Tu oficio» → «Tu oficia») | 563 | 🔴 sí — `CADUCADA · gremios/span#1 — aprobado el 2026-08-20` |
| cambiar la flecha de una tarjeta (el caso no contiguo) | 563 | 🔴 sí — `CADUCADA · gremios[fontaneria]/a#1` |
| una afirmación nueva en copy publicado | 564 | 🔴 sí — sale `SIN DECLARAR` y la nombra |
| cambiar el texto de una afirmación declarada | 564 | 🔴 sí |

Las cuatro veces la landing volvió **byte a byte contra el blob**, y al terminar `git status` de la
landing sale **limpio**. Nunca se usó `git checkout --`. **CR=0** comprobado con `Buffer` en los
cuatro ficheros nuevos antes de commitear.

**Tanda completa:** **3890 tests · 3813 pass · 0 fail · 77 skipped**.

## ⑨ Lo que NO se ha hecho

- ⛔ **No se revisan los otros 108.** Decisión del fundador, declarada con su motivo.
- ⛔ **No se corrige ni se reescribe ningún texto** (regla 30), ni se retira nada por parecer dudoso.
- ⛔ **No se amplía el registro de SCRUM-563 a estas cinco secciones**: sería aprobarlas por la
  puerta de atrás.
- ⛔ **Este guard NO se engancha a `pretest`**, igual que el del bloque F: hoy da rojo por diez
  afirmaciones publicadas y ese rojo es correcto, pero bloquearía el CI de todos por un copy cuya
  corrección es del fundador. Lo que impide que se olvide es el trinquete de este test.

## ⑩ Abierto — no es de este ticket

⬜ **Qué se hace con las diez.** Tres salidas visibles y ninguna es mía: corregir el copy, encender
las puertas por merchant, o declarar la excepción por escrito. **Es del fundador.**

---

> ⚠️ **Lo de abajo entró como fichero aparte (`SCRUM-564-condicion.md`) y pasa a APÉNDICE.**
> `docs/master/` exige `SCRUM-<n>.md` para que dos tickets no escriban nunca en el mismo sitio
> (SCRUM-273). Se conserva **entero, con su titular incluido**, siguiendo el precedente que el
> propio guard cita: `SCRUM-244.md`, que lleva cuatro entradas seguidas, cada una con su H1.
>
> 🔴 **Y esto primero, porque lo de abajo se lee mal sin ello:** el fundador **ANULÓ esta
> decisión** el 20-ago, después de leer la medición. **No se documenta la condición.** Lo que
> sostiene los nueve textos es el mecanismo de **SCRUM-568**. Esta entrada se conserva porque **la
> medida sigue siendo válida** y es lo que hará falta el día que se necesite una nota.

# SCRUM-564 · Documentar la condición — dónde cabe y cuántos caracteres

**Medido contra:** `origin/main` = `164d092dc8e955aa1b01ce254133a24553ce91d9` · 2026-08-21T12:40:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — mismo criterio R14.

**21-ago-2026** · **Carril:** B (landing) · **Gate:** el test corre en `npm test`; el medidor de
navegador **no** está enganchado a `pretest`

**Alcance:** tres scripts, un documento generado y un test. **`public/index.html` no se toca:**
toda la inyección de la medición ocurre en el DOM del navegador, sobre la página servida. **Ni una
palabra de la condición.**

---

## ⓪ La decisión que se ejecuta

De las tres salidas —corregir el copy · encender los medios (CONNECT-1) · **documentar la
condición**— el fundador eligió la tercera el 20-ago-2026. El copy se queda; se le añade lo que
falta. Lo que le faltaba a él para elegir la frase era **un número**, y es lo que hay aquí.

⛔ **Regla 30 aplicada literalmente:** ni el módulo ni el documento traen una redacción. Hay un
test que lo comprueba buscando las frases que uno escribiría «de ejemplo» y que acabarían
publicadas.

## ① Los diez, verificados 10/10

Identificador **derivado** del HTML (`sección/etiqueta#orden`), texto **literal**, comparado con
`===` y `Buffer.compare` contra el censo **y** contra el fichero. Cero `includes()`.

`como/p#4` · `todo/p#3` · `precios/li#3` · `precios/p#2` · `precios/p#4` · `probar/span#15` ·
`probar/span#16` · `probar/span#42` · `probar/span#44` · `faq/div#3`

## ② Dónde cabe · Edge, 360 y 1280 px

| sitio | caracteres en una línea |
|---|---|
| junto al texto | **6 – 43** |
| pie del bloque | **36 – 56** |
| pie de la sección | **45 – 187** |

**Dos números por sitio, y hacen falta los dos:** *«1 línea»* (lo que entra a esa anchura) y *«sin
mover»* (lo que entra **sin que la sección cambie de alto**). Un `0` en el segundo significa que
cualquier nota empuja lo de debajo.

El relleno de la sonda es **el propio texto de la unidad repetido**, así que «caben N caracteres»
son N caracteres de prosa como la que ya está ahí — no de una tira de equis con otra métrica.

### 🔴 Tres trampas que se comieron dos intentos

Quedan escritas en la cabecera del medidor porque cualquiera que vuelva a medir esto caerá en
ellas:

1. **`elementFromPoint` es relativo al viewport** y estas secciones están bajo el pliegue. Sin
   traer la sonda a la vista, se pregunta por un punto de otra parte de la página: salía
   **«tapada» en los 30 sitios**. Recortar las coordenadas al viewport no lo arregla — cambia la
   pregunta.
2. **Sin exigir que la sonda SE VEA**, el binario concluye «caben 400 caracteres» donde no se ve
   ni uno: un `<details>` cerrado o una caja de alto fijo se la tragan y la sección no cambia de
   alto. Los `<details>` del FAQ nacen cerrados —3 de 4— y hay que abrirlos para poder medir.
3. **La foto de táctiles hay que tomarla con el scroll FIJO.** Con la línea base sin desplazar y
   la sonda desplazando salían diferencias **negativas** («menos táctiles rotos que antes»), que
   es la señal de que se comparaban dos páginas, no dos estados de la misma.

## ③ Siete admiten nota; tres vuelven al fundador

| grupo | cuántos |
|---|---|
| ✅ admite nota **junto a la afirmación** | **7** |
| 🔴 **sólo al pie de la sección** | **3** |
| 🔴 no admite en ningún sitio | 0 |

🔴 **«Sólo al pie de la sección» cuenta como que NO admite condición.** Una nota a cuarenta líneas
de la afirmación no documenta nada: el cliente lee la promesa y decide antes de llegar. **La única
salida que les queda es cambiar el texto, y eso es suyo.**

Los tres son `probar/span#16` («Tarjeta, Bizum o transferencia.»), `probar/span#42` («Tarjeta») y
`probar/span#44` («Bizum»), los tres en la maqueta de la demo. En **#42 y #44 la sonda no llega a
verse** ni junto al texto ni en su bloque: los huecos miden 41–66 px.

⚠️ Y un aviso sobre los números de `#probar`: su «sin mover» a 1280 sale altísimo (277, 312, 320,
375) **porque el contenedor es rígido y se traga el texto**, no porque quepa. Ahí el dato bueno es
el de «1 línea».

**El umbral no es a ojo:** un hueco «da para una frase» si acepta **el doble de la palabra más
larga del propio texto**. Se deriva del texto que va a documentar, se declara para poder
discutirlo, y los números en crudo van al lado para quien no lo acepte.

### 🔴 El caso difícil, medido: `precios/li#3`

«Cobro con tarjeta, Bizum y transferencia», **en la lista de lo que incluye el plan, al lado del
precio**:

| sitio | 360 px | 1280 px |
|---|---|---|
| junto al texto | 21 car. | **6 car.** |
| pie del bloque (2.ª línea del `<li>`) | 36 car. | 52 car. |
| pie de la sección | 51 car. | 174 car. |

**Junto al texto no cabe:** seis caracteres a 1280, porque la lista reparte el ancho y la fila está
casi llena. Ahí sólo entra una **marca**, no una condición.

El hueco de verdad es **una segunda línea dentro del propio `<li>`** — pero **empuja** (sin mover:
0), así que la caja de precio crece.

⚠️ **Y esto hay que decirlo aunque no sea una medida:** una fila de la tabla de precios es donde el
cliente decide, y es donde peor entra un asterisco. **Que quepa no significa que convenga.** La
medida dice cuánto entra; si entra ahí o se cambia la fila, es del fundador.

## ④ El mecanismo — lo propongo yo, la frase la escribe él

| mecanismo | aporta | le falta |
|---|---|---|
| `<small>` inline junto al texto | se lee con la afirmación delante | el hueco más pequeño; 6 car. en `precios/li#3`, invisible en `#probar` |
| nota al pie del bloque | 36–56 car., sigue pegada | **empuja**: «sin mover» es 0 en casi todos |
| marca `*` + nota única al pie de la sección | cabe en los diez, incluidos los tres de `#probar` | el cliente decide **antes** de llegar |
| `aria-describedby` | lo anuncia el lector de pantalla sin ocupar sitio | **no lo ve quien mira**; la condición es comercial, no de accesibilidad. Complemento, nunca la salida |

## ⑤ 🔴 Una corrección a mi propia medida de ayer

Aplicando lo que pedía el encargo —releer los diez **con el texto literal delante**— aparece que
**`faq/div#3` no pertenece al grupo**:

> «Todo: presupuestos, firma y cobro, más clientes, proveedores, productos, gastos, informes y
> equipo. Es tu herramienta de gestión completa, no solo para cotizar.»

**No nombra ningún medio.** Dice que el producto incluye «cobro», y **cobro por transferencia
existe hoy**. Enumera nueve capacidades y las nueve están disponibles. **Mi veredicto de ayer fue
demasiado estricto.**

No la retiro del registro en este ticket porque reclasificarla exige declararle ancla a las nueve
capacidades, que es otro trabajo — pero el fundador debe saber que **de los diez, nueve son el caso
y una es un veredicto mío**.

El otro que no nombra medio, `probar/span#15` («Paga como quiera»), **sí pertenece**: es el rótulo
del paso 5 de la demo y la línea siguiente enumera los tres medios.

## ⑥ Verificación

**SUELO** — menos de diez falla **nombrando la diferencia**, y más también: *«hay copy publicado
nuevo que promete un medio que no existe»*. Y un segundo suelo: la medida congelada tiene que
cubrir los diez × 3 sitios × 2 anchos, o el hueco de uno sería **desconocido, no cero**.

**CONTROL POSITIVO** — cuatro textos publicados que no prometen medios (`todo/h2#1`, `como/h3#2`,
`precios/p#1`, `faq/div#4`) **no** están en la lista; y tres que sí prometen, **sí** están.

**ÁREA DE TOQUE** — **0 robos en los 60 sitios** (10 × 3 × 2 anchos), con el árbitro de SCRUM-562:
`closest`, y **desde el centro**. Nunca `elementsFromPoint().includes()`, que da por bueno lo que
otro tapa.
⚠️ En `#probar` había **4 táctiles que ya no reciben el toque antes de tocar nada**: los botones
con `visibility:hidden` que SCRUM-542 ya declaró como «presentes pero no tocables». **No los causa
la nota.**

**ROJO POR EL MECANISMO** — sobre `f35f3d5cbf2baa4154588c1b097c7fde61e72d4c`, con el fichero
verificado idéntico al **blob**:

| inyección | ¿cae? |
|---|---|
| reescribir uno de los diez (`precios/li#3`) | 🔴 sí |
| quitar uno de los diez («Bizum» → «Efectivo») | 🔴 sí |
| meter una afirmación de medios nueva en copy publicado | 🔴 sí |

Las tres veces la landing volvió **byte a byte contra el blob** y `git status` sale **limpio**.
**CR=0** con `Buffer` en los cinco ficheros.

**Tanda completa:** **3931 tests · 3854 pass · 0 fail · 77 skipped**.

## ⑦ Lo que NO se ha hecho

- ⛔ **Ni una palabra de la condición** (regla 30), con test que lo vigila.
- ⛔ **No se retira ni se reescribe ninguno de los diez.**
- ⛔ **No se toca ningún flag ni se enciende ningún medio.** Reglas 18 y 23.
- ⛔ **No se monta un censo nuevo**: se reutiliza el de SCRUM-551 + 558 + 555 y el árbitro de 562.
- ⛔ **El medidor no se engancha a `pretest`**: cuesta segundos de navegador y su salida es un dato
  para decidir, no una condición que deba bloquear el CI de nadie.

## ⑧ Abierto

⬜ **Los tres de `#probar`** — no admiten condición donde se leen. Vuelven al fundador.
⬜ **`precios/li#3`** — cabe como segunda línea del `<li>`, empujando. Que quepa no es que convenga.
⬜ **`faq/div#3`** — reclasificarla exige anclarle nueve capacidades. Otro ticket.
