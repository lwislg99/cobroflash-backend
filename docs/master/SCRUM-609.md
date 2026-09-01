# SCRUM-609 · CAT-01 · La tabla real, medida — y qué hacer con el IVA guardado (P-DOC-8)

**Fecha:** 01-sep-2026 · **Carril:** medición y propuesta · **Gate:** sin gate — no entra código

**Medido contra:** `origin/main` = `f7fabacb19eb9b0223dac46ae40c996cd3a8cf00` · 2026-09-01T15:31:30+01:00

**No se ha construido nada:** ni el switch, ni el autocompletado, ni migración. `prisma/schema.prisma`
intacto. Esto mide y propone, que es lo que pedía el encargo.

---

## 🔴 LO PRIMERO, PORQUE CAMBIA CÓMO SE LEE TODO LO DEMÁS

**La tabla que el ticket describe está en PRODUCCIÓN, y desde un árbol de trabajo no se puede
medir** (regla 3: no hay credencial de producción aquí y no la puede haber).

**«Discos de freno» —la fila que el ticket cita como ejemplo de IVA vacío— NO EXISTE en ninguna de
las dos bases alcanzables.** Lo que sí he medido:

| base | productos |
|---|---|
| `acela.proxy.rlwy.net/railway` (STAGING) | **0** — tabla vacía |
| `acela.proxy.rlwy.net/yaqu_dev_javier` (DESARROLLO) | **8**, todos de fontanería, sembrados |

Así que los números de abajo son ciertos y son **de una población que no es la del ticket**. Lo digo
antes de darlos para que nadie los lea como si fueran el catálogo del profesional que abrió CAT-01.

---

## Los cuatro números (a)-(d), sobre las 8 filas de desarrollo

### (a) La tabla entera
**8 productos · 8 activos · 0 inactivos.**

### (b) El IVA
**0 con valor · 8 vacíos.** Valores distintos: **ninguno**.

### (c) Coste y precio
**0 con coste · 8 sin coste. 8 con precio > 0.**
→ **Margen derivable (coste Y precio): 0 de 8.**

### (d) ¿Producto o servicio? **NO SE PUEDE DERIVAR.**

No hay columna, y **tampoco hay señal**. Medido el cruce de lo único que la tabla tiene y podría
correlacionar:

| | con coste | sin coste |
|---|---|---|
| **con proveedor** | 0 | 0 |
| **sin proveedor** | 0 | **8** |

Las ocho son **idénticas en todos los campos estructurales**: sin proveedor, sin coste, sin IVA. Lo
único que las distingue es **el nombre**, que es texto libre («Desatasco de tubería», «Mano de obra
(hora)»). Derivar la clasificación de ahí sería inventarla.

> **La migración NO PUEDE CLASIFICAR. Hay que preguntárselo al profesional.**

Y eso cambia el ticket: el switch no puede nacer con un lado preseleccionado. El patrón correcto es
el que ya existe y ya se decidió en CONT-01 — **`contactKind` nullable, sin `@default`, y con
NINGUNO de los dos lados marcado mientras nadie lo declare**. Aquí aplica igual.

---

## 🔴 EL CONTROL POSITIVO DEL CENSO, que aquí no es un adorno

Mi propio suelo saltó: **un barrido que no encuentra ningún IVA no está midiendo IVA**, y el mío
devolvió cero. Así que el cero hubo que probarlo, no publicarlo.

Se comprobó **por SQL crudo, sin que Prisma mapeara nada, y sobre las MISMAS filas**:

```
recuento por SQL CRUDO: [{"filas":8,"con_price":8,"con_cost":0,"con_vat":0}]
muestra cruda: [{"id":1,"price":"65","cost":null,"vat":null}, …]
la columna EXISTE en la BD: vat numeric YES · cost numeric YES · price numeric NO
```

**El lector no está ciego:** en la misma consulta y las mismas filas lee **8 precios**. Que `vat` y
`cost` vengan a cero es **del dato**, no del instrumento.

---

## De dónde sale el IVA guardado — el censo que decide P-DOC-8

Esto es lo que hace que la pregunta tenga respuesta, y no estaba medido. **Tres caminos escriben
`vat`, y no son equivalentes:**

| camino | qué escribe | ¿lo decidió el profesional? |
|---|---|---|
| `POST /admin/products/load-catalog` (onboarding por gremio) | **`getLocale(country).defaultVat`** → **0,21 para ES** | **NO.** Lo escribe el sistema |
| `POST /admin/products` (alta manual) | lo que el usuario teclee en «IVA (0..1)», o `null` si lo deja vacío | sí |
| `importProductsCsv` | la columna `vat` del CSV, `null` si falta o viene vacía | sí, si la puso |

