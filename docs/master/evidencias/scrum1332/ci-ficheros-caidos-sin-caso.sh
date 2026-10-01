#!/usr/bin/env bash
# ci-muertes.sh <N> — en los ultimos N runs FALLIDOS de ci.yml, busca en el log del job obligatorio
# los FICHEROS caidos sin caso caido (entrada «test at <ruta>:1:1» + 'test failed') y las frases de
# red. POBLACION en la primera linea; una linea por run; EXIT al final.
n="$1"; out="$CLAUDE_JOB_DIR/tmp/ci-logs"; mkdir -p "$out"
cp "$CLAUDE_JOB_DIR/tmp/runs150.json" "$out/runs.json"
ids=$(node -e "const r=require(process.argv[1]);console.log(r.filter(x=>x.conclusion==='failure').map(x=>x.databaseId+'|'+x.createdAt+'|'+x.headBranch).join('\n'))" "$out/runs.json")
echo "POBLACION: $(echo "$ids" | grep -c .) runs FALLIDOS entre los ultimos 150 de ci.yml (29-sep 18:15Z a 1-oct 06:18Z)"
leidos=0; conFicheroMuerto=0; conRed=0
while IFS='|' read -r id fecha rama; do
  [ -z "$id" ] && continue
  job=$(gh run view "$id" --json jobs --jq '.jobs[] | select(.name | startswith("build + tests")) | "\(.databaseId) \(.conclusion)"' 2>/dev/null | head -1)
  jid=${job%% *}; concl=${job##* }
  if [ -z "$jid" ]; then echo "$id $fecha $rama · SIN job obligatorio"; continue; fi
  if [ "$concl" != "failure" ]; then echo "$id $fecha $rama · job obligatorio=$concl (el rojo es de otro job)"; continue; fi
  f="$out/$id.log"
  [ -s "$f" ] || gh run view "$id" --job "$jid" --log > "$f" 2>/dev/null
  bytes=$(wc -c < "$f")
  if [ "$bytes" -lt 1000 ]; then echo "$id $fecha $rama · CIEGO: log de $bytes bytes"; continue; fi
  leidos=$((leidos+1))
  muertos=$(grep -a -o "test at tests/[^ ]*\.test\.mjs:1:1" "$f" | sort -u | tr '\n' ' ')
  red=$(grep -a -c "Could not resolve host" "$f")
  caidos=$(grep -a -c "^.*✖ " "$f")
  [ -n "$muertos" ] && conFicheroMuerto=$((conFicheroMuerto+1))
  [ "$red" != "0" ] && conRed=$((conRed+1))
  echo "$id $fecha $rama · bytes=$bytes · lineas ✖=$caidos · red=$red · ficheros caidos sin caso: ${muertos:-ninguno}"
done <<< "$ids"
echo "RESULTADO: $leidos logs leidos · $conFicheroMuerto con algun fichero caido sin caso caido · $conRed con «Could not resolve host»"
echo "EXIT=0"
