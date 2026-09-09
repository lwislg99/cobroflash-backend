# Mapa de huecos sin automatizar

Cosas **medidas** que hoy no tienen ticket, con el número que las convertiría en uno.

> Un hueco documentado con su medición al lado no es deuda: es una decisión. Lo que convierte un
> hallazgo en ticket es que tenga **una víctima HOY** (regla 37) — no que sea cierto.
>
> Cada entrada lleva: qué se midió, con qué instrumento, **el umbral** a partir del cual sí es un
> ticket, y por qué ese número y no otro. Sin umbral, esto sería una lista de quejas.

---

## `/admin/customers` devuelve TODOS los clientes, sin `take`

**Medido el 8-sep-2026** · `origin/main` = `0e8c589a78f913f550db55277c80b3ec5ec295c2`

### Qué pasa

`listCustomers` (`src/modules/system/customerAdmin.ts:100`) hace `findMany` **sin `take`**, y la
pantalla de presupuesto llama `getCustomers("")` al abrir. Medido en navegador con 2000 clientes:

- peticiones a `/admin/customers`: **1**, **ninguna con `?search=`**
- opciones en el `<select>` del DOM: **2002**

Las dos cosas vienen del commit fundacional `5142388b` (26-nov-2025), **no** del buscador de
SCRUM-713: ése se apoyó en una lista que la pantalla ya cargaba entera.

### 🔴 Y el umbral NO lo marca el render — eso es lo que salió al medirlo

La primera medición dio «tiempo de pintado» **plano**: 629 ms con 50 clientes y 629 con 5000. No
medía el render, medía la espera fija del propio banco. Un número que no se mueve cuando el sistema
cambia no es una medición.

Con el instrumento arreglado —cronometrando dentro de la página lo que sí escala— sale lineal:

| clientes | construir `<option>` | filtrar en memoria | JSON por la red |
|---|---|---|---|
| 200 | 0,8 ms | 0,37 ms | 19 KB |
| 1.000 | 2,6 ms | 1,61 ms | 96 KB |
| 2.000 | 5,5 ms | 3,42 ms | **196 KB** |
| 5.000 | 14,3 ms | 7,94 ms | **495 KB** |
| 10.000 | 27,0 ms | 16,58 ms | **993 KB** |

**El coste de CPU es despreciable hasta 10.000** (44 ms sumando las dos columnas: imperceptible).
Lo que crece y duele es **el payload**: casi 1 MB de JSON en cada apertura de la pantalla.

### El umbral: **2.500 clientes en un merchant**

Por qué ese número y no otro:

- La ficha mide **≈96 KB por cada 1.000 clientes** (medido arriba, no estimado). 2.500 ≈ **250 KB**.
- A partir de ahí el coste deja de ser CPU y pasa a ser **descarga**: los guards de esta casa emulan
  4G porque es la red del profesional en una obra. A ~1,5 Mbps efectivos, 250 KB son **≈1,3 s sólo
  de bajada**, antes de pintar nada — en la pantalla que el máster quiere resuelta en 30 segundos.
- ⚠️ Esa última línea es **aritmética sobre bytes medidos**, no una medición de red. Si alguien
  quiere el ticket, que mida la descarga real con el emulador de 4G antes de fijar el número.

### Por qué hoy NO es un ticket

**No hay ningún merchant real con 2.000 clientes.** Los 2.000 de la medición son datos de prueba
fabricados por el banco. Regla 37: sin víctima hoy, no hay ticket — abrirlo sería gastar una sesión
en un problema de dentro de un año.

### Cuándo abrirlo, y qué haría falta mirar

Cuando **algún merchant pase de 2.500 clientes**. El arreglo toca `listCustomers`, que es
**compartido**: ponerle tope y pasar a `?search=` cambia el comportamiento de todas las pantallas
que llaman `getCustomers("")` — no sólo la del presupuesto. Ese censo es parte del ticket.

**Y ya hay media solución escrita**: la otra implementación de SCRUM-713 (en un `stash` local, ver
`docs/master/SCRUM-713.md`) consulta al servidor con `?search=`, con espera de 250 ms y guardia de
carrera por versión. No se portó porque **pierde una salvaguarda que main sí tiene** —conservar el
cliente ya elegido aunque no case con la búsqueda, para que el documento no se quede con un `value`
que el `<select>` no puede mostrar—. Quien abra el ticket empieza por ahí, no de cero.

---

## La reserva de número lee la serie F ENTERA del año, dentro del cerrojo

**Medido el 9-sep-2026** · `origin/main` = `16997ef40e309368d9d1a725e355787c891a4154`

