# SCRUM-1165 · «⬇ VeriFactu XML» en Informes era un claim fiscal para todos los merchants

**Medido contra:** `origin/main` = `29b492b0c2f246941e5c514d682887c18fd19494` · 2026-09-28T14:18:15Z

## Qué pasaba

Informes (`public/dashboard/js/reportsView.js`) pintaba a TODOS los merchants el botón «⬇ VeriFactu XML»,
con el título «Registro de facturación RRSIF del año (España, RD 1007/2023)». Con `INVOICING_ES_ENABLED`
en OFF —todo merchant español real antes de SIF-1— el servidor contesta 404 a `/admin/exports/verifactu.xml`
(SCRUM-73): la pantalla afirmaba que YaQu produce el registro reglamentario y el producto no lo hace
(reglas 7/17/26). Desbloqueado por el fundador el 28-sep.

## Qué cambia (solo front, una línea de condición)

- El botón solo se añade a la fila de exportar si `window.appModoEmision === 'fiscal'` (el veredicto del
  servidor, `modoEmisionVisible`). Fuera de `fiscal` se OCULTA: en `receipt`, en `demo` (cero claims
  fiscales hasta SIF-1, también en el demo) y con el modo desconocido o ausente (falla cerrado).
- El texto no se reescribe: ocultar no es copy nuevo. El día que el interruptor se encienda, vuelve solo.

## Cómo se prueba

`tests/scrum1165-verifactu-xml-solo-en-fiscal.test.mjs` mide el viaje: merchant → `modoEmisionVisible`
(de `dist`) → la sentencia REAL de `app.js` que asigna `window.appModoEmision` → `renderReportsView` en
el banco → ¿está el botón? Casos: ES real (receipt) no · demo no · sin modo no · **control positivo**
con el flag encendido (fiscal) sí, con su título. Control de ceguera: la fila de exportar tiene ≥3 botones.

- Verde 4/4. **En rojo** (quitando la condición): 3 fallan, el control positivo sigue verde.
- Vecinos (22 ficheros que cargan Informes) 184/184 · trinquete 1185 10/10.

## Verificación en yaqu.app

**NO VERIFICABLE** con la cuenta del demo desde esta sesión (sin credenciales, pedidas desde el 25-sep).
Tras el deploy: entrar como cualquier merchant español real → Informes → la fila de exportar ya no
enseña «⬇ VeriFactu XML».
