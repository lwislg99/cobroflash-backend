# SCRUM-904 · «Completar →» ya lleva a donde está el campo — y la fila que faltaba por medir tenía OTRO defecto debajo

**Medido contra:** `origin/main` = `76c786f60721e0caeb7eac056b5f65863abb6b6b` · 2026-09-17T10:19:21Z
**Rama:** `scrum-904` · **Carril:** Sesión 5
**Gate:** 🔴 **el literal del aviso está PROPUESTO y PARADO** (regla 30) — ver §5. Lo construido **no
pinta ni una palabra nueva**.

> El checklist decía qué te falta para cobrar y dos de cada tres flechas no llevaban a ninguna
> parte. Arreglar el banco para medir la que faltaba destapó un defecto distinto.

⏱ Hora **de GitHub** (cabecera `Date:` de `https://api.github.com/zen`, leída con `curl -sI`: `gh`
no está en el PATH de este árbol).

---

## 0 · PASO 0 — el defecto existe HOY, y se reprodujo CORRIENDO

Navegador real (Edge vía `puppeteer-core`), sobre el `settingsView.js` de `main`.

**POBLACIÓN: 4 filas del checklist × 9 pestañas = 36 casos.** Las filas se identifican **por su
rótulo, no por su índice**: el checklist sólo pinta «Completar →» en lo que no está en verde, así
que la lista se mueve con el merchant.

```
MUDAS:   33      ÚTILES:  3      FATALES: 0      SUMA: 36 / 36
```

### Las cifras suman, y aquí están cuadradas

| lo que traía el ticket | medido ahora |
|---|---|
| 24 mudas ya medidas | **24** (8 × «Presupuestos por WhatsApp» + 8 × «Cobro por transferencia o Bizum» + 8 × «Datos fiscales») |
| 9 de la fila 2, **sin medir** | **9**, y **también mudas** — ver abajo |
| 3 restantes | **3 útiles**: cada fila pulsada desde la pestaña donde ya vive su campo |
| | **24 + 9 + 3 = 36** ✔ |

## 1 · 🔴 LA FILA 2 NO ERA «como las otras»

Los 9 casos de «Cobros con tarjeta» estaban sin medir porque el banco devolvía
`{enabled:false}` en `/admin/connect/status`, y `renderConnectCard` hace `return` **en esa misma
línea**: la tarjeta no se pintaba y el clic caía en su rama de reserva **por un motivo que no era el
que se investigaba**.

Arreglado el banco (`{enabled:true, connectStatus:'none'}`), la tarjeta se pinta — y **las 9
siguieron cayendo en la reserva, por otra causa**:

```js
const c = [...document.querySelectorAll('h2')].find((h) => /tarjeta|Stripe|Connect/i.test(h.textContent));
```

**Medido en el DOM pintado, no leído:** los `<h2>` que casan esa expresión son **CERO**. Los cinco
que hay son «Tu cuenta, lista para cobrar», «Datos de la empresa», «WhatsApp este mes», «Tu página
pública» e «Invita y gana meses gratis 🎁». El rótulo del bloque de Connect es un **`<p>`**.

Así que son **DOS defectos distintos**, y por eso abrir la pestaña no bastaba:

- **Tres filas** apuntaban bien (`[name=…]`) y su panel estaba oculto → la causa de SCRUM-894.
- **La fila 2** apuntaba a **algo que no existe** → habría seguido muda con la pestaña abierta.

    🔒 Referenciar por posición —o por el texto de una etiqueta— caduca. Referenciar por identidad no.

⚠️ **Un banco que no monta la superficie no la mide: la declara no medida.** Por eso el guard ahora
EXIGE que la tarjeta esté pintada antes de dar veredicto.

## 2 · Lo construido

Un solo fichero de producto: `public/dashboard/js/settingsView.js`.

- **`bloqueDeConnect()`** — el bloque se pide por su `id` (`#connect-status-body`), no por el texto
  de un rótulo.
