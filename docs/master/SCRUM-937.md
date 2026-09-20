# SCRUM-937 · EL NIF DEL PROVEEDOR: o llega a la ficha, o se dice que no llegó

**Fecha:** 18-sep-2026 · **Carril:** S1 (mitad de servidor; la de pantalla va a S2 con firma de copy)
**Medido contra:** `origin/main` = `c60008bdc857873b69c8a56fb47087f79b3bae6b` · 2026-09-18T06:56:46Z
**Tanda:** 7550 tests, 7439 pass, 0 fail, 111 skipped — corrida sobre la rama con `origin/main` = `27a7fb8b3755b9f00f5bcc74bc48b42ff0ed2037` mergeado (18-sep-2026, turno exclusivo de la Sesión 1)

---

## Lo que decía el ticket, y lo que midió el PASO 0

El ticket (medido por la S4 en staging) decía: el alta pide «NIF del proveedor», **lo guarda**, y el
veredicto del justificante no lo cuenta porque lee `Provider.taxId`.

**La separación es deliberada y está escrita en tres sitios** (SCRUM-324 E3): el NIF no es un campo
del gasto, vive en `Provider.taxId`. El alta ya copiaba el NIF tecleado a la ficha si estaba vacía
(`guardarNifDelProveedor`). O sea que la premisa del ticket no era exacta: el NIF **no** «se guarda y
no cuenta». Medido CORRIENDO `createExpense` del `dist` con un doble de Prisma (sin base, sin tocar
`src/`):

| caso | ¿se guarda? | veredicto |
|---|---|---|
| NIF tecleado **sin proveedor elegido** | **en ningún sitio** | `faltan: ['nif_proveedor']` — lo de la S4 |
| NIF tecleado, proveedor sin NIF *(control positivo)* | sí, en la ficha | ya no falta el NIF |
| NIF distinto, proveedor que ya tiene NIF | no (gana la ficha, a propósito) | — |

Y un hueco que el ticket no nombraba: **la edición**. El modal manda `nifProveedor` por PUT y la
ruta no lo leía.

Los dos casos tienen la misma forma: **un dato que el profesional da y que se tira sin decírselo.**
Él cree que ha completado su justificante, y no lo ha hecho.

---

## La decisión (orquestador, 18-sep): cerrar el hueco donde está, en dos carriles

* **Descartado (a), «que el veredicto acepte el NIF del alta»:** va contra una decisión escrita y
  razonada (el NIF de la ficha lo puso alguien mirando una factura; el del almacén se teclea de pie),
  y en el caso sin proveedor no hay a quién atribuirle ese NIF.
* **Servidor (este PR, S1, sin texto nuevo):**
  1. El alta y la edición devuelven `destinoDelNif`: `'en_la_ficha'` · `'sin_proveedor'` ·
     `'la_ficha_tiene_otro'`, o `null` si no se tecleó ningún NIF. Se calcula con lo que quedó en la
     ficha **después** de guardar: es un hecho, no una predicción.
  2. La edición trata el NIF igual que el alta: lo aparta del `update` del gasto (no es columna; Prisma
     lo rechazaría) y lo lleva a la ficha del proveedor que el gasto tenga **tras** editarlo —si la
     misma edición cambia de proveedor, al nuevo—, solo si esa ficha no tenía NIF.
  Mayúsculas y espacios no convierten un NIF en «otro».
* **Pantalla (S2, necesita firma de copy):** propuesta al orquestador, sin firmar, en paralelo.

**No se toca el motor del justificante ni sus veredictos** (SCRUM-324 E3): sin proveedor sigue
faltando el NIF, y hay un test que lo afirma. Cambia que se DICE por qué, no qué se afirma.

---

## Verificado en rojo, y que cada test mira lo suyo

**1 · En `main`** (test nuevo, código sin tocar): **caen 10 de 13.** Los 3 verdes: el suelo, «el motor
no se toca» y «el NIF no viaja a la fila del gasto» (en `main` se cumple porque la ruta ni lo lee).
Varios caen solo porque `destinoDelNif` aún no existe; por eso:

**2 · Mutaciones sobre el código YA arreglado**, recompilando cada vez:

| mutación | qué cae |
|---|---|
| el PUT vuelve a no leer `nifProveedor` | las 4 ediciones que mandan NIF, y nada más |
| el NIF viaja en el `expense.update` | solo «el NIF NO viaja a la fila del gasto» |
| se compara el NIF sin normalizar mayúsculas | solo «el mismo NIF con otras mayúsculas no es otro» |
| el NIF va al proveedor de ANTES de editar | solo «la edición que cambia de proveedor…» |

Revertido: 13/13. Tests de gastos (73 ficheros que nombran la ruta, el servicio, la vista o el
justificante): 617 tests, 596 pass, **0 fail**, 21 skip.

---

## El banco

`tests/scrum937-el-nif-no-se-tira-en-silencio.test.mjs` usa las **rutas y el servicio de verdad** con
la base doblada de `tests/_envio-doblado.mjs`. Ese doble no tiene estado (lo dice su cabecera); el
poco que hace falta —una ficha de proveedor y un gasto— lo llevan las respuestas del propio banco, y
su `updateMany` evalúa el `taxId: null` del `where` como lo haría Postgres, porque es justo lo que se
mide. Se llama al último manejador de cada ruta: `requireRole` no es de este ticket.

---

## Lo que NO cubre

