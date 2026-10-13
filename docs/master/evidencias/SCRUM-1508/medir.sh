#!/usr/bin/env bash
# SCRUM-1508 · repite la medicion entera. Desde la raiz del repo:  bash docs/master/evidencias/SCRUM-1508/medir.sh
# Los CONTROLES van primero y son obligatorios: si uno no da lo que tiene que dar, sale 1 y NO mide.
# La sonda necesita dist/ (en un arbol anidado: tsc --noCheck). No toca ninguna base: prisma falso en memoria.
set -u
E="docs/master/evidencias/SCRUM-1508"
export TS_LIB="$(node -p "require.resolve('typescript')")"
TMP="$(mktemp -d)"; cp "$E/control-censo.ts.txt" "$TMP/caso.ts"; mkdir "$TMP/t"; cp "$E/control-tragadas.ts.txt" "$TMP/t/caso2.ts"
n() { "$@" 2>/dev/null | wc -l | tr -d ' '; }
exige() { if [ "$2" != "$3" ]; then echo "CONTROL ROTO · $1: esperaba $3 y salio $2 — no se mide"; exit 1; fi; echo "control · $1: $2 (esperado $3)"; }

echo "== CONTROLES"
exige "censo escritores, fixture"        "$(n node $E/censo.cjs "$TMP/caso.ts" escritores)" 4
exige "censo lectores, fixture"          "$(n node $E/censo.cjs "$TMP/caso.ts" lectores)" 5
exige "censo forma, fixture"             "$(n node $E/censo.cjs "$TMP/caso.ts" forma)" 2
exige "censo escritores, nombre que no existe, src" "$(n node $E/censo.cjs src escritores --fn noExiste --modelo noExiste)" 0
exige "censo lectores, modelo que no existe, src"   "$(n node $E/censo.cjs src lectores --modelo noExiste --tabla no_existe)" 0
exige "tragadas, fixture: total"         "$(n node $E/tragadas.cjs "$TMP/t" escrituras)" 6
exige "tragadas, fixture: TRAGA(.catch)" "$(node $E/tragadas.cjs "$TMP/t" escrituras 2>/dev/null | grep -c 'TRAGA(.catch)')" 1
exige "tragadas, fixture: TRAGA(try)"    "$(node $E/tragadas.cjs "$TMP/t" escrituras 2>/dev/null | grep -c 'TRAGA(try)')" 3
exige "tragadas, modelo que no existe, src" "$(n node $E/tragadas.cjs src escrituras noExiste)" 0
# el cruce que cazo el fallo del instrumento: recordAudit TIENE que salir como tragada
exige "tragadas ve el .catch de recordAudit" "$(node $E/tragadas.cjs src escrituras auditLog 2>/dev/null | grep -c 'TRAGA(.catch).*audit.service.ts')" 1

echo; echo "== 1 · QUIEN ESCRIBE en la tabla de auditoria (src)";  node $E/censo.cjs src escritores
echo; echo "== 2 · QUIEN LEE la tabla de auditoria (src)";         node $E/censo.cjs src lectores
echo; echo "== 2b · idem en scripts/ y public/";                    node $E/censo.cjs scripts lectores; node $E/censo.cjs public lectores
echo; echo "== 3 · LA FORMA: promesa suelta con .catch que traga (src)"; node $E/censo.cjs src forma
echo; echo "== 4 · escrituras prisma cuyo fallo NO llega al llamador (src; fuera las que contestan HTTP)"
node $E/tragadas.cjs src escrituras 2>"$TMP/pob" | grep TRAGA | grep -v responde-http; cat "$TMP/pob"
for m in whatsAppMessage customerEvent event gatewayEvent vfSubmission; do echo; echo "== 5 · quien LEE $m"; node $E/tragadas.cjs src lecturas $m; done

echo; echo "== 6 · SONDAS sobre dist/ (control primero)"
if [ ! -f dist/integrations/whatsapp.js ]; then echo "SIN dist/: la sonda NO ha corrido"; exit 1; fi
c1="$(node $E/sonda.cjs dist tope control)";        echo "$c1"
c2="$(node $E/sonda.cjs dist presupuesto control)"; echo "$c2"
c3="$(node $E/sonda.cjs dist factura control)";     echo "$c3"
case "$c1" in *'"plantillasQueSalieron":3,'*'"bloqueosPorTope":7'*) ;; *) echo "CONTROL ROTO · sonda tope"; exit 1;; esac
case "$c2" in *'"plantillasQueSalieron":1,'*) ;; *) echo "CONTROL ROTO · sonda presupuesto"; exit 1;; esac
case "$c3" in *'"plantillasQueSalieron":2,'*) ;; *) echo "CONTROL ROTO · sonda factura"; exit 1;; esac
node $E/sonda.cjs dist tope registro
for v in candado registro ambos; do node $E/sonda.cjs dist presupuesto $v; done
for v in candado registro ambos; do node $E/sonda.cjs dist factura $v; done
rm -rf "$TMP"
