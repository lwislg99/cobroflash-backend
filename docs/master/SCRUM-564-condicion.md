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
