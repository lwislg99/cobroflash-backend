# SCRUM-337 · El correo del día 12 decía que se pierde el panel y el panel no se pierde — texto corregido y las dos caras atadas

**Fecha:** 5-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `3e6f63709d40c7781317a90523208872e2fb5605` · 2026-08-05T04:54:12+01:00

> **Cierra las DOS mitades.** La técnica (el guard que impide que vuelva a divergir) y la de
> producto (el texto corregido), esta última **decidida y aprobada por el fundador**: se corrige el
> TEXTO, **no se amplía el bloqueo**. `requireActivePlan` no se toca — gatear 95 rutas cambiaría el
> comportamiento de todas las cuentas en prueba y es un cambio de producto que nadie ha pedido.

---

## El defecto, medido por contenido (el árbol se había movido desde D0)

**Cara A — lo que el producto DICE.** Cinco avisos en el evaluador diario
(`src/modules/messaging/domain/lifecycle.service.ts`), no tres: la derivación encontró también
`trialExpired` e `inactive`, que **nadie había mirado**.

**Cara B — lo que el producto HACE al vencer.** `requireActivePlan`
(`src/core/http/authMiddleware.ts:55-74`), **4 montajes de 96 rutas de escritura**, cero `.use()`:

| Montaje | Qué es, medido |
| --- | --- |
| `POST /quote/create` (`src/app.ts:257`) | la **ÚNICA** ruta de creación de presupuestos (`quotes.routes.ts:62`) |
| `POST /admin/quotes/:id/send-whatsapp` (`src/app.ts:333`) | enviar el presupuesto por WhatsApp |
| `POST /:id/enviar-whatsapp` (`albaranes.routes.ts:571`) | **enviar** la copia firmada por WhatsApp |
| `POST /:id/enviar-para-firmar` (`albaranes.routes.ts:588`) | **enviar** el link de firma por WhatsApp |

**Las dos de albaranes son de ENVÍO: crear albaranes no caduca.** Se midió antes de firmar el
texto, para no escribir una analogía («igual que los albaranes») que no dice si dejas de crearlos o
de enviarlos.

**Y el aviso del día 3**, medido: «lo tienes precargado por oficio» depende de **cuatro**
condiciones, no de una — tener oficio (paso 1 del wizard, `onboardingView.js:90`), que no sea
«otro» (`tradeCatalogs.ts:136`), **no desmarcar la casilla** del paso siguiente
(`onboardingView.js:135`, marcada por defecto) y que la carga no reviente. **La cuarta falla en
silencio**: el `POST /admin/products/load-catalog` va dentro de un `catch` vacío
(`onboardingView.js:165`). Eso último es **SCRUM-338** y no se arregla aquí.

De paso, y porque afectaba a la clasificación: la prueba es de **14 días**
(`auth.service.ts:301`), así que las tres fechas que prometen los correos son **exactas**.

---

## La mitad de producto: los dos textos (microcopy aprobada por el fundador, regla 30)

**Día 12** — cambio mínimo, solo la frase falsa; la enumeración de ventajas del Pro no se toca
porque es otro claim y no era el encargo:

> «Te quedan unos 2 días de prueba. Si activas el plan Pro, sigues con cotizaciones y facturas
> ilimitadas, cobro integrado y soporte. Si no, **dejarás de poder crear presupuestos nuevos y de
> enviar presupuestos y albaranes por WhatsApp. El resto del panel sigue funcionando: tus cobros,
> tus clientes y tus datos siguen ahí.**»

⚠️ **La enumeración final no es la que se aprobó, y el motivo es un guard.** El texto aprobado
decía «tus facturas, tus cobros y tus datos», y el trinquete de **SCRUM-299 (Parte M)** lo cazó:
el posesivo del documento fiscal es una **promesa**, y hasta SIF-1 el documento post-pago es
justificante (reglas 24/26). El guard tenía razón y el texto cedió. La frase no pierde nada: «el
resto del panel sigue funcionando» ya lo cubre entero, y la enumeración solo da ejemplos.

**Día 3** — se descartó condicionar («si elegiste tu oficio…»): con cuatro condiciones, y una que
falla sola, cualquier versión fiel salía retorcida. Y a quien **no** tiene catálogo —el que está
atrapado en SCRUM-338— mandarle a comprobar algo que no puede arreglar es mandarle a una pared:

> «**Revisa tu catálogo en Productos: si se precargó una lista para tu oficio, ya está ahí; si no,
> puedes añadir tus servicios desde esa misma pantalla.**»

No afirma el estado del usuario, y la segunda mitad es la única parte accionable para quien no
tiene nada. Apunta a la misma pantalla que el propio wizard ofrece (`onboardingView.js:145`): no
inventa camino, usa el que ya existe.

---

## La mitad técnica: el guard

`tests/scrum337-aviso-atado-al-bloqueo.test.mjs` + el derivador `tests/_censo-aviso-vs-bloqueo.mjs`
(tres censos: avisos, montajes, borrados). Corre en `npm test`, sin gate. **Nada escrito a mano:**
ni las cuatro rutas ni los doce borrados se enumeran a mano — salen del AST.

**No dice cuál de las dos caras es la correcta. Dice que no pueden moverse por separado.**

### La clasificación de los cinco avisos

| Aviso | Estado | Atadura |
| --- | --- | --- |
| `day3` | **ATADO** | censo de montajes — promete que en Productos se pueden añadir servicios, o sea que esa escritura **no** caduca |
| `day7` | **SIN_CONSECUENCIA** | anuncia un hecho exacto (14−7) y no promete consecuencia |
| `day12` | **ATADO** | censo de montajes — el texto enumera exactamente los 4 montajes |
| `trialExpired` | **ATADO** | censo de borrados (dos capas) |
| `inactive` | **SIN_CONSECUENCIA** | reenganche puro |

