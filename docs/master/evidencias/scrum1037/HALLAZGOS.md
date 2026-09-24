# SCRUM-1037 · los cuatro fallos de cifras de Contabilidad, medidos y leídos

**22-sep-2026 · medido/leído sobre `origin/main` `e2f715939d0e27ca2661821e1b57292d4ec1c3cc`.**

Alcance de esta tarea (S0, medición): confirmar si cada punto OCURRE hoy, con evidencia. Regla 38/
STOP: el camino de emisión fiscal se LEE, no se modifica; los puntos que lo tocan (b, c) no se
instrumentan con documentos reales — se documentan por código y, en (a), con una comprobación viva
que no mutó ningún dato fiscal del merchant compartido de QA.

## a. El selector de retención del perfil no se guarda

**OCURRE 🔴 — y es DOBLE, más grave que lo que dedujo el ticket.**

1. **Lectura viva** (parte del `GET /admin/merchant` ya capturado para SCRUM-1031, mismo merchant QA
   Staging, mismo comando): la respuesta **no incluye `retencionIrpfDeclarada` ni `retencionIrpfTipo`
   en absoluto**, ni siquiera como `false`/`null`. Causa, por código:
   `src/modules/system/merchantAdmin.ts` → `getMerchantProfile()` usa un `select` EXPLÍCITO
   (comentario propio, línea ~106: «lo que no esté aquí NO SALE, aunque esté en la columna») que
   termina en `flags: true` sin declarar los dos campos de retención.
   Consecuencia: `settingsView.js:851-853` lee `merchant.retencionIrpfDeclarada` de esa respuesta →
   siempre `undefined` → el selector SIEMPRE pinta «no consta», **aunque el valor real en BD sea
   otro**. Esto es más grave que «no se guarda»: la pantalla no puede ni mostrar lo que ya hay.
2. **Escritura, por código** (no ejecutada contra el merchant compartido de QA para no mutar su
   perfil fiscal mientras otras sesiones lo usan): `src/app.ts:713` valida `PUT /admin/merchant` con
   `merchantProfileUpdateSchema` (`src/core/validation/schemas.ts:423-506`). Esa unión Zod **no
   declara `retencionIrpfDeclarada` ni `retencionIrpfTipo`** en ninguna línea (grep sobre el fichero:
   cero coincidencias fuera del propio helper de la 293③a en `app.ts`). Un `z.object()` sin
   `.passthrough()` DESCARTA claves no declaradas antes de que `updateMerchantProfile` las vea — el
   mismo patrón de silencio que el propio schema documenta y evita para `criterioCaja` (línea 449)
   y no aplicó aquí.

   Las columnas SÍ existen (`prisma/schema.prisma:168-169`, `@default(false)` y `Int?`), y el lado
   LECTURA de otro endpoint (`app.ts:483-497`, un bootstrap distinto de `/admin/merchant`, con un
   `merchantFull` sin `select` recortado) sí las expone — confirma que es un fallo de ALCANCE en dos
   sitios concretos, no un campo inexistente.

## b. `JUST` entra en el libro de registro y en el IVA repercutido

**OCURRE en el generador del libro (código), con un matiz importante que el ticket original no
tenía porque se dedujo de un commit más viejo.**

- `src/modules/invoicing/domain/libroRegistro.ts` (el que decide QUÉ es un asiento) captura
  `type` (línea 39) y lo expone como `tipo` en cada asiento (línea 53), pero **no filtra por él en
  ningún punto** (grep sobre el fichero: cero comparaciones `type ===`). `libroRegistro.repo.ts`
  tampoco filtra por `type` en su `where` (líneas 94-121: solo `merchantId` y fecha). Si una factura
  `JUST` (justificante, fuera de toda serie fiscal — `tipoDocumento.ts:71`, `AEAT_POR_TIPO.JUST = null`)
  llega a la tabla `Invoice`, el libro la cuenta como un asiento normal, con su `base`/`cuota` (IVA).
