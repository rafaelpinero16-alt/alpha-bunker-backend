#!/bin/bash
cd "$(dirname "$0")"
source venv/Scripts/activate 2>/dev/null || source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000