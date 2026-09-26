# SCRUM-1140 · Los tres tipos, porque S1-D no se cierra sólo con altas

**Medido contra:** `origin/main` = `e3b563e0319050c5446afe94f07908d7aac7de69` · 2026-09-25T19:55:52Z

25-sep-2026 · Lo construye **el orquestador** (A13), por decisión del fundador («sí, prepáralo»).

## Por qué bloqueaba

`scripts/sobre-soap-prueba-aeat.mjs` consiguió el **primer `Correcto` de la AEAT** el 24-sep
(SCRUM-1110). Pero **sólo sabía hacer altas**: ni un argumento de tipo, una sola llamada a
`buildRegistroAlta`.

**El criterio de S1-D son ≥10 registros aceptados de alta, ANULACIÓN y R1.** Con uno solo de
alta, la tanda no se podía ni empezar.

## 🔴 Dos cadenas distintas, y confundirlas rompe la tanda

| Fichero | Qué contesta |
|---|---|
| `tmp/ultimo-registro.json` | **El último registro, sea del tipo que sea.** Es el puntero de **encadenamiento**, y así debe ser: la cadena de huellas no distingue tipos |
| `tmp/ultima-alta.json` | **La última ALTA.** Es sobre lo que se anula o se rectifica |

🔴 **Si se reutilizara el puntero de la cadena para las dos cosas, una R1 lanzada después de una
anulación acabaría rectificando una anulación** — que no es una factura. Son dos preguntas
distintas y tienen dos respuestas distintas.

Y el puntero de alta **sólo avanza con altas**: una anulación o una R1 no son facturas nuevas,
son operaciones *sobre* una.

## Falla cerrado

- `--tipo anulacion` o `--tipo r1` **sin ninguna alta registrada** → aborta. **Verificado en
  rojo:**

  ```
  🔴 No hay ninguna ALTA registrada, así que no hay nada que anular.
     Manda primero un alta (--tipo alta), o apunta a una con --serie y --fecha.
  ```

  No se inventa una serie. Un sobre con una factura que no existe **no lo rechaza la AEAT por lo
  que uno cree**, y el rechazo mandaría a buscar el defecto donde no está.
- `--serie` y `--fecha` van **juntas**: una sola no identifica una factura.

## La huella de anulación tiene SU PROPIA fórmula

`computeVeriFactuHashAnulacion` encadena los campos `...Anulada`, no los del alta. Usar la del
alta daría **un SHA-256 perfectamente válido de otra cosa**: la AEAT lo rechazaría, y el rechazo
parecería un problema de encadenamiento cuando sería de la huella.

## Un control que se hizo MÁS estricto, no más laxo

El script tenía `sinAnulacion: !soap.includes('RegistroAnulacion')`, y **era correcto**: cuando
sólo sabía hacer altas, una anulación ahí dentro sólo podía ser un accidente. Dejó de serlo al
añadir `--tipo`.

⛔ **No se relajó** (regla 41 / A7). Se sustituyó por uno **más preciso**: antes comprobaba que
**no hubiera una cosa**; ahora comprueba que haya **exactamente la pedida**.

> `tipoPedidoEsElQueVa` · y `r1LlevaLoRectificado`, porque una R1 sin las facturas rectificadas
> dentro es un alta con otra etiqueta.

🔴 **Importa porque el error silencioso aquí es pedir una anulación y mandar un alta:** la AEAT
la aceptaría tan contenta, y **la tanda de S1-D contaría un tipo que nunca se envió**.

Es la misma forma que el trinquete de las skills de hoy (SCRUM-1113) y que el guard del
importador (SCRUM-1022c): **una afirmación verdadera que deja de serlo porque debajo cambió
otra cosa**.

## Verificado — generado Y validado, los tres

| Tipo | Genera | XSD oficial | Comprobado en el XML |
|---|---|---|---|
| **alta** | ✅ | ✅ VÁLIDO | — |
| **anulación** | ✅ | ✅ VÁLIDO | lleva `RegistroAnulacion` |
| **R1** | ✅ | ✅ VÁLIDO | `<TipoFactura>R1</TipoFactura>` + `FacturasRectificadas` |

Validado con el validador oficial (.NET contra los XSD vendorizados), **el mismo que cazó el
sobre sin envolver el 24-sep**. Y no se dio por bueno el «VÁLIDO» a secas: se comprobó **dentro
del XML** que cada sobre lleva lo suyo, porque un XML válido puede ser válido *de otra cosa*.

⚠️ El fichero `tmp/registros-sample.xml` se usó prestado para validar y se **restauró**,
comprobado por `sha256` idéntico antes y después.

## Dos defectos propios, cazados al EJECUTARLO

Los dos habrían pasado cualquier revisión del diff:

1. **`args is not defined`.** Escribí `args.indexOf('--tipo')` y este fichero no tiene esa
   variable: tiene un ayudante `arg(nombre)`. Corregido usando el que ya existe.
2. **`computeVeriFactuHashAnulacion is not defined`.** La llamaba sin importarla.

🔴 **Mis once controles dieron verde con los dos defectos dentro**, porque comprobaban que **el
texto estuviera**, no que **el programa corriera**. Un control textual no prueba ejecución, y
esto es el recordatorio.

## ⛔ Lo que NO hace, a propósito

- ⛔ **No toca `src/`.** Importa los builders auditados en S1-A/S1-C. Leer el camino de emisión
  no es STOP (regla 38); modificarlo sí (regla 40).
- ⛔ **No envía, no toca la red, no lee ni pide certificados.** El envío lo hace una persona
  desde su navegador. **El certificado no pasa por ninguna sesión ni por el repositorio.**
- ⛔ **Un solo registro por sobre.** Cuanto menos haya dentro, más claro es de qué se queja la AEAT.
- ⛔ No se tocó la política de ejecución de PowerShell para correr el validador: se ejecutó su
  contenido como comando, que es la vía que el intérprete permite.

## Suelo

⚠️ **Validado contra el XSD. NO probado contra la AEAT** — este script no envía. **La respuesta
del servidor es el dato que falta**, y es lo único que cuenta para S1-D.

⚠️ **La huella de anulación arrastra un `[VALIDAR]` desde junio** (S1-C: «huella de anulación
implementada [VALIDAR vector en pruebas]»). Esta tanda es justo lo que lo cierra **o lo tumba** —
y por eso **conviene mandar una anulación pronto, no la décima**: si la fórmula está mal, mejor
saberlo en el envío 2 que en el 9.

⚠️ **`tipoRectificativa: 'I'`** (incremental: la rectificativa lleva la diferencia, no el total
corregido). Es el modo que el repositorio ya declara en `MODO_TIPO_RECTIFICATIVA`. **No se ha
probado el modo 'S'** (sustitutiva), y mezclarlos daría importes válidos que dicen otra cosa.
