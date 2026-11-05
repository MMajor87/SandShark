; installs the server as a windows service, run by winsw (https://github.com/winsw/winsw) as the
; built in LocalService account. built by build/build-windows-installer.ts, which passes the
; defines below
;
; layout, where $APPDATA is ProgramData once SetShellVarContext all has run:
;   $INSTDIR (program files)              winsw and its config, which only admins can change, so
;                                         the service can never rewrite how it is run
;   $APPDATA\SandShark Server\bin         the server, writable by the service so the server can
;                                         update itself the way it does anywhere else
;   $APPDATA\SandShark Server\data        the server's data (SANDSHARK_DATA_PATH)
;   $APPDATA\SandShark Server\logs        winsw's own logs of the server's console output

Unicode true
SetCompressor /SOLID lzma

!ifndef VERSION | SERVER_EXE | WINSW_EXE | OUTFILE | LICENSE_FILE | ICON_FILE
  !error "build/build-windows-installer.ts passes VERSION, SERVER_EXE, WINSW_EXE, OUTFILE, LICENSE_FILE and ICON_FILE"
!endif

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

!define PRODUCT "SandShark Server"
!define SERVICE_ID "SandSharkServer"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${SERVICE_ID}"
!define HTTP_PORT "4991"
!define WEBRTC_PORT "40000"
!define FIREWALL_TCP "SandShark Server (TCP ${HTTP_PORT})"
!define FIREWALL_UDP "SandShark Server (UDP ${WEBRTC_PORT})"
; well known sids, so the rules hold on windows in any language
!define SID_SYSTEM "*S-1-5-18"
!define SID_LOCAL_SERVICE "*S-1-5-19"
!define SID_ADMINISTRATORS "*S-1-5-32-544"

Name "${PRODUCT} ${VERSION}"
OutFile "${OUTFILE}"
InstallDir "$PROGRAMFILES64\${PRODUCT}"
InstallDirRegKey HKLM "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel admin
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${PRODUCT}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "${PRODUCT} ${VERSION} Setup"
VIAddVersionKey "LegalCopyright" "SandShark contributors"

Var DataRoot

!define MUI_ICON "${ICON_FILE}"
!define MUI_UNICON "${ICON_FILE}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Open the server monitor"
!define MUI_FINISHPAGE_RUN_FUNCTION OpenMonitor

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${LICENSE_FILE}"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "${PRODUCT} needs 64 bit Windows."
    Abort
  ${EndIf}

  SetRegView 64
  SetShellVarContext all
  StrCpy $DataRoot "$APPDATA\${PRODUCT}"
FunctionEnd

Function un.onInit
  SetRegView 64
  SetShellVarContext all
  StrCpy $DataRoot "$APPDATA\${PRODUCT}"
FunctionEnd

; the server needs a few seconds after the service starts before it answers
Function OpenMonitor
  Sleep 3000
  ExecShell "open" "http://localhost:${HTTP_PORT}/monitor"
FunctionEnd

; runs a winsw command against the installed service, quietly when it does not apply (stopping a
; service that is not running, removing one that was never installed)
!macro ServiceCommand COMMAND
  ${If} ${FileExists} "$INSTDIR\sandshark-service.exe"
    nsExec::ExecToLog '"$INSTDIR\sandshark-service.exe" ${COMMAND}'
    Pop $0
  ${EndIf}
!macroend

!macro RemoveFirewallRules
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${FIREWALL_TCP}"'
  Pop $0
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${FIREWALL_UDP}"'
  Pop $0
!macroend

; a start menu shortcut that runs a winsw command with the admin prompt services need
!macro ServiceShortcut LABEL COMMAND
  CreateShortcut "$SMPROGRAMS\${PRODUCT}\${LABEL}.lnk" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
    "-NoProfile -WindowStyle Hidden -Command $\"Start-Process -FilePath '$INSTDIR\sandshark-service.exe' -ArgumentList '${COMMAND}' -Verb RunAs -WindowStyle Hidden$\"" \
    "$INSTDIR\sandshark-service.exe" 0 SW_SHOWMINIMIZED
!macroend

Section "${PRODUCT}" SecServer
  SectionIn RO

  ; an upgrade replaces the files of a running service, so it is stopped and removed first, and
  ; installed again below with this version's config
  !insertmacro ServiceCommand "stop"
  !insertmacro ServiceCommand "uninstall"
  Sleep 2000

  SetOutPath "$INSTDIR"
  File "/oname=sandshark-service.exe" "${WINSW_EXE}"
  File "/oname=LICENSE.txt" "${LICENSE_FILE}"
  File "/oname=sandshark.ico" "${ICON_FILE}"

  CreateDirectory "$DataRoot\bin"
  CreateDirectory "$DataRoot\data"
  CreateDirectory "$DataRoot\logs"

  SetOutPath "$DataRoot\bin"
  File "/oname=sandshark.exe" "${SERVER_EXE}"

  ; programdata lets every user read what is created in it, and the data holds the database.
  ; only the system, administrators and the service itself get in
  nsExec::ExecToLog 'icacls "$DataRoot" /inheritance:r /grant:r "${SID_SYSTEM}:(OI)(CI)F" "${SID_ADMINISTRATORS}:(OI)(CI)F" "${SID_LOCAL_SERVICE}:(OI)(CI)M" /T /C /Q'
  Pop $0

  ${If} $0 != 0
    DetailPrint "Could not set the permissions of $DataRoot (icacls exited with $0)."
    Abort "Could not set the permissions of the server's data folder."
  ${EndIf}

  ; written here rather than shipped, since it holds the paths of this install
  FileOpen $1 "$INSTDIR\sandshark-service.xml" w
  FileWrite $1 '<service>$\r$\n'
  FileWrite $1 '  <id>${SERVICE_ID}</id>$\r$\n'
  FileWrite $1 '  <name>${PRODUCT}</name>$\r$\n'
  FileWrite $1 '  <description>Runs the SandShark chat and voice server.</description>$\r$\n'
  FileWrite $1 '  <executable>$DataRoot\bin\sandshark.exe</executable>$\r$\n'
  FileWrite $1 '  <workingdirectory>$DataRoot</workingdirectory>$\r$\n'
  FileWrite $1 '  <env name="SANDSHARK_DATA_PATH" value="$DataRoot\data" />$\r$\n'
  FileWrite $1 '  <serviceaccount>$\r$\n'
  FileWrite $1 '    <domain>NT AUTHORITY</domain>$\r$\n'
  FileWrite $1 '    <user>LocalService</user>$\r$\n'
  FileWrite $1 '  </serviceaccount>$\r$\n'
  FileWrite $1 '  <startmode>Automatic</startmode>$\r$\n'
  FileWrite $1 '  <delayedAutoStart/>$\r$\n'
  ; the server exiting with an error is restarted. so is a self update: the updater ends the old
  ; process and swaps the binary, and the delay leaves it time to finish
  FileWrite $1 '  <onfailure action="restart" delay="10 sec"/>$\r$\n'
  FileWrite $1 '  <onfailure action="restart" delay="30 sec"/>$\r$\n'
  FileWrite $1 '  <onfailure action="restart" delay="1 min"/>$\r$\n'
  FileWrite $1 '  <resetfailure>1 hour</resetfailure>$\r$\n'
  FileWrite $1 '  <stoptimeout>30 sec</stoptimeout>$\r$\n'
  FileWrite $1 '  <logpath>$DataRoot\logs</logpath>$\r$\n'
  FileWrite $1 '  <log mode="roll-by-size">$\r$\n'
  FileWrite $1 '    <sizeThreshold>10240</sizeThreshold>$\r$\n'
  FileWrite $1 '    <keepFiles>5</keepFiles>$\r$\n'
  FileWrite $1 '  </log>$\r$\n'
  FileWrite $1 '</service>$\r$\n'
  FileClose $1

  nsExec::ExecToLog '"$INSTDIR\sandshark-service.exe" install'
  Pop $0

  ${If} $0 != 0
    Abort "Could not install the ${PRODUCT} service (exit code $0)."
  ${EndIf}

  nsExec::ExecToLog '"$INSTDIR\sandshark-service.exe" start'
  Pop $0

  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION "The service was installed but did not start (exit code $0). See the logs in $DataRoot\logs."
  ${EndIf}

  CreateDirectory "$SMPROGRAMS\${PRODUCT}"
  WriteINIStr "$SMPROGRAMS\${PRODUCT}\Server Monitor.url" "InternetShortcut" "URL" "http://localhost:${HTTP_PORT}/monitor"
  WriteINIStr "$SMPROGRAMS\${PRODUCT}\Server Monitor.url" "InternetShortcut" "IconFile" "$INSTDIR\sandshark.ico"
  WriteINIStr "$SMPROGRAMS\${PRODUCT}\Server Monitor.url" "InternetShortcut" "IconIndex" "0"
  !insertmacro ServiceShortcut "Start Server" "start"
  !insertmacro ServiceShortcut "Stop Server" "stop"
  !insertmacro ServiceShortcut "Restart Server" "restart"
  CreateShortcut "$SMPROGRAMS\${PRODUCT}\Server Data.lnk" "$DataRoot"

  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher" "SandShark"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\sandshark.ico"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegStr HKLM "${UNINSTALL_KEY}" "URLInfoAbout" "https://github.com/MMajor87/SandShark"
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Allow through Windows Firewall" SecFirewall
  ; removed first so a reinstall does not stack duplicates
  !insertmacro RemoveFirewallRules
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="${FIREWALL_TCP}" dir=in action=allow protocol=TCP localport=${HTTP_PORT}'
  Pop $0
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="${FIREWALL_UDP}" dir=in action=allow protocol=UDP localport=${WEBRTC_PORT}'
  Pop $0
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecServer} "The server, run as a Windows service that starts with the computer."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecFirewall} "Lets other computers reach the server: TCP ${HTTP_PORT} for the app and UDP ${WEBRTC_PORT} for voice."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  !insertmacro ServiceCommand "stop"
  !insertmacro ServiceCommand "uninstall"
  !insertmacro RemoveFirewallRules

  RMDir /r "$SMPROGRAMS\${PRODUCT}"
  Delete "$INSTDIR\sandshark-service.exe"
  Delete "$INSTDIR\sandshark-service.xml"
  Delete "$INSTDIR\LICENSE.txt"
  Delete "$INSTDIR\sandshark.ico"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "${UNINSTALL_KEY}"

  RMDir /r "$DataRoot\bin"

  ; the data outlives an uninstall unless the owner asks otherwise, and a silent uninstall
  ; always keeps it
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
    "Also delete the server's data, including its database and uploads, in $DataRoot?" \
    /SD IDNO IDNO keepData
  RMDir /r "$DataRoot"
  Goto done

  keepData:
  DetailPrint "Kept the server's data in $DataRoot."

  done:
SectionEnd
