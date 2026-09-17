# SCRUM-894 · Un botón que no hacía nada y no lo decía — y la causa no era ninguna de las dos que parecían

**Medido contra:** `origin/main` = `74ba2aeb3f669c02a1bd0fb1cc548d6377e82e74` · 2026-09-17T09:06:00Z
**Rama:** `scrum-894-guardar-cobros-en-silencio` · **Carril:** Sesión 5
**Gate:** 🔴 **el literal del aviso está PROPUESTO y PARADO** (regla 30) — ver §5. Lo construido NO
pinta prosa sin firmar: pinta dos rótulos que ya estaban en pantalla.

> El aviso estaba escrito en el fichero desde siempre. Era código muerto: vivía dentro de un
> `submit` que el navegador abortaba antes de dispararlo.

⏱ Hora **de GitHub** (cabecera `Date:` de `https://api.github.com/zen`). `gh` no está en el PATH de
este árbol de trabajo, así que se leyó con `curl -sI` — misma fuente, otra herramienta; se dice para
que nadie lea «hora de GitHub» y suponga el comando de siempre.

---

## 0 · PASO 0 — el defecto existe HOY, y se reprodujo CORRIENDO

Medido en navegador (Edge vía `puppeteer-core`), no leído. **POBLACIÓN: las 9 pestañas de
Configuración × 2 perfiles de merchant = 18 casos.**

| perfil | guardan | mudos (ni aviso, ni foco, ni nada) |
|---|---|---|
| **SIN NIF** | **0 de 9** | **8 de 9** |
| **COMPLETO** | 9 de 9 | 0 de 9 |

El noveno del primer grupo (estando ya en «Empresa») **no era mérito de la pantalla**: el campo está
a la vista y quien avisa es el globo del navegador, que desaparece solo y no es nuestro.

### La causa NO era ninguna de las dos que el ticket plantea

El ticket pregunta si el servidor no lo dice o si lo dice y el frontal no lo pinta. **No es ninguna
de las dos: el evento `submit` NO LLEGABA A DISPARARSE**, así que ni corría nuestro JS ni salía una
sola petición. Lo aborta la **validación interactiva del navegador**: `taxId` es `required` y vive en
un panel con `display:none` —los diez paneles cuelgan del MISMO `form`— y un control inválido que no
se puede enfocar no se puede señalar. El navegador lo dice, a la consola:

```
An invalid form control with name='taxId' is not focusable.
```

Ese mensaje es para quien programa. El profesional ve un botón inerte.

**Confundir los dos defectos habría arreglado el que no era**: cualquier trabajo sobre el mensaje del
servidor o sobre `setAlert` habría quedado igual de mudo, porque nada de eso se ejecuta.

## 1 · Las tres preguntas del encargo

### (a) ¿Dónde se decide que el NIF es obligatorio, y para qué más lo es?

**En el FRONTAL, y en ningún otro sitio.** Dos sitios, ambos en `settingsView.js`:

1. `createField("NIF/CIF", "taxId", "text", true)` → el atributo `required`. **Éste es el que
   bloqueaba.**
2. Una comprobación en JS que enumeraba a mano cinco campos — **código muerto**, dentro del `submit`
   que no ocurría. Y ya había divergido: nombraba **cinco** campos cuando los `required` del
   formulario son **siete** (le faltaban `defaultCurrency` e `invoiceSeriesPrefix`).

El servidor **no lo exige**: `merchantProfileUpdateSchema` lo declara `z.string().min(1).optional()`
—ausente es válido— y la columna es `taxId String?`, anulable.

**Para qué más hace falta el NIF** (leído, no tocado — regla 38/40):

- `portonDocumento.ts` y `selladoEstado.ts`: `country === 'ES' && !!taxId` decide si un documento va
  por el camino de sellado fiscal.
- `verifactu.service.ts`: sin NIF, `verifactu_not_applicable`.
- `exports.routes.ts`: el libro registro ES lo exige.
- Y la propia pantalla ya lo dice en la fila «Datos fiscales» del checklist: *«Sin ellos, el
  documento tras el pago es un justificante de cobro»*.

O sea: **sin NIF el profesional emite justificantes en vez de facturas, y el botón que le dejaría
arreglarlo era el que callaba.**

### (b) ¿Por qué el fallo no llega a la pantalla?

Respondido arriba: **una tercera causa**, ni servidor ni pintado. El `submit` no ocurre.

### (c) ¿Cuántos sitios MÁS de Configuración pueden fallar en silencio por el mismo mecanismo?

**El mecanismo, nombrado:** *actuar sobre un elemento que vive en un panel con `display:none`.*

