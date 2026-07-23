# ERRORES DEL ASESOR — registro y reglas derivadas
> Documento vivo. Vive en `docs/`. Complemento de `ASESOR.md`.
> **Propósito:** que los errores del rol asesor no se repitan. Cada entrada registra QUÉ pasó, POR QUÉ pasó, QUIÉN lo detectó y QUÉ REGLA se deriva. Las reglas del final son de aplicación obligatoria.
>
> **Por qué existe:** el asesor no escribe código, así que sus errores no los caza ningún test. Se detectan tarde o no se detectan. Este registro es su única red.

---

## LAS REGLAS (leer antes de cada sesión)

**R1 · Verifica en la fuente antes de afirmar.** No deducir el estado de algo por su síntoma. Si es configuración externa (Meta, Resend, Railway, DNS), mirar EN la herramienta. Si es código, leer EL código. Si es un archivo, comprobar que existe.

**R2 · No cerrar un ticket sin evidencia de que el fix está donde debe.** "Claude Code dice que está hecho" no es evidencia; el diff o el test que lo prueba, sí.

**R3 · Orden de diagnóstico para "algo no llega/no funciona":** ① ¿se generó? ② ¿se envió/ejecutó? ③ ¿llegó? ④ ¿lo filtró/bloqueó alguien? Empezar por ①, no por ④.

**R4 · Una prioridad Highest exige una comprobación, no una sospecha.** Marcar algo como crítico sin verificar quema credibilidad y desvía trabajo.

**R5 · Antes de proponer infraestructura o proceso nuevo, preguntar qué dolor concreto resuelve.** Si no hay un incidente real detrás, es sobreingeniería.

**R6 · Coordinar recursos compartidos ANTES de repartir tareas**, no después del choque. Staging, `main`, un archivo caliente: si dos carriles pueden tocarlo, decirlo al asignar.

---

## REGISTRO DE INCIDENTES

### 2026-07-22 · #1 — Cerré SCRUM-54 sin verificar que el fix estaba en la ruta correcta
**Qué pasó:** di por finalizada la tarea de gatear `collect-rest` con `requireRole('admin')` basándome en el reporte del ejecutor. Semanas después, el recon de SCRUM-55 descubrió que `collect-rest` **seguía sin gate**: el fix se había aplicado a la ruta de al lado (`consolidar-albaranes`), que además citaba "S1/SCRUM-54" en su comentario.
**Por qué:** confié en un reporte en prosa en vez de comprobar el código. El ticket quedó cerrado, sin comentario de evidencia, y el agujero de seguridad siguió vivo.
**Quién lo detectó:** el carril B (Javier), semanas después.
**Coste:** una ruta de dinero abierta a rol Técnico durante semanas, y un ticket cerrado que mentía.
**Regla derivada:** R2.

### 2026-07-22 · #2 — Diagnostiqué un problema de entregabilidad de email que no existía (SCRUM-91)
**Qué pasó:** ante "no me llega el magic link a Hotmail", abrí ticket **Highest** sobre entregabilidad, con plan de revisar SPF/DKIM/DMARC y reputación del dominio con Microsoft.
**Por qué:** salté al paso ④ del diagnóstico (¿lo filtró el destino?) sin comprobar el ① (¿se llegó a generar?). La causa real era SCRUM-92: `/auth/login` solo buscaba en `Merchant`, y un `TeamMember` salía por un return silencioso **sin crear token ni llamar a Resend**. El email nunca salió.
**Quién lo detectó:** el carril B, leyendo el código en vez del síntoma.
**Coste:** un ticket Highest falso, y a punto de mandar al fundador a investigar DNS sin motivo.
**Regla derivada:** R3, R4.

### 2026-07-22 · #3 — Di por rota una plantilla de Meta sin mirar el panel (SCRUM-77)
**Qué pasó:** abrí ticket **High** afirmando que `payment_request_es` tenía el botón como URL estática con `{{1}}` literal, con acción manual del fundador y aviso de que necesitaría re-aprobación de Meta.
**Por qué:** el diagnóstico partió de una URL copiada de un móvil (`%7B%7B1%7D%7D0`), no del panel de WhatsApp Manager. El propio ticket recogía la sospecha de truncamiento al copiar y **no se confirmó antes de abrirlo**. Al mirarlo, la plantilla ya estaba en modo dinámico y correcta.
**Quién lo detectó:** el fundador, abriendo el panel.
**Coste:** una tarea manual falsa en la cola del fundador durante horas, presentada como urgente.
**Regla derivada:** R1, R4.

### 2026-07-22 · #4 — Afirmé que no existía política de privacidad, y existía (SCRUM-93)
**Qué pasó:** abrí ticket **Highest** diciendo "no existe política de privacidad publicada". Existe desde junio en `public/privacidad.html`, publicada en `yaqu.app/privacidad`.
**Por qué:** no comprobé el repo ni la web. Asumí la ausencia porque no había aparecido en ninguna conversación.
**Quién lo detectó:** la sesión legal, al ir a escribirla.
**Coste:** menor (el ticket sigue siendo válido: la política está incompleta y sin validar), pero el planteamiento era falso y habría llevado a duplicar trabajo.
**Regla derivada:** R1.

### 2026-07-22 · #5 — Repartí tres sesiones sobre una única BD de staging sin coordinar turnos
**Qué pasó:** asigné tareas a dos sesiones propias mientras el carril B trabajaba, todas usando la misma BD de staging. Resultado: tests fallando con errores distintos en cada corrida, una sesión viendo "la columna no existe" mientras otra aplicaba un `db push`, y dos sesiones paradas esperando ventana.
**Por qué:** el plan ya decía "la suite resetea la BD QA, uno a la vez" — pero al repartir tareas no lo apliqué. Coordiné después del choque, no antes.
**Quién lo detectó:** las propias sesiones, parando a preguntar.
**Coste:** ~1h de trabajo perdido y varios diagnósticos falsos de "test roto".
**Regla derivada:** R6.

### 2026-07-22 · #6 — Propuse worktrees DESPUÉS de que dos sesiones se pisaran, no antes
**Qué pasó:** dos sesiones sobre el mismo checkout: una hizo `checkout -b` y arrastró los cambios sin commitear de la otra. Acabó en cirugía de git y en un `db push` a producción partiendo de la premisa falsa de que una tarea estaba mergeada (no lo estaba).
**Por qué:** conocía el riesgo (estaba documentado como lección previa) y aun así autoricé la segunda sesión sin exigir el worktree primero.
**Quién lo detectó:** las sesiones, al encontrarse el árbol cambiado.
**Coste:** una hora de reconstrucción manual, y una columna aplicada a producción antes que su código.
**Regla derivada:** R6.

---

## PATRÓN COMÚN (lo que de verdad hay que corregir)

Cinco de los seis incidentes son **la misma cosa**: afirmar el estado del mundo sin comprobarlo. Un reporte, un síntoma, una suposición o una ausencia de mención se convirtieron en "esto es así" — y en tickets con prioridad alta, tareas manuales para el fundador y un ticket cerrado en falso.

**Lo que funciona como red:** en los seis casos, quien fue a mirar (el carril B, el fundador, una sesión de ejecución) lo corrigió. Los ejecutores verifican porque el código no les deja mentir; el asesor no tiene ese freno y debe imponérselo.

**Corolario para el fundador:** cuando el asesor afirme algo con seguridad sobre el estado del sistema, es legítimo preguntar *"¿lo has comprobado o lo estás deduciendo?"*. Esa pregunta habría evitado cuatro de estos seis.
