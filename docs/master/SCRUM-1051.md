# SCRUM-1051 · Facturar con inversión del sujeto pasivo (ISP) en obra — construido bajo GO acotado

**Fecha:** 23-sep-2026 · **Carril:** J1 (camino de emisión) · **Gate:** STOP fiscal (reglas 29, 38, 40) — **GO de Javier, Jira comentario 16594**, acotado a la causa `S2` (rojo primero, arreglo, control positivo — mismo método que el reloj de SCRUM-735)
**Medido contra:** `origin/main` = `13e967cde072faacf8abb4c3d15019a25ad9b721` · 2026-09-23T10:15:54Z

## Encargo

SCRUM-1051 («ISP en obra/subcontrata, entre profesionales») lleva `esperando-asesor` y depende
de Q-C2 (SCRUM-1039): *"Cómo debe verse en la factura y quién es «promotor/contratista» a
efectos prácticos NO está verificado... Hasta responderse, NO se implementa."* Mismo método que
SCRUM-1050: comprobar si esa espera sigue vigente y medir el defecto con el código real.

## PASO 1 — ¿sigue esperando asesor?

**No.** El apéndice de `docs/master/SCRUM-1023.md` clasifica **Q-C2 entre los 17 grupos que NO
necesitan asesor nuevo**: "🟢 Sustancialmente respondida por F4 (LIVA 84.f, subcontrata
explícita)". La sección F de `docs/legal/PREGUNTAS_ASESOR.md` (bloquea SCRUM-212) trae la cita
literal y **cotejada el 23-sep (SCRUM-1088) contra fuente jurídica** (Iberley, texto vigente):

> *"Ejecuciones de obra, con o sin aportación de materiales, así como las cesiones de personal
> para su realización, consecuencia de contratos directamente formalizados entre el promotor y
> el contratista..."* (art. 84.Uno.2.º.f LIVA) — **y el cotejo confirma explícitamente el matiz
> "o subcontrata": la regla aplica igual cuando el destinatario es el contratista principal u
> otros subcontratistas.**

Es la misma fuente que cita el propio ticket SCRUM-1051 (art. 84, letra f), palabra por palabra.
El código AEAT es `S2` — cotejado contra el XSD vendorizado del repo (`SuministroInformacion.xsd:1245-1247`,
"OPERACIÓN SUJETA Y NO EXENTA - CON INVERSIÓN DEL SUJETO PASIVO").

**A diferencia de SCRUM-1050:** aquí SÍ hay caso de uso real y citado — un electricista, fontanero
o instalador de YaQu que subcontrata o es subcontratado en una obra. No es un supuesto de manual.

## PASO 3 — el defecto, medido con el código real (no creído)

Fabriqué una factura de subcontrata (base 1.000 €, ISP: el total a cobrar es la base, sin
cuota — aceptación punto 2 del ticket) y la pasé por el mismo clasificador que SCRUM-1050
(`verifactu.service.ts:791` → `clasificarDetalleDesglose`, `registro.builder.ts:298-318`):

```
calcVatBreakdown -> {"entries":[{"rate":0,"base":1000,"cuota":0}],"base":1000,"cuota":0}
RECHAZADA por DesgloseNoClasificableError :: ... tramo de IVA al 0% (base 1000.00): no se puede
saber si es sujeta al 0%, exenta (art. 20 LIVA) o no sujeta ...
```

**Mismo defecto que SCRUM-1050, exactamente**: hoy no existe una `causa` por línea, así que la
única forma de que una línea ISP no repercuta IVA es poner `tax: 0`, que el clasificador rechaza
sin distinguir ISP de exenta de no-sujeta.

Comprobé también si declarar el tipo nominal (21 %) con cuota forzada a 0 es una vía existente:
no lo es. `calcVatBreakdown` con `tax: 0.21` calcula la cuota real (210 €), no la pone a 0 — no
hay hoy ningún campo que diga "aplica el 21 % pero lo autorrepercute el destinatario".

## Relación con SCRUM-1050

El propio ticket (punto 5 de aceptación) pide compartir con «exentas y no sujetas» el mismo
mecanismo de causa por línea. SCRUM-1050 mide el defecto pero Javier decide NO construirlo
porque E1/N1 no tienen caso de uso citado. **Este ticket SÍ lo tiene (S2, subcontrata).**
Construir el mecanismo de causa aquí, con S2 como primer y único consumidor real, deja la puerta
abierta a E1/N1 sin coste extra el día que aparezca su caso — no habría que rediseñar nada.

## Schema

Igual que SCRUM-1050: `Invoice.lines` es `Json` (`prisma/schema.prisma:637`). Añadir `causa` por
línea no necesita ALTER.

## PASO 4 — construido, dentro del GO acotado (Jira 16594)

**El GO autoriza exactamente:** causa por línea como lista cerrada con los códigos de SCRUM-1088
· un único valor ACTIVO (`S2`) · cuota 0 sin pasar por «tipo 0 %», y su validación · sin ALTER ·
nada más. No autoriza activar `E1`/`N1`, ni la validación de NIF del destinatario (toca
`resolverSinDestinatario`/`MODO_SIN_DESTINATARIO`, familia de identidad fiscal congelada tras el
dictamen P11 — fuera de este GO), ni UI, ni el selector, ni el resumen del 303 (Q-C2 lo fija, no
esta entrada).

