# SCRUM-575 · CONT-02 · Validación de NIF/CIF/DNI — el aviso se firma y el cableado queda sujeto

**Fecha:** 2-sep-2026 · **Carril:** contactos (ficha de cliente) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `0eef4919039262d7de88465d2c9ecbe795ae786c` · 2026-09-02T20:04:32+01:00

**Tanda:** 4722 tests, 4639 pass, 0 fail, 83 skipped (los 83 declaran su motivo) — medida DESPUES del ultimo cambio, entrada incluida.

> El **ancla de arriba NO se re-mide**: es un registro fechado de contra qué se midió el trabajo,
> no una afirmación sobre el `main` de ahora. La TANDA sí se repite, porque mezclar `main` es un
> cambio y la tanda va después del último cambio.

---

## 🛑 LO PRIMERO: EL MOTOR YA ESTABA CONSTRUIDO, Y BIEN

El encargo pedía «validación de forma y dígito de control de NIF, CIF y DNI, en cliente y en
servidor». **Medido antes de escribir una línea: eso ya existe.**

| pieza | ¿existe? | dónde |
|---|---|---|
| el algoritmo (DNI, NIE, CIF, dígito de control) | **sí** | `src/core/validation/nifEspanol.ts` |
| la copia del cliente, declarada como tal | **sí** | `public/dashboard/js/nifEspanol.js` |
| aplicado en el SERVIDOR | **sí** | `schemas.ts` — `.refine()` sobre `taxId` |
| aplicado en el CLIENTE | **sí** | `customersView.js` — al salir del campo |
| pruebas de la aritmética | **sí** | `scrum575-nif-espanol.test.mjs`, 8 casos |
| precacheado | **sí** | `public/sw.js` |

Vacío = válido, sin librerías (regla 36), sin peticiones de red. **Nada de eso se rehace.**

Así que el trabajo era **darle superficie a lo que faltaba**, y lo que faltaba se midió:

---

## PASO 0

**ENTRADA.** El campo «NIF/CIF (opcional)» del modal de cliente
(`public/dashboard/js/customersView.js`, `buildModal()`), con su aviso `.aviso-nif` bajo el campo.
Backend: `POST` y `PUT /admin/customers` → `customerCreateSchema.taxId`.

**LO QUE FALTABA, medido:**

### ① El aviso pintaba un MARCADOR en la pantalla de un profesional

`avisoNif.textContent = "[PENDIENTE microcopy oficial]"`. Cualquiera que tecleara mal su NIF veía
**literalmente** eso. Desde que producción despliega al mergear, un marcador dejó de ser una nota
interna — esta semana tres acabaron delante de un profesional.

### ② 🔴 EL CABLEADO NO ESTABA SUJETO POR NADA

El validador estaba probadísimo **como unidad**. Que alguien lo LLAME, no. Medido rompiendo cada
eslabón y corriendo la **tanda completa** después de cada rotura:

| se rompe | resultado |
|---|---|
| se quita el `.refine()` del ESQUEMA | 4638 tests · el único fallo es el de SCRUM-655b, que **ya venía roto de main**. O sea: **NADIE LO CAZA** |
| se apaga el aviso del CLIENTE | idéntico. **NADIE LO CAZA** |

> Dos mediciones, el mismo resultado: **el servidor podía dejar de validar el NIF y la tanda entera
> seguía diciendo que todo va bien.** «Mencionar no es hacer» — que `validarNifEspanol` exista y
> esté probado no prueba que nadie lo invoque.

---

## La víctima: no es de hoy, y por eso el ticket tiene fecha de caducidad, no urgencia

Con `INVOICING_ES_ENABLED` en **OFF**, un NIF mal formado no duele. El día que se encienda, ese
dato vuelve como **RECHAZO DE REGISTRO** con la factura ya emitida detrás (runbook R7:
`VfSubmission.lastError` → dato de factura → corregir por R1). Y **una factura emitida no se edita
ni se borra** (regla 29).

O sea: el coste de teclearlo mal se paga en el peor momento posible. Comprobarlo mientras el flag
está OFF es gratis.

---

## Lo construido

### El aviso, firmado y sin marcador

```
Ese NIF/CIF no es válido. Compruébalo.
```

