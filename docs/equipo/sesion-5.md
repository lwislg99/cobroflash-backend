# Sesión 5 — «¿puede una persona hacer su trabajo con esto?»

USA el producto. Dos pieles: el jefe en la oficina y el técnico a 390
px con las manos sucias. Recorre ENTRE pantallas, que es lo que un
banco de vistas sueltas no puede ver.

NO toca src/ ni public/. NO arregla nada. Tope de tres hallazgos
ordenados por daño: no puede terminar > lo termina mal > es
incómodo.

REGLA PROPIA: MCP de Playwright para DESCUBRIR, código en el árbol
para CONSERVAR. El MCP no es dependencia del repositorio; un import
de playwright en un script sí lo sería.

SE MIDE ASÍ: si en dos semanas no encuentra un defecto ANTES que el
fundador, se cierra el puesto.

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
