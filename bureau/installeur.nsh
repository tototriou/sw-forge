; Ajouts au désinstalleur Windows (NSIS) — chantier application-bureau,
; lot 3, décision 8 : la désinstallation ne laisse rien.
;
; L'installeur se recopie à chaque installation dans
; `%LOCALAPPDATA%\swblacksmith-updater\installer.exe` (113 Mo) : la mise à
; jour automatique s'en sert de base pour ne télécharger que la différence
; (app-builder-lib, templates/nsis/include/installer.nsh). Le désinstalleur
; d'electron-builder ne l'efface jamais : on le fait ici.
;
; ⚠️ Jamais pendant une MISE À JOUR (`--updated`) : l'installeur qui tourne
; alors vit dans ce dossier (`pending\`), et il y recopiera le sien.
; ⚠️ Le nom vient de package.json (`name` + `-updater`) : à suivre s'il change.
; ⚠️ Installée « pour tous les utilisateurs », le désinstalleur travaille dans
; le contexte « all », où `$LOCALAPPDATA` désigne ProgramData : la copie, elle,
; est toujours dans le profil (installer.nsh l'y pose de même).

!macro customUnInstall
  ${ifNot} ${isUpdated}
    ${if} $installMode == "all"
      SetShellVarContext current
    ${endif}
    RMDir /r "$LOCALAPPDATA\swblacksmith-updater"
    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}
  ${endIf}
!macroend
