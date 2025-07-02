/**
 * debug-helpers.js
 * Hilfsfunktionen zur Fehlerdiagnose und Debugging
 */

// Globales Objekt für Debugging-Funktionen
window.debugHelpers = {
	// Überprüft den Sidebar-Status und zeigt Details im Console
	checkSidebarStatus: function () {
		const body = document.body;
		const menuToggleBtn = document.getElementById("menuToggle");
		const sidebar = document.getElementById("sidebarMenu");
		const isSidebarCollapsed = body.classList.contains("sidebar-collapsed");

		console.group("Sidebar-Status-Diagnose");
		console.log(
			"Sidebar-Status:",
			isSidebarCollapsed ? "Eingeklappt" : "Ausgeklappt"
		);
		console.log(
			"Toggle-Button Text:",
			menuToggleBtn ? menuToggleBtn.textContent : "Nicht gefunden"
		);
		console.log(
			"Toggle-Button Position:",
			menuToggleBtn
				? `top: ${menuToggleBtn.offsetTop}px, right: ${
						document.body.clientWidth -
						menuToggleBtn.offsetLeft -
						menuToggleBtn.offsetWidth
				  }px`
				: "N/A"
		);
		console.log("Sidebar-Container:", sidebar ? "Gefunden" : "Nicht gefunden");
		if (sidebar) {
			console.log("Sidebar-Container Breite:", sidebar.offsetWidth);
			console.log(
				"Sidebar-Container Stil width:",
				getComputedStyle(sidebar).width
			);
		}
		console.log("Body-Klassen:", body.className);
		console.groupEnd();

		return {
			isCollapsed: isSidebarCollapsed,
			buttonText: menuToggleBtn ? menuToggleBtn.textContent : null,
			sidebarWidth: sidebar ? sidebar.offsetWidth : null,
			bodyClasses: body.className,
		};
	},

	// Sidebar-Status direkt umschalten - als Notfallmethode
	toggleSidebarManually: function () {
		const body = document.body;
		const menuToggleBtn = document.getElementById("menuToggle");
		const wasCollapsed = body.classList.contains("sidebar-collapsed");

		// Umschalten des Zustands
		if (wasCollapsed) {
			body.classList.remove("sidebar-collapsed");
			if (menuToggleBtn) menuToggleBtn.textContent = "»"; // Immer nach rechts
		} else {
			body.classList.add("sidebar-collapsed");
			if (menuToggleBtn) menuToggleBtn.textContent = "»"; // Immer nach rechts
		}

		// LocalStorage aktualisieren
		localStorage.setItem("sidebarCollapsed", !wasCollapsed);

		// Layout aktualisieren
		if (window.hangarUI && window.hangarUI.adjustScaling) {
			setTimeout(window.hangarUI.adjustScaling, 50);
		}

		console.log(
			"Sidebar-Status manuell umgeschaltet:",
			wasCollapsed ? "→ Ausgeklappt" : "→ Eingeklappt"
		);
		return !wasCollapsed;
	},

	// Fügt einen sichtbaren Notfall-Toggle-Button zur Seite hinzu
	addEmergencyToggleButton: function () {
		const btn = document.createElement("button");
		btn.innerText = "Sidebar Toggle (Notfall)";
		btn.style.cssText =
			"position:fixed;bottom:20px;left:20px;z-index:9999;padding:10px;background:#ff7043;color:white;border:none;border-radius:4px;";
		btn.onclick = this.toggleSidebarManually;
		document.body.appendChild(btn);
		console.log("Notfall-Toggle-Button zur Seite hinzugefügt");
	},

	// Notfallfunktion zum Zurücksetzen der Sidebar
	resetSidebarState: function () {
		try {
			// Sidebar-Status im localStorage zurücksetzen
			localStorage.removeItem("sidebarCollapsed");
			localStorage.setItem("sidebarCollapsed", "false");

			// Body-Klasse direkt entfernen
			document.body.classList.remove("sidebar-collapsed");

			// Toggle-Button Text aktualisieren
			const menuToggleBtn = document.getElementById("menuToggle");
			if (menuToggleBtn) {
				menuToggleBtn.textContent = "»"; // Immer nach rechts
				menuToggleBtn.setAttribute("title", "Menü ein/ausklappen");
			}

			// Direkte CSS-Manipulation für den Fall, dass andere Methoden fehlschlagen
			const sidebar = document.getElementById("sidebarMenu");
			if (sidebar) {
				sidebar.style.width = "320px";
				sidebar.style.minWidth = "320px";
				sidebar.style.opacity = "1";
				sidebar.style.visibility = "visible";
			}

			// Sidebar-Content sichtbar machen
			const sidebarContent = document.querySelector(".sidebar-content");
			if (sidebarContent) {
				sidebarContent.style.opacity = "1";
				sidebarContent.style.visibility = "visible";
			}

			console.log("Sidebar wurde auf ausgeklappt zurückgesetzt");

			// Layout neu berechnen
			if (window.hangarUI && window.hangarUI.adjustScaling) {
				setTimeout(window.hangarUI.adjustScaling, 100);
			}

			return "Sidebar erfolgreich zurückgesetzt";
		} catch (error) {
			console.error("Fehler beim Zurücksetzen der Sidebar:", error);
			return "Fehler beim Zurücksetzen der Sidebar: " + error.message;
		}
	},

	// Hilfsfunktion zum Debuggen der Akkordeon-Funktionalität
	debugAccordion: function () {
		const accordionHeaders = document.querySelectorAll(
			".sidebar-accordion-header"
		);

		console.group("Akkordeon Status");
		accordionHeaders.forEach((header, index) => {
			const isCollapsed = header.classList.contains("collapsed");
			const title =
				header.querySelector(".sidebar-section-title")?.textContent ||
				`Header #${index}`;
			const content = header.nextElementSibling;
			const isOpen = content ? content.classList.contains("open") : false;
			const contentDisplay = content
				? window.getComputedStyle(content).maxHeight
				: "N/A";

			console.log(
				`${title}: ${isCollapsed ? "Eingeklappt" : "Ausgeklappt"}, Content: ${
					isOpen ? "Offen" : "Geschlossen"
				}, Höhe: ${contentDisplay}`
			);
		});
		console.groupEnd();

		return "Akkordeon-Status in der Konsole ausgegeben";
	},

	// Repariert alle Akkordeons, indem es die Event-Handler neu einrichtet
	fixAccordions: function () {
		// Alte Event-Handler entfernen und neue einrichten
		const accordionHeaders = document.querySelectorAll(
			".sidebar-accordion-header"
		);

		accordionHeaders.forEach((header) => {
			// Alte Handler entfernen, falls vorhanden
			if (header._clickHandler) {
				header.removeEventListener("click", header._clickHandler);
			}

			// Neuen Handler definieren und hinzufügen
			header._clickHandler = function () {
				this.classList.toggle("collapsed");
				const content = this.nextElementSibling;
				if (content) {
					content.classList.toggle("open");
				}
			};

			header.addEventListener("click", header._clickHandler);

			// Initialen Zustand korrekt setzen
			const isCollapsed = header.classList.contains("collapsed");
			const content = header.nextElementSibling;
			if (content) {
				if (isCollapsed) {
					content.classList.remove("open");
				} else {
					content.classList.add("open");
				}
			}
		});

		console.log("Akkordeon-Handler neu initialisiert");
		return "Akkordeons wurden repariert - Klicken Sie jetzt auf die Menüpunkte, um die Funktionalität zu testen";
	},

	// Manuelle Konvertierung des Menüs zum 2-Spalten-Design
	applyTwoColumnLayout: function () {
		// Identifiziere Bereiche, die für ein 2-Spalten-Layout geeignet sind
		const infoSections = document.querySelectorAll(
			".sidebar-accordion-content"
		);

		infoSections.forEach((section) => {
			// Erstelle Container für Info-Blöcke wenn nicht vorhanden
			const infoBlocks = section.querySelectorAll(".sidebar-form-group");

			// Wenn mehr als 2 Info-Blöcke vorhanden sind, gruppieren wir sie
			if (infoBlocks.length >= 2) {
				// Erstelle einen Container mit 2-Spalten-Layout
				const twoColumnContainer = document.createElement("div");
				twoColumnContainer.className = "info-block-grid";

				// Vermeiden von doppelter Konvertierung
				if (!section.querySelector(".info-block-grid")) {
					// Nimm jede zweite Formulargruppe und füge sie in das 2-Spalten-Layout ein
					for (let i = 0; i < Math.min(6, infoBlocks.length); i += 2) {
						const leftBlock = infoBlocks[i];
						const rightBlock = infoBlocks[i + 1];

						if (
							leftBlock &&
							!leftBlock.parentElement.classList.contains("info-block-grid")
						) {
							const leftContainer = document.createElement("div");
							leftContainer.className = "info-block";
							section.insertBefore(leftContainer, leftBlock);
							leftContainer.appendChild(leftBlock);
							twoColumnContainer.appendChild(leftContainer);
						}

						if (
							rightBlock &&
							!rightBlock.parentElement.classList.contains("info-block-grid")
						) {
							const rightContainer = document.createElement("div");
							rightContainer.className = "info-block";
							section.insertBefore(rightContainer, rightBlock);
							rightContainer.appendChild(rightBlock);
							twoColumnContainer.appendChild(rightContainer);
						}
					}

					// Füge das 2-Spalten-Layout am Anfang des Abschnitts ein
					if (twoColumnContainer.children.length > 0) {
						section.prepend(twoColumnContainer);
					}
				}
			}
		});

		console.log("2-Spalten-Layout wurde angewendet");
		return "2-Spalten-Layout wurde auf geeignete Abschnitte angewendet";
	},

	/**
	 * Debugging-Helfer für die Wetter-API
	 */

	// Fügen Sie diese Funktion zu bestehenden Hilfsfunktionen hinzu
	debugWeatherAPI: function () {
		console.log("=== Weather API Debug ===");

		// Prüfen, ob die Widget-Elemente existieren
		const elements = [
			{ name: "weather-widget", el: document.getElementById("weather-widget") },
			{
				name: ".weather-airport",
				el: document.querySelector(".weather-airport"),
			},
			{ name: "#weather-temp", el: document.getElementById("weather-temp") },
			{ name: "#weather-icon", el: document.getElementById("weather-icon") },
			{
				name: "#weather-description",
				el: document.getElementById("weather-description"),
			},
			{ name: "#weather-wind", el: document.getElementById("weather-wind") },
			{
				name: "#weather-visibility",
				el: document.getElementById("weather-visibility"),
			},
		];

		elements.forEach((item) => {
			console.log(`${item.name}: ${item.el ? "Gefunden" : "NICHT GEFUNDEN"}`);
		});

		// API-Konfiguration prüfen
		console.log(
			"currentAirport:",
			window.weatherAPI?.currentAirport || "Nicht definiert"
		);

		// CSS-Einbindung prüfen
		const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
		let weatherCSSFound = false;

		cssLinks.forEach((link) => {
			if (link.href.includes("weather-widget.css")) {
				weatherCSSFound = true;
			}
		});

		console.log(
			"weather-widget.css eingebunden:",
			weatherCSSFound ? "Ja" : "NEIN"
		);

		// Manuelle API-Abfrage auslösen
		console.log("Manuelle API-Abfrage wird ausgelöst...");
		if (
			window.weatherAPI &&
			typeof window.weatherAPI.fetchWeatherData === "function"
		) {
			window.weatherAPI.fetchWeatherData();
		} else {
			console.error("weatherAPI.fetchWeatherData ist nicht verfügbar!");
		}

		console.log("=== Debug Ende ===");
	},
};