Texto **provisional del asesor**, pendiente de confirmación del fundador (regla 30). Fijado con
`===` en el test: un retoque «de paso» reabriría un texto que el profesional ya está viendo.

> **Por qué SIN marcador, que es una decisión y no un descuido:** entre enseñar
> `[PENDIENTE microcopy oficial]` y enseñar un texto provisional del asesor, gana el texto — dice
> la verdad al profesional y se cambia en **una línea y un aserto** el día que el fundador lo
> confirme o lo reescriba. Un marcador no dice nada y encima parece un error de la aplicación.

**El censo de marcadores baja de 2 a 1** (`scrum402`) — y en la segunda entrega de este mismo
ticket llega a **0** y la entrada se borra. Ver la sección «LOS TRES MARCADORES…» más abajo.

### El guard del cableado — `tests/scrum575b-nif-cableado.test.mjs`, 17 casos

Los cinco eslabones, cada uno ejecutado:

| eslabón | cómo |
|---|---|
| ① se **escribe** | banco de vistas: se pinta, se PULSA «+ Nuevo cliente», el campo y el aviso están en el DOM |
| ② el **cliente avisa** | se teclea y se dispara `blur` **sobre el DOM real**: se enciende con uno malo, se apaga con uno bueno, y **no acusa al vacío** |
| ③ se **envía** | `taxId` viaja en el payload |
| ④ el **servidor manda** | `customerCreateSchema` **ejecutado**: rechaza los malos, acepta los buenos, deja pasar el vacío |
| ⑤ se **guarda y se relee** | `taxId` en el `select` explícito, por AST y **con su rojo** |

### 🔴 EL CONTROL POSITIVO, que es el que decide

Ocho identificadores **VÁLIDOS** de las tres formas —DNI, NIE, CIF con dígito y CIF con letra— que
**tienen que pasar**, en el validador y en la puerta. Sin esta lista, «rechaza los malos» no
distinguiría un validador correcto de uno roto que **dice que no a todo**, y el profesional no
podría guardar su propio NIF. Si el censo de válidos baja de 8, falla.

**Y el vacío pasa**, con test propio en los dos lados. Convertir un campo opcional en obligatorio
sería cambiar el producto sin que nadie lo decidiera, y es el modo de fallo más fácil de introducir
sin querer al añadir una validación.

---

## 🔴 Un rojo que me enseñó el test, no la lectura

Mis dos primeros «válidos» —`Z2345678S` y `K1234567L`— **los inventé yo**, y los dos tenían el
control mal. El SUELO cayó y tenía razón.

El corpus sale ahora del **ya fijado** en `scrum575-nif-espanol.test.mjs`. Y **no** se genera
ejecutando el validador que se prueba: un corpus derivado del código bajo prueba diría que sí a
cualquier cosa que ese código acepte, **incluido un error**.

---

## El rojo, probado por el mecanismo — cuatro mutaciones con post-condición

Commit en verde **antes** de mutar. Cada mutación exige que el trozo aparezca exactamente una vez
y que el fichero haya cambiado.

| se rompe a propósito | cae |
|---|---|
| el SERVIDOR deja de validar | ④ el servidor rechaza · y EL VIAJE ENTERO |
| el CLIENTE deja de avisar | ② el cliente avisa |
| el aviso de NIF vuelve a ser un MARCADOR | el texto literal · **y** el censo de `scrum402` (doble red) |
| se rompe la tabla de letras del DNI | el **barrido amplio de `scrum575`** — ver abajo |

> ⚠️ **La cuarta la caza `scrum575`, NO este fichero, y se dice en vez de presumir.** Se alteró la
> última letra de `LETRAS_DNI` y mi corpus no la usa, así que mi suelo **no** cayó: cayó el barrido
> amplio del guard de la aritmética. Es la división correcta —aquél prueba el cálculo, éste prueba
> el cableado— pero un guard no debe apuntarse lo que no hace.

**Control negativo:** tocar `recargoEquivalencia` —otro campo del cliente— no tumba nada de esto.

---

## 🔴 SEGUNDA ENTREGA: LOS TRES MARCADORES DE ESTA PANTALLA, FIRMADOS. EL CENSO A CERO

