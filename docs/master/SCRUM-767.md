# SCRUM-767 · `customer.portalToken` — el hueco tenía víctima, y era el DEMO

**Fecha:** 6-sep-2026 · **Carril:** producto / datos derivados · **Gate:** la cura con `QA_DB_TEST=1`; los censos en `npm test`

**Medido contra:** `origin/main` = `5c9c8da0ce66d259364309b441e68cd08c7e6287` · 2026-09-06T12:36:20+01:00

---

## PASO 0 · el hueco NO era cosmético

SCRUM-761 lo declaró y no lo arregló a propósito: *«el alta real lo escribe; el sembrador no; lo
cura `ensurePortalToken` bajo demanda»*. Las dos mitades de esa frase se han comprobado. **La
primera es cierta a medias y la segunda no se sostiene bajo concurrencia.**

---

## 🔴 ① LA VÍCTIMA, MEDIDA

Sobre `yaqu_dev_javier`, **sólo lectura**, con el guard por destino:

```
CLIENTES en dev : 14
SIN portalToken : 11 (79 %)
  #  1 m2   🔴 SIN token · Cliente QA
  #640 m1   🔴 SIN token · María García
  #641 m1   🔴 SIN token · José Luis Martín
  #642 m1   🔴 SIN token · Carmen Ruiz
  #643 m1   🔴 SIN token · Antonio López
  #644 m1   🔴 SIN token · Lucía Fernández
  #645 m1   🔴 SIN token · Comunidad de Vecinos C/ Mayor 5
  #646 m1   🔴 SIN token · Bar El Rincón
  #637-639 m742  CON token
```

**Los SIETE clientes del merchant 1 —el DEMO— no tienen token.** Y el demo es exactamente lo que
se le enseña a quien está decidiendo si paga.

### Y las dos pantallas del MISMO cliente no contestan igual

| pantalla | qué hace | con token vacío |
|---|---|---|
| **LISTA** (`customersView.js:600`) | pinta «Portal» SIEMPRE; al pulsar llama a `GET /admin/customers/:id/portal-url`, que **cura** | funciona |
| **FICHA 360** (`customerDetailView.js:76`) | pinta «🔗 Portal» **sólo si `portalUrl`**, que sale de `GET /:id/detail` leyendo la columna EN CRUDO | **el botón NO EXISTE** |

No es que el enlace falle: **es que el botón desaparece**, sin decir nada. El profesional que
entra por la ficha no tiene manera de saber que existe un portal para ese cliente.

---

## 🔴 ② LA CURA NO ES SEGURA BAJO CONCURRENCIA — provocada, no razonada

`ensurePortalToken` es un **read-then-write sin transacción y sin cerrojo**:

```ts
const customer = await prisma.customer.findFirst({ where: { id: customerId, merchantId } });
if (customer.portalToken) return customer.portalToken;
const token = generatePortalToken();
await prisma.customer.update({ where: { id: customerId }, data: { portalToken: token } });
return token;
```

Provocado contra dev, por el camino real:

```
✅ CONTROL POSITIVO · SECUENCIAL: dos llamadas seguidas dan el MISMO token
  1ª = 2ª = base = 824d0e32ccf82cf1fb5b64663fedefd0   → idempotente

🔴 DOS A LA VEZ sobre un cliente SIN token
  pasada 1: iguales SÍ  · tokens entregados que NO están en la base: 0
  pasada 2: iguales 🔴NO · 1
  pasada 3: iguales 🔴NO · 1
  pasada 4: iguales 🔴NO · 1
  pasada 5: iguales 🔴NO · 1

🔴 DIEZ A LA VEZ
  pasada 1:  2 tokens distintos de 10 · 1 de 10 apuntan a un token que ya NO está en la base
  pasada 2:  9 tokens distintos de 10 · 9 de 10
  pasada 3: 10 tokens distintos de 10 · 9 de 10

✅ CONTROL NEGATIVO · editar el nombre NO toca el token → intacto
```

**Gana la última escritura.** Los demás llamadores se llevan un token que ya no existe: `GET
/cliente/:token` busca `where: { portalToken }` y **no encuentra nada**. El profesional copia un
enlace y se lo manda a su cliente, y el enlace está muerto desde el primer segundo.

El control negativo es lo que hace creíble el positivo: sin él, «un solo token» no distinguiría
«la cura es estable» de «mi doble no escribe nada».

---

## 🔴 ③ CORRIJO EL DATO DEL ENCARGO: no era sólo el sembrador

El ticket decía «el alta real lo escribe; EL SEMBRADOR NO». Censado por AST sobre `src/`, **hay
dos caminos de PRODUCCIÓN que tampoco lo escriben**:

