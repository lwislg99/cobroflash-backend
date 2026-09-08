# SCRUM-793 · La carrera del token del portal — cerrada por el `WHERE`

**Fecha:** 6-sep-2026 · **Carril:** producto · backend clientes · **Gate:** la carrera con `QA_DB_TEST=1`; el trinquete en `npm test`

**Medido contra:** `origin/main` = `95be56e4dd523b45d3046bda8cf09578ff953ab8` · 2026-09-06T21:26:35+01:00

---

## LA VÍCTIMA

El profesional abre la ficha de su cliente, copia el enlace del portal y se lo manda por WhatsApp.
**El enlace no abre.** No hay error, no hay aviso: hay un enlace muerto. Y es el momento exacto en
que el cliente decide si firma.

`GET /cliente/:token` busca `where: { portalToken }`. Si el token que le dieron al profesional no
es el que quedó guardado, no encuentra nada. Eso es todo lo que ve el cliente: una página que no
existe.

---

## 🔴 EL ROJO, REPRODUCIDO ANTES DE TOCAR NADA

Contra `yaqu_dev_javier`, con guard por destino:

```
═══ 🔴 EL QUE DECIDE · DOS A LA VEZ sobre un cliente SIN token ═══
  pasada 1: ¿los dos iguales? SÍ  · entregados que NO están en la base: 0
  pasada 2: ¿los dos iguales? 🔴 NO · entregados que NO están en la base: 1
  pasada 3: ¿los dos iguales? 🔴 NO · entregados que NO están en la base: 1
  pasada 4: ¿los dos iguales? 🔴 NO · entregados que NO están en la base: 1
  pasada 5: ¿los dos iguales? 🔴 NO · entregados que NO están en la base: 1
  → pasadas con al menos un enlace MUERTO: 4 de 5

═══ 🔴 DIEZ A LA VEZ ═══
  pasada 1:  2 token(s) DISTINTO(S) de 10 ·  1 de 10 muertos
  pasada 2: 10 token(s) DISTINTO(S) de 10 ·  9 de 10 muertos
  pasada 3:  9 token(s) DISTINTO(S) de 10 ·  9 de 10 muertos
  → pasadas con carrera visible: 3 de 3
```

---

## EL ARREGLO · la condición vive en el `WHERE`, no en un `if`

```diff
-  const customer = await prisma.customer.findFirst({ where: { id: customerId, merchantId } });
+  const customer = await prisma.customer.findFirst({
+    where: { id: customerId, merchantId }, select: { portalToken: true },
+  });
   if (!customer) throw new Error('customer_not_found');
   if (customer.portalToken) return customer.portalToken;
   const token = generatePortalToken();
-  await prisma.customer.update({ where: { id: customerId }, data: { portalToken: token } });
-  return token;
+  const escrito = await prisma.customer.updateMany({
+    where: { id: customerId, merchantId, portalToken: null },
+    data: { portalToken: token },
+  });
+  if (escrito.count === 1) return token;
+  const yaPuesto = await prisma.customer.findFirst({
+    where: { id: customerId, merchantId }, select: { portalToken: true },
+  });
+  if (!yaPuesto?.portalToken) throw new Error('customer_not_found');
+  return yaPuesto.portalToken;
```

**Por qué esto cierra la carrera y no la hace más pequeña:** `portalToken: null` dentro del
`WHERE` convierte la comprobación en parte de la MISMA sentencia que escribe. En READ COMMITTED la
segunda `UPDATE` se bloquea sobre la fila que la primera tiene tomada y, al confirmar aquélla,
**vuelve a evaluar su `WHERE`**: ya no hay `null`, casa 0 filas y no pisa nada. El motor serializa
lo que un `if` no puede.

Y por eso se mira el `count`: si casó 1, el token de la base es el nuestro. Si casó 0, la ganó
otro y **se devuelve el suyo, releído** — nunca el que este hilo generó y no está guardado.

**Tres detalles medidos, no supuestos:**

- **El `if` de arriba se queda**, y no contradice nada: es un atajo de LECTURA sobre un valor ya
  confirmado, y es seguro porque **un token no nulo no lo sobrescribe nadie**. Medido:
  `portalToken` **no existe en los esquemas zod**, así que `updateCustomer` no puede tocarlo, y los
  únicos dos escritores del árbol son `createCustomer` (al nacer) y esta función (sólo si `null`).
- **`updateMany` y no `update`**: `update` exige clave única y **no admite más condiciones** en su
  `where`. Con él, la comprobación vuelve al `if`.
- **De paso, la escritura pasa a filtrar por `merchantId`** (regla 2). Antes sólo filtraba la
  lectura. Hay un test que lo comprueba por el efecto.

⛔ **`prisma/schema.prisma` NO se toca**: `portalToken` ya es `String? @unique`. Verificado que el
diff del schema está vacío.

