Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "C:\Users\thinh\Documents\GitHub\08103007\pdf-server\start.bat" & chr(34) & " --silent", 0
Set WshShell = Nothing
