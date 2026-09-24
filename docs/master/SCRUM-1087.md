# SCRUM-1087 · Dos preguntas urgentes nuevas para el asesor (P19 + P20)

**Fecha:** 23-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** sin gate — propuesta de texto, no se aplica nada
**Medido contra:** `origin/main` = `6bca74e55d4ad193debd03cd95223f8390080ad4` · 2026-09-23T00:07:41Z

## Encargo

El orquestador, 23-sep-2026: dos preguntas nuevas para `docs/legal/PREGUNTAS_ASESOR.md` y
`docs/legal/PREGUNTAS_ASESOR_POR_ESPECIALISTA.md`, mismo formato que P18 (SCRUM-1085), salidas de
decisiones de Javier de hoy y de un hallazgo de una sesión anterior.

## P19 · El PRODUCTOR, ¿puede ser DOS personas físicas?

Javier, literal, hoy: *"De momento nadie, pero seremos los dos, más bien la empresa que conformemos
dentro de poco"* (él y Luis Lara Granado); *"si hace falta uno para pruebas me pongo yo, pero el día
que haya algo real será como empresa"*.

**Premisa verificada en el código, no supuesta:** `interface SistemaInformatico`
(`src/modules/fiscal/verifactu/registro.builder.ts:19-21`) declara `nombreRazonProductor: string` y
`nifProductor: string` — un solo nombre, un solo NIF, volcados tal cual a
`<sum1:NombreRazon>`/`<sum1:NIF>` (`:377-378`). No hay campo para un segundo productor.

Cuatro sub-preguntas (declaración responsable con dos firmantes, comunidad de bienes, responsabilidad
de quien firme solo frente al otro mientras tanto, y reemisión al constituir la sociedad). Texto
completo en `docs/legal/PREGUNTAS_ASESOR.md`, sección P19.

## P20 · 🔴 La huella sella el REGISTRO — ¿también el PDF entregado?

Del enunciado de SCRUM-665 (2-sep-2026), sin preguntar hasta hoy. **La más urgente de las dos**: de
la respuesta depende elegir entre 4 salidas de diseño, y sin ella no se construye ninguna.

**Premisa verificada en el código, no supuesta:** `ensureInvoicePdf` (`src/lib/invoicing.ts`)
regenera el PDF con `generateInvoicePdf` (`src/modules/invoicing/infra/pdf/pdf.service.ts`) cada vez
que `!fs.existsSync(diskPath)` — y `storage/invoices` vive en el disco de Railway, efímero entre
despliegues. Los DATOS que entran ya están congelados (`emisorDelDocumento`, columna congelada,
SCRUM-665/729 — ver P18); el DISEÑO sale del código de `generateInvoicePdf` tal como está HOY, no
como estaba el día de la emisión.

Tres sub-preguntas (documento bit a bit vs. registro, la copia del art. 19 ROF, y si archivar el PDF
basta o hace falta versionar también la plantilla). Texto completo y las 4 salidas en
`docs/legal/PREGUNTAS_ASESOR.md`, sección P20.

## Qué se tocó

- `docs/legal/PREGUNTAS_ASESOR.md`: +78/-0 — añade P19 y P20 al final, antes de la sección
  RESPUESTAS (no se toca nada de lo existente).
- `docs/legal/PREGUNTAS_ASESOR_POR_ESPECIALISTA.md`: +36/-6 — añade F17 (=P19) y F18 (=P20) tras F16,
  y actualiza el contador final (16→18 fiscales, 24→26 total).

## Qué NO hice

- No envío las preguntas al asesor — eso es de un jefe (J4 propone, firma un jefe).
- No toco `src/` ni `public/` — las dos preguntas señalan código real (citado con ruta y línea) pero
  no lo modifico.
- No repito P18 ni las preguntas ya registradas — verificado con `grep -n "^# P[0-9]"`: la numeración
  con este encabezado va P15→P20 sin hueco (P1-P14 usan otros formatos de título, heredados de antes
  de que se adoptara este patrón con P15).
