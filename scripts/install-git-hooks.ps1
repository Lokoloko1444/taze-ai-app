$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$source = Join-Path $repoRoot ".githooks\pre-push"
$targetDir = Join-Path $repoRoot ".git\hooks"
$target = Join-Path $targetDir "pre-push"

if (-not (Test-Path $source)) {
  throw "Missing hook template: $source"
}

if (-not (Test-Path $targetDir)) {
  throw "Missing git hooks directory: $targetDir"
}

Copy-Item -LiteralPath $source -Destination $target -Force
Write-Output "Installed pre-push guard to $target"