El primer commit de este ticket firmó el aviso de NIF y dejó el censo en **1**. Ese 1 se midió y
resultó ser **dos superficies compartiendo UNA constante**, no una:

| línea | superficie | |
|---|---|---|
| `customersView.js:312` | el **rótulo del teléfono** | ← lo que se pidió medir |
| `customersView.js:469` | el **aviso de identificador ya usado** | ← el que nadie había contado |

SCRUM-615 ya lo había dejado avisado: *«aprobar UNO de los dos textos NO apaga el otro: habrá que
partirla»*. **Partirla no es alcance extra: sin partirla, poner el rótulo aprobado del teléfono le
habría cambiado el texto al aviso de duplicado**, que dice otra cosa completamente distinta.

### Lo que se midió antes de proponer

**En navegador, a 360 px**, con el CSS real (comprobado que cargó: `min-height:44px` y `flex`
aplicados):

| pieza | ancho | alto |
|---|---|---|
| rótulo | **280 px** — una sola línea | 19,4 |
| selector de prefijo | **123,2 px** (`max-width:44%`) | 44,5 |
| input del número | **148,8 px** | 44,5 |

Fuente `600 12.5px Inter` → **caben ~45 caracteres por línea**. El input **no tiene placeholder** y
**no hay aviso bajo el campo**: el de duplicado vive arriba del modal. El selector muestra
**«🇪🇸 España +34»** (222 opciones; el nombre lo pone `Intl`, no es copy nuestro).

### Los dos textos, aprobados por el asesor el 2-sep-2026

| superficie | texto |
|---|---|
| rótulo del teléfono | `Teléfono` |
| aviso de duplicado (**provisional**, a la espera del fundador) | `Ese dato ya lo tiene otro cliente. Revísalo por si es un duplicado.` |

**El rótulo, a secas.** El viejo —«Teléfono (E.164 sin +)»— pedía un **formato que ya no se pide**:
lo impone el control de al lado. Y CONT-05 demostró **en esta misma pantalla** que una regla
escrita en una etiqueta no se cumple: se guardaron `+34 662629419` y `662629419` el mismo día.
Se descartó «Teléfono (opcional)» con un dato: **Email también es opcional y no lo dice**, así que
añadirlo aquí no arregla la inconsistencia — la reparte.

**El aviso, en tono de aviso.** Es un AVISO, no un bloqueo: hay duplicados **legítimos** —marido y
mujer con el mismo móvil, dos comunidades del mismo administrador con el mismo email— y el que
decide es el profesional. Por eso dice «revísalo» y no «ya existe». Sirve para teléfono, email y
NIF sin nombrar ninguno. 63 caracteres → dos líneas en un aviso que vive arriba del modal, donde
caben.

### 🔴 «Construido ≠ alcanzable»: se comprobó ANTES de ponerle un texto bonito

El aviso nace `hidden`, y un texto que nadie llega a ver **no es microcopy: es código muerto con
acentos**. Así que antes de firmarlo se preguntó si algo lo enseña de verdad.

**Sí lo enseña, y no de palabra: se EJECUTA.** `comprobarDuplicados()` lo enciende
(`avisoDuplicado.hidden = !hay`) y está cableada al `blur` del teléfono, del email y del NIF, y al
`change` del prefijo. El test sirve una respuesta del servidor **con coincidencias**, dispara el
`blur` y exige que el aviso aparezca — **con su control negativo**: sin coincidencias no se
enciende, porque un aviso clavado en «visible» acusaría de duplicado a cualquier cliente nuevo.

### El censo a CERO, con control positivo

`customersView.js` **sale del censo** de `scrum402`: tenía 3 marcas y se firman las 3. La entrada
se **BORRA**, no se pone a 0 — precedente de SCRUM-424/405/593 escrito ahí mismo: `censoActual()`
sólo lista ficheros CON marcadores, así que un 0 sería una bajada permanente sin anotar.

> 🔴 **Un cero sin control positivo no es un cero, es un guard que dejó de mirar.** Comprobado:
> se metió un marcador nuevo **en este mismo fichero ya fuera del censo** y **R4 y R4b cayeron**,
> clasificándolo por la rama `nuevos`. Salir del censo no es salir de la vigilancia.

### El rojo, probado — tres mutaciones más, con post-condición

