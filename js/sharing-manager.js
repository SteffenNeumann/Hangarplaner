/**
 * Sharing Manager für HangarPlanner
 * Implementiert Live-Synchronisation und URL-Sharing zwischen Benutzern
 * Erweitert die bestehende Server-Sync Funktionalität um Sharing-Features
 */

class SharingManager {
	constructor() {
		// NEUE MODI-DEFINITIONEN
		this.syncMode = "standalone"; // "standalone", "sync", "master"
		this.isLiveSyncEnabled = false;
		this.isMasterMode = false;
		this.initialized = false;

		// Presence state
		this.presence = {
			url: null,
			sessionId: null,
			displayName: null,
			heartbeatId: null,
			listPollId: null,
			lastUsers: []
		};
		this.presenceTTLSeconds = 90;
		this.presenceHeartbeatMs = 30000; // 30s
		this.presenceListPollMs = 30000; // 30s

		// Singleton Pattern
		if (SharingManager.instance) {
			return SharingManager.instance;
		}
		SharingManager.instance = this;
	}

	/**
	 * Initialisiert den vereinfachten Master-Slave Manager
	 */
	init() {
		if (this.initialized) {
			console.warn("⚠️ Sharing Manager bereits initialisiert");
			return;
		}

		this.setupEventHandlers();
		this.loadSavedSharingSettings();

		// Initial-Status setzen basierend auf gespeicherten Einstellungen
		this.updateAllSyncDisplays();

		// Start presence heartbeat/listener
		this.initPresence();

		this.initialized = true;

		console.log("🔗 Sharing Manager initialisiert - Modus:", this.syncMode);
	}

	/**
	 * ÜBERARBEITET: Setzt Event-Handler für neue Dual-Toggle-UI
	 */
	setupEventHandlers() {
		// Read Data Toggle - Empfängt Server-Updates
		const readDataToggle = document.getElementById("readDataToggle");
		if (readDataToggle) {
			readDataToggle.addEventListener("change", (e) => {
				this.handleReadDataToggle(e.target.checked);
			});
		}

		// Write Data Toggle - Sendet Daten an Server (Master-Modus)
		const writeDataToggle = document.getElementById("writeDataToggle");
		if (writeDataToggle) {
			writeDataToggle.addEventListener("change", (e) => {
				this.handleWriteDataToggle(e.target.checked);
			});
		}

		// Manual Sync Button
		const manualSyncBtn = document.getElementById("manualSyncBtn");
		if (manualSyncBtn) {
			manualSyncBtn.addEventListener("click", () => {
				this.performManualSync();
			});
		}

		// Sync Status Button - Zeigt detaillierten Status
		const syncStatusBtn = document.getElementById("syncStatusBtn");
		if (syncStatusBtn) {
			// Rechtsklick für Status-Anzeige
			syncStatusBtn.addEventListener("contextmenu", (e) => {
				e.preventDefault();
				this.showSyncStatus();
			});

			// Linksklick für Status-Anzeige
			syncStatusBtn.addEventListener("click", () => {
				this.showSyncStatus();
			});
		}

		console.log("🎯 Dual-Toggle Event-Handler registriert");
	}

	/**
	 * NEUE Dual-Toggle-Handler: Read Data Toggle
	 */
	async handleReadDataToggle(enabled) {
		const writeDataToggle = document.getElementById("writeDataToggle");
		const isWriteEnabled = writeDataToggle?.checked || false;

		await this.updateSyncMode(enabled, isWriteEnabled);
		console.log(`📥 Read Data Toggle: ${enabled ? "AN" : "AUS"}`);
	}

	/**
	 * NEUE Dual-Toggle-Handler: Write Data Toggle
	 */
	async handleWriteDataToggle(enabled) {
		const readDataToggle = document.getElementById("readDataToggle");
		const isReadEnabled = readDataToggle?.checked || false;

		await this.updateSyncMode(isReadEnabled, enabled);
		console.log(`📤 Write Data Toggle: ${enabled ? "AN" : "AUS"}`);
	}

	/**
	 * AKTUALISIERT: Zentrale Sync-Modus-Koordination mit sofortigem Server-Load
	 * @param {boolean} readEnabled - Lesen von Server aktiviert
	 * @param {boolean} writeEnabled - Schreiben zum Server aktiviert
	 */
	async updateSyncMode(readEnabled, writeEnabled) {
		console.log(`🔄 Sync-Modus wird geändert: Read=${readEnabled}, Write=${writeEnabled}`);

		// 4 mögliche Kombinationen:
		if (!readEnabled && !writeEnabled) {
			// Beide AUS -> Standalone Mode
			await this.enableStandaloneMode();
		} else if (readEnabled && !writeEnabled) {
			// Nur Read -> Sync Mode (Read-Only)
			await this.enableSyncMode();
			
			// HINZUGEFÜGT: Sofortige Server-Datenladung wenn Read aktiviert wird
			await this.loadServerDataImmediately();
		} else if (!readEnabled && writeEnabled) {
			// Nur Write -> Master Mode (Write-Only) - ungewöhnlich, aber möglich
			await this.enableMasterMode();
		} else {
			// Beide AN -> Master Mode mit Read-Write
			await this.enableMasterMode();
			
			// HINZUGEFÜGT: Sofortige Server-Datenladung wenn Read+Write aktiviert wird
			await this.loadServerDataImmediately();
		}

		// Einstellungen speichern
		this.saveSharingSettings();

		console.log(
			`✅ Sync-Modus aktualisiert: Read=${readEnabled}, Write=${writeEnabled}, Mode=${this.syncMode}`
		);
	}