**`NO_ATADO` queda VACÍO**, con su ratchet: cualquier promesa nueva sin respaldo es el defecto de
337 otra vez, con otro correo, y si algún día se acepta una a sabiendas entra **con su ticket**.

**`ATADO` no se concede por ausencia**, y hay un assert que lo impide: cada `ATADO` nombra el
mecanismo que lo sostiene. Que hoy nada contradiga un aviso no es una atadura — es un hueco con
suerte.

### La atadura de `trialExpired`, en dos capas

`trialExpired` promete que **los datos siguen ahí**. Eso es cierto, pero atado a una **ausencia**:
que nada los borre. «Verde por ausencia» no vale, así que la ausencia se convierte en afirmación
vigilada:

* **Capa ① (forma)** — cero borrados cuyo `where` lleve umbral de tiempo (`lt/lte/gt/gte`) o
  mencione plan, trial o inactividad. Caza la purga evidente en el acto. Hoy: **12 borrados en
  `src`, 0 sospechosos**.
* **Capa ② (sitio)** — los 12 borrados congelados por identidad. Cierra el punto ciego CONOCIDO de
  la ①: una purga que primero consulte los vencidos y **luego borre por `id`** no tiene forma
  sospechosa, pero sí es un sitio nuevo.

**El límite, escrito en la cabecera del guard con estas palabras:** alguien puede actualizar el
censo de ② y contestar mal a la pregunta que le hace el mensaje. Entonces será **una mentira en un
diff, no un silencio** — que es el estándar de la casa, no una excusa.

---

## Verificado en rojo — siete casos sobre los ficheros REALES, sin inyectar

| Caso | Edición real | Resultado | Assert que cae |
| --- | --- | --- | --- |
| **R1** | `age >= 12` → `age >= 13` | 🔴 8/1 | «si cambia lo que el correo DICE» |
| **R2** | quitar `requireActivePlan` de `/quote/create` | 🔴 8/1 | «si cambia lo que el producto HACE» |
| **R3** | renombrar `runLifecycleEmails` | 🔴 7/2 | SUELO ① |
| **R4** | `deleteMany` con umbral de fecha en el evaluador diario | 🔴 7/2 | **capa ①** (y ②) |
| **R5** | `delete` **por id**, sin forma sospechosa | 🔴 8/1 | **capa ② sola** — la prueba de que cierra el punto ciego de la ① |
| **N1** | reindentar dentro del bloque del día 12 | 🟢 9/0 | — |
| **N2** | comentario nuevo fuera de los bloques | 🟢 9/0 | — |

**R1 se hizo sobre la CONDICIÓN y no sobre el texto, a propósito:** alterar microcopy —aunque fuera
un segundo— no es del guard. La huella cubre el bloque entero, así que un cambio de texto dispara
por el mismo camino.

**Los dos controles negativos existen porque el modo de morir de un guard así es el ruido**: si un
`prettier` pusiera en rojo los cinco avisos con un mensaje sobre promesas incumplidas, el siguiente
lo puentea. Por eso la huella normaliza espacios.

### El guard ya se ha topado con una rama paralela, y aguantó

Durante esta sesión `main` se movió tres veces. La última trajo **SCRUM-289 (incremento 2)**, que
toca `src/app.ts` —el fichero de los montajes— y añade el entrypoint de la factura suelta. Tras
rebasar: **rutas de escritura 95 → 96, montajes 4, borrados 12, guard 9/9 verde.** Correcto y por
la razón correcta: el número total de rutas **no** está congelado (congelarlo pondría el guard en
rojo en cada PR ajeno y acabaría puenteado), y la ruta nueva **no está gateada**, así que el texto
del día 12 sigue describiendo el mecanismo.

### Nota de método, porque casi cuesta el trabajo

La primera versión del verificador restauraba con `git checkout -- <fichero>` y **se llevó por
delante la microcopy de este mismo ticket**, que todavía no estaba commiteada. Restaurar «al último
commit» no es restaurar «a como estaba»: solo coinciden si el árbol estaba limpio. Ahora el
verificador guarda el contenido original **en memoria** y lo reescribe. Lo cantó el propio
verificador —los tres primeros casos dijeron «restaurado y verde de nuevo: NO»—, que es justo para
lo que sirve comprobar el estado DESPUÉS de restaurar.

---

## Lo que NO cubre

* **El guard no lee el texto.** No detecta que un correo NUEVO prometa algo falso: detecta que
  existe y **obliga a clasificarlo**. La clasificación la pone una persona.
* **Las dos capas de borrado no son una prueba de que nada se borrará jamás**: cubren la forma
  sospechosa y la aparición de sitios. Ver el límite declarado arriba.
* **Solo cubre los avisos del evaluador diario.** `sendWelcomeEmail` y `sendFirstPaymentEmail`
  quedan fuera porque los mandan otras funciones — el límite lo pone la estructura, no una lista.
* **El `catch` vacío de la precarga del catálogo no se arregla aquí**: es SCRUM-338 y es otro
  alcance. El texto del día 3 deja de depender de él, que es lo que sí tocaba.
* **No se ha ejecutado ningún envío real** ni se ha mirado producción.
* No se ha tocado `prisma/schema.prisma`, ni `requireActivePlan`, ni Jira.

## Ficheros

* `src/modules/messaging/domain/lifecycle.service.ts` — los dos textos corregidos, cada uno con el
  porqué medido al lado (**único fichero de producto tocado**).
* `tests/_censo-aviso-vs-bloqueo.mjs` — los tres censos derivados (AST).
* `tests/scrum337-aviso-atado-al-bloqueo.test.mjs` — el guard (9 asserts).
* `docs/master/SCRUM-337.md` — este registro.
