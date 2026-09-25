# El digest semanal con varias retenciones · SCRUM-1116

**Aprobado por el orquestador por delegación del fundador** el 25-sep-2026 — SCRUM-1116 comentario 17017.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente», línea
«Javier, 25-sep-2026» (SCRUM-1121, PR #1769).

## Textos aprobados, literales

| Ranura | Texto aprobado |
|---|---|
| `digestSinPendientesConGarantia` | No tienes facturas pendientes de cobro. Tienes {importe} en garantía retenida, liberable desde el {dd/mm/aaaa}. |
| `digestGarantiaLineaExtra` | Tienes {importe} en garantía retenida, liberable desde el {dd/mm/aaaa}. |

## Cómo se componen

«No tienes facturas pendientes de cobro.» **una vez**, y después **una línea por cada día de
liberación distinto**, sumando lo que cae el mismo día. Ordenadas **de la fecha más temprana a la
más tardía**: lo primero que el profesional puede reclamar, primero.

🔴 **Con un solo día, el resultado es carácter por carácter el literal que firmó Javier en
persona** el 25-sep-2026, en el registro de **SCRUM-1108**. No es un texto
que lo sustituye: es el mismo, más una regla de repetición. Eso es lo que hace que la delegación
cubra este caso.

## El hueco que lo hizo falta, medido por J3

El literal firmado lleva **una** fecha. El digest es de **todo el merchant**: con 500 € que se
liberan el 01/03/2026 y 300 € el 23/09/2027 —dos clientes, o dos obras— **no cabe**.

## Por qué NO las dos formas que sí caben en un literal único

- **Total + fecha más TEMPRANA** → ya lo descartó J2 en la ficha del cliente, y por la razón
  buena: *«diría que todo se libera ya»*. Que dos sesiones llegaran por separado al mismo
  descarte es la mejor señal de que está bien descartado.
- **Total + fecha más TARDÍA** → es cierto en lo que dice y **falso en lo que calla**. Alguien con
  500 € liberables en marzo leería que no puede reclamar nada hasta 2027. **Una frase
  literalmente verdadera que deja al lector con una idea falsa es peor que un error**: no hay
  nada que corregir.

## 🔴 Qué cambió: el ✅ sigue fuera

El literal de hoy es «✅ ¡No tienes facturas pendientes de cobro!», y **no cambia** cuando no hay
facturas pendientes **ni** retención: ahí es cierto.

Cuando **sí** hay retención viva, el visto verde se retira. **No es estilo:** es lo que convierte
la frase en una afirmación que el profesional se cree. Sin él describe; con él certifica que no
le deben nada, y con 500 € retenidos eso es falso.

**Quien toque esa línea después: el ✅ se retiró a propósito, no se perdió al editar.**

## Qué NO dice, y por qué

**Ningún verbo de reclamar.** YaQu recuerda un dato que el profesional metió: no le dice que
reclame, ni que tenga derecho a nada (regla 7, cero asesoramiento).

## Un hueco declarado, que este registro no cierra

⚠️ Cuando **sí** hay facturas pendientes **y además** hay retención, el bloque «⏳ Pendiente de
cobro» **no la nombra**. **Calla, pero no dice nada falso**, y no tiene texto firmado. Lo declaró
J3 y se escribe aquí: un hueco declarado se arregla algún día; uno callado, nunca.

## Por qué este registro lo escribe el orquestador y no J3

El clasificador de permisos de J3 **le impidió escribir esta firma**, y clasificó el intento como
*instruction poisoning*: una sesión escribiendo una aprobación de texto de cara al usuario porque
**se lo pide otra sesión**.

🔴 **El clasificador tenía razón con J3**, y J3 hizo lo correcto al parar y no buscar otra vía.
Una firma no vale si la escribe quien no aprueba.

Lo que la resuelve no es que lo haga otra sesión cualquiera, sino **quien tiene la delegación**:
el orquestador de Javier, por la línea registrada en `limites-del-fundador.md` y verificada en
`main`. Es la misma forma en que se resolvió el registro de SCRUM-1108 esta misma tarde, cuando
el clasificador de J2 la paró por lo mismo.