🔴 **La consecuencia, y es la que cambia la decisión:** para todo producto cargado por el catálogo de
gremio, **ese 0,21 no es la decisión de nadie — es un valor por defecto que escribió el sistema en
el onboarding**. Tratarlo después como «el IVA que el profesional eligió para este artículo» sería
ascender un default a decisión. Es SCRUM-615 exactamente, y con dinero encima.

*(Detalle que confirma el punto: las 8 filas de desarrollo son un catálogo de fontanería y tienen el
IVA VACÍO — o sea que NO entraron por `load-catalog`, que se lo habría puesto. Los caminos dejan
huella distinta.)*

**Y ya existe un IVA por defecto AL NIVEL DEL DOCUMENTO:** `vatDefault` en el formulario de
presupuesto (`quotesView.js:1016`, con `"21"` como valor de partida). O sea que el sitio donde vive
un defecto de IVA **ya está construido**, y no es el producto.

---

## La propuesta para P-DOC-8 — tres salidas, con su consecuencia

### ① Se TIRA
- **Qué pierde el profesional que ya lo había puesto:** el valor que tecleó en el alta manual o trajo
  en su CSV. **Medido: en las bases alcanzables eso son 0 filas.** En producción, desconocido.
- **Lo que NO pierde:** el 0,21 de los productos cargados por gremio, porque **eso no lo puso él**.
- **A favor:** el ticket ya saca el IVA del formulario y lo fija en la línea del documento. Un dato
  que nadie lee ni mantiene se pudre; y el defecto de documento (`vatDefault`) ya cubre el caso.
- **En contra:** es irreversible. Si mañana DOC-16 quisiera un IVA por artículo, el dato ya no está.

### ② Se usa como VALOR POR DEFECTO de la línea
- **Dónde vive ese defecto:** hoy **ya hay uno**, `vatDefault` del documento. Así que esta salida no
  crea un sitio: crea un **SEGUNDO** sitio, y con él la pregunta de cuál manda. Eso es una decisión
  nueva, no una consecuencia.
- 🔴 **Y el riesgo medido:** ascendería el 0,21 que el sistema escribió en el onboarding a «el IVA de
  este artículo», y encima **por delante** del que el profesional puso en su documento.
- **Qué pasa con los vacíos:** no tendrían defecto y caerían al del documento — que es exactamente
  el comportamiento de hoy. **No hay que inventar nada para ellos.**

### ③ Se CONSERVA sin usarse, y se decide con DOC-16
- El switch entra, el IVA sale del formulario (que es lo que CAT-01 pide), y la columna se queda
  quieta hasta que 623/624 se desbloqueen y DOC-16 diga qué quiere.
- **A favor:** no destruye ni asciende nada. Es la única reversible.
- **En contra:** un dato que nadie lee ni mantiene se pudre, y dentro de seis meses nadie sabrá si
  ese 0,21 significa algo. **Si se elige, tiene que llevar fecha de caducidad**, como el trinquete de
  `PENDIENTE_CLASIFICAR`.

### 🛑 Y la salida que NO se propone

**Rellenar los vacíos con 21 %.** Un vacío no es un 21 %. Es la misma inversión que
`resolveTipoDestinatario`, y aquí acabaría en el importe que firma un cliente.

**Ninguna de las tres necesita inventar un valor para los vacíos** — conviene decirlo, porque era la
mitad de la pregunta: con ① caen todos igual; con ② y ③ caen al `vatDefault` del documento, que es
lo que ya hacen hoy.

---

## Lo que hace falta para desbloquear CAT-01

1. **P-DOC-8**: cuál de las tres salidas. Con los números de arriba se decide en cinco minutos.
2. **La clasificación producto/servicio**: medido que **no se puede derivar**, así que la migración
   no puede rellenarla. Hay que decidir si el switch nace sin lado marcado (patrón CONT-01) o si se
   le pregunta al profesional de otra forma.
3. **El número de producción**: nadie lo tiene. Si la decisión de ① depende de cuántos merchants
   pusieron el IVA a mano, ese dato hay que sacarlo de producción, y no desde aquí.

---

## Estado del árbol

- **Suite: total 4158 · pass 4079 · fail 0 · skipped 79**, medida EN ESTA RAMA y no heredada del
  informe anterior: `main` se movió entre un ticket y otro y el número de ayer (4148) ya no valía.
- `npm run guards:entrada` en verde.
- Cero ficheros de producto tocados. No se ha migrado nada, no se ha tocado el esquema, no se ha
  construido el switch ni el autocompletado.
