#!/bin/sh
cd "$(dirname "$0")" || exit 1
printf '%s\n' 'Chhath Mahaparv - Abhinav Kumar' 'Open http://localhost:8000 in your browser. Press Ctrl+C to stop.'
(sleep 2; command -v xdg-open >/dev/null 2>&1 && xdg-open 'http://localhost:8000' >/dev/null 2>&1) &
exec python3 -m http.server 8000
