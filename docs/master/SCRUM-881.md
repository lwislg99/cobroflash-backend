# SCRUM-881 · El detector de huecos componía SIN FECHA, y tras el corte llamaba «ajena» a lo propio

**Fecha:** 17-sep-2026 · **Carril:** B · numeración de serie · **Gate:** arreglo + controles
**Medido contra:** `origin/main` = `53e3db1f541574c4f231c3d196a2874680160d02` · 2026-09-17T08:51:27Z
**Rama:** `scrum-881-el-detector-sin-fecha`
**Preámbulo (A1):** `git rev-list --count HEAD..origin/main` = **0** al ramificar.

> **Obligación 0:** sin rama remota `scrum-881*`, sin commit con ese asunto en `main`, sin
> expediente → causa **(a)**, nunca empezado.

---

## A2 · PASO 0 — REPRODUCIDO CORRIENDO, no leyendo

Evidencia ejecutable: `docs/master/evidencias/SCRUM-881/paso0-881.mjs`. Se ejercita el `dist/` de
verdad, el mismo que corre el producto.

```
CORTE_FORMATO_F.desde = 2026-09-07T00:00:00.000Z

LO QUE COMPONE `formatInvoiceNumber`
   con fecha ANTERIOR al corte : 2026-CF-001
   con fecha POSTERIOR al corte: F260001
   SIN FECHA (lo que hace el detector): 2026-CF-001

SERIE EMITIDA DESPUÉS DEL CORTE
   emitidas: F260001, F260002, F260003
   → ultimoSeq: 0 · huecos: (ninguno) · AJENOS: F260001, F260002, F260003 · truncado: true
   🔴 REPRODUCIDO: las TRES salen «ajenas» y no casa ninguna.
```

**Y el control que descarta que esté roto en general:** la misma serie emitida **antes** del corte
casa entera (`ajenos: ninguno`, `ultimoSeq: 2`). El defecto es del lado nuevo del corte, no del
detector entero.

> 📌 **`truncado: true` no es un detalle:** al no casar nada, el barrido recorre las 10.000
> iteraciones del tope enteras. El defecto no sólo miente, también cuesta.

### SCRUM-780 vio este riesgo — y lo cubrió por el otro lado

Está escrito en su propio expediente, y por eso no se hereda ninguna afirmación:

> *«Sin fecha se formatea como siempre. No es comodidad: es lo que protege a los llamadores que
> componen números ya emitidos sin conocer su fecha (`huecosSerie`, `vistaPreviaSerie`). Si al no
> saber la fecha esto eligiera el formato nuevo, el detector de huecos dejaría de reconocer lo ya
> emitido y lo daría por perdido.»*

Tenía razón: elegir el formato nuevo habría roto lo anterior al corte. **Pero elegir el viejo rompe
lo posterior.** La salida no es elegir un lado — es no elegir.

---

## LA POBLACIÓN, declarada

| | |
|---|---|
| facturas con número en la base de **desarrollo** | **5** |
| evaluadas por el detector | 5 |
| **casadas** | **5** |
| huecos | 0 |
| **ajenas** | **0** |

Las cinco (`2026-FG-001…005`, merchant 1) son **anteriores al corte** —emitidas entre el 19-ago y
el 4-sep— así que la población viva **no exhibe el defecto hoy**. Se dice en vez de presentar el
caso sintético como si fuera producción.

> 🔴 **Y el dato que más cambia el alcance, medido:** **nadie llama a `huecosDeLaSerie` para
> facturas en todo `src/`.** El único llamador es `src/modules/jobs/domain/albaranSerie.ts`, y es
> para albaranes. `huecosDeAlbaranes` tampoco tiene llamador. O sea que **la población que este
> detector evalúa hoy en el producto es CERO**: el defecto está en el código y es real, pero su
> alcance vivo no lo es. Un detector que llama «ajena» a lo propio y un detector que no corre son
> indistinguibles por su salida — y aquí pasan las dos cosas a la vez.

### ⚠️ UN NÚMERO FALSO MÍO, CAZADO ANTES DE PUBLICARLO

La primera medición de la población dio **«AJENAS 5 de 5»**. Era mío: pasé el prefijo `'CF'` a pelo
cuando el real de ese merchant es `FG`. Un censo que fabrica el defecto que viene a medir no mide
nada. El prefijo se **lee** ahora de la base — y con el cliente tipado, no con SQL crudo, porque
adivinar el nombre de la columna me falló dos veces seguidas (`merchant_id`, `invoiceSeriesPrefix`).

---

## 🔴 REGLA 38 — POR QUÉ ESTO **NO** ES STOP

El arreglo cabe **entero dentro de `huecosSerie.ts`**, que declara en su propia cabecera que no
toca el camino de emisión. Lo único que entra de fuera son **dos cosas que ya estaban exportadas**:

```
src/modules/invoicing/domain/invoiceNumber.service.ts:216  export interface CorteDeFormato
src/modules/invoicing/domain/invoiceNumber.service.ts:224  export const CORTE_FORMATO_F
```

**Ni un export nuevo, ni una firma cambiada, ni código movido** en la emisión. Si hubiera hecho
falta exportar algo de allí, se paraba y se decía. La numeración de una factura emitida no se toca
(regla 29): aquí sólo se MIRA lo ya emitido, y ni una fila de la base se ha escrito.

---

## EL ARREGLO — componer LOS DOS LADOS, porque aquí no se sabe la fecha

