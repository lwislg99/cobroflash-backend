# ERRORES DEL ASESOR — registro y reglas derivadas
> Documento vivo. Vive en `docs/`. Complemento de `ASESOR.md`.
> **Propósito:** que los errores del rol asesor no se repitan. Cada entrada registra QUÉ pasó, POR QUÉ pasó, QUIÉN lo detectó y QUÉ REGLA se deriva. Las reglas del final son de aplicación obligatoria.
>
> **Por qué existe:** el asesor no escribe código, así que sus errores no los caza ningún test. Se detectan tarde o no se detectan. Este registro es su única red.

---

## LAS REGLAS (leer antes de cada sesión)

**R1 · Verifica en la fuente antes de afirmar.** No deducir el estado de algo por su síntoma. Si es configuración externa (Meta, Resend, Railway, DNS), mirar EN la herramienta. Si es código, leer EL código. Si es un archivo, comprobar que existe.

**R2 · No cerrar un ticket sin evidencia de que el fix está donde debe.** "Claude Code dice que está hecho" no es evidencia; el diff o el test que lo prueba, sí. **Método concreto:** `git merge-base --is-ancestor <commit> origin/main` (o el "This branch has been merged" de GitHub) — nunca el estado de Jira ni el resumen en prosa del ejecutor. Si el comando no confirma que el commit es antepasado de `main`, el fix no está ahí, aunque el ticket diga "Cerrada" y el reporte diga "hecho".

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

### 2026-07-23 · #7 — Cerré SCRUM-114 fiándome de un reporte, sin verificar que el código estaba en main
**Qué pasó:** cerré el ticket SCRUM-114 (scrum47/scrum49 debían autoimponerse `WHATSAPP_DRY_RUN=1` en vez de depender de que quien invocara el test no lo olvidara) dando el fix por mergeado. La rama con el código real (`scrum-114-enviar-para-firmar-ok-false`) nunca llegó a `main`: lo único que aterrizó fue un PR ajeno de otro carril (#112, `scrum-114-runbook-falso-rojo`) que documentaba el mismo hallazgo en `docs/QA/SUITE_REGRESION.md` ("trampa 7") sin tocar una línea de código. Jira decía "Cerrada"; el repositorio decía otra cosa.
**Por qué:** di el ticket por bueno porque el relato del cierre coincidía con lo esperado (la misma causa raíz que el propio reporte ya había distinguido con detalle), sin el paso mínimo de comprobar que el commit era antepasado de `main`. Es el MISMO fallo que el incidente #1 (SCRUM-54): confiar en el reporte en vez de en el repositorio.
**Quién lo detectó:** la siguiente tarea (SCRUM-126), al tocar los mismos ficheros para unificar el shape de los endpoints de envío y encontrar que `WHATSAPP_DRY_RUN` seguía sin autoimponerse — unas 6 horas después de cerrada la 114.
**Coste:** dos tests gateados (scrum47, scrum49) quedaron frágiles frente a quien los invocara durante esas 6 horas sin que nadie lo supiera; el fix tuvo que reaplicarse dentro de SCRUM-126 en vez de tener su propio PR revisable.
**Regla derivada:** R2 (reforzada arriba con el método exacto de verificación).

### 2026-07-24 · #8 — Di por rota la vía de transferencia midiendo la PÁGINA equivocada (SCRUM-4 → SCRUM-150)
**Qué pasó:** al verificar el cobro por transferencia (SCRUM-4) reporté un 🔴 grave: *"el cliente no ve el IBAN ni la referencia — un método de cobro que no se puede completar"*. Era falso. El script medía `/pay/invoice`, que es el **selector** ("Elige cómo pagar"), donde transferencia es un **enlace**; los datos viven en `/pay/bank/:token`. Al mirar `/pay/bank`: IBAN, referencia y dos botones "Copiar", exactamente como promete N2:325.
**Por qué:** el assert estaba bien escrito y la medición era correcta — *sobre la URL equivocada*. `muestra_iban:false` era **verdad** en esa página. Nada en el resultado indicaba que la página no fuera la del flujo: un rojo bien fundado y un rojo mal dirigido se leen idénticos.
**Quién lo detectó:** yo mismo, al **abrir la captura** antes de crear el ticket 🔴. La imagen mostraba el selector con "Transferencia bancaria ›" como enlace — la medición numérica no lo mostraba y no podía mostrarlo.
**Coste:** casi se abre un 🔴 falso sobre un método de cobro (el tipo de alarma que reordena prioridades). Contenido antes de publicarse; el ticket real que salió (SCRUM-150) es un Medium de UI, no un bloqueo de cobro.
**Regla derivada — nueva:** **un assert sobre la URL equivocada es verde o rojo con la misma confianza.** La medición no valida su propio objeto: antes de fiarse de un resultado automático sobre una pantalla, hay que confirmar que es LA pantalla del flujo (una captura, el HTML, o un assert de identidad del tipo "esta página contiene el título esperado"). Aplica a todo el trabajo de guards de esta semana: un test puede estar midiendo el sitio equivocado con total seguridad.

### 2026-07-24 · #9 — Escribí en el runbook con un script y no releí el resultado (lección propia, del ejecutor)
**Qué pasó:** al añadir al runbook de QA el apunte del error `P1013` del `db push`, lo inserté con un script en vez de a mano. El texto llevaba un retorno de carro escapado; el script lo **interpretó** y partió el párrafo en tres trozos sin sentido. Se commiteó, se mergeó y **quedó así en `main`**.
**Por qué:** confundí *"el comando terminó sin error"* con *"el fichero quedó bien"*. El script imprimió `runbook actualizado` y di el trabajo por hecho — justo el hueco entre **ejecutar** y **verificar el efecto**.
**Quién lo detectó:** yo mismo, dos tickets después, al ir a añadir OTRO apunte al mismo bloque y encontrarme el párrafo roto.
**Coste:** bajo en sí (documentación ilegible unas horas), pero el patrón no lo es: es el mismo con el que se cuela una migración mal escrita o un guard que no comprueba nada.
**Regla derivada — nueva:** **una edición hecha con herramienta no está hecha hasta que se relee el resultado.** Vale para scripts de texto, `sed`/`python` sobre ficheros y cualquier generación automática: la salida del comando **no es evidencia del contenido**. Es la misma R1 que se exige a los reportes ajenos, aplicada a los artefactos propios.
**Nota:** hermana del incidente #8 (medir la página equivocada con total confianza). En los dos, la herramienta hizo su trabajo **correctamente sobre el objeto equivocado** — y no hay nada en su salida que lo delate.

---

## PATRÓN COMÚN (lo que de verdad hay que corregir)

Cinco de los seis incidentes son **la misma cosa**: afirmar el estado del mundo sin comprobarlo. Un reporte, un síntoma, una suposición o una ausencia de mención se convirtieron en "esto es así" — y en tickets con prioridad alta, tareas manuales para el fundador y un ticket cerrado en falso.

**Lo que funciona como red:** en los seis casos, quien fue a mirar (el carril B, el fundador, una sesión de ejecución) lo corrigió. Los ejecutores verifican porque el código no les deja mentir; el asesor no tiene ese freno y debe imponérselo.

**Corolario para el fundador:** cuando el asesor afirme algo con seguridad sobre el estado del sistema, es legítimo preguntar *"¿lo has comprobado o lo estás deduciendo?"*. Esa pregunta habría evitado cuatro de estos seis.
