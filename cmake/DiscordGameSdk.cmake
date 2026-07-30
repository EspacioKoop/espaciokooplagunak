# Descarga y extracción del SDK de Discord (#400).
#
# POR QUÉ ESTO ES UN MÓDULO Y NO SEIS LÍNEAS EN CMakeLists.txt. El fallo que
# arregla no se ve en la ruta feliz: solo aparece con un archivo corrupto, y una
# comprobación que nadie puede ejercitar es exactamente la que se rompe sin que
# nadie se entere. Aislado aquí, `tools/tests/test_discord_sdk_cmake.py` lo
# conduce con archivos preparados a mano y comprueba las tres garantías: fallo
# inmediato, sin árbol parcial reutilizable y sin saltarse el segundo intento.
#
# LO QUE HACE FALTA COMPROBAR, Y POR QUÉ NO BASTA EL CÓDIGO DE SALIDA. Ni
# `file(DOWNLOAD)` ni `execute_process` abortan por su cuenta, así que el
# original dejaba pasar una descarga rota y el build moría seis minutos después
# quejándose de una cabecera ausente. Pero mirar solo `RESULT_VARIABLE` tampoco
# basta: ante un ZIP con CRC inválido, `cmake -E tar -xf` avisa por stderr
# («ZIP bad CRC: ... should be ...») y devuelve **0**, dejando extraído un árbol
# corrupto —incluida la cabecera, que hace que el siguiente configure se salte
# la descarga entera y herede el destrozo—. Por eso el extractor se considera
# fallido si devuelve error O si dice algo por stderr, y por eso al fallar se
# retira el árbol a medio extraer además del ZIP.
#
# Este bloque es de EmptyEpsilon upstream y el fallo silencioso les afecta
# igual: conviene ofrecerlo aguas arriba en vez de mantenerlo como divergencia.

# VERSIÓN FIJADA, NO `latest`. Con `latest`, Discord puede cambiar la cabecera
# bajo los pies entre dos builds del mismo commit: el árbol reproduce distinto
# según el día, y un cambio incompatible aparecería como un fallo de compilación
# nuestro. La URL versionada existe y sirve el mismo archivo que `latest`
# (comprobado: 3.2.1 y `latest` comparten SHA-256). Subir de versión pasa a ser
# un commit revisable, que es lo que era desde el principio.
set(DISCORD_SDK_VERSION "3.2.1" CACHE STRING "Pinned Discord game SDK version")

# URL del SDK. Es una variable de caché para que las pruebas puedan apuntar a un
# archivo local (`file://…`); en un build normal nadie la toca.
set(DISCORD_SDK_URL "https://dl-game-sdk.discordapp.net/${DISCORD_SDK_VERSION}/discord_game_sdk.zip"
    CACHE STRING "URL of the Discord game SDK archive")

# Huella del archivo. Fijar la versión dice QUÉ se pide; el hash comprueba qué
# llegó, que no es lo mismo: cubre tanto una URL versionada que cambie de
# contenido como una descarga corrompida en el camino. Se comprueba antes de
# extraer nada, así que un archivo alterado no llega a tocar el árbol.
#
# Vacío = sin comprobar. Es la vía de las pruebas, que sirven archivos propios, y
# el escape para quien fije otra versión sin hash a mano.
set(DISCORD_SDK_SHA256 "6757bb4a1f5b42aa7b6707cbf2158420278760ac5d80d40ca708bb01d20ae6b4"
    CACHE STRING "Expected SHA-256 of the Discord game SDK archive (empty to skip)")

# Deja el SDK extraído en `directorio`, o aborta el configure diciendo por qué.
#
#   directorio     raíz donde se extrae el archivo (…/externals/discord)
#   ruta_cabecera  dónde debe aparecer discord_game_sdk.h tras extraer
#   zip            fichero de descarga (…/downloads/discord_game_sdk.zip)
function(discord_game_sdk_obtener directorio ruta_cabecera zip)
  # Ya está: ni se descarga ni se toca nada. Es lo que hace útil la caché de CI.
  if(EXISTS "${ruta_cabecera}")
    return()
  endif()

  # Todos los caminos de error pasan por aquí: se retira el ZIP y el árbol a
  # medio extraer, para que el intento siguiente vuelva a descargar en vez de
  # encontrarse una cabecera corrupta y darse por satisfecho.
  macro(_discord_abortar mensaje)
    file(REMOVE "${zip}")
    file(REMOVE_RECURSE "${directorio}")
    message(FATAL_ERROR "${mensaje} Retry, or configure with -DWITH_DISCORD=OFF to build without Discord support.")
  endmacro()

  file(MAKE_DIRECTORY "${directorio}")
  file(DOWNLOAD "${DISCORD_SDK_URL}" "${zip}" TIMEOUT 60 TLS_VERIFY ON STATUS estado_descarga)
  list(GET estado_descarga 0 codigo_descarga)
  if(NOT codigo_descarga EQUAL 0)
    list(GET estado_descarga 1 error_descarga)
    _discord_abortar("Failed to download the Discord game SDK from ${DISCORD_SDK_URL}: ${error_descarga}.")
  endif()

  if(NOT DISCORD_SDK_SHA256 STREQUAL "")
    file(SHA256 "${zip}" huella_descargada)
    if(NOT huella_descargada STREQUAL DISCORD_SDK_SHA256)
      _discord_abortar("The Discord game SDK archive downloaded from ${DISCORD_SDK_URL} does not match the expected SHA-256 (expected ${DISCORD_SDK_SHA256}, got ${huella_descargada}); it was NOT extracted.")
    endif()
  endif()

  execute_process(
    COMMAND ${CMAKE_COMMAND} -E tar -xf "${zip}"
    WORKING_DIRECTORY "${directorio}"
    RESULT_VARIABLE resultado_extraccion
    ERROR_VARIABLE error_extraccion)
  string(STRIP "${error_extraccion}" error_extraccion)
  if(NOT resultado_extraccion EQUAL 0)
    _discord_abortar("Failed to extract the Discord game SDK archive (${zip}): ${error_extraccion}.")
  endif()
  # El caso que se escapaba: extractor «satisfecho» (código 0) pero quejándose.
  if(NOT error_extraccion STREQUAL "")
    _discord_abortar("The Discord game SDK archive (${zip}) is corrupt; the extractor reported: ${error_extraccion}.")
  endif()

  # Y aunque no se queje, el archivo tiene que traer lo que se le pide: un ZIP
  # sano pero de otra cosa no puede pasar por SDK.
  if(NOT EXISTS "${ruta_cabecera}")
    _discord_abortar("The Discord game SDK archive (${zip}) did not contain ${ruta_cabecera}.")
  endif()
endfunction()
