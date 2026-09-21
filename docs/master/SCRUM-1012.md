# SCRUM-1012 · Diseño de producto: CRM mega pulido y apartado de Contabilidad

**Medido contra:** `origin/main` = `6db52e1661ca63562ff082a45f970ad29be26ac9` · 2026-09-21T15:07:00Z

**Estado (21-sep-2026, cierre por fin de uso): BORRADOR entregado en la rama, sin tickets creados en Jira.** Sesión `sd-21` (diseño de producto), sin código de producto.

- **Base medida:** `origin/main` = `6db52e1661ca63562ff082a45f970ad29be26ac9` (`Merge pull request #1588`), worktree `sd-21`, solo lectura; hora local de la máquina 21-sep-2026 ~15:07 UTC (reloj ≈5 min por delante de GitHub).
- **Entregables:** `docs/producto/CRM.md` (PASO 0 medido, comparativa ellos/nosotros/diferencia, 19 candidatos en 3 olas, decisiones D1-D7) ·
  `docs/producto/CONTABILIDAD.md` (PASO 0 medido, 16 citas oficiales comprobadas, 9 preguntas al asesor, 15 candidatos en 3 olas, decisiones D1-D6) ·
  `docs/verificacion/comprobar-citas-contabilidad.mjs` (comprobador con control negativo: 16/16, exit 0).
- **No hecho:** crear los tickets en Jira; comentario de decisiones en SCRUM-1012; `npm run guards:entrada` (el worktree no tiene `node_modules`); empujar la rama.
- **Hallazgos con defecto por confirmar en staging (A2):** CRM: duplicados fuera de orden de ruta, PATCH inexistente al guardar NIF desde el Trabajo, cifras de la ficha con tope de 20. Contabilidad: la retención del perfil probablemente no se guarda; JUST en libro; `paidAt` en criterio de caja; gastos sin base fuera del libro.
- **Hallazgo de proceso:** por `docs/equipo/dos-equipos.md` §3 las pantallas de clientes son de J2 y libros/facturas de J1; los tickets llevan `equipo-luis` por encargo del fundador → decisión D1 (CRM) y D6 (Contabilidad).
- **Errores propios:** (1) una primera cita de "15 por ciento" del RIRPF era del art. 101 (propiedad intelectual), no del 95 de profesionales: se corrigió leyendo el artículo; (2) tres pares de comillas angulares que no eran citas habrían salido como no encontradas: se cambiaron antes de correr; (3) subagentes de medición gastaron ~700k tokens en total (204k + 297k + 217k): el informe de competencia tardó 8,7 min y los dos de código 11 y 16 min.
- **Cita de método:** `docs/legal/REGISTRO_JORNADA_ES.md` (96/96).
