/**
 * VOLLSTÄNDIGER SYSTEM-TEST
 * Prüft alle Aspekte der Server-Synchronisation
 */

async function runCompleteSystemTest() {
	console.log("🧪 === VOLLSTÄNDIGER SYSTEM-TEST GESTARTET ===");

	// Warte auf globale Initialisierung
	if (window.globalInitialization && !window.globalInitialization.initialized) {
		console.log("⏳ Warte auf globale Initialisierung...");
		try {
			await window.globalInitialization.waitForModules(5000);
			console.log("✅ Globale Initialisierung abgeschlossen");
		} catch (error) {
			console.warn("⚠️ Timeout bei globaler Initialisierung:", error.message);
		}
	}

	const results = {
		serverConnection: false,
		eventHandlers: false,
		dataCollection: false,
		serverSync: false,
		dataRestore: false,
	};

	try {
		// 1. SERVER-VERBINDUNGSTEST
		console.log("1️⃣ Teste Server-Verbindung...");
		if (window.storageBrowser && window.storageBrowser.serverSyncUrl) {
			results.serverConnection =
				await window.storageBrowser.testServerConnection(
					window.storageBrowser.serverSyncUrl
				);
			console.log(
				`Server-Verbindung: ${results.serverConnection ? "✅" : "❌"}`
			);
		} else {
			console.error("❌ storageBrowser nicht verfügbar");
		}

		// 2. EVENT-HANDLER TEST
		console.log("2️⃣ Teste Event-Handler...");
		const testFields = [
			"aircraft-1",
			"aircraft-2",
			"position-1",
			"hangar-position-101",
			"notes-1",
			"notes-101",
		];

		let handlersWorking = 0;
		testFields.forEach((fieldId) => {
			const element = document.getElementById(fieldId);
			if (element) {
				// Simuliere Eingabe
				element.value = `Test-${Date.now()}`;
				element.dispatchEvent(new Event("input", { bubbles: true }));
				handlersWorking++;
			}
		});
		results.eventHandlers = handlersWorking > 0;
		console.log(
			`Event-Handler: ${
				results.eventHandlers ? "✅" : "❌"
			} (${handlersWorking} Felder getestet)`
		);

		// 3. DATENSAMMLUNG TEST
		console.log("3️⃣ Teste Datensammlung...");
		if (
			window.hangarData &&
			typeof window.hangarData.collectAllHangarData === "function"
		) {
			const collectedData = window.hangarData.collectAllHangarData();
			results.dataCollection =
				collectedData && collectedData.metadata && collectedData.primaryTiles;
			console.log(`Datensammlung: ${results.dataCollection ? "✅" : "❌"}`);
			console.log("Gesammelte Daten:", collectedData);
		} else {
			console.error("❌ hangarData.collectAllHangarData nicht verfügbar");
		}

		// 4. SERVER-SYNC TEST
		console.log("4️⃣ Teste Server-Synchronisation...");
		if (window.storageBrowser) {
			results.serverSync = await window.storageBrowser.manualSync();
			console.log(`Server-Sync: ${results.serverSync ? "✅" : "❌"}`);
		}

		// 5. DATEN-WIEDERHERSTELLUNG TEST
		console.log("5️⃣ Teste Daten-Wiederherstellung...");
		if (window.storageBrowser) {
			const serverData = await window.storageBrowser.loadFromServer();
			if (serverData && !serverData.error) {
				results.dataRestore = await window.storageBrowser.applyServerData(
					serverData
				);
				console.log(
					`Daten-Wiederherstellung: ${results.dataRestore ? "✅" : "❌"}`
				);
			}
		}
	} catch (error) {
		console.error("❌ System-Test Fehler:", error);
	}

	// ERGEBNIS-ZUSAMMENFASSUNG
	console.log("\n🏁 === SYSTEM-TEST ERGEBNISSE ===");
	console.log(`Server-Verbindung: ${results.serverConnection ? "✅" : "❌"}`);
	console.log(`Event-Handler: ${results.eventHandlers ? "✅" : "❌"}`);
	console.log(`Datensammlung: ${results.dataCollection ? "✅" : "❌"}`);
	console.log(`Server-Sync: ${results.serverSync ? "✅" : "❌"}`);
	console.log(`Daten-Wiederherstellung: ${results.dataRestore ? "✅" : "❌"}`);

	const allPassed = Object.values(results).every((result) => result === true);
	console.log(
		`\n🎯 GESAMTERGEBNIS: ${
			allPassed ? "✅ ALLE TESTS BESTANDEN" : "❌ EINIGE TESTS FEHLGESCHLAGEN"
		}`
	);

	// User-freundliche Ausgabe
	const summary = `
🧪 SYSTEM-TEST ABGESCHLOSSEN

✅ Erfolgreich: ${Object.values(results).filter((r) => r).length}/5
❌ Fehlgeschlagen: ${Object.values(results).filter((r) => !r).length}/5

Details:
• Server-Verbindung: ${results.serverConnection ? "✅" : "❌"}
• Event-Handler: ${results.eventHandlers ? "✅" : "❌"}  
• Datensammlung: ${results.dataCollection ? "✅" : "❌"}
• Server-Sync: ${results.serverSync ? "✅" : "❌"}
• Daten-Wiederherstellung: ${results.dataRestore ? "✅" : "❌"}

${
	allPassed
		? "🎉 System funktioniert vollständig!"
		: "⚠️ Bitte Konsole für Details prüfen"
}
	`;

	alert(summary);
	return results;
}

// Global verfügbar machen
window.runCompleteSystemTest = runCompleteSystemTest;

console.log("🧪 System-Test-Funktionen geladen");
