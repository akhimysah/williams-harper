#!/bin/bash
# Dépôt du paquet OVH sur l'hébergement williams-harper.com, par SSH (clé) et rsync.
#
# Usage : ovh-site/deploy_ovh.sh [--dry-run]
#
# Pré-requis : la clé SSH du Mac déposée chez OVH (ssh-copy-id prvnqzc@ssh.cluster123.hosting.ovh.net),
#              le paquet généré dans ovh-site/dist/Williams_Harper_OVH_Nouvelle_Base (build_ovh.py).
# Étapes :     1) sauvegarde distante (tar.gz horodaté dans ~/sauvegardes/) de la racine publique et de app/ ;
#              2) rsync de www/ vers la racine publique (williams-harper.com/) et de app/ vers ~/app/,
#                 en conservant app/config.php et toute donnée propre au serveur ;
#              3) le .htaccess en ligne est conservé en copie (.htaccess.avant-YYYYmmdd) avant remplacement.
set -euo pipefail
HOST="prvnqzc@ssh.cluster123.hosting.ovh.net"
PKG="$(cd "$(dirname "$0")" && pwd)/dist/Williams_Harper_OVH_Nouvelle_Base"
PUBLIC="williams-harper.com"   # dossier racine du site (onglet « Mes sites » de l'espace OVH)
APP="app"                      # dossier app/ hors racine publique (vérifié à la connexion)
DRY=""; [ "${1:-}" = "--dry-run" ] && DRY="--dry-run"
STAMP=$(date +%Y%m%d-%H%M)

[ -d "$PKG/www" ] && [ -d "$PKG/app" ] || { echo "Paquet introuvable : $PKG"; exit 1; }
echo "== Connexion et état du serveur =="
ssh -o BatchMode=yes "$HOST" "echo ok; ls -d $PUBLIC $APP 2>&1; df -h . | tail -1"

echo "== Sauvegarde distante (~/sauvegardes/site-$STAMP.tar.gz) =="
[ -n "$DRY" ] || ssh -o BatchMode=yes "$HOST" "mkdir -p sauvegardes && tar czf sauvegardes/site-$STAMP.tar.gz $PUBLIC $APP 2>/dev/null; ls -la sauvegardes | tail -3; cp -n $PUBLIC/.htaccess $PUBLIC/.htaccess.avant-$STAMP 2>/dev/null || true"

echo "== Dépôt de www/ → $PUBLIC/ =="
rsync -az $DRY --itemize-changes --exclude='.DS_Store' "$PKG/www/" "$HOST:$PUBLIC/" | tail -20

echo "== Dépôt de app/ → $APP/ (config.php conservé) =="
rsync -az $DRY --itemize-changes --exclude='.DS_Store' --exclude='config.php' "$PKG/app/" "$HOST:$APP/" | tail -20

echo "== Vérification =="
[ -n "$DRY" ] || curl -s -o /dev/null -w "https://williams-harper.com → %{http_code}\n" -H 'Cache-Control: no-cache' https://williams-harper.com/
[ -n "$DRY" ] || curl -s https://williams-harper.com/ -H 'Cache-Control: no-cache' | grep -o 'wh-base.css?v=[^"]*' | head -1
echo "Terminé${DRY:+ (simulation)}."
