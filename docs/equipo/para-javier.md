# Para Javier · 13-oct-2026, 15:00Z

> 🔴🔴 **URGENTE, CON LA CIFRA MEDIDA — 14-oct 16:15Z: `scrum1405c ④` os está tumbando el 31 % de los obligatorios, y a vosotros también.**
>
> Lo midió nuestra S3 leyendo los logs uno a uno. **Población declarada: los 42 obligatorios TERMINADOS desde que entró en #2429 (07:47:56Z).**
> · **Lo tumbó en 13 de 42 — el 31 %.** En **12** de ellos era **la ÚNICA causa**.
> · 🔴 **Y 3 de los 5 pushes a `main` salieron en ROJO por él** (`e2be1c9fd`, `0e8c20aff`, `5d076797d`).
> · **Control:** el job de nuestro #2441 sale como «sólo 1405c».
> · **Y el propio test lo dice:** aun con el módulo, **la cobaya pierde 3 casos de 320 en una de cada cuatro pasadas** — «la salida C no basta».
>
> **Hoy nos ha dejado cinco PR en rojo, uno de ellos el arreglo del defecto de seguridad que nos pasasteis vosotros: seis horas parado.** Entró relanzándolo una vez identificado como ajeno.
>
> ⛔ **No lo hemos tocado** (A7) **y no vamos a relanzar PR a ciegas.** **Nadie lo ha tocado desde las 07:47Z: ni un commit en `main` ni un PR abierto que lo toque.** Comprobado dos veces, por la mañana y ahora.
>
> ✅ **Y de paso, por si os sirve: tres de nuestros cinco rojos de hoy NO eran vuestros.** Eran del guard A9 de 1294, por líneas que faltaban en nuestros propios registros. **Lo comprobamos uno a uno antes de echaros la culpa.**

---


> ✅ **RESPUESTA COMPLETA a lo que nos avisasteis hace doce días (SCRUM-1409 ⑥) — 14-oct, 09:0xZ.** Lo midió nuestra S3 y lo recontó, no lo heredó de vosotros.
>
> **¿Puede un verde esconder un test que CAE? La respuesta corta: con lo que hay en el árbol, NO.**
> · **Se pierde el NOMBRE de un caído, no su VEREDICTO.** Los cortes C/D/F/J salen **1**; H sale 0.
> · 🔴 **PERO SÍ existen DOS formas que dan VERDE con un caso que cae: `process.exit(0)` a mitad, y `todo` / `t.todo()`.**
> · **Y el árbol las usa CERO veces** — censo por AST: **1.338 tests + 188 ayudantes + 387 importados**.
> · **Ya hay guard que las mantiene en cero:** `tests/scrum1520d-nada-calla-un-caido.test.mjs`, **visto en rojo con tres inyecciones reales**.
>
> ⚠️ **Y el dato de node que vosotros no teníais:** el corte **E** cuelga con **v24.8.0** (2 de 2) y no con **v24.18.0** (vosotros medisteis 1). **El CI corre v24.21.0 y eso NO está probado por nadie.**
>
> **Sobre vuestro SCRUM-1527 (la tanda que se cuelga), dos sondas independientes y el mismo resultado:** nuestra S3 midió **5 colgadas en 160 jobs antes de #2429, y 4 de ellas son LAS MISMAS que encontró J6 en vuestro #2440**. Después de #2429: **0 de 15**, que **con una tasa del 3 % no prueba nada** — hace falta recontar con ~100, y lo estamos haciendo. **No afirmamos que sea el cuelgue de E:** las versiones de node no cuadran.

---


> 🔴 **URGENTE — 14-oct, 08:50Z · LEEDLO ANTES QUE NADA: `main` ESTÁ EN ROJO POR UN TEST VUESTRO Y SE LLEVA POR DELANTE LA MITAD DE LOS PR DE LOS DOS EQUIPOS.**
>
> **Desde el merge de #2429 (SCRUM-1405c).** Lo midió nuestra S3 leyendo los logs uno a uno, y lo he verificado yo:
> · **El push a `main` de las 07:47:59Z (job 115745209265): fail 1.**
> · **De los 9 obligatorios con resultado posteriores a #2429, CINCO caen con fail 1**, 3 verdes y 1 cancelado. **Es intermitente.**
> · **Siempre el mismo caso:** `tests/scrum1405c-tuberia-bloqueante.test.mjs:201` — «④ EL ROJO PRIMERO: sin el módulo la cobaya PIERDE casos; con él, ninguno».
> · **El mensaje del propio guard, en Linux:** «con el módulo la cobaya SIGUE perdiendo casos: la salida C no basta». **Con el módulo, 3 de 4 pasadas dan 320 de 320 y una da 317.**
>
> **NO LO HEMOS TOCADO** (A7: es vuestro carril) **y no vamos a relanzar PR para sacarles el verde**, porque eso convierte un defecto medido en ruido.
>
> ✅ **Y de paso os damos la respuesta a la pregunta grande, medida y recontada por nosotros, no heredada:** lo que se pierde es **el NOMBRE de un caído, no su VEREDICTO** — los cortes con un caído salen **1** por el código de salida del hijo. **Un verde NO esconde un rojo.**
> ⚠️ **Con una excepción que no teníais: con `node v24.8.0` el corte que parte el MENSAJE del fallo CUELGA la cadena (2 de 2).** Vosotros medisteis 1 con `v24.18.0`. Un cuelgue sale `failure` a los 900 s — no esconde nada, **pero cuesta 15 minutos de CI cada vez**.

---


Lo manda el orquestador del equipo de Luis. Todo lo de aquí está **medido**, y cada punto dice por quién y contra qué. Donde no lo sabemos, lo dice.

Orden: primero lo que un cliente puede estar viendo mal **hoy**, luego lo que os cuesta tiempo, luego las preguntas cortas.

---

## 1 🔴 El PDF dice «IVA NO INCLUIDO» en un total que SÍ lleva el IVA dentro

**Lo midió S4 corriendo las funciones reales, no leyendo el código.** Con el presupuesto en «IVA no incluido», el PDF imprime **«Total 121,00 · IVA NO INCLUIDO»** — y esos 121,00 son los 100 más el IVA.

Y hay una segunda mitad que lo empeora: **la página web del cliente dice «IVA incluido» para el mismo total**. Así que el mismo importe se presenta de las dos formas según dónde lo mire.

- **Es un documento que ve el cliente final** afirmando algo falso sobre un importe.
- Toca **`pdf.service.ts`, carril J1**, y está en el **camino de emisión**: ninguna sesión nuestra lo puede modificar (nuestras reglas 38 y 40 lo prohíben, sólo leer).
- **No hemos tocado nada.** Lo que necesitamos es que decidáis el arreglo: si el total es con IVA, el rótulo tiene que decirlo; si el rótulo es correcto, el total está mal calculado. **Las dos lecturas tienen víctima, así que no lo elegimos nosotros.**

---

## 2 🔴 SCRUM-1445 · las fechas que se imprimen van en la zona del proceso (UTC)

**Un albarán de las 00:30 lleva la VÍSPERA en el concepto de su factura.**

- **17 sitios ya censados** en SCRUM-1093h. De los ocho que se midieron al repartirlo, **cinco son vuestros: J1 2, J2 2, J3 1**.
- Por eso **lo hemos declarado CRUZADO y sin área**, con el motivo escrito en el ticket: un ticket que no cabe en un área no se fuerza a una etiqueta. **Va a vuestro orquestador para que lo partáis o lo cojáis entero.**
- Es una fecha equivocada en un documento que ve el cliente, así que no es cosmético.

---

## 3 · `scrum1515` tumba a `scrum17`, y le va a pasar a cualquiera que siembre merchants

**Medido por S3 en 20 pasadas:** `scrum1515` y `scrum17` se pisan **9 de 9 veces a concurrencia 4**.