**POBLACIÓN censada** (AST + grep sobre `settingsView.js`, `settingsSubmenus.js` y `puertaSerie.js`,
que es lo que carga esta pantalla): **5 acciones** que apuntan a un elemento concreto — el envío del
formulario y las **4 filas del checklist «Tu cuenta, lista para cobrar»**, cuyo `click` hace
`scrollIntoView` + `focus` sobre un campo por `[name=…]`.

**Comprobadas 36 de ellas**, corriendo: las 4 filas × las 9 pestañas.

```
MUDAS (ni foco visible, ni destino visible, ni cambio de panel):  24 de 36
```

Las 24 son «Completar →» que **no hacen absolutamente nada** cuando el campo al que apuntan está en
otra pestaña: fila 0 (`whatsappPhone`), fila 1 (`iban`) y fila 3 (`taxId`).

⚠️ **LÍMITE DECLARADO, y va en la dirección incómoda:** la fila 2 («Cobros con tarjeta») **NO quedó
ejercida**. Usa otro camino (`scrollConnect`) y en el banco la tarjeta de Connect no llegó a
pintarse, así que cayó siempre en su rama de reserva. Sus 9 casos son **«no medido»**, no «verde».

🔴 **NO SE ARREGLAN AQUÍ** (regla 9, y el encargo lo dice expreso): se cuentan y se traen.

## 2 · Lo construido

Un solo fichero de producto: `public/dashboard/js/settingsView.js`, **todo dentro de
`renderSettingsView`** (nada a nivel de módulo).

- **`form.noValidate = true`.** La validación interactiva del navegador **no puede informar sobre un
  control que no se ve** — es su comportamiento documentado, no un fallo que se pueda rodear. Un
  formulario en pestañas y esa validación son incompatibles: mientras ella mande, «falta algo que
  está en otra pestaña» sólo puede acabar en silencio.
- **La lista de obligatorios se DERIVA**, ya no se copia: los controles con `willValidate &&
  !validity.valid`. Se lee `validity`, que **no dispara eventos** (`checkValidity()` sí, y un
  instrumento que provoca lo que mide no lo mide — se cazó en la sonda de este ticket, donde cada
  campo salía contado dos veces).
- **La comprobación va ANTES de componer el payload**, no después.
- **Se abre la pestaña del campo que falta**, se sube al aviso y **el cursor entra en el campo** con
  `preventScroll`, para que el mensaje no se vaya de la pantalla en el mismo gesto que lo enseña.

⛔ **NO cambia QUÉ es obligatorio.** Los siete `required` siguen exactamente donde estaban. Que ahora
se exijan los siete y no cinco no es un cambio de producto: es que la copia a mano ya estaba mal.

## 3 · Rojo y verde, los dos REALES

Mismo instrumento, `npm run guard:guardar-sin-callar`, sobre los mismos 18 casos.

- **ROJO** — con el `settingsView.js` de `origin/main` puesto en el árbol: **exit 1, 9 fallos**, los
  nueve del perfil sin NIF. *«EL BOTÓN NO HACE NADA Y NO LO DICE.»*
- **VERDE** — con el arreglo: **exit 0, 0 mudos de 18.**
  - sin NIF, desde las 9 pestañas → no guarda, abre «Empresa», cursor en `NIF/CIF`, aviso visible
    `NIF/CIF · Empresa`.
  - completo, desde las 9 → guarda y dice *«Datos de empresa guardados correctamente.»*

El intercambio se hizo con `git checkout origin/main -- <fichero>` **después de commitear**, y se
restauró comprobando el md5 contra `HEAD`. Los dos intentos anteriores los **paró el hook
`guard-dangerous`** —con razón las dos veces— y no se tocó su lista blanca.

## 4 · Lo que conserva la medición

- `scripts/guard-guardar-sin-callar.mjs` — en navegador. Declara POBLACIÓN, **calibra el detector en
  cada caso** (se le vacía la caja del aviso y tiene que pasar a «no hay»), lleva **control positivo**
  (si ningún caso guarda, es ciego y falla) y **deriva lo esperado** del `<label>` y del rótulo de la
  pestaña, para que un rótulo que cambie no lo deje midiendo otra cosa.
- `tests/scrum894-el-boton-que-no-callaba.test.mjs` — en la tanda. Vigila lo que el navegador no
  puede ver: que `noValidate` siga puesto (es UNA línea y sin ella vuelve todo al silencio), que la
  lista siga derivándose, que el aviso se componga con los dos rótulos, que el guard exista y esté
  cableado, y que **la premisa del ticket siga siendo cierta** (el NIF en otra pestaña distinta de
  Cobros).

### Dos censos ajenos me cazaron, y se subieron MIRÁNDOLOS, no relajándolos

