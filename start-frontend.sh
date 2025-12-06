#!/bin/sh
# Use Railway's PORT environment variable, or default to 8000
PORT=${PORT:-8000}
npx serve . -l tcp://0.0.0.0:$PORT -s
