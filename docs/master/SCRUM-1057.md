# SCRUM-1057 · Fusionar dos clientes duplicados (los que no tienen facturas emitidas)

**Medido contra:** `origin/main` = `fc08703449d85b5ec4033f084dd813b8c2455f01` · 2026-09-22T10:12:11Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-1057-fusionar-clientes-duplicados`

## GO del fundador (operación destructiva)

Ticket con STOP explícito («datos de cliente: operación destructiva, GO del fundador»). El GO
llegó por el orquestador, citando al fundador: **«doy el GO para el 1057»** (22-sep-2026), con
instrucción explícita de seguir PASO 0, rojo primero, y tres casos (fusión limpia, cliente con
factura → rechazo, deshacer si aplica — no hay «deshacer»: la fusión es irreversible por diseño,
como toda fusión; se compensa con la transaccionalidad y el apunte en el historial).

## Depende de SCRUM-1031 — arreglado en ESTE PR (caso A)

El ticket depende de que `GET /admin/customers/duplicados` funcione. S0 midió en staging
(22-sep-2026) que **NO funcionaba**: el propio código afirmaba en un comentario que `/duplicados`
se registraba antes que `/:id`, pero el registro real era al revés — Express empareja por ORDEN
DE REGISTRO, no por especificidad, así que `/:id` capturaba `duplicados` como si fuera un id
(`Number('duplicados')` → `NaN` → `400 invalid_id`) y la ruta de duplicados nunca se ejecutaba.

**PASO 0**: reproducido HOY, corriendo (no leyendo) — invocando el router real compilado con
`router.handle`, sin servidor ni Postgres: `GET /duplicados` daba `400 {"error":"invalid_id"}`.
Arreglado moviendo el bloque de `/duplicados` antes de `/:id` en el fuente (el comentario ya lo
decía; el código no lo hacía). Verificado en rojo→verde con una mutación real (renombrar la ruta
temporalmente, confirmar que el test vuelve a caer, revertir). Test:
`tests/scrum1057-duplicados-antes-de-id.test.mjs` — corre en cada `npm test`, sin base (invoca el
router real con un request de mentira, dejando que EXPRESS decida qué capa gana, no el patrón de
la casa que busca la capa por ruta directamente — ese patrón no puede ver este bug).

## El censo de qué se mueve, y por qué son diez tablas y no tres

El ticket nombra «presupuestos, trabajos, notas, etiquetas». Medido contra el schema completo del
merchant `Customer`, hay OTRAS seis tablas con `customerId` que quedarían huérfanas si no se
mueven:

| con FK real (Postgres rechazaría el `DELETE`) | sin FK (el defecto sería MUDO) |
|---|---|
| Quote · Charge · QuoteRequest · CustomerEvent | Job · ParteTrabajo · WhatsAppMessage · EmailMessage · MaintenancePlan |

Las nueve se reasignan al principal dentro de la MISMA transacción. La décima —`Customer.companyId`
de OTROS clientes que apuntaran al fusionado como su empresa— se desvincula con
`desvincularYBorrar`, la MISMA función que ya usa `deleteCustomer`: no se inventa una segunda copia
de esa decisión.

## Por qué «ninguna factura emitida» no es solo una regla de negocio: es una FK

`Invoice.customerId` tiene clave ajena REAL a `customers`. Reasignarla sería tocar un documento YA
EMITIDO (regla 29, prohibido siempre) y, aparte, Postgres RECHAZARÍA el `DELETE` del cliente con
facturas por esa misma FK. Las dos razones señalan el mismo sitio: si cualquiera de los dos tiene
una factura, la fusión ni se intenta — `decidirRechazoFusion` corta antes de tocar la base.

## Lo que hace

- `src/modules/system/domain/fusionClientes.ts` (nuevo):
  - `previsualizarFusion(merchantId, principalId, fusionadoId)`: SOLO LECTURA (aceptación 2) —
    qué se conserva (el principal, tal cual) y qué se movería (conteos), sin escribir nada.
    Incluye `nifDistintos` (aviso, nunca bloqueo — el ticket lo pide explícito) y
    `etiquetasResultantes` (la unión, sin distinguir mayúsculas, tope 20×40 vía `tagsDelCliente.ts`,
    reutilizado, no reinventado).
  - `fusionarClientes(merchantId, principalId, fusionadoId)`: ejecuta. Transaccional (aceptación
    4): las nueve reasignaciones, la fusión de etiquetas, el apunte de historial y el borrado
    (vía `desvincularYBorrar`) caen juntos o no cae ninguno.
  - `decidirRechazoFusion` (interna, NO exportada — SCRUM-411: su único consumidor real ya está
    dentro de este fichero): `mismo_cliente` > `cliente_no_encontrado` > `factura_emitida`, en ese
    orden.
- Rutas en `customersAdmin.routes.ts`, las dos `requireRole('admin')` (SCRUM-55, sin motivo de
  campo, default admin-only — misma decisión que `/whatsapp` y `/notes`):
  - `GET /admin/customers/:id/fusion-preview?con=<id>` — la previsualización.
  - `POST /admin/customers/:id/fusionar` (`{ con }`) — la ejecución; `:id` es el PRINCIPAL.
    Rechazo → `409` con el motivo como código (regla 30, sin texto).

## El juez: dos ficheros nuevos + uno del arreglo de dependencia

- `tests/scrum1057-duplicados-antes-de-id.test.mjs` (2 tests, sin base) — el arreglo de SCRUM-1031
  caso A, con control negativo (`/:id` sigue alcanzable).
- `tests/scrum1057b-fusion-clientes-postgres.test.mjs` (4 tests, gateado, declarado en scrum419):
  fusión limpia con las nueve tablas + la empresa desvinculada + el apunte de historial + NIF
  distintos avisado + etiquetas fusionadas; factura emitida rechaza SIN TOCAR NADA; mismo-cliente
  rechaza; tenencia entre dos merchants. **No se pudo correr en esta sesión**: no hay un Postgres
  desechable montado en esta máquina/turno.

`npm run build` limpio. `guards:entrada` 112/112. `scrum55` (fail-closed, las 2 rutas nuevas
declaran rol), `scrum411` (huérfanos, `decidirRechazoFusion` no exportada), `scrum419` (el gateado
nuevo declarado), `scrum348`/`scrum289` (tenencia) en verde.

## Casos límite del ticket, y dónde quedan

- **Fusionar consigo mismo**: `mismo_cliente`, cubierto (gated).
- **NIF distintos**: `nifDistintos: true` en la previsualización y en el apunte de historial —
  aviso, nunca bloqueo. El texto de la pantalla lo pone S2.
- **Etiquetas que pasan de 20**: `normalizarTags`/`tagsParaPrisma` (reutilizados) recortan al tope.
- **Notas de ambos (se conservan las dos)**: al mover `CustomerEvent` del fusionado al principal,
  las notas de los DOS conviven en la misma línea de tiempo — no se pierde ninguna.
- **`portalToken` del fusionado**: se pierde con el borrado (no hay «deshacer» de un enlace ya
  enviado por WhatsApp/email; es una consecuencia aceptada de la fusión, no un defecto — un enlace
  viejo que deja de abrir es preferible a dos clientes con el mismo enlace).
- **Presupuestos ya aceptados o firmados**: `Quote` no congela nombre/NIF del cliente en columnas
  propias (a diferencia de `Invoice`) — «es una oferta viva», así que reasignar `customerId` los
  deja mostrando correctamente los datos del principal, sin romper nada firmado.

## CI en rojo tras el PR, y los dos arreglos (regla 41: se arregló el código, no el guard)

- **Ronda 1** (`8eb65d1f`): `fusionClientes.ts` reasignaba `email_messages.customerId` con
  `tx.emailMessage.updateMany(...)` directo, violando SCRUM-475/508 (`registroDeEnvios.ts` tiene
  que ser el ÚNICO fichero que escribe esa tabla). Arreglo: `reasignarClienteEnFusion(tx,
  merchantId, deId, aId)` nueva en `registroDeEnvios.ts`, con el mismo patrón que
  `desvincularYBorrar` (recibe el `tx` del llamador). `fusionClientes.ts` la llama en vez de tocar
  `tx.emailMessage` directo.
- **Ronda 2** (este commit): mover la escritura al fichero correcto no bastaba —
  `scrum508-los-cinco-dejan-fila.test.mjs` tiene un SEGUNDO aserto, más estricto, que fija el
  CONJUNTO EXACTO de operaciones (`['create', 'update']`): un envío y el aviso del proveedor,
  nada más. El `updateMany` de la ronda 1 añade una tercera operación legítima y el propio test
  la anticipa («si has añadido una tercera, dilo aquí con su motivo» — el mismo mecanismo con el
  que SCRUM-475 añadió el `update`). No es relajar el guard: sigue siendo un `deepStrictEqual`
  sobre un conjunto CERRADO, solo que ahora de tres. Arreglo: el conjunto esperado pasa a
  `['create', 'update', 'updateMany']`, con un comentario que explica por qué (SCRUM-1057:
  reasignación de filas ya existentes, no un envío ni un aviso) y qué significa que cualquiera de
  los tres desaparezca.

## Declarado, sin arreglar aquí

- La pantalla («fusionar con…», el selector, el aviso de NIF distintos) es de S2.
- SCRUM-1031 caso B (`PATCH /admin/customers/:id` sin ruta, NIF desde el Trabajo): NO es
  dependencia de este ticket y no se toca aquí.
- El ticket de J1 sobre clientes CON facturas emitidas: sigue bloqueado, tal como pide el ticket.
