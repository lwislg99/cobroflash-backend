# SCRUM-1585 · M de SCRUM-1102: el modo de emisión mira el SII en cada emisión

**Medido contra:** `origin/main` = `f1c0ff3094c004ea7b99ffe2f1d13a21213c5ad1` · 2026-10-23T14:40:59Z (cabecera `Date:` de GitHub; la rama salió de `9a9518c2e` y lleva `main` mergeado)

A9: aviso → cicatriz J1 «Para arreglar tres tests edité `tests/_banco-emision-con-estado.mjs` sin pasar antes `carriles.mjs de`: es de S3, del otro equipo; lo vi por el aviso del carril y lo deshice, y el dato lo pone cada test al reiniciar» — no se pudo comprobar: la cerradura de carril avisa y no para (SCRUM-1506), y los hooks no son de este puesto

Sesión `jv-j1ar` (puesto J1), 23-oct-2026, por encargo del orquestador `cobroflash-backend-62`.
**GO de regla 40 del fundador en SCRUM-1585 c.20531**: D0 «Sí, ahora» (la comprobación en el camino de
emisión, sin sellado ni XML); D1 el texto que ve el profesional NO se construye hasta la firma, y el
servidor puede ir antes con su código de error; D2 el dato del SII OBLIGATORIO en cada consulta que
alimente la emisión; D4 la foral fuera hasta el asesor (SCRUM-1264). Diseño: J6f, anexo 1102g §⑤-§⑦
de `SCRUM-1102.md`.

## 🔴 Estado: construido en local, NO empujado

Con el campo obligatorio, `tsc` deja **6 llamadas de ficheros de S1** (equipo de Luis) sin compilar:
`albaranes.routes.ts` ×3, `jobs.routes.ts` ×1 y `app.ts` ×2 (el `select` de `merchantParaModo`), más la
landing (`quoteDecisionLanding.routes.ts`), que llama con `as any` y que el compilador no caza. Van en
**SCRUM-1594** (`equipo-luis`, `area-s1`), que bloquea a éste. Decisión del orquestador (opción 1 de
SCRUM-1585 c.20534): éste se empuja **después**; si entrara antes, el obligatorio cae en `tsc`.

## ① Qué entra

- `emission.service.ts` · `MerchantLike.llevaLibrosPorSii: boolean | null`, **obligatorio**.
  `isDemoMerchant` pasa a pedir sólo `MerchantIdentidad` (id, email): sus llamadores no necesitan el SII.
- `motivoSiiSinEmision(m)` · `sii_declarado` («Sí») o `sii_no_consta` (NULL, o la columna ausente) para
  un español no demo con `INVOICING_ES_ENABLED` encendido; `null` en el resto. `=== false`, no `!== true`
  (1102g §⑦.1). Los dos códigos son los de W (SCRUM-1102h): un hecho, un nombre. La rama del demo va
  antes (el demo tiene la columna en «No consta»). Sin rama de país: el flag tiene ámbito de país y
  fuera de España ya sale apagado (la mutación que la quitaba salió muda, y por eso se quitó).
- `getEmissionMode` · con el flag encendido, `fiscal` sólo si `motivoSiiSinEmision` es `null`; si no,
  `receipt`. Todo lo que cuelga del modo se comporta como con el flag apagado (regla 24).
- `allocateInvoiceNumber` (`invoiceNumber.service.ts`) · la columna en su `select`, y el rechazo del
  modo `receipt` lleva `motivoSiiSinEmision(m) ?? 'invoicing_es_disabled'`. **Candado movido por GO
  c.20531**: el hash de `tests/scrum291-series-huecos.test.mjs` se actualiza con su entrada, como en
  SCRUM-735, 1216b y 825. Rojo visto con el hash viejo («esperado 4ff5… leído 0651…») y verde con el nuevo.
- `select` con la columna, sin otro cambio: `invoicesAdmin.routes.ts` (J1), `lifecycle.service.ts` ×3 y
  `weeklyDigest.service.ts` (J3, cruce declarado en el commit), `whatsappIncoming.routes.ts` (J2, ídem).

## ② Qué NO entra

- Ninguna pantalla ni texto que vea el profesional. La propuesta D1 (A y B) está en SCRUM-1585 c.20534;
  la lleva el orquestador al fundador.
- Las rutas no distinguen todavía el motivo: devuelven el error que ya daban en `receipt`. El código
  propio sale del embudo y de `motivoSiiSinEmision`, que es lo que la pantalla firmada leerá.
- La foral (D4). El camino E de 1102g §④ (país desde Configuración). Las dos lecturas directas del flag
  en `exports.routes.ts` (contenedor S1), que siguen sin mirar el SII (1102g §⑤).
- D3 (lo ya facturado por quien entra en el SII encendido): pregunta del asesor, SCRUM-1264.

## ③ Cómo se midió

- `tests/scrum1585-sii-en-cada-emision.test.mjs`: 15 casos, 15 pasan.
- Mutaciones sobre `dist/` (la del tipo, sobre `src/` con copia y restaurada; diff comprobado): 6, las 6
  cazadas, y en cada pasada caen + pasan = 15. M1 (el modo de `main`) es el rojo primero: 5 caídas.
- `tsc --noEmit`: base 17 errores (cliente de Prisma compartido: `activityKind`, `archivedAt`); con el
  cambio quedan esos 17 + los 6 de S1, y ninguno más.
- 99 ficheros que nombran el modo o el flag, uno a uno en la rama y sobre un árbol de `main`: 22 que en
  `main` pasan caían aquí (61 casos, y suman los 61 del lote). Su doble de merchant con el flag encendido
  no traía la columna. Contrato nuevo: `llevaLibrosPorSii: false` (las aserciones no cambian), y los tres
  que usan el banco de S3 lo ponen al reiniciar. Re-medido: 24 ficheros, 217 pasan, 0 caen.

## ④ Mis errores

- Edité el banco de S3 sin mirar su carril (la línea A9 de arriba). Deshecho antes del commit.
- Mi primera versión de `motivoSiiSinEmision` llevaba una rama de país que nada podía cazar: guarda
  redundante con el ámbito del flag. La quitó la mutación muda, no yo.

## ⑤ Sin medir

Ninguna base. La tanda completa. El CI (no hay empujón). Lo que haga S1 en SCRUM-1594.