// Automatisch nach Initialisierung ausführen
document.addEventListener("DOMContentLoaded", function () {
	setTimeout(() => {
		// Debug-Modus prüfen
		if (localStorage.getItem("debugMode") === "true") {
			console.log("Debug-Modus aktiv, führe Weather API Debug aus");
			debugWeatherAPI();
		}
	}, 1500);
});

// Globale Verfügbarkeit für Konsolenaufrufe
window.debugWeatherAPI = window.debugHelpers.debugWeatherAPI;

/**
 * Debugging-Helfer für die Anwendung
 */

// Hilfsfunktionen für das Debugging
window.debugHelpers = {
	// Debugging-Modus aktivieren/deaktivieren
	toggleDebugMode: function () {
		const currentMode = localStorage.getItem("debugMode") === "true";
		localStorage.setItem("debugMode", (!currentMode).toString());
		console.log(`Debug-Modus ${!currentMode ? "aktiviert" : "deaktiviert"}`);
		return !currentMode;
	},

	// Debugging-Informationen ausgeben
	logDebugInfo: function () {
		console.log("=== DEBUG INFORMATIONEN ===");
		console.log("User Agent:", navigator.userAgent);
		console.log(
			"Bildschirmauflösung:",
			window.innerWidth,
			"x",
			window.innerHeight
		);
		console.log("Zoom Level:", window.devicePixelRatio * 100, "%");

		// Aktuelle Einstellungen
		const settings = localStorage.getItem("hangarPlannerSettings");
		if (settings) {
			try {
				const parsedSettings = JSON.parse(settings);
				console.log("Aktuelle Einstellungen:", parsedSettings);
			} catch (e) {
				console.error("Fehler beim Parsen der Einstellungen:", e);
			}
		} else {
			console.log("Keine gespeicherten Einstellungen gefunden");
		}

		// DOM-Informationen
		const hangarGrid = document.getElementById("hangarGrid");
		if (hangarGrid) {
			console.log("Hangar Grid:", {
				childCount: hangarGrid.childElementCount,
				visibleCells: hangarGrid.querySelectorAll(".hangar-cell:not(.hidden)")
					.length,
				style: {
					display: getComputedStyle(hangarGrid).display,
					gridTemplateColumns: getComputedStyle(hangarGrid).gridTemplateColumns,
				},
			});
		}

		// Sekundäres Grid
		const secondaryGrid = document.getElementById("secondaryHangarGrid");
		if (secondaryGrid) {
			console.log("Sekundäres Grid:", {
				childCount: secondaryGrid.childElementCount,
				visibility: getComputedStyle(secondaryGrid).display,
				gridTemplateColumns:
					getComputedStyle(secondaryGrid).gridTemplateColumns,
			});
		}

		console.log("=== DEBUG ENDE ===");
	},
};

// Automatische Ausführung beim Laden
document.addEventListener("DOMContentLoaded", function () {
	// Status beim Laden überprüfen
	setTimeout(() => {
		if (
			typeof window.debugHelpers !== "undefined" &&
			window.debugHelpers &&
			typeof window.debugHelpers.checkSidebarStatus === "function"
		) {
			window.debugHelpers.checkSidebarStatus();
		} else {
			console.log(
				"debugHelpers noch nicht verfügbar, überspringe Sidebar-Status-Check"
			);
		}
	}, 1000);

	// Tastaturabruf für Debugging-Funktionen einrichten
	document.addEventListener("keydown", function (e) {
		// Alt+Shift+D drücken, um Debugging-Funktionen zu aktivieren
		if (e.altKey && e.shiftKey && e.key === "D") {
			window.debugHelpers.addEmergencyToggleButton();
			alert(
				"Debugging-Funktionen aktiviert. Notfall-Toggle-Button wurde hinzugefügt."
			);
		}
	});
});

console.log(
	"Debug-Helfer geladen - Drücken Sie Alt+Shift+D für Notfall-Sidebar-Toggle"
);
