# Microcopy APROBADA por el fundador, pendiente de aplicar

**Aprobada:** 17-ago-2026 (regla 30) · **Estado: NO APLICADA.** Se aplica en **UNA sola tanda**,
para no tocar dos veces los mismos ficheros.

**Base del censo:** `origin/main` = `a241b6e48c6553e453375bf705ca76ac3045ac0d`
**De dónde salen las líneas:** `docs/CENSO_MICROCOPY_PENDIENTE.md`

> ⚠️ **Los textos van LITERALES**: tildes, mayúsculas y puntos suspensivos de **un solo carácter**
> (`…`, no `...`). Al aplicarlos se copian tal cual — retocar uno «de paso» es reabrir una
> aprobación sin que nadie se entere.
>
> ⚠️ **Las líneas son las de la base de arriba.** Si el fichero se ha movido, se localiza el rótulo
> por su contenido, **no** por el número de línea.

---

## Bloque 1 · Detalle de factura — `public/dashboard/js/invoiceDetailView.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 273 | Botón | `Descargar PDF` |
| 282 | Botón | `Enviar por WhatsApp` |
| 363 | Botón | `Marcar como cobrada` |
| 448 | Botón | `Ver la reclamación del banco` |
| 472 | Botón | `Cobrar por Bizum` |
| 513 | Botón | `Enviar recordatorio de pago` |
| 550 | Botón | `Emitir factura rectificativa` |
| 640 | Botón | `Volver a generar el PDF` |

## Bloque 2 · Nueva factura (modal) — `public/dashboard/js/nuevaFacturaModal.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 53 | Título del modal | `Nueva factura` |
| 53 | Botón ✕ | `Cerrar` |
| 44 | `aria-label` del diálogo | `Crear una factura nueva` |
| 77 | Placeholder | `Busca por nombre…` |
| 78 | `aria-label` | `Buscar cliente por nombre` |
| 85 | `aria-label` | `Cliente al que facturas` |
| 97 | Opción vacía | `Selecciona un cliente…` |
| 108 | Error | `No hemos podido cargar tus clientes. Inténtalo otra vez.` |
| 134 | Placeholder | `Trabajo o material` |
| 135 | `aria-label` | `Concepto de la línea` |
| 140 | Placeholder | `Cantidad` |
| 141 | `aria-label` | `Cantidad de unidades` |
| 146 | Placeholder | `Precio sin IVA` |
| 147 | `aria-label` | `Precio por unidad, sin IVA` |
| 152 | Placeholder | `IVA %` |
| 153 | `aria-label` | `Tipo de IVA en porcentaje` |
| 159 | `aria-label` del ✕ de la línea | `Quitar esta línea` |
| 169 | Botón | `Añadir línea` |
| 179 | Botón secundario | `Cancelar` |
| 212 | Estado del botón principal | `Emitiendo…` |
| 216 | Aviso | `Factura emitida` |
| 221 | Error | `No hemos podido emitir la factura. Inténtalo otra vez.` |

## Bloque 3 · Presupuesto

### `public/dashboard/js/quotesView.js`

| Línea | Texto aprobado |
|---|---|
| 352 | `1. Cliente` |
| 360 | `2. Líneas` |
| 368 | `3. Condiciones` |
| 376 | `4. Envío` |

### `public/dashboard/js/quoteActionsRegistry.js`

| Línea | Texto aprobado | |
|---|---|---|
| 64 | `Enviar a aprobación` | |
| 65 | `Enviar al cliente` | |
| 66 | `Aprobar` | |
| 67 | `Enviar recordatorio` | **cambiado** (era «Recordar al cliente») |
| 68 | `Crear trabajo` | |
| 69 | `Duplicar` | |
| 70 | `Descargar PDF` | **cambiado** (era «PDF») — igualado con factura |
| 71 | `Editar líneas` | |
| 72 | `Enviar por WhatsApp` | **cambiado** (era «WhatsApp») — igualado con factura |
| 73 | `Ver cliente` | |
| 74 | `Marcar como rechazado` | |
| 75 | `Borrar` | |

### `public/dashboard/js/quoteSuplido.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 44 | Etiqueta de la casilla | `Suplido (pagado por cuenta del cliente)` |
| 92 | Resumen de ajustes | `Suplido · sin IVA` |

**45-49 · aviso bajo la casilla:**

```
Lo que has pagado por cuenta del cliente y le repercutes tal cual: una tasa, un visado, una
licencia. No lleva IVA ni margen. El material que compras tú no es un suplido: ese se vende con
su IVA.
```

