# Reconciliación master viejo → nuevo (14-jun-2026)

Análisis del diff entre `YAQU_MASTER_v5.3_pre-14jun_con-progreso.md` (anterior) y el
`YAQU_MASTER.md` canónico actual (nueva investigación de mercado del fundador, rev. 13-jun).

## Conclusión: CERO impacto en código ya construido

El diff es pequeño (42 líneas añadidas, 13 modificadas) y **todo es GTM/inteligencia de
mercado**. Las 26 Partes son idénticas en estructura. El propio footer del nuevo master lo
dice: *"sin cambio de estrategia ni de sprints, regla 13 intacta"*.

**No cambian:** Parte L (estados), Parte P (flags), Parte N5/K1 (microcopy de landing/bot),
Parte U (registro y orden de sprints). → Nada de lo construido (V0-*, DOCS-F1, SIF-1
S1-0b/A/B/C/E/H, WA-0b, J8, plantillas) queda invalidado ni necesita reescritura.

## Qué cambió exactamente (y por qué no afecta al código)

| Sección | Cambio | ¿Afecta código? |
|---|---|---|
| A6 / A7 (nueva) | Posicionamiento competitivo + **"la morosidad es el dolor nº1, no la factura"** | No (estrategia/GTM) |
| H5/H6/H7 | Guiones de venta, objeciones y mensajes reescritos con el ángulo morosidad | No (copy de venta/calle, NO es N5/K1 de producto) |
| Regla 26b (nueva) | El aplazamiento de VeriFactu a 2027 enfrió el miedo fiscal; gancho nº1 = morosidad, VeriFactu = pilar de confianza nº2; no apoyar el GTM en la fecha | No (guía GTM) |
| J1 (filas plantillas) | Revertía la anotación 14-jun de las 2 plantillas nuevas | Re-aplicada (cosmético) |
| Z2 (nueva) | Banco de oportunidades (research) — todo "no construir antes de 25 pagantes" | No (explícitamente no-build) |
| Z3 (nueva) | Competencia directa a vigilar (PresupuestAPP, STEL, Holded/Quipu) | No (inteligencia de mercado) |
| Apéndice A | Claims actualizados: morosidad (PMP construcción 96,5 d, 5.350 €/año, ~44% autónomos), adopción VeriFactu baja, competidores | No (referencias/fuentes) |

## Única nota con relevancia de producto (no es un bug, mejora futura)

Apéndice A añade: *"WhatsApp utility ES ~0,025 $/msg · Meta cobra por mensaje ENTREGADO
desde jul-2025 — modelar margen recordatorios"*. El modelo de coste de **J8**
(`WA_UTILITY_COST_ES = 0,023 €` por plantilla) sigue siendo una estimación válida, pero
podría afinarse para cobrar por mensaje *entregado* (estado delivered/read) en vez de por
enviado. **No es un break**; queda como mejora opcional de J8 si interesa el margen fino.

## Acciones tomadas (14-jun)
- Nuevo master instalado como canónico; anterior preservado en este `historico/`.
- Bloque "ESTADO DE EJECUCIÓN" re-añadido al inicio de la Parte U (progreso de sprints).
- Fila J1 de las 2 plantillas nuevas re-anotada (builder+spec listos, copy neutro).