### Qué pasa

Emitir una factura hace **8 viajes a la base, 7 de ellos dentro del cerrojo de serie**
(`tests/scrum728d-viajes-de-la-reserva.test.mjs`, medido en ejecución con un doble). El **cuarto**
—`invoiceNumber.service.ts:509`— es el único cuyo COSTE crece:

```ts
const emitidas = await tx.invoice.findMany({
  where: { merchantId, number: { startsWith: prefijoF } },
  select: { number: true },
});
seq = siguienteSeqDeLaSerieF(emitidas.map((f) => f.number), year);
```

Se traen a node **todas** las facturas de la serie F de ese merchant **en el año en curso** y se
busca el máximo **en memoria**. Escala con `N` = facturas F de ese merchant ese año; crece todo el
año y se reinicia en enero.

**Y está dentro del cerrojo**, que es `pg_advisory_xact_lock` de transacción: no se suelta hasta el
COMMIT, así que todo lo que cuesta se serializa entre emisiones simultáneas — contra un presupuesto
que **no crece con nada**, el `timeout` de 5 s por defecto de Prisma (SCRUM-728).

### La curva, medida (no estimada)

Ejecutando `siguienteSeqDeLaSerieF` compilada, 50 repeticiones por punto, con suelo: con 500
emitidas tiene que devolver 501 o el guion aborta —si la derivación no acierta, no está midiendo
lo que dice—.

| N (facturas F del año) | derivar el máximo | payload de la consulta |
|---|---|---|
| 100 | 0,13 ms | 2,1 KB |
| 500 | 1,39 ms | 10,3 KB |
| 1.000 | 1,95 ms | 20,5 KB |
| 2.500 | 5,89 ms | 51,3 KB |
| 5.000 | 7,46 ms | 102,5 KB |
| 10.000 | 18,85 ms | 205,1 KB |

**Lineal, y barato en CPU**: 19 ms con diez mil facturas es imperceptible. Lo que crece de verdad
es el **payload que cruza la conexión dentro del cerrojo**.

⚠️ **Lo que esta medición NO cubre, dicho para que no se le suponga más:** la hidratación de N
filas por parte de Prisma y el tiempo de red hasta la base. No se pueden medir sin base, y son
justamente los dos términos que en la práctica dominan. **Quien abra el ticket los mide primero**,
con una base de verdad — mismo aviso que la entrada de `listCustomers` con la descarga en 4G.

### El umbral: **1.000 facturas de la serie F en un merchant y un año**

Por qué ese número y no otro:

- **Por debajo no hay nada que arreglar, y está medido**: con 1.000 la derivación cuesta 1,95 ms y
  el payload 20,5 KB. Dentro de una sección crítica con 5.000 ms de presupuesto, eso es el 0,04 %.
- **Y por encima este NO es el primer problema.** `MAX_REGISTROS_POR_ENVIO = 1000`
  (`registro.builder.ts`): un merchant con más de 1.000 facturas en el ejercicio **ya no puede
  generar su XML anual** — `verifactu_demasiados_registros` lo corta en claro. O sea que el 1.000
  ya es una frontera del producto, medida y escrita, y cruzarla obliga a una revisión de todos
  modos. **Este viaje se arregla DENTRO de esa revisión, no antes y no aparte.**
- Usar un número más bajo sería pedir una sesión para ahorrar dos milisegundos; uno más alto sería
  ponerlo detrás de un fallo que ya salta antes.

### Por qué hoy NO es un ticket

**Cero merchants reales**, y en producción hay **55 filas en `invoices` en total**
(`docs/MIGRATIONS_PENDING.md`, 7-10-ago-2026) contando todos los merchants y todos los años.
Llegar a 1.000 en un solo merchant y un solo año son ~4 facturas por día laborable, todos los días.
Regla 37: sin víctima hoy, no hay ticket.

### El arreglo, cuando toque

`orderBy: { number: 'desc' }, take: 1` sobre el mismo `where`: el índice `@@unique([merchantId,
number])` lo resuelve sin traer filas. **Funciona porque la secuencia va con relleno de ceros a 4
dígitos** (`F260007`), así que el orden de texto y el numérico coinciden dentro del mismo año —
hasta `F269999`. Esa condición es parte del arreglo, no un detalle: si alguien quita el relleno, la
optimización empieza a devolver el máximo equivocado y **en silencio**.

---

## Al volver a una lista con «atrás», los FILTROS se pierden

**Medido el 9-sep-2026** · `origin/main` = `2119c430` · en navegador real, 390 px

Con SCRUM-832 el botón atrás ya vuelve a la lista. Pero vuelve **en blanco**:

