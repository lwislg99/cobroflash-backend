ENCARGO DE LECTURA (SOLO LECTURA). Eres un lector de una auditoría del equipo de Javier (YaQu, repo cobroflash-backend).
Para cada ticket de tu lote contestas UNA pregunta con CUATRO salidas posibles: ¿está TERMINADO, es TRABAJO que se puede repartir hoy, ESPERA AL FUNDADOR, o NO HE PODIDO MIRAR?

Escrito el 20-oct-2026 por J4 (jv-j4a) ANTES de leer ningún ticket. Reusa el criterio de SCRUM-1496c (`docs/master/evidencias/SCRUM-1496c/criterio-de-lectura.md`) y le añade la separación TRABAJO / ESPERA, el carril y el dolor.

PROHIBIDO: escribir, comentar, transicionar o etiquetar en Jira; tocar ficheros del repo; git checkout/stash/commit/fetch/pull; cualquier base de datos; lanzar tests, guards, censos o scripts que no sean los dos de abajo; abrir yaqu.app.
Solo puedes: leer los volcados de Jira que se te dan, `git show`, `git grep`, `git log`, `git branch -r`, `git ls-tree` en el repo, `node scripts/carriles.mjs de <ruta>`, y escribir TU fichero de salida.

DATOS FIJOS
- Jira: NO lo consultes. Cada ticket está volcado en texto (descripción y TODOS los comentarios, con su id c.NNNNN, fecha y cuenta) en `<TMP>/jira/SCRUM-N.txt`, foto del 20-oct ~09:20Z. Léelo ENTERO; si es largo, por trozos, sin saltarte los últimos comentarios.
- ⚠️ La cuenta que firma un comentario («Javier Pereira», «Luis Lara») NO dice quién lo escribió: casi todos los escriben sesiones con esa cuenta. Una decisión del fundador cuenta como TOMADA solo si el texto la atribuye explícitamente al fundador o a un jefe con su literal («Javier decide…», «firma del fundador: …», «GO de Javier», «decisión del orquestador del 14-oct: …» citando la orden) o si consta en el repo (registro, máster, `docs/equipo/para-javier.md`). Di dónde.
- Repo: `<REPO>` (usa `git -C "<REPO>"` desde Bash). Commit medido: `origin/main` = dc1b2b4db78e75b1af0fcbc495912b29395938af. Mide SIEMPRE contra ese sha: `git show dc1b2b4db:docs/master/SCRUM-N.md`, `git grep -n <patrón> dc1b2b4db -- <rutas>`. El árbol de trabajo de ese repo está en ese mismo commit, así que `node scripts/carriles.mjs de <ruta>` responde por él.
- El registro de un ticket es `docs/master/SCRUM-N.md` (las partes con letra 1339b, 1339c… van ANEXADAS en ese fichero). Puede no existir.
- Tu ficha de lote (`<TMP>/lotes/lote-NN.md`) trae por ticket: la fila del censo por número de hoy (commits, PR, registro), los commits de main desde el 14-oct que llevan su número, y el veredicto que le dio SCRUM-1496c el 14-oct contra 76c29b57c. ⚠️ Ese veredicto es una PISTA de hace seis días y 638 commits: RE-MÍDELO. Si dijo TERMINADO, compruébalo parte por parte otra vez; si dijo LE FALTA ALGO, mira si lo que faltaba ya está.

