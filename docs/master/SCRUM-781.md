# SCRUM-781 · La concurrencia de la FACTURA, provocada — y el número que decide

**Fecha:** 6-sep-2026 · **Carril:** fiscal / rendimiento · **Gate:** la carrera con `QA_DB_TEST=1`; el resto en `npm test`

**Medido contra:** `origin/main` = `43f05e8c9322d574d91e6b7cc1b39785abb81b0c` · 2026-09-06T12:23:54+01:00

> **Sin código de producto.** Se mide y se propone. No se ha tocado el emisor.

---

## DE DÓNDE SALE

De dos huecos que declaré yo misma al cerrar SCRUM-592 y SCRUM-771. Uno era bueno. **El otro
estaba mal declarado, y lo corrijo antes que nada.**

---

## 🔴 ME CORRIJO: LA CONCURRENCIA DE LA FACTURA **SÍ** ESTABA PROVOCADA

Escribí: *«no hay un test que ponga diez emisiones de factura a competir»*, y de ahí salté a *«la
concurrencia de la factura nunca se ha provocado»*. **Lo segundo es falso.**

`tests/scrum234-carrera-serie.gated.test.mjs` provocó **DOS** emisiones concurrentes el
02-ago-2026, **en los dos sentidos** (sin cerrojo → `P2002`; con cerrojo → números consecutivos),
tres veces cada uno. Lo que no existía era **DIEZ**, y la medición del **coste**.

⚠️ Y ese test **no se ha corrido en esta sesión**: importa `./_staging-db.mjs`, o sea que apunta a
**staging**, y este encargo lo prohíbe. Su evidencia se cita con su fecha; no se re-verifica.

---

## ✅ LO PRIMERO: EL CERROJO AGUANTA. Diez a la vez, sin duplicar ni saltar

Contra `yaqu_dev_javier`, por el **emisor real** (`emitInvoice`, no el reservador a secas), con el
guard por DESTINO que se niega a arrancar contra otra base:

```
ok 1 - SCRUM-781 · SUELO: UNA emisión avanza el contador fiscal exactamente 1
ok 2 - SCRUM-781 · 🔴 DOS emisiones SIMULTÁNEAS no cogen el mismo número
ok 3 - SCRUM-781 · 🔴 y con DIEZ a la vez tampoco: ni un duplicado ni un salto
ok 4 - SCRUM-781 · 🔴 CONTROL NEGATIVO: crear un CLIENTE no mueve ningún contador
# tests 4 · pass 4 · fail 0 · exit 0
```

Y el test **no se conforma con que los números sean correlativos**: cuenta las filas
(`invoice.count === 10`). Una emisión que reserva número y no llega a insertar dejaría el conjunto
igual de correlativo y un hueco en la serie.

**El SUELO no es adorno:** sin comprobar que una emisión sola mueve el contador de 1 a 2, el «ni un
duplicado» de los diez no distingue «el cerrojo funciona» de «no se ha emitido nada».

---

## LA ANATOMÍA DEL COSTE — contada, no leída

Con el registro de consultas de Prisma, **una** emisión de factura son **7 sentencias**:

```
 1.  176 ms · BEGIN                                     ← fuera del cerrojo
 2.  342 ms · SELECT pg_advisory_xact_lock($1,$2)       ← ⬇ SE TOMA EL CERROJO
 3.  343 ms · SELECT ... FROM merchants
 4.  347 ms · UPDATE merchants SET next_invoice_number
 5.  349 ms · INSERT INTO audit_log
 6.  346 ms · INSERT INTO invoices
 7.  178 ms · COMMIT                                    ← ⬆ SE SUELTA
```

Un presupuesto son **5** (no tiene el `audit_log` ni el `invoice.create`). Medido en paralelo:

| | mediana de una sola | sentencias |
|---|---|---|
| reserva de PRESUPUESTO | **945 ms** | 5 |
| emisión de FACTURA | **1.349 ms** | 7 |
| **sobrecoste del emisor** | **+404 ms** | +2 |

404 ms / 2 sentencias = **202 ms por ida y vuelta**, que es exactamente el **RTT medido** contra
esta base: **190 ms de mediana** (`SELECT 1`, 10 veces). **El coste es latencia, no cerrojo.**

---

## 🔴 EL NÚMERO QUE DECIDE: **a partir de SEIS**

Con los topes **por defecto** de Prisma (`timeout` 5.000 · `maxWait` 2.000), fallos por pasada:

| N simultáneas | pasadas (3+3+5 = 11 en total) | veredicto |
|---|---|---|
| 2 | `0,0,0` · `0,0,0,0,0` | limpio |
| 4 | `0,0,0` · `0,0,0,0,0` | limpio |
| **5** | `0,0,0` · `0,0,0,0,0` | **limpio en 11 de 11** |
| **6** | `1,2,1` · `0,1,1,1,2` | **falla en 7 de 8** |
| 7 | `2,2,2` · `2,3,2,2,2` | falla siempre |
| 8 | `3,3,3` · `3,3,4,3,3` | falla siempre |
| 10 | `5,5,5` · `6,5,7,5,5` | falla siempre |

