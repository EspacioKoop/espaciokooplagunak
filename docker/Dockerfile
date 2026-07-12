# syntax=docker/dockerfile:1
#
# Imagen del servidor headless de Espaciokoop Lagunak.
#
# Compila EmptyEpsilon contra una revisión FIJA de SeriousProton para que la
# imagen sea reproducible. Para actualizar la revisión, cambia el ARG
# SERIOUS_PROTON_REF (debe acompañar a una sincronización de upstream, ver
# docs/UPSTREAM.md).
#
# Contexto de build: la raíz del repositorio.
#   docker build -f docker/Dockerfile -t espaciokooplagunak-server:dev .

ARG SERIOUS_PROTON_REPO=https://github.com/daid/SeriousProton.git
ARG SERIOUS_PROTON_REF=e6f10ae5a3fcffc8f36ced0e7823cb3c57797acd

FROM debian:bookworm-slim AS build
ARG SERIOUS_PROTON_REPO
ARG SERIOUS_PROTON_REF

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential cmake ninja-build git ca-certificates \
        libsdl2-dev libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git init SeriousProton \
    && git -C SeriousProton remote add origin "${SERIOUS_PROTON_REPO}" \
    && git -C SeriousProton fetch --depth=1 origin "${SERIOUS_PROTON_REF}" \
    && git -C SeriousProton checkout FETCH_HEAD

COPY . EmptyEpsilon

RUN cmake -S EmptyEpsilon -B /build -G Ninja \
        -DCMAKE_BUILD_TYPE=RelWithDebInfo \
        -DSERIOUS_PROTON_DIR=/src/SeriousProton \
    && cmake --build /build

FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        libsdl2-2.0-0 libfreetype6 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 espaciokoop

WORKDIR /opt/espaciokoop
COPY --from=build --chown=espaciokoop /build/EmptyEpsilon ./EmptyEpsilon
COPY --from=build --chown=espaciokoop /src/EmptyEpsilon/resources ./resources
COPY --from=build --chown=espaciokoop /src/EmptyEpsilon/scripts ./scripts
COPY --from=build --chown=espaciokoop /src/EmptyEpsilon/packs ./packs
COPY --from=build --chown=espaciokoop /src/EmptyEpsilon/www ./www
COPY --from=build --chmod=755 /src/EmptyEpsilon/docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# Sin ventana ni audio: el servidor corre sin GPU ni X server.
ENV SDL_VIDEODRIVER=dummy \
    SDL_AUDIODRIVER=dummy \
    EE_SCENARIO=scenario_00_basic.lua \
    EE_SERVER_NAME="Espaciokoop Lagunak" \
    EE_SERVER_PORT=35666 \
    EE_HTTP_PORT=8080

USER espaciokoop

# 35666: clientes del puente de mando (LAN). 8080: API HTTP heredada —
# NUNCA publicar este puerto fuera de la red interna de compose.
EXPOSE 35666/tcp 35666/udp 8080/tcp

HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=5 \
    CMD curl -fsS "http://localhost:${EE_HTTP_PORT}/" > /dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
