#!/bin/bash
# Dépôt du paquet OVH sur williams-harper.com par SSH (clé) et rsync — structure réelle du serveur (2026-10-23) :
#   /home/prvnqzc/williams-harper.com  = racine publique ; le moteur PHP est DANS cette racine (williams-harper.com/app/),
#   protégé par la règle « RewriteRule ^app(?:/|$) - [F,L] » du .htaccess (ajoutée au .htaccess du paquet, qui ne l'a pas),
#   /home/prvnqzc/app                  = copie non utilisée, mise à jour aussi ; old/ (6,9 Go, ancien site) jamais touché.
# Pré-requis : clé SSH déposée (ssh-copy-id, ou curl -T ~/.ssh/id_ed25519.pub sftp://ftp.cluster123.hosting.ovh.net/home/prvnqzc/.ssh/authorized_keys),
#              paquet généré par build_ovh.py. Usage : ovh-site/deploy_ovh.sh
set -euo pipefail
HOST="prvnqzc@ssh.cluster123.hosting.ovh.net"
PKG="$(cd "$(dirname "$0")" && pwd)/dist/Williams_Harper_OVH_Nouvelle_Base"
T="$(mktemp -d)"
STAMP=$(date +%Y%m%d-%H%M)
python3 - "$PKG/www/.htaccess" "$T/htaccess.merged" <<'PY'
import sys, pathlib
pkg = pathlib.Path(sys.argv[1]).read_text(); needle = "    RewriteEngine On\n"
assert pkg.count(needle) == 1
rule = "    # Moteur PHP, modèles et configuration : jamais accessibles depuis le web\n    RewriteRule ^app(?:/|$) - [F,L]\n"
pathlib.Path(sys.argv[2]).write_text(pkg if "^app(?:/|$)" in pkg else pkg.replace(needle, needle + rule, 1))
PY
echo "== 1. Sauvegarde distante (hors old/) =="
ssh -o BatchMode=yes "$HOST" "mkdir -p sauvegardes && tar czf sauvegardes/site-$STAMP.tar.gz --exclude=williams-harper.com/old williams-harper.com app && ls -la sauvegardes/site-$STAMP.tar.gz"
echo "== 2. Simulation rsync (www → williams-harper.com/) =="
rsync -az --dry-run --stats --exclude='.DS_Store' --exclude='.htaccess' "$PKG/www/" "$HOST:williams-harper.com/" | grep -E "Number of (regular files transferred|created files|deleted)|Total transferred"
echo "== 3. Dépôt www → williams-harper.com/ (sans suppression, .htaccess à part) =="
rsync -az --exclude='.DS_Store' --exclude='.htaccess' "$PKG/www/" "$HOST:williams-harper.com/"
echo "== 4. Dépôt app → williams-harper.com/app/ et ~/app/ (config.php du paquet, site_url renseigné) =="
rsync -az --exclude='.DS_Store' "$PKG/app/" "$HOST:williams-harper.com/app/"
rsync -az --exclude='.DS_Store' "$PKG/app/" "$HOST:app/"
echo "== 5. .htaccess fusionné (règle app conservée) =="
scp -q -o BatchMode=yes "$T/htaccess.merged" "$HOST:williams-harper.com/.htaccess"
echo "== 6. Contrôle distant =="
ssh -o BatchMode=yes "$HOST" "cd williams-harper.com && grep -c 'RewriteRule \^app' .htaccess && grep -o \"site_url' => '[^']*'\" app/config.php && ls assets | grep -c . && ls assets/wh-base.css assets/vision-1.mp4 assets/domaine-film-720.mp4 && du -sh assets brochures"
echo "TERMINE $STAMP"