- **`llevarASuPestana(destino)`** — abre el panel del destino **pulsando la pestaña del producto**
  (no replicando `submenuActivo`/`pintarNav`, que viven en otro cierre: dos sitios decidiendo qué es
  «abrir una pestaña» es la segunda fuente de siempre), y **devuelve `false` si el destino sigue sin
  verse**. No miente: el bloque de Connect con el flag apagado sigue oculto aunque su panel esté
  abierto.
- El clic del checklist usa las dos y, si no pudo llevar a ninguna parte, hace lo de antes.

⛔ **NO cambia QUÉ es obligatorio ni qué filas salen.** Sólo **a dónde va el clic**.

## 3 · Rojo y verde, los dos REALES

Mismo instrumento, `npm run guard:completar-lleva-al-campo`, sobre los mismos 36 casos.

- **ROJO** — con el `settingsView.js` de `main`: **exit 1, 33 fallos**, nombrando cada uno. Muestra:
  *«[cobro → «Datos fiscales»] LA ACCIÓN NO LLEVA A NINGUNA PARTE — el destino existe pero está
  OCULTO (su panel no se abrió)»*. Es una de las 24.
- **VERDE** — con el arreglo: **exit 0, 0 mudas de 36**, cada una con la pestaña de su destino
  abierta y el rótulo del campo leído del DOM («NIF/CIF», «IBAN (para pagos por transferencia —
  España/Europa)», «Teléfono WhatsApp (E.164 sin +)»).
- **El verde real que NO se movió:** `empresa → «Presupuestos por WhatsApp»` llegaba antes y sigue
  llegando **sin cambiar de pestaña** (`empresa→empresa`). El arreglo no mueve la pantalla debajo de
  quien ya estaba donde tenía que estar.

## 4 · Lo que conserva la medición

`scripts/guard-completar-lleva-al-campo.mjs`, con **las cuatro patas**:

1. **ROJO REAL** — el barrido, con el fallo nombrado por pestaña y acción.
2. **VERDE REAL** — exige que siga habiendo casos que llegan **sin** cambiar de pestaña; si no
   queda ninguno, se declara ciego.
3. **SUELO** — 0 acciones o menos de 2 pestañas = **CIEGO**, nunca «0 mudas». Y la tarjeta de
   Connect tiene que estar pintada, o no hay veredicto sobre esa fila.
4. **MUTACIÓN, en cada pasada** — sirve el fichero con la apertura de pestaña quitada y comprueba
   que el detector pasa a ver mudas. **Cuenta sus sustituciones**: si no es exactamente 1, se
   declara ciego en vez de celebrar que «la mutación no rompió nada». Medido: `sustituciones: 1`,
   **32 de 36 mudas** con ella puesta (sobreviven las 4 cuyo destino ya se veía).

**POBLACIÓN declarada y comparada por CONJUNTOS**: lista los rótulos que ve, los relee al terminar y
nombra qué entró y qué salió. *Un número suelto sobre una población que cambia no es reproducible
por construcción* — la lección de A12 de esta misma mañana, con las ramas remotas.

`tests/scrum904-completar-lleva-al-campo.test.mjs` corre en la tanda y vigila lo que el navegador no
ve. **Comprobado en rojo** quitando `offsetParent === null` de `llevarASuPestana` (1 sustitución):
cae nombrando exactamente eso.

### 🔴 Un hallazgo del propio guard, sobre sí mismo

Su primera pasada contra el código de antes del arreglo **encontró las 33 mudas y contestó «NO SUPE
MEDIR» con exit 2**, porque la mutación no halló su diana: esa línea aún no existía en ese código.
**Un guard que ha visto 33 defectos no puede decir que no supo medir.** Corregido el orden:

> La ceguera decide el veredicto **sólo cuando no hay fallos**, que es el único caso en que un «0
> fallos» podría estar mintiendo. Las cegueras se siguen imprimiendo siempre.

