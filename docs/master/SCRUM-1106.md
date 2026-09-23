# SCRUM-1106 · Volcado de la respuesta del asesor a Q-C1, Q-C2, Q-C3, Q-C4, Q-C5 y Q-C7 (segunda tanda del 23-sep)

**Fecha:** 23-sep-2026 · **Carril:** J4 · **Gate:** ninguno — propone, no publica ni cobra.
**Medido contra:** `origin/main` = `a900d4484bddd80d3b0351294de6b6d2c53cc851` · 2026-09-23T17:53:14Z
**Depende de:** SCRUM-1104 (PR #1737, aún sin mergear) — esta rama nace de esa misma punta porque
toca las dos mismas rutas; el diff que se vea contra `main` hasta que #1737 mergee incluye las dos.

## Encargo

Jira SCRUM-1106: volcar la segunda tanda de respuestas del asesor (Q-C1, Q-C2, Q-C3, Q-C4, Q-C5 y
Q-C7) a `docs/legal/PREGUNTAS_ASESOR.md` y `docs/producto/CONTABILIDAD.md` §4, con la misma regla de
SCRUM-1104: ninguna cita ⚠ (de memoria) entra como comprobada. Diferencia con la tanda anterior: esta
vez el asesor SÍ trae dos fuentes que dice haber verificado él mismo hoy (art. 6.1.m/6.2.b ROF y dos
páginas de la AEAT sobre reformas de vivienda) — el encargo pide no meterlas en el mismo saco que
las ⚠.

## Qué se hizo

1. **`docs/legal/PREGUNTAS_ASESOR.md`** — Q-C1, Q-C2, Q-C3, Q-C4 y Q-C7 pasan de abiertas a
   RESPONDIDAS; Q-C5 se **sustituye entera** (su respuesta parcial del 22-sep quedaba corta: ahora
   se sabe que la retención en factura emitida es CERO para este perfil). Cada cita ⚠ del asesor
   queda marcada NO VERIFICADO, fila por fila / párrafo por párrafo.
2. **Las dos fuentes que el asesor dice haber verificado hoy (AEAT reformas, ROF art. 6.1.m/6.2.b)
   se citan en `PREGUNTAS_ASESOR.md` como fuente, sin ⚠** — tal como pide el encargo. **No las
   promuevo a `CONTABILIDAD.md` §3** (la tabla de citas comprobadas por script): intenté cotejar el
   art. 6 ROF por mi cuenta con WebFetch sobre el BOE consolidado y el resultado fue **ambiguo en la
   letra exacta** (mi consulta devolvió dos textos distintos, los dos etiquetados «letra m)», en la
   misma respuesta) — no es una verificación a la altura del script de §3, así que lo digo en vez de
   forzarla. La sustancia («inversión del sujeto pasivo», sin cuota ni tipo) sí coincide con lo que
   trae el asesor.
3. **`docs/producto/CONTABILIDAD.md`** — banner v0.12 (no se sobrescribe v0.10 ni v0.11), las seis
   filas de §4 actualizadas con resumen + remisión al detalle, y la nota de fuentes sin descargar
   ampliada con los artículos nuevos de esta tanda (todos NO VERIFICADO). No se tocó §3.
4. **Alcance revisado, tal como pide el ticket, para:**
   - **SCRUM-1052** (IVA 10 % reformas): el 40 % se mide sobre la operación entera; hace falta una
     declaración firmada del cliente para los "más de dos años" (reutiliza la firma existente).
     Hallazgo llevado al volcado: mantenimiento de instalaciones (calderas, revisiones) **no** es
     ejecución de obra → 21 % siempre.
   - **SCRUM-1051** (ISP): alcance **muy estrechado** — sólo aplica si la obra global es
     construcción/rehabilitación (no una reforma de baño) y el destinatario lo comunica
     expresamente.
   - **SCRUM-1054** (suplidos y recargo): tres condiciones acumulativas para suplidos (factura a
     nombre del cliente, mandato expreso identificando el gasto, cuantía exacta); recargo casi
     irrelevante para un oficio (solo entregas de bienes a minorista).
   - **SCRUM-1053 / SCRUM-1073** (retención): 🔴🔴 para este perfil la retención en factura emitida
     es CERO en todos los casos. **No decido esto yo**: queda marcado como decisión del fundador,
     igual que lo dejó el propio ticket.

## Lo que NO cubre esta entrega

* **No verifica por script** ninguna de las citas ⚠ nuevas (LIVA arts. 170.Dos.2º, 87.Uno,
  91.Uno.3.1º, 20.Uno.22º.B, 148-149, 163.Uno, 170.Dos.3º · RIVA arts. 24 *quater*, 61 · RIRPF art.
  76 · LCSP art. 107). Quedan NO VERIFICADO — trabajo de CON-03.
* **No promueve a §3** el art. 6.1.m/6.2.b ROF ni las páginas AEAT de reformas, pese a que el
  asesor las da por verificadas: mi propio cotejo no llegó al nivel que exige esa tabla. Quien
  quiera cerrarlo, tiene el punto exacto de duda escrito arriba (la letra del art. 6.1).
  Se citan igualmente en `PREGUNTAS_ASESOR.md`, tal como pide el ticket.
* **No decide** si se construye el flujo de retención-emitida para un segmento de módulos que hoy no
  existe (SCRUM-1053): eso es explícitamente del fundador.
* **No toca** el hallazgo de "mantenimiento → 21 %" contra el código: el propio encargo dice que el
  orquestador ya lo está midiendo y abrirá ticket aparte si hace falta.
* No propone ningún texto de pantalla. Cero claims fiscales (regla 7).

## Cómo se verifica

`git diff` de las dos rutas contra el commit de SCRUM-1104 en esta misma rama: sólo las filas/
párrafos de Q-C1 a Q-C5 y Q-C7 cambian; Q-C6, Q-C8 y Q-C9 (ya tratadas en otra entrega) quedan
intactas.
