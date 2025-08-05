/**
 * EINFACHE Flightradar24 API Test-Version
 */

console.log("🛫 Flightradar24 API wird geladen...");

const Flightradar24API_Simple = {
	test: function () {
		console.log("✅ Flightradar24 API Test-Funktion funktioniert!");
		return "API ist verfügbar";
	},

	getFlights: async function (registration = "D-AIBL") {
		console.log(`🔍 Teste Flightradar24 API für ${registration}`);

		const url = `https://flightradar24-com.p.rapidapi.com/flights/list-by-aircraft?reg=${registration}&limit=10`;
		const options = {
			method: "GET",
			headers: {
				"x-rapidapi-key": "b76afbf516mshf864818d919de86p10475ejsna65b718a8602",
				"x-rapidapi-host": "flightradar24-com.p.rapidapi.com",
			},
		};

		try {
			console.log(`📡 API-Anfrage: ${url}`);
			const response = await fetch(url, options);
			console.log(`📡 Status: ${response.status} ${response.statusText}`);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`❌ API Fehler: ${errorText}`);
				return { error: `${response.status}: ${errorText}` };
			}

			const text = await response.text();
			console.log(
				`📡 Response (${text.length} chars):`,
				text.substring(0, 200) + "..."
			);

			const data = JSON.parse(text);
			console.log(`📡 Parsed Data:`, data);

			return data;
		} catch (error) {
			console.error(`❌ Fehler:`, error);
			return { error: error.message };
		}
	},
};

// Global verfügbar machen
window.FR24Test = Flightradar24API_Simple;

console.log("✅ Flightradar24 Test-API geladen als window.FR24Test");