	/**
	 * NEU: Aktiviert Standalone-Modus (nur localStorage, einmalige Server-Ladung)
	 */
	async enableStandaloneMode() {
		try {
			console.log("🏠 Aktiviere Standalone-Modus...");

			// ServerSync komplett stoppen
			if (window.serverSync) {
				window.serverSync.stopPeriodicSync();

				if (window.serverSync.slaveCheckInterval) {
					clearInterval(window.serverSync.slaveCheckInterval);
					window.serverSync.slaveCheckInterval = null;
				}

				window.serverSync.isMaster = false;
				window.serverSync.isSlaveActive = false;
			}

			// Lokale Flags setzen
			this.syncMode = "standalone";
			this.isLiveSyncEnabled = false;
			this.isMasterMode = false;

// UI aktualisieren
			this.updateAllSyncDisplays("Standalone", false);
			this.applyReadOnlyUIState(false);
			this.showNotification(
				"Standalone-Modus aktiviert - Nur lokale Speicherung",
				"info"
			);

			console.log("✅ Standalone-Modus aktiviert");
		} catch (error) {
			console.error("❌ Fehler beim Aktivieren des Standalone-Modus:", error);
			this.showNotification("Fehler beim Wechsel zu Standalone-Modus", "error");
		}
	}

	/**
	 * NEU: Aktiviert Sync-Modus (Slave) - Empfängt Server-Updates
	 */
	async enableSyncMode() {
		try {
			console.log("📡 Aktiviere Sync-Modus (Slave)...");

			if (window.serverSync) {
				// Bestimme Rolle - für Sync-Modus immer Slave
				window.serverSync.isMaster = false;
				window.serverSync.isSlaveActive = true;

				// ERWEITERT: Explicit Slave-Modus starten mit Error-Handling
				console.log("🔄 Starte Slave-Polling für Read-Modus...");
				await window.serverSync.startSlaveMode();

				// ZUSÄTZLICH: Verify dass Polling läuft
				if (window.serverSync.slaveCheckInterval) {
					console.log("✅ Slave-Polling-Intervall erfolgreich gestartet");
				} else {
					console.warn("⚠️ Slave-Polling-Intervall nicht gestartet - Retry...");
					// Retry nach kurzer Verzögerung
					setTimeout(async () => {
						await window.serverSync.startSlaveMode();
						console.log("🔄 Slave-Polling Retry ausgeführt");
					}, 2000);
				}

				// Lokale Flags setzen
				this.syncMode = "sync";
				this.isLiveSyncEnabled = true;
				this.isMasterMode = false;

// UI aktualisieren
				this.updateAllSyncDisplays("Sync", true);
				this.applyReadOnlyUIState(true);
				this.showNotification(
					"Sync-Modus aktiviert - Empfange Server-Updates",
					"info"
				);

				console.log("✅ Sync-Modus (Slave) aktiviert");
			} else {
				throw new Error("ServerSync nicht verfügbar");
			}
		} catch (error) {
			console.error("❌ Fehler beim Aktivieren des Sync-Modus:", error);
			this.showNotification(
				"Fehler beim Aktivieren der Synchronisation",
				"error"
			);

			// Bei Fehler zurück zu Standalone
			await this.enableStandaloneMode();
		}
	}

	/**
	 * NEU: Aktiviert Master-Modus - Sendet Daten an Server
	 */
	async enableMasterMode() {
		try {
			console.log("👑 Aktiviere Master-Modus...");

			if (window.serverSync) {
				// Master-Rolle setzen
				window.serverSync.isMaster = true;
				window.serverSync.isSlaveActive = false;

				// Starte Master-Sync
				await window.serverSync.startMasterMode();

				// Lokale Flags setzen
				this.syncMode = "master";
				this.isLiveSyncEnabled = true;
				this.isMasterMode = true;

// UI aktualisieren
				this.updateAllSyncDisplays("Master", true);
				this.applyReadOnlyUIState(false);
				this.showNotification(
					"Master-Modus aktiviert - Sende Daten an Server",
					"success"
				);

				console.log("✅ Master-Modus aktiviert");
			} else {
				throw new Error("ServerSync nicht verfügbar");
			}
		} catch (error) {
			console.error("❌ Fehler beim Aktivieren des Master-Modus:", error);
			this.showNotification("Fehler beim Aktivieren des Master-Modus", "error");

			// Bei Fehler zurück zu Sync-Modus
			await this.enableSyncMode();
		}
	}

	/**
	 * NEU: Schaltet zwischen den Modi um (für Button-Klicks)
	 * Standalone -> Sync -> Master -> Standalone
	 */
	async cycleSyncMode() {
		switch (this.syncMode) {
			case "standalone":
				await this.enableSyncMode();
				break;
			case "sync":
				await this.enableMasterMode();
				break;
			case "master":
				await this.enableStandaloneMode();
				// Toggle ausschalten da zurück zu Standalone
				const liveSyncToggle = document.getElementById("liveSyncToggle");
				if (liveSyncToggle) {
					liveSyncToggle.checked = false;
				}
				break;
			default:
				await this.enableStandaloneMode();
		}

		this.saveSharingSettings();
	}

	/**
	 * Startet Live Synchronisation
	 */
	startLiveSync() {
		// Stoppe bestehende Intervalle
		if (this.shareCheckInterval) {
			clearInterval(this.shareCheckInterval);
		}

		// Starte Live Sync Intervall (30 Sekunden für bessere Responsivität)
		this.shareCheckInterval = setInterval(async () => {
			await this.performLiveSync();
		}, 30000);

		console.log("⏰ Live Sync Intervall gestartet (30s)");
	}

	/**
	 * AKTUALISIERT: Führt Master-Slave Synchronisation durch
	 */
	async performLiveSync() {
		if (!this.isLiveSyncEnabled) {
			return;
		}

		try {
			// Verwende bestehende Server-Sync Infrastruktur
			if (window.serverSync && window.serverSync.syncWithServer) {
				const success = await window.serverSync.syncWithServer();

				if (success) {
					console.log("🔄 Live Sync erfolgreich");
					this.updateSyncStatusIndicator("success");
				} else {
					console.warn("⚠️ Live Sync teilweise fehlgeschlagen");
					this.updateSyncStatusIndicator("warning");
				}
			}
		} catch (error) {
			console.error("❌ Live Sync Fehler:", error);
			this.updateSyncStatusIndicator("error");
		}
	}

