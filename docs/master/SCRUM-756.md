# SCRUM-756 · Un formulario que rechaza y no lo dice

**Fecha:** 5-sep-2026 · **Carril:** producto / navegador · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `6fa04adc66a95509f52b3b0b38679e19c5b0baa0` · 2026-09-05T16:55:13Z

---

## LA VÍCTIMA

El profesional con el cliente delante. Entra al dashboard, va a Presupuestos, abre «+ Nuevo
cliente» desde el selector, pulsa **Guardar** sin nombre — y **no pasa nada**. No falla, no avisa,
no se cierra. Se queda quieto.

En un producto que promete un presupuesto en 30 segundos, ése es el peor modo de fallo que hay:
**el que no se distingue de estar colgado.**

---

## EL MECANISMO

`avisar` nace como no-op en `customersView.js` y **sólo** se sustituye dentro de
`renderCustomersView`, que corre únicamente al navegar a Clientes (`app.js`). Quien no ha pasado
por esa pantalla no tiene caja de avisos:

```js
avisar("error", "El nombre es obligatorio.")   →   function () {}
```

**La validación no está rota.** Rechaza perfectamente. Lo que falta es que se vea.

Medido en SCRUM-591 con el banco de vistas, con control positivo:

| caso | ¿llega el aviso? |
|---|---|
| Guardar sin nombre, **desde el documento** | **NO** |
| La misma acción tras `configurar` (como en Clientes) | SÍ |
| Servidor 400, desde el documento | **NO** |
| Servidor 400, configurado | SÍ |

---

## LA DECISIÓN DEL FUNDADOR (5-sep-2026)

🔴 **La caja del aviso pertenece al MODAL, no a la vista que lo abrió.** La protección vive donde
está la acción, no un nivel más allá. Un formulario que puede rechazar tiene que poder decirlo por
sí mismo; que su mensaje dependa de por dónde haya navegado antes el usuario es la definición
exacta de una protección que vive fuera de su sitio.

### Y el arreglo obvio suspende — medido antes de elegir

Que `quotesView` llamara a `configurar` **no** vale: `avisar` es UN SOLO valor global, así que en
cuanto el usuario visita Clientes, los avisos del alta abierta desde el DOCUMENTO se pintan en la
caja de CLIENTES:

```
avisos entregados a: ["CLIENTES <- null","CLIENTES <- error"]
-> el alta se abrio DESDE EL DOCUMENTO y el aviso fue a la caja de CLIENTES
```

Un aviso pintado donde nadie mira es tan invisible como no pintarlo, **y además parece arreglado**.

---

## LO QUE SE CONSTRUYE

Caja de avisos propia del formulario (`modalAlertBox`) y una bandera por apertura
(`avisarEnLaVista`):

| entrada | avisa en |
|---|---|
| `abrir` — los botones de la tabla de Clientes | la caja de Clientes, **como hasta hoy** |
| `abrirNuevo` — el selector de un documento | la caja del propio modal |

La bandera se pone **en cada apertura**, no una vez: si se dejara al valor anterior, abrir desde el
documento después de haber abierto desde Clientes seguiría avisando en la caja equivocada — el
defecto entero, sólo que más difícil de ver.

### Dos cosas que decidió el CSS, no el gusto

- **Va dentro de `.modal-body`.** Como hijo directo de `.modal` salía sin padding lateral
  (`.modal` no tiene; lo ponen `.modal-header` y `.modal-body`), o sea pegada a los dos bordes.
  Dentro hereda el padding y el `gap: 14px` de la columna: no estrena ni una regla de CSS.
- **Se trae a la vista al avisar — ESTE MISMO TICKET EN VERSIÓN SUTIL.** `.modal` lleva `max-height: calc(100vh - 40px)` con
  `overflow-y: auto` y el formulario tiene veinte campos: quien pulsa «Guardar» está abajo, y un
  aviso arriba del cuerpo le queda fuera de pantalla. Sería este mismo defecto en versión sutil.
  Sin `behavior: 'smooth'`: un error no se anuncia con una animación, y así no hay motion que
  reconciliar con `prefers-reduced-motion` (AB6).

**MICROCOPY: ninguna nueva.** Se reutilizan los mensajes que el formulario ya emitía
(«El nombre es obligatorio.», «Error guardando cliente: …»). Esto construye el CONTINENTE, no el
texto — por eso no lleva marcador ni contador. Y reutiliza las clases `alert` / `error` / `success`
que la casa ya tiene: cero tokens nuevos (DESIGN.md).

---

## LOS TRES CONTROLES · el rojo ANTES del arreglo

```
ok 1  SUELO: el dashboard monta y el formulario se abre con campos
not ok 2  🔴 EL QUE DECIDE: sin pasar por Clientes, el rechazo SE VE
ok 3  ✅ CONTROL POSITIVO: desde Clientes el aviso sigue en LA CAJA DE CLIENTES
not ok 4  🔴 LA TRAMPA: tras visitar Clientes, el aviso del DOCUMENTO no va a su caja
```

