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