	/**
	 * AKTUALISIERT: Aktualisiert alle Sync-Status-Anzeigen (Backward-kompatibel)
	 */
	updateAllSyncDisplays(status = null, isActive = null) {
		// Wenn Parameter übergeben werden, aktualisiere auch die traditionellen Displays
		if (status !== null && isActive !== null) {
			this.updateSyncStatusDisplay(status, isActive);
			this.updateWidgetSyncDisplay(status, isActive);
		}
		
		// Aktualisiere immer die neue Dual-Toggle-UI
		this.updateSyncStatusDisplayNew();
		
		console.log(`🔄 Alle Sync-Anzeigen aktualisiert${status ? ` (${status}, ${isActive})` : ''}`);
	}

	/**
	 * NEUE: Sync-Status-Anzeige für Dual-Toggle-UI
	 */
	updateSyncStatusDisplayNew() {
		const readToggle = document.getElementById("readDataToggle");
		const writeToggle = document.getElementById("writeDataToggle");
		const modeSpans = document.querySelectorAll('#currentSyncMode, #currentSyncModeSidebar, .currentSyncMode');
		const syncStatusBtn = document.getElementById("syncStatusBtn");

		// Toggle-Zustände auslesen
		const readEnabled = readToggle?.checked || false;
		const writeEnabled = writeToggle?.checked || false;

		// Aktuellen Modus bestimmen und anzeigen
		let modeText = "Standalone";
		let modeEmoji = "🏠";
		let cssClass = "standalone";

		if (readEnabled && writeEnabled) {
			modeText = "Master";
			modeEmoji = "👑";
			cssClass = "mode-master";
		} else if (readEnabled && !writeEnabled) {
			modeText = "Sync";
			modeEmoji = "📡";
			cssClass = "mode-sync";
		} else if (!readEnabled && writeEnabled) {
			modeText = "Write-Only";
			modeEmoji = "📤";
			cssClass = "mode-write";
		}

		// Modus-Anzeige aktualisieren (unterstützt mehrere Anzeigen)
		if (modeSpans && modeSpans.length) {
			modeSpans.forEach((el) => {
				const isCompact = el.classList.contains('compact');
				el.textContent = modeText;
				el.className = `sync-mode-badge ${isCompact ? 'compact ' : ''}${cssClass}`;
			});
		}

		// Manual Sync button enable/disable based on mode
		try {
			const manualSyncBtn = document.getElementById("manualSyncBtn");
			if (manualSyncBtn) {
				const enable = !!writeEnabled; // only enabled when Write is ON (Master)
				manualSyncBtn.disabled = !enable;
				manualSyncBtn.style.opacity = enable ? "" : "0.6";
				manualSyncBtn.style.cursor = enable ? "" : "not-allowed";
				manualSyncBtn.title = enable ? "Trigger a one-time sync now" : "Enable Write Data to allow manual sync";
			}
		} catch (e) {}

		// Sync Status Button aktualisieren
		if (syncStatusBtn) {
			syncStatusBtn.classList.remove(
				"status-success",
				"status-warning",
				"status-error"
			);

			if (this.syncMode !== "standalone") {
				syncStatusBtn.textContent = `${modeEmoji} ${modeText}`;
				syncStatusBtn.classList.add("status-success");
				syncStatusBtn.title = `${modeText}-Modus aktiv - Klick für Details`;
			} else {
				syncStatusBtn.textContent = "📊 Status";
				syncStatusBtn.title = "Sync inaktiv - Klick für Details";
			}
		}

		// Widget-Display auch aktualisieren
		this.updateWidgetSyncDisplay(
			modeText,
			this.syncMode !== "standalone"
		);

		console.log(
			`🎯 UI aktualisiert: Read=${readEnabled}, Write=${writeEnabled}, Mode=${this.syncMode}`
		);
	}

	/**
	 * ÜBERARBEITET: Sync-Status-Anzeige für Menü-Button mit neuen Modi
	 */
	updateSyncStatusDisplay(status, isActive) {
		// Verstecke Share URL Container (nicht mehr benötigt)
		const shareUrlContainer = document.getElementById("shareUrlContainer");
		if (shareUrlContainer) {
			shareUrlContainer.style.display = "none";
		}

		// Update Sync Status Button
		const syncStatusBtn = document.getElementById("syncStatusBtn");
		if (syncStatusBtn) {
			// CSS-Klassen zurücksetzen
			syncStatusBtn.classList.remove(
				"status-success",
				"status-warning",
				"status-error"
			);

			if (isActive) {
				// Bestimme Emoji und CSS-Klasse basierend auf Status
				let emoji = "📊";
				let cssClass = "status-success";
				let title = "Sync Status";

				if (status === "Master") {
					emoji = "👑"; // Krone für Master
					cssClass = "status-success";
					title =
						"Master-Modus aktiv - Klick für Modus-Wechsel, Rechtsklick für Details";
				} else if (status === "Sync" || status === "Slave") {
					emoji = "�"; // Antenne für Sync/Slave
					cssClass = "status-warning";
					title =
						"Sync-Modus aktiv - Klick für Modus-Wechsel, Rechtsklick für Details";
				}

				syncStatusBtn.textContent = `${emoji} ${status}`;
				syncStatusBtn.classList.add(cssClass);
				syncStatusBtn.title = title;

				console.log(
					`🎯 Menü-Button aktualisiert: ${syncStatusBtn.textContent} (${status}-Modus)`
				);
			} else {
				syncStatusBtn.textContent = "📊 Status";
				syncStatusBtn.title = "Sync inaktiv - Klicken für Details";

				console.log(`🎯 Menü-Button auf inaktiv gesetzt`);
			}
		}
	}