> ⚠️ **SIN MAYÚSCULAS en «por cuenta»** (antes iba `POR CUENTA`). Si el sitio admite negrita, que
> lleve negrita; si no, redonda. **Gritar en una pantalla no es énfasis.**

## Bloque 4 · Clientes — `public/dashboard/js/customersView.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 192 | Etiqueta | `Recargo de equivalencia` |
| 197 | Opción | `No consta` |
| 198 | Opción | `Sí, está en recargo` |
| 199 | Opción | `No está en recargo` |

## Bloque 5 · Configuración — `public/dashboard/js/settingsView.js`

| Línea | Qué es | Texto aprobado | |
|---|---|---|---|
| 291 | Etiqueta | `Criterio de caja` | |
| 299 | Opción | `No consta` | |
| 300 | Opción | `Sí, estoy acogido` | |
| 301 | Opción | `No estoy acogido` | |
| 405 | Etiqueta | `Retención de IRPF` | |
| 387 | Opción | `No consta` | **cambiado** (era «Sin indicar») |
| 388 | Opción | `No aplico retención` | |
| 560 | Aviso Bizum | `Sin este móvil, tu cliente no ve la opción de Bizum.` | |
| 561 | Aviso Bizum | `No hemos podido comprobar tu móvil de Bizum. Revísalo antes de cobrar por ahí.` | |
| 213 | Píldora (respaldo) | `Modo no reconocido` | |
| 219 | Detalle (respaldo) | `No hemos podido identificar qué emite esta cuenta. Escríbenos antes de emitir nada.` | |

## Bloque 6 · Facturas (lista) — `public/dashboard/js/invoicesView.js`

| Línea | Texto aprobado |
|---|---|
| 16 | `No se han podido marcar como pagadas. Vuelve a intentarlo.` |
| 18 | `Se han marcado como pagadas, pero la lista no se ha podido actualizar. Recárgala para verla al día.` |
| 172 | `+ Nueva factura` |

## Bloque 7 · Productos — `public/dashboard/js/productsView.js`

| Línea | Texto aprobado |
|---|---|
| 611 | `Con errores` |

Queda: `CSV importado. Insertados: 12 · Duplicados omitidos: 4 · Con errores: 3`

## Bloque 8 · Trabajo · revisión antes de emitir — `public/dashboard/js/jobDetailView.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 2432 | Rama **conforme** | `Todo listo para emitir.` |
| 2432 | Rama **no conforme** | `Revisa lo que falta antes de emitir.` |
| 2439 | Etiqueta del NIF | `NIF del cliente (se guardará en su ficha)` |
| 2461 | Error | `Escribe el NIF del cliente. Sin él no se puede emitir la factura.` |
| 2472 | Error | `No hemos podido guardar el NIF en la ficha del cliente. Inténtalo otra vez.` |

> ⚠️ Hoy las **dos ramas** de la l.2432 pintan lo mismo (`revisionInicial.decidible ? MARCA_A1 : MARCA_A1`).
> Al aplicar, cada rama lleva **su** texto: ése era el defecto.

## Bloque 9 · Exportar — `public/dashboard/js/exportView.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 314 | Estado del botón | `Preparando la descarga…` |
| 331 | Info (hay filas) | `Descarga lista.` |
| 334 | Error | `No hemos podido preparar la descarga. Inténtalo otra vez.` |

## Bloque 10 · Albarán · firma

| Fichero:línea | Texto aprobado |
|---|---|
| `public/dashboard/js/albaranDetailView.js:27` | `No hemos podido registrar la firma` |
| `public/dashboard/js/signaturePad.js:402` | `La firma no se ha enviado. No cierres esta pantalla: vuelve a intentarlo.` |

## Bloque 11 · `src/`

### `src/modules/jobs/domain/albaranFirmante.ts:269`

```
Sin especificar
```

> ⚠️ **NO inventa ninguna calidad, y es deliberado.** Ese rótulo acompaña a una **FIRMA**: una
> etiqueta inventada afirmaría en qué calidad firmó alguien —dueño, encargado, inquilino— sin
> saberlo. Es el sitio donde una etiqueta falsa es peor que ninguna.

### `src/modules/jobs/domain/jobDireccion.ts:50`

```
No se puede añadir la dirección a este trabajo: tiene un albarán ya firmado que la lleva dentro
de su firma. Cambiarla dejaría esa firma sin poder verificarse.
```

Es la propuesta que ya estaba escrita en el código. Se aprueba **tal cual**.

### `src/modules/exports/domain/portabilidadCompleta.ts:201` — `LEEME.txt` del ZIP