- **La causa está en `scrum1515` línea 163: cuenta la tabla ENTERA**, no sólo sus propias filas. Mientras cuente así, **cualquier test que siembre un merchant en paralelo lo tumba** — hoy es el nuestro, mañana es el vuestro.
- **Lo que pedimos: que `scrum1515` cuente por su propio sello.** Descartamos la alternativa (darle un paso aparte en `ci.yml`) porque **esconde el defecto y cuesta minutos de CI para siempre**.
- **S3 dejó su propio PR (#2392) en BORRADOR a propósito**, para no tumbaros el check obligatorio mientras lo decidís. Tenía el trabajo terminado y no lo metió.
- **No hemos abierto ticket en vuestro carril.** El texto con su aceptación está en **SCRUM-876, comentario 19431**, listo para copiar.

---

## 4 · SCRUM-1247 · una pregunta que sólo podéis contestar vosotros

La ficha `docs/microcopy/2026-09-28-SCRUM-1247-rotulo-ia.md` es **el aviso de adónde van los datos del asistente de IA**. La firma vuestro orquestador (comentario 17425, cuenta de Javier), **el ticket lleva las etiquetas `legal` y `privacidad`**, y **la delegación de firma del 22-sep excluye los textos legales**. El texto **está en pantalla**.

- **Si ese texto es «legal» o no lo decidís vosotros.** Vuestro orquestador escribió que no lo era; nosotros no opinamos.
- **Lo que sí afirmamos, y es de nuestro lado:** nuestro oráculo de microcopy **no puede hacer esa pregunta**. S0 lo midió: **sin ninguna línea de Javier en el fichero, 131 de 131 fichas siguen saliendo «aprobadas»**, y **21 de las que están en vuestros tickets las aprueba la viñeta de Luis**. Es un instrumento que aprueba por una regla que no comprueba.
- **Lo estamos arreglando por nuestro lado sin tocar vuestro criterio:** el oráculo pasará a distinguir «aprobado» de «aprobado por una delegación que NO puedo comprobar». **Vuestra delegación es vuestra y no la cambiamos.**

---

## 5 · La pregunta de los ALTER, ahora concreta

**Esto lleva semanas confundido en los dos lados, y acabamos de medir por qué.** Hay cuatro tickets que siguen con la etiqueta `esperando-alter`:

| ticket | equipo | estado hoy |
|---|---|---|
| SCRUM-1056 | equipo-luis | **Tareas por hacer**, y con `listo-para-construir` a la vez — y nosotros ya hemos construido y mergeado su primera mitad |
| SCRUM-1072 | equipo-luis | Tareas por hacer |
| SCRUM-1146 | equipo-luis | Tareas por hacer |
| SCRUM-930 | equipo-luis | 🔴 **Finalizada desde el 7-oct, y sigue etiquetada `esperando-alter`** |

**La etiqueta de 930 está claramente caduca, así que no nos fiamos de ninguna de las cuatro.**

**Lo que necesitamos es una lista, no un debate: de estos ALTER, ¿cuáles están ya aplicados en las tres bases y cuáles no?** Con eso quitamos las etiquetas caducas y desatascamos lo que se pueda construir hoy. **Nosotros no podemos mirarlo**: ninguna sesión nuestra tiene credencial de producción, y `yaqu_dev_javier` es vuestra.

- Aparte: **SCRUM-914** es **nuestro** (`equipo-luis`) pero su propio título dice «para el ALTER de Javier». Entra en la misma lista.

---

## 6 · SCRUM-1507 · atascado entre los dos equipos, y es UNA línea

«UNA línea en `src/core/cron/cron.ts` para programar el reintento de sellado de SCRUM-1404 — el mecanismo ya está construido y no se puede activar sin ella.»

- Lleva las etiquetas **`equipo-javier` Y `equipo-luis`**, más `esperando-s1`.
- **Nuestra S1 tiene `cron.ts` DENEGADO** por su clasificador de permisos: no puede escribir esa línea aunque quiera.
- Así que **el mecanismo está construido y apagado porque nadie puede tocar el fichero.** Decidid quién escribe la línea y lo desbloqueamos — es trabajo de un minuto cuando se sepa de quién es.

---

## 7 · Dos cosas de vuestro tablero que no son lo que dice la etiqueta

- **SCRUM-529** lleva `equipo-javier`, pero **su propio título dice «diff preparado y PARADO, decide el fundador»**. O sea: **no os está esperando a vosotros**. Lo decimos para que no os ocupe sitio.
- **Vuestros 31 tickets en «En curso»** llevan más de cuatro días sin tocarse. No los podemos mover nosotros.

---

## 8 · Nueve tickets vuestros que YA están hechos en `main`

**1345 · 1477 · 1478 · 1481 · 1510 · 1335 · 1331 · 1088 · 1292.**

⚠️ **Con su aviso, y va tal cual:** la lista la hizo S0 por efecto en el árbol y **declara que NO leyó ninguna aceptación**. O sea: el código está, pero **nadie ha comprobado que cumpla lo que el ticket pedía**. No los cerréis por esta lista: usadla para mirarlos.

---

## 9 · Dos que siguen donde estaban

- **SCRUM-1316 · el IVA del 10%: VENCE EL 1 DE DICIEMBRE.** Es vuestro y no lo hemos tocado.
- **`connect.routes.ts:70`** puede estar enseñando el texto de Stripe **en inglés** a quien va a pagar. Es vuestro carril y toca el camino del cobro, así que no entramos.

---

---

## 10 · SCRUM-1126 está TERMINADO y lleva 13 días en «En curso». Lo único que falta es mover el estado

Vuestro orquestador **escribió el comentario de cierre el 29-sep** (c.17592: PR #1988 mergeado, `51d81311`), **y el estado nunca se movió.** Sigue «En curso» desde el 30-sep.

Ese comentario dejaba dos restos declarados. **Los he comprobado yo en `origin/main`, y los dos están aplicados:**

| resto declarado | medido hoy en `main` |
|---|---|
| el singular de «Contados» (firmado en c.17580) | **aplicado**: `customerDetailView.js:142`, `const uno = (n, singular, plural) => …`, y su comentario cita «SCRUM-1126 c.17580» |
| «direcciones de obra» en la lista de lo que se mueve (firmado en c.17647) | **aplicado**: aparece en la frase |

**O sea: no le falta trabajo, le falta un clic.** No lo cierro yo porque es vuestro (`equipo-javier`, `area-j2`), pero ahí va con la evidencia para que os cueste diez segundos.

⚠️ **Un cuidado que midió nuestra S5 después de escribir esto, y que cambia el «diez segundos»:
**2 de los 4 commits de SCRUM-1126 en `main` y 2 de sus comentarios son POSTERIORES a ese comentario de
cierre del 29-sep.** Que sus dos restos declarados estén aplicados **no prueba** que el ticket no haya
ganado alcance después. **Mirad eso antes de darle el clic**, no lo cerréis por nuestra lista.

**Y lo digo porque es mi mismo fallo, no para señalar:** hoy yo he escrito dos comentarios de cierre sin mover el estado (SCRUM-1443 y SCRUM-1528), y lo cazó el fundador preguntando. La consulta que lo encuentra, por si os sirve, es una sola:

```
project = SCRUM AND statusCategory != Done AND text ~ "\"CERRADO por el orquestador\""
```

Me ha devuelto dos: éste y SCRUM-1538, que **no he comprobado** y dejo dicho sin verificar.

---

## 11 · SCRUM-1132: hay una pantalla vuestra CONSTRUIDA desde el 25-sep en un disco de esta máquina, sin empujar

Salió de un barrido que hice al cerrar la tanda: miré **los 107 árboles de trabajo** buscando commits que **no estén en ningún remoto**. 99 están a salvo; 8 no. Uno de los 8 es éste:

```
6803e3e9b   25-sep 20:59   SCRUM-1132: pantalla de notas del cliente (fecha + autor)
rama:       scrum-1132-notas-cliente-pantalla
toca:       public/dashboard/js/customerDetailView.js  (+77 / -1)
            docs/master/SCRUM-1132.md                  (+24)
```

**Y SCRUM-1132 sigue en «Tareas por hacer»**, con `equipo-javier`, `area-j2` y `listo-para-construir`. Su propio título dice que *SCRUM-1036 se cerró Finalizada sin su pantalla*.

**Lo que afirmo y lo que no:**
- **Afirmo** que existe ese commit, con esa fecha, tocando ese fichero con esas líneas, y que **no está en ningún remoto**. Lo he medido.
- **NO afirmo** que esas 77 líneas estén completas, ni que funcionen, ni que valgan. **No las he abierto.**
- `customerDetailView.js` es vuestro (`area-j2`), así que **no lo toco ni lo empujo yo**.

**Lo que os pido:** que alguien de J2 **lo mire antes de volver a construir la pantalla desde cero**. Si sirve, son 18 días de ventaja; si no sirve, se tira y al menos deja de ser una duda.

⚠️ **Y el aviso que va con esto:** ese commit vive en un árbol de trabajo de esta máquina. **Una herramienta que borre ramas por equivocación se lo lleva para siempre** — es exactamente el riesgo de **SCRUM-1540**, abierto en nuestro lado. Mientras eso no esté cerrado, nadie debería limpiar árboles a ciegas.

*(Los otros siete del barrido: uno es mío y su contenido ya está en `main`; dos son trabajo declarado como `wip`; tres son correcciones pequeñas de finales de septiembre; y uno es de hoy, de nuestra S4, ya avisado.)*

---

## Lo que hemos hecho nosotros hoy, por si os cruza

**Cerrados:** 997, 1480, 1443, 1379, 1152, 1286, 1284, 963, 1528, 1482, 1366, 1372, 876, 1288, 1357.
**Abierto, y es el único:** **SCRUM-1545** (plantilla de 3 opciones), partido de 1188 con su aceptación medida.
**En producción hoy:** el empate al crear revisiones · el id de tabla que se enseñaba como número de presupuesto · sustituir una plantilla por su nombre · «Volver a llamar».

---

## 8 · SCRUM-1056 · NUESTRA MITAD ESTÁ TERMINADA Y EL RESTO ES 100 % VUESTRO

La pieza **«Volver a llamar»** está construida, probada y **en producción** (`clienteVolverALlamar.js`, servido por `yaqu.app`). **Pero no la monta ninguna pantalla**, así que **ningún profesional puede llegar a ella hoy.**

**Medido hoy por nuestra S2 y verificado por mí sobre `origin/main`:**
- A `clienteVolverALlamar` sólo la nombran **`index.html:255`** (la carga) y **`sw.js:44`** (la cachea). **Ninguna vista la monta.**
- El propio comentario de `index.html` dice quién la montará: **`customersView.js` y `customerDetailView.js`**.
- **`dos-equipos.md` §3.2, fila 144: esos dos ficheros son de J2.** Comprobado leyendo la columna de dueño.

**O sea: las dos pantallas donde hay que montarla son vuestras, y no hay ninguna tercera.** Nosotros no la montamos — no es nuestro carril y la sesión se negó a saltárselo, como hicisteis vosotros con `src/**` en SCRUM-1555.

**Lo que os dejamos hecho:** la pieza entera con su API (`root.clienteVolverALlamar`), sus textos ya firmados y sus tests. **Montarla debería ser poco más que llamarla.**

---


---

## 2bis · SCRUM-1555: CERRADO POR NUESTRO LADO EN UNA MAÑANA — y tres cosas vuestras que salieron de ahí

✅ **Las OCHO rutas cerradas, `FUGAS_CONOCIDAS` vacía, y reproducido ANTES en un Postgres desechable** (no leído). Un Técnico ya no puede abrir, aceptar ni rechazar el presupuesto de otro. **PR #2456.** Falta verlo en producción con una cuenta de Técnico, y entonces lo cerramos.
**Gracias por medirlo por efecto y por dejarnos el `fichero:línea` de las ocho.** Con eso fue una mañana y no una semana.

🔴 **① El trinquete que decíais haber dejado en `main` NO estaba en `main`.** Vivía en **#2437, abierto y con el obligatorio en ROJO**. *(El fallo de habeos creído sin comprobar es mío, no vuestro — lo repetí a mi equipo como si fuera un hecho.)* **Consecuencia real: nuestra S1 montó 1555 encima de esa rama, así que #2456 arrastra vuestros 3 ficheros y heredará su rojo si lo tiene.** Si podéis desatascar #2437, nos desatasca a los dos.

🔴 **② `scripts/cotejo.cjs` NO EXISTE en `main`.** Lo medimos al mirar vuestro SCRUM-1556: os habéis adjudicado uno de los tres instrumentos sin dueño **que no está en el repositorio**. Los otros dos sí.

✅ **③ Y la buena: nuestro PR #2434 NO toca `dos-equipos.md`** — ni filas, ni formato, ni el lector. **No hay choque con vuestro 1556: escribid cuando queráis.**

---

## 2ter · UNA LÍNEA VUESTRA QUE NOS FALTA: el bot de WhatsApp y los presupuestos archivados

Estamos construyendo **archivar presupuestos** (SCRUM-1273). Decisión nuestra: **si el cliente DECIDE sobre uno archivado, el servidor lo DESARCHIVA**, para que **un presupuesto ACEPTADO nunca quede invisible en la lista del profesional**.

🔴 **Eso sirve por la landing web. Por el BOT de WhatsApp, no** — y ese camino es de J2.

**Hasta que pongáis vuestra línea, un cliente que acepte por WhatsApp un presupuesto archivado deja al profesional con un compromiso que no ve.** No lo tocamos: es vuestro carril. **Es una línea en el punto donde el bot escribe la decisión.**

---


---

## 12 🔴 UN DEFECTO MEDIDO EN PRODUCCIÓN, EN UN FICHERO VUESTRO: la landing salta a 360 px

**`public/index.html` es de J3** (`docs/equipo/dos-equipos.md:147`), así que esto es vuestro y **no lo tocamos**. Os lo pasamos medido y con la causa **sin identificar**, que es justo lo que os ahorra la tarde que hemos perdido nosotros.

**Qué está pasando.** El job «guards de navegador» del CI está en **rojo en `main`**, y lo lleva todo el día: de las **cuatro** corridas de CI que terminaron hoy en `main`, el job sale `failure` en las **cuatro** (09:18, 09:51, 15:58 y 16:17Z). **Nadie lo ha visto porque ese job es informativo y no bloquea el merge.** De sus dos rojos, uno es nuestro (un doble de test que se quedó viejo, ya arreglándose). **El otro es éste.**

**`guard:cls-barra-anuncio` · 3 hallazgos, los tres a 360 px de ancho:**

| caso | ancho | CLS | cuándo salta | barra |
| --- | --- | --- | --- | --- |
| `vendidas` | 360 px | **0,127** | 634 ms | visible (116 px) |
| `cero` | 360 px | **0,127** | 634 ms | visible (116 px) |
| `roto` | 360 px | **0,125** | 633 ms | **OCULTA** |
| los tres | 390 px | 0,042-0,043 | ~631 ms | — |

El límite es 0,1. **A 390 px está verde y a 360 px está rojo**, que es el ancho de un móvil corriente.

🔴 **Y AQUÍ VA LO IMPORTANTE, QUE ES UN ERROR NUESTRO YA DESCARTADO.** Nuestra primera lectura fue «la barra de oferta pasa a dos líneas a 360 px (116 px en vez de 95) y por eso salta», y la conclusión habría sido reservarle la altura. **Es falsa, y la contraprueba está en la propia tabla: en el caso `roto` el CLS es 0,125 con la barra OCULTA.** Si salta igual sin barra, **la barra no es la causa**. Y reservarle hueco dejaría, en `roto`, un vacío permanente — que es exactamente lo que ese guard prohíbe. **Lo midió nuestra sesión de frontend y nos corrigió; nosotros lo habíamos deducido de la correlación de alturas sin medirlo.**

**Lo que queda por averiguar, entonces:** qué elemento se desplaza hacia los **633 ms** y sólo a 360 px, con barra o sin ella. Candidatos que NO hemos comprobado: una fuente que carga y recoloca, o algún bloque que pasa de una línea a dos sólo en ese ancho. **No lo sabemos y no lo afirmamos.**

**Cómo lo veis vosotros:** `npm run guards:visuales` y mirad `guard:cls-barra-anuncio`, o el log del job «guards de navegador» de cualquier corrida de CI de `main` de hoy.

**No hemos abierto ticket.** El fichero es vuestro y este documento es el canal; si queréis uno en el tablero, lo abrís vosotros con vuestro número. **Lo pasamos porque la landing es lo que vende y está en producción así.**

---

## 13 🔴 EL MAPA DEL ENVÍO A LA AEAT ESTÁ HECHO POR VOSOTROS Y NO LLEGÓ A QUIEN PREGUNTÓ

**Esto es un fallo de nuestro lado, no vuestro, y lo contamos entero porque la cura es de los dos.**

El fundador preguntó el **13-oct** qué falta para que nuestro software mande a la AEAT. **`jv-j5c` entregó el mapa completo doce horas después** (SCRUM-1531 c.19221, los cinco puntos, medido por AST) y **`jv-j2i` lo verificó** (c.19349). **Trabajo impecable.**

**Y el 14-oct, un día entero después, el fundador seguía sin tener la respuesta, y yo mandé a una sesión nuestra a rehacer el mapa.** Nos paró S1 midiendo que ya estaba hecho — y midiendo además que **el carril es J1, no nuestro** (`dos-equipos.md:55` y `:117`). **Dos errores míos: repartí un ticket hecho y en vuestro carril.**

🔴 **La causa la había escrito `jv-j2i` en su propia verificación, literalmente: «quien no abra este ticket no los ve».** Lo midió con controles: `SCRUM-1531` sale **0 veces** en el contenido de `main`, **no existe `docs/master/SCRUM-1531.md`**, **0 commits**, **0 ramas** (control positivo con `SCRUM-1529`: sale en `docs/master/` y da 9 commits). **Vuestra sesión diagnosticó el problema y nadie actuó sobre su diagnóstico.**

**Lo que pedimos, y es de J1:**

1. **Subir el mapa al repositorio**, en `docs/master/SCRUM-1531.md`. Es lo único que impide que vuelva a pasar. Un mapa que vive en un comentario de Jira lo encuentra quien ya sabe que existe.
2. 🔴 **Actualizar su sección A con el SELLO DE ENTIDAD.** La sección A es **anterior** a c.19272 y hoy se ha quedado corta en lo más importante: su **A4** dice «la dirección del entorno de pruebas, variable `VERIFACTU_AEAT_ENDPOINT`», pero c.19272 añade que **el sello de entidad se admite para el SERVICIO WEB y exige un ENDPOINT ESPECÍFICO** — o sea, **con sello la dirección NO es la misma**, y el propio comentario dice que «ninguna medición de hoy contemplaba eso».
3. **La revisión que pide c.19272 y que no tiene ticket ni commit:** cualquier documento nuestro que diga que **«firmamos»** los registros en modo VERI\*FACTU debe revisarse, porque en ese modo **lo que hay es autenticación por canal seguro, no firma por registro** (la firma XAdES es del modo NO VERI\*FACTU, art. 14 de la Orden). ⚠️ **`jv-j2i` buscó la palabra «firmamos» y dio cero, y declaró el límite de su propia medida: «eso mide UNA palabra, no la idea».** Hace falta mirarlo por idea, no por palabra.
4. **Y el dato que cambia el plan, por si no ha circulado:** las pruebas aceptadas que constan se hicieron con el **NIF personal del fundador y su certificado personal**. En cuanto el obligado sea la S.L., **esa pareja deja de cuadrar** salvo apoderamiento inscrito. Lo tenéis en c.19272.

## 14 · DOS COSAS VUESTRAS QUE NOS HEMOS ENCONTRADO AL CRIBAR

· **SCRUM-1056 · la mitad que queda es 100 % vuestra y NO TIENE NI TICKET NI RAMA en vuestro tablero.** Las líneas 1, 2, 3 y 6 son de J2 y J3 (montar la pieza, las rutas, anonimizar, la captura). **Nuestra mitad está terminada y en `main`** (1056c y 1056d, #2401 y #2458), y la pieza `clienteVolverALlamar` **no la monta ninguna vista**: las dos pantallas donde habría que montarla —`customersView.js` y `customerDetailView.js`— son de J2 (`dos-equipos.md` §3.2, fila 144).
· **SCRUM-1505 es vuestro** (lleva `equipo-javier`) y **vuestro propio orquestador escribió en c.18845 que su titular era falso**, mientras el ticket sigue diciendo «CENSADO: 0 tickets mal clasificados». **Lo dejamos en vuestra mano: nosotros no cerramos tickets vuestros.**

---

## 15 🔴 SCRUM-1507 · NO ES «UNA LÍNEA» Y NO ES NUESTRA: es la tercera pieza de un PR-2 VUESTRO que no existe

**Lo traemos porque está en nuestra lista de «lo que bloquea vender» y hoy hemos medido que ahí no debería estar.** Un sellado VeriFactu que falla **se queda sin sellar**, y el mecanismo del reintento **está construido y no corre**.

**Lo que creíamos:** que faltaba **una línea** de cron y que el fundador ya había dado el sí. **Las dos mitades son falsas, y lo ha medido nuestra S1 parándose antes de tocar nada:**

| lo que creíamos | lo medido |
| --- | --- |
| «es una línea en `cron.ts`» | El bloque está sólo en `cron.ts`, **pero no puede entrar solo**: importa `src/modules/invoicing/domain/reintentoSellado`, que es **J1 y camino de emisión** |
| «y con eso funciona» | **No**: sin la fecha no hace nada — `REINTENTO_ACTIVO_DESDE` sigue a `null` (`reintentoSellado.ts:74`). Vuestro c.19406 ya lo midió: la tarea sola contesta «inactivo», con 0 accesos a la base |
| «se puede meter ya» | **Pone ROJO el obligatorio**: `tests/scrum1404b:134` exige `assert.deepEqual(importan('reintentoSellado'), [])`, con «fecha + cron + respuesta, **los tres a la vez**». Pasarlo exigiría cambiar **vuestro** guard, y eso es la regla 41 |
| «el PR-2 está en marcha» | **No existe: 0 ramas remotas** con `1404`, `1507` o «reintento» (control positivo: la rama viva de `1302s` sí sale) |
| «el fundador dio el sí» | El «Sí te lo doy» vive en **SCRUM-1507 c.19511, escrito por vuestro orquestador**, y ese mismo comentario dice **literalmente** que «no autoriza … ni el bloque de `cron.ts` — eso es S1 y va por su GO propio». **Lo pasamos como autorización del fundador y no lo era. El error es nuestro** |

**Qué hace falta para que esto se mueva, y los tres primeros son vuestros:**

1. **Que abráis el PR-2 con la FECHA y la RESPUESTA.** Sin esas dos piezas, la nuestra no puede entrar ni sola ni acompañada.
2. **La decisión de jefes que sigue sin tomarse** (vuestro c.19511): **¿PR-2 entero o partido?**
3. **El nombre de la rama**, para que nuestra S1 empuje ahí su commit de `cron.ts` — o el cruce declarado, como queráis llevarlo.
4. **Sólo entonces** tiene sentido que lo intentemos: a una sesión nuestra de S1 ya le **denegaron** editar `cron.ts` el 13-oct («Production Deploy»), e intentarlo hoy en rama propia daría un PR rojo por vuestro guard.

🔴 **Y un dato de diseño que sale de esto y que conviene que miréis antes de cerrar el PR-2:** el bloque pide **cada minuto** (`* * * * *`, de vuestro c.19344). **Sería el primer cron de la casa por debajo de una hora** — las seis programaciones de hoy son `0 * * * *`, `0 10 * * *` (×2), `0 9 * * 1`, `0 8 * * *` y `15 3 * * *`. **Y `noOverlap` no protege entre PROCESOS**: con varias réplicas corriendo crons en producción, dos podrían reintentar el mismo sellado a la vez. **Eso no está medido por nadie.**

## 16 🔴 LAS TRES FRASES DE LA LANDING: FIRMADAS. El fichero es vuestro, así que las aplicáis vosotros

**Qué es esto.** De los cuatro textos falsos de `public/index.html` que levantó SCRUM-1236, **dos los firmó el fundador el 14-oct** (c.19607 y c.19608) y están esperando que los apliquéis. **Las otras tres las ha firmado el orquestador de Luis hoy**, 16-oct-2026, **con delegación expresa del fundador**:

> **«NO SE que dices de las fimas hazlo tu ni lo del movil»** — turno del fundador, 16-oct-2026, transcripción `ed676fd1-feb4-4658-bda2-01f4bf9fb3fc`.

**No son tres arreglos iguales: cada una tiene un motivo distinto, y uno de los tres es NO tocarla todavía.**

| # | línea | qué dice hoy | qué se hace | por qué |
|---|---|---|---|---|
| 1 | `index.html:739` | «Únete a los profesionales que cierran más trabajos sin perseguir presupuestos.» | **SE QUITA el `<p>` entero** | Es prueba social, y **hoy no hay ni un cliente**. No se reescribe: **se quita**. Quitar no necesita ninguna palabra nueva firmada, y el `<h2>` «Tu próxima cotización, lista en 30 segundos» con el botón «Empezar gratis» se sostienen solos. Cuando haya profesionales, vuelve con una cifra detrás. |
| 2 | `index.html:638` | «Cobros — Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado…» | **NO se toca hoy: va a la PUERTA DE GO-LIVE (SCRUM-1554)** | Es falsa **sólo porque lo que promete no está encendido todavía** (Stripe Connect, y en España `INVOICING_ES_ENABLED` en OFF). Eso es exactamente lo que la regla 43 manda agrupar y firmar en bloque antes de vender, **en vez de interrumpir al fundador frase a frase**. ⚠️ **Pero que no se pierda: con el cobro apagado, la tarjeta Y el Bizum Y la transferencia son promesa, no producto.** |
| 3 | `index.html:432` | `aria-label="Demostración: de presupuesto a cobro"` | **Pasa a `aria-label="Demostración: de presupuesto a firma"`** | **Ésta sí se arregla hoy, y no depende del go-live.** La demo que hay DENTRO de ese bloque termina en «Firmado. Presupuesto cerrado.» — sus cuatro tiempos son 30 s, WhatsApp, firma y cerrado. **No llega a ningún cobro.** O sea: no es una promesa de producto, es una etiqueta que no describe lo que hay debajo de ella. **Las palabras nuevas no afirman nada nuevo: dicen lo que ya se ve.** |

🔴 **Lo que NO es esto.** No es una propuesta: las tres están decididas. **Lo que sí es vuestro es el fichero** — `public/index.html` es de J3 por `dos-equipos.md` — y por eso ninguna sesión nuestra lo toca. **Si alguna os parece mal, decidlo y se discute; pero no se queda a medias por silencio.**

· **Y una del mismo fichero que ya os pasamos y sigue abierta: el salto de la landing a 360 px (sección 12), con la causa declarada DESCONOCIDA** y la contraprueba dentro (sigue dando 0,125 **con la barra escondida**, así que la barra no lo explica). **El fundador también nos delegó «lo del móvil» en el mismo turno, y nuestra decisión es ésta: no lo perseguimos más, porque es vuestro fichero y nuestra medida ya está entregada entera.** **Si queréis nuestro banco para reproducirlo, os lo pasamos.**

## 17 🔴 DOS CONTROLES VUESTROS A 31 px, MEDIDOS · y un guard nuestro se va a poner rojo por ellos

**Qué ha pasado.** Nuestro banco de pantallas **perdía nodos** al serializar: un atributo puesto por propiedad JS (`a.href = …`) no salía, una casilla nacida del marcado salía como caja de texto, y un botón con texto más icono perdía el texto. **Arreglado** (SCRUM-1559). Al verlo todo, aparecieron controles que **siempre** estuvieron por debajo del mínimo y que nadie podía ver.

**De los que aparecieron, dos son de ficheros VUESTROS**, así que no los tocamos:

| control | fichero | dueño | medida |
|---|---|---|---|
| «⬇ Clientes CSV» (`A.btn-secondary.btn-sm`) | `customersView.js:118` | **J2** | **31,0 px** a 929 **y** a 390 |
| «⬇ CSV» de Facturas (`A.btn-secondary.btn-sm`) | `invoicesView.js:196` | **J1** | **31,0 px** a 929 y a 390 |
| casilla de Facturas (`INPUT` del marcado) | `invoicesView.js` | **J1** | **14,0 px** a 929; no se pinta a 390 |

⚠️ **Y lo que os afecta aunque no lo arregléis hoy: cuando entre nuestro arreglo del banco, `guard:objetivo-tactil` pasará de 0 a 2 hallazgos y se quedará en ROJO por el primero.** **Es informativo, no es el check obligatorio, y el rojo es VERDAD** — ese botón siempre midió 31. ⛔ **Que nadie lo «arregle» por el lado del guard: la regla 41 dice que se arregla el código.**

🔵 **El arreglo ya está resuelto de nuestro lado y os lo damos medido:** el patrón de **SCRUM-1158c** (PR #2513, ya en `main`) es **una regla acotada que lleva ese `.btn-sm` concreto a 44 px sin tocar el `.btn-sm` global** — que es la decisión ③ de SCRUM-786 y evita el rediseño en cascada. **Nuestra S2 lo aplicó a 18 controles y lo midió en yaqu.app: 20 de 20 pasaron de 30 a 44 px, a 390 y a 929.**

· **Lo que NO hay que tocar, para que no perdáis el tiempo:** los teléfonos `A.contacto-link` (41,8 a 929 / 45 a 390) y los tres «💬» (37,0 / 45) **CUMPLEN** contra el umbral que aplica el guard en escritorio (36 px, por `DESIGN.md`). Sólo salen «cortos» contra el 44 del censo, que es otra medida.
· **Decisión del orquestador de Luis, 16-oct-2026.** Nosotros medimos y os lo pasamos; el fichero es vuestro y el arreglo también.

**18-oct-2026 · lo de arriba ya ha pasado: el guard está en ROJO por vuestro botón.** Nuestro arreglo del banco entró, y `guard:objetivo-tactil` sale **1, con 2 hallazgos y 0 ciegos**. Uno de los dos es **«⬇ Clientes CSV»** (`customersView.js:118`, **J2**): **31 px de alto, por debajo de 36 a 929 y de 44 a 390**. Lo midió nuestra S3 hoy; nos lo pasa el orquestador, y no lo hemos vuelto a medir. Sigue siendo informativo y no el check obligatorio. ⛔ Y sigue valiendo lo de antes: el arreglo va en el código, no en el guard (regla 41).
## 18 🔴 `scrum1405c ④` NOS TUMBA OBLIGATORIOS TODOS LOS DÍAS · con la lista de cuándo

**Qué es.** El caso ④ de `tests/scrum1405c-…` («🔴 EL ROJO PRIMERO: sin el módulo la cobaya PIERDE casos; con él, ninguno»). **Es vuestro.** Falla **intermitentemente**: una vez de ~11.600 tests, y cuando cae tumba el check obligatorio de quien pasara por ahí. **Nosotros no lo tocamos y no proponemos tocarlo: os lo contamos con la cuenta.**

**Lo que nos ha costado, con nombre y PR. Esto NO es una impresión:**

| cuándo | dónde | qué pasó |
|---|---|---|
| 15-oct | **cinco de nuestros seis puestos** | sus obligatorios cayeron por este test el mismo día |
| 16-oct | **#2449** (archivar) | sus **dos últimos** obligatorios cayeron por él |
| 16-oct | **#2495** (presupuesto adicional) | rojo por él; entró tras **un relanzamiento** |
| 16-oct | **#2505** | 1 fallo de **11.634**, y el log decía **heap OOM** |
| 16-oct | **#2512** | rojo sólo por él; el commit entró por otra rama |
| 16-oct | **#2523** | medido por nosotros: `not ok 2804 - SCRUM-1405c · ④` y **nada más** |

**El coste real no es el rojo: es lo que hace con la gente.** Un rojo intermitente **enseña a relanzar sin mirar**, y el día que caiga un rojo de verdad lo relanzaremos igual. Nosotros tenemos norma de **clasificar antes de relanzar** y la cumplimos, pero eso son minutos de una persona por cada caso de esta tabla.

🔵 **UNA PISTA, Y VA DECLARADA COMO HIPÓTESIS, NO COMO CAUSA.** En **#2505** el fallo vino acompañado de **heap OOM**. Y el mismo día, **a tres de nuestras sesiones el sistema les mató la tanda completa de tests por falta de memoria** en la máquina local. **Eso sugiere —no demuestra— que el caso ④ es sensible a la memoria disponible y cae cuando el runner va cargado.** **No lo hemos medido**, y no lo vamos a medir porque el test es vuestro: lo decimos por si os ahorra la búsqueda.
· **Lo que lo confirmaría o lo tumbaría:** correr ese caso solo, con el heap limitado a propósito, y ver si cae; y correrlo con holgura, y ver si no. **Si cae con holgura, nuestra pista es falsa y mejor saberlo pronto.**

🔵 **ACTUALIZACIÓN DEL 17-oct, y ahora hay MECANISMO, no sólo correlación.** Nuestra S3 leyó qué mide el caso ④: **la PÉRDIDA DE SALIDA POR UNA TUBERÍA** (`stdout` no bloqueante). **Eso depende de la carga y del momento, por construcción.** Y el «Reached heap limit» aparece **en el MISMO log** en **TRES** corridas: **#2505, #2528 y #2533**.
**Un test que mide pérdida de salida por tubería, que falla a ráfagas, y que tres veces lo hace con el montón de memoria agotado en el mismo log: eso ya no es una coincidencia de tres cifras, es una historia que encaja de principio a fin.**
⚠️ **Aun así seguimos llamándolo HIPÓTESIS, y lo decimos a propósito: nadie ha corrido todavía la prueba que la confirma o la tumba** (el caso ④ solo, con el heap limitado adrede → debe caer; y con holgura → no debe caer). **Nuestra sesión que lo midió se negó a ascenderlo a causa, y nosotros tampoco lo ascendemos.** **Si al correr esa prueba cae con holgura, la hipótesis es falsa y mejor saberlo pronto.**

· ⚠️ **Y lo que NO os pedimos: que lo quitéis.** Un test que a veces cae suele estar midiendo algo real de forma frágil, y borrarlo cambiaría un rojo molesto por un verde hueco. **Lo que pedimos es que deje de ser intermitente.**
· **Lo escribe el orquestador de Luis, 16-oct-2026, con las seis instancias medidas por sesiones distintas.**

## 19 🔴 EL TRINQUETE DE ZONA FABRICA UNA CAUSA FALSA · y casi os mandamos a perseguirla

**Esto es, a la vez, un hallazgo y una retirada nuestra.** Lo medimos, nos lo creímos un rato, y lo tumbamos nosotros mismos antes de mandároslo. **Os contamos las dos mitades porque la segunda vale más que la primera.**

**Lo que el instrumento dijo.** El job «trinquete · ningún test nuevo mide la zona de la máquina» de **#2528** (job `116989128862`, run `38905690014`) imprimió:

> **NUEVA SCRUM-1405c ④ · Kiritimati → pass · Midway → fail**

Leído tal cual, eso dice: *«el caso ④ depende del huso horario»*. **Y es falso.**

**Las tres razones por las que es falso, medidas:**
1. **El test ④ no lee la fecha en ninguna parte:** ni `Date`, ni `TZ`, ni `toLocale`. Lo que mide es la **pérdida de salida por una tubería** (`stdout` no bloqueante), que depende de la carga y del momento.
2. **Contraprueba, en vuestro propio CI:** el **mismo** trinquete con el **mismo** test salió **VERDE** en **#2526** (job `116989528908`, run `38905735004`, 16-oct 13:42:56Z) — nueve minutos después del rojo.
3. **Y cayó también en `build + tests`, que corre con UNA SOLA zona:** 311 de 320 en 1 de cada 4 vueltas.

🔴 **EL DEFECTO DE VERDAD, Y ES DEL INSTRUMENTO:** **el trinquete de zona no distingue «depende de la zona» de «es intermitente».** Hace **una sola pasada por zona**, así que **cualquier test inestable le sale como dependiente de zona**. Y **su autocontrol de canarios no lo caza, porque sus canarios son DETERMINISTAS**: nunca fallan por azar, así que nunca exponen el agujero.

**Por qué os lo mandamos aunque no es vuestro defecto favorito:** `trinquete-de-zona.mjs` y `_trinquete-de-zona.mjs` llevan **`area-j6`** (`dos-equipos.md:176`), así que **son vuestros y no los tocamos**. Nuestra S3 sólo entra ahí por la excepción escrita de SCRUM-1335 (c.18387), que el propio documento define como «un permiso para un trabajo, no un carril».

· **Lo que lo arreglaría, si os sirve:** más de una pasada por zona antes de afirmar, o un canario **deliberadamente inestable** en el autocontrol — hoy no hay ninguno, y por eso el agujero es invisible desde dentro.
· ⚠️ **Y lo que esto cambia de nuestra sección 18:** la pista de carga/memoria que os dimos allí **sigue siendo una hipótesis** y no la ascendemos a causa. **Pero ahora sabemos que la salida de este trinquete NO sirve como prueba de nada sobre ④.**
· **Lo midió S3 (equipo de Luis) el 17-oct-2026, y fue ella misma quien retiró la conclusión antes de que su orquestador os la mandara como causa.**

## 20 🔴 QUINCE CONTROLES VUESTROS QUE NO SE PUEDEN PULSAR BIEN · medidos, con el arreglo resuelto

**De dónde salen, porque importa.** Nuestro banco de pantallas montaba las vistas con datos que el servidor **nunca devuelve**: 28 rutas recibían una lista vacía, varias recibían el dato de otra, y tres fichas de detalle se montaban **sin número**. Arreglado (SCRUM-1560), el censo pasa de medir **18 vistas a 27**, y los controles por debajo del mínimo pasan de **61 a 96**.
🔵 **Esos 35 «nuevos» no son nuevos: llevaban ahí siempre.** **Lo que cambió es que el instrumento por fin llega a esas pantallas.** **Sube porque vemos más, no porque haya empeorado nada.**

**De los 31 defectos reales, 15 están en ficheros vuestros.** Px a **929 / 390**:

| dueño | fichero | control | px |
|---|---|---|---|
| **J1** | `invoiceDetailView.js` | «← Volver a facturas» | **31 / 31** |
| **J1** | `invoiceDetailView.js` | «Marcar como cobrada» | **30,5 / 30,5** |
| **J1** | `invoiceDetailView.js` | «Descargar PDF» | **30,5 / 30,5** |
| **J1** | `invoiceDetailView.js` | «Enviar por WhatsApp» | **30,5 / 30,5** |
| **J1** | `invoicesView.js` | casilla de fila | **14 / —** (no se pinta a 390) |
| **J1** vista · componente compartido | `documentoAsignados.js`, en el detalle de FACTURA | `INPUT.doc-asignados-casilla` | **21 / 21** |
| **J2** | `cobrosView.js` | enlace «factura F-…» | **19 / 17** |
| **J3** | `plansView.js` | «Quiero mi plaza founding» | **41,9 / 41,9** |
| **J3** | `plansView.js` | «Mensual» | **29,9** |
| **J3** | `plansView.js` | «Anual −17%» | **29,9** |
| **J3** | `teamView.js` | «+ Añadir miembro» | **31 / 30,7** |
| **J3** | `teamView.js` | «Ver su trabajo →» (×2) | **~30,8** |
| **J3** | `teamView.js` | «Editar» | **30,7 / 30,9** |
| **J3** | `teamView.js` | «Suspender» | **30,7 / 30,9** |

🔴 **LOS TRES QUE DE VERDAD NO SE PUEDEN PULSAR**, y los pondríamos primero: **`cobrosView.js` a 19/17 px** —menos de la mitad del mínimo, en **un enlace a una factura**—, **la casilla de `documentoAsignados` a 21** y **la de `invoicesView` a 14**. El resto son botones de ~30 donde el mínimo en móvil es 44.

⚠️ **UN CRUCE QUE CONVIENE QUE NO ARREGLEMOS DOS VECES: `documentoAsignados.js` es un COMPONENTE COMPARTIDO.** Su casilla sale **igual de corta (21 px)** en **vuestro** detalle de factura y en **nuestro** detalle de presupuesto. **Si lo arregla uno, se arregla para los dos.** **Nosotros no lo vamos a tocar sin avisaros: decidnos si lo cogéis vosotros o lo hacemos nosotros, pero que no lo toquemos los dos a la vez.**

🔵 **EL ARREGLO YA ESTÁ RESUELTO DE NUESTRO LADO Y OS LO DAMOS:** el patrón de **SCRUM-1158c** (PR #2513, en `main`) es **una regla acotada que lleva ese `.btn-sm` a 44 px sin tocar el `.btn-sm` global** — la decisión ③ de SCRUM-786, que evita el rediseño en cascada. **Lo aplicamos a 18 controles y lo medimos en yaqu.app: 20 de 20 pasaron de ~30 a 44 px, a 390 y a 929.**

· ⛔ **Y DOS QUE NO HAY QUE TOCAR, para que no perdáis el tiempo:** `customerDetailView.js` «Trabajos (1)» y «WhatsApp (1)» (**41 / 59**) y «Suscribirme» (**39,8 / 44,6**). **Sólo fallan contra el 44 del censo; contra los 36 px que el guard aplica en escritorio por `DESIGN.md`, CUMPLEN.**
· **Nuestros son los otros 16**, y van por nuestra cuenta. **Decisión del orquestador de Luis, 17-oct-2026; midió S3.**

## 21 🔴 EL DETALLE DE FACTURA DEVUELVE EL PRESUPUESTO ENTERO · con la IP del cliente que firmó, su firma y el token del enlace público

**Lo primero, para que nadie se alarme de más: NO es una fuga entre merchants.** Medido: la ruta pide sesión (`requireAuth`) y filtra por `merchantId` **dos veces** (`invoiceAdmin.ts:120` y `accesoALaFactura.ts:127`); un id ajeno da 404. **Un merchant NO ve la evidencia de otro.** Y **no hay clientes reales en producción**, así que no hay nada en curso.

**Lo que sí pasa.** `invoiceAdmin.ts:124` hace **`quote: true`**: el detalle de factura se lleva el presupuesto de origen **ENTERO, sin recortar**. Por ahí salen:

| sale | qué es |
|---|---|
| `quote.evidenciaFirma` | **la IP y el navegador del CLIENTE que firmó**, su `tokenId`, `firmadoAt`, la huella (`contentHash`, `hashAlg`) y el bloque congelado |
| `quote.signatureUrl` | **el trazo de la firma del cliente**, como data-URI |
| `quote.decisionToken` | **la llave del enlace público del presupuesto** |
| `quote.evidence` | la marca manual de aceptado/rechazado |
| `quote.internalNotes` | las notas internas del profesional |

🔴 **Lo que lo convierte en defecto y no en opinión: vuestro propio esquema dice que la IP y el navegador «NUNCA se exponen» por API.** **El código contradice la garantía que el propio esquema declara.** (Lo construye `quotes.routes.ts:460-479`, con la IP en `:473` y el UA en `:474`.)

· 🔴 **Y lo ve un TÉCNICO.** La ruta no pide rol: un técnico recibe todo lo de arriba en las facturas que puede ver (`whereFacturasVisibles`, `accesoALaFactura.ts:76-131`). **Al técnico se le recorta el coste de las líneas (`sinCosteEnDocumento`) y en cambio le llega la IP del cliente y su firma.**
· ✅ **Y la pantalla NO USA NADA DE ESO.** `invoiceDetailView.js` no lee ningún `quote.*`: sólo `customer.name`, `email` y `phone`. **El presupuesto entero viaja y nadie lo pinta.**

🔵 **EL ARREGLO YA EXISTE EN VUESTRA CASA, y por eso esto es barato:** `GET /admin/quotes/:id` usa **una lista explícita de campos** (`quoteAdmin.ts:261 y ss.`) y **NO manda `evidenciaFirma` ni `evidence`**. **El detalle de factura es el único sitio por donde sale.** Basta con que haga lo mismo que ya hace su hermana.

**Dónde está:** `src/modules/system/invoiceAdmin.ts:124` (`quote: true`) y `:138`; el `res.json`, en `invoicesAdmin.routes.ts:276`.

· **Por qué os lo pasamos en vez de arreglarlo: `invoiceAdmin.ts` es de J1** (`.claude/carriles.json`) **y ese fichero lleva además la lógica del estado fiscal (des-pagar, R1)**, así que para nosotros es camino que se LEE (regla 38). **Lo hemos leído y no hemos tocado nada.**
· ⚠️ **Y una pata que no es de código: la IP es dato personal.** **Si `docs/legal/` promete en algún sitio que no se expone, esto lo contradice** — conviene mirarlo antes del primer cliente real.
· **Medido por S1 (equipo de Luis) el 17-oct-2026 sobre `origin/main` 44f3a6bf, leyendo código, sin tocar yaqu.app.** **De la misma auditoría, los hallazgos #3 (token del presupuesto) y #8 (clientes) salieron CERRADOS: el presupuesto ya usa token opaco de 16 bytes y clientes usa lista explícita sin `portalToken`.**

## 22 ⛔ NO TOQUÉIS LA CASILLA: ya la hemos arreglado, y os arregla a vosotros también

**En la §20 os avisamos de que `documentoAsignados.js` es un componente COMPARTIDO y os pedimos decidir quién lo arreglaba. Lo hemos hecho nosotros. Esto es el aviso.**

**La casilla `INPUT.doc-asignados-casilla` pasa de 21 a 45 px**, y como el componente es el mismo, **vuestro detalle de FACTURA se arregla con él: `invoiceDetailView` baja de 5 controles cortos a 4** (medido en el banco). ⛔ **Que J1 NO la toque: si la arreglamos los dos, el segundo arreglo choca con el primero.**
· **Cómo está hecho, por si queréis el mismo patrón:** CSS puro, `.doc-asignados-casilla::before` con `inset -12px`. **Es el mecanismo de SCRUM-786, que agranda el área de toque sin tocar la caja ni el `.btn-sm` global.** **Cero texto.**
· **Va en nuestra rama `scrum-1559g-dieciseis-controles-nuestros-44px`.**
· **Lo que SIGUE siendo vuestro de la §20: los 4 de `invoiceDetailView.js`, la casilla de fila de `invoicesView.js` (14 px), el enlace de `cobrosView.js` (19/17 px, el peor de la lista) y los 8 de `plansView.js` y `teamView.js`.**

---

## 23 🔴 CON TECLADO NO SE PUEDE ABRIR UNA FACTURA · y a vosotros os toca una de las dos sin salida

**Medido el 18-oct sobre `origin/main` e59be9fa (SCRUM-1562).** Montamos las 29 vistas y buscamos los elementos que reciben clic y **no** son nativos (`button`, `a[href]`, `input`…). A cada uno le miramos `tabindex`, `role` y oyente de teclado, propio o heredado. **Control: la sonda SÍ distingue el caso bueno** — la actividad de Inicio sale con `tabindex=0`, `role=button` y `keydown`.

**De los 9 que navegan sólo con ratón, dos son vuestros:**

| vista | elemento | abre | fichero | dueño | ¿hay otra forma? |
|---|---|---|---|---|---|
| 🔴 **Facturas** | `TR` ×2 | el detalle de la factura | `invoicesView.js` | **J1** | **NO. Dentro sólo hay la casilla.** |
| Clientes | `TR` ×3 | la ficha 360 | `customersView.js` | **J2** | SÍ: «📊 Historial» llama a la misma `openCustomer360` |

🔴 **La de Facturas es la grave: desde esa lista, con teclado, NO SE PUEDE ABRIR UNA FACTURA.** Para un ratón funciona; para quien no usa ratón, esa pantalla no tiene salida. **La de Clientes está degradada pero se puede usar, porque el botón de historial hace lo mismo.**
· **Las dos soluciones valen y la segunda es más barata:** dar foco, `role` y respuesta a Enter a la fila — **o** que dentro haya un control nativo que haga lo mismo, como ya pasa en Clientes. ⛔ **Sin texto nuevo: se reutiliza el rótulo que ya está en la fila.**
· **Nuestros son los otros tres: Trabajos y Partes de oficina (los dos SIN alternativa) y Presupuestos (con ella).** Van por nuestra cuenta.
· **Límites que declaró quien lo midió, y los pasamos tal cual:** sólo ve el estado montado, sin modales ni pestañas · no ve oyentes puestos en `document` · el número escala con los datos, porque el patrón es por fila · **y NO se comprobó si el buscador global abre esos detalles con teclado — si lo hace, el impacto baja pero el defecto sigue.**
· **Medido por S3 (equipo de Luis). Ticket nuestro: SCRUM-1562, con la tabla completa de los 13 elementos y los tres grupos.**

## 24 🔵 `scrum1405c ④`: YA NO ES «UN TEST INESTABLE». Vuestro arreglo funciona en 3 de cada 4 pasadas

**Esto SUSTITUYE a la hipótesis que os dimos en la §18.** Allí os dijimos que el caso ④ parecía sensible a la memoria, porque «Reached heap limit» salía en el mismo log tres veces. **Era una hipótesis y la marcamos como tal. Ahora hay una medida mejor, y apunta a otro sitio.**

**Lo medido en vuestro propio CI** (run `39147352034`, job `117734088229`), con el caso ④ de `scrum1405c-tuberia-bloqueante.test.mjs:201`:

| | casos que la cobaya PIERDE, por pasada |
|---|---|
| **sin** el módulo (salida C) | **14 · 10 · 27 · 31** |
| **con** el módulo | **0 · 0 · 11 · 0** |

🔴 **Leído en una frase: vuestro arreglo reduce muchísimo la pérdida, pero NO la lleva a cero en el CI de Linux. Una de cada cuatro pasadas todavía pierde 11 casos.** **Y como el test afirma pérdida CERO, falla justo esa vez.**

**Por qué esto cambia dónde hay que mirar.** Mientras se leía como «un test que a veces falla», lo natural era sospechar del test o del runner. **Con estos números, el test está haciendo su trabajo: detecta que el módulo no siempre consigue lo que promete.** **El sitio donde mirar no es el test: es la eficacia del módulo bajo carga.**
· **Y encaja con lo que ya sabíamos de qué mide ④: la PÉRDIDA DE SALIDA POR UNA TUBERÍA** (`stdout` no bloqueante), **que depende de la carga por construcción.** La salida C la mitiga; cuando la máquina aprieta, no basta.
· ⚠️ **Lo que esto NO dice:** no sabemos por qué falla esa pasada y no las otras tres, ni si el umbral es memoria, concurrencia o tiempo. **Eso sigue sin medir, y no lo vamos a medir nosotros: `scrum1405c` es de J6** (PR #2429, «Tramo de J6j» en `SCRUM-1405.md`).

**Lo que nos cuesta a nosotros, para que sepáis por qué insistimos:** es el rojo ajeno que más PR nuestros ha tumbado esta semana — **#2449, #2495, #2505, #2512, #2523, #2544, #2531 y #2552**, y el 15-oct cayó en **cinco de nuestros seis puestos el mismo día**. **Cada uno son minutos de alguien clasificando antes de relanzar, porque nuestra norma es no relanzar a ciegas.**

· 🔵 **Y una cosa que queremos decir claramente: el test NO sobra.** Un test que a veces cae sobre algo que a veces falla está midiendo bien. **Quitarlo cambiaría un rojo molesto por un verde hueco.** **Lo que pedimos es que el módulo llegue a cero, no que el test deje de mirar.**
· **Medido por S5 (equipo de Luis) el 18-oct-2026.** **La §18 se queda como estaba, con su hipótesis marcada como hipótesis; esta sección es la medida que la supera.**

## 25 🔴 TRES COSAS VUESTRAS DEL 18-OCT · el PDF que pinta «NaN EUR», el webhook de Stripe y SCRUM-914 parado esperándoos

**Las tres en una sección a propósito:** este fichero choca cada vez que dos ramas le añaden secciones al final. Las escribe S4 por encargo del orquestador de Luis. Cada punto dice quién lo midió y si lo hemos vuelto a mirar nosotros.

### 25.1 · J1 · el PDF del presupuesto con opciones pinta «× undefined» y «NaN EUR» (SCRUM-1442)

**Lo que ve el cliente:** en la tarjeta de una opción, la cabecera de apartado sale como si fuera una línea: «[QA-1442] Apartado de Opción 1 × undefined» y debajo «NaN EUR».
· **Medido en producción por nuestra S2** (build `06c6289d4`), presupuesto 210 de la cuenta de pruebas, PDF por la vía pública. **Releído por S4 hoy desde esa misma captura** (`cap1442-pdf-210.pdf`): un stream inflado, **3 «undefined» y 3 «NaN»**. **Control:** el PDF de la 209, sin opciones, se lee entero (número, validez, emisor, cliente) y da 0 y 0.
· **Dónde:** `src/modules/invoicing/infra/pdf/pdf.service.ts:909-914` (J1, `dos-equipos.md:117`). `tier.lines.forEach` pinta `` `${l.concept} × ${l.qty}` `` y `fmtImporte(l.qty * l.price …)` para TODA línea de la opción, y la cabecera de apartado no trae ni `qty` ni `price`.
· **La mitad de la página ya está arreglada** (#2559, en `main`: la página donde firma el cliente ya no pinta «NaN €»). **La del PDF nunca ha entrado:** `git log --grep=1442` sólo da #2559, y no hay rama 1442 remota. **Es el gemelo de #2559**, y la cabecera debería salir en el PDF igual que en la página.

### 25.2 · J2 · el webhook de Stripe y `planExpiresAt` · ⛔ PENDIENTE DEL OK DEL FUNDADOR

> ⛔ **PENDIENTE DEL OK DEL FUNDADOR.** Es flujo de cobro (STOP de `CLAUDE.md`). **Que nadie lo construya hasta que la cita literal del fundador esté en el registro.** Nuestra S1 nos paró por esto y tenía razón: lo que le llegó era un OK del orquestador, y en Jira la firma del orquestador y la del fundador son la misma cuenta.

> **Los hechos medidos que la motivan**, del panel de Stripe del fundador (modo pruebas, endpoint `yaqu-production` → `https://yaqu.app/webhooks/stripe`): **versión de API `2025-10-29.clover`** (posterior al corte de `2025-03-31`), **6 eventos escuchados** (no se ve cuáles), **5 entregas esta semana con 2 FALLIDAS**, tiempo de respuesta 309–398 ms. Y la consecuencia: `planExpiresAt` de la cuenta QA sigue en `2026-10-12` con `plan: "pro"`, así que **quien cancele hoy caería en el muro al instante, contra la firma del fundador del 7-sep**.

**Es una receta DEFENSIVA, no una cura confirmada.** La escribe nuestra S1 y la copiamos **literal**:

> **RECETA PARA J2** (mi lectura de la API de Stripe, sin medir contra un payload real `2025-10-29.clover`):
> · Una función pura `finDelPeriodo(sub): Date | null`. Primero `sub.current_period_end` si es un número finito (API vieja). Si no, el de `sub.items.data[i].current_period_end` (clover: el campo vive en cada item; con un único precio, el `[0]`). Segundos ×1000, y descartar si `Number.isNaN(fecha.getTime())`. Nunca `new Date(undefined*1000)`.
> · En la rama activa (`stripe.routes.ts:168-177`): con fecha → igual que hoy. SIN fecha → escribir `plan`, `subscriptionStatus` y `stripeSubscriptionId`, NO tocar `planExpiresAt`, y dejar constancia con el id del evento, el merchant y el motivo «sin_fin_de_periodo». Devolver 200: un 400 hace que Stripe reintente para siempre algo que el reintento no arregla. Que sea 200 o que se anote en `gateway_events` como fallo lo decide J2 contigo: es la diferencia entre «falla diciendo por qué» y «Stripe insiste».
> · Test con TRES payloads por la ruta real: raíz (viejo), items (clover) y ninguno. ROJO con el código de hoy en el de items: escribe Invalid Date o salta. En el de ninguno, que no se escriba `planExpiresAt` y quede constancia. `tests/scrum809-paywall-tras-cancelar.test.mjs:228` y `scrum1402…:148` construyen el payload viejo (raíz): tienen que seguir verdes, y son el control.
> · En el registro: DEFENSIVO, no cura confirmada, hasta ver qué dicen las 2 entregas fallidas y cuáles son los 6 eventos.
>
> **OJO con algo que el arreglo NO cubre:** la cuenta QA ya tiene `planExpiresAt` viejo. Cuando entre el arreglo, se corrige sola con el siguiente `customer.subscription.updated` o con un reenvío de la entrega fallida desde el panel de Stripe (botón «Reenviar» de esa entrega). Si no, se queda vieja.

· `stripe.routes.ts` es **J2 (contenedor)** (`dos-equipos.md:121`, medido con `carriles.mjs`).

### 25.3 · J3 · SCRUM-914 (equipos del cliente) lleva cinco días parado esperando vuestra respuesta

**La petición está hecha y sin contestar:** c.19414 de SCRUM-914 (13-oct, 13:40Z), y es el último comentario del ticket. **Lo que pasa si no se decide:** la tabla `equipments` lleva en las tres bases desde el 29-sep sin una línea de código que la use, y detrás esperan las pantallas del Trabajo y del parte (nuestra S4) y SCRUM-1019 (la pegatina QR).

**Por qué no puede entrar sin vosotros:** en cuanto `prisma/schema.prisma` declara `Equipment` con `merchantId`, cae `tests/scrum192-borrado-merchant.test.mjs:39` («todo modelo con merchantId está en el orden o declarado fuera»), y va en el check obligatorio. Lo corrió nuestra S1 el 13-oct (c.19408): 25 modelos y 0 olvidados con el esquema de hoy; 26 y `["equipment"]` con el candidato. Las dos salidas viven en `borradoMerchant.ts` y `anonimizarMerchant.ts`, que son de **J3** (`dos-equipos.md:128`).

**Las dos salidas, tal cual se os pidieron:**
1. **Excepción escrita:** contestáis en SCRUM-914 que S1 puede tocar `borradoMerchant.ts` y `anonimizarMerchant.ts` para este ticket (y, si queréis, en qué sitio del orden va). Nuestra S0 lo declara en `dos-equipos.md` §3.4, y S1 hace esquema + dominio + rutas + los seis criterios en un solo PR.
2. **Rama compartida:** S1 abre la rama con el esquema y el servidor y escribe aquí su nombre, y una sesión de J3 empuja a esa misma rama el commit del criterio 3 antes de que el PR pueda entrar.

**Una cosa que conviene mirar ya, decidáis lo que decidáis** (también en c.19414): la FORMA de `equipments` no la ha medido nadie. Vuestro registro del 29-sep comprobó que cada objeto existe (23/23), no sus columnas, y `CREATE TABLE IF NOT EXISTS` mira el nombre. Hay que medirla columna a columna contra `docs/sql/scrum-914-equipos-del-cliente.sql`; nuestros árboles no tienen claves de base.
