--	----------     Crisis multipuesto: emboscada de ecos     ----------
--
--	Issue #484 (frente 5 de la Etapa B, coordinado en #479). Un encuentro cuya
--	resolucion CORRECTA exige que tres puestos actuen en cadena, no en paralelo.
--
--	Archivo propio del fork (no upstream). Es una utilidad reutilizable, no una
--	parte del escenario 90: cualquier escenario puede requerirla y montar la
--	crisis desde su propio catalogo de encuentros.
--
--	Uso
--		require("lagunak_crisis_scenario_utility.lua")
--
--		local crisis = lagunakCrisisEmboscada(nave, rumbo)  -- monta la crisis
--		crisis:actualizar(delta)                            -- una vez por update
--		crisis:estado()                                     -- tabla sondeable
--
--	----------     Por que hacen falta TRES puestos     ----------
--
--	El fallo del diseno ingenuo de "crisis cooperativa" es repartir cuatro
--	tareas independientes y llamarlo coordinacion: cada puesto resuelve la suya
--	sin depender del resto y la suma se parece a jugar solos en la misma sala.
--	Aqui la dependencia es una CADENA, y cada eslabon es una precondicion dura
--	del siguiente:
--
--	1. COMUNICACIONES sostiene el parlamento. Los tres contactos comparten un
--	   jammer: mientras nadie tenga un canal abierto con uno de ellos, todo
--	   escaneo terminado se BORRA (`setScanState("none")` cada tick). No es que
--	   escanear sea lento sin comunicaciones: es que no sirve de nada.
--	2. SENSORES identifica. Los tres contactos son el mismo casco civil y el
--	   asaltante es un buque trampa. Sin un escaneo COMPLETADO DURANTE el
--	   parlamento, cual de los tres dispara es literalmente indistinguible.
--	3. ARMAS ejecuta sobre el blanco correcto. Los otros dos contactos llevan
--	   supervivientes: destruirlos no es un tiro fallado, es la forma de perder
--	   este encuentro aunque la nave sobreviva.
--
--	Fallar UNO cambia el resultado, y en esa direccion concreta:
--	  - sin comunicaciones, no hay identificacion posible en toda la crisis;
--	  - sin sensores, armas solo puede elegir a ciegas (1 de 3);
--	  - sin armas, la identificacion no detiene a nadie: el asaltante sigue.
--
--	INGENIERIA es el cuarto puesto y su necesidad es REAL pero no de cadena, y
--	este archivo no finge lo contrario. El escaneo completo revela la frecuencia
--	de escudos del asaltante, que ingenieria puede contrarrestar
--	(`set_shield_frequency`), y sostener escudos y energia bajo fuego es su
--	trabajo nativo de siempre. Pero la ventaja de frecuencia depende de un ajuste
--	de servidor que el anfitrion puede apagar (`use_beam_shield_frequencies`),
--	asi que colgar de ella una condicion de victoria seria construir la crisis
--	sobre algo que puede no existir en la mesa. Se ofrece como recompensa de la
--	cadena, no como cuarto eslabon.
--
--	Ninguna de las cuatro acciones necesarias es nueva: `send_comm_message`,
--	`scan_object`, `set_weapon_target`/`fire_tube` y `set_shield_frequency` ya
--	estan en la matriz de autoridad del modulo (`station-actions.mjs`). Esta
--	crisis no abre ni un camino nuevo hacia el puente: usa los que la Etapa B ya
--	verifico.

-- Casco COMPARTIDO por los tres contactos: es el nucleo del enigma. Si el
-- asaltante tuviera plantilla de buque de guerra, la silueta lo delataria y
-- sensores dejaria de hacer falta.
LAGUNAK_CRISIS_CASCO = "Personnel Freighter 1"

-- Segundos de gracia al cerrarse el canal antes de que vuelva la interferencia.
-- Un margen corto evita que un cierre accidental de la ventana de comunicaciones
-- tire un escaneo casi terminado; es demasiado corto para sustituir al parlamento.
LAGUNAK_CRISIS_MARGEN_PARLAMENTO = 4.0

