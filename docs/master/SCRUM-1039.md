# SCRUM-1039 · CONTABILIDAD — Completar las citas oficiales que faltan y llevar las Q-C al asesor

**Medido contra:** `origin/main` = `524ba73fac05904b9a50eb77282140a9a1f53e79` · 2026-09-22T09:09:06Z
**Puesto:** S0 + J4 · 22-sep-2026

Solo lectura y documentación (STOP fiscal declarado en el ticket, no bloqueante). Alcance: las
citas que `docs/producto/CONTABILIDAD.md` §4 marcaba NO VERIFICADO: los plazos trimestrales (el
art. 71 RIVA no los contiene), las órdenes ministeriales de los modelos, los arts. 7 y 20 LIVA, y
las retenciones del 2 % y 1 % que admite `retencionIrpf.ts:54`.

## Qué se hizo

1. Se bajaron de nuevo las cinco fuentes de §8 (GET público, 22-sep) + una fuente NUEVA: **Orden
   EHA/3786/2008** (aprueba el modelo 303), única orden ministerial localizada y citada en esta
   pasada. Método: descarga directa (no vía LLM — el resumidor de WebFetch tiene un tope de 125
   caracteres por cita y no sirve para transcribir texto legal literal), conversión a texto plano
   con la MISMA normalización que el comprobador, y búsqueda del artículo por offset. Scripts de
   evidencia: `docs/master/evidencias/scrum1039/`.
2. **10 citas nuevas** añadidas a `docs/producto/CONTABILIDAD.md` §3 (RIRPF art. 95.4-6, LIVA arts.
   7 y 20.Uno, Orden EHA/3786/2008 art. 7.2). El comprobador (`docs/verificacion/comprobar-citas-contabilidad.mjs`,
   con `ORDEN303` añadida a `FUENTES`) corre **26/26 citas literales, control negativo OK, exit 0**
   — ver `docs/master/evidencias/scrum1039/comprobador-26-26.txt`.
3. `docs/producto/CONTABILIDAD.md` §4: **Q-C5 y Q-C9 quedan RESPONDIDAS por cita** (pendientes solo
   de la confirmación de J4); **Q-C8 parcialmente** (modelo 303 sí, 130/131/111/115/347/390 no).
4. `docs/legal/PREGUNTAS_ASESOR.md`: nueva sección «Q-C1…Q-C9 · Contabilidad para un autónomo de
   oficio», con las 9 preguntas, marcada explícitamente como **propuesta de S0 pendiente del visto
   bueno de J4** (dueño del fichero).

## Hallazgo no pedido por el ticket, con víctima hoy

El RIRPF art. 95.6.2º lista los epígrafes IAE a los que se aplica el 1 % de retención en módulos, y
coincide CASI EXACTAMENTE con los oficios que YaQu tiene como target (`trade` enum: electricista,
fontanero, reformista, pintor, cerrajero, climatización): 504.2/3 fontanería-frío-calor, 501.3
albañilería, 505.5 carpintería/cerrajería, 505.6 pintura. Esto responde de fondo a Q-C5 y es un dato
de producto, no solo fiscal: si una parte relevante de los profesionales de YaQu factura en módulos,
el 1 % no es un caso residual.

## Sin código de producto

Solo `docs/` (CONTABILIDAD.md, PREGUNTAS_ASESOR.md — dueño J4, en revisión) y
`docs/verificacion/comprobar-citas-contabilidad.mjs` (una línea: añadir la fuente nueva a la lista).

## Pendiente (no cerrado por esta tanda)

Órdenes ministeriales de 130/131, 111, 115, 347 y 390 — no localizadas. Art. 20.Uno de la LIVA
revisado solo parcialmente (encabezado + 5 primeros apartados de ~35): si el asesor confirma que no
hay más candidatos para un oficio, no hace falta completar el resto.
