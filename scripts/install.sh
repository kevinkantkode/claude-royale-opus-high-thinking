#!/bin/bash
# Pre-install all dependencies (backend, frontend, CLIP model).
# Run once before dev.sh. No code changes; safe to delete if you want to revert.
set -e
cd "$(dirname "$0")/.." || exit 1

echo "Installing backend dependencies..."
python3 -m pip install -r backend/requirements.txt

echo ""
echo "Pre-downloading CLIP model (~350MB, skip if already cached)..."
# Skip if already cached; otherwise download (may fail on proxy/VPN)
export HF_HUB_DISABLE_PROGRESS_BARS=0
python3 -u -c "
from huggingface_hub import snapshot_download
try:
    snapshot_download('openai/clip-vit-base-patch32', local_files_only=True)
    print('CLIP model already cached.', flush=True)
except Exception:
    print('Downloading...', flush=True)
    snapshot_download('openai/clip-vit-base-patch32')
    print('CLIP model cached.', flush=True)
" || echo "(CLIP download skipped or failed; will use cache on first vision use)"

echo ""
echo "Installing frontend dependencies..."
(cd frontend && npm install)

echo ""
echo "Done. Run: npm run dev  (or ./scripts/dev.sh)"
