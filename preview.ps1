<#
  Local preview for the Século site.

  Usage:  .\preview.ps1

  Serves this folder at http://localhost:8006 and opens it.
  Ctrl+C to stop. Local only — nothing is published.

  Publishing is a separate, deliberate act:
      git checkout main
      git merge redesign/brand
      git push
  GitHub Pages then redeploys seculopt.com from main.
#>

$port = 8006
$dir  = $PSScriptRoot

$branch = (git -C $dir rev-parse --abbrev-ref HEAD)

Write-Host ""
Write-Host "  branch  $branch"
Write-Host "  folder  $dir"
Write-Host "  url     http://localhost:$port"
Write-Host ""
Write-Host "  Ctrl+C to stop. Local only - nothing is published."
Write-Host ""

Start-Process "http://localhost:$port"
py -m http.server $port --directory $dir
