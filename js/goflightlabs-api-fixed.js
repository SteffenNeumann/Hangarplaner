/**
 * GoFlightLabs API Integration - FIXED VERSION
 * Test für Datenkonvertierung
 */

// Einfacher Test der GoFlightLabs Datenkonvertierung
window.testGoFlightLabsConversion = () => {
	// Beispiel-Daten von der API (echte Antwort)
	const sampleResponse = {
		success: true,
		data: [
			{
				hex: "3C6450",
				reg_number: "D-AIBP",
				flag: "DE",
				lat: 47.486233,
				lng: 17.396987,
				alt: 8882,
				dir: 282,
				speed: 814,
				flight_number: "1679",
				flight_icao: "DLH1679",
				flight_iata: "LH1679",
				dep_icao: "LHBP",
				dep_iata: "BUD",
				arr_icao: "EDDM",
				arr_iata: "MUC",
				airline_icao: "DLH",
				airline_iata: "LH",
				aircraft_icao: "A319",
				updated: 1754757074,
				status: "en-route",
				type: "adsb",
			},
		],
	};

	console.log("🧪 GoFlightLabs Datenkonvertierung Test");
	console.log("Original API Response:", sampleResponse);

	// Konvertierung für HangarPlanner Format
	const convertedData = {
		data: sampleResponse.data.map((flight) => ({
			type: "DatedFlight",
			scheduledDepartureDate: "2025-08-09",
			flightDesignator: {
				carrierCode: flight.airline_iata,
				carrierName: flight.airline_iata, // GoFlightLabs liefert keinen Namen
				carrierIcao: flight.airline_icao,
				flightNumber: flight.flight_iata,
				fullFlightNumber: flight.flight_iata,
			},
			flightPoints: [
				{
					departurePoint: true,
					arrivalPoint: false,
					iataCode: flight.dep_iata,
					departure: {
						timings: [
							{
								qualifier: "STD",
								value: "Real-time",
								isUtc: true,
							},
						],
					},
				},
				{
					departurePoint: false,
					arrivalPoint: true,
					iataCode: flight.arr_iata,
					arrival: {
						timings: [
							{
								qualifier: "STA",
								value: "Real-time",
								isUtc: true,
							},
						],
					},
				},
			],
			aircraftType: flight.aircraft_icao,
			registration: flight.reg_number,
			_source: "goflightlabs",
			_realTimeData: {
				status: flight.status,
				altitude: flight.alt,
				speed: flight.speed,
				coordinates: {
					lat: flight.lat,
					lng: flight.lng,
				},
			},
		})),
		totalFlights: sampleResponse.data.length,
		source: "GoFlightLabs",
	};

	console.log("✅ Konvertierte Daten:", convertedData);

	if (convertedData.data.length > 0) {
		console.log("🎯 Erster Flug:", convertedData.data[0]);
		console.log(
			"✈️ Flugnummer:",
			convertedData.data[0].flightDesignator.flightNumber
		);
		console.log("🛫 Von:", convertedData.data[0].flightPoints[0].iataCode);
		console.log("🛬 Nach:", convertedData.data[0].flightPoints[1].iataCode);
		console.log(
			"📍 Real-time Status:",
			convertedData.data[0]._realTimeData.status
		);
	}

	return convertedData;
};

console.log(
	"🧪 GoFlightLabs Test geladen - Rufe testGoFlightLabsConversion() auf"
);
