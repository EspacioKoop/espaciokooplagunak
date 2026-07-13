#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "${script_dir}/.." && pwd)"

if [[ -n "${ESPACIOKOOP_BIN:-}" ]]; then
    binary="${ESPACIOKOOP_BIN}"
elif [[ -x "${repo_dir}/build/EmptyEpsilon" ]]; then
    binary="${repo_dir}/build/EmptyEpsilon"
elif [[ -x "${HOME}/.local/share/espaciokoop-lagunak/EmptyEpsilon" ]]; then
    binary="${HOME}/.local/share/espaciokoop-lagunak/EmptyEpsilon"
else
    printf '%s\n' \
        "No encuentro un cliente EmptyEpsilon ejecutable." \
        "Compila el repositorio o define ESPACIOKOOP_BIN=/ruta/EmptyEpsilon." >&2
    exit 1
fi

binary="$(realpath -- "${binary}")"
if [[ "${binary}" == "${repo_dir}/"* ]]; then
    run_dir="${repo_dir}"
else
    run_dir="$(dirname -- "${binary}")"
fi

cd -- "${run_dir}"
exec "${binary}" \
    "server_scenario=scenario_90_lagunak_primera_guardia.lua" \
    "scenario_settings=Modo=Prueba individual" \
    "server_name=Espaciokoop Lagunak - QA individual" \
    "server_internet=0" \
    "language=${ESPACIOKOOP_LANGUAGE:-es}" \
    "$@"
