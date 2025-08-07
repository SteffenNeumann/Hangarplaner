/**
 * Debug-Script für Aviationstack API Integration
 * Prüft ob alle Komponenten korrekt geladen und integriert sind
 */

// Prüfung der API-Integration
function checkAviationstackIntegration() {
	console.log("🔍 PRÜFE AVIATIONSTACK INTEGRATION");
	console.log("==================================");

	const checks = {
		aviationstackAPI: false,
		apiInFacade: false,
		menuOption: false,
		testFunctions: false,
		providerSwitch: false,
	};

	// 1. Aviationstack API verfügbar?
	if (window.aviationstackAPI && window.AviationstackAPI) {
		checks.aviationstackAPI = true;
		console.log("✅ AviationstackAPI geladen");
		console.log("   API Info:", window.aviationstackAPI.getAPIInfo());
	} else {
		console.log("❌ AviationstackAPI NICHT geladen");
	}

	// 2. API-Facade Integration?
	if (window.FlightDataAPI) {
		const config = window.FlightDataAPI.getConfig();
		if (config.providers.includes("aviationstack")) {
			checks.apiInFacade = true;
			console.log("✅ Aviationstack in API-Facade integriert");
			console.log("   Verfügbare Provider:", config.providers);
			console.log("   Aktiver Provider:", config.activeProvider);
		} else {
			console.log("❌ Aviationstack NICHT in API-Facade");
		}
	} else {
		console.log("❌ FlightDataAPI nicht verfügbar");
	}

	// 3. Menü-Option verfügbar?
	const apiSelect = document.getElementById("apiProviderSelect");
	if (apiSelect) {
		const aviationstackOption = Array.from(apiSelect.options).find(
			(option) => option.value === "aviationstack"
		);
		if (aviationstackOption) {
			checks.menuOption = true;
			console.log("✅ Aviationstack Option im Menü gefunden");
		} else {
			console.log("❌ Aviationstack Option NICHT im Menü");
		}
	} else {
		console.log("❌ API Provider Select NICHT gefunden");
	}

	// 4. Test-Funktionen verfügbar?
	if (
		window.testAviationstackAPI &&
		window.testOvernightLogic &&
		window.testFutureFlights
	) {
		checks.testFunctions = true;
		console.log("✅ Test-Funktionen verfügbar");
	} else {
		console.log("❌ Test-Funktionen NICHT vollständig verfügbar");
	}

	// 5. Provider-Wechsel funktional?
	if (window.FlightDataAPI && window.FlightDataAPI.setProvider) {
		const originalProvider = window.FlightDataAPI.getActiveProvider();

		try {
			const success = window.FlightDataAPI.setProvider("aviationstack");
			if (
				success &&
				window.FlightDataAPI.getActiveProvider() === "aviationstack"
			) {
				checks.providerSwitch = true;
				console.log("✅ Provider-Wechsel funktional");

				// Zurück auf Original
				window.FlightDataAPI.setProvider(originalProvider);
			} else {
				console.log("❌ Provider-Wechsel fehlgeschlagen");
			}
		} catch (error) {
			console.log("❌ Fehler beim Provider-Wechsel:", error.message);
		}
	} else {
		console.log("❌ Provider-Wechsel Funktion nicht verfügbar");
	}

	// Zusammenfassung
	const successCount = Object.values(checks).filter(Boolean).length;
	const totalChecks = Object.keys(checks).length;

	console.log("\n📊 INTEGRATION SUMMARY");
	console.log("=====================");
	console.log(`Status: ${successCount}/${totalChecks} Checks erfolgreich`);

	if (successCount === totalChecks) {
		console.log("🎉 AVIATIONSTACK VOLLSTÄNDIG INTEGRIERT! 🎉");
		console.log("\n📝 Nächste Schritte:");
		console.log('1. Provider auf "Aviationstack API" umstellen');
		console.log("2. testAviationstackAPI() ausführen");
		console.log('3. Aircraft ID eingeben und "Update Data" drücken');
	} else {
		console.log("⚠️ Integration unvollständig - prüfe Fehlermeldungen oben");
	}

	return {
		success: successCount === totalChecks,
		checks,
		successCount,
		totalChecks,
	};
}

// Automatische Prüfung beim Laden
window.hangarInitQueue = window.hangarInitQueue || [];
window.hangarInitQueue.push(function () {
	setTimeout(() => {
		console.log("🔍 Starte automatische Aviationstack Integration Prüfung...");
		window.checkAviationstackIntegration = checkAviationstackIntegration;
		checkAviationstackIntegration();
	}, 2000); // 2 Sekunden warten, damit alles geladen ist
});

console.log("🛠️ Aviationstack Debug-Tools geladen");
console.log(
	"   - checkAviationstackIntegration() - Vollständige Integration prüfen"
);
