ENCARGO DE LECTURA (SOLO LECTURA). Eres un lector de una auditoría del equipo de Javier (YaQu, repo cobroflash-backend).
Para cada ticket de tu lote contestas: ¿qué parte de lo que pide su enunciado tiene YA su efecto en main?

Escrito el 23-oct-2026 por J3 (jv-j3ak) ANTES de leer ningún ticket. Es el criterio de SCRUM-1496e
(rama `scrum-1496e-cuales-cerrar-22oct`, `docs/master/evidencias/SCRUM-1496e/criterio-de-lectura.md`) con cuatro cambios:
(1) el commit medido; (2) SIN pista del censo anterior y SIN pedir el estado de Jira, para que los controles
vayan ciegos (en 1496e el lector vio «Finalizada» en los dos controles cerrados); (3) cuatro veredictos en vez
de dos, porque así lo pide el encargo del orquestador; (4) la búsqueda por CONTENIDO es obligatoria (lo que
SCRUM-1550 hizo a mano con sondas): el trabajo puede haber entrado bajo OTRO número. Los controles NO van aquí dentro.

PROHIBIDO: escribir, comentar, transicionar o etiquetar en Jira; tocar ficheros del repo; git checkout/stash/commit/fetch/pull/worktree; cualquier base de datos; lanzar tests, guards, censos o scripts; abrir yaqu.app.
Solo puedes: leer Jira (getJiraIssue, searchJiraIssuesUsingJql), `git show`, `git grep`, `git log`, `git branch -r`, `git merge-base`, y escribir TU fichero de salida.

DATOS FIJOS
- Jira cloudId: 30938fdf-d6f0-4c3e-92a9-b11339b41567. getJiraIssue con fields ["summary","description","labels","comment"] (SIN "status": no lo pidas), responseContentFormat "markdown". Si la respuesta se guarda en fichero, léela con node por trozos (no hay jq ni python); no te saltes los comentarios, sobre todo los ÚLTIMOS. Comprueba que el número de comentarios leídos es el `total` que declara la respuesta.
- ⚠️ La cuenta que firma un comentario NO dice quién lo escribió: casi todos los escriben sesiones. Una decisión del fundador o de un jefe cuenta como TOMADA solo si el texto se la atribuye explícitamente con su literal, o si consta en el repo. Di dónde (c.N).
- Repo: <REPO> (usa `git -C "<REPO>"`).
- Commit medido (main): c26f7d6dd5af600e154919e7d341c0d8be2fc684. Mide SIEMPRE contra ese sha (`git show c26f7d6dd:<ruta>`, `git grep -n <patrón> c26f7d6dd -- <rutas>`). No leas el árbol de trabajo para decidir.
- El registro de un ticket es docs/master/SCRUM-N.md (las partes con letra van ANEXADAS ahí). Puede no existir.
- Tu ficha de lote trae por ticket la fila del censo POR NÚMERO de hoy (commits / PR / registro). Es un hecho, no un veredicto.
- Un ticket marcado «SEMBRADO» no está en Jira: su enunciado es el texto que trae la ficha. Trátalo igual que los demás.

CÓMO SE DECIDE
1. Lee el ENUNCIADO ENTERO y TODOS los COMENTARIOS: uno posterior puede añadir partes, partir el ticket, decir que espera una decisión o darlo por cerrado.
2. Enumera las partes (①②③…, aceptación). Sin partes explícitas, la petición entera es UNA parte.
3. Verifica CADA parte por EFECTO en el commit medido, con fichero:línea y el PR o commit que la trajo (`git log --oneline c26f7d6dd -S'<símbolo>' -- <ruta>` da el commit; su merge, el PR). Que exista un merge o un registro NO basta: «un ticket con partes no se cierra por la primera».
4. 🔴 BÚSQUEDA POR CONTENIDO, obligatoria en todo ticket cuya parte no encuentres por su número: saca del enunciado 1-3 símbolos concretos (función, ruta, fichero, literal, campo) y busca `git grep -n` y `git log -S` en c26f7d6dd, y en Jira `searchJiraIssuesUsingJql` con `project = SCRUM AND text ~ "\"<símbolo>\""`. Si el efecto está bajo OTRO número, dilo: «entró bajo SCRUM-M (PR #P)». ⚠️ Lee el TEXTO de cada acierto antes de contarlo: una subcadena casa con otra cosa («sepa» dentro de «sepan»; las notas de la cotización no son las del cliente).
5. Si el registro dice «NO HECHO», «falta», «pendiente» o «sin medir» SOBRE UNA PARTE DEL ENCARGO, esa parte no está.
6. Si el enunciado o un comentario pide una DECISIÓN que nadie ha tomado (firma, GO, elegir opción, STOP de reglas 24/26/28/29/39/40) y no hay rastro escrito de que se tomó, esa parte espera. Las etiquetas `esperando-*`/`decision-jefe`/`stop-fundador` son PISTA; compruébalas en el texto (pueden estar caducadas).
7. Una rama VIVA sin mergear del ticket (`git -C <REPO> branch -r --list "origin/scrum-N-*" "origin/scrum-N[a-z]-*"` + `git merge-base --is-ancestor <punta> c26f7d6dd`) con trabajo que el enunciado pide = esa parte no está en main.

CINCO VEREDICTOS (uno por ticket):
- TERMINADO: TODAS las partes con su efecto en main (fichero:línea + PR/commit POR PARTE), sin confesión de falta, sin decisión abierta. Ante la duda NO es TERMINADO.
- PARCIAL: alguna parte está y alguna falta, y lo que falta es TRABAJO que una sesión puede hacer hoy. Di QUÉ parte falta.
- SIN EMPEZAR: ninguna parte tiene efecto en main, tampoco bajo otro número (di qué símbolos buscaste y que dieron 0).
- ESPERA: lo que falta es una DECISIÓN o un hecho ajeno (fundador · orquestador · asesor · caso real · equipo de Luis). Di CUÁL decisión y en qué comentario se pidió (c.N). Si además falta trabajo, dilo.
- NO HE PODIDO MIRAR: Jira no respondió, la parte no se verifica sin ejecutar algo/navegador/base/CI, o no te cabe. Di por qué. No lo conviertas en otro.

Lee lo justo para decidir. Si encuentras pronto una falta clara y citada, no hace falta verificar el resto para descartar TERMINADO, pero sí para distinguir PARCIAL de SIN EMPEZAR.

SALIDA: escribe <TMP>/salida/veredicto-lote-NN.md con UNA fila por ticket:
| ticket | comentarios leídos/total | VEREDICTO | partes | evidencia por parte (fichero:línea en c26f7d6dd + PR/commit; o cita con c.N) | qué falta / qué decisión espera (c.N) / por qué no pude | ¿entró bajo otro número? (SCRUM-M #P, o «no: busqué <símbolos>») |
Al final: «población: N tickets · T TERMINADO · P PARCIAL · S SIN EMPEZAR · E ESPERA · X NO HE PODIDO MIRAR».
Tu respuesta final es SOLO esa línea de población y la lista de los TERMINADO. La tabla va en el fichero.
