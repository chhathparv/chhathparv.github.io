#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "=================================================="
echo "Chhath Mahaparv - Abhinav Kumar"
echo "Opening http://localhost:8000 in your browser..."
echo "Leave this Terminal window open while using the website."
echo "Press Ctrl+C to stop."
echo "=================================================="
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is needed. Install it, or publish this folder to a static host."
  read -r -p 'Press Enter to exit...'
  exit 1
fi
(sleep 2; open 'http://localhost:8000') &
python3 -m http.server 8000
