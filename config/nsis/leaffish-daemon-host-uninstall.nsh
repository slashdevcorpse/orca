; Clean up the relocated Leaffish terminal daemon on a REAL uninstall.
; Updates preserve this versioned host so live terminals can reattach.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    nsExec::Exec 'taskkill /F /IM leaffish-terminal-daemon.exe'
    Sleep 500
    RMDir /r "$LOCALAPPDATA\Leaffish\daemon-host"
  ${endIf}
!macroend
