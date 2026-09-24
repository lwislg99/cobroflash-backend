# SCRUM-1043 · «Quién me debe»: clientes con saldo pendiente (parte de SERVIDOR)

**Medido contra:** `origin/main` = `9d665402f327af68a5a0195a2a85849c78e398c1` · 2026-09-21T18:39:33Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1043-quien-me-debe-servidor` (apilada sobre SCRUM-1035) · **Carril:** S1 · CRM Ola 2 · solo lectura (dinero). Aviso D1 (ficheros de J2) dejado en el ticket.

## Alcance: solo el servidor
Los criterios 1-2 y 4-6 del ticket en lo que es API. **Queda para S2 y para FIRMA (regla 39):** el chip/filtro «con deuda», la columna de saldo en la fila y su captura a 390 px. Ese microcopy no está firmado y no se estrena aquí.

## Lo que cambia
- `src/modules/system/domain/saldoPendiente.ts` · `saldosPendientesPorCliente(merchantId, ids?)`: UNA consulta (`groupBy`) de facturas `pending` por cliente, siempre por `merchantId`. **Sitio único**: la ficha 360 (`stats.totalPending`, SCRUM-1035) y la lista salen de aquí (criterio 2: no dos formas de sumar).
- `GET /admin/customers` · `?conDeuda=1` deja solo a los deudores; `?orden=saldo` los ordena de mayor a menor; cada fila con deuda trae `saldoPendiente`. Cliente sin deuda = sin la clave (criterio 4, ausente no es cero). Sin parámetros la lista es la de antes más `saldoPendiente` en los deudores (aditivo).
- **Decisión mía, a confirmar:** el saldo es dinero; el rol que solo ve lo suyo (`seesOnlyOwnJobs`, el técnico) NO recibe `saldoPendiente` y `conDeuda`/`orden` se ignoran para él (como SCRUM-1078 con los precios).

## El juez: `tests/scrum1043-quien-me-debe-servidor.test.mjs` (sin banco)
Handler real sobre un mini-Prisma: 3 clientes del merchant (deuda 500, sin deuda, deuda parcial 700 sobre 1.000) y otro merchant con facturas propias incluso sobre el mismo id; orden por saldo distinto del orden de la lista; técnico sin saldos. Mutaciones (4, en rojo; restaurado, verde): técnico con saldos · sin `merchantId` · sin orden · filtro roto. `scrum1035` sigue verde con el helper compartido.
