# SCRUM-601 · DOC-11 · El copy del documento debe ser función del flag

**Fecha del expediente:** 15-sep-2026 · **Carril:** documentos · copy vs. flag fiscal · **Gate:** ⚠️ **RECONSTRUIDO A POSTERIORI**

**Medido contra:** `origin/main` = `289cbf41141fd6f6ae018324879e11b7f4a8ff54` · 2026-09-15T13:50:49Z
**Sha real del merge que entró sin expediente (SCRUM-267):**
`16265c2521dff28e36a8f765bd048f105fb52e97` — PR #1085, 2026-09-06T08:47:49+01:00,
rama `scrum-776-una-sola-voz-factura-suelta`
**Rama de esta reconstrucción:** `expedientes-de-los-cinco-15sep`

---

> # ⚠️ ESTE EXPEDIENTE NO LO ESCRIBIÓ QUIEN HIZO EL TRABAJO
>
> Lo escribe la sesión que lo encontró en el censo de **SCRUM-857**, nueve días después. Todo está
> **derivado del árbol y de Jira**. **No se reconstruye ninguna medición que no se pueda verificar
> hoy.** Lo que no se pudo saber está en el **§6**.

---

## 0 · Una fase con DOS commits, y sin rama propia

**Un solo merge** (PR #1085), pero con **dos commits** de este ticket dentro — la medición y la
re-medición tras mezclar `main`. La rama era `scrum-776-…`, o sea **ajena**: invisible para el
guard de SCRUM-854, y sólo detectable por el criterio de SCRUM-857.

## 1 · Qué dice el ticket (fuente: Jira, leído el 15-sep-2026)

**Tipo:** Tarea · **Prioridad:** Medium · **Estado:** **Finalizada / Listo** · creado 2026-08-24.
**Origen:** `DOC-11`, aprobado por el fundador el 24-ago-2026.

**La víctima**, citada: en una misma pantalla el profesional lee un botón **«+ Nuevo justificante»**
que abre un modal titulado **«Nueva factura»** — *«al menos uno de los dos le está mintiendo sobre
qué documento está emitiendo»*. El ticket lista los cinco textos de esa pantalla: título
«Facturas», columna «Nº FACTURA», botón «+ Nuevo justificante», modal «Nueva factura» con botón
«Emitir factura», y estado vacío «Aquí verás tus cobros».

**La pregunta que manda contestar midiendo, no opinando:** ¿esos textos dependen de
`INVOICING_ES_ENABLED`, o están escritos a pelo? *«Si están a pelo, el día que entre un merchant
real con el flag en OFF seguirán diciendo "factura", y eso sí sería infracción de la regla 24.»*

**⚠️ Y el ticket se define a sí mismo como de MEDIR, no de tocar:** no cambia el flag, no retira la
marca de agua «DEMO», no toca el microcopy N3/N5. **Regla 30: el microcopy es del fundador.**

**Estaba BLOQUEADO** por el expediente de enmienda del justificante (`P-DOC-1`), y el ticket avisa
de que **podía desaparecer entero** si la enmienda prosperaba.

## 2 · Qué entró en `main`, derivado de `git log`

**13 ficheros** (PR #1085). El commit de medición lo dice él mismo: *«el diff son DOS ficheros de
tests»* — el resto del PR es de SCRUM-776, que compartía rama.

### El veredicto, citado del commit

> **el copy del documento NO es función del flag — medido, no opinado**
>
> **LA CADENA DEL FLAG, EJECUTADA** (sin BD, funciones puras). Con `INVOICING_ES_ENABLED` ausente
> del entorno, o sea en su valor por defecto (`false`):
>
> ```
> merchant ES real  → isFlagEnabled=false · getEmissionMode='receipt' ·
>                     modoDocumentoSuelto='justificante' · modoEmisionVisible='receipt'
> merchant demo     → 'demo'   → 'factura'
> merchant no-ES    → 'fiscal' → 'factura'
> ```
>
> Con **control positivo**: forzando el env a `'true'`, el ES real pasa a `'fiscal'`/`'factura'`.

O sea: **la cadena del flag funciona**; lo que no es función del flag son los **literales de la
pantalla**. El segundo commit (la re-medición) da el reparto:

> La población creció con la mezcla (355→356 ficheros, 19.968→19.978 literales) y el veredicto
> salió **IDÉNTICO**: ① **2 flag** · ② **7 tipo** · ③ **153 a pelo**, 33 no legibles.

Y por qué se re-midió, que es la parte que más vale de ese commit:

> `main` se movió dos veces durante el ticket. Mezclado DENTRO de la rama, y las anclas re-medidas
> después: **un ancla escrita sin re-fetch nace caduca.** […] **Que no se moviera es un dato
> medido, no una suposición de que no haría falta mirar.**

## 3 · Lo único que esta sesión ha medido por su cuenta (15-sep-2026)

```
node --test tests/scrum601-copy-del-documento-vs-flag.test.mjs
```

→ **5 pass · 0 fail · `# skipped 0`**

**Medición mía y de hoy.** Dice que el instrumento sigue vivo. **No** dice que los 153 literales a
pelo sigan siendo 153: esa cifra es del 6-sep y re-medirla es otro trabajo.

## 4 · 🔴 El resultado deja trabajo detrás, y el ticket está cerrado

El ticket era de **medir**, y midió: **153 literales a pelo**. Eso es exactamente lo que su propio
enunciado describe como el riesgo — *«el día que entre un merchant real con el flag en OFF seguirán
diciendo "factura", y eso sí sería infracción de la regla 24»*.

> ⛔ **Lo digo y paro, como manda el encargo.** El ticket está **Finalizada / Listo** y cumplió lo
> que prometía (medir, no tocar), así que **no afirmo que esté incumplido**. Lo que sí queda dicho
> es que **su hallazgo —153 literales que no dependen del flag— no consta cerrado en ningún sitio
> localizable**, y que el propio ticket lo ata a la regla 24. Abrir, cerrar o dejarlo es del
> fundador.

Y la otra mitad del contexto: el ticket estaba **bloqueado por la enmienda del justificante** y
avisaba de que podía desaparecer entero. **Qué pasó con esa enmienda no consta en el árbol.**

## 5 · Lo NO tocado

Ni una línea de código ni de tests. Ni un literal de microcopy — que además es del fundador
(regla 30).

## 6 · 🔴 LO QUE NO SE PUDO RECONSTRUIR

1. **Qué pasó con el expediente de enmienda `P-DOC-1`**, del que este ticket dependía y que podía
   dejarlo sin objeto. No está en `docs/master/` ni se localiza en el árbol.
2. **Si los 153 literales a pelo se arreglaron**, y en qué ticket. No consta.
3. **Cuáles son los 153.** El commit da el reparto (2 / 7 / 153 / 33) pero **la lista no está en un
   fichero localizable**; podría vivir dentro del test, pero afirmarlo exigiría atribuirle una
   intención que su autor no escribió.
4. **Los 33 «no legibles»**: qué los hacía no legibles y si eso es deuda o ruido.
5. **Quién cerró el ticket y con qué criterio**, estando bloqueado por una enmienda cuyo desenlace
   no consta.
6. **Por qué viajó en la rama de SCRUM-776** en vez de tener la suya.
