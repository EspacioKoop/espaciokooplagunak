-- Name: Lagunak: Primera guardia
-- Description: Primer escenario propio de Espaciokoop Lagunak. Escolta corta para tripulaciones novatas: llevad la nave desde la estacion Lagunak hasta el puesto avanzado Argia. Asaltantes Exuari merodean el corredor a mitad de ruta; combatir o esquivarlos es decision de la tripulacion. Victoria al llegar a Argia; derrota si perdeis la nave.
-- Type: Mission

--- Scenario
-- @script scenario_90_lagunak_primera_guardia
--
-- Escenario propio del fork Espaciokoop Lagunak
-- (https://github.com/VaroTv7/espaciokooplagunak). El contenido heredado de
-- EmptyEpsilon y sus creditos no se modifican; este archivo es nuevo.

require("utils.lua")

-- Globales (sin "local") a proposito: permiten sondear el estado desde la
-- consola Lua del modo headless o via /exec.lua en QA local.
fase = "preparacion"

function init()
    timer = 0
    briefEnviado = false
    cierreTimer = 5.0

    estacionLagunak = SpaceStation()
        :setTemplate("Medium Station")
        :setFaction("Human Navy")
        :setCallSign("Lagunak")
        :setPosition(0, 0)

    estacionArgia = SpaceStation()
        :setTemplate("Small Station")
        :setFaction("Human Navy")
        :setCallSign("Argia")
        :setPosition(28000, -16000)

    player = PlayerSpaceship()
        :setTemplate("Phobos M3P")
        :setFaction("Human Navy")
        :setCallSign("Itsaso 1")
        :setPosition(1200, 800)
        :setHeading(60)

    -- Asaltantes a mitad de corredor: pocos y debiles; la guardia debe poder
    -- superarse tambien esquivando, no solo combatiendo.
    asaltantes = {}
    table.insert(asaltantes, CpuShip()
        :setFaction("Exuari"):setTemplate("Dagger"):setCallSign("Lapur 1")
        :setPosition(13000, -8500):orderDefendLocation(14000, -8000))
    table.insert(asaltantes, CpuShip()
        :setFaction("Exuari"):setTemplate("Dagger"):setCallSign("Lapur 2")
        :setPosition(15000, -7500):orderDefendLocation(14000, -8000))

    fase = "guardia"
end

function enviarBrief()
    estacionLagunak:sendCommsMessage(player, _("goal-incCall", [[Aqui control de Lagunak.

Primera guardia de esta tripulacion: llevad la Itsaso 1 hasta el puesto avanzado Argia, rumbo aproximado 120, a unas 32U de aqui.

Aviso de trafico: naves Exuari merodean el corredor a mitad de ruta. No teneis orden de limpiarlo — llegar enteros ES la mision. Combatir o esquivar, decision vuestra.

Control de Lagunak, corto.]]))
end

function finCompletada(delta)
    cierreTimer = cierreTimer - delta
    if cierreTimer < 0 then
        victory("Human Navy")
    end
    if not cierreAnunciado then
        cierreAnunciado = true
        globalMessage(string.format(_("msgMainscreen", [[Guardia completada.
La Itsaso 1 ha llegado al puesto avanzado Argia.
Tiempo de guardia: %s

Espaciokoop Lagunak — primera guardia superada.]]), formatTime(timer)))
    end
end

function update(delta)
    timer = timer + delta

    if fase == "guardia" then
        if not briefEnviado and timer > 5.0 then
            briefEnviado = true
            enviarBrief()
        end
        if not player:isValid() then
            fase = "derrota"
            globalMessage(_("msgMainscreen", "La Itsaso 1 se ha perdido con toda su tripulacion.\nLa primera guardia termina aqui."))
            victory("Exuari")
        elseif distance(player, estacionArgia) < 1500 then
            fase = "completada"
        end
    elseif fase == "completada" then
        finCompletada(delta)
    end
end