	/**
	 * ÜBERARBEITET: Widget-Sync-Display-Update für Info-Widget mit neuen Modi
	 */
updateWidgetSyncDisplay(status, isActive) {
		const syncModeElement = document.getElementById("sync-mode");
		if (syncModeElement) {
			// CSS-Klassen zurücksetzen
			syncModeElement.classList.remove("master", "slave", "standalone", "write-only");

			if (isActive) {
				// Zeige echten Status basierend auf neuen Modi
				if (status === "Master") {
					syncModeElement.textContent = "Master";
					syncModeElement.classList.add("master");
				} else if (status === "Sync" || status === "Slave") {
					syncModeElement.textContent = "Sync Read only";
					syncModeElement.classList.add("slave");
				} else if (status === "Write-Only") {
					syncModeElement.textContent = "Write-only";
					syncModeElement.classList.add("write-only");
				} else {
					// Fallback für unbekannte aktive Status
					syncModeElement.textContent = status;
					syncModeElement.classList.add("master");
				}
			} else {
				// Deaktiviert/Standalone
				syncModeElement.textContent = "Standalone";
				syncModeElement.classList.add("standalone");
			}

			console.log(
				`🎯 Widget-Status aktualisiert: ${
					syncModeElement.textContent
				} (CSS: ${Array.from(syncModeElement.classList).join(", ")})`
			);
		}
	}

	// UI-Zustand für Read-Only (Sync) Mode anwenden/aufheben
	applyReadOnlyUIState(isReadOnly) {
		try {
			const ro = !!isReadOnly;
			document.body.classList.toggle('read-only', ro);
			const containers = [
				document.getElementById('hangarGrid'),
				document.getElementById('secondaryHangarGrid'),
			];
			containers.forEach((container) => {
				if (!container) return;
				const controls = container.querySelectorAll('input, textarea, select');
				controls.forEach((el) => {
					if (ro) {
						// Nur temporär deaktivieren, Originalzustand merken
						if (!el.disabled) {
							el.setAttribute('data-readonly-disabled', 'true');
							el.disabled = true;
						}
					} else {
						if (el.hasAttribute('data-readonly-disabled')) {
							el.disabled = false;
							el.removeAttribute('data-readonly-disabled');
						}
					}
				});
			});


			console.log(`🔒 Read-only UI ${ro ? 'aktiviert' : 'deaktiviert'}`);
		} catch (e) {
			console.warn('⚠️ applyReadOnlyUIState fehlgeschlagen:', e);
		}
	}

// *** OBSOLETE METHODEN - WERDEN NICHT MEHR VERWENDET ***

	/**
	 * Generiert eine eindeutige Projekt-ID
	 */
	generateProjectId() {
		const projectName =
			document.getElementById("projectName")?.value || "HangarPlan";
		const timestamp = Date.now();
		const random = Math.random().toString(36).substr(2, 9);

		return `${projectName.replace(/[^a-zA-Z0-9]/g, "")}_${timestamp}_${random}`;
	}

	/**
	 * Generiert Share URL
	 */
	generateShareUrl() {
		if (!this.currentProjectId) {
			return "";
		}

		const shareParams = new URLSearchParams({
			project: this.currentProjectId,
			sync: "true",
			timestamp: Date.now(),
		});

		return `${this.shareUrlBase}/?${shareParams.toString()}`;
	}

	/**
	 * Aktualisiert Share URL Anzeige
	 */
	updateShareUrlDisplay(url, show) {
		const shareUrlContainer = document.getElementById("shareUrlContainer");
		const shareUrlInput = document.getElementById("shareUrl");

		if (shareUrlContainer) {
			shareUrlContainer.style.display = show ? "block" : "none";
		}

		if (shareUrlInput) {
			shareUrlInput.value = url;
		}
	}

	/**
	 * Kopiert Share URL in die Zwischenablage
	 */
	async copyShareUrlToClipboard() {
		const shareUrlInput = document.getElementById("shareUrl");

		if (!shareUrlInput || !shareUrlInput.value) {
			this.showNotification("Keine Share URL verfügbar", "warning");
			return;
		}

		try {
			await navigator.clipboard.writeText(shareUrlInput.value);
			this.showNotification("Share URL in Zwischenablage kopiert!", "success");

			// Visuelles Feedback
			const copyBtn = document.getElementById("copyShareUrlBtn");
			if (copyBtn) {
				const originalText = copyBtn.textContent;
				copyBtn.textContent = "✅";
				setTimeout(() => {
					copyBtn.textContent = originalText;
				}, 2000);
			}
		} catch (error) {
			console.error("❌ Fehler beim Kopieren:", error);

			// Fallback: Text auswählen
			shareUrlInput.select();
			shareUrlInput.setSelectionRange(0, 99999);

			try {
				document.execCommand("copy");
				this.showNotification(
					"Share URL in Zwischenablage kopiert! (Fallback)",
					"success"
				);
			} catch (fallbackError) {
				this.showNotification("Bitte URL manuell kopieren", "warning");
			}
		}
	}

