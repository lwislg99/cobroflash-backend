# SCRUM-424 · Lo que se escribe al CREAR un albarán se perdía en silencio

**Medido contra:** `origin/main` = `9093c11017e52fcb0e7b085e5054fb8505168f43` · 2026-08-10T20:49:59+02:00
**Rama:** `scrum-424-lugar-al-crear`

## El defecto, y por qué no es «un campo más»

El PATCH guardaba `lugarEntrega` (`albaranes.routes.ts:483-485`) y el **create no lo escribía**:
cero apariciones. El campo está pintado, con su rótulo aprobado, y **lo que el profesional teclea al
crear no llegaba a la fila**.

🔴 `lugarEntrega` entra en el **hash del sobre v:2**. Un albarán creado y firmado sin él queda
**sellado** sin él, y sellado no se edita (regla 29). **No es un dato que se pueda añadir después**:
o está al crear, o ese documento no lo tiene nunca.

## 🔴 Y no era UN campo: eran DOS

Enumerados los dos conjuntos y enfrentados, como pedía el encargo:

```
PATCH acepta (6): fecha, fechaEntrega, lineas, lugarEntrega, modoValoracion, notas
create escribe (7): claveIdempotencia, jobId, lineas, merchantId, modoValoracion, notas, numero
SE PIERDEN:          fecha, fechaEntrega, lugarEntrega
```

**`fechaEntrega` se perdía igual** — el campo nº 1 del ticket de C5, el día real de la entrega,
distinto del de emisión (SCRUM-67). Si solo se hubiera arreglado el campo nombrado, el segundo se
queda. Entra aquí porque **es el mismo defecto**.

**`fecha` es la excepción declarada**, no un olvido: el documento siempre tiene una y la pone el
`@default(now())` del schema. Está escrito en el test para que no se lea como un hueco.

## El arreglo: simétrico, sin segunda forma

Se usa **el mismo helper que el PATCH** —`normalizarLugarEntrega`, con su suelo: vacío → `NULL`,
**nunca** el domicilio fiscal— y el mismo criterio de fecha: una `fechaEntrega` ilegible **se
rechaza**, no se guarda como hoy. Inventar el día de la entrega es el defecto de SCRUM-397 en otro
campo.

Dos formas de leer el mismo campo acaban divergiendo, así que no se escribió una segunda.

## ⚠️ Regla 29 · los ya firmados se quedan como están

Los albaranes **ya sellados sin lugar de entrega no se tocan**. Son documentos a los que les falta
un dato que alguien escribió y **no hay forma de arreglarlos**: su hash v:2 se calculó sin él, y
recalcularlo sería reescribir un documento firmado. Queda declarado aquí, que es lo único que se
puede hacer con ellos.

## Verificación

| | |
|---|---|
| **El vector** | `lugarEntrega` aparece en el `create`; hoy ese test caía |
| **El segundo campo** | `fechaEntrega` también |
| **Ninguno más** | los campos del PATCH que no escribe el create son solo `fecha`, con su motivo |
| **Control negativo** | crear sin lugar sigue funcionando y **no guarda basura**: se comprueba que usa el helper y que no hay valor por defecto inventado |
| **Fecha ilegible** | se rechaza con `invalid_date`, no se convierte en hoy |
| **Rojo** | quitando el campo del create caen **3 tests** y el primero dice `SE PIERDE EL LUGAR DE ENTREGA AL CREAR` |
| **SUELO** | si cualquiera de los dos conjuntos sale vacío, falla declarándose ciego — **y me pasó al medirlo**: mi extractor buscaba el `create` en el fichero equivocado y devolvió cero. El suelo lo cazó antes de que comparara dos silencios |
