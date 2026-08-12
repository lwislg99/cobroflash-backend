# SCRUM-482 · PASO 0: no hace falta columna — y el servidor **no puede** ver la mitad de la pregunta

**Medido contra:** `origin/main` = `d5fdedaf25ab16e2fea17e5a9c33cf3c1149e35c` · 2026-08-12T12:14:11+02:00
**Medido en:** host `DESKTOP-T5MONF5` · **Cero código, cero schema.**

## 1 · ¿Necesita columna? **No.** Y el sitio ya existe, indexado para esta pregunta

`AuditLog` tiene `meta Json?` y —lo que decide— **`@@index([merchantId, action, createdAt])`**, que
es exactamente el eje de este contador: *cuántas firmas con retraso, de este merchant, en este
periodo*. Y no es un uso forzado: el camino del albarán **ya escribe ahí** (`albaran_editado`,
`albaranes.routes.ts:552`).

> Es la contraria de la decisión de SCRUM-475: allí `AuditLog` **no** valía porque hacía falta un
> estado que AVANZARA y una búsqueda por el id del proveedor sin índice. Aquí se necesita
> exactamente lo que `AuditLog` es: **append-only y contado por acción y fecha.**

**Así que no hay preview de migración que traer: no hay columna que pedir.**

## 2 · 🔴 Pero el hecho que hay que contar **HOY NO EXISTE**

El ticket propone definir «llegó con retraso» como **«llegó por el drenado de la cola»**, por ser un
hecho del servidor que no depende del reloj del móvil. Medido:

**El drenado y la firma directa usan el MISMO endpoint con el MISMO cuerpo.** `POST /:id/firmar`
acepta `signatureData`, `firmadoPorNombre`, `firmadoPorCalidad` y `firmadoPorCalidadOtro` — **y nada
más**. `colaDeFirmas.js` drena llamando a esa misma función de subida.

> **El servidor no puede distinguir hoy una firma drenada de una directa.** No es que no se guarde:
> es que **no llega la información**.

Para contarlo hay que hacer dos cosas, y las dos son pequeñas: que el drenado **mande una marca**
(`origen: 'cola'`) y que el endpoint **la acepte**. Sin eso, cualquier contador estaría midiendo otra
cosa y llamándola ésta.

## 3 · 🔴 Y la mitad que el servidor NO puede ver nunca — esto puede cambiar el ticket

Tu pregunta era: **el contador tiene que distinguir «llegó con retraso» de «no llegó»**. Medido, y
es una asimetría dura:

| | ¿observable desde el servidor? |
|---|---|
| **llegó con retraso** | **sí**, con la marca del drenado |
| **no llegó** | **NO. Nunca.** Una firma que se queda en la cola de un móvil **no produce ninguna petición**: no hay nada que contar, porque no llega nada |

**Un contador de llegadas solo puede medir lo que llega.** Con él sabremos que el offline se USA;
**no sabremos si se está perdiendo**, que es lo único que de verdad importa.

Para lo segundo hacen falta dos números que hoy no tenemos, y ninguno es este contador:
**cuántas firmas están encoladas en los móviles** (lo sabe el front) y **cuánto llevan ahí**. Es
decir: **la idea ② del ticket no es un adorno del contador — es la otra mitad de la pregunta**, y sin
ella el cero seguirá siendo ambiguo en la dirección que más duele.

## Lo que pido decidido antes de construir

1. **Añadir un miembro al vocabulario cerrado `AuditAction`** (`audit.service.ts:30`) — p. ej.
   `albaran_firmado`. Es un conjunto cerrado y está atado al contrato del AuditLog fiscal: ampliarlo
   es decisión, no trámite.
2. **Que el drenado mande la marca** y el endpoint la acepte. Toca el camino de firma —**leer sí,
   modificar es STOP** (regla 38)— así que necesita tu OK aunque sea un campo que solo se lee.
3. Y con lo del punto 3 delante: **si el contador solo puede decir «se usa» y no «se pierde»**,
   decidir si se construye igual o si va junto con la idea ②.

**Lo que ya está decidido y no toco:** ninguna superficie, ninguna microcopy, ni la cola, ni el
sellado. Y la escritura del contador irá **sin capacidad de tumbar la firma**: falla en silencio
hacia el usuario, con constancia hacia dentro.

**No se ha escrito ni una línea de código.**
