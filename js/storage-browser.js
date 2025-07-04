/**
 * Server-Synchronisation für HangarPlanner
 * Reduzierte Version - nur Server-Sync ohne Event-Handler
 * Optimiert von 2085 → ~400 Zeilen
 */

class ServerSync {
	constructor() {
		this.serverSyncUrl = null;
		this.serverSyncInterval = null;
		this.isApplyingServerData = false;
		this.lastDataChecksum = null;
		this.autoSaveTimeout = null;

		// Global verfügbar machen für Kompatibilität und Race Condition Prevention
		window.isApplyingServerData = false;
		window.isLoadingServerData = false;
		window.isSavingToServer = false;
	}

	/**
	 * Initialisiert die Server-Synchronisation
	 */
	async initSync(serverUrl) {
		this.serverSyncUrl = serverUrl;
		console.log("🔄 Server-Sync initialisiet:", serverUrl);

		// Startet periodische Synchronisation
		this.startPeriodicSync();
	}

	/**
	 * Startet periodische Synchronisation alle 60 Sekunden (optimiert)
	 */
	startPeriodicSync() {
		if (this.serverSyncInterval) {
			clearInterval(this.serverSyncInterval);
		}

		this.serverSyncInterval = setInterval(() => {
			// Nur synchronisieren wenn keine andere Sync-Operation läuft UND Daten geändert wurden
			if (
				!this.isApplyingServerData &&
				!window.isApplyingServerData &&
				!window.isLoadingServerData &&
				this.hasDataChanged()
			) {
				this.syncWithServer();
			} else {
				// console.log("⏸️ Periodische Sync übersprungen (keine Änderungen oder Sync aktiv)");
			}
		}, 60000); // 60 Sekunden statt 30 für bessere Performance

		console.log(
			"⏰ Periodische Server-Sync gestartet (60s Intervall, Change-Detection)"
		);
	}

	/**
	 * Stoppt die periodische Synchronisation
	 */
	stopPeriodicSync() {
		if (this.serverSyncInterval) {
			clearInterval(this.serverSyncInterval);
			this.serverSyncInterval = null;
			console.log("⏹️ Periodische Server-Sync gestoppt");
		}
	}