| | buscador | estado |
|---|---|---|
| antes de abrir la ficha | `"Ruiz"` | `accepted` |
| después de pulsar atrás | `""` | `all` |

El hash guarda **qué vista** y **qué id**, no qué estaba filtrado. Al volver, la lista se pinta de
cero.

### Por qué no entra en SCRUM-832

Porque **no sale gratis**, y el ticket lo decía: entra sólo si es un añadido pequeño. No lo es —
son tres decisiones que no toca tomar de paso:

1. **Qué filtros se guardan.** La lista de Presupuestos tiene cinco (texto, estado, etiqueta, desde,
   hasta). ¿Todos? ¿Sólo los que se ven?
2. **Dónde.** En el hash —y entonces el enlace compartido lleva los filtros de quien lo copió— o en
   memoria, y entonces no sobrevive a recargar.
3. **Para cuántas listas.** Las cinco tienen filtros distintos; hacerlo sólo en una repetiría el
   defecto que este ticket vino a cerrar: cuatro pantallas comportándose de una manera y una de otra.

### El umbral

**Repasar 3 o más fichas seguidas de una misma lista filtrada.** Ese es el número, y sale de una
cuenta, no de una intuición: hoy se pierden **los dos filtros** que se pusieron (de los **cinco**
que tiene la lista de Presupuestos), así que revisar N fichas de una búsqueda cuesta **N−1
refiltrados**. Con N=1 no hay daño; con N=2 es un trámite; a partir de **N=3** el usuario gasta
más gestos volviendo a filtrar que leyendo, y entonces esto es un ticket y no un hueco.

También sube a ticket si aparece una queja concreta, o si se toca el filtrado de listas por otro
motivo y sale casi de balde.

**Hoy la víctima es menor que la del ticket que lo destapó**: antes el atrás te sacaba de la
aplicación; ahora vuelves a la lista y vuelves a filtrar. Molesta, no expulsa.

La medición está en `scratchpad/banco/filtros.mjs`: pone dos filtros, abre una ficha, pulsa atrás y
compara. Quien abra el ticket la tiene hecha.

---

# Medir sobre una población que se mueve bajo los pies — CUARTA vez

**9-sep-2026 · medido sobre `origin/main = 0269e8cd` · worktree `wt-verif5`.**
**No se abre ticket (regla 37): se resolvió al repetir la tanda.** Se anota porque es la cuarta
vez de la misma familia y porque el mecanismo va a repetirse más, no menos.

## El hecho

Una tanda dio DOS fallos en `scrum804-la-rama-viva` que no eran de la rama que los provocó: a
solas daba 9/9, y el fichero no se había tocado. Lo que cambió fue el mundo: **las ramas remotas
pasaron de 98 a 100 mientras la tanda corría.**

## El mecanismo, que es lo que hay que recordar

Ese guard toma una INSTANTÁNEA del árbol al cargarse el módulo y luego la contrasta contra lo que
`git` responde en vivo. Entre las dos cosas pasan minutos. Si en esos minutos otra sesión empuja o
borra una rama, la instantánea y `git` **discrepan sin que nadie se haya equivocado**.

    🔒 Un instrumento que compara su foto contra el mundo en vivo mide, además de lo suyo, cuánto
       ha tardado en mirar.

## Por qué va a pasar más

Con seis sesiones empujando y el auto-borrado de ramas al mergear, el espacio de refs cambia
varias veces por hora. Una tanda completa dura ~20 minutos. La ventana no se está cerrando: se
está abriendo.

## Las tres veces anteriores, para que se vea la familia

* **SCRUM-753** — se caía por una ref LOCAL obsoleta de una rama ya borrada del remoto: el guard
  leía `for-each-ref` en vez de `ls-remote`. Se arregló con `git fetch --prune`.
* **SCRUM-804** — su suelo exigía 558 ramas remotas y el auto-borrado dejó 98. Lo cerró Javier
  anclando a `git log --merges`, que el borrado no puede vaciar.
* **SCRUM-833** — la misma forma en `scrum637:164`, a cinco ramas de caer. Mismo remedio.

## Lo que NO se hace

⛔ Congelar el espacio de refs durante la tanda: sería mentirle al guard sobre el mundo en el que
vive. ⛔ Reintentar en silencio: convertiría un dato —«esto se mueve»— en ruido escondido.

La salida honesta, si alguien la construye, es que el guard **declare** cuándo su instantánea y el
árbol han divergido, en vez de acusar. Es la misma frase de SCRUM-822: «no pude mirar» y «está
roto» no son el mismo suceso.
