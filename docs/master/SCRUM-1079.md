# SCRUM-1079 · Respuestas fiscales/legales del asesor externo, copiadas con línea de procedencia

**Fecha:** 22-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** ninguno — solo AÑADIR
**Medido contra:** `origin/main` = `cae002af2aec5a777d866cc8e50cc71f0d555f8f` · 2026-09-22T09:06:37Z

## Encargo y por qué esta vez sí se aplica

La sesión anterior (relevo de este mismo puesto) rechazó copiar este mismo texto bajo la cabecera
`(asesor…)` porque el propio mensaje admitía que lo había preparado una sesión de IA, no un asesor
humano — falsificar autoría en un documento con exposición fiscal (P14). **Hoy Javier decidió, literal:
«añade la línea de quién lo preparó»** (SCRUM-1079, comentario 16403), lo que retira la objeción: la
cabecera se queda, y la procedencia se dice en vez de ocultarse.

## PASO 0 (medido por el orquestador, reconfirmado aquí)

- `docs/master/SCRUM-1079.md` no existía en `origin/main` antes de esta entrada.
- No había ninguna rama `scrum-1079*` viva (`git ls-remote --heads origin`).
- `docs/legal/PREGUNTAS_ASESOR.md` tenía 835 líneas antes de este cambio.
- Dos secciones que este encargo NO menciona y no se tocan: "SCRUM-324 (E3)" (línea 509) y
  "21 · Los cinco avisos del Libro registro" (línea 677) — confirmado con `git diff` que ninguna línea
  se borra en todo el fichero (0 borrados, ver más abajo).

## Qué se hizo

Se copió TAL CUAL el fichero `C:\Users\Javier Pereira\AppData\Local\Temp\yaqu-1079-texto-asesor.md`
(26.567 bytes · 210 líneas · 16 cabeceras `##` · 14 marcas ⚠ · 14 fuentes URL + 1 referencia a
SCRUM-143) al final de `docs/legal/PREGUNTAS_ASESOR.md`, sin resumir y sin quitar ni una ⚠.

Inmediatamente debajo de la cabecera `## RESPUESTAS · 22-sep-2026 (asesor, contra FAQ AEAT 21-jul-2026
y ROF consolidado 31-mar-2026)` y antes del primer párrafo, se insertó esta línea (la firma J4 — texto
de procedencia, no legal ni fiscal, dentro de la delegación que Javier dio el 22-sep):

> **Quien preparó estas respuestas:** una sesión de IA de este equipo, consultando la FAQ de la AEAT y
> el BOE, el 22-sep-2026. **No las ha revisado un asesor humano.** Javier decidió ese mismo día mantener
> la cabecera «asesor» (SCRUM-1079, comentario 16403). Las **14 marcas ⚠** señalan lo que su propio
> autor no pudo releer en fuente oficial: **ninguna de ellas se convierte en microcopy ni en guard sin
> cotejarla antes.**

**Cómo se hizo:** un script de Node (no retipeo manual) leyó el fichero fuente byte a byte, insertó la
línea de procedencia entre la cabecera y el primer párrafo, y comprobó ANTES de escribir que el resto
del cuerpo seguía siendo idéntico al original y que conservaba sus 14 marcas ⚠ y sus 16 cabeceras `##`.

## Control al cerrar — releído el fichero YA ESCRITO en disco, no el buffer

- `git diff --numstat docs/legal/PREGUNTAS_ASESOR.md` → **215 inserciones, 0 borrados**. Solo se añadió.
- El bloque nuevo (desde `## RESPUESTAS · 22-sep-2026` hasta el final del fichero) tiene **212 líneas**
  (210 originales + 2 de la línea de procedencia y su línea en blanco).
- Marcas ⚠ dentro del CUERPO copiado (excluyendo la línea de procedencia, que menciona "14 marcas ⚠"
  como parte de su propio texto): **14**, igual que el fuente.
- Sección "Fuentes consultadas" del bloque nuevo: **15 líneas** (14 URLs + 1 referencia a SCRUM-143),
  igual que el fuente.
- `git diff` completo del fichero: ninguna línea empieza por `-` seguida de contenido (0 borrados en
  todo el fichero, no solo en el bloque nuevo) — las dos secciones declaradas como "no tocar" siguen
  intactas.

## Los tres que desbloquea esta entrega (reportados, no cambiados aquí)

- **SCRUM-244** (borrado de un profesional): lista de borrado = todo menos facturas, registros
  VeriFactu y `AuditLog` fiscal; bloqueo 6 años (art. 30 CCom), destrucción después.
- **El builder de facturas** (P11-P13): F2 (simplificada) hasta 3.000 € IVA incluido en servicios a
  domicilio (art. 4.2.c ROF); F1 si el cliente pide factura con NIF para deducción; por encima de
  3.000 € o si el cliente es empresario, completa con NIF obligatorio. `FacturaSinIdentifDestinatarioArt61d`
  **no procede** para un emisor establecido en territorio de aplicación del impuesto — esto es un
  hallazgo de OTRO carril (camino de emisión), **se reporta, no se toca aquí**.
- **S1-D** (entorno de pruebas AEAT): puede arrancar hoy con certificado propio (FNMT) sobre registros
  propios, Modelo C — sin necesitar el convenio 017 ni la SL, que solo hacen falta para remitir en
  nombre de terceros.

## Lo que NO cubre esta entrada

- No se contesta ni se cierra P14 (¿YaQu ya es "productor"?) — el propio texto copiado lo deja abierto
  con matices; es lectura para Javier y el asesor real, no una decisión de esta sesión.
- No se aplica ningún cambio de código, schema ni microcopy — las 14 marcas ⚠ quedan exactamente donde
  estaban, sin cotejar contra fuente oficial adicional.
- No se toca `docs/legal/ALCANCE_BETA.md` ni ningún otro documento — solo `PREGUNTAS_ASESOR.md`.