**Cinco emisiones simultáneas pasan. La sexta ya no.** Y el patrón es `N − 5` fallos: entran las
cinco que caben en el presupuesto de 5.000 ms y el resto se cae.

Todos los fallos son de la MISMA clase, y el script los distingue por su error en vez de suponerlo:
**`P2028` · TIMEOUT de transacción**. **Ni uno** fue del pool (`maxWait`). O sea que el diagnóstico
del encargo es correcto: **revientan por TIEMPO, no por lógica ni por conexiones.**

### El modelo cuadra con la medida, y por eso el número se sostiene

La sección crítica son las sentencias 2→7: **5 idas y vueltas** dentro del cerrojo.

```
5 × 190 ms (RTT) ≈ 950 ms por emisión encolada
5.000 ms / 950 ms = 5,3  →  caben CINCO, la sexta no
```

Y la pendiente medida lo confirma sin usar el modelo: de N=1 (1.318 ms) a N=20 (18.286 ms) salen
**893 ms por emisión añadida**; en otra pasada, **897 ms**. **Dos caminos independientes dan el
mismo 5,x.**

---

## ⚠️ UN NÚMERO QUE MEDÍ Y **RETIRO**

El script busca también «el primer N cuya PEOR emisión supera 5.000 ms de mediana», y en las tres
pasadas dio **N=5** (medianas 5.033 · 5.131 · 5.246 ms). **No lo publico**, y el propio script lo
dice solo:

```
🔴 PRIMER N QUE PASA DE 5000 ms: N=5 (mediana 5.131 ms)
⚠️  Y SE RETIRA: la amplitud entre pasadas (1.352 ms) es mayor que la distancia
    al umbral (131 ms). La máquina dispersa más de lo que mide este número.
```

La regla está **en código** (`dispersionSeLoCome`) y **probada en los dos sentidos**, sin gate: un
número pegado al umbral con mucha amplitud se retira; uno a 13 segundos con 194 ms de amplitud, no.
Sin ese control positivo, un instrumento que retirase SIEMPRE pasaría por prudente estando roto.

**Se retira ése y se publica el otro** —«5 pasan, 6 falla»— porque aquél es un cruce de medianas y
éste es un recuento de fallos reales, reproducido 11 veces.

---

## 🔴 Y LA ADVERTENCIA QUE MANDA SOBRE TODO LO ANTERIOR

**El «6» no es una propiedad del código: es una propiedad de la LATENCIA.**

Esta medición va contra un Postgres **remoto** (`acela.proxy.rlwy.net`), con **190 ms** de ida y
vuelta. El umbral escala así:

```
N_max ≈ timeout / (5 × RTT)
```

· con RTT 190 ms  → N_max ≈ 5    ← lo medido aquí
· con RTT  20 ms  → N_max ≈ 52
· con RTT   2 ms  → N_max ≈ 526

⛔ **NO he medido la latencia de producción**, porque no toco producción. Así que **no puedo decir
si esto es urgente ahí.** Lo que traigo es la fórmula con sus dos entradas medidas en un entorno, y
la única medición que falta para cerrarlo es **un `SELECT 1` desde el servidor de producción contra
su propia base** — que es de quien tenga esa mano, no mía.

Si en producción la app y la base están en la misma región de Railway, el umbral está en decenas o
centenares y **esto es teórico**. Si no lo están, está donde lo he medido.

---

## LAS TRES SALIDAS, CON SU COSTE MEDIDO — y no decido

| | qué hace | lo que cuesta, medido | la pega |
|---|---|---|---|
| **A** · subir el `timeout` | admite N mayores | hay que darle **≥ N × 900 ms**: N=10 → 9 s (medido 9,3-10,2); N=20 → 18 s (medido 18,3) | **convierte un error rápido en una espera larga**: el último profesional mira la pantalla 18 s con el cliente delante. Y no arregla nada por debajo: sólo mueve el punto donde duele |
| **B** · sacar trabajo de la transacción | acorta la sección crítica | **sólo hay UN candidato**: el `INSERT audit_log`. Quitarlo deja 4 idas y vueltas → N_max pasa de **5 a 6**. **Gana UNA emisión** | y cuesta una garantía fiscal: SCRUM-207 escribe `factura_emitida` **dentro** de la transacción a propósito. Las otras cuatro sentencias **no se pueden sacar** — leer el contador, escribirlo y crear la factura tienen que ir bajo el mismo cerrojo o vuelve la carrera |
| **C** · encolar las emisiones | la espera deja de ser un error | no medido: no hay cola que medir | rompe el contrato síncrono («dame el documento ahora») y añade infraestructura |
| **D** · acercar la base | divide el coste por el factor de latencia | **no medido en producción**; aquí el RTT es 190 ms y es **el término dominante** | es la única que ataca la causa en vez del síntoma, pero no es una decisión de código |

