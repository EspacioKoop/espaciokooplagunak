# syntax=docker/dockerfile:1
# Puente de integración Espaciokoop Lagunak ↔ Foundry VTT.
# Contexto de build: el directorio bridge/.

# Base Alpine en lugar de Debian slim: el puente es Python puro (todas las
# dependencias traen rueda musllinux), y así la imagen no arrastra perl-base,
# util-linux ni ncurses, que en Debian acumulan CVE CRITICAL/HIGH sin parche.
#
# Etapa de construcción: aquí sí hay pip, y ni él, ni setuptools, ni sus
# dependencias vendorizadas (msgpack) llegan a la imagen final.
FROM python:3.14-alpine AS build

COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip setuptools \
    && /opt/venv/bin/pip install --no-cache-dir --only-binary=:all: -r requirements.txt \
    && /opt/venv/bin/pip uninstall -y pip setuptools

FROM python:3.14-alpine

# Parches de seguridad del sistema base, y fuera el gestor de paquetes de
# Python: la imagen de ejecución no instala nada, así que pip/setuptools solo
# aportan superficie de ataque y CVE (CVE-2025-47273, msgpack vendorizado).
RUN apk upgrade --no-cache \
    && python -m pip uninstall -y pip setuptools wheel 2>/dev/null || true \
    && rm -rf /usr/local/lib/python3.14/ensurepip \
    && adduser -S -D -H -u 10001 bridge

COPY --from=build /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app
COPY app.py lua_templates.py http_middleware.py rate_limit.py command_models.py .

ENV BRIDGE_PORT=8090
USER bridge
EXPOSE 8090

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os,urllib.request;urllib.request.urlopen(f'http://localhost:{os.environ[\"BRIDGE_PORT\"]}/healthz', timeout=4)" || exit 1

CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${BRIDGE_PORT}"]
