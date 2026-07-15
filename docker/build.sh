#!/usr/bin/env bash

# Abort at the first error.
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_DIR="$( cd "${SCRIPT_DIR}/.." && pwd )"

# Revisión FIJA de SeriousProton, la misma que docker/Dockerfile, para que el
# gate de CI sea reproducible (un cambio en el master vivo de SeriousProton no
# debe poder romper la CI de este repo sin un commit local). Al sincronizar con
# upstream, actualiza esta revisión y la del Dockerfile a la vez (docs/UPSTREAM.md).
SERIOUS_PROTON_REPO="${SERIOUS_PROTON_REPO:-https://github.com/daid/SeriousProton.git}"
SERIOUS_PROTON_REF="${SERIOUS_PROTON_REF:-e6f10ae5a3fcffc8f36ced0e7823cb3c57797acd}"

echo "Using SeriousProton ref ${SERIOUS_PROTON_REF} ..."

git init "${PROJECT_DIR}"/SeriousProton
git -C "${PROJECT_DIR}"/SeriousProton remote add origin "${SERIOUS_PROTON_REPO}"
git -C "${PROJECT_DIR}"/SeriousProton fetch --depth=1 origin "${SERIOUS_PROTON_REF}"
git -C "${PROJECT_DIR}"/SeriousProton checkout FETCH_HEAD

mkdir build
cd build
# WARNING_IS_ERROR también aquí: este es el único job que ejecuta el CTest del
# fork, y sin él un warning nuevo en src/ pasaría la CI Linux sin ruido.
cmake .. -DSERIOUS_PROTON_DIR=$PROJECT_DIR/SeriousProton/ -DBUILD_CONTENT_RESOURCE_TESTS=ON -DWARNING_IS_ERROR=1
make -j"$(nproc)"
ctest --output-on-failure

