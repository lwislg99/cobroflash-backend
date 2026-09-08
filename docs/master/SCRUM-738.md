# SCRUM-738 · El tablero contra el árbol — y el censo que daba por hecho lo que no lo está

**Medido contra:** `origin/main` = `9545711d5172e24f1f985471a39c25bcc1062841` · 2026-09-04T23:36:56+01:00
**Rama:** `scrum-738-el-tablero-contra-el-arbol`

> 🔴 **EL ANCLA SE REMIDIÓ, Y EN ESTE TICKET NO ES UN TECNICISMO.** La primera medición fue contra
> `8dec48e4`, **77 commits por detrás**. El entregable de este ticket **es un censo del árbol**: dar
> cifras de un árbol que ya no existe es el instrumento contradiciéndose a sí mismo — vendría a
> decir qué está hecho midiendo un pasado. Se mezcló `main` (limpio, sin conflictos) y se rehízo el
> ciclo entero: medición, tanda y empuje.
>
> | | contra `8dec48e4` | contra **`9545711d`** |
> |---|---|---|
> | ramas traídas | 473 | **479** |
> | entradas de máster | 378 | **392** |
> | tickets censados | 444 | **449** |
>
> Las ramas de fase siguen en **17 sobre 15 tickets**, y `SCRUM-684` sigue saliendo `NO_MEDIBLE`
> titulado para 683. El veredicto no depende del árbol; las cifras sí, y por eso van fechadas
> (SCRUM-737).

---

## 1 · PASO 0 (regla 39) — y una parte la hice MAL

### a) ENTRADA — no hay pantalla, y la víctima es una sesión

La entrada es **el asesor asignando un carril**; la víctima, **la sesión que lo recibe**. En un solo
día se encargaron diez tickets ya mergeados; cuatro sesiones pararon a decirlo, una vuelta cada una.
El coste no son las vueltas: **es que la parada depende de que alguien se dé cuenta**, y eso no es
un mecanismo. Dos de esas cuatro las viví yo (SCRUM-719 y SCRUM-695).

### b) 🔴 MECANISMO — EXISTÍA, y mi primera medición dijo que no

Escribí «censo previo: ninguno» tras mirar los 18 `scripts/censo-*`. **No miré en `tests/`.**

**`tests/_censo-tickets.mjs` (SCRUM-388) contesta desde agosto la misma pregunta** —«¿qué hay en
`main` de un ticket?»— con **las mismas tres fuentes** (commits que lo nombran, entrada de máster,
ramas), y además con su propio suelo (`comprobarSuelo`) y su medida de capacidad.

Llegué a construir un motor entero antes de encontrarlo. **Se retiró completo.** Es la regla que
esta misma sesión aplicó por la mañana contra el arreglo del spread: *dos mitades distintas del
mismo instrumento se suman; la misma regla implementada dos veces, se queda una* — porque tener la
regla dos veces es cómo una se queda atrás.

📌 **Lo cazó un guard, no yo:** SCRUM-723 me obligó a declarar mi fichero entre los que nombran una
referencia móvil, y al ir a declararlo apareció `_censo-tickets.mjs` en su lista.

### c) La frontera, y lo que este censo NO puede saber

**El tablero es Jira y no se lee** — ni debe. Así que **no puede decir «figura como no hecho»**: eso
lo pone un humano. Lo que deriva del árbol es **qué tickets tienen trabajo suyo en `main`**. Va
escrito en la salida, no sólo aquí: un censo que no declara lo que no mide se lee como si lo midiera.

### d) `ls-remote` completo (paso 2 de `cerebro-yaqu`)

Sin rama `scrum-738-*`: **carril libre**.

---

## 2 · 🔴 EL CORAZÓN DEL TICKET: `censarTicket(684)` daba `ENTERO`

Y **SCRUM-684 no está hecho**: hay una sesión en su FASE B.

`docs/master/SCRUM-684.md` **existe** en `main` y su primer título dice **`# SCRUM-683`**. Lo explica
el propio fichero: *«dos sesiones se inventaron el mismo número»*, y dentro hay trabajo de
**SCRUM-703** y de **SCRUM-683** — de 684, ninguno.

El motor contaba la entrada por **existir** (`if (doc) fuentes.push('docs/master')`), sin mirar de
quién es. Es el mismo defecto que ese censo ya persigue un nivel más abajo —*«encontrar un mecanismo
que se parece no es encontrar el ticket»*— aplicado al fichero: **encontrar un fichero que se LLAMA
como el ticket no es encontrar su entrada**. Y falla hacia el lado cómodo, el que dice que no queda
trabajo.

**El arreglo, dentro del motor:** si el título de la entrada nombra a OTRO ticket, hay **número
compartido**, y entonces ni sus ramas ni sus commits son atribuibles. El veredicto pasa a
**`NO_MEDIBLE`** con su motivo, en vez de `ENTERO`. No se adivina cuál de los dos es: se dice que no
se puede saber.

> «No lo sé» **no** es «es de otro»: sin título, no se acusa de colisión.

| ticket | antes | ahora |
|---|---|---|
| **SCRUM-684** | 🔴 `ENTERO` | **`NO_MEDIBLE`** · titulado para SCRUM-683 |
| SCRUM-695 · 714 · 719 · 738 | `ENTERO` | `ENTERO` (sin cambio) |

