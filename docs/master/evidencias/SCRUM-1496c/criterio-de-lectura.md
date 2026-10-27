ENCARGO DE LECTURA (SOLO LECTURA). Eres un lector de una auditoría del equipo de Javier (YaQu, repo cobroflash-backend).
Para cada ticket de tu lote contestas UNA pregunta: ¿está TERMINADO y solo le falta cerrarse en Jira?

PROHIBIDO: escribir, comentar, transicionar o etiquetar en Jira; tocar ficheros del repo; git checkout/stash/commit; cualquier base de datos.
Solo puedes: leer Jira (getJiraIssue), `git show`, `git grep`, `git log` en el repo, y escribir TU fichero de salida.

DATOS FIJOS
- Jira cloudId: 30938fdf-d6f0-4c3e-92a9-b11339b41567 (usa getJiraIssue con fields ["summary","description","status","labels","comment"], responseContentFormat "markdown"). Si la respuesta es enorme y se guarda en fichero, léela con node/jq por trozos; no te saltes los comentarios.
- Repo: C:\Users\Javier Pereira\cobroflash-backend\.claude\worktrees\j3h-1496c-cerrar (usa `git -C "<repo>"` desde Bash).
- Commit medido (main): 76c29b57c871584b04c8206c11571f9c56c9d699. Mide SIEMPRE contra ese sha: `git show 76c29b57c:docs/master/SCRUM-N.md`, `git grep -n <patrón> 76c29b57c -- <rutas>`. No leas el árbol de trabajo para decidir.
- El registro de un ticket es docs/master/SCRUM-N.md (las partes con letra 1339b, 1339c… van ANEXADAS en ese mismo fichero). Puede no existir.
- Las líneas del registro que casan con NO HECHO/falta/pendiente/sin medir/decisión ya están extraídas en C:\Users\Javier Pereira\.claude\jobs\61d2c2ad\tmp\lineas.tsv (columnas: ticket, fichero, línea, palabra, texto). Úsalas como pista, pero LEE el contexto.

CÓMO SE DECIDE (y aquí está la cicatriz de este equipo)
1. Lee el ENUNCIADO ENTERO (descripción) y los COMENTARIOS, sobre todo los últimos: un comentario posterior puede añadir partes, partir el ticket, decir que espera una decisión o dar algo por cerrado.
2. Enumera las partes que pide (①②③… o criterios de aceptación). Si no hay partes explícitas, la petición entera es UNA parte.
3. Verifica CADA parte por EFECTO en el commit medido: el fichero, test, guard, función, fila del máster o texto que la parte pide, con fichero:línea. Que exista un merge o un registro NO basta («un merge en main no es un ticket resuelto»: un orquestador cerró SCRUM-1304 porque había merge y registro, y su enunciado decía que el arreglo NO se había escrito).
4. Si el registro dice literalmente «NO HECHO», «falta», «pendiente» o «sin medir» SOBRE UNA PARTE DEL ENCARGO (no sobre otra cosa: «falta» puede ser el tema del ticket), NO está terminado. El registro lo escribió la misma sesión que hizo el trabajo: no es testigo suficiente de que está hecho, pero sí lo es de lo que confiesa que falta.
5. Si el enunciado o un comentario pide una DECISIÓN que nadie ha tomado (firma del fundador, elegir entre opciones (a)/(b)/(c), un GO, un STOP de las reglas 24/26/28/29/39/40) y no hay rastro escrito de que se tomó, NO está terminado: le falta la decisión. El estado Jira «Acción del fundador» o las etiquetas `esperando-*`/`decision-jefe` son PISTA de eso, pero compruébalo en el texto (pueden estar caducadas).
6. Una rama VIVA sin mergear de ese ticket con trabajo que el enunciado pide = le falta algo (regla 42).

TRES VEREDICTOS, y el tercero no es ninguno de los otros dos:
- TERMINADO: todas las partes verificadas por efecto, sin confesión de falta, sin decisión abierta. Sé estricto: ante la duda NO es TERMINADO.
- LE FALTA ALGO: dices QUÉ, en concreto (parte sin construir · decisión sin tomar y de quién · «NO HECHO» citado con fichero:línea).
- NO HE PODIDO MIRAR: Jira no respondió, el enunciado no se deja verificar por efecto sin ejecutar algo/medir en navegador/base/CI, o no te cabe. Di por qué. No lo conviertas en ninguno de los otros dos.

Lee lo justo para decidir. Si encuentras pronto una falta clara (p. ej. una decisión del fundador sin tomar, citada), no hace falta verificar el resto de partes: el veredicto ya es LE FALTA ALGO.

SALIDA: escribe el fichero C:\Users\Javier Pereira\.claude\jobs\61d2c2ad\tmp\veredicto-<LOTE>.md con UNA fila por ticket, en una tabla markdown:
| ticket | Jira (estado) | VEREDICTO | partes del enunciado | evidencia (fichero:línea en 76c29b57c, o cita literal del registro/comentario con su nº) | qué falta / por qué no pude mirar |
Al final del fichero, una línea: «población: N tickets del lote · T TERMINADO · F LE FALTA ALGO · X NO HE PODIDO MIRAR».
Tu respuesta final (lo que devuelves) es esa misma tabla y la línea de población. Nada más.