```
Tus datos de YaQu
=================

Este ZIP contiene una copia de tus datos en YaQu, en ficheros CSV que puedes abrir con
cualquier hoja de cálculo.

Lo has descargado tú desde tu panel, y nadie más lo recibe.

Dentro hay un CSV por cada tipo de dato. La primera fila de cada uno son los nombres de
las columnas.

Para qué usamos tus datos, quién los recibe y cuánto tiempo los guardamos, lo tienes
explicado en nuestra política de privacidad: yaqu.app/privacidad
```

> 🔴 **DECISIÓN, y no es de redacción: el LÉEME NO copia el aviso del art. 15.** Apunta a la
> política de privacidad. Duplicar ahí las finalidades, los destinatarios y los plazos crearía
> **DOS FUENTES del mismo hecho legal**, y el día que una cambie la otra miente. Es el canon de la
> casa aplicado a un texto jurídico.
>
> 🔴 **Y NO se enumeran los CSV.** Si algún día se quiere una lista, se **DERIVA** de los ficheros
> que el ZIP mete de verdad. Una lista escrita a mano es la siguiente que se queda vieja.

---

## Criterios con los que se aprobó (17-ago-2026)

Se conservan porque **la lista de textos envejece y el criterio no**:

1. **Misma acción, mismas palabras.** Una acción que existe en dos pantallas se dice igual en las
   dos. De ahí los tres cambios del registro de acciones del presupuesto.
2. **Los tres selectores de estado fiscal comparten forma y palabras.** Recargo de equivalencia,
   criterio de caja y retención de IRPF tienen la misma terna —no consta · sí · no— y la dicen
   igual. Si uno dijera «Sin indicar» y otro «No consta», alguien leería que son estados distintos,
   y este producto lleva un mes separando «no lo ha dicho» de «dice que no».
3. **No se grita.** Nada de MAYÚSCULAS para enfatizar dentro de una frase.

---

## Lo que sigue SIN aprobar

| Dónde | Estado |
|---|---|
| `src/modules/system/domain/puertaClienteReal.ts:153` | Aviso interno. **Pendiente de leer la propuesta** |
| Los **38 fiscales y legales** | Van por otra vía; varios los dictamina el asesor |

---

## Addendum · aprobaciones POSTERIORES a este fichero (17-ago-2026)

🔴 **Este fichero es la fuente única y estaba TRES aprobaciones por detrás.** Llegaron en los
encargos de las tandas B y C, después de escribirlo, y nunca se anotaron aquí. Se añaden para que
«gana el fichero» siga siendo cierto — una fuente única que no se actualiza deja de serlo, y quien
la lea creerá que lo que falta no está aprobado.

### `exportView.js:330` — estado vacío del libro · **APLICADO**

```
No hay facturas en este periodo.
```

Y si el sitio admite una segunda línea explicativa:

```
Cambia las fechas o emite una factura y vuelve a intentarlo.
```

> ⚠️ **La segunda línea NO se ha aplicado.** `infoLibro` es un `textContent` de un solo párrafo:
> meter ahí dos frases con un salto exigiría `white-space: pre-line` **y su propio rojo**, y eso es
> trabajo de la siguiente tanda. Hoy va la primera, que es la que dice el hecho.

### `puertaClienteReal.ts:153` — las DOS formas · **SIN APLICAR**

**FORMA 1 · apertura**

```
🔴 HA ENTRADO EL PRIMER CLIENTE REAL — {motivo}.
Estas decisiones se tomaron dando por hecho que no lo habría. Revísalas:
  · {cláusula 1}
  · {cláusula 2}
  · {cláusula 3}
  · {cláusula 4}
```

**FORMA 2 · recordatorio** — *no existe todavía; hay que construirla sacando el `{N}` de `debeAvisar()`*

```
🔴 LA PUERTA DE CLIENTE REAL SIGUE ABIERTA — día {N} — {motivo}.
Estas decisiones seguían dando por hecho que no había ningún cliente real, y siguen
sin revisar:
  · {cláusula 1}
  · {cláusula 2}
  · {cláusula 3}
  · {cláusula 4}
```

Los `{motivo}` aprobados son **exactamente dos** y no se inventan más:

```
hay un merchant con suscripción de Stripe
hay más merchants que cuentas de prueba declaradas
```

Las cuatro `CLAUSULAS_DEPENDIENTES` quedan aprobadas **literales**, y la corrección del 10-ago de la
cuarta se queda **en su comentario**: la cláusula dice el hecho, el comentario dice su media verdad.
Son dos cosas y se leen distinto.