---

## 3 · La letra de FASE: el motor estaba ciego donde más ramas hay

`^scrum-${n}(-|$)` no veía `scrum-684b-…`, que es la fase B del **mismo** ticket. **Medido hoy: 17
ramas de fase en 15 tickets distintos** — `294a`, `294b`, `37b`, `542b`, `604b`, `627b`, `650d`,
`652e`, `655c`, `667b`, `670b`, `683b`, `684b`, `710b`, `716c`, `728b`, `728c`.

Ampliado a `^scrum-${n}[a-z]?(-|$)`. ⚠️ **No reabre** el defecto que su propio comentario documenta
(«buscar el número suelto atribuía a SCRUM-2 las ramas `…-rebasada-2`»): sigue anclado y la letra va
pegada a los dígitos. **Comprobado: SCRUM-2 sigue sin ramas**, y SCRUM-240 sólo ve las suyas.

---

## 4 · La superficie que sí faltaba

`scripts/censo-tablero-vs-arbol.mjs` — **enumera y presenta, no dictamina**:

- **Enumeración derivada** (no lista a mano): **449 tickets**, de 479 ramas traídas y 392 entradas.
- **Ventana de presentación** `--dias=N`. Sin ella la propuesta son cientos de tickets y el desfase
  de esta semana queda enterrado. 🔴 **Es heurística de presentación**: no lee el tablero, no
  descarta a nadie del censo y no decide nada.
- Los **no propuestos** salen con su motivo: es la mitad que evita el falso positivo.

⛔ **Por identidad, nunca por substring**: «72» casa con 720, 727 y 1727. Los números se extraen con
delimitadores y se comparan enteros; hay test de los cuatro a la vez.

---

## 5 · 🔴 Mis dos defectos, y los dos los cazó ejecutar, no leer

1. **`714 !== '714'` siempre cierto.** El motor guarda el número como CADENA (`String(numero)`) y yo
   comparaba contra un `Number`, así que **todos los tickets salían con colisión**. Falló hacia el lado
   seguro —`NO_MEDIBLE` en vez de `ENTERO`— y aun así dejaba el censo inservible. **De ahí el control
   negativo**: sin él, un discriminador que marque TODO parece que funciona.
2. **El CLI no imprimía nada.** Usé `new URL(...).pathname`, que percent-codifica el espacio de
   «Javier Pereira». **Es exactamente SCRUM-730, quince minutos después de reportarlo.**

Y **dos veces el guard se cazó a sí mismo**, las dos arregladas estrechándolo a lo que dice proteger:
miraba el fichero entero y saltaba por mis comentarios; y luego por el **literal** donde el censo
declara lo que no mide — prohibir la palabra habría obligado a **borrar la declaración** para pasar
el guard. Se prohíbe **la acción, no la palabra**.

---

## 6 · Lo que NO hace

⛔ **No cierra ningún ticket y no toca el tablero.** Hay test que lo ata sobre el código ejecutable:
ni escritura a disco, ni red, ni invocación. Y un trinquete contra mi propio error: si alguien vuelve
a escribir aquí la lógica de las tres fuentes, el test cae — **el veredicto es del motor**.

⛔ **No lee el estado del tablero**, y lo dice en su propia salida. La propuesta es media respuesta a
propósito; la otra media es humana.

---

## 7 · Los tres guards de la casa que saltaron, y ninguno se apagó

| guard | qué dijo | qué se hizo |
|---|---|---|
| **SCRUM-723** | mi fichero nombra una referencia MÓVIL y no está declarado | **declarado con su motivo**: la pregunta de este censo es sobre la PUNTA de `main`; contra la base de una rama respondería sobre un pasado que a nadie sirve |
| **SCRUM-533** | `tests/_censo-tickets.mjs` lleva **417 CRLF en disco** | convertido a LF |
| **SCRUM-388** | sus 16 casos sobre el motor que he tocado | **siguen verdes** |

📌 **El CR era el caso de SCRUM-570 exacto:** el blob en git ya estaba en **LF** —`.gitattributes`
normaliza— y los 417 CRLF vivían **sólo en mi copia de trabajo**, donde `git status` no los ve y el
guard sí. Convertirlo no produce ni una línea de diff. Y me lo saltó mi propia limpieza automática
porque cortaba mal la ruta de `git status --porcelain`: lo cazó el guard, no yo.

**Y el 723 fue quien destapó el ticket entero:** al obligarme a declarar mi fichero entre los que
nombran la referencia móvil, en su lista apareció `_censo-tickets.mjs` — el motor que llevaba desde
agosto contestando mi pregunta.

## 8 · Coste de la suite, medido

El censo completo consulta git **por ticket**: con 449, tarda **~10 minutos**. Metido tal cual en
`npm test` se lo cobraría a las nueve sesiones en cada tanda. Por eso `poblacionDe()` va **aparte**
de `censar()`: lo caro se queda en el CLI y la suite ejercita lo barato. La primera versión del test
llamaba a `censar()` y tardaba esos diez minutos — medido, no supuesto.

**Tanda tras el último cambio:** 5.215 pass · `# fail 1` (SCRUM-176b, ajeno · SCRUM-730, carril de
S5) · 88 saltos. `guards:entrada` 21/21.
