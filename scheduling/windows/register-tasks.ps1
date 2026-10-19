# Registers the two scheduled tasks in Windows Task Scheduler (current user, no admin needed):
#   "Control Tower - collector"  every hour, refreshes the dashboard
#   "Second Brain - brain sync"  every day at 23:00, runs /brain sync if any memory changed
#
#   powershell -ExecutionPolicy Bypass -File scheduling\windows\register-tasks.ps1
# Remove them later with: Unregister-ScheduledTask -TaskName "Control Tower - collector"

$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$vbs = "$PSScriptRoot\run-hidden.vbs"

function Register($name, $script, $workdir, $trigger) {
  $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`" `"$script`" `"$workdir`""
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Force | Out-Null
  Write-Host "registered: $name"
}

$hourly = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 1)
Register "Control Tower - collector" "$repo\control-tower\collect.mjs" "$repo\control-tower" $hourly

$nightly = New-ScheduledTaskTrigger -Daily -At 23:00
Register "Second Brain - brain sync" "$repo\scheduling\brain-sync.mjs" $repo $nightly