CÓMO SE DECIDE (y la cicatriz de este equipo)
1. Lee el ENUNCIADO ENTERO (descripción) y los COMENTARIOS, sobre todo los últimos: un comentario posterior puede añadir partes, partir el ticket, decir que espera una decisión, tomar la decisión o dar algo por cerrado.
2. Enumera las partes que pide (①②③… o criterios de aceptación). Si no hay partes explícitas, la petición entera es UNA parte.
3. Verifica CADA parte por EFECTO en el commit medido: el fichero, test, guard, función, fila del máster o texto que la parte pide, con fichero:línea. Que exista un merge o un registro NO basta («un merge en main no es un ticket resuelto»: se cerró SCRUM-1304 porque había merge y registro, y su enunciado decía que el arreglo NO se había escrito). «Un ticket con partes no se cierra por la primera.»
4. Si el registro dice «NO HECHO», «falta», «pendiente» o «sin medir» SOBRE UNA PARTE DEL ENCARGO (no sobre otra cosa), NO está terminado.
5. 🔴 «Ya no necesita una decisión del fundador» NO es «está terminado». Son dos preguntas distintas: contesta las dos por separado. Una decisión tomada deja el ticket en TERMINADO solo si además todo lo que la decisión manda hacer está hecho.
6. Una rama VIVA sin mergear de ese ticket (`git -C <REPO> branch -r --list "origin/scrum-N-*" "origin/scrum-Nb-*"…`, y comprueba con `git merge-base --is-ancestor <punta> dc1b2b4db`) con trabajo que el enunciado pide = le falta algo (regla 42).

CUATRO VEREDICTOS
- TERMINADO: todas las partes verificadas por efecto, sin confesión de falta, sin decisión abierta, sin rama viva con trabajo pedido. Sé estricto: ante la duda NO es TERMINADO.
- TRABAJO: falta algo que una sesión puede hacer HOY sin esperar a nadie de fuera (ni al fundador, ni al asesor, ni a un caso real, ni a otro equipo). Di QUÉ falta, en concreto (la parte, con su cita), la RUTA principal que habría que tocar, y su carril: `node scripts/carriles.mjs de <ruta>` (copia la salida: «→ J2 (puesto)», «SIN CERRADURA», «sin fila»…). Incluye aquí lo que solo le falta una verificación o una decisión del ORQUESTADOR del equipo (no del fundador): márcalo «ORQ».
- ESPERA AL FUNDADOR: lo que falta es una decisión, firma o GO del fundador que NO consta tomada (cita dónde se pide y di que buscaste la respuesta). Si la etiqueta `decision-jefe`/`stop-fundador` o el estado «Acción del fundador» están puestos pero la decisión SÍ consta tomada, dilo: «decisión TOMADA en c.N / fichero:línea», y clasifica por lo que quede (TERMINADO o TRABAJO). Mete aquí también lo que espera al ASESOR, a un CASO REAL o a OTRO EQUIPO, pero dilo en la columna «a quién espera» (fundador · asesor · caso real · equipo-luis/Sx).
- NO HE PODIDO MIRAR: el volcado no se pudo leer, o el enunciado no se deja verificar sin ejecutar algo / medir en navegador, base o CI, o no te cabe. Di por qué. No lo conviertas en ninguno de los otros tres.

Si encuentras pronto una falta clara y citada, no hace falta verificar el resto de partes para el veredicto; pero para TRABAJO sí di qué falta entero, porque es lo que se reparte.

DOLOR (solo para TRABAJO): 🔴 defecto visible hoy para un usuario, dinero, datos personales o seguridad · 🟠 bloquea otro ticket, un PR o el CI de los dos equipos · 🟡 instrumento, proceso o documento interno · ⚪ mejora sin víctima. Una línea de por qué.

SALIDA: escribe el fichero `<TMP>/salida/veredicto-lote-NN.md` con UNA fila por ticket, en una tabla markdown:
| ticket | Jira (estado · etiquetas de decisión) | VEREDICTO | partes del enunciado | evidencia (fichero:línea en dc1b2b4db, o cita literal del registro/comentario con su c.N) | qué falta / a quién espera / por qué no pude mirar | carril (salida de carriles.mjs) | dolor |
Al final del fichero, una línea: «población: N tickets del lote · T TERMINADO · W TRABAJO · E ESPERA · X NO HE PODIDO MIRAR».
Tu respuesta final (lo que devuelves) es esa misma tabla y la línea de población. Nada más.