-- Distancia de aparicion del grupo, en unidades de mundo.
LAGUNAK_CRISIS_DISTANCIA = 14000

-- Complicaciones de la crisis (#807). Son nombres cerrados y efectos del
-- simulador, no parámetros libres: el GM elige una consecuencia después de una
-- pifia, pero no puede inyectar Lua ni describir una mutación arbitraria.
--
-- Viven aquí y no en Foundry para que la misma adjudicación sea jugable desde la
-- consola Lua nativa. Foundry podrá ofrecer otra superficie en una v2, pero no
-- será la autoridad ni una dependencia de esta mecánica (ADR-0008).
local function crisisActiva(crisis)
    if type(crisis) ~= "table" or crisis.desenlace ~= nil then return false end
    local nave = crisis.nave
    if nave == nil then return false end
    local ok, valida = pcall(function() return nave:isValid() end)
    return ok and valida == true
end

local LAGUNAK_CRISIS_COMPLICACIONES = {
    reactor_sobrecalentado = {
        nombre = "El reactor acumula calor",
        aplicar = function(crisis)
            local nave = crisis.nave
            local okLectura, calor = pcall(function()
                return nave:getSystemHeat("reactor")
            end)
            if not okLectura or type(calor) ~= "number" then return false end
            local nuevo = math.min(1.0, math.max(0.0, calor) + 0.25)
            local okEscritura = pcall(function()
                nave:setSystemHeat("reactor", nuevo)
            end)
            if not okEscritura then return false end
            if type(globalMessage) == "function" then
                globalMessage(_("lagunak-crisis", "Complicacion: el reactor acumula calor. Ingenieria debe compensarlo."))
            end
            return true
        end,
    },
    margen_parlamento_reducido = {
        nombre = "La interferencia acorta el margen del parlamento",
        aplicar = function(crisis)
            local actual = tonumber(crisis.margenParlamentoMaximo)
                or LAGUNAK_CRISIS_MARGEN_PARLAMENTO
            crisis.margenParlamentoMaximo = math.min(actual, 1.0)
            crisis.margenParlamento = math.min(
                tonumber(crisis.margenParlamento) or 0.0,
                crisis.margenParlamentoMaximo
            )
            if type(globalMessage) == "function" then
                globalMessage(_("lagunak-crisis", "Complicacion: la interferencia deja solo un segundo de margen al parlamento."))
            end
            return true
        end,
    },
}

--- Catálogo público para la consola Lua. Devuelve copias sin las funciones de
--- implementación: el GM puede listar y elegir, no sustituir el efecto.
function lagunakCrisisComplicaciones()
    local catalogo = {}
    for _, id in ipairs({ "reactor_sobrecalentado", "margen_parlamento_reducido" }) do
        table.insert(catalogo, {
            id = id,
            nombre = LAGUNAK_CRISIS_COMPLICACIONES[id].nombre,
        })
    end
    return catalogo
end

--- Despacho cerrado. Un identificador desconocido, una crisis terminada o una
--- nave ausente se rechazan sin tocar la simulación.
function lagunakCrisisAplicarComplicacion(crisis, id)
    if not crisisActiva(crisis) or type(id) ~= "string" then return false end
    local complicacion = LAGUNAK_CRISIS_COMPLICACIONES[id]
    if complicacion == nil then return false end
    return complicacion.aplicar(crisis) == true
end

local DESVIOS_RUMBO = { ahead = 0, starboard = 90, astern = 180, port = 270 }

local Crisis = {}
Crisis.__index = Crisis

--- Atajo de la instancia usada por los escenarios y por la consola nativa.
function Crisis:aplicarComplicacion(id)
    return lagunakCrisisAplicarComplicacion(self, id)
end

--- Baraja en el sitio (Fisher-Yates). Que el asaltante no sea siempre el mismo
--- indice importa: si no, la segunda partida se resuelve de memoria.
local function barajar(lista)
    for i = #lista, 2, -1 do
        local j = math.random(1, i)
        lista[i], lista[j] = lista[j], lista[i]
    end
    return lista
end

--- Reune el grupo de tres contactos alrededor de un punto, con el asaltante en
--- una posicion aleatoria de la formacion.
local function crearContactos(crisis, x, y, angulo)
    local roles = barajar({ "senuelo", "senuelo", "asaltante" })
    local contactos = {}
    for indice, rol in ipairs(roles) do
        -- Separacion suficiente para que sean tres blips distintos en radar y
        -- se puedan seleccionar por separado, sin que el grupo se disperse.
        local separacion = (indice - 2) * 1400
        local lateral = math.rad(angulo + 90)
        local objeto = CpuShip()
            :setTemplate(LAGUNAK_CRISIS_CASCO)
            :setFaction("Independent")
            :setCallSign(string.format("Itzal %d", indice))
            :setPosition(x + math.sin(lateral) * separacion, y - math.cos(lateral) * separacion)
            :orderIdle()

        -- La descripcion sin escanear es IDENTICA en los tres: es el dato que
        -- el escaneo tiene que romper. Decir "carguero civil" en los tres no es
        -- mentir al jugador, es la mentira que el asaltante esta contando.
        objeto:setDescriptions(
            _("scienceDescription", "Carguero civil de linea. Baliza de socorro activa."),
            rol == "asaltante"
                and _("scienceDescription", "Buque trampa: baterias ocultas tras la carga. La baliza de socorro es un senuelo.")
                or _("scienceDescription", "Carguero civil con supervivientes a bordo. Sin armamento.")
        )

        if rol == "asaltante" then
            -- Buque trampa: casco civil, dientes de guerra. Los escudos y las
            -- baterias se anaden por script, no por plantilla, precisamente
            -- para que la plantilla siga siendo la civil.
            --
            -- Y NACE NEUTRAL, no Exuari. No es un detalle cosmetico: la IA por
            -- defecto de EmptyEpsilon dispara a un enemigo en rango aunque su
            -- orden sea `idle`, asi que un asaltante con facción hostil desde el
            -- principio se delataria el solo en cuanto la nave se acercase — y
            -- el trabajo de sensores dejaria de existir. El disfraz tiene que ser
            -- tambien de facción; se cae al revelarse (`descubrir`).
            objeto:setShieldsMax(80, 80):setShields(80, 80)
            objeto:setShieldsFrequency(math.random(0, 20))
            objeto:setBeamWeapon(0, 60, 0, 1200.0, 6.0, 8)
            objeto:setBeamWeapon(1, 60, 180, 1200.0, 6.0, 8)
            -- Profundidad 2: identificarlo cuesta dos escaneos completos, o sea
            -- tiempo real de parlamento sostenido. Con profundidad 1 la cadena
            -- existiria en el codigo y no en la mesa.
            objeto:setScanningParameters(3, 2)
            crisis.asaltante = objeto
        else
            objeto:setScanningParameters(2, 1)
            table.insert(crisis.senuelos, objeto)
        end

        objeto:setScanState("none")
        objeto:setCommsFunction(function()
            crisis:abrirParlamento(objeto)
        end)
        table.insert(contactos, objeto)
    end
    return contactos
end

--- Monta la crisis alrededor de `nave`. `rumbo` es una sugerencia gruesa
--- ("ahead"/"astern"/"port"/"starboard"), nunca una coordenada: el escenario
--- sigue siendo dueno del donde exacto (ADR-0002).
function lagunakCrisisEmboscada(nave, rumbo)
    if nave == nil or not nave:isValid() then return nil end

    local crisis = setmetatable({
        nave = nave,
        senuelos = {},
        asaltante = nil,
        -- Latch: solo se enciende con un escaneo completado DURANTE el
        -- parlamento. Sin latch, el borrado por interferencia dejaria un
        -- fotograma de "escaneado" que bastaria para identificar sin hablar.
        identificado = false,
        parlamento = false,
        margenParlamentoMaximo = LAGUNAK_CRISIS_MARGEN_PARLAMENTO,
        margenParlamento = 0.0,
        senuelosPerdidos = 0,
        avisoIdentificado = false,
        descubierto = false,
        desenlace = nil,
    }, Crisis)

    local desvio = DESVIOS_RUMBO[rumbo] or 0
    local angulo = nave:getHeading() + desvio + math.random(-10, 10)
    local nx, ny = nave:getPosition()
    local distancia = LAGUNAK_CRISIS_DISTANCIA + math.random(-1500, 1500)
    local rad = math.rad(angulo)
    crisis.contactos = crearContactos(
        crisis,
        nx + math.sin(rad) * distancia,
        ny - math.cos(rad) * distancia,
        angulo
    )
    return crisis
end

--- Llamado por el motor cuando la tripulacion abre canal con cualquiera de los
--- tres. Los tres responden con la misma voz sintetizada: el jammer del
--- asaltante retransmite por los tres, y por eso hablar con cualquiera de ellos
--- sostiene el parlamento.
---
--- Al abrir, emite el evento de escenario `LAGUNAK_EVT_parlamento_abierto` (misma
--- familia que `LAGUNAK_EVT_encounter_started_*` de scenario_90): es la senal que
--- el puente retransmite a Foundry como hook `lagunakAbrirParlamento` para abrir
--- la ventana de parlamento (#810) con el contacto correcto. El contacto viaja
--- codificado en el callsign del marcador porque el canal Lua→Foundry del repo es
--- ese: Artifact con callsign `LAGUNAK_EVT_*`.
function Crisis:abrirParlamento(contacto)
    self.parlamento = true
    self.margenParlamento = self.margenParlamentoMaximo
    -- Senal hacia Foundry: el bridge la normaliza y la reenvia por socket como
    -- hook `lagunakAbrirParlamento`. Codificamos id/callsign/faction sin espacios
    -- ni caracteres raros para que el parseador del puente sea robusto.
    if contacto and contacto:isValid() then
        local id = contacto:getCallSign() or "desconocido"
        local faction = contacto:getFaction() or "neutral"
        local seguro = function(s)
            return (s or ""):gsub("[^%w]+", "_")
        end
        local marcador = Artifact()
        marcador:setCallSign(
            "LAGUNAK_EVT_parlamento_abierto_" .. seguro(id) .. "__" .. seguro(faction))
        -- El marcador se descarta solo: vive el tiempo de un tick, basta para que
        -- el puente lo sondee y lo retransmita una vez.
        marcador:setPosition(self.nave:getPosition())
    end
    setCommsMessage(_("lagunak-crisis", [[...isis... aqui convoy Itzal, motores parados.

Recibimos vuestra senal. Hay heridos a bordo. No sabemos cual de los tres esta emitiendo la interferencia — no somos nosotros.

Mantened el canal, por favor. Mantenedlo abierto.]]))
    addCommsReply(_("lagunak-crisis", "Mantenemos el canal. Describid vuestra carga."), function()
        setCommsMessage(_("lagunak-crisis", "Grano y piezas de recambio. Rumbo a Argia desde el cinturon... la lista completa tardara, dadnos un momento."))
    end)
    addCommsReply(_("lagunak-crisis", "Identificaos uno por uno, indicativo y matricula."), function()
        setCommsMessage(_("lagunak-crisis", "Itzal 1... Itzal 2... la matricula del tercero no nos llega. Seguimos intentandolo. No cortéis."))
    end)
end

--- El asaltante deja de fingir: cae el disfraz de facción y ataca. UN solo sitio
--- a proposito — se llega aqui por dos caminos muy distintos (la tripulacion lo
--- identifica, o dispara a un senuelo y el grupo se rompe) y no deben divergir.
--- Idempotente: llamarlo dos veces no reencola nada.
function Crisis:descubrir()
    if self.descubierto then return end
    self.descubierto = true
    if self.asaltante == nil or not self.asaltante:isValid() then return end
    self.asaltante:setFaction("Exuari")
    self.asaltante:orderAttack(self.nave)
end

--- ¿Hay canal abierto con el grupo ahora mismo? El motor no expone con QUIEN
--- esta abierto el canal, asi que se compone: la funcion de comms de los
--- contactos enciende la bandera al abrirse y cualquier estado que no sea
--- "canal abierto" la apaga. Pasar por otro interlocutor cruza necesariamente
--- un estado cerrado, asi que la bandera no se queda pegada.
function Crisis:parlamentoActivo(delta)
    if self.nave:isValid() and self.nave:isCommsChatOpen() then
        if self.parlamento then
            self.margenParlamento = self.margenParlamentoMaximo
            return true
        end
        return false
    end
    self.parlamento = false
    if self.margenParlamento > 0 then
        self.margenParlamento = self.margenParlamento - delta
        return true
    end
    return false
end

--- La interferencia: mientras no haya parlamento, todo escaneo terminado se
--- borra. Escanear sin comunicaciones no es lento, es esteril.
function Crisis:aplicarInterferencia()
    for _, contacto in ipairs(self.contactos) do
        if contacto:isValid() and contacto:isScannedBy(self.nave) then
            contacto:setScanState("none")
        end
    end
end

--- Recuento de senuelos destruidos. Perder uno rompe el parlamento para siempre
--- (los otros dejan de responder) y lanza al asaltante al ataque: disparar a
--- ciegas no es neutral, empeora activamente la crisis.
function Crisis:revisarSenuelos()
    local perdidos = 0
    for _, senuelo in ipairs(self.senuelos) do
        if not senuelo:isValid() then perdidos = perdidos + 1 end
    end
    if perdidos <= self.senuelosPerdidos then return end
    self.senuelosPerdidos = perdidos
    for _, contacto in ipairs(self.contactos) do
        -- Cadena vacia = comms deshabilitadas con esa entidad (API de EE).
        if contacto:isValid() then contacto:setCommsScript("") end
    end
    self.parlamento = false
    self.margenParlamento = 0
    self:descubrir()
    globalMessage(_("msgMainscreen", [[Baliza de socorro apagada.

Habeis destruido un carguero con supervivientes a bordo. El resto del convoy ha cortado la senal.]]))
end

--- Un ciclo. Devuelve el desenlace ("resuelta"/"con_bajas"/"perdida") en cuanto
--- se decide, y nil mientras la crisis sigue viva.
function Crisis:actualizar(delta)
    if self.desenlace ~= nil then return self.desenlace end
    if not self.nave:isValid() then
        self.desenlace = "perdida"
        return self.desenlace
    end

    self:revisarSenuelos()

    if self:parlamentoActivo(delta) then
        -- Solo aqui se puede latchear la identificacion: es lo que convierte
        -- "comunicaciones ayuda" en "comunicaciones es precondicion".
        if not self.identificado
            and self.asaltante ~= nil
            and self.asaltante:isValid()
            and self.asaltante:isScannedBy(self.nave)
        then
            self.identificado = true
        end
    else
        self:aplicarInterferencia()
    end

    if self.identificado and not self.avisoIdentificado then
        self.avisoIdentificado = true
        -- El aviso nombra el indicativo: es el dato que sensores acaba de ganar
        -- y que armas necesita para `set_weapon_target`. No lo regala antes.
        globalMessage(string.format(_("msgMainscreen", [[Escaneo completado: %s es un buque trampa.

Los otros dos contactos llevan supervivientes.]]), self.asaltante:getCallSign()))
        -- El asaltante se sabe descubierto y deja de fingir. Por `descubrir` y
        -- no por `orderAttack` suelto: el disfraz es tambien de facción, y
        -- atacar sin soltarlo dejaria a un "civil" disparando — y a armas sin
        -- un blanco hostil que fijar.
        self:descubrir()
    end

    if self.asaltante ~= nil and not self.asaltante:isValid() then
        self.desenlace = self.senuelosPerdidos > 0 and "con_bajas" or "resuelta"
        return self.desenlace
    end
    return nil
end

--- Estado sondeable desde la consola Lua del modo headless y desde QA. No es
--- contrato de red: el puente no lee esto.
function Crisis:estado()
    return {
        identificado = self.identificado,
        descubierto = self.descubierto,
        parlamento = self.parlamento,
        margenParlamento = self.margenParlamento,
        margenParlamentoMaximo = self.margenParlamentoMaximo,
        senuelosPerdidos = self.senuelosPerdidos,
        desenlace = self.desenlace,
        asaltante = (self.asaltante ~= nil and self.asaltante:isValid())
            and self.asaltante:getCallSign() or nil,
    }
end
