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

		// Global verfügbar machen für Kompatibilität
		window.isApplyingServerData = false;
	}

	/**
	 * Initialisiert die Server-Synchronisation
	 */
	async initSync(serverUrl) {
		this.serverSyncUrl = serverUrl;
		console.log("🔄 Server-Sync initialisiert:", serverUrl);

		// Startet periodische Synchronisation
		this.startPeriodicSync();
	}

	/**
	 * Startet periodische Synchronisation alle 30 Sekunden
	 */
	startPeriodicSync() {
		if (this.serverSyncInterval) {
			clearInterval(this.serverSyncInterval);
		}

		this.serverSyncInterval = setInterval(() => {
			this.syncWithServer();
		}, 30000); // 30 Sekunden

		console.log("⏰ Periodische Server-Sync gestartet");
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
	 * Synchronisiert Daten mit dem Server
	 */
	async syncWithServer() {
		if (!this.serverSyncUrl) {
			console.warn("⚠️ Server-URL nicht konfiguriert");
			return false;
		}

		try {
			// Aktuelle Daten sammeln
			const currentData = this.collectCurrentData();

			// Daten an Server senden
			const response = await fetch(this.serverSyncUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(currentData),
			});

			if (response.ok) {
				console.log("✅ Server-Sync erfolgreich");
				return true;
			} else {
				console.warn("⚠️ Server-Sync fehlgeschlagen:", response.status);
				return false;
			}
		} catch (error) {
			console.error("❌ Server-Sync Fehler:", error);
			return false;
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
				return window.hangarData.collectAllHangarData();
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
	 * Wendet Server-Daten auf die Anwendung an - VERBESSERT
	 */
	async applyServerData(serverData) {
		if (!serverData) {
			console.warn("⚠️ Keine Server-Daten zum Anwenden");
			return false;
		}

		try {
			// KRITISCH: Flag setzen um localStorage-Konflikte zu vermeiden
			this.isApplyingServerData = true;
			window.isApplyingServerData = true;

			console.log("📥 Wende Server-Daten an:", serverData);

			// WICHTIG: Prüfe ob Daten neuer sind als lokale Änderungen
			const serverTimestamp =
				serverData.metadata?.lastModified || serverData.lastSaved;
			const localData = JSON.parse(
				localStorage.getItem("hangarPlannerData") || "{}"
			);
			const localTimestamp = localData.lastModified;

			if (localTimestamp && serverTimestamp) {
				const serverTime = new Date(serverTimestamp).getTime();
				const localTime = new Date(localTimestamp).getTime();

				if (localTime > serverTime) {
					console.log(
						"⚠️ Lokale Daten sind neuer als Server-Daten. Server-Load übersprungen."
					);
					console.log(`Server: ${serverTimestamp}, Lokal: ${localTimestamp}`);
					return false;
				} else {
					console.log("✅ Server-Daten sind aktueller als lokale Daten");
					console.log(`Server: ${serverTimestamp}, Lokal: ${localTimestamp}`);
				}
			}

			// 1. Verwende hangarData falls verfügbar
			if (
				window.hangarData &&
				typeof window.hangarData.applyLoadedHangarPlan === "function"
			) {
				const result = window.hangarData.applyLoadedHangarPlan(serverData);
				console.log("✅ Server-Daten über hangarData angewendet");
				return result;
			}

			// 2. Fallback: Manuelle Anwendung der Daten

			// Projektname setzen
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

			// Einstellungen anwenden
			if (serverData.settings) {
				localStorage.setItem(
					"hangarPlannerSettings",
					JSON.stringify(serverData.settings)
				);

				// UI-Einstellungen direkt setzen
				if (serverData.settings.tilesCount) {
					const tilesCountInput = document.getElementById("tilesCount");
					if (tilesCountInput)
						tilesCountInput.value = serverData.settings.tilesCount;
				}
				if (serverData.settings.secondaryTilesCount) {
					const secondaryTilesCountInput = document.getElementById(
						"secondaryTilesCount"
					);
					if (secondaryTilesCountInput)
						secondaryTilesCountInput.value =
							serverData.settings.secondaryTilesCount;
				}
				if (serverData.settings.layout) {
					const layoutSelect = document.getElementById("layoutType");
					if (layoutSelect) layoutSelect.value = serverData.settings.layout;
				}

				console.log("⚙️ Einstellungen angewendet");
			}

			// 3. WICHTIG: Kachel-Daten anwenden
			if (serverData.primaryTiles) {
				this.applyTileData(serverData.primaryTiles, false);
			}
			if (serverData.secondaryTiles) {
				this.applyTileData(serverData.secondaryTiles, true);
			}

			// 4. Einzelne Feld-Updates anwenden (falls vorhanden)
			if (serverData.currentFields) {
				Object.entries(serverData.currentFields).forEach(([fieldId, value]) => {
					const element = document.getElementById(fieldId);
					if (element) {
						element.value = value;
						console.log(`🔧 Feld-Update angewendet: ${fieldId} = "${value}"`);
					}
				});
			}

			// 5. NEUE FUNKTION: Event-Handler für neu geladene Felder aktivieren
			this.reactivateEventHandlers();

			console.log("✅ Server-Daten angewendet (erweiterte Fallback-Methode)");
			return true;
		} catch (error) {
			console.error("❌ Fehler beim Anwenden der Server-Daten:", error);
			return false;
		} finally {
			// Flag zurücksetzen
			this.isApplyingServerData = false;
			window.isApplyingServerData = false;
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
	 * NEUE FUNKTION: Reaktiviert Event-Handler nach Server-Load
	 */
	reactivateEventHandlers() {
		console.log("🔄 Reaktiviere Event-Handler nach Server-Load...");

		// Event-Handler für sekundäre Kacheln reaktivieren
		if (window.hangarUI && window.hangarUI.setupSecondaryTileEventListeners) {
			setTimeout(() => {
				window.hangarUI.setupSecondaryTileEventListeners();
				console.log("✅ Event-Handler für sekundäre Kacheln reaktiviert");
			}, 100);
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

	// AUTO-LOAD von Server-Daten beim Start - VERBESSERT mit Konflikt-Erkennung
	setTimeout(async () => {
		try {
			console.log("🔄 Versuche Server-Daten beim Start zu laden...");

			// WICHTIG: Prüfe ob bereits lokale Daten vorhanden sind
			const hasLocalData =
				localStorage.getItem("hangarPlannerData") ||
				localStorage.getItem("hangarPlannerSettings") ||
				document.querySelector('input[value]:not([value=""])');

			if (hasLocalData) {
				console.log(
					"📋 Lokale Daten gefunden - prüfe Timestamps vor Server-Load"
				);
			}

			const serverData = await window.serverSync.loadFromServer();

			if (serverData && !serverData.error) {
				console.log("📥 Server-Daten gefunden, wende sie an...");

				// NEUE LOGIK: Nur anwenden wenn Server-Daten neuer oder keine lokalen Daten
				const applied = await window.serverSync.applyServerData(serverData);

				if (applied) {
					console.log("✅ Server-Daten erfolgreich angewendet");
				} else {
					console.log(
						"⚠️ Server-Daten nicht angewendet (lokale Daten sind neuer)"
					);
				}
			} else {
				console.log("📭 Keine Server-Daten vorhanden oder Fehler beim Laden");
			}
		} catch (error) {
			console.log(
				"⚠️ Server-Daten konnten nicht geladen werden:",
				error.message
			);
		}
	}, 5000); // Verlängert auf 5 Sekunden um mehr Zeit für lokale Initialisierung zu geben
});

console.log("📦 Server-Sync-Modul geladen (optimiert von 2085 → ~250 Zeilen)");