### Los dos trinquetes ajenos, subidos MIRÁNDOLOS

- `scrum522` · guards fuera de la tanda **20 → 21**.
- `scrum548` · entra en la lista declarada de destinos **no derivables**: sirve su página en ruta
  virtual (`/__completar-lleva-al-campo.html`), como `guard:falta-en-otra-pestana`. Medido: no la
  sirve ningún otro guard, así que no solapa.

## 5 · 🔴 MICROCOPY — PROPUESTO Y PARADO (regla 30)

**Lo construido no pinta ni una palabra nueva.** El profesional sabe QUÉ y DÓNDE porque la pantalla
se lo enseña: se abre la pestaña, el destino se desplaza a la vista y el cursor entra en el campo,
cuyo `<label>` ya lo nombra y ya está aprobado. Ese rótulo es lo que el guard lee y exige.

**Propuesta a la firma del fundador**, por si se quiere reforzar con un aviso explícito — una
plantilla, como la que se firmó en SCRUM-894:

> «{rótulo del campo}» está en la pestaña {pestaña}.

Ejemplo, tal como se pintaría: «"NIF/CIF" está en la pestaña Empresa.»

**Condición de la firma**, idéntica a la de SCRUM-894: `{rótulo del campo}` y `{pestaña}` salen de
los rótulos que la pantalla YA muestra, nunca de nombres internos como `taxId`.

⚠️ **Y NO se reutiliza el literal ya firmado de SCRUM-894** («Para guardar, rellena «X». Está en la
pestaña Y.»). Aquí nadie está guardando: se está navegando desde un checklist. Poner palabras
aprobadas en un sitio donde dicen algo que no es cierto es peor que no poner ninguna.

**No se ha creado fichero en `docs/microcopy/`**: ese directorio es el registro de lo **aprobado**,
con firma comprobada (SCRUM-726). Una propuesta ahí sería una firma que nadie ha dado. La propuesta
va aquí y en el comentario del ticket, que es donde el fundador la ve.

## 6 · Lo que NO se ha hecho, y por qué

- **Qué campos son obligatorios y qué filas aparecen**: no se toca. Decisión de producto.
- **Nada del camino de emisión fiscal** ni de `prisma/schema.prisma`. Cero staging, cero producción.
- **No se le ha puesto un `<h2>` al bloque de Connect** para que la búsqueda vieja casara: eso deja
  el destino atado a cómo esté rotulado. Se pide por `id`.

## 7 · Hallazgos para el fundador

1. **Con el flag de Connect APAGADO, la fila «Cobros con tarjeta» sigue apareciendo como pendiente y
   su destino no existe en pantalla** (`connectBlock` se queda en `display:none`). El arreglo ya no
   miente —`llevarASuPestana` devuelve `false` y no finge que ha llevado a alguna parte— pero la
   fila **promete algo que no está**. Que esa fila deba aparecer o no con el flag apagado es
   decisión de producto: se reporta, no se toca.
2. **`tests/scrum451-plazo-de-red.test.mjs` sigue siendo un rojo intermitente bajo la carga de la
   tanda completa** (ventanas de reloj fijas de 2 ms / 20 ms). Ya reportado en SCRUM-894; vuelve a
   pasar por aquí porque volverá.

## 8 · Error propio (A9)

**El orden del veredicto de mi propio guard estaba mal**, y no lo vi razonándolo: lo vi porque el
guard me contestó «no supe medir» cuando acababa de encontrar 33 defectos. Está en §4 con su
corrección. La lección que me llevo es la contraria a la que parece: el fallo no fue poner el suelo,
fue ponerlo **por encima** del hallazgo — un suelo que se traga un rojo real protege al instrumento,
no al profesional.

---

# SCRUM-904b · las dos decisiones del §7/§5 quedaron resueltas, y el checklist las aplica