---

## ✅ EL MISMO EXPERIMENTO, DESPUÉS — mismo script, sin tocar una línea

```
═══ 🔴 EL QUE DECIDE · DOS A LA VEZ sobre un cliente SIN token ═══
  pasada 1..5: ¿los dos iguales? SÍ · entregados que NO están en la base: 0
  → pasadas con al menos un enlace MUERTO: 0 de 5

═══ 🔴 DIEZ A LA VEZ ═══
  pasada 1..3: 1 token(s) DISTINTO(S) de 10 · 0 de 10 muertos
  → pasadas con carrera visible: 0 de 3

═══ ✅ CONTROL POSITIVO · a quien YA tiene token, no se le mueve ═══
  tras DIEZ curaciones → ¿intacto? SÍ · ¿las diez devolvieron ese mismo? SÍ

═══ ✅ CONTROL NEGATIVO · editar el nombre NO mueve el token ═══
  ¿intacto? SÍ
```

| | antes | después |
|---|---|---|
| DOS a la vez · pasadas con enlace muerto | **4 de 5** | **0 de 5** |
| DIEZ a la vez · pasadas con carrera | **3 de 3** | **0 de 3** |
| DIEZ a la vez · tokens distintos | hasta **10** | **1**, siempre |
| ✅ quien ya tiene token | intacto | intacto |
| ✅ editar el nombre | intacto | intacto |

---

## EL GUARD DETERMINISTA QUE AYER NO SE PUDO ESCRIBIR

SCRUM-767 dejó escrito por qué no lo asertaba: *«una de las cinco pasadas no llegó a entrelazarse,
y un test intermitente no es un guard: es ruido que un día alguien apaga porque falla solo. El
guard determinista nace el día que se arregle.»* **Hoy es ese día**, y ya es determinista:

```
ok - 🔴 EL QUE DECIDE: DIEZ curaciones a la vez → UN token, y está en la base
ok - 🔴 y DOS a la vez tampoco: el caso del encargo
ok - ✅ CONTROL POSITIVO: a quien YA tiene token no se le mueve
ok - ✅ CONTROL NEGATIVO: editar el nombre sigue sin mover el token
ok - un cliente que no es de este merchant no se cura (regla 2)
ok - SUELO: el cliente del experimento NACE sin token
# tests 6 · pass 6 · fail 0 · exit 0
```

Las rondas (3 con diez, 5 con dos) **no son para darle oportunidades**: son porque con el defecto
puesto una ronda sola habría pasado en verde una de cada cinco veces.

**Y se ha visto CAER.** Con el defecto de ayer reinyectado, recompilando y verificando `sha256` de
fuente **y** de `dist`:

```
CON EL DEFECTO DE AYER PUESTO (update incondicional, condición en un `if` de JS):
  ROJOS (2):
    ✖ 🔴 EL QUE DECIDE: DIEZ curaciones a la vez → UN token, y está en la base
    ✖ 🔴 y DOS a la vez tampoco: el caso del encargo
  restaurado: fuente BYTES OK · dist BYTES OK
```

Los dos controles NO cayeron con esa mutación, y es correcto: esas propiedades también se cumplían
antes. Que cada mutación tumbe lo suyo es la señal de que los tests miden cosas distintas.

### Y un trinquete por AST, porque el rojo de la carrera es caro

El guard de arriba necesita Postgres. La FORMA del arreglo se vigila sin base, sobre el fuente:
que la escritura sea `updateMany`, que su `where` lleve `portalToken: null` y `merchantId`, y que
se consulte el `count` en vez de devolver a ciegas el token propio. Un refactor de aspecto
inocente —«esto se lee mejor con un `update`»— devolvería la carrera entera, y el rojo de la
carrera es intermitente: 4 de cada 5, no 5 de 5.

---

## 🔴 UN PUNTO CIEGO MÍO, DESTAPADO POR MI PROPIO ARREGLO

El censo de SCRUM-767 (mío, de ayer) empezó a fallar con el arreglo puesto, acusando a
`ensurePortalToken` de **leer el token sin curarlo** — en sus propias líneas.

La causa: su `funcionEnvolvente` devolvía el nombre de la primera `VariableDeclaration` que
encontrara subiendo, **antes** de llegar a la función. Mientras la cura no asignaba nada a una
variable, funcionaba de casualidad. En cuanto pasó a hacer `const customer = await
prisma.customer.findFirst({ select: { portalToken: true } })`, sus propias lecturas salían
clasificadas como «lectura directa».

⚠️ **No se arregló bajándole el listón** ni metiendo mi fichero en la lista de declaradas — eso
sería enseñarle al analizador a no verme. Se arregló haciéndolo **preciso**: lo que se busca es la
FUNCIÓN que envuelve, y una `const` no es una función; una `const` que SÍ es una función (arrow o
`function` expression) sigue contando, que es para lo que estaba.

