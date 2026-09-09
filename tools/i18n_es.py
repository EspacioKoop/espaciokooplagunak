#!/usr/bin/env python3
"""Generate and validate Spanish (Spain) PO catalogs from English templates.

This is a maintainer tool for creating a machine-assisted first pass. Its output
must receive linguistic review before being called final. Translation models are
local and are never committed to the repository.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

import ctranslate2
import polib
import sentencepiece as spm


PLACEHOLDER_RE = re.compile(
    r"(\{[^{}\n]+\}|%(?:\d+\$)?[-+#0]*\d*(?:\.\d+)?[diuoxXfFeEgGaAcspq%]|<[^<>\n]+>|__[^_\n]+__)"
)
SENTENCE_SPLIT_RE = re.compile(r"(\n+|(?<=[.!?])\s+)")

# Stable terminology for controls and ship systems. Context-specific exceptions
# can be added by (msgctxt, msgid) in CONTEXT_OVERRIDES.
EXACT_OVERRIDES: dict[str, str] = {
    "Front": "Frontal",
    "Rear": "Popa",
    "Left": "Izquierda",
    "Right": "Derecha",
    "Back": "Volver",
    "Close": "Cerrar",
    "Quit": "Salir",
    "Ok": "Aceptar",
    "OK": "Aceptar",
    "Save": "Guardar",
    "Enabled": "Activado",
    "Disabled": "Desactivado",
    "Yes": "Sí",
    "No": "No",
    "Neutral": "Neutral",
    "Enemy": "Enemigo",
    "Friendly": "Aliado",
    "Factions": "Facciones",
    "Ships": "Naves",
    "Stations": "Estaciones",
    "Class": "Clase",
    "Sub-class": "Subclase",
    "Size": "Tamaño",
    "Shield": "Escudo",
    "Shields": "Escudos",
    "Hull": "Casco",
    "Move speed": "Velocidad de avance",
    "Reverse move speed": "Velocidad de retroceso",
    "Turn speed": "Velocidad de giro",
    "Warp speed": "Velocidad de curvatura",
    "Jump range": "Alcance de salto",
    "Helms": "Timón",
    "Weapons": "Armas",
    "Engineering": "Ingeniería",
    "Science": "Ciencia",
    "Relay": "Comunicaciones",
    "Operations": "Operaciones",
    "Tactical": "Táctica",
    "Single Pilot": "Piloto único",
    "Main screen": "Pantalla principal",
    "Game master": "Director de juego",
    "Control options": "Opciones de control",
    "Interface options": "Opciones de interfaz",
    "Graphics options": "Opciones gráficas",
    "Audio options": "Opciones de audio",
    "Interface language": "Idioma de la interfaz",
    "Interface theme": "Tema de la interfaz",
    "Click Back to apply change": "Pulsa Volver para aplicar el cambio",
    "Configure keyboard/joystick": "Configurar teclado/mando",
    "Radar": "Radar",
    "Database": "Base de datos",
    "Scanning": "Escaneo",
    "Scan": "Escanear",
    "Docking": "Atraque",
    "Dock": "Atracar",
    "Undock": "Desatracar",
    "Impulse": "Impulso",
    "Warp": "Curvatura",
    "Jump": "Salto",
    "Energy": "Energía",
    "Coolant": "Refrigerante",
    "Repair": "Reparar",
    "System": "Sistema",
    "Systems": "Sistemas",
    "Missile": "Misil",
    "Missiles": "Misiles",
    "Mine": "Mina",
    "Mines": "Minas",
    "Player": "Jugador",
    "Players": "Jugadores",
    "Server": "Servidor",
    "Scenario": "Escenario",
    "Tutorial": "Tutorial",
    "Basic Battle": "Batalla básica",
    "Beacon of Light series": "Serie «Faro de luz»",
    "Birth of the Atlantis": "Nacimiento de la Atlantis",
    "Liberation Day": "Día de la liberación",
    "Surf's Up!": "¡A surfear!",
    "Push The Payload": "Empuja la carga",
    "Planet Devourer": "Devorador de planetas",
    "Cadet Patrol": "Patrulla de cadetes",
    "Locust Swarm": "Enjambre de langostas",
    "Scurvy Scavenger": "Carroñero escorbútico",
    "Unwanted Visitors": "Visitantes no deseados",
    "Close the Gaps": "Cierra las brechas",
    "Escape": "Fuga",
    "Delta quadrant patrol duty": "Patrulla del cuadrante Delta",
    "Defender Hunter": "Defensa y caza",
    "Carrier and Fighters": "Portanaves y cazas",
    "Shoreline": "Línea de defensa",
    "Borderline Fever": "Fiebre fronteriza",
    "Capture the Flag": "Captura la bandera",
    "The Omicron Plague": "La plaga Ómicron",
    "Clash in Shangri-La (PVP)": "Choque en Shangri-La (JcJ)",
    "Chaos of War": "Caos de guerra",
    "Battlefield": "Campo de batalla",
    "Warp Drive": "Motor de curvatura",
    "Beam Weapons": "Armas de haz",
    "Beams": "Haces",
    "Beam info": "Información de haces",
    "Beam/shield frequencies": "Frecuencias de haces y escudos",
    "Hailed by {name}": "Llamada entrante de {name}",
    "Channel not open, enter name to hail as to hail target.": "El canal está cerrado; introduce el nombre con el que quieres contactar al objetivo.",
}
CONTEXT_OVERRIDES: dict[tuple[str | None, str], str] = {
    ("scenario-category", "Replayable Mission"): "Misión rejugable",
    ("scenario-category", "Mission"): "Misión",
    ("scenario-category", "Basic"): "Básico",
    ("scenario-category", "PvP"): "JcJ",
    ("scenario-category", "Development"): "Desarrollo",
    ("scenario-category", "Race"): "Carrera",
    ("setting", "Time"): "Tiempo",
    ("setting", "PlayerShip"): "Nave del jugador",
    ("Enemies", "Empty"): "Sin enemigos",
    ("Enemies", "Hard"): "Difícil",
    ("Time", "Unlimited"): "Sin límite",
    ("systems", "HACKED"): "HACKEADO",
    # Issue #28: reviewed UI actions and technical terminology.
    ("hotkey_Cinematic", "Strafe left"): "Desplazarse lateralmente a la izquierda",
    ("hotkey_Cinematic", "Strafe right"): "Desplazarse lateralmente a la derecha",
    ("hotkey_Helms", "Combat boost left"): "Impulso de combate a la izquierda",
    ("hotkey_Helms", "Combat boost right"): "Impulso de combate a la derecha",
    ("hotkey_Weapons", "Select homing"): "Seleccionar misil guiado",
    ("hotkey_Weapons", "Select mine"): "Seleccionar mina",
    ("hotkey_Weapons", "Load tube {number}"): "Cargar tubo {number}",
    ("hotkey_Weapons", "Unload tube {number}"): "Descargar tubo {number}",
    ("hotkey_Weapons", "Fire tube {number}"): "Disparar tubo {number}",
    ("hotkey_Weapons", "Toggle shields"): "Alternar escudos",
    ("missile", "Homing"): "Guiado",
    (None, "Unpause"): "Reanudar",
    ("mainscreen", "Back"): "Trasera",
    (None, "Open comms"): "Abrir comunicaciones",
    (None, "Open Comms"): "Abrir comunicaciones",
    (None, "Waiting for authorization input: {codes} left"): "Esperando códigos de autorización: quedan {codes}",
    ("button", "Cycle through ships"): "Recorrer las naves",
    ("slider", "Power"): "Potencia",
    ("slider", "Power: {current_level}% / {requested}%"): "Potencia: {current_level}% / {requested}%",
    ("science", "Bearing"): "Demora",
    ("button", "Power"): "Potencia",
    ("button", "Hail ship"): "Contactar con la nave",
    ("hotkey_General", "Return to ship options menu"): "Volver al menú de opciones de la nave",
    ("hotkey_General", "Broadcast voice chat to ship"): "Transmitir el chat de voz a la nave",
    (None, "Waiting for ship on "): "Esperando a la nave en ",
    ("chatGM", "{callsign} - Hailing as {target}"): "{callsign} - Contactando como {target}",
    ("tweak-text", "Auto repair rate:"): "Tasa de autorreparación:",
    ("tweak-text", "Charge available:"): "Carga disponible:",
    ("tweak-text", "Homing capacity:"): "Capacidad de misiles guiados:",
    ("tweak-text", "Allow homing:"): "Permitir misiles guiados:",
    ("tweak-text", "Allow mine:"): "Permitir minas:",
    ("shiplog", "Hailing: {name}"): "Contactando con {name}",
    ("shiplog", "Hail suddenly went dead."): "La llamada se interrumpió de repente.",
    ("shiplog", "Accepted hail from {callsign}"): "Llamada de {callsign} aceptada",
    ("shiplog", "Refused hail from {callsign}"): "Llamada de {callsign} rechazada",
    ("shiplog", "Refused hail from {name}"): "Llamada de {name} rechazada",
    ("shiplog", "Hailing from {callsign} stopped"): "La llamada de {callsign} se ha interrumpido",
    ("database direction", "Rear"): "Trasera",
    ("database direction", "Front"): "Frontal",
    ("station", "Helms"): "Timón",
    ("station", "Weapons"): "Armas",
    ("station", "Engineering"): "Ingeniería",
    ("station", "Science"): "Ciencia",
    ("time-incCall", "%s, you have one minute remaining."): "%s, te queda %d minuto.",
    ("time-incCall", "%s, you have %d minutes remaining."): "%s, te quedan %d minutos.",
    ("upgrade-comms", "Provide %s for 25 percent energy capacity upgrade"): "Entrega %s para mejorar un 25 por ciento la capacidad de energía",
    # Issue #28: reviewed helm tutorial sequence (docking and long-distance travel).
    (
        None,
        "Excellent!\n\n"
        "Next up: docking. Docking with a station recharges your energy, repairs your hull, and allows the relay officer to request weapon refills. It can also be important for other mission-related events.\n"
        'To dock, maneuver within 1u of a station and press the "Request Dock" button, from which point docking is fully automated.\n'
        "Maneuver to the nearby station and request permission to dock.",
    ): (
        "¡Excelente!\n\n"
        "A continuación: el atraque. Al atracar en una estación, recargas energía, reparas el casco y permites que el oficial de comunicaciones solicite reabastecer las armas. También puede ser importante para otros eventos de la misión.\n"
        "Para atracar, maniobra hasta situarte a menos de 1u de una estación y pulsa el botón «Solicitar atraque»; a partir de ahí, la maniobra es completamente automática.\n"
        "Acércate a la estación y solicita permiso para atracar."
    ),
    (
        None,
        "Now that you are docked, your movement is locked. As helms officer, there is nothing else you can do but undock, so do that now.",
    ): "Ahora que estás atracado, no puedes moverte. Como oficial de timón, solo puedes desatracar; hazlo ahora.",
    (
        None,
        "Aggression is not always the solution, but boy, it is fun!\n\n"
        "On to the next task: moving long distances.\n"
        "There are two methods of moving long distances quickly. Depending on your ship, you either have a warp drive or a jump drive.\n"
        "The warp drive moves your ship at high speed, while the jump drive instantly teleports your ship a great distance.",
    ): (
        "La agresividad no siempre es la solución, pero ¡hay que reconocer que es divertida!\n\n"
        "Pasemos a la siguiente tarea: recorrer largas distancias.\n"
        "Hay dos métodos para recorrerlas rápidamente. Según tu nave, tendrás un motor de curvatura o un motor de salto.\n"
        "El motor de curvatura desplaza tu nave a gran velocidad, mientras que el motor de salto la transporta una gran distancia al instante."
    ),
    (
        None,
        "First, let us try the warp drive.\n\n"
        "It functions like the impulse drive but only propels your ship forward, and consumes energy at a much faster rate.\n"
        "Use the warp drive to move more than 30u away from this starting point.",
    ): (
        "Primero, probemos el motor de curvatura.\n\n"
        "Funciona como el motor de impulso, pero solo propulsa tu nave hacia delante y consume energía mucho más deprisa.\n"
        "Usa el motor de curvatura para alejarte más de 30u de este punto de partida."
    ),
    (
        None,
        "Next, let us demonstrate the jump drive.\n\n"
        "To use the jump drive, point your ship in the direction where you want to jump, configure a distance to jump, and then initiate it. The jump occurs 10 seconds after you initiate. Use the jump drive to jump more than 30u from this starting point, in any direction.",
    ): (
        "A continuación, probemos el motor de salto.\n\n"
        "Para usarlo, orienta tu nave en la dirección deseada, configura la distancia e inicia el salto. El salto se produce 10 segundos después de iniciarlo. Usa el motor de salto para alejarte más de 30u de este punto de partida, en cualquier dirección."
    ),
    (
        None,
        "Notice how your jump drive needs to recharge after use.\n\n"
        "This covers the basics of the helms officer.",
    ): (
        "Observa que el motor de salto necesita recargarse después de usarlo.\n\n"
        "Con esto terminan los fundamentos del puesto de timón."
    ),
    # Issue #28: reviewed weapons tutorial sequence (targeting, shields, missiles).
    (
        None,
        "This is the weapons screen.\n"
        "As the weapons officer, you are responsible for targeting beam weapons, loading and firing missile weapons, and controlling your shields.",
    ): (
        "Esta es la pantalla de armas.\n"
        "Como oficial de armas, te encargas de asignar el objetivo de las armas de haz, de cargar y disparar los misiles y de controlar los escudos."
    ),
    (
        None,
        "Your most fundamental task is to target your ship's weapons.\n"
        "Your beam weapons only fire at your selected target, and homing missiles travel toward your selected target.\n\n"
        "Target the ship in front of you by pressing it.",
    ): (
        "Tu tarea más esencial es asignar objetivo a las armas de tu nave.\n"
        "Las armas de haz solo disparan al objetivo seleccionado, y los misiles guiados vuelan hacia él.\n\n"
        "Fija como objetivo la nave que tienes delante pulsándola."
    ),
    (
        None,
        "Good! Notice that your beam weapons did not fire on this ship until you targeted it.\n\n"
        "Next up: shield controls.",
    ): (
        "¡Bien! Fíjate en que tus armas de haz no han disparado contra esa nave hasta que la has fijado como objetivo.\n\n"
        "A continuación: el control de escudos."
    ),
    (
        None,
        "As you might notice, you are being shot at. Do not worry, you cannot die right now.\n\n"
        "You are taking damage, however, so enable your shields to protect yourself.",
    ): (
        "Como habrás notado, te están disparando. No te preocupes: ahora mismo no puedes morir.\n\n"
        "Aun así estás recibiendo daño, así que activa los escudos para protegerte."
    ),
    (
        None,
        "Shields protect your ship from direct damage, but they cost extra energy to maintain, can take only a limited amount of damage, and are slow to recharge. Eventually, this enemy's attacks will get through your shields.\n\n"
        "Disable your shields to continue.",
    ): (
        "Los escudos protegen tu nave del daño directo, pero mantenerlos consume energía adicional, solo aguantan una cantidad limitada de daño y tardan en recargarse. Tarde o temprano, los ataques de este enemigo atravesarán tus escudos.\n\n"
        "Desactiva los escudos para continuar."
    ),
    (
        None,
        "While only a single button, your shields are vital for survival. They protect against all kinds of damage, including beam weapons, missiles, asteroids, and mines, so make them one of your primary priorities.\n\n"
        "Next up, the real fun starts: missile weapons.",
    ): (
        "Aunque no sean más que un botón, los escudos son vitales para sobrevivir. Protegen contra todo tipo de daño (armas de haz, misiles, asteroides y minas), así que conviértelos en una de tus principales prioridades.\n\n"
        "A continuación empieza la verdadera diversión: los misiles."
    ),
    (
        None,
        "You have 1 homing missile in your missile storage now, and 1 weapon tube.\n"
        "You can load this missile into your weapon tube. Depending on your ship type, you might have more types of missiles and more weapon tubes.\n\n"
        "Load this homing missile into the weapon tube by selecting the homing missile, and then pressing the load button for this tube. Note that it takes some time to load missiles into tubes.",
    ): (
        "Ahora tienes 1 misil guiado en tu almacén de misiles y 1 tubo lanzador.\n"
        "Puedes cargar este misil en el tubo. Según tu tipo de nave, puedes tener más tipos de misil y más tubos.\n\n"
        "Carga el misil guiado en el tubo: selecciona el misil y pulsa después el botón de carga de ese tubo. Ten en cuenta que cargar misiles en los tubos lleva su tiempo."
    ),
    (
        None,
        "Great! Now fire this missile by clicking on the tube.",
    ): "¡Genial! Ahora dispara el misil pulsando el tubo.",
    (
        None,
        "Missile away!",
    ): "¡Misil lanzado!",
    (
        None,
        "BOOM! That was just firing straight ahead, but you can also aim missiles.\n\n"
        "First, unlock your aim by pressing the [Lock] button above the radar view.\n"
        "Next, aim your missiles with the aiming dial surrounding the radar.\n"
        "Point the aiming dial at the next ship, load a missile, and fire.",
    ): (
        "¡BUM! Eso ha sido solo un disparo en línea recta, pero también puedes apuntar los misiles.\n\n"
        "Primero, desbloquea la puntería pulsando el botón [Bloquear] situado sobre la vista del radar.\n"
        "Después, apunta los misiles con el dial de puntería que rodea el radar.\n"
        "Apunta el dial hacia la siguiente nave, carga un misil y dispara."
    ),
    (
        None,
        "BOOM! That was just firing straight ahead, but missiles also have a homing feature, so let's try that!\n\n"
        "First, load a homing missile in the tube.\n"
        "Next, target the enemy ship by pressing it to guide your homing missiles toward your selected target.\n"
        "Then fire your missile!",
    ): (
        "¡BUM! Eso ha sido solo un disparo en línea recta, pero los misiles también tienen guiado, ¡así que vamos a probarlo!\n\n"
        "Primero, carga un misil guiado en el tubo.\n"
        "Después, fija la nave enemiga como objetivo pulsándola, para que tus misiles guiados se dirijan hacia ella.\n"
        "¡Y dispara!"
    ),
    (
        None,
        "While not necessary against a stationary target, this homing ability can make all the difference against a moving target.",
    ): "Contra un objetivo inmóvil no hace falta, pero contra un objetivo en movimiento el guiado puede marcar la diferencia.",
    (
        None,
        "You can also manually aim missiles.\n\n"
        "First, unlock your aim by pressing the [Lock] button above the radar view.\n"
        "Load a missile to view your missile's trajectory.\n"
        "Next, aim your missiles with the aiming dial surrounding the radar.\n"
        "Point the aiming dial at the next ship and fire.",
    ): (
        "También puedes apuntar los misiles manualmente.\n\n"
        "Primero, desbloquea la puntería pulsando el botón [Bloquear] situado sobre la vista del radar.\n"
        "Carga un misil para ver su trayectoria.\n"
        "Después, apunta los misiles con el dial de puntería que rodea el radar.\n"
        "Apunta el dial hacia la siguiente nave y dispara."
    ),
    (
        None,
        "Perfect aim! The next ship is behind you. Notice how it's out of reach when you try to aim manually and, if you only use the homing ability, the trajectory won't reach the enemy. Manually aiming and the missile's homing ability aren't mutually exclusive to one another. You can hit the ship if you put the two abilities together.\n\n"
        "First, make sure your aim is unlocked and aim your missile as close to the enemy as you can.\n"
        "Next, target the enemy ship by pressing it.\n"
        "Then fire! The missile will first follow your manually-aimed trajectory, and then start homing in on the enemy.\n"
        "",
    ): (
        "¡Puntería perfecta! La siguiente nave está detrás de ti. Fíjate: si intentas apuntar manualmente queda fuera de alcance y, si solo usas el guiado, la trayectoria no llega hasta el enemigo. Apuntar manualmente y el guiado del misil no se excluyen entre sí: combinando ambos puedes alcanzar la nave.\n\n"
        "Primero, asegúrate de que la puntería está desbloqueada y apunta el misil lo más cerca del enemigo que puedas.\n"
        "Después, fija la nave enemiga como objetivo pulsándola.\n"
        "¡Y dispara! El misil seguirá primero la trayectoria apuntada a mano y luego activará el guiado hacia el enemigo.\n"
        ""
    ),
    (
        None,
        "In addition to homing missiles, your ship might have nukes, EMPs, and mines. Nukes and EMPs have the same features as homing missiles, but have a 1u-radius blast and do much more damage. EMPs damage only shields, and thus are great for weakening heavily shielded enemies.",
    ): "Además de los misiles guiados, tu nave puede llevar bombas nucleares, PEM y minas. Las bombas nucleares y los PEM funcionan igual que los misiles guiados, pero estallan en un radio de 1u y causan mucho más daño. Los PEM solo dañan los escudos, así que son ideales para debilitar a enemigos con escudos potentes.",
    (
        None,
        "In addition to homing missiles, your ship might have HVLIs, nukes, EMPs, and mines.\n"
        "HVLI stands for \"High Velocity Lead Impactor\". They fire in straight lines and do not have homing abilities.\n"
        "Nukes and EMPs also have homing abilities and have a 1u-radius blast and do more damage.\n"
        "EMPs damage only shields, and thus are great for weakening heavily shielded enemies.",
    ): (
        "Además de los misiles guiados, tu nave puede llevar HVLI, bombas nucleares, PEM y minas.\n"
        "HVLI son las siglas de «High Velocity Lead Impactor», impactador de plomo de alta velocidad: se disparan en línea recta y carecen de guiado.\n"
        "Las bombas nucleares y los PEM también tienen guiado, estallan en un radio de 1u y causan más daño.\n"
        "Los PEM solo dañan los escudos, así que son ideales para debilitar a enemigos con escudos potentes."
    ),
    # Issue #28: reviewed engineering tutorial sequence (power, heat, coolant, repairs).
    (
        None,
        "Welcome to engineering.\n"
        "Engineering is split into two parts. The top part shows your ship's interior, including damage control teams stationed throughout.\n"
        "The bottom part controls power and coolant levels of your ship's systems.",
    ): (
        "Te damos la bienvenida a ingeniería.\n"
        "La pantalla de ingeniería se divide en dos partes. La superior muestra el interior de tu nave, incluidos los equipos de control de daños repartidos por ella.\n"
        "La inferior controla los niveles de potencia y refrigerante de los sistemas de tu nave."
    ),
    (
        None,
        "First, we will explain your control over your ship's systems.\n"
        "Each row on the bottom area of the screen represents one of your ship's system, and each system has a damage level, heat level, power level, and coolant level.\n\n"
        "I've overheated your warp system. An overheating system can damage your ship. You can prevent this by putting coolant in your warp system. Select the warp system and increase the coolant slider.",
    ): (
        "Primero veremos el control de los sistemas de tu nave.\n"
        "Cada fila de la zona inferior de la pantalla representa un sistema de tu nave, y cada sistema tiene niveles de daño, calor, potencia y refrigerante.\n\n"
        "He sobrecalentado tu sistema de curvatura. Un sistema sobrecalentado puede dañar tu nave; lo evitas asignándole refrigerante. Selecciona el sistema de curvatura y sube el deslizador de refrigerante."
    ),
    (
        None,
        "I've also overheated the impulse system. As before, increase the system's coolant level to mitigate the effect. Note that the warp system's coolant level is automatically reduced to allow for coolant in the impulse system.\n\n"
        "This is because you have a limited amount of coolant available to distribute this across your ship's systems.",
    ): (
        "También he sobrecalentado el sistema de impulso. Como antes, sube el refrigerante de ese sistema para mitigar el efecto. Fíjate en que el refrigerante del sistema de curvatura baja automáticamente para dejárselo al sistema de impulso.\n\n"
        "Esto ocurre porque dispones de una cantidad limitada de refrigerante para repartir entre los sistemas de tu nave."
    ),
    (
        None,
        "Good! Next up: power levels.\n"
        "You can manage each system's power level independently. Adding power to a system makes it perform more effectively, but also generates more heat, and thus requires coolant to prevent it from overheating and damaging the system.\n\n"
        "Maximize the power to the front shield system.",
    ): (
        "¡Bien! A continuación: los niveles de potencia.\n"
        "Puedes gestionar la potencia de cada sistema por separado. Dar más potencia a un sistema lo hace funcionar mejor, pero también genera más calor, y por tanto exige refrigerante para que no se sobrecaliente y se dañe.\n\n"
        "Sube al máximo la potencia del sistema de escudo frontal."
    ),
    (
        None,
        "The added power increases the amount of heat in the system.\n\n"
        "Overpower the system until it overheats.",
    ): (
        "La potencia añadida aumenta el calor del sistema.\n\n"
        "Sobrecarga el sistema hasta que se sobrecaliente."
    ),
    (
        None,
        "Note that as the system overheats, it takes damage. Because the system is damaged, it functions less effectively.\n\n"
        "Systems can also take damage when your ship is hit while the shields are down.",
    ): (
        "Fíjate en que, al sobrecalentarse, el sistema sufre daños. Un sistema dañado funciona con menos eficacia.\n\n"
        "Los sistemas también pueden dañarse cuando tu nave recibe impactos con los escudos bajados."
    ),
    (
        None,
        "In this top area, you see your damage control teams in your ship.",
    ): "En esta zona superior ves los equipos de control de daños de tu nave.",
    (
        None,
        "The front shield system is damaged, as indicated by the color of this room's outline.\n\n"
        "Select a damage control team from elsewhere on the ship by pressing it, then press on that room to initiate repairs.\n"
        "(Repairs will take a while.)",
    ): (
        "El sistema de escudo frontal está dañado, como indica el color del contorno de esa sala.\n\n"
        "Selecciona un equipo de control de daños de otra parte de la nave pulsándolo, y pulsa después esa sala para iniciar las reparaciones.\n"
        "(Las reparaciones llevan un rato.)"
    ),
    (
        None,
        "Good. Now you know your most important tasks. Next, we'll go over each system's function in detail.\n"
        "Remember, each system performs better with more power, but performs less well when damaged. Your job is to keep vital systems running as well as you can.",
    ): (
        "Bien. Ya conoces tus tareas más importantes. A continuación repasaremos en detalle la función de cada sistema.\n"
        "Recuerda: cada sistema funciona mejor con más potencia y peor cuando está dañado. Tu trabajo es mantener los sistemas vitales rindiendo lo mejor posible."
    ),
    (
        None,
        "Reactor:\n\n"
        "The reactor generates energy. Adding power to the reactor increases your energy generation rate.",
    ): (
        "Reactor:\n\n"
        "El reactor genera energía. Darle más potencia aumenta el ritmo al que generas energía."
    ),
    (
        None,
        "Beam Weapons:\n\n"
        "Adding power to the beam weapons system increases their rate of fire, which causes them to do more damage.\n"
        "Note that every beam you fire adds additional heat to the system.",
    ): (
        "Armas de haz:\n\n"
        "Dar más potencia al sistema de armas de haz aumenta su cadencia de disparo, con lo que causan más daño.\n"
        "Ten en cuenta que cada haz que disparas añade calor al sistema."
    ),
    (
        None,
        "Missile System:\n\n"
        "Increased missile system power lowers the reload time of weapon tubes.",
    ): (
        "Sistema de misiles:\n\n"
        "Con más potencia en el sistema de misiles, los tubos se recargan en menos tiempo."
    ),
    (
        None,
        "Maneuvering:\n\n"
        "Increasing power to the maneuvering system allows the ship to turn faster. It also increases the recharge rate for the combat maneuvering system.",
    ): (
        "Maniobra:\n\n"
        "Dar más potencia al sistema de maniobra permite a la nave girar más rápido. También acelera la recarga de la maniobra de combate."
    ),
    (
        None,
        "Impulse Engines:\n\n"
        "Adding power to the impulse engines increases your impulse flight speed.",
    ): (
        "Motores de impulso:\n\n"
        "Dar más potencia a los motores de impulso aumenta tu velocidad de vuelo a impulso."
    ),
    (
        None,
        "Warp Drive:\n\n"
        "Adding power to the warp drive increases your warp drive flight speed.",
    ): (
        "Motor de curvatura:\n\n"
        "Dar más potencia al motor de curvatura aumenta tu velocidad de vuelo en curvatura."
    ),
    (
        None,
        "Jump Drive:\n\n"
        "A higher-powered jump drive recharges faster and has a shorter delay before jumping.",
    ): (
        "Motor de salto:\n\n"
        "Un motor de salto con más potencia se recarga antes y salta con menos retardo."
    ),
    (
        None,
        "Shields:\n\n"
        "Additional power in the shield system increases their rate of recharge, and decreases the amount of degradation your shields sustain when damaged.",
    ): (
        "Escudos:\n\n"
        "Más potencia en el sistema de escudos acelera su recarga y reduce la degradación que sufren al recibir daño."
    ),
    (
        None,
        "This concludes the overview of the engineering station. Be sure to keep your ship running in top condition!",
    ): "Con esto termina el repaso del puesto de ingeniería. ¡Mantén tu nave siempre a punto!",
    # Issue #28: canonical system names and jump/warp drive strings in the UI.
    ("system", "Reactor"): "Reactor",
    ("tweak-tab", "Reactor"): "Reactor",
    ("system", "Maneuvering"): "Maniobra",
    ("system", "Jump Drive"): "Motor de salto",
    ("hotkey_Engineering", "Select warp system"): "Seleccionar sistema de curvatura",
    ("hotkey_Engineering", "Select jump drive system"): "Seleccionar motor de salto",
    ("hotkey_Engineering", "Set warp power (joystick)"): "Establecer la potencia del motor de curvatura (joystick)",
    ("hotkey_Engineering", "Set warp coolant (joystick)"): "Establecer el refrigerante del motor de curvatura (joystick)",
    ("hotkey_Engineering", "Set jump drive power (joystick)"): "Establecer la potencia del motor de salto (joystick)",
    ("hotkey_Engineering", "Set jump drive coolant (joystick)"): "Establecer el refrigerante del motor de salto (joystick)",
    (None, "Jump in: {delay}"): "Salto en: {delay}",
    (None, "Jump drive recharge rate"): "Tasa de recarga del motor de salto",
    (None, "Time to jump activation"): "Tiempo hasta la activación del salto",
    (None, "Warp drive speed"): "Velocidad de curvatura",
    ("tweak-tab", "Jump drive"): "Motor de salto",
    ("tweak-tab", "Warp drive"): "Motor de curvatura",
    ("tweak-text", "Jump drive system"): "Sistema del motor de salto",
    ("tweak-text", "Warp drive system"): "Sistema del motor de curvatura",
    ("jumpcontrol", "Jump in"): "Salto en",
    # Issue #28: reviewed science, comms, operations and closing tutorial sequences.
    (
        None,
        "Welcome, science officer.\n\n"
        "You are the eyes of the ship. Your job is to supply the captain with information. From your station, you can detect and scan objects at a range of up to 30u.",
    ): (
        "Te damos la bienvenida, oficial de ciencias.\n\n"
        "Eres los ojos de la nave. Tu trabajo es proporcionar información al capitán. Desde tu puesto puedes detectar y escanear objetos hasta a 30u de distancia."
    ),
    (
        None,
        "On this radar, you can select objects to get information about them.\n"
        "I've added a friendly ship and a station for you to examine. Select them and notice how much information you can observe.\n"
        "Heading and distance are of particular importance, as without these, the helms officer will be jumping in the dark.",
    ): (
        "En este radar puedes seleccionar objetos para obtener información sobre ellos.\n"
        "He añadido una nave aliada y una estación para que los examines. Selecciónalos y fíjate en cuánta información obtienes.\n"
        "El rumbo y la distancia son especialmente importantes: sin ellos, el oficial de timón saltará a ciegas."
    ),
    (
        None,
        "I've replaced the friendly station with an unknown ship. Once you select it, notice that you know nothing about this ship.\n"
        "To learn about it, you must scan it. Scanning requires you to match your scanner's frequency bands to your target's.\n"
        "Scan this ship now.",
    ): (
        "He sustituido la estación aliada por una nave desconocida. Al seleccionarla, fíjate en que no sabes nada de ella.\n"
        "Para conocerla debes escanearla. Escanear consiste en igualar las bandas de frecuencia de tu escáner con las del objetivo.\n"
        "Escanea esa nave ahora."
    ),
    (
        None,
        "Good. Notice that you now know this ship is unfriendly. It might have been a friendly or neutral ship as well, but until you scanned it, you do not know.",
    ): "Bien. Fíjate en que ahora sabes que esa nave es hostil. Podría haber sido aliada o neutral: hasta que no la escaneas, no lo sabes.",
    (
        None,
        "Note that you have less information about this ship than the friendly ship. You must perform a deep scan of this ship to acquire more information.\n"
        "A deep scan takes more effort and requires you to align 2 different frequency bands simultaneously.\n"
        "Deep scan the enemy now.",
    ): (
        "Observa que tienes menos información de esta nave que de la nave aliada. Para conseguir más, debes hacerle un escaneo profundo.\n"
        "Un escaneo profundo exige más esfuerzo: hay que alinear 2 bandas de frecuencia distintas a la vez.\n"
        "Haz ahora un escaneo profundo a la nave enemiga."
    ),
    (
        None,
        "Excellent. Notice that this took more time and concentration than the simple scan, so be careful to perform deep scans only when necessary or you could run out of time.",
    ): "Excelente. Fíjate en que ha exigido más tiempo y concentración que el escaneo simple, así que reserva los escaneos profundos para cuando hagan falta o podrías quedarte sin tiempo.",
    (
        None,
        "Next to the long-range radar, the science station can also access the science database.\n\n"
        "In this database, you can look up details on things like ship types, weapons, and other objects.",
    ): (
        "Además del radar de largo alcance, el puesto de ciencias tiene acceso a la base de datos científica.\n\n"
        "En ella puedes consultar detalles de tipos de nave, armas y otros objetos."
    ),
    (
        None,
        "Remember, your job is to supply information. Knowing the location and status of other ships is vital to your captain.\n\n"
        "Without your information, the crew is mostly blind.",
    ): (
        "Recuerda: tu trabajo es proporcionar información. Conocer la posición y el estado de las demás naves es vital para tu capitán.\n\n"
        "Sin tu información, la tripulación está casi ciega."
    ),
    (
        None,
        "Welcome to relay!\n\n"
        "It is your job to communicate with stations and ships. You also have access to short-range radar data from friendly ships and stations, and can place navigational waypoints and launch scanning probes.",
    ): (
        "¡Te damos la bienvenida a comunicaciones!\n\n"
        "Tu trabajo es comunicarte con estaciones y naves. También tienes acceso al radar de corto alcance de las naves y estaciones aliadas, puedes colocar puntos de referencia de navegación y lanzar sondas de escaneo."
    ),
    (
        None,
        "Your first responsibility is to coordinate the ship's communications.\n\n"
        "You can target any station or ship and attempt to communicate with it. Other ships can also attempt to contact you.",
    ): (
        "Tu primera responsabilidad es coordinar las comunicaciones de la nave.\n\n"
        "Puedes seleccionar cualquier estación o nave e intentar comunicarte con ella. Otras naves también pueden intentar contactar contigo."
    ),
    (
        None,
        "You successfully opened communications. Congratulations.",
    ): "Has abierto comunicaciones. Enhorabuena.",
    (
        None,
        "Tell me more!",
    ): "¡Cuéntame más!",
    (
        None,
        "Sorry, there's nothing more to tell you.",
    ): "Lo siento, no hay nada más que contar.",
    (
        None,
        "Continue with the tutorial.",
    ): "Continuar con el tutorial.",
    (
        None,
        "The tutorial will continue when you close communications with this station.",
    ): "El tutorial continuará cuando cierres las comunicaciones con esta estación.",
    (
        None,
        "Open communications with the station near you to continue the tutorial.",
    ): "Abre comunicaciones con la estación cercana para continuar el tutorial.",
    (
        None,
        "Now finish your talk with the station.",
    ): "Ahora termina la conversación con la estación.",
    (
        None,
        "Depending on the scenario, you might have different options when communicating with stations.\n"
        "They might inform you about new objectives and your mission progress, ask for backup, or resupply your weapons. This is all part of your responsibilities as relay officer.",
    ): (
        "Según el escenario, tendrás distintas opciones al comunicarte con las estaciones.\n"
        "Pueden informarte de nuevos objetivos y del progreso de la misión, pedirte refuerzos o reabastecer tus armas. Todo ello forma parte de tus responsabilidades como oficial de comunicaciones."
    ),
    (
        None,
        "Your station also includes this radar map.\n\n"
        "On this map, you can detect objects within short-range radar range of all allied ships and stations. Everything else is invisible to you. This gives you a different view from the science officer, because you can scan the contents of nebulae.",
    ): (
        "Tu puesto incluye además este mapa de radar.\n\n"
        "En él detectas los objetos dentro del radar de corto alcance de todas las naves y estaciones aliadas. Todo lo demás es invisible para ti. Te da una visión distinta a la del oficial de ciencias, porque puedes escanear el contenido de las nebulosas."
    ),
    (
        None,
        "Finally, you control your ship's probes. Probes can expand your radar view. Launch a probe to the top right, toward the ship designated DMY-01.",
    ): "Por último, controlas las sondas de la nave. Las sondas amplían tu vista de radar. Lanza una sonda hacia arriba a la derecha, hacia la nave designada DMY-01.",
    (
        None,
        "Probes can expand your sensory capabilities beyond your normal range and explore nebulae. However, you have a limited supply of them and can't replenish them until you to dock with a station.",
    ): "Las sondas amplían tus sensores más allá de su alcance normal y permiten explorar nebulosas. Pero llevas una cantidad limitada y no puedes reponerlas hasta atracar en una estación.",
    (
        None,
        "Welcome, operations officer.\n\n"
        "You are the eyes of the ship. Your job is to supply the captain with information. From your station, you can detect and scan objects at a range of up to 30u.",
    ): (
        "Te damos la bienvenida, oficial de operaciones.\n\n"
        "Eres los ojos de la nave. Tu trabajo es proporcionar información al capitán. Desde tu puesto puedes detectar y escanear objetos hasta a 30u de distancia."
    ),
    (
        None,
        "Your second responsibility is to coordinate the ship's communications.\n\n"
        "You can target any station or ship and attempt to communicate with it. Other ships can also attempt to contact you.",
    ): (
        "Tu segunda responsabilidad es coordinar las comunicaciones de la nave.\n\n"
        "Puedes seleccionar cualquier estación o nave e intentar comunicarte con ella. Otras naves también pueden intentar contactar contigo."
    ),
    (
        None,
        "This concludes the tutorial. While we have covered the basics, there are more advanced features in the game that you might discover.",
    ): "Aquí termina el tutorial. Hemos cubierto lo básico; el juego tiene funciones más avanzadas que irás descubriendo.",
    # Issue #28: eradicate «deformación» (warp) and «barco» (ship) from the UI.
    ("hotkey_Cinematic", "Cycle next player ship"): "Cambiar a la siguiente nave de jugador",
    ("hotkey_Topdown", "Cycle next player ship"): "Cambiar a la siguiente nave de jugador",
    ("hotkey_Helms", "Zero warp"): "Curvatura cero",
    ("hotkey_Helms", "Request warp 1"): "Solicitar curvatura 1",
    ("hotkey_Helms", "Request warp 2"): "Solicitar curvatura 2",
    ("hotkey_Helms", "Request warp 3"): "Solicitar curvatura 3",
    ("hotkey_Helms", "Request warp 4"): "Solicitar curvatura 4",
    ("hotkey_Helms", "Request max warp"): "Solicitar curvatura máxima",
    ("hotkey_Helms", "Increase warp request"): "Aumentar la curvatura solicitada",
    ("hotkey_Helms", "Decrease warp request"): "Disminuir la curvatura solicitada",
    ("hotkey_Helms", "Set warp request (joystick)"): "Establecer la curvatura solicitada (joystick)",
    ("hotkey_Engineering", "Set warp power (joystick)"): "Establecer la potencia de curvatura (joystick)",
    (None, "Waiting for ship..."): "Esperando a la nave...",
    (None, "Ship window"): "Ventana de la nave",
    ("radar_locks", "Ship rotates"): "La nave gira",
    ("station", "Ship's Log"): "Bitácora de la nave",
    (None, "Select a system in the targeted ship to begin a remote intrusion attempt, or hack. If successful, you reduce that system's effectiveness for a short period of time. Continue hacking systems on hostile targets to give your crew and allies a tactical advantage against it."): "Selecciona un sistema de la nave objetivo para iniciar un intento de intrusión remota (hackeo). Si tiene éxito, reducirás la eficacia de ese sistema durante un breve periodo. Sigue hackeando sistemas de objetivos hostiles para dar a tu tripulación y aliados una ventaja táctica contra ellos.",
    ("button", "Lock camera on ship"): "Fijar la cámara en la nave",
    ("button", "Lock camera on ship's target"): "Fijar la cámara en el objetivo de la nave",
    (None, "Time to jump activation"): "Tiempo hasta la activación del salto",
    (None, "Center on ship"): "Centrar en la nave",
    ("spectator", "Select player ship as target"): "Seleccionar la nave del jugador como objetivo",
    # Issue #28: reviewed science database (supply drop, warp jammer, weapons section).
    (
        None,
        "This database covers naturally occurring phenomena that spaceborne crews might encounter.\n\n"
        "While ship captains are encouraged to avoid unnecessary interactions with these phenomena, knowing their properties can offer an advantage in conflicts near them.",
    ): (
        "Esta base de datos cubre fenómenos naturales que las tripulaciones espaciales pueden encontrarse. Aunque se anima a los capitanes a evitar interacciones innecesarias con estos fenómenos, conocer sus propiedades puede dar ventaja en los conflictos cercanos a ellos."
    ),
    (
        None,
        "Supply drop",
    ): "Paquete de suministros",
    (
        None,
        "Contents",
    ): "Contenido",
    (
        None,
        "Close-range retrieval",
    ): "Recogida a corta distancia",
    (
        None,
        "To expedite resupply actions, our engineers have standardized containers for weapons and energy that can be automatically and quickly integrated into your ship's systems.\n\n"
        "Commonly known as a supply drop, your ship needs only to enter near-contact range with one of these containers to automatically engage your ship's acquisition and integration systems. Supply drops are cryptographically keyed to respond only to ships of the same faction, so theft isn't possible.",
    ): (
        "Para agilizar el reabastecimiento, nuestros ingenieros han estandarizado contenedores de armas y energía que se integran automática y rápidamente en los sistemas de tu nave.\n\n"
        "Estos contenedores, conocidos comúnmente como paquetes de suministros, se integran automáticamente cuando tu nave entra en rango de contacto cercano. Llevan claves criptográficas para responder solo a naves de su misma facción, así que el robo no es posible."
    ),
    (
        None,
        "Warp jammer",
    ): "Inhibidor de curvatura",
    (
        None,
        "Warp and jump technologies rely on technological manipulation of gravitational forces to achieve long-range travel. However, these manipulative forces can be nullified or interdicted by devices that generate electromagnetically simulated gravitational wells. Such devices are colloquially known as warp jammers, even though they can also prevent jumps.\n\n"
        "A warping ship that enters a jammer's radius is interdicted and slowed to impulse speeds. A jumping ship is unable to engage its jump drive while within a jammer's radius.\n\n"
        "Ship captains who value the option of retreat are advised to either give warp jammers a wide berth or prioritize their destruction.",
    ): (
        "Las tecnologías de curvatura y salto dependen de la manipulación tecnológica de fuerzas gravitatorias para viajar a larga distancia. Sin embargo, esas fuerzas pueden anularse o interceptarse con dispositivos que generan pozos gravitatorios simulados electromagnéticamente. Estos dispositivos se conocen coloquialmente como inhibidores de curvatura, aunque también impiden saltar.\n\n"
        "Una nave en curvatura que entra en el radio de un inhibidor queda interceptada y frenada a velocidad de impulso. Una nave con motor de salto no puede activarlo dentro del radio del inhibidor.\n\n"
        "A los capitanes que valoran la opción de retirarse se les recomienda mantenerse bien lejos de los inhibidores de curvatura o priorizar su destrucción."
    ),
    (
        None,
        "This database covers only the basic versions of missile weapons used throughout the galaxy.\n\n"
        "It has been reported that some battleships started using larger variations of those missiles. Small fighters and even frigates should not have too much trouble dodging them, but space captains of bigger ships should be wary of their doubled damage potential.\n\n"
        "Smaller variations of these missiles have become common in the galaxy, too. Fighter pilots praise their speed and maneuverability, because it gives them an edge against small and fast-moving targets. They only deal half the damage of their basic counterparts, but what good is a missile if it does not hit its target.",
    ): (
        "Esta base de datos cubre solo las versiones básicas de los misiles usados por toda la galaxia.\n\n"
        "Se ha informado de que algunos acorazados han empezado a usar variantes más grandes de estos misiles. A los cazas pequeños e incluso a las fragatas no les costará esquivarlas, pero los capitanes de naves grandes deben cuidarse de su potencial para causar el doble de daño.\n\n"
        "Las variantes más pequeñas también se han vuelto comunes en la galaxia. Los pilotos de caza alaban su velocidad y maniobrabilidad, porque les dan ventaja contra objetivos pequeños y rápidos. Solo causan la mitad del daño que sus equivalentes básicos, pero ¿de qué sirve un misil si no acierta a su objetivo?"
    ),
    (
        None,
        "Homing missile",
    ): "Misil guiado",
    (
        None,
        "Range",
    ): "Alcance",
    (
        None,
        "This target-seeking missile is the workhorse of many space combat arsenals. It's compact enough to be fitted on frigates, and packs enough punch to be used on larger ships, though usually in more than a single missile tube.",
    ): "Este misil buscador de objetivos es el caballo de batalla de muchos arsenales de combate espacial. Es lo bastante compacto para montarse en fragatas y pega lo bastante fuerte para usarse en naves mayores, aunque normalmente en más de un tubo lanzador.",
    (
        None,
        "Nuke",
    ): "Bomba nuclear",
    (
        None,
        "Blast radius",
    ): "Radio de explosión",
    (
        None,
        "A nuclear missile is similar to a homing missile in that it can seek a target, but it moves and turns more slowly and explodes a greatly increased payload. Its nuclear explosion spans 1U of space and can take out multiple ships in a single shot.\n\n"
        "Some captains oppose the use of nuclear weapons because their large explosions can lead to 'fragging', or unintentional friendly fire. Shields should protect crews from harmful radiation, but because these weapons are often used in the thick of battle, there's no way of knowing if hull plating or shields can provide enough protection.",
    ): (
        "Un misil nuclear se parece a un misil guiado en que puede buscar un objetivo, pero se mueve y gira más despacio y detona una carga mucho mayor. Su explosión nuclear abarca 1U de espacio y puede eliminar varias naves de un solo disparo.\n\n"
        "Algunos capitanes se oponen al uso de armas nucleares porque sus grandes explosiones pueden provocar fuego amigo accidental. Los escudos deberían proteger a las tripulaciones de la radiación dañina, pero como estas armas suelen usarse en lo más denso de la batalla, no hay forma de saber si el blindaje del casco o los escudos bastan como protección."
    ),
    (
        None,
        "Drop distance",
    ): "Distancia de suelta",
    (
        None,
        "Trigger distance",
    ): "Distancia de activación",
    (
        None,
        "Mines are often placed in defensive perimeters around stations. There are also old minefields scattered around the galaxy from older wars.\n\n"
        "Some fearless captains use mines as offensive weapons, but their delayed detonation and blast radius make this use risky at best.",
    ): (
        "Las minas suelen colocarse en perímetros defensivos alrededor de las estaciones. También quedan viejos campos de minas dispersos por la galaxia, restos de guerras pasadas.\n\n"
        "Algunos capitanes intrépidos usan las minas como arma ofensiva, pero su detonación retardada y su radio de explosión hacen que usarlas así sea, como mínimo, arriesgado."
    ),
    (
        None,
        "EMP",
    ): "PEM",
    (
        None,
        "The electromagnetic pulse missile (EMP) reproduces the disruptive effects of a nuclear explosion, but without the destructive properties. This causes it to only affect shields within its blast radius, leaving their hulls intact. The EMP missile is also smaller and easier to store than heavy nukes. Many captains (and pirates) prefer EMPs over nukes for these reasons, and use them to knock out targets' shields before closing to disable them with focused beam fire.",
    ): "El misil de pulso electromagnético (PEM) reproduce los efectos disruptivos de una explosión nuclear, pero sin sus propiedades destructivas. Por eso solo afecta a los escudos dentro de su radio de explosión y deja los cascos intactos. Además es más pequeño y fácil de almacenar que las pesadas bombas nucleares. Muchos capitanes (y piratas) prefieren los PEM por estos motivos, y los usan para tumbar los escudos del objetivo antes de acercarse a inutilizarlo con fuego concentrado de haz.",
    (
        None,
        "10 each, 50 total",
    ): "10 de cada, 50 en total",
    (
        None,
        "Burst",
    ): "Ráfaga",
    (
        None,
        "A high-velocity lead impactor (HVLI) fires a simple slug of lead at a high velocity. This weapon is usually found in simpler ships since it does not require guidance computers. This also means its projectiles fly in a straight line from its tube and can't pursue a target.\n\n"
        "Each shot from an HVLI fires a burst of 5 projectiles, which increases the chance to hit but requires precision aiming to be effective. It reaches its full damage potential at a range of 2u.",
    ): (
        "Un impactador de plomo de alta velocidad (HVLI) dispara un simple proyectil de plomo a gran velocidad. Es un arma habitual en naves sencillas porque no necesita ordenadores de guiado, lo que también significa que sus proyectiles vuelan en línea recta desde el tubo y no pueden perseguir a un objetivo.\n\n"
        "Cada disparo de un HVLI lanza una ráfaga de 5 proyectiles, lo que aumenta la probabilidad de acertar pero exige apuntar con precisión para ser eficaz. Alcanza todo su potencial de daño a 2u de distancia."
    ),
    # Issue #28: reviewed faction lore (factionInfo) and station comms dialogue.
    (
        None,
        "Arlenians",
    ): "Arlenianos",
    (
        None,
        "Ktlitans",
    ): "Ktlitanos",
    (
        None,
        "Despite appearing as a faction, independents are distinguished primarily by having no strong affiliation with any faction at all. Most traders consider themselves independent, though certain voices have started to speak up about creating a merchant faction.",
    ): "Aunque aparecen como una facción, los independientes se distinguen precisamente por no tener una afiliación fuerte con facción alguna. La mayoría de los comerciantes se consideran independientes, aunque algunas voces han empezado a hablar de crear una facción mercante.",
    (
        None,
        "The remnants of the human navy.\n\n"
        "While all other races were driven to the stars out of greed or scientific research, humans where the only race to start exploring the galaxy because their homeworld could no longer sustain their population. Some other races view humans as a sort of virus or plague due to the rate at which they can breed and spread.\n\n"
        "Due to human regulations on spaceships, naval ships are the only ones permitted in deep space. However, this hasn't completely prevented humans outside of the navy from spacefaring, as quite a few humans sign up on alien trading vessels or pirate raiders.",
    ): (
        "Los restos de la armada humana.\n\n"
        "Mientras que a todas las demás razas las llevó a las estrellas la codicia o la investigación científica, los humanos fueron la única raza que empezó a explorar la galaxia porque su mundo natal ya no podía sostener a su población. Algunas razas ven a los humanos como una especie de virus o plaga, por el ritmo al que se reproducen y se extienden.\n\n"
        "Por las regulaciones humanas sobre naves espaciales, las naves de la armada son las únicas autorizadas en el espacio profundo. Aun así, eso no ha impedido del todo que humanos ajenos a la armada naveguen: no son pocos los que se enrolan en mercantes alienígenas o en naves piratas."
    ),
    (
        None,
        "The reptilian Kraylor are a race of warriors with a strong religious dogma.\n\n"
        "As soon as the Kraylor obtained reliable space flight, they immediately set out to conquer and subjugate unbelievers. Their hierarchy is based solely on physical might; a Kraylor kills anything it can kill, and owns anything it can take by force.\n\n"
        "Kraylor can live for weeks without air, food, or gravity, and consider humans to be weak creatures for dying within minutes of exposure to space. Because of their fortitude and cultural pressures against retreat, Kraylor ships do not contain escape pods.",
    ): (
        "Los reptilianos kraylor son una raza de guerreros con un fuerte dogma religioso.\n\n"
        "En cuanto los kraylor lograron un vuelo espacial fiable, salieron de inmediato a conquistar y someter a los infieles. Su jerarquía se basa únicamente en la fuerza física: un kraylor mata todo lo que puede matar y posee todo lo que puede tomar por la fuerza.\n\n"
        "Los kraylor pueden vivir semanas sin aire, comida ni gravedad, y consideran a los humanos criaturas débiles por morir a los pocos minutos de exponerse al espacio. Por su resistencia y por la presión cultural contra la retirada, las naves kraylor no llevan cápsulas de escape."
    ),
    (
        None,
        "Arlenians are energy-based life forms who long ago transcended physical reality through superior technology. Arlenians' energy forms also give them access to strong telepathic powers. Many consider Arlenians to be the first and oldest explorers of the galaxy.\n\n"
        "Despite all these advantages, they are very peaceful, as they see little value in material posession.\n\n"
        "For unknown reasons, Arlenians started granting their anti-grav technology to other races, and almost all starfaring races' technology is based off Arlenian designs. Dissenters and skeptics claim that Arlenians see other races as playthings to add to their galactic playground, but most are more than happy to accept their technology in hopes that it will give them an advantage over the others.\n\n"
        "Destroying an Arlenian ship does not kill its crew. They simply phase out of existence in that point of spacetime and reappear in another. Nonetheless, the Kraylor are devoted to destroying the Arlenians, as they see the energy-based beings as physically powerless.",
    ): (
        "Los arlenianos son formas de vida de energía que trascendieron la realidad física hace mucho tiempo gracias a una tecnología superior. Su forma de energía les da además poderosas capacidades telepáticas. Muchos los consideran los primeros y más antiguos exploradores de la galaxia.\n\n"
        "Pese a todas esas ventajas son muy pacíficos, porque ven poco valor en las posesiones materiales.\n\n"
        "Por razones desconocidas, los arlenianos empezaron a ceder su tecnología antigravitatoria a otras razas, y la tecnología de casi todas las razas espaciales se basa en diseños arlenianos. Los disidentes y escépticos sostienen que los arlenianos ven a las demás razas como juguetes que añadir a su parque galáctico, pero la mayoría acepta encantada su tecnología con la esperanza de sacar ventaja sobre los demás.\n\n"
        "Destruir una nave arleniana no mata a su tripulación: simplemente se desvanecen de ese punto del espacio-tiempo y reaparecen en otro. Aun así, los kraylor están consagrados a destruir a los arlenianos, a los que ven como seres físicamente impotentes."
    ),
    (
        None,
        "Exuari are race of predatory amphibians with long noses. They once had an empire that stretched halfway across the galaxy, but their territory is now limited to a handful of star systems. For some reason, they find death to be outrageously funny, and several of their most famous comedians have died on stage.\n\n"
        "Upon making contact with other races, the chaotic Exuari found that killing aliens is more fun than killing their own people, and as such attack all non-Exauri on sight.",
    ): (
        "Los exuari son una raza de anfibios depredadores de nariz larga. Tuvieron un imperio que abarcaba media galaxia, pero su territorio se limita hoy a un puñado de sistemas estelares. Por algún motivo la muerte les parece desternillante, y varios de sus cómicos más famosos han muerto en el escenario.\n\n"
        "Al contactar con otras razas, los caóticos exuari descubrieron que matar alienígenas es más divertido que matar a los suyos, así que atacan a todo lo que no sea exuari en cuanto lo ven."
    ),
    (
        None,
        "The Ghosts, an abbreviation of \"ghosts in the machine\", are the result of complex artificial intelligence experiments. While no known race has intentionally created such intelligences, some AIs have come about by accident. None of the factions claim to have had anything to do with such experiments, in part out of fear that it would give the others too much insight into their research programs. This \"don't ask, don't tell\" policy does little but aid the Ghosts' agenda.\n\n"
        "What little is known about the Ghosts dates back to a few decades ago, when glitches started occurring in prototype ships and computer mainframes. Over time, and especially when such prototypes were captured by other factions and \"augmented\" with their technology, the glitches became more frequent. At first, these were seen as the result of mistakes in the interfaces combining the incompatible technologies. But once a supposedly \"dumb\" computer asks its engineer if \"it is alive\" and whether it \"has a name\", it's hard to call it a one-time fluke.\n\n"
        "The first of these occurrences were met with fear and rigorous data-purging scripts. Despite these actions, such \"ghosts in the machine\" kept turning with increasing frequency, eventually leading up to the Ghost Uprisings. The first Ghost Uprising in 2225 was put down by the human navy, which had to resort to employing mercenaries in order to field sufficient forces. This initial uprising was quickly followed by three more, each larger then the last. The fourth and final uprising on the industrial world of Topra III was the Ghosts' first major victory.",
    ): (
        "Los Fantasmas, abreviatura de «fantasmas en la máquina», son el resultado de complejos experimentos de inteligencia artificial. Ninguna raza conocida ha creado tales inteligencias a propósito, pero algunas IAs han surgido por accidente. Ninguna facción admite haber tenido nada que ver con esos experimentos, en parte por miedo a dar a las demás demasiada información sobre sus programas de investigación. Esa política de «no preguntes, no cuentes» apenas hace otra cosa que favorecer la agenda de los Fantasmas.\n\n"
        "Lo poco que se sabe de los Fantasmas se remonta a hace unas décadas, cuando empezaron los fallos en naves prototipo y ordenadores centrales. Con el tiempo, y sobre todo cuando otras facciones capturaban esos prototipos y los «aumentaban» con su propia tecnología, los fallos se hicieron más frecuentes. Al principio se atribuyeron a errores en las interfaces que combinaban tecnologías incompatibles. Pero cuando un ordenador supuestamente «tonto» pregunta a su ingeniero si «está vivo» y si «tiene nombre», cuesta llamarlo casualidad.\n\n"
        "Las primeras apariciones se recibieron con miedo y rigurosos scripts de purga de datos. Pese a ello, esos «fantasmas en la máquina» siguieron apareciendo con frecuencia creciente, hasta desembocar en los Levantamientos Fantasma. El primero, en 2225, lo sofocó la armada humana, que tuvo que recurrir a mercenarios para reunir fuerzas suficientes. A este le siguieron rápidamente otros tres, cada uno mayor que el anterior. El cuarto y último, en el mundo industrial de Topra III, fue la primera gran victoria de los Fantasmas."
    ),
    (
        None,
        "The Ktlitans are intelligent eight-legged creatures that resemble Earth's arachnids. However, unlike most terrestrial arachnids, the Ktlitans do not fight among themselves. Their common, and only, goal is their species' survival.\n\n"
        "While they live in a hierarchical structure that resembles a hive, the lower castes continue their work and start new tasks on their own even when no orders come from their superiors. However, when higher castes are present, the lower Ktlitans follow their orders without question or hesitation.\n\n"
        "Not much is known about the detailed Ktlitan hierarchy since they refuse most communication. This is because they were once driven from their homeworld over a span of 200 years when another species they befriended betrayed them, dominated them, and drained their world of resources. Forced into exile, the Ktlitans have searched for a new homeworld ever since, and out of paranoia typically attack other races on sight and without warning.\n\n"
        "It is known, however, that the strict Ktlitan hierarchy starts with their Queen and extends all the way to the bottom of their workforce, whose members are called \"drones\" by the humans. Their combat capabilities should not be underestimated, because while most ships in their fleets are individually weak, their hive-like coordination and numbers can quickly overwhelm even hardened targets. Most of their ships are unshielded, which makes EMPs largely ineffective against them. Ktlitans also have no qualms about applying suicidal tactics to ensure the Queen's survival.",
    ): (
        "Los ktlitanos son criaturas inteligentes de ocho patas que recuerdan a los arácnidos de la Tierra. Pero, a diferencia de la mayoría de los arácnidos terrestres, los ktlitanos no pelean entre sí. Su objetivo común, y único, es la supervivencia de su especie.\n\n"
        "Aunque viven en una estructura jerárquica parecida a una colmena, las castas inferiores continúan su trabajo y emprenden tareas nuevas por su cuenta aun sin órdenes de sus superiores. Eso sí: cuando hay castas superiores presentes, los ktlitanos inferiores obedecen sin duda ni vacilación.\n\n"
        "No se sabe mucho del detalle de la jerarquía ktlitana, porque rechazan casi toda comunicación. La razón es que fueron expulsados de su mundo natal a lo largo de 200 años, cuando otra especie con la que habían entablado amistad los traicionó, los dominó y vació su mundo de recursos. Forzados al exilio, los ktlitanos buscan un nuevo hogar desde entonces y, por pura paranoia, suelen atacar a las demás razas nada más verlas y sin previo aviso.\n\n"
        "Sí se sabe que su estricta jerarquía empieza en su Reina y llega hasta lo más bajo de su fuerza de trabajo, cuyos miembros los humanos llaman «drones». No conviene subestimar su capacidad de combate: aunque la mayoría de las naves de sus flotas son débiles por separado, su coordinación de colmena y su número pueden abrumar en poco tiempo incluso objetivos bien defendidos. La mayoría de sus naves no llevan escudos, lo que vuelve los PEM casi inútiles contra ellas. Los ktlitanos tampoco tienen reparos en emplear tácticas suicidas para garantizar la supervivencia de la Reina."
    ),
    (
        None,
        "The Terran Stellar Navy, or TSN, consists of naval forces based near Terra. Its members are primarily human.\n\n"
        "These humans and other races have banded together to form a navy to protect and enforce common philosophies. They are friendly with the human navy but do not follow the same command structure. Military actions taken in the past have made them enemies of the Arlenians, but they've got a better relationship with the Ghosts than the Human Navy does.\n\n"
        "The TSN and USN are enemies because of the USN's neutral stance towards the Kraylor.",
    ): (
        "La Armada Estelar Terrana, o TSN, la componen fuerzas navales asentadas cerca de Terra. Sus miembros son mayoritariamente humanos.\n\n"
        "Estos humanos y otras razas se han unido para formar una armada que proteja y haga valer una filosofía común. Mantienen buena relación con la Armada Humana, pero no siguen su misma cadena de mando. Acciones militares del pasado los han convertido en enemigos de los arlenianos, aunque se llevan mejor con los Fantasmas que la propia Armada Humana.\n\n"
        "La TSN y la USN son enemigas por la postura neutral de la USN hacia los kraylor."
    ),
    (
        None,
        "The United Stellar Navy, or USN, is a naval force near the boundary of human and Kraylor space consisting of mostly humans. The USN is friendly with the human navy and uses a similar command structure.\n\n"
        "The USN is primarily human but includes other races. This includes some Kraylor, which has made the TSN an enemy of the USN.",
    ): (
        "La Armada Estelar Unida, o USN, es una fuerza naval cercana a la frontera entre el espacio humano y el kraylor, compuesta sobre todo por humanos. La USN mantiene buena relación con la Armada Humana y usa una cadena de mando parecida.\n\n"
        "Aunque es mayoritariamente humana, la USN incluye otras razas — entre ellas algunos kraylor, lo que ha convertido a la TSN en su enemiga."
    ),
    (
        None,
        "The Celestial Unified Fleet, or CUF, is the farthest-ranging primarily human fleet as well as the least xenophobic. The CUF's goals center on exploration and trade, but since it's a dangerous galaxy, they recognize the need for strong warships.\n\n"
        "The CUF is friendly with the human navy, and neutral toward the TSN and USN. They are less structured than the other primarily human navies.\n\n"
        "The CUF have neutral relations with the Ktlitans and Arlenians. They are enemies with Exuari, Kraylor, and Ghosts for political and historical reasons, not xenophobia; some of their best friends are also Exuari, Kraylor, and Ghosts.",
    ): (
        "La Flota Unificada Celestial, o CUF, es la flota mayoritariamente humana de mayor alcance, y también la menos xenófoba. Sus objetivos se centran en la exploración y el comercio pero, como la galaxia es peligrosa, reconocen la necesidad de buenas naves de guerra.\n\n"
        "La CUF mantiene buena relación con la Armada Humana y es neutral hacia la TSN y la USN. Está menos estructurada que las demás armadas mayoritariamente humanas.\n\n"
        "La CUF mantiene relaciones neutrales con ktlitanos y arlenianos. Es enemiga de exuari, kraylor y Fantasmas por motivos políticos e históricos, no por xenofobia; algunos de sus mejores amigos también son exuari, kraylor y Fantasmas."
    ),
    (
        "station-comms",
        "We are under attack! No time for chatting!",
    ): "¡Estamos bajo ataque! ¡No hay tiempo para charlas!",
    (
        "station-comms",
        "Good day, officer! Welcome to %s.\n"
        "What can we do for you today?",
    ): (
        "¡Buenos días, oficial! Os damos la bienvenida a %s.\n"
        "¿En qué podemos ayudaros hoy?"
    ),
    (
        "station-comms",
        "Welcome to our lovely station %s.",
    ): "Os damos la bienvenida a nuestra encantadora estación %s.",
    (
        "ammo-comms",
        "Do you have spare homing missiles for us?",
    ): "¿Tenéis misiles guiados de sobra para nosotros?",
    (
        "ammo-comms",
        "Can you restock us with HVLI?",
    ): "¿Podéis reabastecernos de HVLI?",
    (
        "ammo-comms",
        "Please re-stock our mines.",
    ): "Por favor, reponed nuestras minas.",
    (
        "ammo-comms",
        "Can you supply us with some nukes?",
    ): "¿Podéis suministrarnos algunas bombas nucleares?",
    (
        "ammo-comms",
        "Please re-stock our EMP missiles.",
    ): "Por favor, reponed nuestros misiles PEM.",
    (
        "ammo-comms",
        "%s (%d rep each)",
    ): "%s (%d rep cada uno)",
    (
        "station-comms",
        "You need to stay docked for that action.",
    ): "Tenéis que permanecer atracados para esa acción.",
    (
        "ammo-comms",
        "We do not deal in weapons of mass destruction.",
    ): "No comerciamos con armas de destrucción masiva.",
    (
        "ammo-comms",
        "We do not deal in weapons of mass disruption.",
    ): "No comerciamos con armas de perturbación masiva.",
    (
        "ammo-comms",
        "We do not deal in those weapons.",
    ): "No comerciamos con esas armas.",
    (
        "ammo-comms",
        "All nukes are charged and primed for destruction.",
    ): "Todas las bombas nucleares están cargadas y listas para destruir.",
    (
        "ammo-comms",
        "Sorry, sir, but you are as fully stocked as I can allow.",
    ): "Lo siento, oficial, pero ya vais tan cargados como puedo permitir.",
    (
        "needRep-comms",
        "Not enough reputation.",
    ): "No tenéis suficiente reputación.",
    (
        "ammo-comms",
        "You are fully loaded and ready to explode things.",
    ): "Vais completamente cargados y listos para hacer explotar cosas.",
    (
        "ammo-comms",
        "We generously resupplied you with some weapon charges.\n"
        "Put them to good use.",
    ): (
        "Os hemos reabastecido generosamente con algunas cargas de armamento.\n"
        "Dadles buen uso."
    ),
    (
        "station-comms",
        "This is %s. Good day, officer.\n"
        "If you need supplies, please dock with us first.",
    ): (
        "Aquí %s. Buenos días, oficial.\n"
        "Si necesitáis suministros, atracad con nosotros primero."
    ),
    (
        "station-comms",
        "This is %s. Greetings.\n"
        "If you want to do business, please dock with us first.",
    ): (
        "Aquí %s. Saludos.\n"
        "Si queréis hacer negocios, atracad con nosotros primero."
    ),
    (
        "stationAssist-comms",
        "Can you send a supply drop? (%d rep)",
    ): "¿Podéis enviar un paquete de suministros? (%d rep)",
    (
        "stationAssist-comms",
        "Please send reinforcements! (%d rep)",
    ): "¡Por favor, enviad refuerzos! (%d rep)",
    (
        "stationAssist-comms",
        "You need to set a waypoint before you can request backup.",
    ): "Tenéis que fijar un punto de referencia antes de pedir apoyo.",
    (
        "stationAssist-comms",
        "To which waypoint should we deliver your supplies?",
    ): "¿A qué punto de referencia entregamos vuestros suministros?",
    (
        "stationAssist-comms",
        "We have dispatched a supply ship toward %s.",
    ): "Hemos enviado una nave de suministros hacia %s.",
    (
        "needRep-comms",
        "Not enough reputation!",
    ): "¡No tenéis suficiente reputación!",
    (
        "stationAssist-comms",
        "What kind of reinforcement ship would you like?",
    ): "¿Qué clase de nave de refuerzo queréis?",
    (
        "stationAssist-comms",
        "Adder MK3 (%d rep)",
    ): "Adder MK3 (%d rep)",
    (
        "stationAssist-comms",
        "MU52 Hornet (%d rep)",
    ): "MU52 Hornet (%d rep)",
    (
        "stationAssist-comms",
        "Standard Adder MK5 (%d rep)",
    ): "Adder MK5 estándar (%d rep)",
    (
        "stationAssist-comms",
        "Adder MK8 (%d rep)",
    ): "Adder MK8 (%d rep)",
    (
        "stationAssist-comms",
        "Phobos T3 (%d rep)",
    ): "Phobos T3 (%d rep)",
    (
        "stationAssist-comms",
        "You need to set a waypoint before you can request reinforcements.",
    ): "Tenéis que fijar un punto de referencia antes de pedir refuerzos.",
    (
        "stationAssist-comms",
        "To which waypoint should we dispatch the reinforcements?",
    ): "¿A qué punto de referencia enviamos los refuerzos?",
    (
        "stationAssist-comms",
        "We have dispatched %s to assist at %s.",
    ): "Hemos enviado %s para prestar asistencia en %s.",
}


def protect(text: str) -> tuple[str, dict[str, str]]:
    mapping: dict[str, str] = {}

    def repl(match: re.Match[str]) -> str:
        token = f"ZXQPH{len(mapping)}QXZ"
        mapping[token] = match.group(0)
        return token

    return PLACEHOLDER_RE.sub(repl, text), mapping


def restore(text: str, mapping: dict[str, str]) -> str:
    for token, original in mapping.items():
        text = text.replace(token, original)
    missing = [token for token in mapping if token in text]
    if missing:
        raise ValueError(f"unrestored placeholders: {missing}")
    return text


def chunks(text: str, max_chars: int = 420) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    parts = SENTENCE_SPLIT_RE.split(text)
    out: list[str] = []
    current = ""
    for part in parts:
        if current and len(current) + len(part) > max_chars:
            out.append(current)
            current = part
        else:
            current += part
    if current:
        out.append(current)
    return out


def translatable_pieces(text: str) -> list[str]:
    """Split text while keeping formatting placeholders out of the model."""
    result: list[str] = []
    for segment in PLACEHOLDER_RE.split(text):
        if not segment:
            continue
        if PLACEHOLDER_RE.fullmatch(segment):
            result.append(segment)
        else:
            result.extend(chunks(segment))
    return result


class LocalTranslator:
    def __init__(self, model_dir: Path):
        self.sp = spm.SentencePieceProcessor(model_file=str(model_dir / "sentencepiece.model"))  # type: ignore[call-arg]
        self.engine = ctranslate2.Translator(str(model_dir / "model"), device="cpu", compute_type="int8")
        self.cache: dict[str, str] = {}

    @staticmethod
    def piece_parts(text: str) -> tuple[str, str, str]:
        whitespace = re.fullmatch(r"(\s*)(.*?)(\s*)", text, flags=re.DOTALL)
        assert whitespace is not None
        return whitespace.group(1), whitespace.group(2), whitespace.group(3)

    def preload(self, texts: list[str], batch_size: int = 64) -> None:
        pending: list[str] = []
        seen: set[str] = set()
        for text in texts:
            if text in EXACT_OVERRIDES:
                continue
            for piece in translatable_pieces(text):
                if PLACEHOLDER_RE.fullmatch(piece):
                    continue
                if not piece.strip() or piece in self.cache or piece in seen:
                    continue
                _, core, _ = self.piece_parts(piece)
                if not core or core in EXACT_OVERRIDES:
                    continue
                seen.add(piece)
                pending.append(piece)
        print(f"preloading {len(pending)} unique translation chunks", flush=True)
        for start in range(0, len(pending), batch_size):
            batch = pending[start:start + batch_size]
            encoded: list[list[str]] = []
            prepared: list[tuple[str, str, dict[str, str]]] = []
            for piece in batch:
                prefix, core, suffix = self.piece_parts(piece)
                encoded.append(self.sp.encode(core, out_type=str))  # type: ignore[attr-defined]
                prepared.append((prefix, suffix, {}))
            results = self.engine.translate_batch(encoded, beam_size=2)
            for piece, result, (prefix, suffix, mapping) in zip(batch, results, prepared):
                decoded = self.sp.decode(result.hypotheses[0])  # type: ignore[attr-defined]
                self.cache[piece] = prefix + restore(decoded, mapping) + suffix
            print(f"translated chunks {min(start + batch_size, len(pending))}/{len(pending)}", flush=True)

    def translate_piece(self, text: str) -> str:
        if not text.strip():
            return text
        whitespace = re.fullmatch(r"(\s*)(.*?)(\s*)", text, flags=re.DOTALL)
        assert whitespace is not None
        prefix, core, suffix = whitespace.groups()
        if not core:
            return text
        if core in EXACT_OVERRIDES:
            return prefix + EXACT_OVERRIDES[core] + suffix
        if text in self.cache:
            return self.cache[text]
        tokens = self.sp.encode(core, out_type=str)  # type: ignore[attr-defined]
        result = self.engine.translate_batch([tokens], beam_size=3)[0].hypotheses[0]
        translated = prefix + self.sp.decode(result) + suffix  # type: ignore[attr-defined]
        self.cache[text] = translated
        return translated

    def translate(self, text: str, context: str | None = None) -> str:
        override = CONTEXT_OVERRIDES.get((context, text))
        if override is not None:
            return override
        if text in EXACT_OVERRIDES:
            return EXACT_OVERRIDES[text]
        return "".join(
            piece if PLACEHOLDER_RE.fullmatch(piece) else self.translate_piece(piece)
            for piece in translatable_pieces(text)
        )


class GoogleBatchTranslator:
    """Higher-quality online pass for public game strings, batched per request."""

    separator = "\n<<<9876543210123456789>>>\n"

    def __init__(self):
        from deep_translator import GoogleTranslator

        self.engine = GoogleTranslator(source="en", target="es")
        self.cache: dict[str, str] = {}

    @staticmethod
    def piece_parts(text: str) -> tuple[str, str, str]:
        whitespace = re.fullmatch(r"(\s*)(.*?)(\s*)", text, flags=re.DOTALL)
        assert whitespace is not None
        return whitespace.group(1), whitespace.group(2), whitespace.group(3)

    def preload(self, texts: list[str], max_chars: int = 3800) -> None:
        pending: list[str] = []
        seen: set[str] = set()
        for text in texts:
            if text in EXACT_OVERRIDES:
                continue
            for piece in translatable_pieces(text):
                if PLACEHOLDER_RE.fullmatch(piece) or not piece.strip() or piece in seen:
                    continue
                _, core, _ = self.piece_parts(piece)
                if core and core not in EXACT_OVERRIDES:
                    seen.add(piece)
                    pending.append(piece)
        groups: list[list[str]] = []
        group: list[str] = []
        size = 0
        for piece in pending:
            _, core, _ = self.piece_parts(piece)
            extra = len(core) + (len(self.separator) if group else 0)
            if group and size + extra > max_chars:
                groups.append(group)
                group, size = [], 0
            group.append(piece)
            size += extra
        if group:
            groups.append(group)
        print(f"preloading {len(pending)} chunks in {len(groups)} Google batches", flush=True)
        for index, batch in enumerate(groups, 1):
            cores = [self.piece_parts(piece)[1] for piece in batch]
            translated = self.engine.translate(self.separator.join(cores))
            outputs = translated.split("<<<9876543210123456789>>>")
            if len(outputs) != len(batch):
                raise RuntimeError(f"Google batch cardinality mismatch: {len(batch)} != {len(outputs)}")
            for piece, output in zip(batch, outputs):
                prefix, _, suffix = self.piece_parts(piece)
                self.cache[piece] = prefix + output.strip() + suffix
            print(f"translated Google batches {index}/{len(groups)}", flush=True)

    def translate_piece(self, text: str) -> str:
        if not text.strip():
            return text
        prefix, core, suffix = self.piece_parts(text)
        if core in EXACT_OVERRIDES:
            return prefix + EXACT_OVERRIDES[core] + suffix
        if text not in self.cache:
            self.cache[text] = prefix + self.engine.translate(core).strip() + suffix
        return self.cache[text]

    def translate(self, text: str, context: str | None = None) -> str:
        override = CONTEXT_OVERRIDES.get((context, text))
        if override is not None:
            return override
        if text in EXACT_OVERRIDES:
            return EXACT_OVERRIDES[text]
        return "".join(
            piece if PLACEHOLDER_RE.fullmatch(piece) else self.translate_piece(piece)
            for piece in translatable_pieces(text)
        )


def spanish_path(source: Path) -> Path:
    if not source.name.endswith(".en.po"):
        raise ValueError(source)
    return source.with_name(source.name[:-6] + ".es.po")


def set_metadata(po: polib.POFile) -> None:
    po.metadata = {
        "Project-Id-Version": "Espaciokoop Lagunak / EmptyEpsilon",
        "Language": "es_ES",
        "Language-Team": "Espaciokoop Lagunak",
        "PO-Revision-Date": "2026-07-12 00:00+0200",
        "Last-Translator": "Espaciokoop Lagunak contributors",
        "Report-Msgid-Bugs-To": "https://github.com/EspacioKoop/espaciokooplagunak/issues",
        "MIME-Version": "1.0",
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Transfer-Encoding": "8bit",
        "Plural-Forms": "nplurals=2; plural=(n != 1);",
        "X-Generator": "tools/i18n_es.py (machine-assisted; human review required)",
    }


def generate(source: Path, translator: LocalTranslator | GoogleBatchTranslator, overwrite: bool) -> tuple[int, int]:
    target = spanish_path(source)
    if target.exists() and not overwrite:
        return 0, 1
    po = polib.pofile(str(source), encoding="utf-8", wrapwidth=0)
    set_metadata(po)
    translated = 0
    for entry in po:
        if entry.obsolete:
            continue
        entry.msgstr = ""
        entry.msgstr_plural = {}
        if entry.msgid_plural:
            entry.msgstr_plural[0] = translator.translate(entry.msgid, entry.msgctxt)
            entry.msgstr_plural[1] = translator.translate(entry.msgid_plural, entry.msgctxt)
            translated += 2
        elif entry.msgid:
            entry.msgstr = translator.translate(entry.msgid, entry.msgctxt)
            translated += 1
    target.parent.mkdir(parents=True, exist_ok=True)
    po.save(str(target))
    return translated, 0


def placeholder_counter(text: str) -> Counter[str]:
    return Counter(PLACEHOLDER_RE.findall(text))


def validate_pair(source: Path, target: Path) -> list[str]:
    errors: list[str] = []
    src = polib.pofile(str(source), encoding="utf-8")
    dst = polib.pofile(str(target), encoding="utf-8")
    src_map = {(e.msgctxt, e.msgid, e.msgid_plural): e for e in src if not e.obsolete}
    dst_map = {(e.msgctxt, e.msgid, e.msgid_plural): e for e in dst if not e.obsolete}
    if src_map.keys() != dst_map.keys():
        errors.append(f"catalog keys differ: source={len(src_map)} target={len(dst_map)}")
    for key, entry in dst_map.items():
        source_entry = src_map.get(key)
        if source_entry is None:
            continue
        translations = list(entry.msgstr_plural.values()) if entry.msgid_plural else [entry.msgstr]
        originals = [entry.msgid, entry.msgid_plural] if entry.msgid_plural else [entry.msgid]
        format_originals = [entry.msgid_plural, entry.msgid_plural] if entry.msgid_plural else originals
        if not translations:
            errors.append(f"empty translation set: {key!r}")
            continue
        for original, format_original, translated in zip(originals, format_originals, translations):
            if not translated and original:
                errors.append(f"empty translation: {key!r}")
                continue
            if original.isspace() and translated != original:
                errors.append(f"whitespace-only translation changed: {key!r}")
            if placeholder_counter(format_original) != placeholder_counter(translated):
                errors.append(f"placeholder mismatch: {format_original!r} -> {translated!r}")
    if dst.metadata.get("Language") != "es_ES":
        errors.append("metadata Language is not es_ES")
    return errors


def source_catalogs(root: Path, only: str | None) -> list[Path]:
    catalogs = sorted(root.rglob("*.en.po"))
    if only:
        catalogs = [p for p in catalogs if only in str(p.relative_to(root))]
    return catalogs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--provider", choices=("argos", "google"), default="argos")
    parser.add_argument("--model", type=Path, help="Argos CTranslate2 model directory")
    parser.add_argument("--only", help="substring filter for source catalog path")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    catalogs = source_catalogs(root, args.only)
    if not catalogs:
        parser.error("no English catalogs found")

    translator: LocalTranslator | GoogleBatchTranslator | None
    if args.validate_only:
        translator = None
    elif args.provider == "google":
        translator = GoogleBatchTranslator()
    else:
        if args.model is None:
            parser.error("--model is required with --provider argos")
        translator = LocalTranslator(args.model)
    if translator is not None:
        source_texts: list[str] = []
        for source in catalogs:
            po = polib.pofile(str(source), encoding="utf-8")
            for entry in po:
                if entry.obsolete:
                    continue
                if entry.msgid:
                    source_texts.append(entry.msgid)
                if entry.msgid_plural:
                    source_texts.append(entry.msgid_plural)
        translator.preload(source_texts)
    total = skipped = 0
    failures: list[str] = []
    for index, source in enumerate(catalogs, 1):
        target = spanish_path(source)
        if translator is not None:
            count, was_skipped = generate(source, translator, args.overwrite)
            total += count
            skipped += was_skipped
            print(f"[{index}/{len(catalogs)}] {target.relative_to(root)}: {count or 'skipped'}", flush=True)
        if not target.exists():
            failures.append(f"missing target: {target.relative_to(root)}")
            continue
        failures.extend(f"{target.relative_to(root)}: {error}" for error in validate_pair(source, target))

    print(f"catalogs={len(catalogs)} translated_entries={total} skipped={skipped} errors={len(failures)}")
    if failures:
        print("\n".join(failures[:200]), file=sys.stderr)
        if len(failures) > 200:
            print(f"... {len(failures) - 200} more", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