	/**
	 * Führt manuellen Sync durch
	 */
	async performManualSync() {
		const manualSyncBtn = document.getElementById("manualSyncBtn");

		// Guard: disabled in read-only (Write OFF)
		try {
			const writeToggle = document.getElementById("writeDataToggle");
			if (writeToggle && !writeToggle.checked) {
				this.showNotification("Manual Sync is disabled in read-only mode", "warning");
				return;
			}
		} catch (e) {}

		// Button deaktivieren während Sync
		if (manualSyncBtn) {
			manualSyncBtn.disabled = true;
			manualSyncBtn.textContent = "Syncing...";
		}

		try {
			if (window.serverSync && window.serverSync.manualSync) {
				const success = await window.serverSync.manualSync();

				if (success) {
					this.showNotification(
						"Manuelle Synchronisation erfolgreich",
						"success"
					);
					this.updateSyncStatusIndicator("success");
				} else {
					this.showNotification("Synchronisation fehlgeschlagen", "error");
					this.updateSyncStatusIndicator("error");
				}
			} else {
				this.showNotification("Server-Sync nicht verfügbar", "warning");
			}
		} catch (error) {
			console.error("❌ Manueller Sync Fehler:", error);
			this.showNotification("Synchronisation fehlgeschlagen", "error");
		} finally {
			// Button wieder aktivieren
			if (manualSyncBtn) {
				manualSyncBtn.disabled = false;
				manualSyncBtn.textContent = "Manual Sync";
			}
		}
	}

	/**
	 * ÜBERARBEITET: Zeigt neuen Sync-Status mit 3 Modi
	 */
	showSyncStatus() {
		let statusInfo = "🔍 SYNCHRONISATION STATUS:\n\n";

		statusInfo += `Aktueller Modus: ${this.syncMode.toUpperCase()}\n`;
		statusInfo += `Sync Toggle: ${
			this.isLiveSyncEnabled ? "✅ Aktiviert" : "❌ Deaktiviert"
		}\n\n`;

		statusInfo += `MODUS-BESCHREIBUNGEN:\n`;
		statusInfo += `🏠 STANDALONE: Nur localStorage, einmalige Server-Ladung beim Start\n`;
		statusInfo += `📡 SYNC: Empfängt Server-Updates automatisch (Leserechte)\n`;
		statusInfo += `👑 MASTER: Sendet Daten an Server (Schreibrechte)\n\n`;

		if (window.serverSync) {
			const serverStatus = window.serverSync.getStatus();
			statusInfo += `SERVER-DETAILS:\n`;
			statusInfo += `Server URL: ${
				serverStatus.serverUrl || "Nicht konfiguriert"
			}\n`;
			statusInfo += `Server Sync aktiv: ${
				serverStatus.isActive ? "✅ Ja" : "❌ Nein"
			}\n`;
			statusInfo += `Master-Modus: ${
				window.serverSync.isMaster ? "✅ Ja" : "❌ Nein"
			}\n`;
			statusInfo += `Slave-Modus: ${
				window.serverSync.isSlaveActive ? "✅ Ja" : "❌ Nein"
			}\n`;
			statusInfo += `Letzter Server-Timestamp: ${
				window.serverSync.lastServerTimestamp || "Nie"
			}\n\n`;
		}

		statusInfo += `GLOBALE FLAGS:\n`;
		statusInfo += `- isApplyingServerData: ${window.isApplyingServerData}\n`;
		statusInfo += `- isLoadingServerData: ${window.isLoadingServerData}\n`;
		statusInfo += `- isSavingToServer: ${window.isSavingToServer}\n\n`;

		statusInfo += `BEDIENUNG:\n`;
		statusInfo += `- Toggle: Wechselt zwischen Standalone ↔ Sync\n`;
		statusInfo += `- Status-Button-Klick: Wechselt zwischen Sync ↔ Master (wenn aktiv)\n`;
		statusInfo += `- Status-Button-Rechtsklick: Zeigt diesen Dialog\n`;

		alert(statusInfo);
		console.log(statusInfo);
	}

	/**
	 * Prüft URL auf geteiltes Projekt
	 */
	checkUrlForSharedProject() {
		const urlParams = new URLSearchParams(window.location.search);
		const projectId = urlParams.get("project");
		const shouldSync = urlParams.get("sync") === "true";

		if (projectId && shouldSync) {
			console.log("🔗 Geteiltes Projekt erkannt:", projectId);
			this.loadSharedProject(projectId);
		}
	}

	/**
	 * Lädt geteiltes Projekt
	 */
	async loadSharedProject(projectId) {
		try {
			this.currentProjectId = projectId;
			console.log("🔗 Lade geteiltes Projekt mit ID:", projectId);

			// Aktiviere Live Sync automatisch
			const liveSyncToggle = document.getElementById("liveSyncToggle");
			if (liveSyncToggle) {
				liveSyncToggle.checked = true;
				this.isLiveSyncEnabled = true;
			}

			// WICHTIG: Informiere das Server-Sync System über die Project-ID
			// bevor wir Daten laden, damit die korrekte URL verwendet wird

			// Lade Daten vom Server
			if (window.serverSync && window.serverSync.loadFromServer) {
				this.showNotification("Lade geteiltes Projekt...", "info");

				const serverData = await window.serverSync.loadFromServer();
				if (serverData && !serverData.error) {
					await window.serverSync.applyServerData(serverData);
					this.showNotification(
						"Geteiltes Projekt erfolgreich geladen!",
						"success"
					);

					// Zeige Share URL an (für weitere Teilung)
					const shareUrl = this.generateShareUrl();
					this.updateShareUrlDisplay(shareUrl, true);

					// Starte Live Sync
					this.startLiveSync();

					// URL bereinigen (optional)
					this.cleanUrlAfterLoad();
				} else {
					// Keine Daten auf Server - das ist OK für neue geteilte Projekte
					this.showNotification(
						"Geteiltes Projekt bereit! Noch keine Daten vorhanden.",
						"info"
					);

					// Zeige Share URL für neue Projekte
					const shareUrl = this.generateShareUrl();
					this.updateShareUrlDisplay(shareUrl, true);

					// Starte Live Sync für zukünftige Updates
					this.startLiveSync();
				}
			} else {
				this.showNotification("Server-Sync nicht verfügbar", "warning");
			}
		} catch (error) {
			console.error("❌ Fehler beim Laden des geteilten Projekts:", error);
			this.showNotification(
				"Fehler beim Laden des geteilten Projekts",
				"error"
			);
		}
	}