**Cambiado:**

1. `src/modules/invoicing/domain/vat.service.ts` — nuevo tipo `Causa = 'S2'` (lista cerrada,
   comentario explica por qué E1/N1 no están); `VatLine`/`VatRateEntry` llevan `causa?: Causa`.
   `calcVatBreakdown` agrupa por `(rate, causa)` — una línea con causa NUNCA se funde con una sin
   causa — y fuerza cuota a 0 para cualquier línea con causa (no por su `tax`, por la causa).
2. `src/modules/fiscal/verifactu/registro.builder.ts` — nueva constante
   `CALIFICACION_INVERSION_SUJETO_PASIVO = 'S2'`. `clasificarDetalleDesglose` resuelve
   `causa === 'S2'` → `{claveRegimen: '01', calificacion: 'S2', baseImponible}`, SIN
   `TipoImpositivo` ni `CuotaRepercutida` (los dos `minOccurs="0"` en el XSD — no se declara un
   "tipo 0 %"). El caso sin causa (rate ≤ 0) sigue lanzando `DesgloseNoClasificableError`
   exactamente igual que antes — no se relajó nada.
3. `src/core/validation/causaLineaEmitible.ts` (NUEVO) — mismo patrón que
   `tiposIvaEmitibles.ts` (SCRUM-771): portón puro, lista cerrada `['S2']`, se llama ANTES de
   `allocateInvoiceNumber`. Rechaza `E1`/`N1`/cualquier otra cosa con un mensaje que nombra el
   motivo (evita reabrir SCRUM-1050 por una boca nueva).
4. `src/lib/invoicing.ts` — llama `exigirCausaLineaEmitible` justo donde ya llama
   `exigirTiposDeIvaEmitibles` (SCRUM-771), mismo sitio, misma razón. **Sólo este camino** (el
   común de emisión de facturas): NO se tocaron `jobs.routes.ts` / `albaranes.routes.ts` /
   `quotes.routes.ts` / `quotesAdmin.routes.ts` / `recapitulativa.service.ts` — presupuestos y
   partes de trabajo son carril de S1/otros, y hoy ninguna boca escribe `causa` en una línea (no
   hay UI), así que el portón no cambia nada real todavía en ningún camino.
5. `tests/scrum1051-isp-s2.test.mjs` (NUEVO, 4 tests) — ISP sella con S2 y valida contra el XSD
   oficial · factura mixta 21 %+ISP sella las dos entradas por separado · **ratchet**: un 0 % SIN
   causa sigue excluyéndose exactamente igual que antes de este ticket (no relaja SCRUM-209/1050)
   · el portón rechaza E1/N1 y acepta S2/sin-causa.

**Control positivo, medido con el código real (dist compilado):** ISP (base 1.000) sella con
`CalificacionOperacion=S2`, sin `TipoImpositivo`/`CuotaRepercutida`, `BaseImponible=1000.00`.
Mixta 21 %+ISP: las dos entradas (S1 y S2) salen separadas y correctas. El caso rojo original
(0 % sin causa) sigue rechazándose con el mismo `DesgloseNoClasificableError`, palabra por
palabra.