🔒 **La solución no es parsear.** Esa es la decisión que sostiene el módulo entero y sigue en pie:
se compone con la misma función que compuso los números al emitirlos. Lo que cambia es que se
compone para **los dos lados del corte** y se acepta el que esté.

```ts
const testigos: (Date | null | undefined)[] = corte.desde ? [undefined, corte.desde] : [undefined];
```

- **Se aceptan los DOS, no «el nuevo».** Tras el corte la serie F nace de cero (SCRUM-780 §②), así
  que un mismo año puede tener `2026-FG-004` y `F260001` a la vez. Quedarse con un formato por
  `seq` mandaría el otro a `ajenos`: el mismo defecto con el signo cambiado. Hay control para eso.
- **El hueco se nombra con el formato del último que sí casó**, que es la serie en la que falta.
- **Aditivo para quien inyecta su `componer`:** `componerNumeroAlbaran` recibe cuatro parámetros e
  ignora el quinto, devuelve lo mismo para los dos testigos, el `Set` los funde y el barrido de
  albaranes queda **byte a byte** como estaba. Comprobado: `scrum306` en verde.
- **Con el corte apagado** (`corte.desde == null`) hay un solo testigo: comportamiento idéntico al
  de antes del ticket.

### Un guard se puso rojo, y se arregló el CÓDIGO

`scrum291 ①` comprueba el TEXTO `const esperado = componer(` para asegurar que el bucle usa el
compositor recibido y no parsea. Al pasar a dos candidatos lo reescribí como un `map` de una línea
y ese guard cayó — **el invariante seguía intacto, pero él mira la forma**. Se conservó la forma en
vez de relajar al que vigila (regla 41): sale más barato y el guard sigue sirviendo.

---

## ② LOS CONTROLES, CON LAS DOS MITADES

`tests/scrum881-el-detector-sin-fecha.test.mjs` — **5 pass · 0 fail · `# skipped 0`**.

| control | qué exige | resultado |
|---|---|---|
| **SUELO** | con cero facturas, «0 ajenas» es CIEGO y no salud; y la población de los controles no está vacía | ok |
| 🔴 **ROJO REAL** | una `F26…` posterior al corte: **antes ajena, ahora propia** (`ultimoSeq 3`, `truncado false`) | ok |
| ✅ **VERDE REAL** | un número de OTRA serie **sigue saliendo ajeno** | ok |
| ✅ **VERDE REAL** | un hueco de verdad se sigue viendo, y **con su formato** | ok |
| **lo que ya iba** | lo anterior al corte sigue casando · una serie MIXTA del mismo año no se pierde | ok |

**Sin la mitad verde habría escrito un «todo es propio» que pasa su propio test.** Por eso hay dos:
una exige que deje de acusar a lo propio, la otra que no deje de acusar a lo ajeno.

> **El suelo, y por qué está aquí y no en el módulo:** `huecosSerie` ya declara su parte —devuelve
> `emitidos` para que quien lo consuma lo mire, y `scrum291 ①` lo fija con su motivo escrito—.
> Hacerlo lanzar rompería un contrato que la casa eligió a propósito. El suelo se ejerce en el
> guard.

### 🔴 MUTACIÓN — y la sustitución cuenta 1

Declarada en el propio test (`MUTACIONES_QUE_ME_TUMBAN`, SCRUM-745), así que `meta:mutaciones` la
correrá **en CI** en cada PR. Devuelve el barrido a un solo testigo —lo de antes del ticket— y
exige el rojo:

```
ancla en src/modules/invoicing/domain/huecosSerie.ts → apariciones: 1  ✅
linea base · pasados=5 caidos=0
  VIVA   · SCRUM-881 · 🔴 ROJO REAL: una F26… posterior al corte es PROPIA, no ajena  (+3 más caídos)
```

La comprobación de **«la sustitución cuenta 1»** va **antes** de mutar: un `de` que apareciera dos
veces haría que `texto.replace` tocara la primera, que puede no ser la que se quiere.

---

## LA TANDA

```
ARBOL QUIETO DESDE: 09:12:16 UTC
ARBOL QUIETO HASTA: 09:23:39 UTC
# tests 7204 · # pass 7094 · # fail 0 · # skipped 110
```

`npm run guards:entrada`: 26 tests, 0 fallos, `# skipped 0`.

> ⚠️ **La única edición posterior a la tanda son las cifras de este bloque**, sustituidas en este
> fichero de texto; después se relanzaron `guards:entrada` y `scrum854`.

---

## LO NO TOCADO

- **El camino de emisión fiscal: ni una línea.** `invoiceNumber.service.ts` intacto — sólo se
  importan dos exports que ya existían. `allocateInvoiceNumber` y su `pg_advisory_xact_lock`, sin
  tocar. Ninguna factura emitida cambia de número (regla 29).
- **`scrum291` y `scrum306`: ni una línea.** El guard que se puso rojo se resolvió conservando la
  forma que vigila, no relajándolo.
- **`prisma/schema.prisma`: ni una línea** (regla 40; es del fundador). ⚠️ Y queda dicho: el
  esquema **no declara** las siete columnas del emisor congelado que sí existen ya en la base —ver
  el apéndice de `SCRUM-665.md`—. Eso es una divergencia real y **no se arregla aquí**: el diff se
  propone, no se aplica.
- `src/` sólo en `huecosSerie.ts` · ningún estado ni flag nuevo (27) · ninguna dependencia (36) ·
  cero producción y cero staging · `git stash` no usado · historia no reescrita.
