#!/bin/bash
# One-time setup: a private Python 3.12 environment with MediaPipe and OpenCV, inside this folder. Nothing is installed system-wide.
set -e
cd "$(dirname "$0")"
command -v uv >/dev/null || { echo "Install uv first (https://docs.astral.sh/uv/), then run this again."; exit 1; }
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python -c "import mediapipe, cv2; print('Ready. MediaPipe', mediapipe.__version__)"
