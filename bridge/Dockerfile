# syntax=docker/dockerfile:1
# Puente de integración Espaciokoop Lagunak ↔ Foundry VTT.
# Contexto de build: el directorio bridge/.

FROM python:3.12-slim

RUN useradd --system --create-home --uid 10001 bridge

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

ENV BRIDGE_PORT=8090
USER bridge
EXPOSE 8090

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os,urllib.request;urllib.request.urlopen(f'http://localhost:{os.environ[\"BRIDGE_PORT\"]}/healthz', timeout=4)" || exit 1

CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${BRIDGE_PORT}"]
