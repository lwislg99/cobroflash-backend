# El aviso de cuando el cerrojo de serie está saturado

**Aprobado por el fundador** el 8-sep-2026, en **SCRUM-728**.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

> No hemos podido crear el documento. Inténtalo otra vez en unos segundos.

## Dónde se pinta

En el cuerpo del **503 `serie_ocupada`**, en las rutas donde un profesional está esperando un
documento y la reserva de número no cabe en el plazo. Sale de **una sola constante**
(`COPY_CERROJO_SATURADO`, en `src/modules/invoicing/domain/cerrojoSaturado.ts`) y el panel lo
enseña tal cual, porque `apiRequest` prefiere `message` cuando viene.

## Qué se veía antes, medido corriendo

```
[POST /admin/jobs/:id/albaranes]  PrismaClientKnownRequestError · P2028
Transaction already closed: A query cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 6978 ms passed…
→ HTTP 500 {"error":"internal_error"}
```

Y en la pantalla del profesional, literalmente:

> No se pudo crear el albarán: **API 500: internal_error**

Un identificador interno en la cara de un fontanero. El P2028 no llegaba tal cual ni reventaba la
pantalla: **lo tapaba un catch genérico**, que es la tercera de las tres respuestas posibles y la
que decidió este arreglo.

## Por qué este texto

- **«No hemos podido crear el documento»** — dice lo que pasó, en primera persona del plural y sin
  jerga. No dice «albarán» a propósito: la misma frase sirve para el albarán, la factura y el
  presupuesto, que comparten el mismo cerrojo y el mismo fallo.
- **No culpa a nadie.** El profesional no ha hecho nada mal: hay cola.
- **«Inténtalo otra vez en unos segundos»** dice qué hacer **y cuándo**, y el «unos segundos» está
  medido: con ~880 ms por reserva, la cola que tiene delante se vacía en eso. No es un relleno.

## Lo que este texto NO tapa

Sólo aparece ante **un** código de Prisma (`P2028`, transacción expirada), reconocido por
identidad. Un número duplicado, una fila que no está o un fallo de red siguen saliendo como salen
hoy. Convertir cualquier error en «inténtalo otra vez» sería cambiar un error técnico por una
mentira amable, y el profesional reintentaría diez veces algo que nunca va a salir. Hay un control
que lo comprueba corriendo.

## Nota

**No se ha subido el timeout**, y este texto es justamente lo que se hace en su lugar. Está medido
por qué: a 20 s daría margen para 22 simultáneas, pero el coste es lineal y **el usuario número 22
esperaría 19 segundos** mirando la pantalla. Se cambiaría un fallo rápido por una espera larga.