**Tests corridos:** `tests/scrum1051-isp-s2.test.mjs` (4/4 verde) + la batería VeriFactu
completa — scrum145/149/153c/173/198/205/209 (40/40 verde, 7 SKIP declarados por
`QA_DB_TEST`, no ejecutables en esta máquina) — sin ninguna regresión. `tsc` (build completo del
repo) sin errores, lo que confirma que `causa?: Causa` no rompió ningún consumidor tipado de
`VatRateEntry`/`VatLine` (303, exports, PDF, libroRegistro, reports). Corrí también la tanda
COMPLETA (973 ficheros) una vez: además de los dos bloqueos de abajo, encontré y arreglé una
regresión real mía (`entries` llevaba `causa: undefined` explícito en TODA línea, y rompía
`assert.deepStrictEqual` en `tests/vat.test.mjs` y `tests/scrum616-*`; ahora `causa` sólo aparece
cuando existe) — y dos fallos **no relacionados con este cambio**, verificados en aislamiento:
`tests/scrum910d-microcopy-recibo-pendiente.test.mjs` (los 5 asserts de contenido pasan; revienta
después con `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, un crash nativo de
libuv/Windows en el cierre del proceso, no de mi código) y `tests/scrum939b-*` (censo de una
"falsa declarada" sobre una ruta de `gh.exe` de esta máquina, en `cerebro-yaqu`, ajeno a
VeriFactu/IVA). Los dos se declaran, no se investigan más — no son de este ticket.

## 🔴 BLOQUEO · un trinquete estático (SCRUM-524b) da falso positivo, sin construir su arreglo

`tests/scrum524b-trinquete-de-la-tabla.test.mjs` cae. Medido, no asumido: **no es una regresión
fiscal** — es un trinquete AST que hoy hace de PROXY de la regla real y mi cambio le rompe el
proxy sin romper la regla.

* La regla real (código AEAT **1207**, `scripts/_tabla-verifactu-catalogo.mjs:261`):
  *"`CuotaRepercutida` distinta de 0 sólo con `CalificacionOperacion` = S1"*. **Mi código la
  cumple**: la rama `S2` no escribe `cuotaRepercutida` en absoluto (ver PASO 4, punto 2).
* Su ancla hoy (`scripts/tabla-verifactu.mjs:255`, checker `propiedad` con `todas: true`) es más
  estrecha que la regla: comprueba *"TODAS las asignaciones a `calificacion` dentro de
  `clasificarDetalleDesglose` valen `S1`"* — válido cuando la función sólo tenía una rama, falso
  ahora que tiene dos. El checker sólo sabe comparar una propiedad contra UN valor; no sabe
  expresar "si `cuotaRepercutida` aparece, `calificacion` de ESE MISMO literal es S1" — eso pide
  un tipo de ancla nuevo (comparar dos propiedades del mismo objeto), no tocar el valor de la
  que ya existe.
* **No lo arreglo aquí.** Rescribir el checker es tocar infraestructura de verificación
  compartida por las otras 40 comprobaciones del catálogo (`scripts/tabla-verifactu.mjs`), fuera
  de "nada fuera de eso" del GO, y con mi contexto ya sobre el umbral no es momento de diseñarlo
  con el cuidado que pide software que otros 40 códigos usan. Bajar el suelo o relajar `todas`
  para que pase sin más SÍ sería debilitar el guard (regla 41) — no lo hago.
* **Propuesta para quien lo retome:** un checker nuevo (p. ej. `propiedadLigada`) que, por cada
  objeto-literal devuelto dentro de `dentroDe`, exija: si tiene la propiedad `siPresente`
  (`cuotaRepercutida`), entonces la propiedad `nombre` (`calificacion`) vale `valor` (`S1`). Es
  aditivo — no toca los otros 40 anclas — y expresa la regla 1207 tal cual está escrita, en vez
  de una aproximación que sólo servía con una rama.

## 🔴 BLOQUEO 2 · mover código corrió las líneas que dos auditorías citan (SCRUM-525d)

Al insertar código en `registro.builder.ts` y `src/lib/invoicing.ts`, las líneas de
`construirSobreRegFactu`, `xmlSistema` y `exigirDocumentoEmitible` se movieron, y
`docs/legal/AUDITORIA_CAMINO_EMISION.md` y `docs/legal/PREGUNTAS_ASESOR.md` las citan por número
(`tests/scrum525d-anclas-que-apuntan.test.mjs` cae, 2 tests: "el defecto real... pone el guard en
rojo" y "toda coordenada CON TESTIGO apunta a lo que dice").

**Lo intenté y lo deshice.** Corregir el número parecía mecánico (el propio guard da el número
nuevo), pero mi frase de explicación ("SCRUM-1051 movió la línea...") contenía la palabra `S2`, y
eso activó un SEGUNDO mecanismo de este mismo fichero de test: un censo de "testigos"
(`scripts/_anclas-sin-testigo.congelado.mjs`) que sube de cobertura cuando una cita gana una
palabra que antes no tenía, y pide registrar esa subida en el mismo commit — infraestructura
adicional, encadenada, que no entendí a tiempo de arreglar bien con el contexto que me quedaba.
**Deshice las tres ediciones** (`git checkout` sobre mi propio worktree, sin tocar nada ajeno) en
vez de dejar los documentos a medias o inventar una entrada de censo sin entender su contrato.

**No lo arreglo aquí, por la misma razón que el bloqueo 1:** contexto por debajo del umbral que
pide diseñar esto con cuidado, y fuera de "nada fuera de eso" del GO.

**Por eso esta rama queda en BORRADOR y sin auto-merge** hasta que se decida cómo seguir. El
resto de la tanda (mi test nuevo + la batería VeriFactu completa) está en verde; los dos rojos que
quedan están aislados, medidos y con causa conocida — ninguno es una regresión fiscal.

## Lo que NO cubre esta entrada (fuera del GO, a propósito)

* No activa `E1` ni `N1` — el portón los rechaza expresamente.
* No construye el selector de UI, ni un flag «lo activa el profesional» (persistirlo sería
  schema, y el GO prohíbe tocar `prisma/schema.prisma`).
* No valida el NIF del destinatario (punto 1 y 6 de aceptación del ticket): toca la familia de
  `resolverSinDestinatario`/`MODO_SIN_DESTINATARIO`, congelada tras el dictamen P11 — es
  identidad fiscal, y el GO la excluye explícitamente. **El ticket sigue sin poder cerrarse por
  esto**, y vuelve al fundador si se quiere avanzar.
* No decide cómo entra ISP en el resumen del 303 trimestral (lo fija Q-C2).
* No toca `jobs.routes.ts`/`albaranes.routes.ts`/`quotes*.routes.ts`/`recapitulativa.service.ts`
  — fuera de mi carril y sin boca hoy que escriba `causa`.