- `tests/scrum522-guards-fuera-de-la-tanda.test.mjs` · 19 → **20**.
- `tests/scrum548-peaje-package-json.test.mjs` · `/medicion.html` 2× → **3×**.

El segundo comparte página con `guard:aviso-bizum` y `guard:vias-de-cobro`. **Mirado y NO se
fusionan:** aquellos miden lo que la pantalla **pinta**; éste, lo que **pasa al pulsar**. El defecto
no existe hasta que alguien pulsa — por eso los otros dos estaban verdes mientras el botón callaba.

## 5 · 🔴 MICROCOPY — PROPUESTO Y PARADO (regla 30)

**Lo que se pinta hoy no lleva ni una palabra nueva**: el `<label>` del campo y el rótulo de su
pestaña, dos textos que ya están en pantalla y ya aprobados (los rótulos, el 5-ago-2026), unidos por
puntuación. Para el caso del ticket:

> `NIF/CIF · Empresa`

**Y no puede llevar marcador.** `[PENDIENTE microcopy oficial]` en pantalla es rojo de
`guard:marcadores-en-pantalla`, y un literal más en este fichero rompería el trinquete de
`tests/scrum402-marcador-no-se-pinta.test.mjs`, que lo tiene congelado en **1**. Comprobado antes de
elegir el diseño, no después.

**LA RANURA ESTÁ PUESTA Y VACÍA:** la constante `PROSA_FALTAN` en `settingsView.js`. Cuando el
fundador firme el texto entra ahí y **sólo ahí**; el aviso sigue nombrando el campo y la pestaña
mientras tanto.

**Propuesta a la firma del fundador** (una sola frase, delante de la lista derivada):

> Falta rellenar esto antes de guardar:

*Por qué así:* no enumera nada —lo enumerado lo pone la pantalla, y así no puede quedarse corta como
la lista de cinco—, dice que el guardado **no se ha hecho**, y en una pantalla de cobros no promete
nada sobre facturación ni sobre Hacienda.

**No se ha creado fichero en `docs/microcopy/`**: ese directorio es el registro de lo **aprobado**,
una aprobación por fichero y con firma comprobada (SCRUM-726). Una propuesta ahí sería una firma que
nadie ha dado.

## 6 · Lo que NO se ha hecho, y por qué

- **Las 24 acciones mudas del checklist** (§1c) — regla 9 y encargo expreso: se cuentan, no se
  arreglan.
- **Nada del camino de emisión fiscal.** Se LEYÓ para responder a (a) —`portonDocumento`,
  `selladoEstado`, `verifactu.service`, `exports.routes`— y no se tocó una línea (regla 38/40).
- **`prisma/schema.prisma`**: leído, no tocado. Sin ALTER, sin `db push`. Cero staging, cero producción.
- **Qué es obligatorio**: no se toca. Si el NIF no debiera serlo aquí, es decisión de producto (§7).

## 7 · Hallazgos para el fundador

1. **Las 24 acciones mudas del checklist** (§1c) y la fila 2 sin medir.
2. **El NIF es obligatorio SÓLO en el frontal.** El servidor lo acepta ausente y la columna es
   anulable. No se cambia nada: se deja dicho dónde está decidido hoy, que es un solo sitio.
3. **`tests/scrum451-plazo-de-red.test.mjs` falla bajo la carga de la tanda completa y pasa 3/3 en
   solitario.** Mide con ventanas de reloj fijas (2 ms / 20 ms / 500 ms) y con 855 ficheros en
   paralelo las cabeceras llegan tarde: el suelo del propio test lo dice («las cabeceras tenían que
   haber llegado»). No es de esta rama —ejercita `renderCobrosView`, y todo mi cambio vive dentro de
   `renderSettingsView`— pero es un rojo intermitente que va a volver. *Una ventana fija es una
   tolerancia disfrazada.*

## 8 · Error propio (A9)

**Puse el ticket «En curso» en Jira DESPUÉS de escribir código, no antes (A13).** Lo correcto era al
coger el ticket; se hizo a media tanda.

**Y la primera sonda dio un falso rojo del control positivo**: dejó `invoiceSeriesPrefix` y
`defaultCurrency` vacíos, cuando en la base son `NOT NULL` con `DEFAULT` («CF», «EUR») y un merchant
real nunca los tiene así. Con ese perfil imposible **tampoco guardaba el perfil completo**, y la
conclusión cómoda habría sido «el botón no funciona nunca». Lo destapó ir al esquema a comprobar qué
puede estar vacío de verdad, en vez de creerme la primera medición. El guard lleva ese motivo escrito
dentro, junto a los dos perfiles.
