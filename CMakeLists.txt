# Set minimum target macOS version: https://cmake.org/cmake/help/v3.8/variable/CMAKE_OSX_DEPLOYMENT_TARGET.html#variable:CMAKE_OSX_DEPLOYMENT_TARGET
# SDL2 targets 10.5, however EE targets C++17 features only available in 10.15+ (Catalina, June 2019).
# Must be first!
if(APPLE)
  if(NOT DEFINED ENV{MACOSX_DEPLOYMENT_TARGET})
    set(ENV{MACOSX_DEPLOYMENT_TARGET} "10.15")
  endif()
  
  message(STATUS "Mac deployment target is: $ENV{MACOSX_DEPLOYMENT_TARGET}")
endif()

cmake_minimum_required(VERSION 3.12 FATAL_ERROR)

# Force C++17 across all compilers
set(CMAKE_CXX_STANDARD 17)

set(CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake" ${CMAKE_MODULE_PATH})

# Set a default version.
# For historical reason, we first honor CPack variables if they are set.
if(DEFINED CPACK_PACKAGE_VERSION_MAJOR)
    message(DEPRECATION "Prefer setting the version through CMAKE_PROJECT_EmptyEpsilon_INCLUDE file override")
    set(MAJOR "${CPACK_PACKAGE_VERSION_MAJOR}")
    set(MINOR "${CPACK_PACKAGE_VERSION_MINOR}")
    set(PATCH "${CPACK_PACKAGE_VERSION_PATCH}")
else()
    # Following [CMake docs](https://cmake.org/cmake/help/v3.7/command/project.html) 
    # You can override these by setting CMAKE_PROJECT_EmptyEpsilon_INCLUDE=<a_file>
    # In which you'd define the following variables:
    # - PROJECT_VERSION
    # - PROJECT_VERSION_MAJOR
    # - PROJECT_VERSION_MINOR
    # - PROJECT_VERSION_PATCH
    string(TIMESTAMP MAJOR "%Y")
    string(TIMESTAMP MINOR "%m")
    string(TIMESTAMP PATCH "%d")
endif()

project(EmptyEpsilon LANGUAGES CXX C  VERSION ${MAJOR}.${MINOR}.${PATCH})

include(GNUInstallDirs)

# Defaults
set(WITH_DISCORD_DEFAULT OFF)
if(WIN32)
  set(WITH_DISCORD_DEFAULT ON)
endif()

# User-settings
set(SERIOUS_PROTON_DIR "../SeriousProton" CACHE PATH "Path to SeriousProton")
if(NOT ANDROID)
    option(WITH_DISCORD "Build with Discord support" ${WITH_DISCORD_DEFAULT})
else()
    set(WITH_DISCORD OFF)
    option(APK_WITH_PACKS "Build APK with pack files (3D assets)" ON)
endif()
option(BUILD_CONTENT_RESOURCE_TESTS "Build content resource codec tests" OFF)

message(STATUS "EmptyEpsilon Version = ${PROJECT_VERSION}")

# Enable colored output with Ninja
if((CMAKE_GENERATOR MATCHES "Ninja") AND (CMAKE_CXX_COMPILER_ID MATCHES "GNU"))
    add_compile_options (-fdiagnostics-color)
endif()

# Dependencies

# SeriousProton
add_subdirectory("${SERIOUS_PROTON_DIR}" "${PROJECT_BINARY_DIR}/SeriousProton" EXCLUDE_FROM_ALL)

set(EXTERNALS_DIR "${PROJECT_BINARY_DIR}/externals")
set(DOWNLOADS_DIR "${PROJECT_BINARY_DIR}/downloads")
file(MAKE_DIRECTORY "${EXTERNAL_DIR}" "${DOWNLOADS_DIR}")

# Discord
if(WITH_DISCORD)
  set(DISCORD_ARCH "x86_64")
  if(${CMAKE_SIZEOF_VOID_P} EQUAL 4)
    set(DISCORD_ARCH "x86")
  endif()
  set(DISCORD_INCLUDE_PATH "${EXTERNALS_DIR}/discord/c")
  set(DISCORD_LIB_PATH "${EXTERNALS_DIR}/discord/lib/${DISCORD_ARCH}")
  file(MAKE_DIRECTORY "${DISCORD_INCLUDE_PATH}")
  if(NOT EXISTS "${DISCORD_INCLUDE_PATH}/discord_game_sdk.h")
    set(DISCORD_GAME_SDK "${DOWNLOADS_DIR}/discord_game_sdk.zip")
    # Descarga y extracción comprobadas, en su propio módulo para que las
    # pruebas puedan ejercitar los caminos de error (#400).
    include(DiscordGameSdk)
    discord_game_sdk_obtener(
      "${EXTERNALS_DIR}/discord"
      "${DISCORD_INCLUDE_PATH}/discord_game_sdk.h"
      "${DISCORD_GAME_SDK}")
    if(WIN32 AND CMAKE_HOST_SYSTEM_NAME STREQUAL "Linux")
      # Discord uses Windows.h (capital W) and that does not play nice when cross-compiling.
      # we want to patch with a lowercase windows.h
      message(STATUS "Patching discord_game_sdk.h, using a lowercase Windows.h (cross-compilation compatibility)")
      execute_process(COMMAND sed -i "s/<Windows.h>/<windows.h>/g" c/discord_game_sdk.h WORKING_DIRECTORY "${EXTERNALS_DIR}/discord")
    endif()
  endif()
  add_library(discord_h INTERFACE IMPORTED)
  set_target_properties(discord_h PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "${DISCORD_INCLUDE_PATH}"  
  )
  add_library(discord SHARED IMPORTED)
  set_target_properties(discord PROPERTIES
    IMPORTED_LOCATION "${DISCORD_LIB_PATH}/discord_game_sdk${CMAKE_SHARED_LIBRARY_SUFFIX}"
  )
  
  if (WIN32)
    set_target_properties(discord PROPERTIES
      IMPORTED_IMPLIB "${DISCORD_LIB_PATH}/discord_game_sdk.dll.lib"
    )
  endif()

  target_link_libraries(discord INTERFACE discord_h)
endif()

# Meshoptimizer
set(MESHOPTIMIZER_VERSION 0.23)
if(CMAKE_VERSION VERSION_GREATER_EQUAL 3.11)
  include(FetchContent)
  FetchContent_Declare(
    meshoptimizer
    GIT_REPOSITORY https://github.com/zeux/meshoptimizer/
    GIT_TAG "v${MESHOPTIMIZER_VERSION}"
  )
  FetchContent_GetProperties(meshoptimizer)
else()
  # Poor man's FetchContent.
  set(MESHOPTIMIZER_BASE_PATH "${EXTERNALS_DIR}")
  set(meshoptimizer_POPULATED FALSE)
  if(NOT EXISTS "${MESHOPTIMIZER_BASE_PATH}/meshoptimizer/CMakeLists.txt")
    set(MESHOPTIMIZER_ZIP "${DOWNLOADS_DIR}/meshoptimizer.zip")
    file(DOWNLOAD "https://github.com/zeux/meshoptimizer/archive/refs/tags/v${MESHOPTIMIZER_VERSION}.zip" "${MESHOPTIMIZER_ZIP}" TIMEOUT 60 TLS_VERIFY ON)

    execute_process(COMMAND ${CMAKE_COMMAND} -E tar -xf "${MESHOPTIMIZER_ZIP}" WORKING_DIRECTORY "${MESHOPTIMIZER_BASE_PATH}")
    execute_process(COMMAND ${CMAKE_COMMAND} -E rename "meshoptimizer-${MESHOPTIMIZER_VERSION}" meshoptimizer WORKING_DIRECTORY "${MESHOPTIMIZER_BASE_PATH}")
  endif()

  set(meshoptimizer_SOURCE_DIR "${MESHOPTIMIZER_BASE_PATH}/meshoptimizer")
  set(meshoptimizer_BINARY_DIR "${PROJECT_BINARY_DIR}/externals/meshoptimizer")
endif()

if(NOT meshoptimizer_POPULATED)
  if(COMMAND FetchContent_Populate)
    FetchContent_Populate(meshoptimizer)
  endif()
  add_subdirectory(${meshoptimizer_SOURCE_DIR} ${meshoptimizer_BINARY_DIR} EXCLUDE_FROM_ALL)
endif()

set(GUI_LIB_SOURCES
    src/gui/hotkeyBinder.cpp
    src/gui/hotkeyConfig.cpp
    src/gui/joystickConfig.cpp
    src/gui/mouseRenderer.cpp
    src/gui/gui2_slider.cpp
    src/gui/gui2_togglebutton.cpp
    src/gui/gui2_arrow.cpp
    src/gui/gui2_selector.cpp
    src/gui/gui2_canvas.cpp
    src/gui/gui2_rotationdial.cpp
    src/gui/gui2_textentry.cpp
    src/gui/gui2_label.cpp
    src/gui/gui2_image.cpp
    src/gui/gui2_arrowbutton.cpp
    src/gui/gui2_entrylist.cpp
    src/gui/gui2_progressbar.cpp
    src/gui/gui2_progressslider.cpp
    src/gui/gui2_scrolltext.cpp
    src/gui/gui2_advancedscrolltext.cpp
    src/gui/gui2_button.cpp
    src/gui/gui2_resizabledialog.cpp
    src/gui/debugRenderer.cpp
    src/gui/gui2_element.cpp
    src/gui/gui2_keyvaluedisplay.cpp
    src/gui/gui2_listbox.cpp
    src/gui/gui2_scrollbar.cpp
    src/gui/gui2_container.cpp
    src/gui/gui2_panel.cpp
    src/gui/gui2_overlay.cpp
    src/gui/theme.cpp
    src/gui/layout/layout.cpp
    src/gui/layout/horizontal.cpp
    src/gui/layout/vertical.cpp

    src/gui/debugRenderer.h
    src/gui/gui2_advancedscrolltext.h
    src/gui/gui2_arrowbutton.h
    src/gui/gui2_arrow.h
    src/gui/gui2_button.h
    src/gui/gui2_canvas.h
    src/gui/gui2_container.h
    src/gui/gui2_element.h
    src/gui/gui2_entrylist.h
    src/gui/gui2_image.h
    src/gui/gui2_keyvaluedisplay.h
    src/gui/gui2_label.h
    src/gui/gui2_listbox.h
    src/gui/gui2_overlay.h
    src/gui/gui2_panel.h
    src/gui/gui2_progressbar.h
    src/gui/gui2_progressslider.h
    src/gui/gui2_resizabledialog.h
    src/gui/gui2_rotationdial.h
    src/gui/gui2_scrollbar.h
    src/gui/gui2_scrolltext.h
    src/gui/gui2_selector.h
    src/gui/gui2_slider.h
    src/gui/gui2_textentry.h
    src/gui/gui2_togglebutton.h
    src/gui/theme.h
    src/gui/layout/layout.h
    src/gui/layout/horizontal.h
    src/gui/layout/vertical.h
    src/gui/hotkeyBinder.h
    src/gui/hotkeyConfig.h
    src/gui/joystickConfig.h
    src/gui/mouseRenderer.h
)

set(MAIN_SOURCES
    src/init/config.h
    src/init/config.cpp
    src/init/resources.h
    src/init/resources.cpp
    src/init/displaywindows.h
    src/init/displaywindows.cpp
    src/init/ecs.h
    src/init/ecs.cpp

    src/main.cpp
    src/threatLevelEstimate.cpp
    src/preferenceManager.cpp
    src/epsilonServer.cpp
    src/particleEffect.cpp
    src/httpScriptAccess.cpp
    src/packResourceProvider.cpp
    src/gameGlobalInfo.cpp
    src/GMActions.cpp
    src/script.cpp
    src/crewPosition.cpp
    src/playerInfo.cpp
    src/missileWeaponData.cpp
    src/mesh.cpp
    src/scenarioInfo.cpp
    src/tutorialGame.cpp
    src/shaderRegistry.cpp
    src/glObjects.cpp
    src/stdinLuaConsole.h
    src/stdinLuaConsole.cpp
    src/menus/joinServerMenu.cpp
    src/menus/serverBrowseMenu.cpp
    src/menus/mainMenus.cpp
    src/menus/serverCreationScreen.cpp
    src/menus/tutorialMenu.cpp
    src/menus/optionsMenu.cpp
    src/menus/shipSelectionScreen.cpp
    src/menus/autoConnectScreen.cpp
    src/menus/hotkeyMenu.cpp
    src/menus/luaConsole.cpp
    src/screens/cinematicViewScreen.cpp
    src/screens/crewStationScreen.cpp
    src/screens/topDownScreen.cpp
    src/screens/windowScreen.cpp
    src/screens/mainScreen.cpp
    src/screens/spectatorScreen.cpp
    src/screens/crew4/operationsScreen.cpp
    src/screens/crew4/engineeringAdvancedScreen.cpp
    src/screens/crew4/tacticalScreen.cpp
    src/screens/crew6/engineeringScreen.cpp
    src/screens/crew6/scienceScreen.cpp
    src/screens/crew6/relayScreen.cpp
    src/screens/crew6/weaponsScreen.cpp
    src/screens/crew6/helmsScreen.cpp
    src/screens/crew1/singlePilotScreen.cpp
    src/screens/extra/damcon.cpp
    src/screens/extra/powerManagement.cpp
    src/screens/extra/databaseScreen.cpp
    src/screens/extra/commsScreen.cpp
    src/screens/extra/shipLogScreen.cpp
    src/content/campaignGraph.cpp
    src/content/campaignGraph.h
    src/content/contentLibraryStore.cpp
    src/content/contentLibraryStore.h
    src/content/contentResource.cpp
    src/content/contentResource.h
    src/content/mapApplySession.cpp
    src/content/mapApplySession.h
    src/content/mapDocument.cpp
    src/content/mapDocument.h
    src/content/mapEditSession.cpp
    src/content/mapEditSession.h
    src/content/mapPreview.cpp
    src/content/mapPreview.h
    src/content/mapPreviewInteraction.cpp
    src/content/mapPreviewInteraction.h
    src/content/mapWorldAdapter.cpp
    src/content/mapWorldAdapter.h
    src/content/shipDocument.cpp
    src/content/shipDocument.h
    src/content/shipEditSession.cpp
    src/content/shipEditSession.h
    src/content/shipDeployment.cpp
    src/content/shipDeployment.h
    src/content/shipTemplateCatalog.cpp
    src/content/shipTemplateCatalog.h
    src/screens/gm/gameMasterScreen.cpp
    src/screens/gm/contentEditor.cpp
    src/screens/gm/contentEditor.h
    src/screens/gm/objectCreationView.cpp
    src/screens/gm/globalMessageEntryView.cpp
    src/screens/gm/chatDialog.cpp
    src/screens/gm/tweak.cpp
    src/screenComponents/aimLock.cpp
    src/screenComponents/alertLevelButton.cpp
    src/screenComponents/alertOverlay.cpp
    src/screenComponents/helpOverlay.cpp
    src/screenComponents/missileTubeControls.cpp
    src/screenComponents/selfDestructIndicator.cpp
    src/screenComponents/viewport3d.cpp
    src/screenComponents/viewportMainScreen.cpp
    src/screenComponents/selfDestructEntry.cpp
    src/screenComponents/dockingButton.cpp
    src/screenComponents/shieldsEnableButton.cpp
    src/screenComponents/selfDestructButton.cpp
    src/screenComponents/shieldFreqencySelect.cpp
    src/screenComponents/jumpControls.cpp
    src/screenComponents/impulseControls.cpp
    src/screenComponents/infoDisplay.cpp
    src/screenComponents/frequencyCurve.cpp
    src/screenComponents/noiseOverlay.cpp
    src/screenComponents/powerDamageIndicator.cpp
    src/screenComponents/beamTargetSelector.cpp
    src/screenComponents/shipInternalView.cpp
    src/screenComponents/beamFrequencySelector.cpp
    src/screenComponents/radarView.cpp
    src/screenComponents/radarZoomSlider.cpp
    src/screenComponents/rawScannerDataRadarOverlay.cpp
    src/screenComponents/scanTargetButton.cpp
    src/screenComponents/snapSlider.cpp
    src/screenComponents/indicatorOverlays.cpp
    src/screenComponents/openCommsButton.cpp
    src/screenComponents/combatManeuver.cpp
    src/screenComponents/rotatingModelView.cpp
    src/screenComponents/shipDestroyedPopup.cpp
    src/screenComponents/warpControls.cpp
    src/screenComponents/targetsContainer.cpp
    src/screenComponents/globalMessage.cpp
    src/screenComponents/commsOverlay.cpp
    src/screenComponents/jumpIndicator.cpp
    src/screenComponents/scanningDialog.cpp
    src/screenComponents/signalQualityIndicator.cpp
    src/screenComponents/mainScreenControls.cpp
    src/screenComponents/databaseView.cpp
    src/screenComponents/shipsLogControl.cpp
    src/screenComponents/onScreenKeyboard.cpp
    src/screenComponents/hackingDialog.cpp
    src/screenComponents/customShipFunctions.cpp
    src/screenComponents/scrollingBanner.cpp
    src/screenComponents/lightsOut.cpp
    src/screenComponents/miniGame.cpp
    src/screenComponents/mineSweeper.cpp
    src/screenComponents/impulseSound.cpp
    src/components/faction.h
    src/components/faction.cpp
    src/components/radar.h
    src/components/hull.h
    src/components/rendering.h
    src/components/rendering.cpp
    src/components/docking.h
    src/components/coolant.h
    src/components/shipsystem.h
    src/components/shipsystem.cpp
    src/components/impulse.h
    src/components/maneuveringthrusters.h
    src/components/warpdrive.h
    src/components/jumpdrive.h
    src/components/reactor.h
    src/components/shields.h
    src/components/shields.cpp
    src/components/beamweapon.h
    src/components/beamweapon.cpp
    src/components/target.h
    src/components/missiletubes.h
    src/components/selfdestruct.h
    src/components/player.h
    src/components/player.cpp
    src/components/pickup.h
    src/components/spin.h
    src/components/rendering.h
    src/components/name.h
    src/components/customshipfunction.h
    src/components/contentship.h
    src/components/shiplog.h
    src/components/shiplog.cpp
    src/components/comms.h
    src/components/scanning.h
    src/components/scanning.cpp
    src/components/internalrooms.h
    src/components/internalrooms.cpp
    src/components/probe.h
    src/components/hacking.h
    src/components/ai.h
    src/components/radarblock.h
    src/components/gravity.h
    src/components/avoidobject.h
    src/components/sfx.h
    src/components/missile.h
    src/components/database.h
    src/components/zone.h
    src/components/zone.cpp
    src/components/moveto.h
    src/components/lifetime.h
    src/components/destroy.h
    src/systems/ai.h
    src/systems/ai.cpp
    src/systems/docking.h
    src/systems/docking.cpp
    src/systems/shipsystemssystem.h
    src/systems/shipsystemssystem.cpp
    src/systems/coolantsystem.h
    src/systems/coolantsystem.cpp
    src/systems/energysystem.h
    src/systems/energysystem.cpp
    src/systems/impulse.h
    src/systems/impulse.cpp
    src/systems/maneuvering.h
    src/systems/maneuvering.cpp
    src/systems/beamweapon.h
    src/systems/beamweapon.cpp
    src/systems/missilesystem.h
    src/systems/missilesystem.cpp
    src/systems/warpsystem.h
    src/systems/warpsystem.cpp
    src/systems/jumpsystem.h
    src/systems/jumpsystem.cpp
    src/systems/sfx.h
    src/systems/sfx.cpp
    src/systems/shieldsystem.h
    src/systems/shieldsystem.cpp
    src/systems/damage.h
    src/systems/damage.cpp
    src/systems/selfdestruct.h
    src/systems/selfdestruct.cpp
    src/systems/probe.h
    src/systems/probe.cpp
    src/systems/pickup.h
    src/systems/pickup.cpp
    src/systems/basicmovement.h
    src/systems/basicmovement.cpp
    src/systems/gravity.h
    src/systems/gravity.cpp
    src/systems/comms.h
    src/systems/comms.cpp
    src/systems/radarblock.h
    src/systems/radarblock.cpp
    src/systems/internalcrew.h
    src/systems/internalcrew.cpp
    src/systems/pathfinding.h
    src/systems/pathfinding.cpp
    src/systems/rendering.h
    src/systems/rendering.cpp
    src/systems/scanning.h
    src/systems/scanning.cpp
    src/systems/planet.h
    src/systems/planet.cpp
    src/systems/gm.h
    src/systems/gm.cpp
    src/systems/radar.h
    src/systems/radar.cpp
    src/systems/zone.h
    src/systems/zone.cpp
    src/systems/debugrender.h
    src/systems/debugrender.cpp
    src/systems/destroy.h
    src/systems/destroy.cpp
    src/multiplayer/beamweapon.h
    src/multiplayer/beamweapon.cpp
    src/multiplayer/shields.h
    src/multiplayer/shields.cpp
    src/multiplayer/faction.h
    src/multiplayer/faction.cpp
    src/multiplayer/radar.h
    src/multiplayer/radar.cpp
    src/multiplayer/comms.h
    src/multiplayer/comms.cpp
    src/multiplayer/probe.h
    src/multiplayer/probe.cpp
    src/multiplayer/orbit.h
    src/multiplayer/orbit.cpp
    src/multiplayer/radarblock.h
    src/multiplayer/radarblock.cpp
    src/multiplayer/player.h
    src/multiplayer/player.cpp
    src/multiplayer/name.h
    src/multiplayer/name.cpp
    src/multiplayer/impulse.h
    src/multiplayer/impulse.cpp
    src/multiplayer/warp.h
    src/multiplayer/warp.cpp
    src/multiplayer/jumpdrive.h
    src/multiplayer/jumpdrive.cpp
    src/multiplayer/docking.h
    src/multiplayer/docking.cpp
    src/multiplayer/coolant.h
    src/multiplayer/coolant.cpp
    src/multiplayer/reactor.h
    src/multiplayer/reactor.cpp
    src/multiplayer/rendering.h
    src/multiplayer/rendering.cpp
    src/multiplayer/selfdestruct.h
    src/multiplayer/selfdestruct.cpp
    src/multiplayer/hull.h
    src/multiplayer/hull.cpp
    src/multiplayer/target.h
    src/multiplayer/target.cpp
    src/multiplayer/database.h
    src/multiplayer/database.cpp
    src/multiplayer/maneuveringthrusters.h
    src/multiplayer/maneuveringthrusters.cpp
    src/multiplayer/hacking.h
    src/multiplayer/hacking.cpp
    src/multiplayer/customshipfunction.h
    src/multiplayer/customshipfunction.cpp
    src/multiplayer/gravity.h
    src/multiplayer/gravity.cpp
    src/multiplayer/scanning.h
    src/multiplayer/scanning.cpp
    src/multiplayer/missile.h
    src/multiplayer/missile.cpp
    src/multiplayer/missiletubes.h
    src/multiplayer/missiletubes.cpp
    src/multiplayer/sfx.h
    src/multiplayer/sfx.cpp
    src/multiplayer/spin.h
    src/multiplayer/spin.cpp
    src/multiplayer/moveto.h
    src/multiplayer/moveto.cpp
    src/multiplayer/internalrooms.h
    src/multiplayer/internalrooms.cpp
    src/multiplayer/shiplog.h
    src/multiplayer/shiplog.cpp
    src/multiplayer/zone.h
    src/multiplayer/zone.cpp
    src/ai/fighterAI.cpp
    src/ai/ai.cpp
    src/ai/aiFactory.cpp
    src/ai/evasionAI.cpp
    src/ai/missileVolleyAI.cpp
    src/hardware/hardwareController.cpp
    src/hardware/hardwareMappingEffects.cpp
    src/hardware/serialDriver.cpp
    src/hardware/devices/dmx512SerialDevice.cpp
    src/hardware/devices/enttecDMXProDevice.cpp
    src/hardware/devices/sACNDMXDevice.cpp
    src/hardware/devices/uDMXDevice.cpp
    src/hardware/devices/virtualOutputDevice.cpp
    src/hardware/devices/philipsHueDevice.cpp
    src/script/components.cpp
    src/script/dataStorage.h
    src/script/dataStorage.cpp
    src/script/gm.h
    src/script/gm.cpp
    src/script/scriptRandom.h
    src/script/scriptRandom.cpp

    src/ai/aiFactory.h
    src/ai/ai.h
    src/ai/evasionAI.h
    src/ai/fighterAI.h
    src/ai/missileVolleyAI.h
    src/epsilonServer.h
    src/featureDefs.h
    src/gameGlobalInfo.h
    src/glObjects.h
    src/GMActions.h
    src/hardware/devices/dmx512SerialDevice.h
    src/hardware/devices/enttecDMXProDevice.h
    src/hardware/devices/philipsHueDevice.h
    src/hardware/devices/sACNDMXDevice.h
    src/hardware/devices/uDMXDevice.h
    src/hardware/devices/virtualOutputDevice.h
    src/hardware/hardwareController.h
    src/hardware/hardwareMappingEffects.h
    src/hardware/hardwareOutputDevice.h
    src/hardware/serialDriver.h
    src/httpScriptAccess.h
    src/main.h
    src/math/centerOfMass.h
    src/math/triangulate.h
    src/menus/autoConnectScreen.h
    src/menus/hotkeyMenu.h
    src/menus/joinServerMenu.h
    src/menus/mainMenus.h
    src/menus/optionsMenu.h
    src/menus/serverBrowseMenu.h
    src/menus/serverCreationScreen.h
    src/menus/shipSelectionScreen.h
    src/menus/tutorialMenu.h
    src/menus/luaConsole.h
    src/mesh.h
    src/missileWeaponData.h
    src/packResourceProvider.h
    src/particleEffect.h
    src/crewPosition.h
    src/playerInfo.h
    src/preferenceManager.h
    src/scenarioInfo.h
    src/screenComponents/aimLock.h
    src/screenComponents/alertLevelButton.h
    src/screenComponents/alertOverlay.h
    src/screenComponents/beamFrequencySelector.h
    src/screenComponents/beamTargetSelector.h
    src/screenComponents/combatManeuver.h
    src/screenComponents/commsOverlay.h
    src/screenComponents/customShipFunctions.h
    src/screenComponents/databaseView.h
    src/screenComponents/dockingButton.h
    src/screenComponents/frequencyCurve.h
    src/screenComponents/globalMessage.h
    src/screenComponents/hackingDialog.h
    src/screenComponents/helpOverlay.h
    src/screenComponents/impulseControls.h
    src/screenComponents/infoDisplay.h
    src/screenComponents/impulseSound.h
    src/screenComponents/indicatorOverlays.h
    src/screenComponents/jumpControls.h
    src/screenComponents/jumpIndicator.h
    src/screenComponents/lightsOut.h
    src/screenComponents/mainScreenControls.h
    src/screenComponents/mineSweeper.h
    src/screenComponents/miniGame.h
    src/screenComponents/missileTubeControls.h
    src/screenComponents/noiseOverlay.h
    src/screenComponents/onScreenKeyboard.h
    src/screenComponents/openCommsButton.h
    src/screenComponents/powerDamageIndicator.h
    src/screenComponents/radarView.h
    src/screenComponents/radarZoomSlider.h
    src/screenComponents/rawScannerDataRadarOverlay.h
    src/screenComponents/rotatingModelView.h
    src/screenComponents/scanningDialog.h
    src/screenComponents/scanTargetButton.h
    src/screenComponents/scrollingBanner.h
    src/screenComponents/selfDestructButton.h
    src/screenComponents/selfDestructEntry.h
    src/screenComponents/selfDestructIndicator.h
    src/screenComponents/shieldFreqencySelect.h
    src/screenComponents/shieldsEnableButton.h
    src/screenComponents/shipDestroyedPopup.h
    src/screenComponents/shipInternalView.h
    src/screenComponents/shipsLogControl.h
    src/screenComponents/signalQualityIndicator.h
    src/screenComponents/snapSlider.h
    src/screenComponents/targetsContainer.h
    src/screenComponents/viewport3d.h
    src/screenComponents/viewportMainScreen.h
    src/screenComponents/warpControls.h
    src/screens/cinematicViewScreen.h
    src/screens/crew1/singlePilotScreen.h
    src/screens/crew4/engineeringAdvancedScreen.h
    src/screens/crew4/operationsScreen.h
    src/screens/crew4/tacticalScreen.h
    src/screens/crew6/engineeringScreen.h
    src/screens/crew6/helmsScreen.h
    src/screens/crew6/relayScreen.h
    src/screens/crew6/scienceScreen.h
    src/screens/crew6/weaponsScreen.h
    src/screens/crewStationScreen.h
    src/screens/extra/commsScreen.h
    src/screens/extra/damcon.h
    src/screens/extra/databaseScreen.h
    src/screens/extra/powerManagement.h
    src/screens/extra/shipLogScreen.h
    src/screens/gm/chatDialog.h
    src/screens/gm/gameMasterScreen.h
    src/screens/gm/globalMessageEntryView.h
    src/screens/gm/objectCreationView.h
    src/screens/gm/tweak.h
    src/screens/mainScreen.h
    src/screens/spectatorScreen.h
    src/screens/topDownScreen.h
    src/screens/windowScreen.h
    src/script.h
    src/shaderRegistry.h
    src/threatLevelEstimate.h
    src/tutorialGame.h
    src/script/components.h
    src/script/vector.h
    src/script/enum.h
)

if (WITH_DISCORD)
  list(APPEND MAIN_SOURCES src/discord.cpp src/discord.h)
endif()
if (STEAMSDK)
  list(APPEND MAIN_SOURCES src/steamrichpresence.cpp src/steamrichpresence.h)
endif()

if (WIN32)
  list(APPEND MAIN_SOURCES EmptyEpsilon.rc)
endif()

# Config header.
configure_file(cmake/config.h.in include/config.h)

if (SHARED_SP)
    set(EE_LIB_TYPE SHARED)
else()
    set(EE_LIB_TYPE STATIC)
endif()

add_library(EE_GuiLIB ${EE_LIB_TYPE} ${GUI_LIB_SOURCES})
target_link_libraries(EE_GuiLIB PUBLIC seriousproton meshoptimizer)
target_include_directories(EE_GuiLIB PUBLIC "$<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}/src;${CMAKE_CURRENT_BINARY_DIR}/include>")

if(ANDROID)
    add_library(${PROJECT_NAME} SHARED ${MAIN_SOURCES})
else()
    add_executable(${PROJECT_NAME} MACOSX_BUNDLE ${MAIN_SOURCES})
endif()

target_compile_definitions(${PROJECT_NAME}
    PUBLIC
        # Set RESOURCE_BASE_DIR on Unix so the built binary is able to find resources
        $<$<AND:$<BOOL:${UNIX}>,$<NOT:$<BOOL:${STEAMSDK}>>>:RESOURCE_BASE_DIR="${CMAKE_INSTALL_FULL_DATADIR}/emptyepsilon/">
)

target_include_directories(${PROJECT_NAME}
    PUBLIC
        "$<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}/src;${CMAKE_CURRENT_BINARY_DIR}/include>"
)

target_link_libraries(${PROJECT_NAME}
    PUBLIC
        seriousproton meshoptimizer EE_GuiLIB
        "$<$<BOOL:${ANDROID}>:log;android>"
        "$<$<BOOL:${WITH_DISCORD}>:discord_h>"
        "$<$<PLATFORM_ID:Darwin>:-framework Foundation>"
)

if(BUILD_CONTENT_RESOURCE_TESTS)
    enable_testing()
    add_executable(content_resource_tests
        tests/contentResourceTests.cpp
        src/content/contentResource.cpp
        src/content/mapDocument.cpp
        src/content/shipDocument.cpp
        src/crewPosition.cpp
    )
    target_include_directories(content_resource_tests PRIVATE
        "$<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}/src>")
    target_link_libraries(content_resource_tests PRIVATE seriousproton)
    add_test(NAME content_resource_codec COMMAND content_resource_tests)

    add_executable(campaign_graph_tests
        tests/campaignGraphTests.cpp
        src/content/campaignGraph.cpp
        src/content/contentResource.cpp
        src/content/mapDocument.cpp
        src/content/shipDocument.cpp
        src/crewPosition.cpp
    )
    target_include_directories(campaign_graph_tests PRIVATE
        "$<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}/src>")
    target_link_libraries(campaign_graph_tests PRIVATE seriousproton)
    add_test(NAME campaign_graph COMMAND campaign_graph_tests)

    add_executable(content_library_store_tests
        tests/contentLibraryStoreTests.cpp
        src/content/contentLibraryStore.cpp
        src/content/contentResource.cpp
        src/content/mapDocument.cpp
        src/content/shipDocument.cpp
        src/crewPosition.cpp
    )
    target_include_directories(content_library_store_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(content_library_store_tests PRIVATE seriousproton)
    add_test(NAME content_library_store COMMAND content_library_store_tests)

    add_executable(checkpoint_state_tests
        tests/checkpointStateTests.cpp
        src/content/checkpointState.cpp
    )
    target_include_directories(checkpoint_state_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(checkpoint_state_tests PRIVATE seriousproton)
    add_test(NAME checkpoint_state_codec COMMAND checkpoint_state_tests)

    add_executable(checkpoint_capture_tests
        tests/checkpointCaptureTests.cpp
        src/content/checkpointCapture.cpp
        src/content/checkpointState.cpp
    )
    target_include_directories(checkpoint_capture_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(checkpoint_capture_tests PRIVATE seriousproton)
    add_test(NAME checkpoint_capture COMMAND checkpoint_capture_tests)

    add_executable(map_document_tests
        tests/mapDocumentTests.cpp
        src/content/mapDocument.cpp
    )
    target_include_directories(map_document_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(map_document_tests PRIVATE seriousproton)
    add_test(NAME map_document_codec COMMAND map_document_tests)

    add_executable(map_edit_session_tests
        tests/mapEditSessionTests.cpp
        src/content/mapDocument.cpp
        src/content/mapEditSession.cpp
    )
    target_include_directories(map_edit_session_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(map_edit_session_tests PRIVATE seriousproton)
    add_test(NAME map_edit_session COMMAND map_edit_session_tests)

    add_executable(map_apply_session_tests
        tests/mapApplySessionTests.cpp
        src/content/mapApplySession.cpp
        src/content/mapDocument.cpp
    )
    target_include_directories(map_apply_session_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(map_apply_session_tests PRIVATE seriousproton)
    add_test(NAME map_apply_session COMMAND map_apply_session_tests)

    add_executable(map_world_adapter_tests
        tests/mapWorldAdapterTests.cpp
        src/content/mapApplySession.cpp
        src/content/mapDocument.cpp
        src/content/mapWorldAdapter.cpp
    )
    target_include_directories(map_world_adapter_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(map_world_adapter_tests PRIVATE seriousproton)
    add_test(NAME map_world_adapter COMMAND map_world_adapter_tests)

    add_executable(map_preview_tests
        tests/mapPreviewTests.cpp
        src/content/mapDocument.cpp
        src/content/mapPreview.cpp
    )
    target_include_directories(map_preview_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(map_preview_tests PRIVATE seriousproton)
    add_test(NAME map_preview_projection COMMAND map_preview_tests)

    add_executable(map_preview_interaction_tests
        tests/mapPreviewInteractionTests.cpp
        src/content/mapDocument.cpp
        src/content/mapEditSession.cpp
        src/content/mapPreview.cpp
        src/content/mapPreviewInteraction.cpp
    )
    target_include_directories(map_preview_interaction_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(map_preview_interaction_tests PRIVATE seriousproton)
    add_test(NAME map_preview_interaction COMMAND map_preview_interaction_tests)

    add_executable(ship_document_tests
        tests/shipDocumentTests.cpp
        src/content/shipDocument.cpp
        src/crewPosition.cpp
    )
    target_include_directories(ship_document_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(ship_document_tests PRIVATE seriousproton)
    add_test(NAME ship_document_model COMMAND ship_document_tests)

    add_executable(ship_template_catalog_tests
        tests/shipTemplateCatalogTests.cpp
        src/content/shipTemplateCatalog.cpp
    )
    target_include_directories(ship_template_catalog_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(ship_template_catalog_tests PRIVATE seriousproton)
    add_test(NAME ship_template_catalog COMMAND ship_template_catalog_tests)

    find_program(CONTENT_EDITOR_LUA_EXECUTABLE NAMES lua5.4 lua)
    if(CONTENT_EDITOR_LUA_EXECUTABLE)
        add_test(
            NAME ship_template_preview_lua
            COMMAND ${CONTENT_EDITOR_LUA_EXECUTABLE}
                ${CMAKE_CURRENT_SOURCE_DIR}/tests/shipTemplatePreviewLuaTests.lua
                ${CMAKE_CURRENT_SOURCE_DIR}/scripts/api/shipTemplate.lua)
    endif()

    add_executable(ship_edit_session_tests
        tests/shipEditSessionTests.cpp
        src/content/shipDocument.cpp
        src/content/shipEditSession.cpp
        src/crewPosition.cpp
    )
    target_include_directories(ship_edit_session_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(ship_edit_session_tests PRIVATE seriousproton)
    add_test(NAME ship_edit_session COMMAND ship_edit_session_tests)

    add_executable(ship_deployment_tests
        tests/shipDeploymentTests.cpp
        src/content/contentResource.cpp
        src/content/mapDocument.cpp
        src/content/shipDocument.cpp
        src/content/shipDeployment.cpp
        src/content/shipTemplateCatalog.cpp
        src/crewPosition.cpp
    )
    target_include_directories(ship_deployment_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
    target_link_libraries(ship_deployment_tests PRIVATE seriousproton)
    add_test(NAME ship_deployment_plan COMMAND ship_deployment_tests)
endif()

if(WIN32)
    if (CMAKE_BUILD_TYPE STREQUAL "Debug")
        target_link_libraries(${PROJECT_NAME} PUBLIC "-mconsole")
    endif()
endif()

if(MSVC)
    # tweak.cpp exceeds the default COFF section limit
    set_source_files_properties(src/screens/gm/tweak.cpp PROPERTIES COMPILE_FLAGS "/bigobj")
endif()

set_target_properties(${PROJECT_NAME}
    PROPERTIES
        MACOSX_BUNDLE_INFO_PLIST ${CMAKE_SOURCE_DIR}/osx/MacOSXBundleInfo.plist.in
        MACOSX_BUNDLE_ICON_FILE "${PROJECT_NAME}.icns")

include(InstallRequiredSystemLibraries)


set(EE_RESOURCES resources scripts packs)
if(WIN32 OR STEAMSDK)
    install(TARGETS ${PROJECT_NAME} RUNTIME DESTINATION .)
    install(DIRECTORY ${EE_RESOURCES} DESTINATION .)

    if(MSVC)
      # Not all configuration emit a pdb (ie Release), make this optional.
      install(FILES "$<TARGET_PDB_FILE:${PROJECT_NAME}>" DESTINATION . OPTIONAL)
    endif()
elseif(APPLE)
  install(FILES logo.icns DESTINATION "$<TARGET_BUNDLE_CONTENT_DIR:${PROJECT_NAME}>/Resources" RENAME "${PROJECT_NAME}.icns")
  install(DIRECTORY ${EE_RESOURCES} DESTINATION "$<TARGET_BUNDLE_CONTENT_DIR:${PROJECT_NAME}>/Resources")
elseif(ANDROID)
  android_apk(EmptyEpsilon ${APK_WITH_PACKS})
else()
    install(TARGETS ${PROJECT_NAME} RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}")
    install(DIRECTORY ${EE_RESOURCES} DESTINATION "${CMAKE_INSTALL_DATADIR}/emptyepsilon")
endif()

if(WITH_DISCORD)
    set(discord_install_prefix)
    if(WIN32)
        set(discord_install_prefix ".")
    elseif(APPLE)
        set(discord_install_prefix "${PROJECT_NAME}.app/Contents/Resources")
    else()
        set(discord_install_prefix "${CMAKE_INSTALL_DATADIR}/emptyepsilon")
    endif()

    install(PROGRAMS "$<TARGET_PROPERTY:discord,IMPORTED_LOCATION>" DESTINATION "${discord_install_prefix}/plugins")
endif()

find_package(Python3 COMPONENTS Interpreter)
if(Python3_Interpreter_FOUND)
    set(SCRIPT_REFERENCE_HTML "${PROJECT_BINARY_DIR}/script_reference.html")
    file(GLOB_RECURSE SCRIPT_REFERENCE_SOURCES
        "${CMAKE_SOURCE_DIR}/src/script.cpp"
        "${CMAKE_SOURCE_DIR}/src/script/*.cpp"
        "${CMAKE_SOURCE_DIR}/scripts/api/*.lua"
        "${CMAKE_SOURCE_DIR}/script_docs/*.py"
        "${CMAKE_SOURCE_DIR}/script_docs/template.html"
        "${CMAKE_SOURCE_DIR}/script_docs/vendor/*")
    add_custom_command(
        OUTPUT "${SCRIPT_REFERENCE_HTML}"
        COMMAND ${Python3_EXECUTABLE} ${CMAKE_SOURCE_DIR}/script_docs/main.py "${SCRIPT_REFERENCE_HTML}"
        WORKING_DIRECTORY ${PROJECT_SOURCE_DIR}
        DEPENDS ${SCRIPT_REFERENCE_SOURCES}
        COMMENT "Building script reference documentation.")
    add_custom_target(script_reference ALL DEPENDS "${SCRIPT_REFERENCE_HTML}")
  
  # Matches install logic above.
  if(WIN32 OR STEAMSDK)
    install(FILES "${SCRIPT_REFERENCE_HTML}" DESTINATION . OPTIONAL)
  elseif(APPLE)
    install(FILES "${SCRIPT_REFERENCE_HTML}" DESTINATION "$<TARGET_BUNDLE_CONTENT_DIR:${PROJECT_NAME}>/Resources" OPTIONAL)
  elseif(NOT ANDROID)
    # DOCDIR already has PROJECT_NAME (EmptyEpsilon) appended (from CMake docs)
    install(FILES "${SCRIPT_REFERENCE_HTML}" DESTINATION "${CMAKE_INSTALL_DOCDIR}" OPTIONAL)
  endif()
endif()

add_custom_target(update_locale
    COMMAND xgettext --keyword=tr:1c,2 --keyword=tr:1 --keyword=trn:2c,3,4 --keyword=trn:2,3 --keyword=trMark:1c,2 --keyword=trMark:1 --add-comments=TRANSLATORS --omit-header -d resources/locale/main.en ${MAIN_SOURCES} ${GUI_LIB_SOURCES}
    COMMAND python3 update_locale.py
    WORKING_DIRECTORY ${PROJECT_SOURCE_DIR})

if(APPLE)
  # This *MUST* be the last install target.
  # Otherwise, for some messed up reason,
  # other install targets will not be accounted for when creating a DMG bundle.
  install(TARGETS ${PROJECT_NAME} BUNDLE DESTINATION . RUNTIME DESTINATION bin)
endif()

# Generic settings
set(CPACK_PACKAGE_EXECUTABLES "${PROJECT_NAME};Empty Epsilon (${CPACK_PACKAGE_VERSION_MAJOR}.${CPACK_PACKAGE_VERSION_MINOR}.${CPACK_PACKAGE_VERSION_PATCH})")
set(CPACK_PACKAGE_FILE_NAME "${PROJECT_NAME}")
set(CPACK_PACKAGE_CONTACT "https://github.com/daid/")

set(CPACK_PACKAGE_ICON "${CMAKE_CURRENT_SOURCE_DIR}/logo.png")
set(CPACK_PACKAGE_CHECKSUM SHA256)

# WIX (win installer)
# Setup the upgrade GUID to have one per version.
# https://tools.ietf.org/html/rfc4122#appendix-C
set(GUID_NAMESPACE_URL 6ba7b810-9dad-11d1-80b4-00c04fd430c8) # "Name string is URL" - in the appendix linked above.
string(UUID EMPTYEPSILON_GUID NAMESPACE ${GUID_NAMESPACE_URL} NAME "https://github.com/daid/EmptyEpsilon" TYPE SHA1)

string(UUID CPACK_WIX_UPGRADE_GUID NAMESPACE ${EMPTYEPSILON_GUID} NAME "${CPACK_PACKAGE_VERSION_MAJOR}.${CPACK_PACKAGE_VERSION_MINOR}.${CPACK_PACKAGE_VERSION_PATCH}" TYPE SHA1)
set(CPACK_WIX_UI_BANNER "${CMAKE_CURRENT_SOURCE_DIR}/resources/logo_full.png")
set(CPACK_WIX_UI_DIALOG "${CMAKE_CURRENT_SOURCE_DIR}/resources/logo_white.png")
# Add/Remove programs info.
set(CPACK_WIX_PROPERTY_ARPHELPLINK "https://daid.github.io/EmptyEpsilon/#tabs=6")
set(CPACK_WIX_PROPERTY_APPURLINFOABOUT "https://daid.github.io/EmptyEpsilon/#tabs=0")
set(CPACK_WIX_PROPERTY_ARPURLUPDATEINFO "https://daid.github.io/EmptyEpsilon/#tabs=5")
set(CPACK_WIX_PRODUCT_ICON "${CMAKE_CURRENT_SOURCE_DIR}/logo.ico")

if(NOT DEFINED CPACK_GENERATOR)
  if(WIN32 OR STEAMSDK)
    set(CPACK_GENERATOR "ZIP")
  elseif(UNIX)
    set(CPACK_GENERATOR "DEB")
    set(CPACK_DEBIAN_PACKAGE_DEPENDS "libfreetype6, libsdl2-2.0-0")
  endif()
endif()

# Allows injection of per-generator logic.
configure_file("${CMAKE_CURRENT_SOURCE_DIR}/cmake/CPackProjectConfig.cmake.in" "${PROJECT_BINARY_DIR}/CPackProjectConfig.cmake" @ONLY)
set(CPACK_PROJECT_CONFIG_FILE "${PROJECT_BINARY_DIR}/CPackProjectConfig.cmake")

if(APPLE)
  if("DragNDrop" IN_LIST CPACK_GENERATOR)
    if(SDL2_LIBRARIES MATCHES "\\.framework$")
      # SDL2_LIBRARIES points to the framework itself.
      # For fixup_bundle to pick it up, we need to get its parent directory as the 'root'.
      # SDL2 also depends on hidapi.framework, which comes with the official DMG (https://libsdl.org/download-2.0.php)
      # Same idea - need the path to it for the dependency manager to pick it up.
      install(CODE "
        include(BundleUtilities)
        fixup_bundle(\"\${CMAKE_INSTALL_PREFIX}/EmptyEpsilon.app\" \"\" \"${SDL2_LIBRARIES}/..;${SDL2_LIBRARIES}/Versions/Current/Frameworks\")
      ")
    else()
      message(WARNING "macOS DMG packaging: ${SDL2_LIBRARIES} does not appear to be a framework. The bundle will not be fixed up properly.")
    endif()
  endif()
endif()

set(sp_runtime_root "/")

if ("WIX" IN_LIST CPACK_GENERATOR)
    if (EmptyEpsilon_VERSION_MAJOR GREATER 100)
	    # WIX does not like major version number > 256.
	    # So if we're above 100, assume it's a year-like format and strip out century/millenium.
	    math(EXPR wix_major "${EmptyEpsilon_VERSION_MAJOR} % 100")

        # WIX only care for the bundled PACKAGE_VERSION - fix only this one.
        set(CPACK_PACKAGE_VERSION "${wix_major}.${EmptyEpsilon_VERSION_MINOR}.${EmptyEpsilon_VERSION_PATCH}")
    endif()
    
    # WIX is... weird.
    # When packaging, it puts each 'component' into a subdirectory.
    # Things without a specific component fall under an 'Unspecified' catch-all one[1]
    # Now when using components, with install targets coming from different projects (via the CPACK_INSTALL_CMAKE_PROJECTS below)
    # it seems it's just... lost: components ends up in the root directory of the packaging tree instead of the component's.
    # So we shove everything that's coming from runtime straight under the 'runtime' tree, and voila, we pleased the CMake gods.
    #
    # [1]: https://cmake.org/cmake/help/v3.8/variable/CMAKE_INSTALL_DEFAULT_COMPONENT_NAME.html#variable:CMAKE_INSTALL_DEFAULT_COMPONENT_NAME
    set(sp_runtime_root "/runtime")
endif()

if(WIN32)
    # Since the runtime component is mandatory, no point in presenting it to the user.
    # This ensures we only display one entry as a 'bundle' in the MSI.
    set(CPACK_COMPONENT_UNSPECIFIED_DEPENDS runtime)
    set(CPACK_COMPONENT_RUNTIME_HIDDEN TRUE)
    set(CPACK_COMPONENT_RUNTIME_REQUIRED TRUE)
endif()

# Setup install targets:
# - For EE, we use everything that's been provided with install command.
# - For SP, we use only the things having the 'runtime' component (ie shared libs).
set(CPACK_INSTALL_CMAKE_PROJECTS
    "${PROJECT_BINARY_DIR};${PROJECT_NAME};ALL;/"
    "${PROJECT_BINARY_DIR}/SeriousProton;SeriousProton;runtime;${sp_runtime_root}"
)

include(CPack)

configure_file(io.github.daid.EmptyEpsilon.metainfo.xml.in io.github.daid.EmptyEpsilon.metainfo.xml)

if(UNIX AND NOT APPLE AND NOT STEAMSDK)
  install(FILES io.github.daid.EmptyEpsilon.desktop DESTINATION "share/applications")
  install(FILES resources/logo_icon.png DESTINATION "share/icons/hicolor/512x512/apps" RENAME "io.github.daid.EmptyEpsilon.png")
  install(FILES ${CMAKE_CURRENT_BINARY_DIR}/io.github.daid.EmptyEpsilon.metainfo.xml DESTINATION "share/metainfo")
endif()
