/**
 * GoFlightLabs API Test & Debug Script
 * Umfassende Test-Suite für die GoFlightLabs API Integration
 */

window.GoFlightLabsTest = (() => {
	/**
	 * Prüft die Integration von GoFlightLabs in das System
	 */
	const checkIntegration = () => {
		console.log("🔍 === GOFLIGHTLABS INTEGRATION CHECK ===");
		console.log("==========================================");

		const checks = {
			apiLoaded: false,
			apiInFacade: false,
			menuOption: false,
			testFunctions: false,
			configValid: false,
		};

		// 1. GoFlightLabs API verfügbar?
		if (window.GoFlightLabsAPI) {
			checks.apiLoaded = true;
			console.log("✅ GoFlightLabsAPI geladen");

			const apiInfo = window.GoFlightLabsAPI.getAPIInfo();
			console.log("   API Info:", apiInfo);

			// Konfiguration prüfen
			if (apiInfo._internal && apiInfo._internal.requestCount !== undefined) {
				checks.configValid = true;
				console.log("✅ API-Konfiguration gültig");
			}
		} else {
			console.log("❌ GoFlightLabsAPI NICHT geladen");
		}

		// 2. API-Facade Integration?
		if (window.FlightDataAPI) {
			const config = window.FlightDataAPI.getConfig();
			if (config.providers.includes("goflightlabs")) {
				checks.apiInFacade = true;
				console.log("✅ GoFlightLabs in API-Facade integriert");
				console.log("   Verfügbare Provider:", config.providers);
				console.log("   Aktiver Provider:", config.activeProvider);
			} else {
				console.log("❌ GoFlightLabs NICHT in API-Facade");
				console.log("   Verfügbare Provider:", config.providers);
			}
		} else {
			console.log("❌ FlightDataAPI nicht verfügbar");
		}

		// 3. Menü-Option verfügbar?
		const apiSelect = document.getElementById("apiProviderSelect");
		if (apiSelect) {
			const goflightlabsOption = Array.from(apiSelect.options).find(
				(option) => option.value === "goflightlabs"
			);
			if (goflightlabsOption) {
				checks.menuOption = true;
				console.log("✅ GoFlightLabs Option im Menü gefunden");
			} else {
				console.log("❌ GoFlightLabs Option NICHT im Menü");
				console.log(
					"   Verfügbare Optionen:",
					Array.from(apiSelect.options).map((o) => o.value)
				);
			}
		} else {
			console.log("❌ API-Provider-Select nicht gefunden");
		}

		// 4. Test-Funktionen verfügbar?
		if (
			typeof testGoFlightLabsConnection === "function" &&
			typeof testGoFlightLabsFlightSearch === "function"
		) {
			checks.testFunctions = true;
			console.log("✅ Test-Funktionen verfügbar");
		} else {
			console.log("❌ Test-Funktionen nicht verfügbar");
		}

		// Zusammenfassung
		const successCount = Object.values(checks).filter(Boolean).length;
		const totalChecks = Object.keys(checks).length;

		console.log("\n📊 === INTEGRATION ZUSAMMENFASSUNG ===");
		console.log(`Status: ${successCount}/${totalChecks} Checks erfolgreich`);

		if (successCount === totalChecks) {
			console.log("🎉 GoFlightLabs vollständig integriert und bereit!");
		} else {
			console.log("⚠️ GoFlightLabs Integration unvollständig");
		}

		return checks;
	};

	/**
	 * Testet die Verbindung zu GoFlightLabs
	 */
	const testConnection = async () => {
		console.log("\n🌐 === GOFLIGHTLABS VERBINDUNGSTEST ===");

		if (!window.GoFlightLabsAPI) {
			console.error("❌ GoFlightLabsAPI nicht verfügbar");
			return false;
		}

		try {
			const result = await window.GoFlightLabsAPI.testConnection();

			if (result.success) {
				console.log("✅ Verbindung zu GoFlightLabs erfolgreich!");
				console.log("   Timestamp:", result.timestamp);
				if (result.response) {
					console.log("   API Response Preview:", {
						dataLength: result.response.data?.length || 0,
						hasError: !!result.response.error,
					});
				}
			} else {
				console.error("❌ Verbindung fehlgeschlagen:", result.error);
			}

			return result.success;
		} catch (error) {
			console.error("❌ Verbindungstest Fehler:", error);
			return false;
		}
	};

	/**
	 * Testet eine spezifische Aircraft-Suche
	 */
	const testFlightSearch = async (registration = "D-AIBL", date = null) => {
		console.log(`\n✈️ === FLUGSUCHE TEST: ${registration} ===`);

		if (!window.GoFlightLabsAPI) {
			console.error("❌ GoFlightLabsAPI nicht verfügbar");
			return null;
		}

		const testDate = date || new Date().toISOString().split("T")[0];
		console.log(`📅 Suche Flüge für ${registration} am ${testDate}`);

		try {
			const result = await window.GoFlightLabsAPI.getAircraftFlights(
				registration,
				testDate
			);

			console.log("📊 Suchergebnis:");
			console.log(`   Flüge gefunden: ${result.data?.length || 0}`);
			console.log(`   Quelle: ${result._source || "unbekannt"}`);

			if (result.data && result.data.length > 0) {
				console.log("   Erste 3 Flüge:");
				result.data.slice(0, 3).forEach((flight, index) => {
					const dep = flight.flightPoints?.find((p) => p.departurePoint);
					const arr = flight.flightPoints?.find((p) => p.arrivalPoint);
					console.log(
						`   ${index + 1}. ${dep?.iataCode || "???"} → ${
							arr?.iataCode || "???"
						} (${flight.flightDesignator?.fullFlightNumber || "N/A"})`
					);
				});
			} else {
				console.log("   ℹ️ Keine Flüge gefunden");
			}

			return result;
		} catch (error) {
			console.error("❌ Flugsuche Fehler:", error);
			return null;
		}
	};

	/**
	 * Testet die Übernachtungslogik
	 */
	const testOvernightLogic = async (registration = "D-AIBL") => {
		console.log(`\n🏨 === ÜBERNACHTUNGSLOGIK TEST: ${registration} ===`);

		if (!window.GoFlightLabsAPI) {
			console.error("❌ GoFlightLabsAPI nicht verfügbar");
			return null;
		}

		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		const currentDate = today.toISOString().split("T")[0];
		const nextDate = tomorrow.toISOString().split("T")[0];

		console.log(`📅 Teste Übernachtung: ${currentDate} → ${nextDate}`);

		try {
			const result = await window.GoFlightLabsAPI.updateAircraftData(
				registration,
				currentDate,
				nextDate
			);

			console.log("🏨 Übernachtungstest Ergebnis:");
			console.log(`   Origin: ${result.originCode || "N/A"}`);
			console.log(`   Destination: ${result.destCode || "N/A"}`);
			console.log(`   Ankunftszeit: ${result.arrivalTime || "N/A"}`);
			console.log(`   Abflugzeit: ${result.departureTime || "N/A"}`);
			console.log(`   Position: ${result.positionText || "N/A"}`);
			console.log(
				`   Übernachtung erkannt: ${result._hasOvernightStay ? "Ja" : "Nein"}`
			);
			console.log(`   Flüge: ${result.data?.length || 0}`);

			if (result._hasOvernightStay) {
				console.log("✅ Übernachtung erfolgreich erkannt!");
			} else if (result._noDataFound) {
				console.log("ℹ️ Keine passenden Flugdaten gefunden");
			} else {
				console.log("❌ Keine Übernachtung erkannt");
			}

			return result;
		} catch (error) {
			console.error("❌ Übernachtungslogik Fehler:", error);
			return null;
		}
	};

	/**
	 * Wechselt zur GoFlightLabs API
	 */
	const switchToGoFlightLabs = () => {
		console.log("\n🔄 === WECHSEL ZU GOFLIGHTLABS ===");

		if (window.FlightDataAPI) {
			const success = window.FlightDataAPI.setProvider("goflightlabs");
			if (success) {
				console.log("✅ Provider erfolgreich zu GoFlightLabs gewechselt");

				// Menü aktualisieren
				const apiSelect = document.getElementById("apiProviderSelect");
				if (apiSelect) {
					apiSelect.value = "goflightlabs";
					console.log("✅ Menü-Auswahl aktualisiert");
				}

				return true;
			} else {
				console.error("❌ Provider-Wechsel fehlgeschlagen");
				return false;
			}
		} else {
			console.error("❌ FlightDataAPI nicht verfügbar");
			return false;
		}
	};

	/**
	 * Vollständiger Integrationstest
	 */
	const runFullTest = async () => {
		console.log("🚀 === GOFLIGHTLABS VOLLSTÄNDIGER TEST ===");
		console.log("=========================================");

		// 1. Integration prüfen
		const integrationCheck = checkIntegration();

		// 2. Verbindung testen
		const connectionResult = await testConnection();

		// 3. Zu GoFlightLabs wechseln
		const switchResult = switchToGoFlightLabs();

		// 4. Flugsuche testen
		const searchResult = await testFlightSearch();

		// 5. Übernachtungslogik testen
		const overnightResult = await testOvernightLogic();

		// Zusammenfassung
		console.log("\n📋 === TESTERGEBNISSE ZUSAMMENFASSUNG ===");
		console.log(
			`Integration: ${
				Object.values(integrationCheck).filter(Boolean).length
			}/5 Checks`
		);
		console.log(
			`Verbindung: ${connectionResult ? "Erfolgreich" : "Fehlgeschlagen"}`
		);
		console.log(
			`Provider-Wechsel: ${switchResult ? "Erfolgreich" : "Fehlgeschlagen"}`
		);
		console.log(
			`Flugsuche: ${searchResult ? "Daten gefunden" : "Keine Daten"}`
		);
		console.log(
			`Übernachtung: ${
				overnightResult?._hasOvernightStay ? "Erkannt" : "Nicht erkannt"
			}`
		);

		const allSuccessful =
			Object.values(integrationCheck).every(Boolean) &&
			connectionResult &&
			switchResult;

		if (allSuccessful) {
			console.log("🎉 Alle Tests erfolgreich! GoFlightLabs ist einsatzbereit.");
		} else {
			console.log(
				"⚠️ Einige Tests fehlgeschlagen. Prüfen Sie die Konfiguration."
			);
		}

		return {
			integration: integrationCheck,
			connection: connectionResult,
			switch: switchResult,
			search: searchResult,
			overnight: overnightResult,
		};
	};

	// Public API
	return {
		checkIntegration,
		testConnection,
		testFlightSearch,
		testOvernightLogic,
		switchToGoFlightLabs,
		runFullTest,
	};
})();