Después del arreglo, **6 de 6 en verde**. El control positivo estaba verde antes y sigue verde:
lo que funcionaba no se ha movido.

---

## EL CENSO · ¿cuántas costuras más tienen esta forma?

Por AST, sobre la forma del defecto: **un no-op de módulo que además se reasigna y se invoca**. Las
tres condiciones juntas, y ninguna sobra — sin reasignación no es una costura; sin invocación no se
traga nada.

**81 ficheros leídos · 2 costuras**, las dos en `customersView.js`:

| costura | nota |
|---|---|
| `avisar` | la de este ticket |
| `trasGuardar` | la otra mitad del mismo patrón. Su no-op es **inocuo** —el documento no tiene tabla que recargar— pero es la misma forma, y si un día recarga algo tendrá el mismo agujero. |

🔴 **Cero habría sido ceguera, no limpieza**, y el guard lo dice así: hay dos medidas, y si el
censo devolviera 0 el roto sería el detector. Instrumento controlado en cuatro casos: ve el patrón
fabricado · un no-op que nadie reasigna no cuenta · uno que nadie invoca tampoco · una función con
cuerpo tampoco.

---

## MUTACIONES DECLARADAS Y COMPROBADAS

| mutación | qué imita |
|---|---|
| la caja del modal se queda sin texto | el rechazo vuelve a ser invisible |
| el modal vuelve a delegar siempre en la costura global | reaparece la trampa de la caja ajena |
| el desplazamiento desaparece | la mitad mecánica del `scrollIntoView` viajaría sin guard |

`npm run meta:mutaciones` — **corrido TRES veces** por la sospecha de SCRUM-754: **vivas 15 ·
mudas 0 · ciegas 0** en las tres, con las tres mutaciones de este ticket dentro.

---

## SOBRE SCRUM-754 (el meta-guard que oscila)

**No se ha reproducido hoy.** Seis pasadas seguidas del meta-guard sobre este ticket, todas
`vivas · mudas 0 · ciegas 0`. En SCRUM-751 la primera pasada dio CIEGAS y las tres siguientes
VIVAS; aquí la primera ya salió VIVA. Sigue sin explicación.

---

## HUECOS DECLARADOS

- **No hay capturas antes/después ni matriz de dispositivos** (AB6). Todo lo medido es DOM
  simulado (`_banco-vistas.mjs`). La caja **no está medida en navegador real** a 929/390 px: el
  encargo eximía de medirla por no haber microcopy nueva, pero el continente sí es nuevo.
- **`scrollIntoView`: la mitad mecánica está MEDIDA, el efecto NO.** El banco no lo implementa,
  pero se le inyecta un espía en todos los nodos del modal: se mide que se llama **una vez**,
  **sobre el nodo de la caja** (no otro), y que la llamada que LIMPIA el aviso no desplaza. Lo
  que NO se mide es que el desplazamiento deje el aviso a la vista de un humano: eso depende del
  motor de maquetado y aquí no hay. Esa mitad queda declarada, no afirmada.
- **El primer control negativo del espía estaba mal planteado** y se deja escrito: se puso el
  nombre esperando que «sin rechazo no hay aviso», y el envío con ÉXITO también avisa. El rojo
  acusaba al caso, no al detector.
- No se tocó la validación, ni se añadió duplicado por nombre, ni se borró
  `abrirNuevo({ nombre })` — capacidad muerta que el fundador decide aparte.

---

## EL MERGE DE `main`, Y POR QUÉ SE RE-MIDIÓ DESPUÉS

`main` se movió mientras este ticket estaba en vuelo: **11 commits**, con dos PR dentro
(SCRUM-606 «albarán desde presupuesto» y SCRUM-750 «los dos calendarios»). Se mezcló `main`
**DENTRO** de la rama —nunca al revés, nunca rebase— y la tanda va DESPUÉS del merge.

No es una formalidad: SCRUM-606 estrena `albaranDesdePresupuestoModal.js`, **un modal nuevo**, y
el censo de este ticket afirma que hay exactamente DOS costuras no-op en el dashboard. Un modal
nuevo con una costura más habría tumbado el censo — que es justo lo que el censo existe para
hacer. Re-medido tras el merge: **17/17 en verde** (los 6 de este ticket y los 11 de SCRUM-591),
y el censo sigue en 2.

---

## TANDA

**5.490 tests · 5.402 pass · 0 fail · 88 skipped · estado 0**, sobre el árbol ya mezclado con
`main`. Los 88 saltados declaran su motivo: 77 piden base (`QA_DB_TEST` / `A55_DB_TEST` /
`BOT_SUITE_TEST`, la tanda gateada), 10 piden `LIBRO_PG_URL` (un Postgres desechable) y 1 no puede
crear un enlace a fichero en Windows sin elevación — ese último dice que su mecanismo queda
cubierto por el control positivo portable que sí corre.