- **Matiz que SÍ cambia el diagnóstico**: `SCRUM-1027` (recién mergeado — es el HEAD de `origin/main`
  en el momento de esta medición) cerró la vía más común para que esto ocurra: con
  `INVOICING_ES_ENABLED` OFF para un merchant español (regla 7/24), `POST /admin/quotes/:id/invoice`
  **ahora rechaza con 409 `facturacion_no_disponible` ANTES de crear ningún documento**
  (`quotesAdmin.routes.ts:207-209`, comentario propio: «con el interruptor en OFF, en España, no se
  emite NINGÚN documento»). Eso quita el camino que el ticket describía como más probable.
- **No verificado**: si existe OTRA vía viva que siga creando un `Invoice` de tipo `JUST` mientras el
  flag está OFF (hay más de 10 sitios que escriben `type: isReceiptNumber(...) ? 'JUST' : 'F1'`, p.
  ej. `quotes.routes.ts:758`, `jobs.routes.ts:1485`) — no se instrumentó crear una factura real en
  staging para no tocar el camino de emisión sin GO explícito (STOP de la Parte AA1.4). **Se pasa a
  J1 con esta evidencia**, como pide la propia aceptación del ticket para los puntos b y c.

## c. El criterio de caja usa `paidAt`, que no siempre es la fecha real del cobro

**Cierto hoy, pero YA NO es un descuido silencioso — está documentado, con advertencia que viaja
con el dato.** `src/modules/invoicing/domain/devengoPorCaja.ts` fija `CAMPO_COBRO = 'paidAt'`
(línea 33) y su comentario (líneas 23-27) dice explícitamente: «`paidAt` es el instante en que
**alguien marcó** el cobro, no siempre aquel en que entró el dinero […] Esa es la mejor fecha que
hay, y es la que se usa; lo que no se hace es fingir que es otra cosa». `criterioCaja.ts` exporta
`ADVERTENCIA_CAJA` y la adjunta a cada `ClasificacionCaja` (líneas 76-78, 113). El propio módulo se
autodescribe: «clasifica y avisa; no liquida» (línea 33 de ese fichero) — es decir, **no calcula
ningún 303 con esto todavía** (comentario final: «sin llamadores», igual que el recargo de
equivalencia).

Verdad del punto original: sí, `paidAt` sigue siendo la fecha que se usaría. Pero encuadrarlo como
«fallo sin avisar» ya no describe el código actual — es una limitación conocida y declarada, sin
consumidor todavía. Igual que (b), toca el camino de emisión/fiscal: **se pasa a J1 con esta
evidencia**, no se abre arreglo desde S0.

## d. Gastos antiguos sin `baseAmount` quedan fuera del libro de recibidas

**Ocurre tal cual lo describe el ticket, pero es DECISIÓN DE DISEÑO documentada, no un bug.**
`src/modules/invoicing/domain/libroRecibidas.ts` (líneas 28-50) explica la decisión con sus tres
alternativas descartadas: entrar con base 0 (afirmaría un hecho falso), entrar con `amount` como
base (inventaría un dato fiscal), o entrar con celdas vacías (parece un asiento cuando no lo es). La
exclusión **no es silenciosa**: el propio libro devuelve `sinClasificar`/`sinClasificarImporte` con
el recuento y el importe de lo excluido (línea 49, y la interfaz del libro en el mismo fichero),
igual que hace `libroRegistro.ts` con `sinNumero`/`sinNumeroImporte`.

No se abre ticket de arreglo: es el comportamiento pretendido desde SCRUM-403/A6, con su motivo
escrito. Si el negocio quiere otra cosa, eso es una propuesta de cambio de master (regla 30), no un
defecto.

## Resumen para el comentario de Jira

| # | Descripción | Veredicto |
|---|---|---|
| a | Selector de retención: no carga Y no guarda | **OCURRE 🔴** (doble: lectura y escritura) |
| b | `JUST` entra en el libro/IVA repercutido | **OCURRE en el generador** (código); SCRUM-1027 cierra la vía más común de creación; falta confirmar si queda otra vía viva — para J1 |
| c | Criterio de caja usa `paidAt` | **Cierto, pero documentado y sin consumidor (303) todavía** — para J1 |
| d | Gastos sin base fuera del libro | **Ocurre, pero es diseño deliberado y declarado (no silencioso)** — no es un bug |