| camino | qué es |
|---|---|
| `src/modules/whatsappBot/domain/botFlow.service.ts:264` | el bot crea el cliente cuando **un número desconocido escribe** a un merchant con perfil público |
| `src/modules/billing/app/routes/charges.routes.ts:24` | el alta de cliente que viene **dentro de una petición de cobro** |

Los dos quedan **DECLARADOS y no tocados** (fuera del alcance de este encargo: *«si aparece uno
nuevo, lo DECLARAS y no lo arreglas»*), y un alta nueva sin token **hace caer el censo**.

🔴 **Consecuencia, y es la frase que importa: arreglar el sembrador NO cierra el agujero.** Cierra
el del demo, que es el que tenía víctima visible. Los otros dos siguen produciendo clientes que
dependen de una cura que, como acaba de medirse, no aguanta dos llamadas a la vez.

---

## LO QUE SE CONSTRUYE

**El sembrador da de alta por el camino real** — escalón 1, la misma decisión y el mismo motivo
que SCRUM-761 con el catálogo:

```diff
- customers.push(await prisma.customer.create({ data: { merchantId: DEMO_ID, ...c } }));
+ customers.push(await createCustomer(DEMO_ID, c));
```

⛔ **NO se rellena el campo a mano.** Sería una segunda copia del alta, y el día que el alta real
derive una columna más este sembrador volvería a quedarse corto exactamente igual — que es el
defecto, no el síntoma.

Probado contra dev, no leído:

```
createCustomer         → portalToken: SÍ (882a304eeafb…)
customer.create a pelo → portalToken: 🔴 NULL   ← lo que hacía el sembrador
¿devuelve el token en la respuesta? (SCRUM-97 dice que NO) → no, correcto
campos que devuelve: id, merchantId, name, phone, … ← `id` es lo único que el sembrador usa
```

**El sembrador NO se ha ejecutado**: borra y recrea el demo, y hacerlo exigiría poner una cadena
de conexión en el entorno. Lo que se ha comprobado es que el import resuelve, que `createCustomer`
escribe el token y que devuelve el `id` que el resto del sembrador necesita.

---

## EL DIFF PREPARADO PARA ② — y NO aplicado

La carrera se cierra sin transacción ni cerrojo nuevo: basta que la escritura sea **condicionada**,
que en Postgres es una sola sentencia atómica.

```diff
--- src/modules/system/customerAdmin.ts
 export async function ensurePortalToken(merchantId: number, customerId: number): Promise<string> {
   const customer = await prisma.customer.findFirst({ where: { id: customerId, merchantId } });
   if (!customer) throw new Error('customer_not_found');
   if (customer.portalToken) return customer.portalToken;
   const token = generatePortalToken();
-  await prisma.customer.update({ where: { id: customerId }, data: { portalToken: token } });
-  return token;
+  // Escritura CONDICIONADA: sólo si SIGUE vacío. Si otra petición llegó antes, no se pisa.
+  await prisma.customer.updateMany({
+    where: { id: customerId, merchantId, portalToken: null },
+    data: { portalToken: token },
+  });
+  // Y se devuelve lo que quedó en la base, no lo que este hilo generó: es la diferencia entre
+  // entregar un enlace vivo y entregar uno que ya no existe.
+  const final = await prisma.customer.findFirst({
+    where: { id: customerId, merchantId }, select: { portalToken: true },
+  });
+  return final!.portalToken!;
 }
```

**No se aplica porque el alcance de este encargo es el sembrador.** Cuesta una consulta más por
curación —sólo en la curación, no en el camino normal— y a cambio la invariante «todos los
llamadores reciben el token de la base» pasa a ser cierta SIEMPRE, que es justo lo que hoy no se
puede afirmar.

---

## POR QUÉ NO HAY GUARD EJECUTABLE DE LA CARRERA

Porque sería **inestable**: una de las cinco pasadas con dos a la vez **no llegó a entrelazarse** y
dio el mismo token. Un test que falla cuatro de cada cinco veces no es un guard — es ruido que un
día alguien apaga «porque falla solo».

Así que el fichero afirma sólo lo que se cumple SIEMPRE (idempotencia secuencial, la base termina
con un token, el token final es uno de los entregados, y editar no lo mueve) y **la carrera va aquí
con sus ocho pasadas**. 🔴 **El guard determinista nace el día que se aplique el diff de arriba**:
entonces «todos reciben el token de la base» sí es cierto siempre, y eso sí se puede asertar.

---

## MUTACIONES

**Tres declaradas al meta-guard**, las tres sobre el FUENTE que los censos leen:

