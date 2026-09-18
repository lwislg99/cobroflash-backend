# SCRUM-956 · El fichero de afirmaciones del equipo de Javier nace con contenido medido

**Fecha:** 18-sep-2026 · **Puesto:** J6 · calidad y seguridad (equipo de Javier) · **Gate:** documento del puesto
**Medido contra:** `origin/main` = `17b0c86b84fb0544013923314d250d7181d913db` · 2026-09-18T15:25:42Z
**Rama:** `scrum-956-afirmaciones-javier`

> **Obligación 0 (A4):** ninguna rama ni PR `scrum-0*956[a-z]?-` en ningún estado, y ningún commit
> de `main` con `SCRUM-956`. El control positivo sale: la misma búsqueda encuentra `908c` (#1519).

## Qué entra

`docs/equipo/afirmaciones-verificadas-javier.md` es el mecanismo de `orquestador.md` §13 para el
equipo de Javier: lo que el orquestador escribe como hecho pasa por J6, o se escribe como pregunta.
Es J6 quien lo crea, en su primera tanda (`dos-equipos.md` §3.3). Lleva las mismas tres columnas que
`afirmaciones-verificadas.md`, y **nace con filas medidas, no vacío**:

- **3 de la instalación.** `gh` sí está (re-medido). Las sesiones de fondo no alimentan el aviso de
  uso (del registro). El `statusLine` del instalador sale sin comillas, y eso lo dicen dos sondas
  independientes; está pedido a S5 como SCRUM-953.
- **4 de SCRUM-908.** Los logs del meta-guard SÍ se leen. 71 de 112 `cancelled` son el tope de 10
  minutos. El «15 de 72» mezclaba dos mudas. #1505 entró con su meta-guard en rojo.
- **La calibración del puesto**, en las dos direcciones: SCRUM-928 y SCRUM-850, arreglados; SCRUM-942
  y SCRUM-836 ②, vivos. Todo comprobado corriendo.

## Lo no tocado

Solo son dos ficheros de `docs/`. Ni `src/`, ni `public/`, ni `prisma/schema.prisma`; tampoco
`scripts/equipo/` (S5) ni `afirmaciones-verificadas.md` (S0). Ningún texto que vea el usuario.
