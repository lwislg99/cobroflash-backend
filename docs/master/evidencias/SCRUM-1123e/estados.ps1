$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repo = $args[0]; $out = $args[1]
$shas = git -C $repo log --first-parent --format=%H origin/main --since=2026-10-20T12:00:00Z --until=2026-10-23T04:00:00Z
$filas = @()
foreach ($s in $shas) {
  $t = git -C $repo log -1 --format=%cI $s
  $n = & $gh api "repos/lwislg99/cobroflash-backend/commits/$s/status" --jq '[.statuses[] | select(.context | startswith(\"comfortable-nourishment\"))] | length'
  $bt = & $gh api "repos/lwislg99/cobroflash-backend/commits/$s/check-runs?check_name=build%20%2B%20tests%20(con%20banco%20desechable)" --jq '[.check_runs[].conclusion] | join(\",\")'
  $filas += "$t $($s.Substring(0,9)) railway_estados=$n build_tests=$bt"
}
$filas | Out-File -Encoding utf8 $out