**Medido contra:** `origin/main` = `942e90d1f84dd6d7fcf5fa92aad48f36758c2d87` · 2026-09-26T11:56:11Z
**Rama:** `scrum-904-checklist-completar-honesto` · commit `4198016909295cc4c684343257117f362b1ed623`
**Carril:** Sesión 4 · **Skill UI:** cargada (`yaqu-premium-ui`)

Las dos cosas que el §5 (microcopy propuesta y parada) y el §7 (hallazgo del flag apagado) de este
mismo fichero dejaron pendientes del fundador quedaron resueltas el 26-sep-2026 por el orquestador,
por delegación permanente (regla 39, comentario 17138):

1. **El aviso de §5 SE FIRMÓ, tal cual se propuso.** «"{rótulo del campo}" está en la pestaña
   {pestaña}.» — nueva función `checklistEstaEnLaPestana(rotuloCampo, rotuloPestana)` en
   `public/dashboard/js/settingsSubmenus.js`, hermana de `avisoFaltaEnOtraPestana` (SCRUM-894) pero
   sin su prefijo «Para guardar,» (aquí no hay ningún guardado en curso). Se pinta bajo la
   descripción de cada acción pendiente que tiene `focus` (Connect no lo tiene: usa `scrollConnect`
   y ya dice «en tu cuenta»), leyendo el `<label>` real del campo en el DOM
   (`mainFormCard.querySelector([name=...]).closest('.field').querySelector('label')`) y componiendo
   con `rotuloDeSubmenu(submenuDeCampo(focus))` — nunca escrito a mano.

2. **El hallazgo de §7 SE RESOLVIÓ, no solo se reportó.** «Cobros con tarjeta» ya distingue «flag
   `PAYMENTS_CONNECT_ENABLED` apagado» de «flag encendido, sin empezar» (antes los dos daban
   `connectStatus: 'none'` y la fila prometía igual). `renderReadinessCard` ahora hace un fetch
   propio a `/admin/connect/status` para leer `enabled`; con el flag apagado, `koText` pasa a «Aún
   no disponible en tu cuenta» (sin fecha, sin plazo, sin Hacienda) y la fila deja de ofrecerse como
   completable de verdad — nace `<button disabled>`, sin la flecha «Completar →» y sin el listener
   de clic, no solo cambia el texto.

## Guard ampliado, con una comprobación nueva EN NAVEGADOR

`scripts/guard-completar-lleva-al-campo.mjs` gana la comprobación ⑤: mide la fila de Connect con
`?connect=off` (flag apagado) y con el flag encendido (control positivo, para no comparar dos
cegueras). **Verificado en rojo a propósito** antes de arreglar — revertí `completable` a `true` y
el guard cayó con los dos mensajes exactos que se esperaban («sigue mostrando Completar» / «NO está
`disabled`») — y en verde después. Las cuatro patas de antes (①-④) no se tocan.

`tests/scrum904-completar-lleva-al-campo.test.mjs` gana 2 tests sobre el MECANISMO en el fuente
(el comportamiento real —`disabled`, texto, sin flecha— lo mide el guard en navegador, por la misma
razón de siempre: un botón `disabled` y uno que no lo es se leen igual en el código si solo se
busca el atributo a ojo).

## Verificación

- `npm run build` exit 0.
- `guard-completar-lleva-al-campo.mjs`: 36/36 llegan a su destino, mutación 1 sustitución con 32/36
  mudas, comprobación ⑤ verde (ON: completable · OFF: `disabled=true`, sin «Completar»).
- `scrum904`/`scrum894`/`scrum284` (pantalla hermana): 57/57 verde, sin regresiones.
- **No corrí la suite completa `npm test`**: se lanzó en background y el propio harness la mató por
  presión de memoria del sistema mientras esperaba otro resultado (no un fallo del test). No la
  relancé por indicación explícita de la herramienta.

## Fuera de este incremento

Nada: las dos decisiones que quedaban abiertas en este ticket (§5 y §7) están resueltas. No queda
trabajo de producto pendiente en SCRUM-904.
