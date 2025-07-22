/**
 * Sharing Manager für HangarPlanner
 * Implementiert Live-Synchronisation und URL-Sharing zwischen Benutzern
 * Erweitert die bestehende Server-Sync Funktionalität um Sharing-Features
 */

class SharingManager {
	constructor() {
		this.isLiveSyncEnabled = false;
		this.isMasterMode = false;
		this.initialized = false;

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
		this.initialized = true;

		console.log("🔗 Master-Slave Manager initialisiert");
	}

	/**
	 * Setzt Event-Handler für Master-Slave-UI-Elemente
	 */
	setupEventHandlers() {
		// Live Sync Toggle -> Master-Slave Toggle
		const liveSyncToggle = document.getElementById("liveSyncToggle");
		if (liveSyncToggle) {
			liveSyncToggle.addEventListener("change", (e) => {
				this.handleMasterSlaveToggle(e.target.checked);
			});
		}

		// Manual Sync Button
		const manualSyncBtn = document.getElementById("manualSyncBtn");
		if (manualSyncBtn) {
			manualSyncBtn.addEventListener("click", () => {
				this.performManualSync();
			});
		}

		// Sync Status Button
		const syncStatusBtn = document.getElementById("syncStatusBtn");
		if (syncStatusBtn) {
			syncStatusBtn.addEventListener("click", () => {
				this.showSyncStatus();
			});
		}

		console.log("🎯 Master-Slave Event-Handler registriert");
	}

	/**
	 * NEUE METHODE: Behandelt Master-Slave Toggle
	 */
	async handleMasterSlaveToggle(enabled) {
		this.isLiveSyncEnabled = enabled;

		if (enabled) {
			await this.enableMasterSlaveSync();
		} else {
			this.disableMasterSlaveSync();
		}

		// Einstellungen speichern
		this.saveSharingSettings();
	}

	/**
	 * NEUE METHODE: Aktiviert Master-Slave Synchronisation
	 */
	async enableMasterSlaveSync() {
		try {
			// Lasse ServerSync die Master-Slave Rolle bestimmen
			if (window.serverSync) {
				await window.serverSync.determineMasterSlaveRole();

				if (window.serverSync.isMaster) {
					this.isMasterMode = true;
					this.showNotification(
						"Master-Modus aktiviert - Sie können Daten bearbeiten",
						"success"
					);
					this.updateSyncStatusDisplay("Master", true);
				} else {
					this.isMasterMode = false;
					this.showNotification(
						"Slave-Modus aktiviert - Empfange Updates automatisch",
						"info"
					);
					this.updateSyncStatusDisplay("Slave", true);
				}

				console.log("✅ Master-Slave Sync aktiviert");
			} else {
				throw new Error("ServerSync nicht verfügbar");
			}
		} catch (error) {
			console.error("❌ Fehler beim Aktivieren von Master-Slave Sync:", error);
			this.showNotification(
				"Fehler beim Aktivieren der Synchronisation",
				"error"
			);

			// Toggle zurücksetzen bei Fehler
			const liveSyncToggle = document.getElementById("liveSyncToggle");
			if (liveSyncToggle) {
				liveSyncToggle.checked = false;
			}
		}
	}

	/**
	 * NEUE METHODE: Deaktiviert Master-Slave Synchronisation
	 */
	disableMasterSlaveSync() {
		// Stoppe ServerSync
		if (window.serverSync) {
			window.serverSync.stopPeriodicSync();

			if (window.serverSync.slaveCheckInterval) {
				clearInterval(window.serverSync.slaveCheckInterval);
				window.serverSync.slaveCheckInterval = null;
			}

			window.serverSync.isMaster = false;
			window.serverSync.isSlaveActive = false;
		}

		this.isMasterMode = false;
		this.updateSyncStatusDisplay("Deaktiviert", false);
		this.showNotification("Master-Slave Sync deaktiviert", "info");
		console.log("⏹️ Master-Slave Sync deaktiviert");
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
	 * NEUE METHODE: Aktualisiert Sync-Status-Anzeige
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

				if (status === "Master") {
					emoji = "👑"; // Krone für Master
					cssClass = "status-success";
				} else if (status === "Slave") {
					emoji = "📊"; // Diagramm für Slave
					cssClass = "status-success";
				}

				syncStatusBtn.textContent = `${emoji} ${status}`;
				syncStatusBtn.classList.add(cssClass);
				syncStatusBtn.title = `Sync aktiv im ${status}-Modus`;
			} else {
				syncStatusBtn.textContent = "📊 Status";
				syncStatusBtn.title = "Sync inaktiv - Klicken für Details";
			}
		}

		console.log(
			`🔄 Sync-Status angezeigt: ${status} (${isActive ? "aktiv" : "inaktiv"})`
		);
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

		// Button deaktivieren während Sync
		if (manualSyncBtn) {
			manualSyncBtn.disabled = true;
			manualSyncBtn.textContent = "🔄 Syncing...";
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
				manualSyncBtn.textContent = "🔄 Manual Sync";
			}
		}
	}

	/**
	 * AKTUALISIERT: Zeigt Master-Slave Status
	 */
	showSyncStatus() {
		let statusInfo = "🔍 MASTER-SLAVE SYNC STATUS:\n\n";

		statusInfo += `Master-Slave Sync: ${
			this.isLiveSyncEnabled ? "✅ Aktiviert" : "❌ Deaktiviert"
		}\n`;
		statusInfo += `Modus: ${this.isMasterMode ? "👑 Master" : "👤 Slave"}\n`;

		if (window.serverSync) {
			const serverStatus = window.serverSync.getStatus();
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
			}\n`;
		}

		statusInfo += `\nGlobale Flags:\n`;
		statusInfo += `- isApplyingServerData: ${window.isApplyingServerData}\n`;
		statusInfo += `- isLoadingServerData: ${window.isLoadingServerData}\n`;
		statusInfo += `- isSavingToServer: ${window.isSavingToServer}\n`;

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
	 * AKTUALISIERT: Lädt gespeicherte Master-Slave-Einstellungen
	 */
	loadSavedSharingSettings() {
		try {
			const settings = JSON.parse(
				localStorage.getItem("hangarMasterSlaveSettings") || "{}"
			);

			if (settings.isLiveSyncEnabled) {
				const liveSyncToggle = document.getElementById("liveSyncToggle");
				if (liveSyncToggle) {
					liveSyncToggle.checked = true;
					this.handleMasterSlaveToggle(true);
				}
			} else {
				// Falls Sync deaktiviert ist, zeige Standard-Status
				this.updateSyncStatusDisplay("Status", false);
			}

			this.isMasterMode = settings.isMasterMode || false;
		} catch (error) {
			console.error(
				"❌ Fehler beim Laden der Master-Slave-Einstellungen:",
				error
			);
			// Bei Fehler Standard-Status anzeigen
			this.updateSyncStatusDisplay("Status", false);
		}
	}

	/**
	 * AKTUALISIERT: Speichert Master-Slave-Einstellungen
	 */
	saveSharingSettings() {
		try {
			const settings = {
				isLiveSyncEnabled: this.isLiveSyncEnabled,
				isMasterMode: this.isMasterMode,
				lastSaved: new Date().toISOString(),
			};

			localStorage.setItem(
				"hangarMasterSlaveSettings",
				JSON.stringify(settings)
			);
		} catch (error) {
			console.error(
				"❌ Fehler beim Speichern der Master-Slave-Einstellungen:",
				error
			);
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