* **La pantalla.** Mientras S2 no la cambie, el profesional puede seguir tecleando un NIF sin elegir
  proveedor; la diferencia es que la respuesta ya lo dice y la pantalla lo puede leer.
* **`la_ficha_tiene_otro` no se da desde la pantalla de hoy:** al elegir un proveedor con NIF, el campo
  se rellena solo y queda de solo lectura (`expensesView.js:430-436`). Solo por la API a pelo.
* **No se ha recorrido en staging** con la ruta desplegada: lo medido es la ruta del `dist` con la base
  doblada. Los gastos de prueba de la S4 siguen en staging; no se ha comprobado que se crearan sin
  proveedor (encaja con el resultado, pero no está leído).
* **No se crea un proveedor a partir del NIF** (la salida (b) grande del ticket): haría falta un nombre
  que el alta no pide.

---

## Ficheros

* `src/modules/expenses/domain/expenses.service.ts` — `queFueDelNif` y el NIF en `updateExpense`.
* `src/modules/expenses/app/routes/expenses.routes.ts` — `destinoDelNif` en POST y PUT; el PUT lee el NIF.
* `tests/scrum937-el-nif-no-se-tira-en-silencio.test.mjs` — 13 tests, sin base y sin gate.

---

## SCRUM-937b · la mitad de pantalla

**Fecha:** 18-sep-2026 · **Carril:** S2 (panel) · **Pedido por:** el orquestador
**Medido contra:** `origin/main` = `34d06bb4f4e306b11745cf34fbbc85233c5a3299` · 2026-09-18T12:26:38Z
**Rama:** `scrum-937b-nif-en-el-modal`

### El defecto de pantalla, medido antes de escribir

`npm run guard:nif-del-gasto` (nuevo) sobre el modal REAL con el `expensesView.js` de main, a 390 px:

```
🔴 A · sin proveedor, el NIF se puede escribir · no se ve la ayuda · teclear dejó «B87654321»
🔴 B · alta: NIF tecleado y proveedor quitado → la respuesta dice sin_proveedor y no se avisa
🔴 B · edición (PUT): lo mismo
✔  POSITIVO · proveedor sin NIF + NIF tecleado → a la ficha, sin aviso
```

El caso B se alcanza hoy desde la pantalla con un gesto normal: elegir un proveedor sin NIF, teclearlo y
volver a «— Sin proveedor —». El NIF tecleado se quedaba en el campo y el servidor lo descartaba.

### Lo que se hace (solo `expensesView.js` y una regla de `styles.css`)

- **A** · `aplicarNifSegunProveedor()` decide el campo por el proveedor elegido: con NIF en la ficha, se
  muestra el de la ficha y queda de solo lectura (como hasta hoy); sin NIF, se escribe; **sin proveedor,
  solo lectura y la ayuda firmada**. El campo nace bloqueado y la lista de proveedores lo decide al
  llegar, también si la lista falla.
- Lo que el profesional ya hubiera tecleado **no se borra** al quitar el proveedor (borrarlo sería otra
  forma de tirarlo en silencio): si guarda así, lo cuenta B. El NIF que puso la ficha de otro proveedor
  sí se quita (`data-origen="ficha"`), para no atribuírselo a nadie.
- **B** · tras guardar, en el alta y en la edición, si la respuesta trae `destinoDelNif = 'sin_proveedor'`,
  aviso ámbar (`showToast(…, 'warn')`) con el texto firmado, antes de recargar.
- **C** no se construye: desde el modal no se alcanza (firmado en el mismo comentario, no pedido).
- Textos: SCRUM-937 comentario 15873, ficha `docs/microcopy/2026-09-18-SCRUM-937-nif-del-gasto.md`.

### Verificado en rojo

El guard monta el modal real (`expensesView.js` + `api.js` + `modalHeader.js`), elige, teclea y guarda
de verdad. El servidor local calcula `destinoDelNif` con **`queFueDelNif` compilado de `dist/`** —el
veredicto no se inventa— y sólo imita la otra mitad (`guardarNifDelProveedor`: la ficha se rellena si
estaba vacía). Con el arreglo: **4 de 4**. Mutantes, cada uno con su ancla comprobada:

| mutante | cae |
|---|---|
| M1 · sin proveedor el NIF sigue escribible | A |
| M2 · la ayuda nunca se ve | A |
| M3 · el aviso B sólo en el alta | B edición |
| M4 · el NIF de la ficha anterior se queda al quitar el proveedor | A |

Firmas comprobadas con `constaAprobado`: A y B → la ficha nueva; la propuesta sin el cambio del
orquestador → `[]` (control negativo).

### Lo que NO cubre (pantalla)

- Si la lista de proveedores no carga y no había proveedor, el NIF queda bloqueado con una ayuda que pide
  elegir un proveedor que no se puede elegir. Es el mismo estado del selector (dice que no se pudo
  cargar); no se ha añadido texto nuevo para ese caso.
- No se ha recorrido en staging.

### Ficheros (937b)

* `public/dashboard/js/expensesView.js` — `aplicarNifSegunProveedor`, la ayuda y el aviso B.
* `public/dashboard/css/styles.css` — `.gasto-nif-ayuda`.
* `scripts/guard-nif-del-gasto.mjs` + su entrada en `package.json`; `scrum522` 26 → 27, medido.
* `docs/microcopy/2026-09-18-SCRUM-937-nif-del-gasto.md`.
