' Runs "node <script>" without flashing a terminal window. Task Scheduler calls this file;
' calling node directly would pop a console every time.
'   wscript run-hidden.vbs "C:\path\to\script.mjs" [workdir]
Set args = WScript.Arguments
Set sh = CreateObject("WScript.Shell")
If args.Count > 1 Then sh.CurrentDirectory = args(1)
sh.Run "node """ & args(0) & """", 0, False
