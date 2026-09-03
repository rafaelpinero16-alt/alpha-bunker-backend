#!/bin/bash
# 🔒 set -e: si pip install falla, el proceso termina inmediatamente
# en vez de intentar levantar uvicorn con dependencias a medio instalar
# (lo que daba errores confusos e imposibles de diagnosticar en Railway).
set -e

pip install --no-cache-dir -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}