// Globale Test-Funktionen für einfachen Zugriff
window.checkGoFlightLabsIntegration = () =>
	window.GoFlightLabsTest.checkIntegration();
window.testGoFlightLabsConnection = () =>
	window.GoFlightLabsTest.testConnection();
window.testGoFlightLabsFlightSearch = (reg, date) =>
	window.GoFlightLabsTest.testFlightSearch(reg, date);
window.testGoFlightLabsOvernightLogic = (reg) =>
	window.GoFlightLabsTest.testOvernightLogic(reg);
window.switchToGoFlightLabs = () =>
	window.GoFlightLabsTest.switchToGoFlightLabs();
window.runGoFlightLabsFullTest = () => window.GoFlightLabsTest.runFullTest();

// Neue Proxy-Test Funktion
window.testGoFlightLabsProxy = async () => {
	console.log("\n🌐 === GOFLIGHTLABS PROXY TEST ===");
	console.log("=================================");

	try {
		console.log("Testing direct proxy connection...");

		const proxyUrl =
			"sync/goflightlabs-proxy.php?endpoint=schedules&aircraft_reg=D-ACNK&debug=true";
		const response = await fetch(proxyUrl);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		if (data.error) {
			console.error("❌ Proxy returned error:", data.error);
			return false;
		}

		console.log("✅ Proxy connection successful");
		console.log("   Data items:", data.data ? data.data.length : 0);

		if (data._proxy_debug) {
			console.log("   Debug Info:", data._proxy_debug);
		}

		if (data.data && data.data.length > 0) {
			console.log("   Sample flight:", {
				flight_number: data.data[0].flight_number,
				departure: data.data[0].departure,
				arrival: data.data[0].arrival,
			});
		}

		return true;
	} catch (error) {
		console.error("❌ Proxy test failed:", error);
		return false;
	}
};

// Auto-Check bei Entwicklung
if (window.GoFlightLabsAPI?.getAPIInfo()?.name) {
	console.log("🧪 GoFlightLabs Test-Suite geladen");
	console.log("📋 Verfügbare Test-Funktionen:");
	console.log("   - checkGoFlightLabsIntegration()");
	console.log("   - testGoFlightLabsConnection()");
	console.log("   - testGoFlightLabsFlightSearch(registration, date)");
	console.log("   - testGoFlightLabsOvernightLogic(registration)");
	console.log("   - switchToGoFlightLabs()");
	console.log("   - runGoFlightLabsFullTest()");
	console.log("   - testGoFlightLabsProxy() 🆕");
}
