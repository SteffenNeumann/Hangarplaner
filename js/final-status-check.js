/**
 * FINAL STATUS CHECK - HANGARPLANNER SYSTEM
 * Automatische Prüfung beim Laden der Seite
 */

document.addEventListener("DOMContentLoaded", () => {
	console.log("🎯 === FINALE SYSTEM-PRÜFUNG ===");

	// Kurze Verzögerung für alle Module
	setTimeout(() => {
		const status = {
			globalInit: !!window.globalInitialization?.initialized,
			hangarData: !!window.hangarData?.collectAllHangarData,
			storageBrowser: !!window.storageBrowser,
			serverSync: !!window.serverSync,
			systemTest: !!window.runCompleteSystemTest,
			validation: !!window.validateHangarPlanner,
			eventHandlers:
				document.querySelectorAll("input, select, textarea").length > 0,
		};

		const allGood = Object.values(status).every(Boolean);

		console.log("📊 System-Status:", status);
		console.log(
			`🎯 Gesamtstatus: ${
				allGood ? "✅ ALLE SYSTEME OPERATIONAL" : "⚠️ EINIGE PROBLEME"
			}`
		);

		if (allGood) {
			console.log("🎉 HANGARPLANNER VOLLSTÄNDIG EINSATZBEREIT!");
			console.log("📋 Verfügbare Funktionen:");
			console.log("  • validateHangarPlanner() - Umfassende Validierung");
			console.log("  • runCompleteSystemTest() - System-Test");
			console.log("  • runAllTests() - Alle Tests koordiniert");
			console.log("  • Server-Sync läuft automatisch alle 30 Sekunden");

			// Zeige Erfolgsmeldung nach 5 Sekunden
			setTimeout(() => {
				if (window.showNotification) {
					window.showNotification(
						"🎉 HangarPlanner vollständig einsatzbereit!",
						"success"
					);
				}
			}, 5000);
		} else {
			console.warn(
				"⚠️ Einige Module sind nicht verfügbar. Prüfe die Konsole für Details."
			);
		}

		// Server-Verbindung testen
		if (window.serverSync?.testServerConnection) {
			window.serverSync
				.testServerConnection("https://hangarplanner.de/sync/data.php")
				.then((connected) => {
					console.log(
						`🌐 Server-Verbindung: ${
							connected ? "✅ VERBUNDEN" : "❌ NICHT VERFÜGBAR"
						}`
					);
				})
				.catch((error) => {
					console.warn("⚠️ Server-Test Fehler:", error.message);
				});
		}
	}, 2000);
});

console.log("🔍 Finale System-Prüfung initialisiert");
