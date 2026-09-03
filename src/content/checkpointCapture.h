#pragma once

// #766.2: vuelca el estado C++ REAL de una nave (componentes ECS) en
// CheckpointShipSystem, sustituyendo el fixture de prueba de la Fase 1
// (#766.1, checkpointState.h). Puro en el sentido de que no escribe nada:
// solo lee componentes ya presentes en la entidad.
//
// Fuera de alcance de esta fase: contactos detectados (necesita resolver
// identidad estable de entidad + nombre de facción + estado de escaneo de
// ScanState, con más superficie de la que cabe en este PR) y semillas
// deterministas (viven en foundry-module/, lado JS, no en C++). El campo
// "hull" se captura como un sistema más con id "hull" porque el criterio de
// aceptación de #766 pide "salud del casco" junto al resto de sistemas.

#include "content/checkpointState.h"
#include "ecs/entity.h"

#include <vector>

std::vector<CheckpointShipSystem> captureShipSystems(sp::ecs::Entity ship);

// Pure normalization of Hull's current/max into the checkpoint's 0.0-1.0
// health range. Extracted so it can be unit-tested (current==max, current==0,
// current>max, max==0, non-finite inputs) without constructing a real Hull
// component: Hull embeds sp::script::Callback members that touch the global
// Lua registry even off-heap, which segfaults in a test binary without a
// running script engine (see tests/checkpointCaptureTests.cpp).
float hullHealthFromCurrentMax(float current, float max);
