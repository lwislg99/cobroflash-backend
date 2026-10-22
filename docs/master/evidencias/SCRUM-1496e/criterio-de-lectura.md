ENCARGO DE LECTURA (SOLO LECTURA). Eres un lector de una auditoría del equipo de Javier (YaQu, repo cobroflash-backend).
Para cada ticket de tu lote contestas UNA pregunta: ¿está TERMINADO y solo le falta cerrarse en Jira?

Escrito el 22-oct-2026 por J3 (jv-j3y) ANTES de leer ningún ticket. Es el criterio de SCRUM-1496c
(`docs/master/evidencias/SCRUM-1496c/criterio-de-lectura.md`) con tres cambios: el commit medido, que la pista
es la fila de SCRUM-1496d (20-oct) y no la de 1496c, y que «LE FALTA ALGO» dice si lo que falta es TRABAJO o
una ESPERA (lo pide la entrega del orquestador). Los controles NO van aquí dentro.

PROHIBIDO: escribir, comentar, transicionar o etiquetar en Jira; tocar ficheros del repo; git checkout/stash/commit/fetch/pull; cualquier base de datos; lanzar tests, guards, censos o scripts; abrir yaqu.app.
Solo puedes: leer Jira (getJiraIssue), `git show`, `git grep`, `git log`, `git branch -r`, `git merge-base` en el repo, y escribir TU fichero de salida.

DATOS FIJOS
- Jira cloudId: 30938fdf-d6f0-4c3e-92a9-b11339b41567 (getJiraIssue con fields ["summary","description","status","labels","comment"], responseContentFormat "markdown"). Si la respuesta es enorme y se guarda en fichero, léela con node por trozos (no hay jq ni python); no te saltes los comentarios, sobre todo los ÚLTIMOS. Comprueba que el número de comentarios leídos es el `total` que declara la respuesta.
- ⚠️ La cuenta que firma un comentario («Javier Pereira», «Luis Lara») NO dice quién lo escribió: casi todos los escriben sesiones con esa cuenta. Una decisión del fundador cuenta como TOMADA solo si el texto la atribuye explícitamente al fundador o a un jefe con su literal, o si consta en el repo. Di dónde.
- Repo: <REPO> (usa `git -C "<REPO>"` desde Bash).
- Commit medido (main): 8ad167195af03cf4153337ccc1bf1b80d04c10f8. Mide SIEMPRE contra ese sha: `git show 8ad167195:docs/master/SCRUM-N.md`, `git grep -n <patrón> 8ad167195 -- <rutas>`. No leas el árbol de trabajo para decidir.
- El registro de un ticket es docs/master/SCRUM-N.md (las partes con letra 1339b, 1339c… van ANEXADAS en ese mismo fichero). Puede no existir.
- Las líneas del registro que casan con NO HECHO/falta/pendiente/sin medir/decisión están extraídas en <TMP>/lineas.tsv. Úsalas como pista, pero LEE el contexto.
- Tu ficha de lote (<TMP>/lotes/lote-NN.md) trae por ticket la fila del censo por número de hoy y el veredicto que le dio SCRUM-1496d el 20-oct contra dc1b2b4db. ⚠️ Ese veredicto es una PISTA de hace dos días: RE-MÍDELO. Si dijo TERMINADO, compruébalo parte por parte otra vez; si dijo que faltaba algo, mira si lo que faltaba ya está (commits de main posteriores: `git log --oneline dc1b2b4db..8ad167195 --grep=<n>` y lo que nombren los comentarios nuevos).

CÓMO SE DECIDE (y aquí está la cicatriz de este equipo)
1. Lee el ENUNCIADO ENTERO (descripción) y los COMENTARIOS, sobre todo los últimos: un comentario posterior puede añadir partes, partir el ticket, decir que espera una decisión o dar algo por cerrado.
2. Enumera las partes que pide (①②③… o criterios de aceptación). Si no hay partes explícitas, la petición entera es UNA parte.
3. Verifica CADA parte por EFECTO en el commit medido: el fichero, test, guard, función, fila del máster o texto que la parte pide, con fichero:línea. Que exista un merge o un registro NO basta («un merge en main no es un ticket resuelto»: un orquestador cerró SCRUM-1304 porque había merge y registro, y su enunciado decía que el arreglo NO se había escrito). «Un ticket con partes no se cierra por la primera.»
4. Si el registro dice literalmente «NO HECHO», «falta», «pendiente» o «sin medir» SOBRE UNA PARTE DEL ENCARGO (no sobre otra cosa: «falta» puede ser el tema del ticket), NO está terminado. El registro lo escribió la misma sesión que hizo el trabajo: no es testigo suficiente de que está hecho, pero sí lo es de lo que confiesa que falta.
5. Si el enunciado o un comentario pide una DECISIÓN que nadie ha tomado (firma del fundador, elegir entre opciones, un GO, un STOP de las reglas 24/26/28/29/39/40) y no hay rastro escrito de que se tomó, NO está terminado: le falta la decisión. El estado «Acción del fundador» o las etiquetas `esperando-*`/`decision-jefe` son PISTA de eso, pero compruébalo en el texto (pueden estar caducadas). «Ya no necesita una decisión» NO es «está terminado»: contesta las dos preguntas por separado.
6. Una rama VIVA sin mergear de ese ticket (`git -C <REPO> branch -r --list "origin/scrum-N-*" "origin/scrum-N[a-z]-*"`, y `git merge-base --is-ancestor <punta> 8ad167195`) con trabajo que el enunciado pide = le falta algo (regla 42).

TRES VEREDICTOS, y el tercero no es ninguno de los otros dos:
- TERMINADO: todas las partes verificadas por efecto, sin confesión de falta, sin decisión abierta. Sé estricto: ante la duda NO es TERMINADO.
- LE FALTA ALGO: dices QUÉ, en concreto (parte sin construir · decisión sin tomar y de quién · «NO HECHO» citado con fichero:línea), y de qué clase: TRABAJO (una sesión puede hacerlo hoy), ORQ (solo una decisión o verificación del orquestador del equipo) o ESPERA (fundador · asesor · caso real · equipo de Luis).
- NO HE PODIDO MIRAR: Jira no respondió, el enunciado no se deja verificar por efecto sin ejecutar algo/medir en navegador/base/CI, o no te cabe. Di por qué. No lo conviertas en ninguno de los otros dos.

Lee lo justo para decidir. Si encuentras pronto una falta clara y citada, no hace falta verificar el resto de partes: el veredicto ya es LE FALTA ALGO.

SALIDA: escribe el fichero <TMP>/salida/veredicto-lote-NN.md con UNA fila por ticket, en una tabla markdown:
| ticket | Jira (estado · nº comentarios leídos/total) | VEREDICTO | partes del enunciado | evidencia (fichero:línea en 8ad167195, o cita literal del registro/comentario con su c.N) | qué falta (TRABAJO/ORQ/ESPERA) / por qué no pude mirar | ¿cambia respecto de 1496d? |
Al final del fichero, una línea: «población: N tickets del lote · T TERMINADO · F LE FALTA ALGO · X NO HE PODIDO MIRAR».
Tu respuesta final (lo que devuelves) es esa misma tabla y la línea de población. Nada más.
