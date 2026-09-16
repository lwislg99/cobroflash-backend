# SCRUM-560 · El abort de scrum334, y qué hacer con los otros 21 que comparten el patrón

**Medido contra:** `origin/main` = `634b4fe1e9a25ab87c65c003cbd5e1448f053796` · 2026-08-20T14:10:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

> 🔴 **EL NÚMERO ES 21, NO 20.** La primera versión de esta entrada decía «20» en seis
> sitios: resté mal —`scrum334` ya estaba arreglado cuando se hizo el censo, así que nunca
> formó parte de los 21—. Los seis quedan abajo como `~~20~~ 21`, con el número tachado a
> la vista: **el rastro de por qué cambió vale tanto como la cifra corregida**, y borrarlo
> sería repetir el error que este ticket vino a arreglar. Detalle en «LO DECIDIDO».

**Alcance:** un fichero arreglado, un censo entregado, una propuesta **sin implementar**. No se
pone reintento, no se saca nada de la tanda, no se toca `--test-force-exit` ni la concurrencia.

---

## El arreglo, y la prueba de que no es suerte

El remedio no se inventa: es el de `scrum100-webhooks-fail-closed.test.mjs:50-57`, escrito y
probado desde SCRUM-100 — **`node:http` con `agent: false`**, sin pool de conexiones.

| | abortos | pasadas | tasa |
|---|---|---|---|
| **ANTES** (código original) | **2** | 10 | 20 % |
| **DESPUÉS** (`node:http`) | **0** | **20** | 0 % |

### Por qué 20 pasadas y no 10

El defecto es una **carrera**: un verde suelto no prueba nada. Si la tasa base es `p = 0,20`, la
probabilidad de ver cero abortos por pura suerte es `0,8^N`:

| N | P(0 abortos si nada cambió) | |
|---|---|---|
| 10 | 10,7 % | no concluye nada |
| 14 | 4,4 % | significativo al 5 % |
| **20** | **1,15 %** | ← el que se corrió |
| 31 | 0,1 % | 45 min más de máquina |

**Se declara el 1,15 %**, no «arreglado» a secas. Con N=31 bajaría a 0,1 %, pero es pasar de
«casi seguro» a «seguro» por tres cuartos de hora; el número queda escrito para quien quiera
medirlo más fino.

**Y una confirmación por otra vía:** en las 20 pasadas el total fue **3809 siempre**. Nunca 3810,
que es lo que sale cuando el fichero se marca fallido.

## ⚠️ La primera medición del «antes» hubo que tirarla, y el error fue de método

Lancé las 10 pasadas en segundo plano y **edité el test mientras corrían**. El medidor relee
`tests/` en cada pasada, así que las últimas ya llevaban el arreglo: dio **0 de 10** y no valía
nada. Es literalmente la lección de SCRUM-182 — **no se mueve el árbol bajo la propia tanda en
marcha**. Repetida con el arreglo guardado en `git stash` y sin tocar nada: **2 de 10**.

> Si esa primera medición se hubiera dado por buena, el informe habría dicho «0 antes y 0 después»
> y habría concluido que no había nada que arreglar.

## El control positivo: el reemplazo no relaja lo que el test vigila

No se afirma, se mide. Las mismas 7 rutas por las dos vías, comparando **lo que el test usa**
(status y caracteres visibles tras limpiar el HTML):

| ruta | `fetch` | `node:http` |
|---|---|---|
| `/` | 200 · 42.618 car. | 200 · 42.618 car. |
| `/precios.html` | 200 · 3.459 | 200 · 3.459 |
| `/register.html` | 200 · 325 | 200 · 325 |
| `/login.html` | 200 · 222 | 200 · 222 |
| `/privacidad` | 200 · 6.982 | 200 · 6.982 |
| `/terminos` | 200 · 4.803 | 200 · 4.803 |
| `/esta-ruta-no-existe-560` | **404** · 0 | **404** · 0 |

Idénticas en las siete, **incluida la que da 404**: el test sigue cazando lo que cazaba. Y los
siete subtests siguen pasando (7/7).

---

## El censo: no son 31, son 34 — y 21 están en el patrón peligroso

Censo derivado con AST sobre `tests/`. **El patrón peligroso no es «usa fetch»**, es
`app.listen(0)` **+ 3 o más peticiones** (SCRUM-100).

| | cuántos |
|---|---|
| Ficheros con `app.listen(0)` | **34** |
| De ésos, con `fetch` | 32 |
| 🔴 **En el patrón peligroso** (≥3 peticiones, o `fetch` dentro de un bucle) | **21** |
| Ya con `node:http` + `agent:false` | **2** (scrum100 y este) |

> 🔴 **Contar llamadas estáticas subestima, y `scrum334` es la prueba:** tenía **un** `fetch` en
> el código, dentro de un bucle sobre 6 rutas. Seis peticiones, no una. Por eso el censo marca
> aparte los `fetch` en bucle: valen por «muchas», no por una. Un censo que contara llamadas
> habría clasificado el único fichero que abortaba como de riesgo bajo.