	/**
	 * Synchronisiert Daten mit dem Server (optimiert)
	 */
	async syncWithServer() {
		if (!this.serverSyncUrl) {
			console.warn("⚠️ Server-URL nicht konfiguriert");
			return false;
		}

		// Verhindere gleichzeitige Sync-Operationen
		if (window.isSavingToServer) {
			// console.log("⏸️ Server-Sync übersprungen (Speicherung läuft bereits)");
			return false;
		}

		// Performance: Prüfe erst ob sich Daten geändert haben
		if (!this.hasDataChanged()) {
			// console.log("⏸️ Server-Sync übersprungen (keine Änderungen)");
			return true; // Kein Fehler, nur keine Änderungen
		}

		window.isSavingToServer = true;

		try {
			// Aktuelle Daten sammeln
			const currentData = this.collectCurrentData();

			if (!currentData) {
				console.warn("⚠️ Keine Daten zum Synchronisieren verfügbar");
				return false;
			}

			// Optimierung: Verwende AbortController für Timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s Timeout

			// Daten an Server senden
			const response = await fetch(this.serverSyncUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(currentData),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (response.ok) {
				// console.log("✅ Server-Sync erfolgreich");
				return true;
			} else {
				console.warn("⚠️ Server-Sync fehlgeschlagen:", response.status);
				return false;
			}
		} catch (error) {
			if (error.name === "AbortError") {
				console.warn("⚠️ Server-Sync Timeout (10s)");
			} else {
				console.error("❌ Server-Sync Fehler:", error);
			}
			return false;
		} finally {
			window.isSavingToServer = false;
		}
	}

	/**
	 * Sammelt aktuelle Daten für Server-Sync
	 */
	collectCurrentData() {
		try {
			// Verwende hangarData falls verfügbar
			if (
				window.hangarData &&
				typeof window.hangarData.collectAllHangarData === "function"
			) {
				const data = window.hangarData.collectAllHangarData();

				// *** NEU: Display Options ergänzen ***
				if (window.displayOptions) {
					// Sammle aktuelle UI-Werte
					window.displayOptions.collectFromUI();

					// Füge Display Options zu den Einstellungen hinzu
					if (!data.settings) data.settings = {};
					data.settings.displayOptions = { ...window.displayOptions.current };

					console.log(
						"🎛️ Display Options zu Server-Daten hinzugefügt:",
						data.settings.displayOptions
					);
				}

				return data;
			}

			// Fallback: Sammle Basis-Daten
			const data = {
				timestamp: new Date().toISOString(),
				projectName:
					document.getElementById("projectName")?.value || "Unbenannt",
				settings: JSON.parse(
					localStorage.getItem("hangarPlannerSettings") || "{}"
				),
				metadata: {
					lastSync: new Date().toISOString(),
					source: "server-sync-lite",
				},
			};

			// *** NEU: Display Options auch im Fallback hinzufügen ***
			if (window.displayOptions) {
				window.displayOptions.collectFromUI();
				data.settings.displayOptions = { ...window.displayOptions.current };
				console.log("🎛️ Display Options zu Fallback-Daten hinzugefügt");
			}

			return data;
		} catch (error) {
			console.error("❌ Fehler beim Sammeln der Daten:", error);
			return null;
		}
	}

	/**
	 * Lädt Daten vom Server
	 */
	async loadFromServer() {
		if (!this.serverSyncUrl) {
			console.warn("⚠️ Server-URL nicht konfiguriert");
			return null;
		}

		try {
			const response = await fetch(this.serverSyncUrl + "?action=load", {
				method: "GET",
				headers: {
					Accept: "application/json",
				},
			});

			if (response.ok) {
				const data = await response.json();
				console.log("✅ Daten vom Server geladen");
				return data;
			} else {
				console.warn("⚠️ Server-Load fehlgeschlagen:", response.status);
				return null;
			}
		} catch (error) {
			console.error("❌ Server-Load Fehler:", error);
			return null;
		}
	}

	/**
	 * Wendet Server-Daten auf die Anwendung an - KOORDINIERT
	 */
	async applyServerData(serverData) {
		if (!serverData) {
			console.warn("⚠️ Keine Server-Daten zum Anwenden");
			return false;
		}

		// Verhindere gleichzeitige Anwendung von Server-Daten
		if (this.isApplyingServerData) {
			console.log("⏸️ Server-Daten werden bereits angewendet, überspringe");
			return false;
		}

		try {
			// KRITISCH: Flag setzen um localStorage-Konflikte zu vermeiden
			this.isApplyingServerData = true;
			window.isApplyingServerData = true;

			console.log("📥 Wende Server-Daten über Koordinator an:", serverData);

			// *** PRIORITÄT 1: Display Options aus Serverdaten anwenden ***
			if (
				serverData.settings &&
				serverData.settings.displayOptions &&
				window.displayOptions
			) {
				// Server-Display-Options in das aktuelle Display Options System laden
				window.displayOptions.current = {
					...window.displayOptions.defaults,
					...serverData.settings.displayOptions,
				};
				window.displayOptions.updateUI();
				window.displayOptions.applySettings();
				console.log(
					"🎛️ Display Options vom Server angewendet:",
					serverData.settings.displayOptions
				);
			} else if (serverData.settings) {
				// Legacy-Format: Direkte Einstellungen ohne displayOptions
				if (window.displayOptions) {
					const legacySettings = {
						tilesCount: serverData.settings.tilesCount || 8,
						secondaryTilesCount: serverData.settings.secondaryTilesCount || 4,
						layout: serverData.settings.layout || 4,
					};
					window.displayOptions.current = {
						...window.displayOptions.defaults,
						...legacySettings,
					};
					window.displayOptions.updateUI();
					window.displayOptions.applySettings();
					console.log(
						"🎛️ Legacy-Einstellungen vom Server angewendet:",
						legacySettings
					);
				}
			}

			// *** PRIORITÄT 2: Kachel-Daten anwenden ***
			// NEUE LOGIK: Verwende zentralen Datenkoordinator
			if (window.dataCoordinator) {
				// Server-Daten haben höchste Priorität
				window.dataCoordinator.loadProject(serverData, "server");
				console.log("✅ Server-Daten über Datenkoordinator angewendet");
				return true;
			}

			// Fallback: Direkte Anwendung (nur wenn Koordinator nicht verfügbar)
			if (
				window.hangarData &&
				typeof window.hangarData.applyLoadedHangarPlan === "function"
			) {
				const result = window.hangarData.applyLoadedHangarPlan(serverData);
				console.log("✅ Server-Daten über hangarData angewendet (Fallback)");
				return result;
			}

			// Basis-Fallback
			if (serverData.metadata && serverData.metadata.projectName) {
				const projectNameInput = document.getElementById("projectName");
				if (projectNameInput) {
					projectNameInput.value = serverData.metadata.projectName;
					console.log(
						"📝 Projektname gesetzt:",
						serverData.metadata.projectName
					);
				}
			}

			console.log("✅ Server-Daten angewendet (Basis-Fallback)");
			return true;
		} catch (error) {
			console.error("❌ Fehler beim Anwenden der Server-Daten:", error);
			return false;
		} finally {
			// Flag zurücksetzen mit Verzögerung um Race Conditions zu vermeiden
			setTimeout(() => {
				this.isApplyingServerData = false;
				window.isApplyingServerData = false;
				console.log("🏁 Server-Sync abgeschlossen, Flag zurückgesetzt");

				// Event-Handler nach Server-Load reaktivieren
				this.reactivateEventHandlers();
			}, 1000); // 1 Sekunde Verzögerung
		}
	}

	/**
	 * NEUE HILFSFUNKTION: Wendet Kachel-Daten auf die UI an
	 */
	applyTileData(tiles, isSecondary = false) {
		console.log(
			`🏗️ Wende ${isSecondary ? "sekundäre" : "primäre"} Kachel-Daten an:`,
			tiles.length,
			"Kacheln"
		);

		tiles.forEach((tileData, index) => {
			const tileId = tileData.tileId || (isSecondary ? 101 + index : 1 + index);

			// Aircraft ID
			if (tileData.aircraftId) {
				const aircraftInput = document.getElementById(`aircraft-${tileId}`);
				if (aircraftInput) {
					aircraftInput.value = tileData.aircraftId;
					console.log(
						`✈️ Aircraft ID gesetzt: ${tileId} = ${tileData.aircraftId}`
					);
				}
			}

			// Position
			if (tileData.position) {
				const positionInput =
					document.getElementById(`hangar-position-${tileId}`) ||
					document.getElementById(`position-${tileId}`);
				if (positionInput) {
					positionInput.value = tileData.position;
					console.log(`📍 Position gesetzt: ${tileId} = ${tileData.position}`);
				}
			}

			// Notes
			if (tileData.notes) {
				const notesInput = document.getElementById(`notes-${tileId}`);
				if (notesInput) {
					notesInput.value = tileData.notes;
					console.log(`📝 Notizen gesetzt: ${tileId} = ${tileData.notes}`);
				}
			}

			// Arrival Time
			if (tileData.arrivalTime) {
				const arrivalInput = document.getElementById(`arrival-time-${tileId}`);
				if (arrivalInput) {
					arrivalInput.value = tileData.arrivalTime;
					console.log(
						`🛬 Ankunftszeit gesetzt: ${tileId} = ${tileData.arrivalTime}`
					);
				}
			}

			// Departure Time
			if (tileData.departureTime) {
				const departureInput = document.getElementById(
					`departure-time-${tileId}`
				);
				if (departureInput) {
					departureInput.value = tileData.departureTime;
					console.log(
						`🛫 Abflugzeit gesetzt: ${tileId} = ${tileData.departureTime}`
					);
				}
			}

			// Status
			if (tileData.status) {
				const statusSelect = document.getElementById(`status-${tileId}`);
				if (statusSelect) {
					statusSelect.value = tileData.status;
					console.log(`🚦 Status gesetzt: ${tileId} = ${tileData.status}`);
				}
			}

			// Tow Status
			if (tileData.towStatus) {
				const towStatusSelect = document.getElementById(`tow-status-${tileId}`);
				if (towStatusSelect) {
					towStatusSelect.value = tileData.towStatus;
					console.log(
						`🚚 Tow Status gesetzt: ${tileId} = ${tileData.towStatus}`
					);
				}
			}
		});
	}

	/**
	 * Prüft ob Daten geändert wurden (für optimierte Sync)
	 */
	hasDataChanged() {
		try {
			const currentData = this.collectCurrentData();
			const currentChecksum = this.generateChecksum(
				JSON.stringify(currentData)
			);

			if (this.lastDataChecksum !== currentChecksum) {
				this.lastDataChecksum = currentChecksum;
				return true;
			}

			return false;
		} catch (error) {
			console.error("❌ Fehler bei Change-Detection:", error);
			return true; // Bei Fehler sync durchführen
		}
	}

	/**
	 * Generiert eine einfache Checksumme
	 */
	generateChecksum(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return hash.toString();
	}

	/**
	 * Manueller Sync-Trigger
	 */
	async manualSync() {
		console.log("🔄 Manueller Server-Sync gestartet...");
		const success = await this.syncWithServer();

		if (success) {
			console.log("✅ Manueller Server-Sync erfolgreich");
			// Optional: Erfolgsmeldung anzeigen
			if (window.showNotification) {
				window.showNotification("Daten erfolgreich synchronisiert", "success");
			}
		} else {
			console.error("❌ Manueller Server-Sync fehlgeschlagen");
			// Optional: Fehlermeldung anzeigen
			if (window.showNotification) {
				window.showNotification("Synchronisation fehlgeschlagen", "error");
			}
		}

		return success;
	}

	/**
	 * Status der Server-Sync
	 */
	getStatus() {
		return {
			serverUrl: this.serverSyncUrl,
			isActive: !!this.serverSyncInterval,
			lastSync: this.lastDataChecksum ? new Date().toISOString() : null,
			isApplyingData: this.isApplyingServerData,
		};
	}

	/**
	 * Cleanup beim Zerstören
	 */
	destroy() {
		this.stopPeriodicSync();

		if (this.autoSaveTimeout) {
			clearTimeout(this.autoSaveTimeout);
			this.autoSaveTimeout = null;
		}

		console.log("🗑️ Server-Sync zerstört und bereinigt");
	}

	/**
	 * Testet die Server-Verbindung
	 */
	async testServerConnection(serverUrl) {
		try {
			console.log("🔍 Teste Server-Verbindung zu:", serverUrl);

			const response = await fetch(serverUrl, {
				method: "GET",
				headers: {
					Accept: "application/json",
				},
				// Timeout nach 5 Sekunden
				signal: AbortSignal.timeout(5000),
			});

			if (response.ok || response.status === 404) {
				// 404 ist OK - bedeutet nur, dass noch keine Daten vorhanden sind
				console.log("✅ Server-Verbindung erfolgreich");
				return true;
			} else {
				console.warn("⚠️ Server antwortet mit Status:", response.status);
				return false;
			}
		} catch (error) {
			console.error("❌ Server-Verbindungstest fehlgeschlagen:", error.message);
			return false;
		}
	}

	/**
	 * ERWEITERTE FUNKTION: Reaktiviert Event-Handler nach Server-Load
	 */
	reactivateEventHandlers() {
		console.log("🔄 Reaktiviere Event-Handler nach Server-Load...");

		// Event-Handler für sekundäre Kacheln reaktivieren - MIT VERBESSERTER LOGIK
		if (window.setupSecondaryTileEventListeners) {
			setTimeout(() => {
				const result = window.setupSecondaryTileEventListeners();
				console.log(
					"✅ Event-Handler für sekundäre Kacheln reaktiviert (global):",
					result
				);
			}, 100);
		} else if (
			window.hangarUI &&
			window.hangarUI.setupSecondaryTileEventListeners
		) {
			setTimeout(() => {
				const result = window.hangarUI.setupSecondaryTileEventListeners();
				console.log(
					"✅ Event-Handler für sekundäre Kacheln reaktiviert (hangarUI):",
					result
				);
			}, 100);
		} else {
			console.warn("⚠️ setupSecondaryTileEventListeners nicht verfügbar");
		}

		// Event-Handler über Event-Manager reaktivieren
		if (
			window.hangarEventManager &&
			window.hangarEventManager.setupUnifiedEventHandlers
		) {
			setTimeout(() => {
				window.hangarEventManager.setupUnifiedEventHandlers();
				console.log("✅ Unified Event-Handler reaktiviert");
			}, 200);
		}

		// Status-Indikatoren und UI-Updates
		setTimeout(() => {
			const statusElements = document.querySelectorAll('[id^="status-"]');
			statusElements.forEach((element) => {
				if (element.value && window.updateStatusLights) {
					const cellId = parseInt(element.id.replace("status-", ""));
					if (!isNaN(cellId)) {
						window.updateStatusLights(cellId);
					}
				}
			});
			console.log(
				`✅ ${statusElements.length} Status-Indikatoren aktualisiert`
			);
		}, 300);
	}

	/**
	 * Debug-Funktion: Zeigt aktuellen Sync-Status
	 */
	debugSyncStatus() {
		console.log("🔍 === SYNC STATUS DEBUG ===");
		console.log("Server URL:", this.serverSyncUrl);
		console.log("isApplyingServerData:", this.isApplyingServerData);
		console.log("window.isApplyingServerData:", window.isApplyingServerData);
		console.log("window.isLoadingServerData:", window.isLoadingServerData);
		console.log("window.isSavingToServer:", window.isSavingToServer);
		console.log("Display Options isLoading:", window.displayOptions?.isLoading);
		console.log("Display Options isSaving:", window.displayOptions?.isSaving);
		console.log("Periodische Sync aktiv:", !!this.serverSyncInterval);
		console.log("=== END SYNC STATUS ===");
	}
}

// Globale Instanz für Kompatibilität
window.serverSync = new ServerSync();
window.storageBrowser = window.serverSync; // Alias für Kompatibilität

// Für Kompatibilität mit bestehender storage-browser.js
window.StorageBrowser = ServerSync;

// Auto-Initialisierung mit echter Server-URL
document.addEventListener("DOMContentLoaded", () => {
	// PRODUKTIONS-Server-URL für hangarplanner.de
	const productionServerUrl = "https://hangarplanner.de/sync/data.php";

	// Fallback für lokale Entwicklung
	const localServerUrl = window.location.origin + "/sync/data.php";

	// Prüfe auf Server-Konfiguration oder verwende Produktions-URL
	let serverUrl = localStorage.getItem("hangarServerSyncUrl");

	// Wenn keine URL gespeichert ist, verwende Produktions-URL
	if (!serverUrl) {
		serverUrl = productionServerUrl;
		console.log("🌐 Verwende Produktions-Server:", productionServerUrl);
	} else {
		console.log("💾 Verwende gespeicherte Server-URL:", serverUrl);
	}

	window.serverSync.initSync(serverUrl);
	localStorage.setItem("hangarServerSyncUrl", serverUrl); // Für künftige Verwendung speichern

	console.log("🚀 Auto-initialisiert Server-Sync mit URL:", serverUrl);

	// SERVER-VERBINDUNGSTEST
	setTimeout(async () => {
		const isServerReachable = await window.serverSync.testServerConnection(
			serverUrl
		);

		if (!isServerReachable) {
			console.warn("⚠️ Server nicht erreichbar, verwende lokale Speicherung");

			// Fallback auf lokalen Server falls Produktions-Server nicht erreichbar
			if (serverUrl.includes("hangarplanner.de")) {
				const fallbackUrl = window.location.origin + "/sync/data.php";
				console.log("🔄 Versuche Fallback auf lokalen Server:", fallbackUrl);

				const isFallbackReachable =
					await window.serverSync.testServerConnection(fallbackUrl);
				if (isFallbackReachable) {
					window.serverSync.initSync(fallbackUrl);
					localStorage.setItem("hangarServerSyncUrl", fallbackUrl);
					console.log("✅ Fallback auf lokalen Server erfolgreich");
				}
			}
		} else {
			console.log("✅ Server-Verbindung bestätigt");
		}
	}, 1000);

	// KOORDINIERTES AUTO-LOAD: Verhindert Race Conditions und mehrfaches Laden
	setTimeout(async () => {
		// Race Condition Guard - verhindert mehrfaches gleichzeitiges Laden
		if (window.serverSync.isApplyingServerData || window.isLoadingServerData) {
			console.log("⏸️ Server-Load bereits aktiv, überspringe Auto-Load");
			return;
		}

		window.isLoadingServerData = true;

		try {
			console.log("� Versuche koordinierten Server-Daten-Load beim Start...");

			const serverData = await window.serverSync.loadFromServer();

			if (serverData && !serverData.error) {
				// KRITISCHE PRÜFUNG: Nur laden wenn Server-Daten nicht leer sind
				const hasValidServerData =
					(serverData.primaryTiles && serverData.primaryTiles.length > 0) ||
					(serverData.secondaryTiles && serverData.secondaryTiles.length > 0) ||
					(serverData.settings && serverData.settings.displayOptions) ||
					(serverData.settings && Object.keys(serverData.settings).length > 0);

				if (hasValidServerData) {
					console.log("📥 Gültige Server-Daten gefunden, wende sie an...");
					const applied = await window.serverSync.applyServerData(serverData);

					if (applied) {
						console.log("✅ Server-Daten erfolgreich angewendet");
					} else {
						console.log("⚠️ Server-Daten konnten nicht angewendet werden");
					}
				} else {
					console.log(
						"📭 Server-Daten sind leer, behalte lokale Einstellungen"
					);

					// Bei leeren Server-Daten: Speichere aktuelle lokale Daten auf Server (debounced)
					if (window.displayOptions) {
						// Verzögert um Server-Last zu reduzieren
						setTimeout(async () => {
							await window.displayOptions.saveToServer();
							console.log(
								"💾 Lokale Einstellungen auf Server gesichert (debounced)"
							);
						}, 3000);
					}
				}
			} else {
				console.log("📭 Keine Server-Daten vorhanden, erstelle Basis-Daten");

				// Erstelle Basis-Datenstruktur auf Server (debounced)
				if (window.displayOptions) {
					setTimeout(async () => {
						await window.displayOptions.saveToServer();
						console.log(
							"🏗️ Basis-Einstellungen auf Server erstellt (debounced)"
						);
					}, 5000);
				}
			}
		} catch (error) {
			console.log(
				"⚠️ Server-Daten konnten nicht geladen werden:",
				error.message
			);
		} finally {
			window.isLoadingServerData = false;
		}
	}, 3000); // Erhöht auf 3 Sekunden für bessere Performance
});

console.log(
	"📦 Server-Sync-Modul geladen (Performance-optimiert: 60s Intervall, Change-Detection, Debouncing)"
);

// Globale Debug-Funktion für Synchronisations-Probleme
window.debugSync = function () {
	if (window.serverSync) {
		window.serverSync.debugSyncStatus();
	} else {
		console.log("❌ ServerSync nicht verfügbar");
	}
};

// Hilfe-Funktion
window.syncHelp = function () {
	console.log(`
🔧 SYNCHRONISATION DEBUG HILFE

Verfügbare Befehle:
- window.debugSync()                    → Zeigt aktuellen Sync-Status
- window.serverSync.manualSync()       → Startet manuellen Server-Sync
- window.displayOptions.load()         → Lädt Display Options vom Server
- window.displayOptions.saveToServer() → Speichert Display Options
- window.displayOptions.getPerformanceStats() → Performance-Statistiken

Performance-Flags:
- window.isApplyingServerData           → Server-Daten werden gerade angewendet
- window.isLoadingServerData            → Server-Daten werden gerade geladen
- window.isSavingToServer               → Daten werden gerade gespeichert

Performance-Optimierungen:
✅ Periodische Sync: 60s Intervall (statt 30s)
✅ Change-Detection: Nur bei Änderungen synchronisieren
✅ Debounced Saves: Sammelt mehrere Änderungen (1s Verzögerung)
✅ Request Timeouts: 8-10s Timeouts für Server-Anfragen
✅ Race Condition Guards: Verhindert mehrfache gleichzeitige Operationen
	`);
};