| # | qué imita | cae |
|---|---|---|
| ① | vuelve el `create` a pelo al sembrador | el guard del sembrador |
| ② | el alta REAL deja de poner el token | el censo de altas |
| ③ | nace una lectura directa NUEVA en un fichero no declarado | el censo que decide |

② importa por sí sola: sin ella, el «éstas no lo ponen» del censo de altas no se distinguiría de
«no sé leer el `data`».

---

## 🔴 UNA ATRIBUCIÓN MÍA QUE ERA FALSA, Y CÓMO SE CAYÓ

Corrí la tanda gateada mientras el meta-guard mutaba el árbol en segundo plano y me salieron
**cuatro rojos**. Los atribuí a esa colisión —la lección de SCRUM-182, *la tanda gateada exige el
árbol quieto*— y **me equivoqué**. Esperé a que el meta-guard terminara, volví a medir con el
árbol quieto, y **salieron los mismos cuatro rojos**.

La causa real, medida:

```
node --test --test-force-exit tests/scrum767-portal-token.test.mjs   → cancelled 5
    'Promise resolution is still pending but the event loop has already resolved'
node --test                   tests/scrum767-portal-token.test.mjs   → pass 9, fail 0
```

Con censos (rápidos, sin base) y gateados (lentos, con base) **en el MISMO fichero**,
`--test-force-exit` —que es como corre `npm test`— cancelaba los cuatro gateados. Separados en dos
ficheros, los dos pasan con la bandera puesta.

Y el reparto no lo inventé: **es el que SCRUM-592 ya tenía** (`scrum592-numeracion-doc02` sin base,
`scrum592-concurrencia-serie` gateado). Lo que faltaba era saber POR QUÉ, y ahora está escrito en
la cabecera del fichero gateado.

**La colisión con el meta-guard fue real y no debí correr encima de ella** — pero no era la causa,
y decirlo importa: una atribución cómoda habría cerrado la investigación en falso y el defecto
habría viajado hasta la primera vez que alguien corriera `npm run test:staging:gated`.

Y antes, una sonda me falló con `Environment variable not found: DATABASE_URL`: había importado
`customerAdmin` **antes** de poner el doble en `global.prisma`. El módulo usa el singleton de
`core/db/prisma`, que resuelve `DATABASE_URL` — una variable que **en este árbol no existe** (sólo
`_DEV`, `_STAGING`, `_TESTS`). El orden importa, y queda escrito en el test.

---

## HUECOS DECLARADOS

- ⛔ **Cero consultas a staging o producción.** Todo es `yaqu_dev_javier`, con guard por destino.
- 🔴 **La carrera de `ensurePortalToken` queda SIN ARREGLAR**, con su diff preparado arriba.
- 🔴 **Los dos caminos de producción que crean clientes sin token quedan SIN ARREGLAR**, declarados
  en el censo. Un tercero haría caer el test.
- **La asimetría de las dos pantallas queda SIN ARREGLAR.** El arreglo natural —que la ficha 360
  llame a `/portal-url` como hace la lista— es de pantalla; el otro —que `GET /:id/detail` cure—
  convertiría una lectura en una escritura, y el árbol ya tiene una ruta aparte para eso.
- **Los 11 clientes que HOY están sin token en dev no se han curado.** El sembrador arreglado sólo
  afecta a los que nazcan a partir de ahora; los existentes se curan al pulsar «Portal» desde la
  lista, con el riesgo de carrera descrito.
- **El sembrador no se ha ejecutado** (ver arriba).
- **No se ha medido si `charges.routes.ts:24` crea el cliente sin `merchantId`** — se vio de paso
  y no es un campo derivado, así que no entra en este censo. Se dice por si a alguien le sirve.

---

## TANDA

**5.683 tests · 5.587 pass · 0 fail · 96 skipped · estado 0**, sobre el árbol ya mezclado con
`main` (`ff4e1c4a`, 2026-09-06T13:27:43+01:00).

Los 96 saltados declaran su motivo y **suman**: 84 `QA_DB_TEST` (80 de antes + **los 4 de este
ticket**) + 9 `LIBRO_PG_URL` + 1 `BOT_SUITE_TEST` + 1 `A55_DB_TEST` + 1 que no puede crear un
enlace a fichero en Windows sin elevación.

Los cuatro gateados **sí se han ejecutado**, contra dev y aparte: **4/4 en verde, con
`--test-force-exit` puesto** — que es la comprobación que este ticket tuvo que aprender a hacer.

`npm run meta:mutaciones` — **tres pasadas**: **vivas 75 · mudas 0 · ciegas 0**, idénticas, con
las tres de este ticket dentro.