Los 21: `tenancy-permisos` · `scrum329` · `albaran` · `pdfs` · `scrum72` · `scrum49` · `scrum74` ·
`scrum85` · `scrum127` · `scrum90` · `scrum170` · `scrum68` · `scrum171a` · `scrum178` ·
`scrum73` · `scrum92` · `scrum221` · `scrum51` · `scrum57` · `scrum58` · `scrum82`.

## La propuesta, con los números delante — decide el fundador

**El dato que la gobierna: 21 ficheros comparten el patrón y sólo UNO ha abortado.** Que le tocara
a él no es una propiedad suya: es una carrera. Pero tampoco hay evidencia de que los otros ~~20~~ 21
estén fallando hoy.

**A · Arreglar los 21.** Cierra el patrón entero. Coste: 21 ficheros editados a mano, cada uno con
su forma de pedir (POST con cuerpo, cabeceras, `json()`), y **ninguno de los ~~20~~ 21 tiene hoy un
síntoma que confirme que el cambio no rompe nada**. Es exactamente la clase de barrido que en
SCRUM-559 fabricó rojos donde no había problema.

**B · Sólo el que cae** (lo hecho aquí). Coste cero, beneficio inmediato: se acaba el ruido en la
tanda de las tres sesiones. Deja el patrón vivo en ~~20~~ 21 ficheros, y el día que a otro le toque la
carrera, se repite este ticket — pero ya con el remedio conocido y barato.

**C · Escribir la convención para los nuevos.** Un guard que impida que un fichero NUEVO con
`app.listen(0)` use `fetch`. No arregla los ~~20~~ 21, pero corta la propagación, que es lo que hace que
el problema crezca. Es la única de las tres que ataca la causa de que haya 21 y no 2.

**No implemento ninguna: el ticket pedía proponer.** Lo que sí queda medido es que **B ya está
hecho** y que **A y C no se estorban** — C se puede hacer hoy y A cuando haya síntomas.

---

## LO DECIDIDO (asesor, 20-ago-2026, con la tabla de arriba delante): **B + C. La A no.**

**A no se hace hoy**, y el motivo queda escrito para que no haya que reconstruirlo: es un barrido
a mano sobre **21 ficheros sin un solo síntoma**, y en SCRUM-559 quedó medido —dos horas antes—
que un barrido en bloque fabrica rojos donde no había problema. **Coste cierto, beneficio
hipotético.** Se reabre en cuanto un segundo fichero aborte; para saberlo hace falta que C exista.

> ⚠️ **Corrección a la primera versión de esta entrada:** decía «quedan 20». **Son 21.** Resté
> mal: `scrum334` ya estaba arreglado cuando se hizo el censo, así que nunca formó parte de los
> 21.

### C · lo construido: `tests/scrum560-patron-fetch-servidor.test.mjs`

Un **trinquete**, no una prohibición. La lista de los 21 se congela con fecha y el guard cae si
**crece**, nombrando el fichero nuevo. Prohibir el patrón a secas sería rojo permanente el primer
día — y un rojo permanente es el que el segundo que lo ve desactiva.

**Y baja también:** si alguien arregla uno y no lo quita de la lista, salta. Una lista que
sobrevive a su causa deja de ser una fecha y pasa a ser un permiso.

**El criterio es el mismo con el que se sacaron los 21**, no uno nuevo: `app.listen(0)` + un
`fetch` **dentro de un bucle**, o 3 o más sueltos. Con AST, porque si el `fetch` está dentro de un
bucle el texto plano no lo distingue.

**El mensaje dice la salida**, no sólo que está mal: el `http.request` con `agent:false` completo
y listo para copiar, citando `scrum100-webhooks-fail-closed.test.mjs:50-57` como el ejemplo
probado. Un guard que dice «esto está mal» y no dice la salida acaba en una lista de excepciones.

**Autoprueba del detector** sobre fuente sintética (5 casos): caza el bucle, caza 3 sueltos, **no**
acusa con 2, **no** acusa a `node:http` —que es la salida que recomienda: si el remedio disparara
el guard, nadie lo aplicaría— y **no** acusa a un `fetch` que no va contra servidor propio.

### Los 21 que quedan, declarados

`albaran` · `pdfs` · `scrum127` · `scrum170` · `scrum171a` · `scrum178` · `scrum221` · `scrum329` ·
`scrum49` · `scrum51` · `scrum57` · `scrum58` · `scrum68` · `scrum72` · `scrum73` · `scrum74` ·
`scrum82` · `scrum85` · `scrum90` · `scrum92` · `tenancy-permisos`.

**Es un hueco conocido, no un descuido.** Ninguno tiene síntoma hoy; el que lo tenga se arregla
con el remedio de arriba, que ya está probado dos veces.

## Lo que no se pudo medir, con esas palabras

- **Nada de esto está medido en `ubuntu-latest`.** La aserción de libuv y el `exitCode
  3221226505` (0xC0000409) son de Windows. Si el patrón revienta en CI, será con otra firma.
- **No se ha medido si los otros ~~20~~ 21 abortan.** Haría falta correr la tanda cientos de veces para
  detectar tasas del 1-2 %, y con 20 % ya costó 30 pasadas cerrar uno solo.