**Y sigue viendo lo que tenía que ver:** la lectura directa de `customersAdmin.routes.ts` sigue
saliendo, y su mutación ③ sigue tumbándolo (meta-guard en verde con las tres de 767 vivas).

---

## LOS QUE SIGUEN SIN TOKEN — declarado, NO curado

Medido hoy sobre dev, **sólo lectura**:

```
CLIENTES en dev : 16
SIN portalToken : 14 (88 %)
  merchant    1 → 7   ← el DEMO
  merchant    2 → 1
  merchant  114 → 1
  merchant  173 → 1
  merchant  210 → 1
  merchant  964 → 1
  merchant  965 → 1
  merchant 1002 → 1
```

🔴 **Este arreglo NO los cura, y no debe.** Lo que arregla es que la curación deje de entregar
enlaces muertos; los 14 siguen sin token hasta que alguien pulse «Portal» —y ahora esa pulsación
es segura, tantas veces y tan simultánea como sea—.

**Curarlos exige un paso aparte que muta datos, y una sesión no enciende eso.** Queda declarado
como propuesta: un backfill que llame a `ensurePortalToken` por cada cliente sin token, idempotente
por construcción (el `WHERE` ya lo hace), a decidir por el fundador.

⚠️ Y la cifra **ha subido desde ayer**: 11 de 14 → 14 de 16. Los tres nuevos son de otra sesión
(`SCRUM-762 medición`, merchants 964/965/1002) y **no se han tocado**. Pero la tendencia es el
dato: mientras los dos caminos de producción sigan creando clientes sin token, la lista crece.
**Esos dos caminos son de otro ticket y aquí no se han abierto** (SCRUM-774).

**Mi propia basura de QA está limpia**: 0 merchants y 0 clientes con prefijo `QA-793`, `QA-767` o
`QA-781`.

---

## MUTACIONES

**Tres declaradas al meta-guard**, las tres deshacen el arreglo por una vía distinta:

| # | qué imita | cae |
|---|---|---|
| ① | vuelve el `update` incondicional | el trinquete del `where` |
| ② | la condición se sale del `where` (sigue habiendo `updateMany`, y se lee bien) | el trinquete del `where` |
| ③ | se deja de mirar el `count`: se devuelve siempre el token propio | el de «no se devuelve a ciegas» |

② es la más peligrosa de las tres: el código sigue usando `updateMany` y **parece correcto**.

`npm run meta:mutaciones` — **tres pasadas**: **vivas 84 · mudas 0 · ciegas 0 · ficheros muertos
0**, idénticas.

---

## HUECOS DECLARADOS

- ⛔ **Cero consultas a staging o producción.** Todo `yaqu_dev_javier`, con guard por destino.
- **Los 14 clientes sin token NO se han curado** (arriba, con su propuesta).
- ⛔ **No se ha tocado `botFlow.service.ts` ni `charges.routes.ts`** — los dos caminos de
  producción que crean clientes sin token. Son de otro ticket y los mide otra sesión.
- ⛔ **No se ha tocado la ficha 360 ni la lista de Clientes**, ni `prisma/schema.prisma`.
- **La carrera se ha provocado con 2 y con 10 llamadas simultáneas contra un Postgres remoto**
  (RTT ~190 ms). Con una base colocada al lado la ventana de la carrera es más estrecha, así que el
  defecto habría sido **más difícil de ver** — no menos real. No se ha medido con otra latencia.
- **No se ha medido el coste añadido** del `updateMany` + relectura. En el camino normal son las
  mismas dos idas y vueltas que antes (la relectura sólo ocurre cuando se pierde la carrera); no se
  ha cronometrado.

---

## TANDA

**5.702 tests · 5.600 pass · 0 fail · 102 skipped · estado 0**, sobre el árbol ya mezclado con
`main` (`95be56e4`, que trajo **SCRUM-767 mergeada**).

Los 102 saltados declaran su motivo y **suman**: 90 `QA_DB_TEST` + 9 `LIBRO_PG_URL` +
1 `BOT_SUITE_TEST` + 1 `A55_DB_TEST` + 1 que no puede crear un enlace a fichero en Windows sin
elevación. **10 de los tests son de este ticket** (4 sin gate, 6 gateados).

Los seis gateados **sí se han ejecutado**, contra dev y aparte: **6/6 en verde, con
`--test-force-exit` puesto**.

Y los cuatro gateados de SCRUM-767 —que vinieron en el merge— **siguen en verde con el arreglo**:
lo que afirmaban era cierto antes y sigue siéndolo ahora. Su cabecera se ha actualizado para que
no siga describiendo un defecto que ya no existe.

`npm run meta:mutaciones` — **tres pasadas sobre el árbol final**: **vivas 90 · mudas 0 · ciegas 0
· ficheros muertos 0**, idénticas.
