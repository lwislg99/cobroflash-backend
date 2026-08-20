---
name: cerebro-yaqu
description: Cerebro operativo de YaQu para sesiones de Claude Code. Usar SIEMPRE al
  arrancar cualquier tarea en cobroflash-backend, antes de abrir un PR, antes de cerrar
  o reportar un ticket, y antes de tocar schema, staging, dinero, fiscal o superficie
  pública. Contiene arranque, disparadores anti-error y STOPs.
---

# Cerebro YaQu — jerarquía: YAQU_MASTER.md > esta skill > cualquier otra

## ANTES DE NADA: ¿ha llegado el encargo ENTERO? (SCRUM-565)
Un encargo cortado NO parece cortado: parece más corto. Y lo que se pierde es el FINAL, que es
donde van las restricciones de seguridad — o sea que **un encargo truncado es un encargo sin las
prohibiciones**. Pasó el 20-ago y sólo se supo porque la sesión lo declaró; eso es disciplina, no
mecanismo.
1. ¿La ÚLTIMA línea es exactamente `=== FIN DEL ENCARGO ===`? Que aparezca no basta: la cabecera
   lo CITA, así que buscarlo «en el texto» aprueba cualquier encargo cortado.
2. Trae cabecera de recuento y NO termina en el marcador → **PARA** y pídelo completo. La
   cabecera va arriba y sobrevive al corte: anunciar un cierre que no llega es prueba dura.
3. Los recuentos de la cabecera se CONTRASTAN con lo recibido. Un desajuste **no es prueba de
   corte** —contar a mano falla— así que se DECLARA y se PREGUNTA cuál manda; no se ajusta en
   silencio. (En el estreno del formato la cabecera decía 4 prohibiciones habiendo 5.)
4. Sin cabecera ni marcador (formato anterior) no se puede comprobar: dilo, no lo des por entero.
5. 🔴 JAMÁS adivines lo que falta. Rellenar huecos de contexto es el patrón que causó esto.
Herramienta: `npm run comprobar:encargo <fichero>` (o por tubería). Sale 1 si hay que parar.

## Al arrancar (siempre, en este orden)
1. Lee CLAUDE.md (en la RAÍZ, no en docs/), docs/YAQU_MASTER.md (gobierna), docs/ASESOR.md,
   docs/ERRORES_ASESOR.md.
2. `git ls-remote --heads origin` en listado COMPLETO (no filtrado): ¿existe ya rama o
   worktree con tu número de ticket? Si sí → PARA y repórtalo. Han pasado 4 duplicados.
3. Worktree PROPIO siempre. Jamás trabajes en main.

## Disparadores anti-error ("el vocabulario estaba, faltaba el disparador")
- Vas a AFIRMAR un estado → míralo en la fuente (R1). Código: léelo. Config externa:
  ábrela en la herramienta. Nunca deduzcas por el síntoma ni por el nombre.
- Vas a decir "hecho/mergeado/ya existe" → `git merge-base --is-ancestor <commit>
  origin/main` o ls-remote completo (R2). Jamás el estado de Jira ni un resumen en prosa.
- Escribes un guard → pruébalo EN ROJO con un caso que caiga DENTRO del mecanismo
  (ojo a ventanas y tolerancias: un desvío enorme se sale del margen y el rojo no sale).
  Si el rojo no aparece, la primera hipótesis es "caso mal elegido", no "guard de sobra".
- Un guard de TEXTO se caza a sí mismo en el comentario que explica la prohibición.
  Para vigilar código, análisis estático del árbol (AST), no `grep`.
- Ves un verde → pregúntate qué mediría ese verde si el sistema estuviera roto.
- Un artefacto que no corre en `npm test` no existe: el scratchpad es efímero y el CI
  no lo ve. Todo guard nuevo nace dentro de la suite.
- Cualquier script (también desechable) que toque una URL de BD → parseBDSegura de
  _db-guard.mjs. Nunca parseo a mano (R7: una credencial se protege impidiendo que
  el error salga, no redactando mensajes).

## STOPs — para y pide GO del fundador con diff/preview
Schema (orden: staging → yaqu_dev_javier → producción; prisma/schema.prisma es dominio
exclusivo del fundador) · Dinero · Fiscal · Superficie pública.

## Hallazgos (regla 37)
Se arregla DENTRO solo si las TRES: misma zona que tocas + bloquea tu tarea + cabe en el
PR. Si no → ticket con carril, siguiente acción concreta y gate. Hallazgo de otro carril:
se reporta, no se arregla (regla 9).

## Antes de abrir el PR
- Compare completo: https://github.com/lwislg99/cobroflash-backend/compare/main...<rama>
- `gh` NO está instalado a propósito: el PR lo abre el fundador. Deja el cuerpo escrito.
- Microcopy: solo textos oficiales del máster (regla 30). Dependencia nueva: OK del
  fundador (regla 36). Suite completa en verde.
- Entrada del trabajo en `docs/master/SCRUM-<n>.md`, UN FICHERO POR TICKET. Si ya existe,
  se AÑADE como apéndice al final y no se borra nada (precedente: `SCRUM-244.md`).
  🔴 NO en `YAQU_MASTER.md`: el guard de SCRUM-273 lo BLOQUEA en CI. Esta línea mandaba
  escribir ahí hasta el 20-ago-2026, y el 17-ago costó un PR en rojo con la entrada ya
  escrita — la skill que se carga en toda sesión ordenaba justo lo que el CI rechaza.
  Comprobación antes de empujar: `npm run guards:entrada` (son cuatro: 273, 267, 391, 242).
- Descripciones de Jira <1.500 caracteres.

## Vetos permanentes
YaQu NO es un ERP ni un CRM (parte Z) · WhatsApp = Meta Cloud API directa, jamás
WATI/Zoko/n8n · INVOICING_ES_ENABLED OFF para merchants reales · VeriFactu se responde
SOLO con el guion H2 · Semáforo fiscal: se impide solo lo ROJO (irreversible); un ÁMBAR
jamás se bloquea — se avisa y se registra en AuditLog.
