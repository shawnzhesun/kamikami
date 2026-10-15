@echo off
rem KamiKami's MCP server, run on the app's own runtime so clients need no Node.
rem Installed in resources\bin under the install folder. Register this file with your MCP client.
set "KAMIKAMI_APP=%~dp0..\..\KamiKami.exe"
set "ELECTRON_RUN_AS_NODE=1"
"%KAMIKAMI_APP%" "%~dp0..\app\desktop-build\mcp.mjs" %*
