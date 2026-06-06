# Запуск после установки Git: https://git-scm.com/download/win
# Сначала создайте пустой репозиторий на https://github.com/new → mixmaster-ai

$ErrorActionPreference = "Stop"
Set-Location "D:\Егор\apps\apps\music"

# GitHub username (не email). Проверьте: https://github.com/settings/profile
$GitHubUser = "sharinghane"
$RepoName = "mixmaster-ai"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git не найден. Установите: https://git-scm.com/download/win" -ForegroundColor Red
  Write-Host "Перезапустите PowerShell после установки."
  exit 1
}

if (-not (Test-Path .git)) {
  git init
}

git add .
git status --short

git commit -m "MixMaster AI" 2>$null
if ($LASTEXITCODE -ne 0) {
  $status = git status --porcelain
  if (-not $status) {
    Write-Host "Нечего коммитить — всё уже закоммичено."
  } else {
    git commit -m "MixMaster AI"
  }
}

git branch -M main

$remoteUrl = "https://github.com/$GitHubUser/$RepoName.git"
$existing = git remote get-url origin 2>$null
if ($existing) {
  git remote set-url origin $remoteUrl
} else {
  git remote add origin $remoteUrl
}

Write-Host ""
Write-Host "Пуш на: $remoteUrl" -ForegroundColor Cyan
Write-Host "При запросе логина GitHub: username = $GitHubUser, password = Personal Access Token (не пароль от почты)"
Write-Host "Токен: GitHub → Settings → Developer settings → Personal access tokens"
Write-Host ""

git push -u origin main
