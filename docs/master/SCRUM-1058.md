# SCRUM-1058 · Fusionar clientes que YA TIENEN facturas emitidas — diseño, sin código

**Medido contra:** `origin/main` = `62176956c35ea69eca18ba38567656965907bcf0` · 2026-09-23T08:05:31Z

**Gate:** diseño puro. Cero líneas de `src/`. **No se construye sin el GO de J1** (el ticket lo
pide literal: «diseño con J1»). Leer el camino de emisión no es STOP (regla 38); este expediente
no lo modifica, solo lo lee.

---

## PASO 0 — qué existía ya antes de diseñar nada

Barrido por PALABRA (`fusion`, `congela`), no por número de ticket. `fusionClientes.ts`
(SCRUM-1057, PR #1674, mergeado ayer) ya existe y **ya decide** el caso de este ticket: si
`principalId` o `fusionadoId` tiene alguna fila en `Invoice`, `decidirRechazoFusion` devuelve
`'factura_emitida'` y la fusión **no toca la base en absoluto** — ni reasigna, ni deja huérfano,
lo **impide** antes de abrir la transacción. Este ticket es exactamente el que SCRUM-1057 declaró
fuera («el ticket de J1 sobre clientes CON facturas emitidas: sigue bloqueado, tal como pide el
ticket»). El alcance del encargo es el que dice el orquestador: no hay nada que rehacer, hay que
diseñar el caso que falta.

---

## 1 · Qué congela el emisor congelado, del lado del CLIENTE

`src/modules/invoicing/domain/clienteCongelado.ts` (SCRUM-729) + el escritor único
`crearFacturaEmitida.ts` (el único `invoice.create` del árbol, vigilado por el censo del embudo,
`tests/_embudo-factura.mjs`, cero excepciones).

- **Viajan a la factura, en el MISMO `INSERT`, cinco columnas** (`Invoice.customerName`,
  `customerLegalName`, `customerTaxId`, `customerEmail`, `customerPhone`), leídas de la ficha
  **antes** de abrir la `$transaction` de numeración. `Invoice.customerId` (la FK) **no es una de
  las cinco**: sigue siendo el enlace vivo a `Customer`.
- **Regla de lectura, en `clienteDelDocumento` — el único lector, usado por los 4 sitios que
  reconstruyen un documento emitido (2 PDF, regeneración de admin, XML AEAT):**
  - `customerName` presente (no NULL) → se usan las cinco columnas de la factura. La ficha viva
    de `Customer` **no se toca ni se lee** para ese documento.
  - `customerName` a NULL → factura **anterior al escritor** (emitida antes del 8-sep-2026,
    fecha del ALTER aplicado y verificado en las tres bases) → cae al **fallback**: lee la ficha
    viva vía la relación `customer` (o sea, exactamente lo que apunte `customerId` HOY).
- Ese fallback es un **conjunto cerrado y declarado que no crece** («son exactamente los
  documentos que ya existían el día del despliegue» — comentario del propio fichero). Es la pieza
  que importa para el diseño de abajo: no es un caso raro, es la mitad del contrato de lectura.
- La huella VeriFactu (`computeVeriFactuHash`, `verifactu.service.ts:92`) es una lista **cerrada
  de 8 campos** — `nif` (del **emisor**, no del cliente), `serie`, `fecha`, `tipoFactura`,
  `cuotaTotal`, `importeTotal`, `prevHash`, `timestamp`. **Ninguno depende del cliente ni de
  `customerId`.** Confirmado por grep: `customerId` no aparece ni una vez en
  `verifactu.service.ts`. El sello no se rompe nunca por tocar el lado cliente.
- El número de factura es único **por merchant** (`@@unique([merchantId, number])`,
  `schema.prisma:925`), no por cliente. La serie no puede colisionar al fusionar dos clientes del
  mismo merchant.

## 2 · Qué hace HOY la fusión de SCRUM-1057 con los documentos del absorbido

Medido en el código real (`fusionClientes.ts`, `decidirRechazoFusion` + `fusionarClientes`), no
razonado:

- `previsualizarFusion` y `fusionarClientes` calculan **el mismo** `facturasEmitidas =
  prisma.invoice.count({ where: { customerId: { in: [principalId, fusionadoId] } } })` antes de
  tocar nada.
- Si `facturasEmitidas > 0`, `decidirRechazoFusion` devuelve `'factura_emitida'`:
  `previsualizarFusion` responde `bloqueada: 'factura_emitida'` sin contar nada más;
  `fusionarClientes` **lanza** antes de abrir la `$transaction`. Cero escrituras.
- Si `facturasEmitidas === 0`, fusiona 9 tablas (`Quote`, `Job`, `CustomerEvent`, `Charge`,
  `QuoteRequest`, `ParteTrabajo`, `WhatsAppMessage`, `EmailMessage` vía
  `reasignarClienteEnFusion`, `MaintenancePlan`) y borra el fusionado con `desvincularYBorrar`.
  **`Invoice` no está en esa lista**: hoy no existe código que reasigne ni que deje huérfano un
  `Invoice.customerId`, porque el camino que llegaría ahí está cortado antes.
- Consecuencia estructural, no del ticket: `deleteCustomer` (borrado individual, no fusión)
  **tampoco comprueba facturas** — si se llamara sobre un cliente con `Invoice`, Postgres
  rechazaría el `DELETE` por la FK real (`Invoice.customerId → customers`, sin `onDelete`
  declarado). Es una asimetría con `fusionarClientes` (que SÍ comprueba antes), no un defecto de
  este ticket — se deja **declarada**, no se toca (fuera de mi carril tocar `deleteCustomer` sin
  encargo).

## 3 · Qué rompería si se fusionan dos clientes con facturas — medido, no cada punto por igual

- **La serie**: nada. No es un recurso por cliente (§1). Descartado como riesgo.
- **El nombre que ya viajó en un PDF sellado**: depende de si esa factura tiene las cinco
  columnas rellenas o a NULL — no es uniforme:
  - Factura **con congelado** (emitida desde el 8-sep-2026): **nada**. `clienteDelDocumento`
    nunca mira `customerId` para estas; da igual a qué `Customer` apunte la FK, el PDF y el XML
    siguen leyendo las cinco columnas propias de la fila `Invoice`.
  - Factura **sin congelar** (anterior al 8-sep-2026, `customerName` a NULL): **si se reasigna
    `Invoice.customerId` al principal sin más** (el mismo patrón que usa hoy `fusionarClientes`
    para `Quote`/`Job`), la próxima regeneración (el disco de Railway es efímero — medido y
    demostrado corriendo en SCRUM-729 §1, es la vía real por la que esto muerde) leería la ficha
    del **principal**, que es una persona distinta de quien de verdad recibió esa factura. No es
    una hipótesis: es la misma lectura `!doc.customerName → usa viva` de `clienteDelDocumento`,
    aplicada a un `customerId` que ya no apunta a quien fue facturado. Esto es el defecto que
    SCRUM-729 declaró como «deuda vieja» hecho **inevitable** en vez de «posible si alguien edita
    la ficha»: un merge cambia la identidad detrás de la FK con certeza, una edición de ficha solo
    la cambiaba si alguien tocaba ese cliente concreto.
  - No puedo contar cuántas facturas de qué entorno caen en el bucket sin congelar (esta máquina
    no tiene Postgres, `TRAMOS_PG_URL`/`LIBRO_PG_URL` no corren aquí — declarado como SUELO, no
    silenciado). Lo que sí está medido es el borde: **todo lo emitido antes del 8-sep-2026** es
    candidato, por fecha del ALTER de SCRUM-729.
- **El enlace desde la factura a la ficha** (`Invoice.customerId`): hoy NO se toca porque la
  fusión con facturas está bloqueada entera. Si se desbloquea, este enlace **tiene que**
  reasignarse al principal — no es opcional: 28 ficheros leen `Invoice` por `customerId` para
  cosas que SÍ tienen que reflejar la fusión («qué debe cada cliente», recordatorios, el portal,
  exports, métricas, búsqueda — `reports.routes.ts`, `invoiceReminder.service.ts`,
  `customerPortal.routes.ts`, `cobros.service.ts`, `exportData.ts`, `metrics.service.ts`,
  `search.routes.ts`, entre otros). Y además: si el fusionado se borra (como hace
  `desvincularYBorrar` hoy con el resto de tablas) SIN reasignar antes su `Invoice.customerId`,
  Postgres **rechaza el propio `DELETE`** por la FK real — la transacción entera falla, no un
  huérfano silencioso. O se reasigna, o no se puede borrar al fusionado con sus facturas debajo.

## 4 · Diseño propuesto

### Opción A (recomendada) — permitir la fusión SOLO cuando ninguna factura del par está «sin congelar»

Cambiar el motivo de bloqueo de «tiene alguna factura» a «tiene alguna factura **sin las cinco
columnas rellenas**»:

```
facturasSinCongelar = prisma.invoice.count({
  where: { merchantId, customerId: { in: [principalId, fusionadoId] }, customerName: null },
})
```

- `facturasSinCongelar > 0` → nuevo motivo `'factura_sin_congelar'` (o nombre que decida J1),
  mismo patrón que `'factura_emitida'` hoy: corta antes de abrir la transacción, cero
  escrituras.
- `facturasSinCongelar === 0` (todas las facturas del par ya tienen las cinco columnas, aunque
  `facturasEmitidas > 0`) → se permite. `fusionarClientes` añade una décima reasignación,
  simétrica a las otras nueve: `tx.invoice.updateMany({ where: { merchantId, customerId:
  fusionadoId }, data: { customerId: principalId } })`. No escribe ninguna de las cinco columnas
  congeladas — esas no cambian nunca, es exactamente lo que las hace seguras de reasignar.
- **Por qué esta y no una comprobación más simple**: no toca `crearFacturaEmitida.ts` ni el
  escritor del sello, no añade una escritura nueva a un documento emitido (regla 29 intacta: el
  `UPDATE` de `customerId` no es uno de los 8 campos de la huella ni de las 5 congeladas), y usa
  el mismo mecanismo de rechazo que SCRUM-1057 ya dejó armado. El coste es que dos clientes con
  facturas viejas (pre-8-sep-2026) siguen sin poder fusionarse — un límite **declarado**, no un
  agujero.

### Opción B — igual que A, pero además backfillea las facturas sin congelar antes de reasignar

Dentro de la misma transacción de `fusionarClientes`, para cada `Invoice` del fusionado con
`customerName IS NULL`: llamar a `congelarDesdeFicha(fichaDelFusionado)` (función que **ya
existe**, `clienteCongelado.ts`, hoy solo se llama al emitir) y escribir las cinco columnas con la
ficha del fusionado **tal como estaba justo antes del borrado** — no con la ficha del principal,
no con «la de hoy» de nadie ajeno a esa factura. Eso convierte el bucket "sin congelar" del §3 en
población que SÍ se puede fusionar, en vez de dejarla bloqueada para siempre.

- Preserva regla 29 en el mismo sentido que SCRUM-729: la factura sigue mostrando a quien de
  verdad se facturó, ahora fijado en vez de leído en vivo — es *terminar* el backfill que
  `clienteCongelado.ts` declaró explícitamente que NO hace («NO rellena hacia atrás»), pero ahí la
  prohibición es sobre rellenar con la ficha de HOY de un cliente cualquiera para que «case»; aquí
  el dato que se escribe es el mismo que ya estaba en la fila `Customer` que se va a borrar,
  leído en el instante exacto antes de perderse — no se inventa nada nuevo, se salva lo que ya
  existía y que la fusión iba a hacer irrecuperable.
- Es la opción que de verdad **cierra** el ticket (fusiona cualquier par, no solo el que ya tenía
  suerte de nacer después del 8-sep). El coste es que SÍ escribe en filas `Invoice` ya emitidas
  (aunque solo las que hoy están a NULL, nunca las que ya tienen congelado) — por eso es la que
  más necesita el ojo de J1: es el módulo fiscal decidiendo si «backfill con el dato correcto,
  solo en el instante del borrado» cruza o no la línea de regla 29 tal como la interpreta el
  carril fiscal, no una lectura mía.

### Opción C — no borrar al fusionado, "fusión blanda" con puntero (`mergedIntoId`)

En vez de `desvincularYBorrar`, marcar `Customer.mergedIntoId = principalId` (columna nueva,
ALTER) y dejar la fila del fusionado viva pero oculta de las listas activas. `Invoice.customerId`
nunca se toca — el fallback de `clienteDelDocumento` sigue leyendo la ficha del fusionado, intacta
para siempre, sin backfill ni reasignación.

- Es la más conservadora con el camino de emisión: cero escrituras a `Invoice`, ninguna.
- Pero es la de mayor alcance de ingeniería para el tamaño real del problema: ALTER nuevo (ciclo
  de la regla 3: decisión → ALTER aditivo en las tres bases → PR), y **todo** lector de `Customer`
  que hoy asume "una fila = un cliente activo" (los 53 ficheros del grep de §1, no solo
  invoicing) necesitaría saber resolver el puntero o filtrar `mergedIntoId IS NULL` — el portal,
  las búsquedas, "qué debe cada cliente", los recordatorios. Convierte un ticket de fusión en un
  rediseño del modelo de `Customer`. La descarto como recomendación por desproporción coste/
  población, no por incorrecta.

### Recomendación

**Opción A ahora** (desbloquea el caso común — cualquier duplicado con solo facturas posteriores
al 8-sep-2026 — sin tocar el módulo fiscal más que con una lectura de `count`), **Opción B como
seguimiento explícito** una vez J1 confirme si el backfill-en-el-borrado descrito arriba es
aceptable bajo regla 29. Opción C solo si J1 considera que A/B no son suficientes por algún motivo
fiscal que no vea desde este carril — no la construiría sin que ese motivo se diga primero.

## Declarado, sin arreglar aquí

- `deleteCustomer` (borrado individual) no comprueba facturas antes de intentar el `DELETE` — hoy
  lo salva la FK real de Postgres lanzando error sin caso especial; no es defecto de este ticket,
  se reporta aparte si J2 lo retoma.
- El texto de la pantalla (aviso de "no se puede fusionar: facturas sin congelar", o el nuevo
  motivo en el selector de S2) no se propone aquí — depende de qué opción apruebe J1.
- Recuento real de facturas "sin congelar" en cualquier entorno: no medible desde esta máquina
  (sin Postgres). Quien lo mida, que lo haga contra staging con el turno, no a ojo.
