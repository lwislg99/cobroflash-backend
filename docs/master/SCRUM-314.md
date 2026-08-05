# SCRUM-314 · D3: wipeDemo se deriva del schema — ANTES del botón, no después

**Fecha:** 5-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `5ae48e836ec439d6c7d1bccd9ebe0836c9a2e141` · 2026-08-05T10:03:42+02:00
**Tanda:** 1510 tests, 1443 pass, 0 fail (el resto, gateados a staging)

## El defecto, confirmado por derivación propia

`wipeDemo` borraba una lista escrita a mano: **10 de los 21 modelos con `merchantId`**. Los once
que quedaban fuera, derivados aquí desde `prisma/schema.prisma` (y coincidentes con el delta que
midió SCRUM-310 con su propia derivación del DMMF — **dos mediciones independientes, mismo
resultado**):

```
authSession · provider · quoteTemplate · teamMember · legalAcceptance · job ·
maintenancePlan · auditLog · attachment · albaran · albaranLineaFacturada
```

**Por qué el orden no se negocia.** Encima de esto iba a montarse el botón «Eliminar datos de
ejemplo». Un botón así no entrega un borrado a medias: entrega **una afirmación falsa**. El usuario
pulsa, se le dice que su cuenta queda limpia, y siguen ahí sus trabajos, sus albaranes, su equipo y
su rastro de auditoría. Primero se ata el barrido, después el botón.

## La decisión: colgar de la lista que YA guarda el schema

El barrido sale ahora de **`ORDEN_BORRADO_MERCHANT`** (`borradoMerchant.ts`), que ya existe, ya
está en el orden correcto de FKs y —lo que decide— **ya la guarda un test derivado del schema**
(SCRUM-172/192): si alguien añade un modelo con `merchantId` y no lo declara ahí, sale rojo.

Copiar la lista habría creado la segunda copia que se desincroniza sola. **Eso es exactamente lo
que dejó `wipeDemo` en 10 de 21**: dos listas del mismo hecho, y nadie manteniendo las dos. Al
colgar de ella, el demo hereda el guard **sin mantenimiento** — un modelo nuevo entra en el barrido
del demo el mismo día que entra en el del merchant.

**La diferencia con `borrarMerchant`, y por eso existe el módulo:** aquél borra **también la fila
del merchant**; aquí el merchant demo tiene que sobrevivir, porque el seed lo rellena justo
después. Misma lista, distinto final — y hay un test que lo fija.

**Dónde vive:** `scripts/_wipe-demo.mjs`. No dentro de `seed-demo.mjs` por un motivo medido: ese
script **se ejecuta al importarlo** (await de nivel superior + siembra), así que un test que lo
importara sembraría la base. Sacada la pieza, se ejercita con un `prisma` de doble — sin BD, sin
turno y sin red.

## Verificado en rojo

- **El test que importa** (el que pediste): se simula el schema del futuro con un modelo nuevo que
  hoy no existe (`FacturaRecurrente` con `merchantId`) y se comprueba que **sale como olvidado** —
  es decir, que el barrido se pondría rojo hasta tratarlo. No comprueba la lista de hoy: comprueba
  que **no puede quedarse corta mañana**.
- **Cobertura, por el mecanismo:** quitando `job` del recorrido, el guard falla nombrándolo
  («1 MODELO(S) DEL DEMO SIN BARRER: job»).
- **Control negativo, por el mecanismo:** quitando el filtro del demo, salta «BORRADO SIN ACOTAR AL
  DEMO». Es tan importante como la cobertura: sin él, «cubrir los 21» se podría lograr borrando las
  tablas enteras — y **un borrado de datos de ejemplo que se lleva datos reales no se deshace**.
- **El merchant demo sobrevive**: test propio, con un espía que falla si alguien llama a
  `merchant.deleteMany`.
- **Orden:** `event` y `reconciliation` caen **antes** que sus charges (FK RESTRICT, SCRUM-244); al
  revés el barrido revienta a mitad y deja el demo en un estado que nadie eligió.
- **`null` ≠ 0:** un modelo que este entorno no expone se anota como `null` y el seed lo **dice**;
  «no se pudo mirar» y «no había nada» no se confunden.

## Lo que NO entra

- **El botón «Eliminar datos de ejemplo»**: es el siguiente paso y no se ha tocado. Lo que este
  ticket entrega es el suelo para que ese botón pueda decir la verdad.
- **Las plantillas por gremio**: fuera, por indicación del fundador, mientras su origen no se
  confirme. **No se ha inventado ningún precio ni ninguna plantilla.** Y un dato que conviene
  saber antes de retomarlas: `seed-demo.mjs` **no siembra `quoteTemplate`** —comprobado— pero el
  barrido derivado **sí lo limpia ahora**, así que si alguien creó plantillas a mano en el demo,
  una re-siembra se las lleva y nada las repone. No es una regresión (antes tampoco se sembraban),
  pero es la interacción que hay que tener delante al decidir su origen.
- **No se ha ejecutado el seed contra ninguna base.** Todo lo de aquí se prueba con dobles.

## Ficheros

`scripts/_wipe-demo.mjs` (nuevo) · `scripts/seed-demo.mjs` (wipeDemo pasa a delegar) ·
`tests/scrum314-wipedemo-derivado.test.mjs` (11).
