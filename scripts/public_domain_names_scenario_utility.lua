--	----------     Public domain call sign / name pools     ----------
--
--	Pools de nombres tomados del imaginario scifi/pulp en DOMINIO PÚBLICO, curados y
--	verificados en docs/DOMINIO_PUBLICO_SCIFI.md (issue #310, Fase 4). Sirven para dar
--	sabor de ambientación a indicativos de nave, contactos y estaciones sin coste de
--	licencia y sin arriesgar una marca ajena.
--
--	DEPENDENCIA: este archivo NO es autónomo. Su fuente de verdad legal es
--	docs/DOMINIO_PUBLICO_SCIFI.md, integrado en esta misma pila de PRs (#310). Cada nombre
--	de los pools de abajo está trazado a una fila/nota verificada de ese catálogo.
--
--	IMPORTANTE (criterio legal, resumido de docs/DOMINIO_PUBLICO_SCIFI.md):
--		- Solo se incluyen nombres cuyo COPYRIGHT está caducado (vida+70 en UE) y que NO
--		  colisionan con una marca viva en nuestro uso lúdico.
--		- Se excluyen a propósito nombres de la lista de descartes (Flash Gordon, Buck
--		  Rogers, John Carter/Barsoom, material de Derleth/Chaosium, etc.).
--		- Antes de añadir un nombre nuevo aquí, verifica su fila en el catálogo y enlaza.
--		  Si no aparece en una fila/nota verificada del catálogo, NO lo añadas.
--
--	Este archivo es propio del fork (no upstream) y NO modifica el generador de
--	indicativos de EmptyEpsilon (generate_call_sign_scenario_utility.lua). Interopera con
--	él por el punto de extensión que ese generador documenta: precargar una lista con el
--	mismo nombre (p. ej. tsn_names, independent_names) hace que el generador la use antes
--	de recurrir a sus nombres por defecto.
--
--	Uso
--		require("public_domain_names_scenario_utility.lua")
--
--		getPublicDomainName()            -- un nombre de cualquier tema
--		getPublicDomainName("basque")    -- un nombre de un tema concreto
--		generatePublicDomainCallSign()          -- nombre + sufijo numérico, p. ej. "Nautilus-42"
--		generatePublicDomainCallSign("verne")   -- de un tema concreto
--		seedCallSignPool("tsn_names")           -- vuelca todos los temas en tsn_names para
--		                                           que el generador upstream los use por
--		                                           faction "TSN"
--		seedCallSignPool("independent_names","lovecraft") -- solo un tema
--
--	Temas: "verne", "wells", "lovecraft", "myth", "basque". getPublicDomainThemes()
--	devuelve la lista.

public_domain_names = public_domain_names or {}

--	Verne (fallec. 1905): DP mundial. Nautilus/Nemo/Robur/Albatros y el prof. Aronnax.
--	(Se retiran "Lincoln" —riesgo de marca genérica— y "Vernia" —no figura en el catálogo.)
public_domain_names.verne = {
	"Nautilus", "Nemo", "Robur", "Albatros", "Aronnax",
}

--	H. G. Wells (fallec. 1946): DP en UE desde 2017; EE. UU. hasta 1930. "Ulla" (grito
--	marciano) y "Ogilvy" (astrónomo) de La guerra de los mundos; ambos en el catálogo.
public_domain_names.wells = {
	"Morlock", "Eloi", "Cavor", "Cavorita", "Ulla", "Ogilvy", "Tripode",
}

--	Lovecraft (fallec. 1937): DP en UE desde 2008. Solo lo acuñado por él; nada de
--	Derleth. Se evita "Arkham" por marca viva (ver catálogo). Se sustituyen las truncaduras
--	"Nyar"/"Yog" por teónimos exactos del catálogo (Cthulhu, Azathoth).
public_domain_names.lovecraft = {
	"Miskatonic", "Innsmouth", "Rlyeh", "Kadath", "Dagon", "Cthulhu", "Azathoth", "Leng",
}

--	Mitología griega/nórdica/mesopotámica: DP por naturaleza (usar el mito, no versiones
--	modernas con copyright).
public_domain_names.myth = {
	"Prometeo", "Icaro", "Nemesis", "Cerbero", "Aqueronte", "Estigia",
	"Yggdrasil", "Ragnarok", "Valquiria", "Fenrir", "Tiamat", "Gilgamesh",
}

--	Mitología vasca: DP y guiño identitario "Lagunak".
public_domain_names.basque = {
	"Mari", "Sugaar", "Herensuge", "Basajaun", "Gaueko", "Tartalo", "Ilargi", "Eguzki",
}

function getPublicDomainThemes()
	local themes = {}
	for theme, _ in pairs(public_domain_names) do
		table.insert(themes, theme)
	end
	return themes
end

--	Devuelve una copia plana con todos los nombres de todos los temas.
function getAllPublicDomainNames()
	local all = {}
	for _, names in pairs(public_domain_names) do
		for _, name in ipairs(names) do
			table.insert(all, name)
		end
	end
	return all
end

--	Un nombre al azar. Con tema, de ese tema; sin tema, de la mezcla de todos.
function getPublicDomainName(theme)
	local pool
	if theme == nil then
		pool = getAllPublicDomainNames()
	else
		pool = public_domain_names[theme]
		if pool == nil then
			error("public_domain_names: tema desconocido '" .. tostring(theme) .. "'", 2)
		end
	end
	return pool[math.random(1, #pool)]
end

--	Indicativo con sufijo numérico, estilo "Nautilus-42". Sufijo propio e independiente
--	del contador del generador upstream para poder usarse en solitario.
function generatePublicDomainCallSign(theme)
	if public_domain_suffix_index == nil then
		public_domain_suffix_index = 0
	end
	public_domain_suffix_index = public_domain_suffix_index + math.random(1, 3)
	if public_domain_suffix_index > 999 then
		public_domain_suffix_index = 1
	end
	return string.format("%s-%i", getPublicDomainName(theme), public_domain_suffix_index)
end

--	Vuelca los nombres en una lista global con el nombre indicado (p. ej. "tsn_names")
--	para que generate_call_sign_scenario_utility.lua la use por su mecanismo de pools de
--	facción. Con tema, solo ese tema; sin tema, todos. La lista se crea si no existe.
function seedCallSignPool(list_name, theme)
	if type(list_name) ~= "string" then
		error("seedCallSignPool: list_name debe ser el nombre (string) de la lista global", 2)
	end
	if _G[list_name] == nil then
		_G[list_name] = {}
	end
	local source
	if theme == nil then
		source = getAllPublicDomainNames()
	else
		source = public_domain_names[theme]
		if source == nil then
			error("seedCallSignPool: tema desconocido '" .. tostring(theme) .. "'", 2)
		end
	end
	for _, name in ipairs(source) do
		table.insert(_G[list_name], name)
	end
	return _G[list_name]
end
