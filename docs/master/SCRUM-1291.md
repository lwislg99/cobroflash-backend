# SCRUM-1291 · Fusionar un cliente con direcciones de obra daba un 500, y el reintento también

**Medido contra:** `origin/main` = `fecff92a31c98db1108b7dc86c00f4246e55b8d3` · 2026-09-30T22:06:46+01:00
(J2 del equipo de Javier, `cobroflash-jv-j2`)

A9: comprobación → `tests/scrum1291-fusion-mueve-direcciones-de-obra.test.mjs`

**Rama:** `scrum-1291-fusion-mueve-direcciones-obra` · **Carril:** clientes (servidor). Cierra
`P2-CONT-1126b` de `docs/BUGS.md`, el hueco que SCRUM-1126 dejó declarado al entregar la pantalla.

## 1 · Reproducido ANTES de arreglar

El ticket venía rotulado «razonado desde el esquema, NO ejecutado». Se midió antes de tocar nada:

- **El censo.** `prisma/schema.prisma` tiene **11** modelos con `customerId`. La fusión movía 9;
  `Invoice` queda fuera a propósito (con una factura emitida la fusión se rechaza, regla 29);
  `CustomerSite` era el único que faltaba. `customerSite` no aparecía en `fusionClientes.ts`.
- **La FK.** DDL real sacado offline, sin tocar ninguna base
  (`./node_modules/.bin/prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`):
  `customer_sites_customer_id_fkey … REFERENCES "customers"("id") ON DELETE RESTRICT`.
- **Ejecutado**, sobre el handler REAL de `POST /admin/customers/:id/fusionar` con un banco que hace
  cumplir el `where`, el RESTRICT y el rollback: **`500 {"error":"internal_error"}`**. Y una sonda
  con **dos llamadas seguidas** sobre el mismo banco: **500 las dos veces, y la base intacta** — el
  reintento no puede salir bien nunca.
- **En Postgres real:** el commit `19d041029908344ed653331bb9195770ce721d05` (sólo el test, sin
  arreglo) se empujó para verlo caer en el banco desechable de CI (PR #2008, job 110092907316).
  Cayó el caso de `1057b` con el error del MOTOR: `update or delete on table "customers" violates
  foreign key constraint "customer_sites_customer_id_fkey" on table "customer_sites"`.

## 2 · El arreglo

Una línea dentro de la misma transacción que las otras nueve:
`tx.customerSite.updateMany({ where: { merchantId, customerId: fusionadoId }, data: { customerId: principalId } })`.

**Duplicados:** `customer_sites` **no tiene índice único** (DDL y esquema). Si los dos clientes
tienen la misma dirección, el principal se queda con las dos. No se deduplica: eso sería borrar
datos del cliente (STOP). El caso ③ lo fija y cae si el modelo gana una unicidad.

**Precondición de despliegue:** la tabla tiene que existir en la base, o TODAS las fusiones
fallarían (P2021 dentro de la transacción). El arreglo no se empujó hasta medirlo:

| Base | `customer_sites` | Cómo se midió (30-sep-2026) |
| --- | --- | --- |
| staging | existe | orquestador, `node scripts/preview-migracion.mjs`: no propone crearla ni ningún `CREATE TABLE` |
| producción | existe | el fundador, consulta de sólo lectura, con `customers` como control positivo |

🔴 **`docs/MIGRATIONS_PENDING.md` decía lo contrario** (entrada de SCRUM-1014: «NINGUNA base
tocada», tres casillas sin marcar) y las dos bases la tienen. No se decide nada mirándolo: es una
pista, no una medición.

## 3 · La prueba

`tests/scrum1291-fusion-mueve-direcciones-de-obra.test.mjs` (sin base, corre en cada `npm test`).
Las tablas a mover y las FK **salen del esquema**, no de una lista: el defecto fue una lista escrita
a mano que no se enteró de una tabla nueva.

| # | Caso | Antes del arreglo | Después |
| --- | --- | --- | --- |
| suelo | la población leída del esquema no está vacía (≥ 11, con nombres conocidos) | ✔ | ✔ |
| ① | CONTROL POSITIVO: sin direcciones, las demás tablas se mueven y el fusionado desaparece | ✔ | ✔ |
| ② | con una dirección de obra: 200, pasa al principal, la de un tercero y la de otro merchant quietas | 🔴 500 | ✔ |
| ③ | la misma dirección en los dos: el principal se queda con las dos | 🔴 500 | ✔ |
| ④ | control del banco: una transacción que falla deja todo igual | ✔ | ✔ |
| ⑤ | factura emitida en cualquiera de los dos: `409 factura_emitida`, nada movido | ✔ | ✔ |

Y en Postgres real, `scrum1057b-fusion-clientes-postgres.test.mjs` gana el caso «fusión con
direcciones de obra» (la repetida incluida).

**Interrogado** con mutaciones sobre `dist/`, restauradas con post-condición sha256:

| Mutación | Cae |
| --- | --- |
| quitar el `updateMany` de `customerSite` | ② ③ |
| quitar el de `charge` | ① |
| quitar el de `whatsAppMessage` | ① |
| quitar `reasignarClienteEnFusion` (correos) | ① |
| ignorar las facturas en el rechazo | ⑤ |
| `where` de sitios sin `customerId` | ② ③ |
| `where` de sitios sin `merchantId` | **MUDA, y equivalente**: el fusionado ya se validó dentro del merchant y los ids de cliente son globales, así que casa las mismas filas |

## 4 · Lo que queda fuera

- **La frase firmada `todoPasa`** de la pantalla de SCRUM-1126 enumera nueve cosas y no nombra las
  direcciones de obra, que ahora también pasan. Cambiarla es texto (regla 39): propuesta al
  orquestador, no en este PR.
- El singular de «Contados» (firmado en SCRUM-1126, comentario 17577): otro ticket.
- `docs/MIGRATIONS_PENDING.md` sigue con la entrada de SCRUM-1014 sin marcar (desactualizada, ver §2);
  corregirla es de su dueño, no de este PR.
