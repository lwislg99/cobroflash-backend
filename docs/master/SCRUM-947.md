# SCRUM-947 · la foto del ticket de un gasto se guarda

**Fecha:** 18-sep-2026 · **Carril:** S2 (panel) · **Pedido por:** el orquestador (plan aprobado por el canal)
**Medido contra:** `origin/main` = `34d06bb4f4e306b11745cf34fbbc85233c5a3299` · 2026-09-18T12:16:26Z
**Rama:** `scrum-947-foto-del-gasto`

## El defecto, medido antes de escribir (PASO 0)

El modal del gasto mandaba la foto del ticket tal cual, en base64 dentro del JSON
(`expensesView.js`, `fileToBase64` → `readAsDataURL`). El servidor corta el cuerpo a 2 MB
(`express.json({ limit: '2mb' })`, `src/app.ts`) y el base64 engorda un tercio.

Sonda en staging SIN sesión (el parser corre antes de `requireAuth`, así que no se crea nada):

```
cuerpo 0,50 MiB → 401 · 1,40 → 401 · 1,60 → 401 · 1,90 → 401   (llega a la autenticación)
cuerpo 2,10 MiB → 413 text/html · 3,00 → 413 text/html          (lo corta el parser)
```

O sea: una foto de unos 1,5 MB o más no se guarda, y una foto normal de móvil pesa 3–5 MB. Lo que ve el
profesional, medido en el guard con el `api.js` real contra el mismo parser: **«API 413: Payload Too
Large»** en la caja de error del modal, y el gasto sin guardar. ⚠️ En staging, sobre HTTP/2, el
`statusText` puede llegar vacío y el aviso quedar en «API 413: » — eso no se ha medido en un navegador
contra staging.

Un solo punto de guardado: el modal (`openExpenseModal`), que usa también la ficha del Trabajo. El
arreglo cabe entero en `expensesView.js`; `jobDetailView.js` no se toca.

## Lo que se hace

`fotoParaGuardar(file)` en `public/dashboard/js/expensesView.js`, en lugar de mandar el `readAsDataURL`
a pelo:

- Si la foto **ya cabía** (data-URI ≤ 1,5 MiB) se manda **tal cual**, como hasta hoy.
- Si no, se abre (`createImageBitmap` con `imageOrientation: 'from-image'`, que respeta el giro EXIF;
  si no, con un `<img>`, que en Safari abre HEIC) y se redibuja en un lienzo con **lado largo ≤ 2000 px**
  en JPEG 0,8 sobre fondo blanco. Si aún no cabe, baja la calidad hasta 0,6 y después el tamaño (×0,8),
  con un tope de 8 intentos.
- Si no se puede abrir, o ni reducida cabe, **no se manda**: sale el aviso firmado y el botón vuelve a
  estar disponible.
- **No se sube el límite del servidor.** Guardar y transportar 5 MB por ticket para leer un importe es
  coste sin motivo; 2000 px deja legible la letra del ticket para la lectura con IA de SCRUM-912.

**Texto nuevo**, firmado por el orquestador por delegación (SCRUM-947 comentario 15931), ficha
`docs/microcopy/2026-09-18-SCRUM-947-foto-del-gasto.md`:

> No hemos podido abrir esta foto. Prueba con otra o haz una captura de pantalla del ticket.

## Verificado en rojo: `npm run guard:foto-del-gasto`

Modal REAL (`expensesView.js` + `api.js` + `modalHeader.js`) a 390 px, contra un servidor local con **el
mismo `express.json({ limit: '2mb' })` que producción** (el 413 lo contesta express en HTML, como en
staging). Se mete la foto en el `<input type=file>`, se pulsa «Añadir gasto» de verdad y se juzga el
ESTADO: qué recibió el servidor, qué aviso se ve, si el modal se cerró y, reabriendo el gasto guardado,
si su foto se pinta.

