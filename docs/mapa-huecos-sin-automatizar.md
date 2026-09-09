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
