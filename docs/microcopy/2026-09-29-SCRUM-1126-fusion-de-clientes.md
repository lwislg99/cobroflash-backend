# Ficha del cliente — fusionar con otro cliente · SCRUM-1126

**Aprobado por el orquestador por delegación del fundador** el 29-sep-2026 — SCRUM-1126 comentario 17575.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente». Los propuso
J2. El comentario 17575 corrige al 17574 (la primera firma), y las dos llegaron a J2 **transcritas
por el orquestador**: esta sesión no pudo abrir Jira (el conector pedía autenticación).

Lo que cambió entre la propuesta y la firma, y por qué:

- **«Pasan a {principal}: {n} presupuestos · {n} trabajos · {n} notas» NO se publica.** La fusión
  reasigna NUEVE tablas (`fusionClientes.ts`: quote, job, customerEvent, charge, quoteRequest,
  parteTrabajo, whatsAppMessage, maintenancePlan, y `email_messages` desde
  `registroDeEnvios.ts::reasignarClienteEnFusion`) y el servidor sólo cuenta tres. Una lista de
  tres en una acción irreversible se lee como «eso es todo». Queda en dos líneas: `todoPasa` (lo
  que se mueve, entero y sin número) y `contados` (lo que sí se cuenta, rotulado como tal).
- **La 17574 nombraba siete de las nueve** (faltaban solicitudes de presupuesto y correos); la
  17575 las añade.
- **`sinEmpresa` entra en la 17575**: `desvincularYBorrar` deja sin empresa a las personas cuya
  empresa era el fusionado y NO las re-enlaza al principal. Un efecto que el profesional no espera,
  en una acción irreversible, se dice.

## Textos aprobados, literales

`{principal}` es el nombre del cliente de la ficha (el que se queda), `{fusionado}` el del elegido
(el que desaparece), `{n}` un número, `{lista}` las etiquetas unidas y `{nif1}`/`{nif2}` los NIF tal
cual: datos, no texto.

| Ranura | Texto aprobado |
|---|---|
| `boton` | Fusionar con otro cliente |
| `selector` | ¿Con qué cliente lo fusionas? |
| `placeholder` | Busca por nombre o NIF |
| `tituloPrevia` | Revisa la fusión antes de confirmar |
| `seQueda` | Se queda: {principal} (sus datos no cambian) |
| `desaparece` | Desaparece: {fusionado} |
| `todoPasa` | Todo lo de {fusionado} pasa a {principal}: presupuestos, solicitudes de presupuesto, trabajos, notas, cobros, partes de trabajo, mensajes de WhatsApp, correos y mantenimientos. |
| `contados` | Contados: {n} presupuestos · {n} trabajos · {n} notas |
| `sinEmpresa` | Las personas de contacto de {fusionado} se quedan sin empresa. |
| `etiquetas` | Etiquetas tras fusionar: {lista} |
| `sinEtiquetas` | Sin etiquetas |
| `avisoNif` | Ojo: los NIF no coinciden ({nif1} / {nif2}). Comprueba que es el mismo cliente. |
| `confirmacion` | Esta acción no se puede deshacer. {fusionado} dejará de existir. |
| `confirmar` | Fusionar |
| `exito` | Clientes fusionados |
| `factura_emitida` | No se puede fusionar: uno de los dos tiene una factura emitida, y una factura emitida no se modifica. |
| `mismo_cliente` | Elige un cliente distinto. |
| `cliente_no_encontrado` | Uno de los clientes ya no existe. Recarga la lista. |

## Reusados, no firmados de nuevo

Aprobado el reuso en la misma firma. Son **byte a byte** los de su origen, y el test los ancla allí:

- `generico` — «No se ha podido completar la acción. Vuelve a intentarlo.», de
  `patronDetalleAcciones.js` (`TEXTO_ERROR_GENERICO`, SCRUM-1124). Para un 500, sin red, un 409
  con un código fuera de la tabla, y si no se pudo cargar la lista o la previsualización.
- `sinResultados` — «Sin resultados para tu búsqueda», de `buscadorDeClientes.js` (el de la lista).
- `cancelar` — «Cancelar», el de todos los pies de modal.
- El título del modal es el mismo rótulo del botón, `boton`.

## Dónde se pinta

En la ficha del cliente (`public/dashboard/js/customerDetailView.js`), botón de la cabecera y su
modal, **sólo para el rol admin** (las dos rutas son `requireRole('admin')`). Los textos viven en
`FUSION_CLIENTE` del mismo fichero.

## Lo que NO se pinta, a propósito

- El `error` crudo del 409 (`factura_emitida`, `mismo_cliente`, `cliente_no_encontrado`): se
  traduce por la tabla de arriba, y un código que no esté en ella cae en el genérico.
- El `message` del navegador sin red («Failed to fetch», SCRUM-1200).

## Queda sin firmar

- **El singular de `contados`.** La firma es en plural, y así se pinta: con un presupuesto dirá
  «1 presupuestos». No se ha inventado el singular.
