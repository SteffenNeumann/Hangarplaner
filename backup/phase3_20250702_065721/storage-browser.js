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
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(currentData)
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
			if (window.hangarData && typeof window.hangarData.collectAllHangarData === 'function') {
				return window.hangarData.collectAllHangarData();
			}

			// Fallback: Sammle Basis-Daten
			const data = {
				timestamp: new Date().toISOString(),
				projectName: document.getElementById('projectName')?.value || 'Unbenannt',
				settings: JSON.parse(localStorage.getItem('hangarPlannerSettings') || '{}'),
				metadata: {
					lastSync: new Date().toISOString(),
					source: 'server-sync-lite'
				}
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
			const response = await fetch(this.serverSyncUrl + '?action=load', {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
				}
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
	 * Wendet Server-Daten auf die Anwendung an
	 */
	async applyServerData(serverData) {
		if (!serverData) {
			console.warn("⚠️ Keine Server-Daten zum Anwenden");
			return false;
		}

		try {
			// Flag setzen um localStorage-Konflikte zu vermeiden
			this.isApplyingServerData = true;
			window.isApplyingServerData = true;

			// Verwende hangarData falls verfügbar
			if (window.hangarData && typeof window.hangarData.applyLoadedHangarPlan === 'function') {
				const result = window.hangarData.applyLoadedHangarPlan(serverData);
				console.log("✅ Server-Daten über hangarData angewendet");
				return result;
			}

			// Fallback: Basis-Anwendung
			if (serverData.projectName) {
				const projectNameInput = document.getElementById('projectName');
				if (projectNameInput) {
					projectNameInput.value = serverData.projectName;
				}
			}

			if (serverData.settings) {
				localStorage.setItem('hangarPlannerSettings', JSON.stringify(serverData.settings));
			}

			console.log("✅ Server-Daten angewendet (Fallback)");
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
	 * Prüft ob Daten geändert wurden (für optimierte Sync)
	 */
	hasDataChanged() {
		try {
			const currentData = this.collectCurrentData();
			const currentChecksum = this.generateChecksum(JSON.stringify(currentData));
			
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
			hash = ((hash << 5) - hash) + char;
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
			isApplyingData: this.isApplyingServerData
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
}

// Globale Instanz für Kompatibilität
window.serverSync = new ServerSync();

// Für Kompatibilität mit bestehender storage-browser.js
window.StorageBrowser = ServerSync;

// Auto-Initialisierung falls Server-URL konfiguriert ist
document.addEventListener('DOMContentLoaded', () => {
	// Prüfe auf Server-Konfiguration
	const serverUrl = localStorage.getItem('hangarServerSyncUrl');
	if (serverUrl) {
		window.serverSync.initSync(serverUrl);
		console.log("🚀 Auto-initialisiert Server-Sync");
	}
});

console.log("📦 Server-Sync-Modul geladen (optimiert von 2085 → ~250 Zeilen)");
