#!/usr/bin/env python3
"""Asistente de instalación y configuración de Espaciokoop Lagunak.

Un único punto de entrada, sin dependencias fuera de la biblioteca estándar,
que:

  * autodetecta el sistema operativo, la distribución y el gestor de paquetes;
  * comprueba los requisitos de cada vía de instalación (Docker o nativa);
  * genera y guarda de forma segura la configuración del puente (``docker/.env``);
  * ofrece un menú para modificar opciones (puertos, escenario, token, sondeo…);
  * enlaza el módulo de Foundry VTT en la instalación local.

Filosofía de seguridad (ver ``AGENTS.md``): el asistente NUNCA instala paquetes
del sistema por su cuenta ni fuerza cambios opacos. Para las dependencias del
sistema se limita a MOSTRAR el comando exacto; quien instala es la persona. Las
acciones que sí ejecuta (crear ``docker/.env``, enlazar el módulo, levantar
Docker) se confirman antes o requieren una bandera explícita, y los secretos
(el ``BRIDGE_TOKEN``) nunca se imprimen enteros ni se escriben en logs.

Uso interactivo:

    python3 tools/instalar.py

Uso no interactivo (automatización, CI, pruebas):

    python3 tools/instalar.py --detectar            # detección en JSON
    python3 tools/instalar.py --diagnostico         # requisitos por vía
    python3 tools/instalar.py --generar-token       # imprime un token nuevo
    python3 tools/instalar.py --imprimir-config     # docker/.env (token oculto)
    python3 tools/instalar.py --set EE_SERVER_PORT=36000 BRIDGE_PORT=8091
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

# ``tools/`` cuelga de la raíz del repositorio.
RAIZ = Path(__file__).resolve().parents[1]
ENV_EJEMPLO = RAIZ / "docker" / ".env.example"
ENV_DESTINO = RAIZ / "docker" / ".env"
MODULO_FOUNDRY = RAIZ / "foundry-module"
ID_MODULO = "espaciokoop-lagunak"

# --- Detección de sistema ----------------------------------------------------

# Gestor de paquetes por identificador de distribución (os-release ID / ID_LIKE).
_DISTRO_A_GESTOR = {
    "debian": "apt",
    "ubuntu": "apt",
    "linuxmint": "apt",
    "pop": "apt",
    "raspbian": "apt",
    "fedora": "dnf",
    "rhel": "dnf",
    "centos": "dnf",
    "rocky": "dnf",
    "almalinux": "dnf",
    "arch": "pacman",
    "cachyos": "pacman",
    "manjaro": "pacman",
    "endeavouros": "pacman",
    "opensuse": "zypper",
    "opensuse-leap": "zypper",
    "opensuse-tumbleweed": "zypper",
    "suse": "zypper",
}

# Comando de instalación de dependencias NATIVAS por gestor. Solo se muestra;
# nunca se ejecuta desde el asistente (requiere privilegios y decisión humana).
_PAQUETES_NATIVOS = {
    "apt": "sudo apt update && sudo apt install build-essential cmake ninja-build libsdl2-dev lua5.3 git",
    "dnf": "sudo dnf install gcc-c++ cmake ninja-build SDL2-devel lua git",
    "pacman": "sudo pacman -S --needed base-devel cmake ninja sdl2 lua git",
    "zypper": "sudo zypper install gcc-c++ cmake ninja libSDL2-devel lua53 git",
    "brew": "brew install cmake ninja sdl2 lua git",
}


def _os_release(system: str) -> dict[str, str]:
    """Lee ``/etc/os-release`` de forma tolerante (solo tiene sentido en Linux)."""
    if system != "Linux":
        return {}
    try:
        return platform.freedesktop_os_release()  # Python 3.10+
    except (OSError, AttributeError):
        return {}


def _distros_candidatas(datos: dict[str, str]) -> list[str]:
    ids = []
    if datos.get("ID"):
        ids.append(datos["ID"].lower())
    ids.extend(p.lower() for p in datos.get("ID_LIKE", "").split())
    return ids


def gestor_de_paquetes(system: str, datos_os: dict[str, str], which=shutil.which) -> str | None:
    """Determina el gestor de paquetes ('apt', 'dnf', 'pacman', 'zypper', 'brew').

    Primero por identificador de distribución (os-release); si no concluye, se
    sondea qué ejecutables existen en el PATH. Devuelve ``None`` si no se
    reconoce ninguno (p. ej. Windows).
    """
    if system == "Darwin":
        # Homebrew no viene con macOS: solo se anuncia si está instalado.
        return "brew" if which("brew") else None
    if system == "Linux":
        for candidato in _distros_candidatas(datos_os):
            if candidato in _DISTRO_A_GESTOR:
                return _DISTRO_A_GESTOR[candidato]
        for ejecutable, gestor in (
            ("apt-get", "apt"),
            ("dnf", "dnf"),
            ("pacman", "pacman"),
            ("zypper", "zypper"),
        ):
            if which(ejecutable):
                return gestor
    return None


def ruta_modulos_foundry(system: str, entorno=None) -> Path | None:
    """Ruta por defecto del directorio ``Data/modules`` de Foundry VTT por SO."""
    entorno = os.environ if entorno is None else entorno
    home = Path(entorno.get("HOME", entorno.get("USERPROFILE", "~"))).expanduser()
    if system == "Windows":
        base = entorno.get("LOCALAPPDATA")
        raiz = Path(base) if base else home / "AppData" / "Local"
        return raiz / "FoundryVTT" / "Data" / "modules"
    if system == "Darwin":
        return home / "Library" / "Application Support" / "FoundryVTT" / "Data" / "modules"
    if system == "Linux":
        return home / ".local" / "share" / "FoundryVTT" / "Data" / "modules"
    return None


def detectar_sistema(which=shutil.which, entorno=None) -> dict:
    """Instantánea del entorno relevante para instalar. Todo inyectable = testable."""
    system = platform.system()
    datos_os = _os_release(system)
    gestor = gestor_de_paquetes(system, datos_os, which=which)
    modulos = ruta_modulos_foundry(system, entorno=entorno)
    return {
        "sistema": system or "desconocido",
        "distribucion": datos_os.get("PRETTY_NAME") or datos_os.get("NAME") or system,
        "arquitectura": platform.machine() or "desconocida",
        "gestor_paquetes": gestor,
        "comando_dependencias": _PAQUETES_NATIVOS.get(gestor or ""),
        "python": platform.python_version(),
        "modulos_foundry": str(modulos) if modulos else None,
        "modulos_foundry_existe": bool(modulos and modulos.is_dir()),
        "docker": bool(which("docker")),
        "docker_compose": _docker_compose_disponible(which),
    }


def _docker_compose_disponible(which) -> bool:
    if not which("docker"):
        return False
    try:
        salida = subprocess.run(
            ["docker", "compose", "version"],
            capture_output=True,
            timeout=10,
            check=False,
        )
        return salida.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


# --- Requisitos por vía ------------------------------------------------------


@dataclass
class Requisito:
    nombre: str
    ejecutable: str
    encontrado: bool
    pista: str = ""


REQUISITOS_DOCKER = (
    ("Docker", "docker"),
    ("Git", "git"),
)
REQUISITOS_NATIVO = (
    ("Git", "git"),
    ("CMake", "cmake"),
    ("Ninja", "ninja"),
    ("Compilador C++ (g++)", "g++"),
    ("Lua (luac)", "luac"),
)


def comprobar_requisitos(modo: str, which=shutil.which) -> list[Requisito]:
    """Lista de requisitos de una vía ('docker' | 'nativo') con si están o no."""
    tabla = REQUISITOS_DOCKER if modo == "docker" else REQUISITOS_NATIVO
    return [
        Requisito(nombre, ejec, bool(which(ejec)))
        for nombre, ejec in tabla
    ]


# --- Fichero .env ------------------------------------------------------------

_LINEA_CLAVE = re.compile(r"^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=)(.*)$")


def parse_env(texto: str) -> dict[str, str]:
    """Extrae pares KEY=VALUE de un fichero .env, ignorando comentarios."""
    valores: dict[str, str] = {}
    for linea in texto.splitlines():
        sin_espacios = linea.strip()
        if not sin_espacios or sin_espacios.startswith("#"):
            continue
        match = _LINEA_CLAVE.match(linea)
        if match:
            valores[match.group(2)] = match.group(4).strip()
    return valores


def fusionar_env(original: str, cambios: dict[str, str]) -> str:
    """Aplica ``cambios`` a un .env preservando comentarios, orden y formato.

    Las claves existentes se actualizan en su sitio; las nuevas se añaden al
    final. No reordena ni pierde comentarios: el objetivo es un ``git diff``
    mínimo y legible cuando la persona revise su configuración.
    """
    pendientes = dict(cambios)
    salida = []
    for linea in original.splitlines():
        match = _LINEA_CLAVE.match(linea)
        if match and match.group(2) in pendientes:
            clave = match.group(2)
            salida.append(f"{match.group(1)}{clave}{match.group(3)}{pendientes.pop(clave)}")
        else:
            salida.append(linea)
    if pendientes:
        if salida and salida[-1].strip():
            salida.append("")
        for clave, valor in pendientes.items():
            salida.append(f"{clave}={valor}")
    texto = "\n".join(salida)
    if original.endswith("\n") or not original:
        texto += "\n"
    return texto


def token_nuevo() -> str:
    """Token Bearer aleatorio, equivalente a ``openssl rand -hex 32``."""
    return secrets.token_hex(32)


def _ocultar_token(valor: str) -> str:
    if not valor:
        return "(sin definir)"
    if len(valor) <= 8:
        return "****"
    return f"{valor[:4]}…{valor[-4:]} ({len(valor)} car.)"


# --- Validación de opciones --------------------------------------------------


def validar_puerto(valor: str) -> int:
    numero = int(valor)
    if not 1 <= numero <= 65535:
        raise ValueError("un puerto debe estar entre 1 y 65535")
    return numero


def validar_intervalo(valor: str) -> int:
    numero = int(valor)
    if not 1 <= numero <= 30:
        raise ValueError("el intervalo de sondeo va de 1 a 30 segundos")
    return numero


# Opciones editables desde el menú, con validador y ayuda.
@dataclass
class Opcion:
    clave: str
    titulo: str
    ayuda: str
    validador: object = None  # callable(str) -> valor, o None (texto libre)
    secreto: bool = False


OPCIONES_EDITABLES = (
    Opcion("EE_SERVER_PORT", "Puerto del servidor de juego (LAN)",
           "Puerto TCP/UDP que publican los clientes del puente de mando.", validar_puerto),
    Opcion("BRIDGE_PORT", "Puerto del puente Foundry",
           "Puerto HTTP del puente que consume el módulo de Foundry.", validar_puerto),
    Opcion("BRIDGE_BIND", "Interfaz de escucha del puente",
           "127.0.0.1 = solo local (recomendado). Ampliar exige transporte confiable."),
    Opcion("EE_SCENARIO", "Escenario inicial",
           "Fichero .lua que arranca el servidor headless."),
    Opcion("EE_SERVER_NAME", "Nombre visible del servidor",
           "Cómo aparece la partida ante los clientes."),
    Opcion("EE_SERVER_PASSWORD", "Contraseña del servidor",
           "Vacío = sin contraseña.", None, True),
    Opcion("BRIDGE_TOKEN", "Token del puente (Bearer)",
           "Autoridad efectiva del puente. Genérese aleatorio; entréguese solo al GM.",
           None, True),
)


# --- Operaciones de escritura ------------------------------------------------


@dataclass
class ResultadoEnv:
    creado: bool
    ruta: Path
    cambios: dict[str, str] = field(default_factory=dict)


def _escribir_privado(destino: Path, contenido: str) -> None:
    """Escribe ``contenido`` en ``destino`` de forma atómica y privada.

    El ``.env`` contiene secretos (``BRIDGE_TOKEN`` y la contraseña del
    servidor), así que no puede quedar con permisos de umask (típicamente
    ``0644``, legible por otros) ni truncado a medias si algo falla. Se escribe
    primero a un temporal en el MISMO directorio —``mkstemp`` lo crea ya con
    modo ``0600``—, se sincroniza a disco y se reemplaza atómicamente con
    ``os.replace``; el fichero final hereda el ``0600`` del temporal en POSIX.
    """
    destino.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_nombre = tempfile.mkstemp(dir=str(destino.parent), prefix=".env-", suffix=".tmp")
    tmp = Path(tmp_nombre)
    try:
        if os.name == "posix":
            os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fichero:
            fichero.write(contenido)
            fichero.flush()
            os.fsync(fichero.fileno())
        os.replace(tmp, destino)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def asegurar_env(cambios: dict[str, str] | None = None,
                 ejemplo: Path = ENV_EJEMPLO,
                 destino: Path = ENV_DESTINO) -> ResultadoEnv:
    """Crea ``docker/.env`` desde el ejemplo si falta y aplica ``cambios``.

    Si el destino no existe y no se fija ``BRIDGE_TOKEN``, se genera uno: un
    ``.env`` recién creado nunca queda sin token (el puente no arrancaría). La
    escritura es atómica y con permisos ``0600`` (contiene secretos).
    """
    cambios = dict(cambios or {})
    creado = not destino.exists()
    base = destino.read_text(encoding="utf-8") if not creado else ejemplo.read_text(encoding="utf-8")
    if creado and "BRIDGE_TOKEN" not in cambios:
        existente = parse_env(base).get("BRIDGE_TOKEN", "")
        if not existente:
            cambios["BRIDGE_TOKEN"] = token_nuevo()
    nuevo = fusionar_env(base, cambios)
    _escribir_privado(destino, nuevo)
    return ResultadoEnv(creado=creado, ruta=destino, cambios=cambios)


def _ruta_respaldo(destino: Path) -> Path:
    """Ruta ``<destino>.bak-<fecha>`` libre para conservar contenido previo."""
    marca = time.strftime("%Y%m%d-%H%M%S")
    candidato = destino.with_name(f"{destino.name}.bak-{marca}")
    contador = 1
    while candidato.exists() or candidato.is_symlink():
        candidato = destino.with_name(f"{destino.name}.bak-{marca}-{contador}")
        contador += 1
    return candidato


def enlazar_modulo(directorio_modulos: Path,
                   origen: Path = MODULO_FOUNDRY,
                   copiar: bool = False,
                   sobrescribir: bool = False) -> Path:
    """Enlaza (o copia) el módulo en ``<Data>/modules/espaciokoop-lagunak``.

    Un ``symlink`` previo es nuestra propia instalación: se reemplaza sin más,
    porque quitar el enlace no borra su destino. Pero un DIRECTORIO REAL en esa
    ruta puede ser contenido del usuario y NUNCA se borra. Sin ``sobrescribir``
    la función se niega (``FileExistsError``); con ``sobrescribir`` el
    directorio anterior se CONSERVA renombrándolo a ``<destino>.bak-<fecha>``
    antes de instalar. Devuelve la ruta del módulo instalado.
    """
    directorio_modulos.mkdir(parents=True, exist_ok=True)
    destino = directorio_modulos / ID_MODULO
    if destino.is_symlink():
        destino.unlink()  # quitar el enlace no toca su destino
    elif destino.exists():
        if not sobrescribir:
            raise FileExistsError(
                f"ya existe contenido real en {destino}; no se sobrescribe sin "
                "confirmación (se conservaría en un .bak antes de reinstalar)"
            )
        destino.rename(_ruta_respaldo(destino))
    if copiar:
        shutil.copytree(origen, destino)
    else:
        destino.symlink_to(origen, target_is_directory=True)
    return destino


# --- Interfaz de consola -----------------------------------------------------

_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _c(texto: str, codigo: str) -> str:
    return f"\033[{codigo}m{texto}\033[0m" if _COLOR else texto


def _titulo(texto: str) -> None:
    print()
    print(_c(f"── {texto} ", "1;36") + _c("─" * max(0, 60 - len(texto)), "36"))


def _si(marca: bool) -> str:
    return _c("✓", "1;32") if marca else _c("✗", "1;31")


def _preguntar(texto: str, defecto: str = "") -> str:
    sufijo = f" [{defecto}]" if defecto else ""
    try:
        respuesta = input(f"{texto}{sufijo}: ").strip()
    except EOFError:
        return defecto
    return respuesta or defecto


def _confirmar(texto: str, defecto: bool = False) -> bool:
    marca = "S/n" if defecto else "s/N"
    respuesta = _preguntar(f"{texto} ({marca})").lower()
    if not respuesta:
        return defecto
    return respuesta in ("s", "si", "sí", "y", "yes")


def mostrar_deteccion(info: dict) -> None:
    _titulo("Entorno detectado")
    print(f"  Sistema         : {info['distribucion']} ({info['arquitectura']})")
    print(f"  Python          : {info['python']}")
    gestor = info["gestor_paquetes"] or _c("no reconocido", "33")
    print(f"  Gestor paquetes : {gestor}")
    print(f"  Docker          : {_si(info['docker'])}  (compose: {_si(info['docker_compose'])})")
    ruta = info["modulos_foundry"] or "(desconocida)"
    print(f"  Módulos Foundry : {ruta}  {_si(info['modulos_foundry_existe'])}")


def mostrar_diagnostico(which=shutil.which) -> None:
    for modo, etiqueta in (("docker", "Vía Docker (recomendada)"), ("nativo", "Vía nativa (compilar)")):
        _titulo(etiqueta)
        for req in comprobar_requisitos(modo, which=which):
            print(f"  {_si(req.encontrado)} {req.nombre} ({req.ejecutable})")


# --- Acciones interactivas ---------------------------------------------------


def _accion_docker(info: dict) -> None:
    _titulo("Instalar con Docker (servidor + puente)")
    faltan = [r for r in comprobar_requisitos("docker") if not r.encontrado]
    if faltan:
        print(_c("  Faltan requisitos:", "33"))
        for r in faltan:
            print(f"    {_si(False)} {r.nombre} ({r.ejecutable})")
        print("  Instala Docker y vuelve a ejecutar el asistente.")
        return
    # Compose es prerrequisito REAL de esta vía: sin el plugin v2 no hay nada
    # que levantar, así que se corta aquí, antes de mutar nada.
    if not info.get("docker_compose"):
        print(_c("  Docker está, pero falta el plugin Compose (`docker compose version` falla).", "33"))
        print("  Instala docker-compose-plugin (o Docker Desktop) y vuelve a ejecutar el asistente.")
        return
    # La confirmación PRECEDE a la mutación: crear docker/.env ya es tocar el
    # equipo. Si el .env existe no se toca en absoluto por esta ruta.
    if ENV_DESTINO.exists():
        print(f"  Se conserva {ENV_DESTINO.relative_to(RAIZ)} (no se toca; edítalo desde «Modificar opciones»).")
    else:
        if not _confirmar(
            f"No existe {ENV_DESTINO.relative_to(RAIZ)}. ¿Crearlo ahora (incluye generar un token nuevo)?",
            defecto=True,
        ):
            print("  Sin docker/.env la pila no puede arrancar; se omite.")
            return
        resultado = asegurar_env()
        token = resultado.cambios.get("BRIDGE_TOKEN", "")
        print(f"  Creado {resultado.ruta.relative_to(RAIZ)} con un token nuevo: {_ocultar_token(token)}")
    print("  Comando para levantar la pila:")
    print(_c("    cd docker && docker compose up -d --build", "1"))
    if _confirmar("¿Ejecutarlo ahora?", defecto=False):
        proceso = subprocess.run(["docker", "compose", "up", "-d", "--build"],
                                 cwd=str(RAIZ / "docker"), check=False)
        # El resultado se comunica siempre: un fallo de compose no puede
        # quedar silencioso tras un "ejecutado".
        if proceso.returncode == 0:
            print(_c("  Pila levantada (docker compose terminó con código 0).", "1;32"))
        else:
            print(_c(f"  docker compose falló (código {proceso.returncode}). Revisa la salida anterior.", "31"))


def comando_cmake(gestor: str | None) -> str:
    """Comando de configuración de CMake ajustado a la plataforma.

    En Arch y derivadas (gestor pacman), la glm 1.0.x del sistema rompe a
    SeriousProton (`glm::vec2 does not name a type`): hay que desactivar su
    detección para usar la copia vendorizada — requisito vivo documentado y
    verificado en docs/BUILDING.md.
    """
    base = ("cmake -S . -B build -G Ninja -DSERIOUS_PROTON_DIR=../SeriousProton "
            "-DWARNING_IS_ERROR=1 -DBUILD_CONTENT_RESOURCE_TESTS=ON")
    if gestor == "pacman":
        base += " -DCMAKE_DISABLE_FIND_PACKAGE_glm=TRUE"
    return base


def _accion_nativa(info: dict) -> None:
    _titulo("Compilar de forma nativa")
    faltan = [r for r in comprobar_requisitos("nativo") if not r.encontrado]
    if faltan and info["comando_dependencias"]:
        print("  Instala primero las dependencias del sistema (NO lo hace el asistente):")
        print(_c(f"    {info['comando_dependencias']}", "1"))
    elif faltan:
        print("  Faltan dependencias, pero no reconozco el gestor de paquetes.")
        print("  Consulta docs/BUILDING.md para el nombre de los paquetes en tu sistema.")
    hermano = RAIZ.parent / "SeriousProton"
    if not hermano.is_dir():
        print(f"  Falta SeriousProton como repo hermano en {hermano}. Clónalo:")
        print(_c("    git clone https://github.com/daid/SeriousProton.git", "1"))
    print("  Configuración y compilación:")
    print(_c(f"    {comando_cmake(info['gestor_paquetes'])}", "1"))
    print(_c("    cmake --build build --parallel", "1"))
    if info["gestor_paquetes"] == "pacman":
        print("  (El flag de glm evita la glm 1.0.x del sistema en Arch/CachyOS; ver docs/BUILDING.md.)")
    print("  (Ver docs/BUILDING.md para detalles por distribución.)")


def _accion_foundry(info: dict) -> None:
    _titulo("Instalar el módulo de Foundry VTT")
    defecto = info["modulos_foundry"] or ""
    ruta = _preguntar("Directorio Data/modules de Foundry", defecto)
    if not ruta:
        print("  Ruta vacía; se omite.")
        return
    copiar = info["sistema"] == "Windows"
    modulos = Path(ruta).expanduser()
    previo = modulos / ID_MODULO
    sobrescribir = False
    # Un directorio real (no nuestro symlink) puede ser contenido del usuario:
    # no se toca sin permiso explícito, y aun así se conserva en un .bak.
    if previo.exists() and not previo.is_symlink():
        print(_c(f"  Ya existe un directorio real en {previo}.", "33"))
        if not _confirmar("¿Conservar una copia (.bak) y reinstalar encima?", defecto=False):
            print("  Se omite; no se ha tocado nada.")
            return
        sobrescribir = True
    try:
        destino = enlazar_modulo(modulos, copiar=copiar, sobrescribir=sobrescribir)
    except (OSError, FileExistsError) as err:
        print(_c(f"  No se pudo instalar el módulo: {err}", "31"))
        return
    if sobrescribir:
        print("  El directorio anterior se conservó con sufijo .bak- en la misma carpeta.")
    verbo = "Copiado" if copiar else "Enlazado"
    print(f"  {verbo} el módulo en {destino}")
    print("  Reinicia Foundry, activa «Espaciokoop Lagunak — Puente de mando» y entra como GM.")


def _accion_opciones() -> None:
    _titulo("Modificar opciones (docker/.env)")
    if not ENV_DESTINO.exists():
        if not _confirmar("No existe docker/.env. ¿Crearlo ahora?", defecto=True):
            return
        asegurar_env()
    actuales = parse_env(ENV_DESTINO.read_text(encoding="utf-8"))
    for indice, op in enumerate(OPCIONES_EDITABLES, start=1):
        actual = actuales.get(op.clave, "")
        vista = _ocultar_token(actual) if op.secreto else (actual or "(vacío)")
        print(f"  {indice}. {op.titulo}: {vista}")
    print("  t. Regenerar el token del puente")
    print("  0. Volver")
    eleccion = _preguntar("Elige").lower()
    if eleccion in ("", "0"):
        return
    if eleccion == "t":
        token = token_nuevo()
        asegurar_env({"BRIDGE_TOKEN": token})
        print(f"  Token regenerado: {_ocultar_token(token)}")
        return
    try:
        op = OPCIONES_EDITABLES[int(eleccion) - 1]
    except (ValueError, IndexError):
        print("  Opción no válida.")
        return
    print(f"  {op.ayuda}")
    valor = _preguntar(f"Nuevo valor para {op.clave}", actuales.get(op.clave, ""))
    if op.validador is not None:
        try:
            op.validador(valor)
        except ValueError as err:
            print(_c(f"  Valor no válido: {err}", "31"))
            return
    asegurar_env({op.clave: valor})
    print(f"  Guardado {op.clave}.")


def menu_interactivo() -> int:
    info = detectar_sistema()
    print(_c("Espaciokoop Lagunak — asistente de instalación", "1;36"))
    mostrar_deteccion(info)
    while True:
        _titulo("¿Qué quieres hacer?")
        print("  1. Instalar con Docker (servidor + puente)  [recomendado]")
        print("  2. Compilar de forma nativa (Linux/macOS)")
        print("  3. Instalar el módulo de Foundry VTT")
        print("  4. Modificar opciones (config del puente)")
        print("  5. Diagnóstico de requisitos")
        print("  0. Salir")
        eleccion = _preguntar("Elige")
        if eleccion in ("0", "", "q"):
            return 0
        accion = {
            "1": lambda: _accion_docker(info),
            "2": lambda: _accion_nativa(info),
            "3": lambda: _accion_foundry(info),
            "4": _accion_opciones,
            "5": lambda: mostrar_diagnostico(),
        }.get(eleccion)
        if accion is None:
            print("  Opción no válida.")
        else:
            accion()


# --- CLI ---------------------------------------------------------------------


def _aplicar_set(pares: list[str]) -> dict[str, str]:
    cambios: dict[str, str] = {}
    opciones = {op.clave: op for op in OPCIONES_EDITABLES}
    for par in pares:
        if "=" not in par:
            raise SystemExit(f"--set espera CLAVE=VALOR, no {par!r}")
        clave, _, valor = par.partition("=")
        clave = clave.strip()
        # Lista blanca cerrada: --set nunca añade claves arbitrarias al .env.
        if clave not in opciones:
            permitidas = ", ".join(op.clave for op in OPCIONES_EDITABLES)
            raise SystemExit(f"--set: clave desconocida {clave!r}; permitidas: {permitidas}")
        # Un salto de línea en el valor inyectaría líneas nuevas en el .env.
        if "\n" in valor or "\r" in valor:
            raise SystemExit(f"{clave}: el valor no puede contener saltos de línea")
        validador = opciones[clave].validador
        if validador is not None:
            try:
                validador(valor)
            except ValueError as err:
                raise SystemExit(f"{clave}: {err}")
        cambios[clave] = valor
    return cambios


def construir_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="instalar.py",
        description="Asistente de instalación y configuración de Espaciokoop Lagunak.",
    )
    parser.add_argument("--detectar", action="store_true",
                        help="Imprime la detección del entorno en JSON y termina.")
    parser.add_argument("--diagnostico", action="store_true",
                        help="Muestra los requisitos de cada vía de instalación.")
    parser.add_argument("--generar-token", action="store_true",
                        help="Imprime un token Bearer nuevo y termina.")
    parser.add_argument("--imprimir-config", action="store_true",
                        help="Muestra docker/.env con el token oculto.")
    parser.add_argument("--set", nargs="+", metavar="CLAVE=VALOR", default=None,
                        help="Aplica cambios a docker/.env (lo crea si falta) y termina.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = construir_parser().parse_args(argv)

    if args.detectar:
        print(json.dumps(detectar_sistema(), indent=2, ensure_ascii=False))
        return 0
    if args.generar_token:
        print(token_nuevo())
        return 0
    if args.diagnostico:
        mostrar_diagnostico()
        return 0
    if args.set is not None:
        resultado = asegurar_env(_aplicar_set(args.set))
        accion = "Creado" if resultado.creado else "Actualizado"
        print(f"{accion} {resultado.ruta}")
        return 0
    if args.imprimir_config:
        if not ENV_DESTINO.exists():
            print("docker/.env no existe todavía. Ejecuta el asistente para crearlo.")
            return 1
        for clave, valor in parse_env(ENV_DESTINO.read_text(encoding="utf-8")).items():
            secreto = any(op.clave == clave and op.secreto for op in OPCIONES_EDITABLES)
            print(f"{clave} = {_ocultar_token(valor) if secreto else valor}")
        return 0

    try:
        return menu_interactivo()
    except KeyboardInterrupt:
        print()
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
