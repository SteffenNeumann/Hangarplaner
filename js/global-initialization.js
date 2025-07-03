/**
 * Globale Initialisierungsdatei für HangarPlanner
 * Stellt sicher, dass alle kritischen Objekte und Funktionen verfügbar sind
 */

console.log("🚀 Globale Initialisierung gestartet...");

// Zentrale globale Objekte sicherstellen
window.globalInitialization = {
	initialized: false,
	modules: [],
	errors: [],

	/**
	 * Prüft ob ein Modul verfügbar ist
	 */
	checkModule: function (name, object) {
		if (object) {
			this.modules.push({ name, status: "available", object });
			console.log(`✅ Modul ${name} verfügbar`);
			return true;
		} else {
			this.modules.push({ name, status: "missing" });
			console.warn(`⚠️ Modul ${name} nicht verfügbar`);
			return false;
		}
	},

	/**
	 * Initialisiert alle kritischen globalen Objekte
	 */
	initializeAll: function () {
		console.log("🔧 Initialisiere alle globalen Module...");

		// 1. HangarData sicherstellen
		if (!window.hangarData) {
			window.hangarData = {};
			console.log("📦 window.hangarData initialisiert");
		}

		// collectAllHangarData global verfügbar machen (falls noch nicht geschehen)
		if (
			typeof window.collectAllHangarData === "function" &&
			!window.hangarData.collectAllHangarData
		) {
			window.hangarData.collectAllHangarData = window.collectAllHangarData;
			console.log("✅ collectAllHangarData an hangarData angehängt");
		}

		// 2. HangarUI sicherstellen
		if (!window.hangarUI) {
			window.hangarUI = {};
			console.log("📦 window.hangarUI initialisiert");
		}

		// 3. ServerSync/StorageBrowser sicherstellen
		if (!window.serverSync && !window.storageBrowser) {
			console.warn("⚠️ ServerSync nicht verfügbar, erstelle Dummy");
			window.serverSync = {
				syncWithServer: () => Promise.resolve(false),
				loadFromServer: () => Promise.resolve(null),
				getStatus: () => ({ serverUrl: null, isActive: false }),
			};
			window.storageBrowser = window.serverSync;
		}

		// 4. Improved Event Manager sicherstellen
		if (!window.improved_event_manager) {
			console.warn("⚠️ Improved Event Manager nicht verfügbar");
		}

		// 5. Kritische Funktionen sicherstellen
		this.ensureCriticalFunctions();

		// 6. Module-Status prüfen
		this.checkAllModules();

		this.initialized = true;
		console.log("✅ Globale Initialisierung abgeschlossen");

		// Event für andere Module
		document.dispatchEvent(new CustomEvent("globalInitializationComplete"));
	},

	/**
	 * Stellt sicher, dass kritische Funktionen verfügbar sind
	 */
	ensureCriticalFunctions: function () {
		console.log("🔧 Stelle kritische Funktionen sicher...");

		// updateTowStatusStyles global verfügbar machen
		if (!window.updateTowStatusStyles) {
			window.updateTowStatusStyles = function (select) {
				try {
					// Alle Styling-Klassen entfernen
					select.classList.remove(
						"tow-neutral",
						"tow-initiated",
						"tow-ongoing",
						"tow-on-position"
					);

					// Neue Styling-Klasse basierend auf dem Wert hinzufügen
					const value = select.value;
					select.classList.add(`tow-${value}`);

					// Hintergrundfarbe direkt setzen
					if (value === "neutral") {
						select.style.backgroundColor = "white";
						select.style.color = "#333333";
					} else if (value === "initiated") {
						select.style.backgroundColor = "#FEF3C7"; // Hellgelb
						select.style.color = "#92400E";
					} else if (value === "ongoing") {
						select.style.backgroundColor = "#DBEAFE"; // Hellblau
						select.style.color = "#1E40AF";
					} else if (value === "on-position") {
						select.style.backgroundColor = "#D1FAE5"; // Hellgrün
						select.style.color = "#065F46";
					}

					console.log(`🚚 Tow-Status aktualisiert: ${value}`);
				} catch (error) {
					console.error("❌ Fehler beim Aktualisieren des Tow-Status:", error);
				}
			};
			console.log("✅ updateTowStatusStyles global verfügbar gemacht");
		}

		// setupSecondaryTileEventListeners global verfügbar machen
		if (
			!window.setupSecondaryTileEventListeners &&
			window.hangarUI &&
			window.hangarUI.setupSecondaryTileEventListeners
		) {
			window.setupSecondaryTileEventListeners =
				window.hangarUI.setupSecondaryTileEventListeners;
			console.log(
				"✅ setupSecondaryTileEventListeners global verfügbar gemacht"
			);
		}

		// updateStatusLights global verfügbar machen
		if (
			!window.updateStatusLights &&
			window.hangarUI &&
			window.hangarUI.updateStatusLights
		) {
			window.updateStatusLights = window.hangarUI.updateStatusLights;
			console.log("✅ updateStatusLights global verfügbar gemacht");
		}
	},

	/**
	 * Prüft alle wichtigen Module
	 */
	checkAllModules: function () {
		console.log("🔍 Prüfe alle Module...");

		// Kritische Module prüfen
		this.checkModule("window.hangarData", window.hangarData);
		this.checkModule(
			"window.hangarData.collectAllHangarData",
			window.hangarData?.collectAllHangarData
		);
		this.checkModule("window.hangarUI", window.hangarUI);
		this.checkModule(
			"window.hangarUI.setupSecondaryTileEventListeners",
			window.hangarUI?.setupSecondaryTileEventListeners
		);
		this.checkModule("window.serverSync", window.serverSync);
		this.checkModule("window.storageBrowser", window.storageBrowser);
		this.checkModule(
			"window.improved_event_manager",
			window.improved_event_manager
		);
		this.checkModule(
			"window.updateTowStatusStyles",
			window.updateTowStatusStyles
		);
		this.checkModule("window.updateStatusLights", window.updateStatusLights);
		this.checkModule(
			"window.setupSecondaryTileEventListeners",
			window.setupSecondaryTileEventListeners
		);
		this.checkModule("window.showNotification", window.showNotification);

		// Zusammenfassung
		const available = this.modules.filter(
			(m) => m.status === "available"
		).length;
		const missing = this.modules.filter((m) => m.status === "missing").length;

		console.log(`📊 Module-Status: ${available} verfügbar, ${missing} fehlend`);

		if (missing > 0) {
			console.warn(
				"⚠️ Fehlende Module:",
				this.modules.filter((m) => m.status === "missing").map((m) => m.name)
			);
		}
	},

	/**
	 * Wartet darauf, dass alle Module geladen sind
	 */
	waitForModules: function (timeout = 10000) {
		return new Promise((resolve, reject) => {
			const startTime = Date.now();

			const checkModules = () => {
				if (this.initialized) {
					resolve(this);
					return;
				}

				if (Date.now() - startTime > timeout) {
					reject(new Error("Timeout beim Warten auf Module"));
					return;
				}

				// Prüfe wieder in 100ms
				setTimeout(checkModules, 100);
			};

			checkModules();
		});
	},

	/**
	 * Führt eine Funktion aus, nachdem alle Module geladen sind
	 */
	ready: function (callback) {
		if (this.initialized) {
			callback();
		} else {
			document.addEventListener("globalInitializationComplete", callback, {
				once: true,
			});
		}
	},
};

// Initialisierung bei DOMContentLoaded
document.addEventListener("DOMContentLoaded", function () {
	console.log("📋 DOM geladen, starte globale Initialisierung...");

	// Kurze Verzögerung, damit andere Module sich laden können
	setTimeout(() => {
		window.globalInitialization.initializeAll();
	}, 100);
});

// Auch als Fallback nach einer Verzögerung
setTimeout(() => {
	if (!window.globalInitialization.initialized) {
		console.log("⏰ Fallback-Initialisierung nach Timeout");
		window.globalInitialization.initializeAll();
	}
}, 2000);

console.log("📦 Globale Initialisierung bereit");
