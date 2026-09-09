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