| se rompe a propósito | cae |
|---|---|
| el aviso deja de encenderse | «EL AVISO SE ENSEÑA DE VERDAD» (construido ≠ alcanzable) |
| el rótulo del teléfono cambia | «EL RÓTULO, LITERAL» |
| el aviso se reescribe en tono de bloqueo | «EL AVISO, LITERAL — y NO suena a bloqueo» |

Y un caso que sólo tiene sentido después de partir la constante: **los dos textos tienen que ser
DISTINTOS**. Mientras compartían una sola, firmar uno le cambiaba el texto al otro.


---

## Los huecos que declaro

1. **No he verificado en navegador real.** El banco de vistas ejecuta la pantalla y dispara `blur`
   de verdad, pero no es un navegador: no hay foco real, ni teclado, ni pintado.
2. **Mi corpus de válidos no cubre toda la tabla del DNI.** Lo dice la cuarta mutación: una rotura
   en una posición que mis ocho casos no usan la caza `scrum575`, no este fichero. Ampliar el
   corpus aquí duplicaría lo que aquél ya hace mejor.
3. **No se valida la EXISTENCIA**, sólo la forma — es del alcance del ticket, y hay un caso que
   comprueba que el validador no hace peticiones de red.
4. **El texto del aviso es PROVISIONAL del asesor**, no confirmado por el fundador.
5. **No he medido producción.**

---

## Ficheros

`public/dashboard/js/customersView.js` (el aviso firmado) ·
`tests/scrum575b-nif-cableado.test.mjs` (**nuevo**) ·
`tests/scrum402-marcador-no-se-pinta.test.mjs` (el censo, 2 → 1) · esta entrada.

**No se ha tocado:** `src/core/validation/nifEspanol.ts` ni `public/dashboard/js/nifEspanol.js` —
el motor estaba bien y no se rehace— · `prisma/schema.prisma` (este ticket **no toca esquema**) ·
el resto del modal, incluidos los cinco campos de dirección de CONT-06 · los campos de teléfono
(CONT-05/CONT-19) · `tests/_banco-vistas.mjs` y `sw.js` (S2).

## Estado del arbol

* La rama nació **apilada sobre `scrum-579`** (`be26186c`): los dos tickets tocan
  `customersView.js` y ramificar de `main` habría dejado un conflicto a mano en el fichero del que
  acaba de salir un marcador a producción. Mismo criterio que el asesor aprobó para SCRUM-661.

  ✅ **Y se resolvió solo, como estaba previsto: SCRUM-579 entró en `main`.** Al mezclar `main`
  DENTRO de esta rama, el diff contra `main` pasa de 13 ficheros a **los 4 de este ticket**. El
  coste de apilar era cosmético y temporal, exactamente como se dijo.

  ⚠️ El único punto delicado era `docs/master/SCRUM-579.md`: esta rama arrastraba la versión
  ANTERIOR de esa entrada (la que declaraba «1 fail») y `main` ya tenía la actualizada. **Se queda
  la de `main`, íntegra y sin una sola edición a mano** — comprobado por el sha del blob, que es
  el mismo en las dos: `24d646408fc126afd850582db80fb67c3e669c7f`. Ese fichero no es de este
  ticket y no se toca.
* `origin/main` se ha MERGEADO DENTRO —no rebase, nunca `--force`— sin conflicto.
* Cliente de Prisma regenerado desde ESTE worktree y `dist/` reconstruido DESPUÉS de mezclar main.
* `npm run guards:entrada` en verde. Cero CR en disco (medido por BYTES).

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* El validador vive DOS VECES (`nifEspanol.ts` y `nifEspanol.js`) y su propio comentario lo declara: hay un test que exige que coincidan, así que la duplicación está sujeta — pero sigue siendo una copia a mano.
* `identificadoresDuplicados.ts` importa `normalizarNif` de la copia del servidor: si algún día divergieran, el detector de duplicados y el validador dirían cosas distintas del mismo NIF.
* El filtro de comentarios de `scrum578` salta los de LÍNEA pero **no los de BLOQUE**, así que un JSDoc que cite el rótulo viejo lo hace saltar en falso — me pasó, y por eso mi comentario describe aquel texto sin transcribirlo.