🔴 **Recomendación (no decisión): medir primero la latencia de producción, y no tocar nada hasta
tenerla.** Es la única cifra que separa «esto es urgente» de «esto es teórico», y **cuesta un
`SELECT 1`**. Cualquiera de las cuatro salidas elegida antes de tenerla es una apuesta.

Si hubiera que elegir a ciegas, **A con un tope modesto** (p. ej. 15.000 ms) es la menos mala: no
toca el camino de emisión ni una garantía fiscal. Pero **subirlo sin la latencia delante es
exactamente lo que el encargo prohíbe**, y con razón: convierte un fallo de 5 s en una espera de 15.

**B es la peor relación de todas** y por eso se dice con el número: **gana una emisión y paga con
el registro de auditoría fiscal.**

---

## MUTACIONES

**Tres declaradas al meta-guard, las tres VIVAS**, sobre el instrumento que decide si un número se
publica:

| # | qué imita | cae |
|---|---|---|
| ① | el medidor no retira NADA: publica siempre | el de «se retira» |
| ② | el medidor retira SIEMPRE | el CONTROL POSITIVO |
| ③ | la mediana de una lista PAR toma «el de en medio», que no existe | el SUELO |

`npm run meta:mutaciones` — **tres pasadas**: **vivas 68 · mudas 0 · ciegas 0**, idénticas.

### ✅ Y de paso: MI PROPIO LÍMITE DE 760/771 ESTÁ CERRADO, comprobado aquí

En SCRUM-760 y SCRUM-771 dejé fuera del corredor toda mutación cuyo test importara de `dist/`,
porque el meta-guard mutaba el fuente y **no recompilaba**. `main` trae `frontera-dist.mjs`
(SCRUM-763) y el corredor ya emite antes de juzgar. **No me fío del mensaje del commit: lo
comprobé en este árbol** — la declaración de `utils.test.mjs`, que importa
`../dist/core/utils/utils.js`, sale **VIVA** en las tres pasadas.

**Las de la CARRERA siguen sin declararse**, y no por aquel límite: están **gateadas**. Sin
`QA_DB_TEST=1` no pasan en la pasada limpia y el corredor las daría —con razón— por CIEGAS.

---

## LO QUE ME CAZÓ A MÍ

**SCRUM-456** (*todo salto declara su motivo*). Había puesto el motivo en una constante `MOTIVO`, y
el guard lo lee **por AST sobre el fuente**: un identificador no lo puede resolver, así que lo daba
por salto mudo. **Cambié mi código, no el guard** — el texto va literal en los cuatro, repetido a
propósito, porque la alternativa es un salto que no dice por qué.

Y **`new URL(import.meta.url).pathname` no decodifica**: la ruta de este repo lleva un espacio
(«Javier Pereira») y el test caía con un `ENOENT` sobre `Javier%20Pereira` que parece un fichero
que falta. Es `fileURLToPath`, la lección de SCRUM-730. Queda escrito en el fichero.

---

## HUECOS DECLARADOS

- ⛔ **No he medido staging ni producción.** Ni una consulta, ni para contar filas. Todo es
  `yaqu_dev_javier`, y el test y el script **se niegan a arrancar** si la clave apunta a otro sitio.
- 🔴 **Falta la latencia de producción**, y sin ella el «6» no se puede trasladar. Es la medición
  que cierra este ticket y no está en mi mano.
- **No he tocado el emisor.** Ni el timeout, ni el orden de las sentencias, ni el `audit_log`.
- **No he medido la salida C (encolar)**: no hay cola en el árbol que medir. Su coste queda sin
  cifra, y se dice en vez de estimarlo.
- **El pool de conexiones no llegó a ser el cuello**: ni un fallo de `maxWait` en 11 pasadas hasta
  N=20. Con N mucho mayores podría serlo, y no lo he explorado.
- **Las emisiones de prueba son de un merchant QA de usar y tirar en dev**, y se limpian. No son
  documentos fiscales de nadie: la regla 29 protege lo emitido de un merchant real.
- **El coste del PRESUPUESTO se midió sólo para atribuir el sobrecoste del emisor** (5 vs 7
  sentencias). No se ha vuelto a medir su umbral: el de SCRUM-592 sigue siendo el suyo.

---

## TANDA

**5.643 tests · 5.551 pass · 0 fail · 92 skipped · estado 0**, sobre el árbol ya mezclado con
`main` (dos merges durante la sesión).

Los 92 saltados declaran su motivo y **suman**: 80 `QA_DB_TEST` (76 de antes + **los 4 de este
ticket**) + 9 `LIBRO_PG_URL` + 1 `BOT_SUITE_TEST` + 1 `A55_DB_TEST` + 1 que no puede crear un
enlace a fichero en Windows sin elevación.

Los cuatro gateados **sí se han ejecutado**, contra dev y aparte: 4/4 en verde.