	/**
	 * Bereinigt URL nach dem Laden
	 */
	cleanUrlAfterLoad() {
		// Entferne URL-Parameter ohne Seite neu zu laden
		const url = new URL(window.location);
		url.searchParams.delete("project");
		url.searchParams.delete("sync");
		url.searchParams.delete("timestamp");

		window.history.replaceState({}, document.title, url.pathname + url.hash);
	}

	/**
	 * Aktualisiert Sync Status Indikator
	 */
	updateSyncStatusIndicator(status) {
		const syncStatusBtn = document.getElementById("syncStatusBtn");
		if (!syncStatusBtn) return;

		// Entferne vorherige Status-Klassen
		syncStatusBtn.classList.remove(
			"status-success",
			"status-warning",
			"status-error"
		);

		// Bewahre aktuellen Master/Slave-Status, ändere nur Indikator
		let currentText = syncStatusBtn.textContent;
		let baseText = "📊 Status";

		// Extrahiere den aktuellen Modus (Master/Slave) falls vorhanden
		if (currentText.includes("Master")) {
			baseText = "👑 Master";
		} else if (currentText.includes("Slave")) {
			baseText = "📊 Slave";
		}

		// Füge neue Status-Klasse und Indikator hinzu
		switch (status) {
			case "success":
				syncStatusBtn.classList.add("status-success");
				syncStatusBtn.textContent = baseText; // Keine zusätzlichen Emojis
				break;
			case "warning":
				syncStatusBtn.classList.add("status-warning");
				syncStatusBtn.textContent = `${baseText} ⚠️`;
				break;
			case "error":
				syncStatusBtn.classList.add("status-error");
				syncStatusBtn.textContent = `${baseText} ❌`;
				break;
			default:
				syncStatusBtn.textContent = baseText;
		}
	}

	/**
	 * ÜBERARBEITET: Lädt gespeicherte Sync-Einstellungen mit neuen Modi
	 */
	loadSavedSharingSettings() {
		try {
			const settings = JSON.parse(
				localStorage.getItem("hangarSyncSettings") || "{}"
			);

			// Lade gespeicherten Modus
			this.syncMode = settings.syncMode || "standalone";
			this.isLiveSyncEnabled = settings.isLiveSyncEnabled || false;
			this.isMasterMode = settings.isMasterMode || false;

			// Setze Dual-Toggles basierend auf Modus
			const readToggle = document.getElementById("readDataToggle");
			const writeToggle = document.getElementById("writeDataToggle");

			if (readToggle && writeToggle) {
				// Toggle-Zustände basierend auf Sync-Modus setzen
				switch (this.syncMode) {
					case "sync":
						readToggle.checked = true;
						writeToggle.checked = false;
						setTimeout(() => this.enableSyncMode(), 100);
						break;
					case "master":
						readToggle.checked = true;
						writeToggle.checked = true;
						setTimeout(() => this.enableMasterMode(), 100);
						break;
default: // "standalone"
						readToggle.checked = false;
						writeToggle.checked = false;
						this.updateAllSyncDisplays();
						this.applyReadOnlyUIState(false);
				}
			}

			console.log(
				"📁 Gespeicherte Sync-Einstellungen für Dual-Toggle geladen:",
				{
					syncMode: this.syncMode,
					readEnabled: readToggle?.checked,
					writeEnabled: writeToggle?.checked,
				}
			);
		} catch (error) {
			console.error("❌ Fehler beim Laden der Sync-Einstellungen:", error);
			// Fallback: Alle Toggles auf AUS
			const readToggle = document.getElementById("readDataToggle");
			const writeToggle = document.getElementById("writeDataToggle");
			if (readToggle) readToggle.checked = false;
			if (writeToggle) writeToggle.checked = false;
			this.syncMode = "standalone";
		}
	}

	/**
	 * ÜBERARBEITET: Speichert neue Sync-Einstellungen
	 */
	saveSharingSettings() {
		try {
			const settings = {
				syncMode: this.syncMode,
				isLiveSyncEnabled: this.isLiveSyncEnabled,
				isMasterMode: this.isMasterMode,
				lastSaved: new Date().toISOString(),
			};

			localStorage.setItem("hangarSyncSettings", JSON.stringify(settings));

			console.log("💾 Sync-Einstellungen gespeichert:", settings);
		} catch (error) {
			console.error("❌ Fehler beim Speichern der Sync-Einstellungen:", error);
		}
	}

	/**
	 * Zeigt Benachrichtigung (verwendet bestehende Notification-Systeme falls verfügbar)
	 */
	showNotification(message, type = "info") {
		// Versuche bestehende Notification-Systeme zu verwenden
		if (window.showNotification) {
			window.showNotification(message, type);
			return;
		}

		// Fallback: Konsole + einfaches Alert für wichtige Meldungen
		console.log(`${type.toUpperCase()}: ${message}`);

		if (type === "error") {
			alert(`Fehler: ${message}`);
		} else if (type === "success" && this.isLiveSyncEnabled) {
			// Zeige Erfolgs-Toast für Live Sync
			this.showSimpleToast(message, type);
		}
	}

