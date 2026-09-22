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

## SCRUM-1012b · Contabilidad: cómo lo resuelve la competencia y qué copiar (Sesión 0, 21-sep-2026)

**Medido contra:** `origin/main` = `b6cde0517649d991a1b08eabb50017a81a03acfb` (código leído) · 2026-09-21T17:41:02Z (hora de GitHub); al cerrar, `origin/main` ya iba en `4f40e95c169281beb224e7b61c904974b4534141`.

- **Encargo (fundador, vía orquestador -06):** «para las dudas de contabilidad, fijarnos en cómo lo hacen los competidores y copiarles todo»: (a) perfil e IRPF, (b) IVA 10 % en reforma, (c) inversión del sujeto pasivo, (d) exento/no sujeto, (e) modelos y plazos, en Verifacturamos, Billin, Contasimple, FacturaDirecta, Holded, Quipu, Anfix y Sage.
- **Entregable:** `docs/producto/CONTABILIDAD-COMPETENCIA.md`: una tabla por punto (competidor · qué hace · fuente con enlace y marca de fiabilidad) y una recomendación por punto («copiar tal cual» · «copiar con matiz» · «no copiar y por qué»). Rama `scrum-1012b-contabilidad-competencia`.
- **Método:** 4 subagentes leyeron web pública (277 llamadas) y la Sesión 0 releyó 11 páginas distintas con lectura propia y comprobó Anfix y Sage contra los volcados de página. Solo documentación pública; nadie abrió cuentas en esta primera pasada. Marcas: ✔ releído · ◐ solo subagente · ✖ fragmento de buscador.
- **Tickets nuevos (6), etiquetados `competencia` + `equipo-*` + `area-*`:** SCRUM-1072 perfil-actividad (Luis) · SCRUM-1073 retención por cliente y factura (Javier, emisión + ALTER) · SCRUM-1074 presupuesto con reforma de vivienda (Luis) · SCRUM-1075 aviso de fin de trimestre (Luis) · SCRUM-1076 calendario de plazos (Javier, modelos) · SCRUM-1077 modelo 390 (Javier, modelos). Ya existían y se citan sin duplicar: 1050, 1051, 1052, 1053, 1063-1067, 1048/1049, 322.
- **Hallazgo lateral:** YaQu ya distingue tres estados de retención («No consta» · «No aplico retención» · 15/7/2/1; `prisma/schema.prisma:155-169`), más prudente que lo que se ve en los ocho: por eso «apagada por defecto» (Billin) queda como «no copiar».
- **Hallazgo para el asesor:** los competidores **se contradicen sobre las comunidades de propietarios** en el 10 % de reforma (Verifacturamos 21 %, Billin 10 %, Anfix «comunidad o persona física»): va a Q-C1 y no se copia ninguna.
- **Errores propios:** los subagentes superaron el tope de 40 llamadas (102, 46, 56, 73); intenté releer Billin con mi navegador y recibí un desafío anti-bot, que no se rodea (queda ◐); una cifra («17 celdas sin encontrar») que escribí sin contarla se quitó antes de empujar.
- **No hecho:** ver el formulario real de ningún competidor (valor «por defecto» de la retención, PDF que imprime cada uno); `npm test` completo (solo docs).