/**
 * Globale Initialisierungsdatei für HangarPlanner
 * Stellt sicher, dass alle kritischen Objekte und Funktionen verfügbar sind
 */

// console.log("🚀 Globale Initialisierung gestartet...");

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
			// console.log(`✅ Modul ${name} verfügbar`);
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
		// console.log("🔧 Initialisiere alle globalen Module...");

		// 1. HangarData sicherstellen
		if (!window.hangarData) {
			window.hangarData = {};
			// console.log("📦 window.hangarData initialisiert");
		}

		// collectAllHangarData global verfügbar machen (falls noch nicht geschehen)
		if (
			typeof window.collectAllHangarData === "function" &&
			!window.hangarData.collectAllHangarData
		) {
			window.hangarData.collectAllHangarData = window.collectAllHangarData;
			console.log("✅ collectAllHangarData an hangarData angehängt");
		}

		// KRITISCHER FALLBACK: Stelle sicher, dass collectAllHangarData immer verfügbar ist
		if (
			!window.collectAllHangarData &&
			!window.hangarData?.collectAllHangarData
		) {
			// Erstelle eine Minimal-Implementierung als Fallback
			window.collectAllHangarData = function () {
				console.warn("⚠️ Fallback: collectAllHangarData minimal ausgeführt");
				return {
					id: Date.now().toString(),
					metadata: { created: new Date().toISOString() },
					settings: { tilesCount: 8, secondaryTilesCount: 4, layout: 4 },
					primaryTiles: [],
					secondaryTiles: [],
				};
			};
			window.hangarData.collectAllHangarData = window.collectAllHangarData;
			console.log("🚨 Kritischer Fallback für collectAllHangarData erstellt");
		}

		// 2. HangarUI sicherstellen
		if (!window.hangarUI) {
			window.hangarUI = {};
			// console.log("📦 window.hangarUI initialisiert");
		}

		// 3. ServerSync/StorageBrowser sicherstellen (nur Fallback wenn nicht vorhanden)
		if (!window.serverSync && !window.storageBrowser) {
			console.warn("⚠️ ServerSync nicht verfügbar, erstelle Dummy-Fallback");
			window.serverSync = {
				// Read paths
				loadFromServer: () => Promise.resolve(null),
				applyServerData: () => Promise.resolve(false),
				testServerConnection: () => Promise.resolve(false),
				getStatus: () => ({ serverUrl: null, isActive: false }),
				// Write paths
				syncWithServer: () => Promise.resolve(false),
				manualSync: () => Promise.resolve(false),
				// Mode control (no-ops with warnings)
				startMasterMode: () => { console.warn("⚠️ Dummy ServerSync: startMasterMode() no-op (echte ServerSync noch nicht geladen)"); return false; },
				startSlaveMode: () => { console.warn("⚠️ Dummy ServerSync: startSlaveMode() no-op (echte ServerSync noch nicht geladen)"); return false; },
				stopPeriodicSync: () => { console.warn("⚠️ Dummy ServerSync: stopPeriodicSync() no-op (echte ServerSync noch nicht geladen)"); },
			};
			window.storageBrowser = window.serverSync;
		} else {
			console.log(
				"✅ ServerSync bereits verfügbar - verwende echte Implementierung"
			);
		}

		// 4. Improved Event Manager sicherstellen
		if (!window.improved_event_manager) {
			console.warn("⚠️ Improved Event Manager nicht verfügbar");
		}

		// 5. Kritische Funktionen sicherstellen
		this.ensureCriticalFunctions();

		// 6. Module-Status prüfen
		this.checkAllModules();

		// 7. Automatische Datumseintragung für Flugdaten-API
		this.setupFlightDataDates();

		// 8. Automatische Server-Datenladung beim Seitenstart
		this.attemptServerDataLoad();

		this.initialized = true;
		// console.log("✅ Globale Initialisierung abgeschlossen");

		// Event für andere Module
		document.dispatchEvent(new CustomEvent("globalInitializationComplete"));
	},

	/**
	 * Stellt sicher, dass kritische Funktionen verfügbar sind
	 */
	ensureCriticalFunctions: function () {
		// console.log("🔧 Stelle kritische Funktionen sicher...");

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

					// console.log(`🚚 Tow-Status aktualisiert: ${value}`);
				} catch (error) {
					console.error("❌ Fehler beim Aktualisieren des Tow-Status:", error);
				}
			};
			// console.log("✅ updateTowStatusStyles global verfügbar gemacht");
		}

		// setupSecondaryTileEventListeners global verfügbar machen
		if (
			!window.setupSecondaryTileEventListeners &&
			window.hangarUI &&
			window.hangarUI.setupSecondaryTileEventListeners
		) {
			window.setupSecondaryTileEventListeners =
				window.hangarUI.setupSecondaryTileEventListeners;
			// console.log(
			//	"✅ setupSecondaryTileEventListeners global verfügbar gemacht"
			// );
		}

		// updateStatusLights global verfügbar machen
		if (
			!window.updateStatusLights &&
			window.hangarUI &&
			window.hangarUI.updateStatusLights
		) {
			window.updateStatusLights = window.hangarUI.updateStatusLights;
			// console.log("✅ updateStatusLights global verfügbar gemacht");
		}
	},

	/**
	 * Prüft alle wichtigen Module
	 */
	checkAllModules: function () {
		// console.log("🔍 Prüfe alle Module...");

		// Kritische Module prüfen
		this.checkModule("window.hangarData", window.hangarData);
		this.checkModule(
			"window.hangarData.collectAllHangarData",
			window.hangarData?.collectAllHangarData
		);
		this.checkModule("window.hangarUI", window.hangarUI);
		this.checkModule(
			"window.hangarUI.checkElement",
			window.hangarUI?.checkElement
		);
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

		// console.log(`📊 Module-Status: ${available} verfügbar, ${missing} fehlend`);

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
	 * Automatische Datumseintragung für Flugdaten-API
	 * Setzt heutiges Datum als "letzter Flug" und morgiges Datum als "erster Flug"
	 */
	setupFlightDataDates: function () {
		try {
			// Heutiges Datum für "letzter Flug" (aktueller Tag)
			const currentDateInput = document.getElementById("currentDateInput");
			if (currentDateInput && !currentDateInput.value) {
				const today = new Date();
				const todayString = today.toISOString().split("T")[0]; // Format: YYYY-MM-DD
				currentDateInput.value = todayString;
				console.log(`✅ Aktuelles Datum gesetzt: ${todayString}`);
			}

			// Morgiges Datum für "erster Flug" (Folgetag)
			const nextDateInput = document.getElementById("nextDateInput");
			if (nextDateInput && !nextDateInput.value) {
				const tomorrow = new Date();
				tomorrow.setDate(tomorrow.getDate() + 1);
				const tomorrowString = tomorrow.toISOString().split("T")[0]; // Format: YYYY-MM-DD
				nextDateInput.value = tomorrowString;
				console.log(`✅ Folgetag gesetzt: ${tomorrowString}`);
			}
		} catch (error) {
			console.error(
				"❌ Fehler beim Setzen der Flugdaten-Datumsangaben:",
				error
			);
		}
	},

	/**
	 * Versucht automatisch, die letzten Daten vom Server zu laden
	 * Wird beim Seitenstart ausgeführt nach einer kurzen Verzögerung
	 * ANGEPASST: Berücksichtigt neue Sync-Modi
	 */
	attemptServerDataLoad: function () {
		// Verzögerung, damit alle Module geladen sind
		setTimeout(async () => {
			try {
				console.log("🔄 Versuche, letzte Daten vom Server zu laden...");

				// NEUE PRÜFUNG: Respektiere Sharing-Manager Modi
				if (
					window.sharingManager &&
					window.sharingManager.syncMode === "standalone"
				) {
					console.log(
						"🏠 Standalone-Modus erkannt - Server-Datenladung wird über SharingManager verwaltet"
					);
					return;
				}

				// Prüfe ob ServerSync/StorageBrowser verfügbar ist
				if (!window.serverSync || !window.serverSync.loadFromServer) {
					console.log(
						"ℹ️ ServerSync nicht verfügbar - überspringe automatische Datenladung"
					);
					return;
				}

				// Prüfe ob Server-URL konfiguriert ist
				const serverStatus = window.serverSync.getStatus
					? window.serverSync.getStatus()
					: null;
				if (!serverStatus || !serverStatus.serverUrl) {
					console.log(
						"ℹ️ Server-URL nicht konfiguriert - überspringe automatische Datenladung"
					);
					return;
				}

				// Versuche Daten vom Server zu laden
				const serverData = await window.serverSync.loadFromServer();

				if (serverData && serverData.primaryTiles) {
					console.log("✅ Server-Daten gefunden - wende sie an...");

					// Setze Flag um zu verhindern, dass localStorage-Events gefeuert werden
					window.isApplyingServerData = true;

					// Wende Server-Daten an
					if (window.serverSync.applyServerData) {
						await window.serverSync.applyServerData(serverData);
						console.log("✅ Server-Daten erfolgreich angewendet");
					} else {
						console.warn("⚠️ applyServerData Methode nicht verfügbar");
					}

					// Flag zurücksetzen
					window.isApplyingServerData = false;

					// UI aktualisieren falls möglich
					if (window.hangarUI && window.hangarUI.updateStatusLights) {
						window.hangarUI.updateStatusLights();
					}

					// Notification anzeigen falls verfügbar
					if (window.showNotification) {
						window.showNotification("Server-Daten geladen", "success");
					}
				} else {
					console.log("ℹ️ Keine aktuellen Daten auf dem Server gefunden");
				}
			} catch (error) {
				console.error(
					"❌ Fehler beim automatischen Laden der Server-Daten:",
					error
				);

				// Flag zurücksetzen bei Fehler
				window.isApplyingServerData = false;
			}
		}, 1500); // 1.5 Sekunden Verzögerung für sichere Initialisierung
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

// *** ZENTRALE INITIALISIERUNG STATT SEPARATER DOMContentLoaded ***
// Verwende zentrale Initialisierungsqueue statt separate DOMContentLoaded Events
window.hangarInitQueue = window.hangarInitQueue || [];
window.hangarInitQueue.push(function () {
	console.log(
		"📋 Globale Initialisierung wird über zentrale Queue gestartet..."
	);

	// Kurze Verzögerung, damit andere Module sich laden können
	setTimeout(() => {
		if (
			window.globalInitialization &&
			!window.globalInitialization.initialized
		) {
			window.globalInitialization.initializeAll();
		}
	}, 100);
});

// Auch als Fallback nach einer Verzögerung
setTimeout(() => {
	if (!window.globalInitialization.initialized) {
		// console.log("⏰ Fallback-Initialisierung nach Timeout");
		window.globalInitialization.initializeAll();
	}
}, 2000);

// console.log("📦 Globale Initialisierung bereit");