	/**
	 * Einfacher Toast für Benachrichtigungen
	 */
	showSimpleToast(message, type) {
		// Erstelle Toast-Element
		const toast = document.createElement("div");
		toast.textContent = message;
		toast.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			background: ${
				type === "success"
					? "#10b981"
					: type === "error"
					? "#ef4444"
					: "#3b82f6"
			};
			color: white;
			padding: 12px 20px;
			border-radius: 8px;
			z-index: 10000;
			font-size: 14px;
			box-shadow: 0 4px 12px rgba(0,0,0,0.3);
			animation: slideIn 0.3s ease-out;
		`;

		// CSS Animation hinzufügen
		if (!document.querySelector("#toast-styles")) {
			const style = document.createElement("style");
			style.id = "toast-styles";
			style.textContent = `
				@keyframes slideIn {
					from { transform: translateX(100%); opacity: 0; }
					to { transform: translateX(0); opacity: 1; }
				}
				@keyframes slideOut {
					from { transform: translateX(0); opacity: 1; }
					to { transform: translateX(100%); opacity: 0; }
				}
			`;
			document.head.appendChild(style);
		}

		document.body.appendChild(toast);

		// Nach 3 Sekunden entfernen
		setTimeout(() => {
			toast.style.animation = "slideOut 0.3s ease-out";
			setTimeout(() => {
				if (toast.parentNode) {
					toast.parentNode.removeChild(toast);
				}
			}, 300);
		}, 3000);
	}

	/**
	 * NEU: Lädt Server-Daten sofort (für Read-Modus und Master-Modus)
	 */
	async loadServerDataImmediately() {
		console.log("⚡ Lade Server-Daten sofort...");

		// Prüfe ob ServerSync verfügbar ist
		if (!window.serverSync) {
			console.warn("⚠️ ServerSync nicht verfügbar - keine Server-Datenladung möglich");
			return false;
		}

		// Prüfe ob Server-URL konfiguriert ist
		if (!window.serverSync.serverSyncUrl) {
			console.warn("⚠️ Server-URL nicht konfiguriert - keine Server-Datenladung möglich");
			return false;
		}

		try {
			// Verhindere gleichzeitige Server-Operationen
			if (window.isApplyingServerData || window.isLoadingServerData) {
				console.log("⏸️ Server-Operation läuft bereits, überspringe sofortige Ladung");
				return false;
			}

			window.isLoadingServerData = true;

			// Lade Server-Daten
			const serverData = await window.serverSync.loadFromServer();

			if (serverData && !serverData.error) {
				// Prüfe ob gültige Daten vorhanden sind
				const hasValidData =
					(serverData.primaryTiles && serverData.primaryTiles.length > 0) ||
					(serverData.secondaryTiles && serverData.secondaryTiles.length > 0) ||
					(serverData.settings && Object.keys(serverData.settings).length > 0) ||
					(serverData.metadata && serverData.metadata.projectName);

				if (hasValidData) {
					// Wende Server-Daten an
					const applied = await window.serverSync.applyServerData(serverData);
					
					if (applied) {
						console.log("✅ Server-Daten sofort geladen und angewendet");
						
						// Benachrichtigung anzeigen falls verfügbar
						if (window.showNotification) {
							window.showNotification(
								`Server-Daten geladen (${this.syncMode} Modus)`,
								"success"
							);
						}
						
						return true;
					} else {
						console.warn("⚠️ Server-Daten konnten nicht angewendet werden");
						return false;
					}
				} else {
					console.log("ℹ️ Keine gültigen Server-Daten gefunden");
					return false;
				}
			} else {
				console.log("ℹ️ Keine Server-Daten verfügbar für sofortige Ladung");
				return false;
			}

		} catch (error) {
			console.error("❌ Fehler beim sofortigen Laden der Server-Daten:", error);
			return false;
		} finally {
			window.isLoadingServerData = false;
		}
	}

	/** Presence: initialize heartbeat + list polling */
	initPresence() {
		try {
			// Derive endpoint URL from serverSync URL or fallback
			let base = window.serverSync?.getServerUrl?.() || window.serverSync?.serverSyncUrl || '';
			if (typeof base !== 'string' || base.length === 0) base = window.location.origin + '/sync/data.php';
			this.presence.url = base.replace(/data\.php(?:\?.*)?$/i, 'presence.php');
			if (!/presence\.php/i.test(this.presence.url)) {
				// Fallback if replacement didn’t match
				this.presence.url = window.location.origin + '/sync/presence.php';
			}

			// Stable sessionId
			try {
				const existing = localStorage.getItem('presence.sessionId');
				this.presence.sessionId = existing && existing.length > 0 ? existing : (Math.random().toString(36).slice(2) + Date.now().toString(36));
				localStorage.setItem('presence.sessionId', this.presence.sessionId);
			} catch (e) {
				this.presence.sessionId = (Math.random().toString(36).slice(2) + Date.now().toString(36));
			}

			// Display name
			try {
				this.presence.displayName = localStorage.getItem('presence.displayName') || '';
			} catch (e) { this.presence.displayName = ''; }

			// Click handler for badge
			const badge = document.getElementById('presence-badge');
			const pop = document.getElementById('presence-popover');
			if (badge && pop) {
				badge.addEventListener('click', (e) => {
					e.preventDefault(); e.stopPropagation();
					pop.classList.toggle('hidden');
				});
				document.addEventListener('click', (e) => {
					if (!pop.contains(e.target) && !badge.contains(e.target)) pop.classList.add('hidden');
				});
			}

			// Heartbeat loop
			const doHeartbeat = async () => { try { await this.heartbeatPresence(); } catch (e) {} };
			doHeartbeat();
			if (this.presence.heartbeatId) clearInterval(this.presence.heartbeatId);
			this.presence.heartbeatId = setInterval(doHeartbeat, this.presenceHeartbeatMs);

			// List polling
			const pollList = async () => { try { await this.fetchPresenceList(); } catch (e) {} };
			pollList();
			if (this.presence.listPollId) clearInterval(this.presence.listPollId);
			this.presence.listPollId = setInterval(pollList, this.presenceListPollMs);

			// Visibility: send heartbeat when tab becomes active
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') doHeartbeat();
			});

			// Try to notify on unload (best-effort)
			window.addEventListener('beforeunload', () => {
				try {
					const payload = JSON.stringify({ action: 'leave', sessionId: this.presence.sessionId, displayName: this.presence.displayName || '', role: this.getRoleForPresence(), page: location.pathname });
					navigator.sendBeacon(this.presence.url, new Blob([payload], { type: 'application/json' }));
				} catch (e) {}
			});

			console.log('👥 Presence initialized at', this.presence.url);
		} catch (e) {
			console.warn('⚠️ Presence init failed:', e);
		}
	}

	getRoleForPresence() {
		// Prefer syncMode property, fallback to toggles
		switch ((this.syncMode || '').toLowerCase()) {
			case 'master': return 'master';
			case 'sync': return 'sync';
			case 'standalone': default: return 'standalone';
		}
	}

	async heartbeatPresence() {
		if (!this.presence?.url) return;
		const body = {
			action: 'heartbeat',
			sessionId: this.presence.sessionId,
			displayName: this.presence.displayName || '',
			role: this.getRoleForPresence(),
			page: location.pathname
		};
		await fetch(this.presence.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
	}

	async fetchPresenceList() {
		if (!this.presence?.url) return;
		const res = await fetch(this.presence.url + '?action=list', { method: 'GET', headers: { 'Accept': 'application/json' } });
		if (!res.ok) return;
		const data = await res.json();
		if (!data || !Array.isArray(data.users)) return;
		// Only update UI if changed (shallow compare by sessionId and lastSeen)
		const next = data.users;
		const prev = this.presence.lastUsers || [];
		const changed = next.length !== prev.length || next.some((u, i) => (u.sessionId !== (prev[i]?.sessionId) || u.lastSeen !== (prev[i]?.lastSeen)));
		this.presence.lastUsers = next;
		if (changed) this.renderPresence(next);
	}

	renderPresence(users) {
		try {
			// Header widget rows
			const countEl = document.getElementById('presenceCount');
			if (countEl) countEl.textContent = String(users?.length || 0);
			const namesEl = document.getElementById('presenceNames');
			if (namesEl) {
				const names = (users || []).map(u => (u?.displayName || '').replace(/[<>]/g, ''))
					.filter(n => n.length > 0);
				namesEl.textContent = names.join(', ');
			}
		} catch (e) { /* ignore */ }
	}

	setDisplayName(name) {
		try {
			this.presence.displayName = String(name || '').slice(0, 64);
			localStorage.setItem('presence.displayName', this.presence.displayName);
			// Force immediate heartbeat to reflect new name
			this.heartbeatPresence();
		} catch (e) {}
	}

	/**
	 * Cleanup beim Zerstören
	 */
	destroy() {
		if (this.shareCheckInterval) {
			clearInterval(this.shareCheckInterval);
		}
		this.saveSharingSettings();
		console.log("🗑️ Sharing Manager zerstört");
	}
}

// Globale Instanz erstellen
window.sharingManager = new SharingManager();

// FALLBACK: Sicherstellen dass loadServerDataImmediately verfügbar ist
if (typeof window.sharingManager.loadServerDataImmediately !== 'function') {
	console.warn("⚠️ loadServerDataImmediately fehlt - füge Fallback-Implementierung hinzu");
	
	window.sharingManager.loadServerDataImmediately = async function() {
		console.log("⚡ Lade Server-Daten sofort (Fallback)...");

		// Prüfe ob ServerSync verfügbar ist
		if (!window.serverSync) {
			console.warn("⚠️ ServerSync nicht verfügbar - keine Server-Datenladung möglich");
			return false;
		}

		// Prüfe ob Server-URL konfiguriert ist
		if (!window.serverSync.serverSyncUrl) {
			console.warn("⚠️ Server-URL nicht konfiguriert - keine Server-Datenladung möglich");
			return false;
		}

		try {
			// Verhindere gleichzeitige Server-Operationen
			if (window.isApplyingServerData || window.isLoadingServerData) {
				console.log("⏸️ Server-Operation läuft bereits, überspringe sofortige Ladung");
				return false;
			}

			window.isLoadingServerData = true;

			// Lade Server-Daten
			const serverData = await window.serverSync.loadFromServer();

			if (serverData && !serverData.error) {
				// Prüfe ob gültige Daten vorhanden sind
				const hasValidData =
					(serverData.primaryTiles && serverData.primaryTiles.length > 0) ||
					(serverData.secondaryTiles && serverData.secondaryTiles.length > 0) ||
					(serverData.settings && Object.keys(serverData.settings).length > 0) ||
					(serverData.metadata && serverData.metadata.projectName);

				if (hasValidData) {
					// Wende Server-Daten an
					const applied = await window.serverSync.applyServerData(serverData);
					
					if (applied) {
						console.log("✅ Server-Daten sofort geladen und angewendet (Fallback)");
						
						// Benachrichtigung anzeigen falls verfügbar
						if (window.showNotification) {
							window.showNotification(
								`Server-Daten geladen (${this.syncMode} Modus)`,
								"success"
							);
						}
						
						return true;
					} else {
						console.warn("⚠️ Server-Daten konnten nicht angewendet werden");
						return false;
					}
				} else {
					console.log("ℹ️ Keine gültigen Server-Daten gefunden");
					return false;
				}
			} else {
				console.log("ℹ️ Keine Server-Daten verfügbar für sofortige Ladung");
				return false;
			}

		} catch (error) {
			console.error("❌ Fehler beim sofortigen Laden der Server-Daten:", error);
			return false;
		} finally {
			window.isLoadingServerData = false;
		}
	};
} else {
	console.log("✅ loadServerDataImmediately bereits verfügbar");
}

// Zentrale Initialisierung
window.hangarInitQueue = window.hangarInitQueue || [];
window.hangarInitQueue.push(function () {
	console.log(
		"🔗 Sharing Manager wird über zentrale Initialisierung gestartet..."
	);

	// Warte kurz bis andere Module geladen sind
	setTimeout(() => {
		if (window.sharingManager) {
			window.sharingManager.init();
		}
	}, 1500); // 1.5 Sekunden nach anderen Modulen
});

console.log("🔗 Sharing Manager geladen und bereit für Initialisierung");