| caso | `expensesView.js` de main | con el arreglo |
|---|---|---|
| A · 3,73 MiB apaisada (4000×3000) | 🔴 0 guardados · «API 413: Payload Too Large» | ✔ 0,73 MiB · 2000×1500 · se ve al reabrir |
| B · 3,68 MiB vertical (3000×4000) | 🔴 ídem | ✔ 0,72 MiB · 1500×2000 · se ve al reabrir |
| F · 1,55 MiB de detalle fino (2400×1800) | 🔴 ídem | ✔ 1,48 MiB · 2000×1500 (tras bajar calidad) |
| D · POSITIVO · 0,02 MiB (800×600) | ✔ se manda | ✔ se manda con el MISMO data-URI |
| E · NEGATIVO · 2,48 MiB que no se abre (`.heic` de bytes al azar) | 🔴 «API 413…» | ✔ no se manda · aviso firmado · botón disponible |

Rojo estable: 4 de 4 pasadas sobre `e76580b1` antes de añadir F; F en rojo sobre main comprobado aparte.

**Mutantes** sobre el arreglo, cada uno comprobando que el ancla existe, y restaurando desde git:

| mutante | cae |
|---|---|
| M1 · sin tope de lado (`FOTO_LADO_MAXIMO = 99999`) | A, B y F |
| M2 · lo que no se abre se manda tal cual | E |
| M3 · techo por encima del límite del servidor (3 MiB) | F |

## Error propio

- **M3 sobrevivía con la primera batería.** Las fotos sintéticas de A y B caben ya a la primera
  pasada (0,73 MiB), así que el techo nunca decidía nada y un techo mal puesto daba verde. Se añadió el
  caso F —una foto con detalle por píxel que ni a 2000 px cabe a la primera— y M3 muere en F.
- **El primer clic del guard era intermitente** («Node is either not clickable», 1 de 3 pasadas del caso
  D): pulsaba mientras el modal aún entraba con su animación. Se espera a que no quede ninguna animación
  en curso, y un clic que falle es «no supe medir», no un reventón. 4 de 4 pasadas estables después.
- **El guard usaba `document` fuera de las cadenas que corren en la página**; lo cazó el censo de
  SCRUM-258. Pasó a `new Function`, como el resto de guards.

## Lo que NO cubre

- 🔴 **La foto es SINTÉTICA.** No se probó con una foto real de móvil: la orientación EXIF (una foto
  vertical guardada girada) queda como **no medida**.
- La medición que cierra el ticket —en staging, una foto de 3–5 MB se GUARDA y se VE después— se hace
  tras el despliegue (permiso del orquestador por el canal: crear 1 gasto en el merchant QA, comprobarlo
  y borrarlo), y se anexa aquí.
- La lista de Gastos mete el gasto entero, foto incluida, en un `onclick` (`expensesView.js`); con fotos
  grandes la lista pesa mucho. Hallazgo aparte, lo apunta el orquestador; no se toca aquí.
- Las fotos que ya estén guardadas no se tocan.

## Ficheros

- `public/dashboard/js/expensesView.js` — `fotoParaGuardar`, `abrirFoto` y las tres constantes.
- `scripts/guard-foto-del-gasto.mjs` + su entrada en `package.json` — el guard (fuera de `npm test`).
- `tests/scrum522-guards-fuera-de-la-tanda.test.mjs` — 25 → 27 con SCRUM-915d, sumando los dos
  comentarios y MEDIDO tras el merge.
- `docs/microcopy/2026-09-18-SCRUM-947-foto-del-gasto.md` — la ficha del texto.
- `docs/master/evidencias/scrum947/medir-en-staging.mjs` — la medición que cierra, para después del
  despliegue: crea 1 gasto en el merchant QA con una foto de 3–5 MB por el modal, comprueba que se
  guarda y que se ve al reabrirlo desde la lista, y lo borra. Lee el secreto en tiempo de ejecución.
