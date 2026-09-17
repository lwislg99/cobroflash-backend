# Sesión 5 — «¿la máquina entrega sola, y avisa cuando no?»

AUTOMATIZACIÓN. El bucle PR → CI → merge → aviso: los workflows de
`.github/workflows/`, sus scripts, los vigías, el avisador de rojo y
el meta-guard. El carril y sus fronteras los fija la tabla §11bis de
`orquestador.md`, y esa tabla manda sobre esta cabecera.

NO toca producto: ni src/ ni public/, ni microcopy. Un ticket de
producto que le llegue se para, se deja lo medido en el ticket y se
devuelve a su carril (SCRUM-895, 17-sep-2026).

REGLA PROPIA: se mide POR EFECTO sobre GitHub de verdad —si la rama
se movió, si el check arrancó con jobs, si el PR entró o no en
`main`—, nunca por el log del job ni por el estado de Jira. Y un
instrumento que no pudo mirar lo dice: «no pude mirar» pone el run en
rojo, jamás en verde.

SE MIDE ASÍ: un PR que se queda parado sin que nada lo diga es un
fallo de este puesto, lo vea quien lo vea primero.

Hasta el 17-sep-2026 esta cabecera describía otro puesto (recorrer el
producto a 390 px). Ese recorrido lo hace hoy S0 (SCRUM-882). El canon
de abajo es de esta sesión y sigue en vigor.

## Frases al canon (9-sep-2026)

Un control que introduce un defecto a propósito se diseña por su
limpieza, no por su resultado. El resultado se mide una vez; la basura
se queda.

  Del control end-to-end de SCRUM-834: la rama con el test roto se
  borró, el PR se cerró SIN mergear y se comprobó aparte que ni el
  commit ni el fichero llegaron a `main`. Esa comprobación importaba
  más que el resultado del control: un test que falla a propósito
  entrando en `main` habría sido peor que el problema que se venía a
  resolver.

Claude no se auto-despierta: su respuesta no lleva la mención.

  Medido el 9-sep-2026 (run 12 de `claude.yml` → `skipped`), no
  supuesto. Va con fecha porque es una propiedad de HOY: depende de
  que la respuesta de la acción no incluya la cadena, y eso lo puede
  cambiar una versión nueva sin avisar. Si algún día el bucle
  CI→aviso→arreglo→CI se cierra solo, empezar a mirar por aquí.

Un modo rápido que no ejerce el mecanismo no es una versión rápida del
control: es otro control.

  9-sep-2026, midiendo SCRUM-836. `meta:mutaciones` tarda más de una
  hora, y tiene un `--solo-censo` que abre la misma puerta en 6 s. La
  tentación era usarlo como control del ancla. Se probó con el ancla
  ARREGLADA y con el ancla ROTA A PROPÓSITO:

      A · ancla arreglada → censo · 54 guards · 166 declaraciones · EXIT 0
      B · ancla ROTA      → censo · 54 guards · 166 declaraciones · EXIT 0

  Salida idéntica. El modo censo CUENTA declaraciones pero no intenta
  inyectar, así que no puede descubrir que el ancla ya no casa — que es
  exactamente el defecto que se iba a medir. Seis segundos y un «todo
  bien» falso.

  Aplica igual a cualquier `--dry-run`, cualquier modo «rápido» y
  cualquier prueba de humo: la pregunta no es cuánto tarda, es si
  EJERCE el mecanismo que dice comprobar. Y se responde probándolo con
  el defecto puesto, no leyendo su documentación.
