# SCRUM-713b · PASO 0 sobre lo que entró, medido corriendo

**Medido contra:** `origin/main` = `02dd12b26972e394e907f18980842111554ce4c6` · 2026-09-08T10:39:26+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-713b-lo-que-entro`
**Carril:** front / presupuesto · **Lo que entró:** `2f64bf15`, ya en main

Codex leyó lo que entró y declaró tres cosas, **diciendo que no las verificó corriendo**. Se han
medido las tres en navegador, con la pantalla pintada. **Dos existen, una está mal ubicada, y la
tercera no es lo que parecía.**

## ① El literal sin firma — **EXISTE**, y es peor: son TRES

Corrido con cero clientes: en pantalla sale **«Añade a tu primer cliente»**.

Preguntado al buscador oficial de la casa (`constaAprobado`, por identidad):

| texto de la pieza | ¿consta aprobado? |
|---|---|
| `placeholder` — «Buscar por nombre, teléfono, email o referencia…» | 🔴 **NO** |
| `sinResultados` — «Sin resultados para tu búsqueda» | 🔴 **NO** |
| `sinNinguno` — «Añade a tu primer cliente» | 🔴 **NO** |

⚠️ **Los tres, no uno.** Y el `placeholder` lleva escrito en el código «✅ APROBADO por el asesor el
2-sep-2026» mientras el registro dice que no consta: o la aprobación no se registró, o el comentario
afirma algo que nadie firmó. **Un comentario no es una firma.**

### 🛑 Y el literal firmado NO es de esta ranura

«Primero necesitas un cliente.» **sí consta aprobado** — pero en
`docs/MICROCOPY_APROBADA_SIN_APLICAR.md`, en la tabla del **modal de Trabajo nuevo**, como
**«Aviso · sin clientes»**. Es un *aviso* (un mensaje que salta), no el **estado vacío de un
desplegable** en la pantalla de presupuesto.

Aplicarlo aquí sería mover una firma de una ranura a otra y de una forma a otra, que es
exactamente lo que la regla 30 impide. **Se para y se propone** (abajo).

### Matiz que cambia a quién señalar

Los tres textos **no los inventó este commit**: ya estaban en pantalla en `customersView.js`, y el
713 los reutilizó. O sea, llevan tiempo en producción sin constar. El commit no abrió el agujero;
lo extendió a una pantalla más.

## ② El estilo desde JavaScript — **EXISTE**, pero NO donde se dijo

Codex lo situó en el buscador. Medido: **`buscadorDeClientes.js` tiene CERO** `cssText` y cero
`.style.`. Mi primer barrido sobre ese fichero dio 0 y estuve a punto de dar el punto por falso.

El diff completo del commit lo encontró en **`quotesView.js:475`**:

```
buscadorCliente.style.cssText = "width:100%;min-height:44px;margin-bottom:6px";
```

**Arreglado**: mudado a la hoja como `.quote-buscador-cliente`. Control corrido, antes y después:

| | `style=` en línea | width | min-height | margin-bottom |
|---|---|---|---|---|
| antes (main) | 🔴 sí | 233.391px | 44px | 6px |
| después | ✅ ninguno | **233.391px** | **44px** | **6px** |

**Idéntico al píxel.** El 44 es AB6 y no se toca.

⚠️ Y se dice para que el arreglo no parezca más de lo que es: `quotesView.js` tiene **otros 18**
`cssText` y el dashboard **352 en 34 ficheros** —contados sobre CÓDIGO, porque un `grep` a pelo se
caza a sí mismo en el comentario que lo explica—. Se ha quitado **el que entró con este ticket**,
que es lo que restaura el estado. Congelar los 352 pide un trinquete propio (patrón SCRUM-402).

## ③ El filtrado en memoria — **el defecto NO es la espera**

Tu contexto era el bueno. Medido con **2000 clientes**, corriendo:

- peticiones a `/admin/customers`: **1**, y **ninguna con `?search=`**
- opciones en el `<select>` del DOM: **2002**
- `listCustomers` (`src/modules/system/customerAdmin.ts:100`): **`findMany` sin `take`**

O sea: **se los trae todos y los pinta todos.** Con 200 clientes el patrón de la factura no hacía
falta porque el desplegable ya era el problema; con 2000, el navegador recibe 2000 filas para
enseñar diez.

🔴 **Y no lo introdujo el 713.** `git log -S` sitúa tanto `getCustomers("")` en `quotesView.js`
como el `findMany` sin `take` en el **commit fundacional `5142388b`** (26-nov-2025). El buscador
nuevo se apoyó en una lista que la pantalla ya cargaba entera. Filtrar en memoria sobre una lista
que ya está en memoria es **coherente**; lo que no lo es, es que esté en memoria.

## Lo que hace falta que firmes o decidas

1. **Los tres textos del buscador.** Propuesta, para que sean los mismos que ya se leen en Clientes
   y no una cuarta redacción:
   - placeholder → «Buscar por nombre, teléfono, email o referencia…» *(el que ya está)*
   - sin resultados → «Sin resultados para tu búsqueda» *(el que ya está)*
   - sin ningún cliente → **«Primero necesitas un cliente.»** si quieres el firmado aquí, sabiendo
     que su firma es para un **aviso** del modal de Trabajo; o firmar «Añade a tu primer cliente»
     para esta ranura y para `customersView.js`, que es donde lleva tiempo.
2. **③ toca `listCustomers`, que es compartido.** Ponerle tope y pasar a `?search=` cambia el
   comportamiento de todas las pantallas que llaman `getCustomers("")`. Es un ticket propio con su
   medición; dime si lo abro.
3. **Los 352 `cssText`**: trinquete propio, del patrón de SCRUM-402.

## Cierre

Sin tocar ni un texto (regla 30). Lo único que cambia de comportamiento es el estilo del buscador,
y está medido igual al píxel.

---

## 🛑 CORRECCIÓN, media hora después: la firma SÍ existe para esta ranura, y hay trabajo de otra sesión SIN EMPUJAR

Todo lo de arriba se midió sobre el árbol que yo tenía, y era cierto **de ese árbol**. Al terminar
apareció lo que faltaba, y cambia la conclusión de ①.

**En el disco de este worktree hay `docs/microcopy/2026-09-07-SCRUM-713-buscador-cliente.md`, SIN
SEGUIR POR GIT**, con la firma del fundador del 7-sep-2026 **para esta ranura exacta**:

| Qué es | Texto aprobado |
|---|---|
| Búsqueda sin resultados | Sin resultados para tu búsqueda |
| **Cero clientes en total** | **Primero necesitas un cliente.** |

Con su frase: *«Firmados los dos. Escríbelos exactamente así»*.

**Mi ① queda corregido**: no es que la firma sea de otra ranura — es que **ese registro no existía
en mi árbol cuando pregunté**, y `constaAprobado` sólo pudo ver el congelado. Lo trajo, sin querer,
un `git stash pop` que aplicó el stash de OTRA SESIÓN que trabaja el mismo ticket en este mismo
worktree. La medición no estaba mal; **estaba hecha sobre un árbol incompleto**, que es otra forma
del error del contador de commits.

### 🔴 Y lo urgente: ese trabajo puede perderse

- **No existe ninguna rama `scrum-713` en el remoto.** Comprobado con `git ls-remote`.
- Su trabajo vive en `stash@{0}` (`On scrum-713-buscador-cliente: scrum713-before-main-20260908-…`)
  y toca `styles.css`, `quotesView.js` (+88 líneas) y dos tests — **los mismos ficheros que yo**.
- Sus tres ficheros nuevos están **sin seguir**: el registro de microcopy y dos tests.

**No he tocado su stash ni sus ficheros.** Y no aplico el literal firmado: hacerlo duplicaría su
trabajo y garantizaría el conflicto. Es el quinto caso de dos sesiones sobre el mismo ticket.

### Lo que sigue en pie de mi tanda

**②** —el `cssText` mudado a la hoja, medido idéntico al píxel— y **③** —la medición de que la
pantalla se trae los 2000 clientes y de que eso viene del commit fundacional, no del 713—. Las dos
son independientes de qué implementación del buscador gane.

---

# SCRUM-713c · las tres decisiones del fundador, ejecutadas — 8-sep-2026

**Medido contra:** `origin/main` = `da5ac06ac169fca5d3692a63b10b01a6aed7d3d6` · 2026-09-08T11:43:56+02:00
**Rama:** `scrum-713c-port-y-trinquete`

## ① El stash: qué había dentro, y qué se ha portado

⚠️ **`stash@{0}` NO era mío** — su mensaje dice `On scrum-713-buscador-cliente` y mi rama era
`scrum-713b-lo-que-entro`. Comprobado ANTES de tocarlo, como manda el aviso de la casa. **Se leyó
con `stash show -p` y se aplicó con `apply`, nunca con `pop`: sigue intacto en la lista.**

### Lo que hay dentro (4 ficheros, +98/−10)

| fichero | qué hace |
|---|---|
| `styles.css` (+5) | tres clases para el campo de cliente y su estado. **Cero `cssText`** |
| `quotesView.js` (+88) | buscador que **consulta al servidor** (`getCustomers(q)`), con **espera de 250 ms**, **guardia de carrera por versión**, `role="status"` y `aria-busy` |
| `scrum697` y `scrum698` (+15) | ajustes en dos guards para que reconozcan la estructura nueva |

### Lo que se ha portado

- **Los literales firmados.** `sinNinguno` pasa de «Añade a tu primer cliente» (que **no consta
  aprobado**) a **«Primero necesitas un cliente.»**, firmada por el fundador el 7-sep para esta
  ranura. Verificado con `constaAprobado` por identidad: ahora consta en dos registros.
- **`min-width: 0` y `box-sizing: border-box`** en la clase del buscador. Sin ellos el campo se
  desborda de su columna en pantallas estrechas — un defecto que aquella implementación ya había
  medido y que la de main no contempla.

### 🔴 Lo que NO se ha portado, y el motivo salió del conflicto

El buscador contra servidor **no se porta**, y no por comodidad: al aplicarlo salió que **main
tiene una salvaguarda que el stash no**.

```
main:   filtrar(customersList, texto, seleccionado)   ← conserva el cliente YA ELEGIDO
stash:  clientesFiltrados                              ← al teclear hace select.value = ""
```

El comentario de main lo explica: sin conservarlo, «teclear otra cosa le quitaría su `<option>` al
`<select>`, que se quedaría con un `value` que no puede mostrar: **el documento perdería al cliente
por teclear, y en silencio**».

Portar el buscador entero exige **decidir** cuál de los dos comportamientos vale. Eso no es un port,
es una decisión de producto — y encaja con la decisión ② del fundador: si traerse todos los
clientes no es ticket hoy, arreglarlo tampoco toca hoy. Queda escrito en el mapa de huecos, con la
media solución ya localizada para que quien lo abra no empiece de cero.

**El stash no se suelta**, y no por descuido: no es mío. Lo suelta quien lo creó, o dilo tú y lo
hago yo.

## ② El hueco de `listCustomers`, documentado con su umbral

En `docs/mapa-huecos-sin-automatizar.md` (fichero nuevo).

🔴 **Y midiéndolo se cayó mi primera medición.** El «tiempo de pintado» daba **629 ms con 50
clientes y 629 con 5000**: plano. No medía el render — medía la espera fija de mi propio banco.
Con el instrumento arreglado sale lineal, y **el hallazgo cambia**: el coste de CPU es
despreciable incluso con 10.000 (44 ms). Lo que duele es **el payload: 993 KB de JSON**.

Umbral fijado: **2.500 clientes** ≈ 250 KB, medido a 96 KB por cada 1.000. Y se declara que la
conversión a segundos de 4G es **aritmética sobre bytes medidos, no una medición de red**.

## ③ El trinquete de `cssText`, de cuenta

`tests/scrum713c-trinquete-de-estilos-en-js.test.mjs`. Techo **351** (era 352; bajó uno al mudar el
del buscador a la hoja en SCRUM-713b, ya en main).

- **Cuenta, no limpia.** Bajar es legal y **obliga a apretar el número** — un techo con holgura es
  sitio para que vuelva a subir sin que caiga.
- **Declara lo que NO cubre**, y lo repite **en su rojo**: no mira `setProperty`, no mira `style=`
  en HTML estático, no mira fuera de `public/dashboard/`.
- **Cuenta sobre CÓDIGO**, no sobre el fichero. Sin eso se caza a sí mismo: midiendo esto, la
  cuenta subió de 19 a 20 al escribir el comentario que explicaba por qué había 19.
- **Suelo que no caduca**: el contador se prueba contra dos cadenas fabricadas —una que debe contar
  1 y otra, en comentario, que debe contar 0—, así que sigue probando algo el día que el árbol esté
  limpio.

**Control positivo corrido:** añadido un `cssText` en `reportsView.js` → **rojo**, nombrando fichero
y líneas (`reportsView.js: 27 (líneas 2, 10, 16…)`, y la 2 es la inyectada). Restaurado → verde.

## La suite: 10 fallos, ninguno de esta rama, y atribuidos uno a uno

| cuántos | de quién | cómo se comprobó |
|---|---|---|
| **6** | los ficheros SIN SEGUIR de la otra sesión (`scrum713-buscador-cliente.test.mjs` y su `.browser.mjs`) | corridos solos: 4 fallos suyos; y el rojo de SCRUM-258 **nombra su fichero**, `…browser.mjs:138` |
| **4** | SCRUM-804, y lo dice su propio suelo: *«sólo 98 ramas remotas. Había 558 al escribir esto»* | apartados mis cambios con `stash -u`, **sigue fallando 4** |

Sus tests fallan porque prueban **su** implementación —la del servidor con espera—, que es
justamente la que se decidió no portar. No se tocan ni se borran: no son míos y no están en git.

⚠️ Y el aviso, otra vez con nombre: al apartar mis cambios usé `stash -u`, comprobando **antes y
después** que su `stash@{0}` seguía intacto y volvía a ser el único. En esta sesión un `stash pop`
descuidado ya aplicó su trabajo una vez.

## Un fichero que se incluye sin ser mío, y por qué

`docs/microcopy/2026-09-07-SCRUM-713-buscador-cliente.md` **entra en este commit**, y no es mío: lo
escribió la otra sesión. Se incluye porque es **la constancia de una firma del fundador** y estaba
sólo en el disco, sin git: si alguien limpia este worktree, la firma se pierde y el literal que
acabo de aplicar se queda sin respaldo — que es justo el defecto que este ticket vino a cerrar.

**Sus dos tests NO entran**: prueban la implementación contra servidor, que se decidió no portar, y
entrarían en rojo. Siguen donde están, sin seguir por git y sin tocar.
