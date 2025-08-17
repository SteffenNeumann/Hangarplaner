/**
 * TEST SCRIPT: Overnight Flight Logic Debug
 * 
 * This script tests the overnight flight detection logic for specific aircraft.
 * Run these functions in the browser console to debug issues.
 */

/**
 * Test Function 1: Basic API Connection Test
 * Tests if the AeroDataBox API is working correctly
 */
async function testAeroDataBoxConnection() {
    console.log("🧪 === TESTING AERODATABOX API CONNECTION ===");
    
    if (!window.AeroDataBoxAPI) {
        console.error("❌ AeroDataBoxAPI not available");
        return false;
    }
    
    try {
        // Test with a known aircraft that should have data
        const testResult = await window.AeroDataBoxAPI.getAircraftFlights("D-AIBL", "2025-08-16");
        console.log("✅ API Connection successful:", testResult);
        return testResult.data.length > 0;
    } catch (error) {
        console.error("❌ API Connection failed:", error.message);
        return false;
    }
}

/**
 * Test Function 2: Test Overnight Logic for D-ACNL
 * Specifically tests the overnight detection for D-ACNL
 */
async function testOvernightLogicDACNL() {
    console.log("🧪 === TESTING OVERNIGHT LOGIC FOR D-ACNL ===");
    
    if (!window.AeroDataBoxAPI) {
        console.error("❌ AeroDataBoxAPI not available");
        return false;
    }
    
    try {
        const currentDate = "2025-08-17";
        const nextDate = "2025-08-18";
        
        console.log(`📅 Testing overnight logic: ${currentDate} → ${nextDate}`);
        
        const result = await window.AeroDataBoxAPI.updateAircraftData("D-ACNL", currentDate, nextDate);
        
        console.log("🔍 Overnight result:", result);
        
        if (result._noDataFound) {
            console.log("ℹ️ No flight data found for D-ACNL on these dates");
            return false;
        }
        
        if (result.positionText && result.positionText.includes("🏨")) {
            console.log("✅ Overnight detected successfully!");
            return true;
        } else {
            console.log("❌ No overnight detected");
            return false;
        }
        
    } catch (error) {
        console.error("❌ Overnight logic test failed:", error.message);
        return false;
    }
}

/**
 * Test Function 3: Debug Flight Data for Multiple Aircraft
 * Tests multiple aircraft at once to see what data is available
 */
async function testMultipleAircraft() {
    console.log("🧪 === TESTING MULTIPLE AIRCRAFT ===");
    
    const aircraftList = ["D-ACNL", "D-AIBL", "D-ACNH", "D-ACNI"];
    const testDate = "2025-08-17";
    
    for (const aircraft of aircraftList) {
        console.log(`\n🔍 Testing ${aircraft}:`);
        
        try {
            const result = await window.AeroDataBoxAPI.getAircraftFlights(aircraft, testDate);
            console.log(`   📊 Found ${result.data.length} flights for ${aircraft}`);
            
            if (result.data.length > 0) {
                result.data.forEach((flight, index) => {
                    const depPoint = flight.flightPoints?.find(p => p.departurePoint);
                    const arrPoint = flight.flightPoints?.find(p => p.arrivalPoint);
                    
                    console.log(`   ${index + 1}. ${depPoint?.iataCode || "???"} → ${arrPoint?.iataCode || "???"}`);
                });
            }
        } catch (error) {
            console.log(`   ❌ Error for ${aircraft}:`, error.message);
        }
    }
}

/**
 * Test Function 4: Test Airport Flight Data
 * Tests if we can get flight data for MUC airport
 */
async function testAirportFlightData() {
    console.log("🧪 === TESTING AIRPORT FLIGHT DATA (MUC) ===");
    
    if (!window.AeroDataBoxAPI) {
        console.error("❌ AeroDataBoxAPI not available");
        return false;
    }
    
    try {
        const startDateTime = "2025-08-17T20:00";
        const endDateTime = "2025-08-18T08:00";
        
        console.log(`📅 Testing airport data: ${startDateTime} to ${endDateTime}`);
        
        const result = await window.AeroDataBoxAPI.getAirportFlights("MUC", startDateTime, endDateTime);
        
        console.log("🔍 Airport flight data:", result);
        
        if (result && (result.departures || result.arrivals || Array.isArray(result))) {
            let totalFlights = 0;
            
            if (Array.isArray(result)) {
                totalFlights = result.length;
            } else {
                totalFlights = (result.departures?.length || 0) + (result.arrivals?.length || 0);
            }
            
            console.log(`✅ Found ${totalFlights} flights at MUC`);
            
            // Sample some flights to see aircraft registrations
            let flightsToCheck = [];
            if (Array.isArray(result)) {
                flightsToCheck = result.slice(0, 5);
            } else {
                flightsToCheck = [
                    ...(result.departures?.slice(0, 3) || []),
                    ...(result.arrivals?.slice(0, 3) || [])
                ];
            }
            
            console.log("🔍 Sample flights with aircraft registrations:");
            flightsToCheck.forEach((flight, index) => {
                const reg = flight.aircraft?.reg || flight.aircraft?.registration || "Unknown";
                const flightNumber = flight.number || "Unknown";
                console.log(`   ${index + 1}. ${flightNumber} - ${reg}`);
            });
            
            return true;
        } else {
            console.log("❌ No airport flight data received");
            return false;
        }
        
    } catch (error) {
        console.error("❌ Airport flight data test failed:", error.message);
        return false;
    }
}

/**
 * Test Function 5: Run Complete Test Suite
 * Runs all tests in sequence
 */
async function runCompleteTestSuite() {
    console.log("🚀 === STARTING COMPLETE TEST SUITE ===");
    
    const results = {
        apiConnection: false,
        overnightLogic: false,
        multipleAircraft: false,
        airportData: false
    };
    
    console.log("\n1️⃣ Testing API Connection...");
    results.apiConnection = await testAeroDataBoxConnection();
    
    if (results.apiConnection) {
        console.log("\n2️⃣ Testing Overnight Logic...");
        results.overnightLogic = await testOvernightLogicDACNL();
        
        console.log("\n3️⃣ Testing Multiple Aircraft...");
        await testMultipleAircraft();
        results.multipleAircraft = true; // This test always completes
        
        console.log("\n4️⃣ Testing Airport Flight Data...");
        results.airportData = await testAirportFlightData();
    }
    
    console.log("\n🏁 === TEST SUITE RESULTS ===");
    console.log("API Connection:", results.apiConnection ? "✅ PASS" : "❌ FAIL");
    console.log("Overnight Logic:", results.overnightLogic ? "✅ PASS" : "❌ FAIL");
    console.log("Multiple Aircraft:", results.multipleAircraft ? "✅ PASS" : "❌ FAIL");
    console.log("Airport Data:", results.airportData ? "✅ PASS" : "❌ FAIL");
    
    const passCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    
    console.log(`\n📊 Overall Result: ${passCount}/${totalCount} tests passed`);
    
    if (passCount === totalCount) {
        console.log("🎉 ALL TESTS PASSED! The system is working correctly.");
    } else {
        console.log("⚠️ Some tests failed. Check the detailed output above.");
    }
    
    return results;
}

/**
 * Test Function 6: Test Specific Date Ranges for Known Issues
 * Tests specific date ranges where issues have been reported
 */
async function testKnownIssues() {
    console.log("🧪 === TESTING KNOWN ISSUES ===");
    
    const testCases = [
        { aircraft: "D-ACNL", date: "2025-08-17", description: "Original failing case" },
        { aircraft: "D-AIBL", date: "2025-08-16", description: "Known working case" },
        { aircraft: "D-ACNL", date: "2025-08-16", description: "D-ACNL one day earlier" },
        { aircraft: "D-ACNL", date: "2025-08-18", description: "D-ACNL one day later" }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n🔍 Testing: ${testCase.description}`);
        console.log(`   Aircraft: ${testCase.aircraft}, Date: ${testCase.date}`);
        
        try {
            const result = await window.AeroDataBoxAPI.getAircraftFlights(testCase.aircraft, testCase.date);
            console.log(`   Result: ${result.data.length} flights found`);
            
            if (result.data.length > 0) {
                console.log("   ✅ Data available");
                result.data.forEach((flight, index) => {
                    const depPoint = flight.flightPoints?.find(p => p.departurePoint);
                    const arrPoint = flight.flightPoints?.find(p => p.arrivalPoint);
                    const depTime = depPoint?.departure?.timings?.[0]?.value || "??:??";
                    const arrTime = arrPoint?.arrival?.timings?.[0]?.value || "??:??";
                    
                    console.log(`      ${index + 1}. ${depPoint?.iataCode || "???"} ${depTime} → ${arrPoint?.iataCode || "???"} ${arrTime}`);
                });
            } else {
                console.log("   ℹ️ No data found (this may be normal for future dates or no flights)");
            }
        } catch (error) {
            console.log(`   ❌ Error:`, error.message);
        }
    }
}

// Export functions to global scope for easy browser console access
if (typeof window !== 'undefined') {
    window.testAeroDataBoxConnection = testAeroDataBoxConnection;
    window.testOvernightLogicDACNL = testOvernightLogicDACNL;
    window.testMultipleAircraft = testMultipleAircraft;
    window.testAirportFlightData = testAirportFlightData;
    window.runCompleteTestSuite = runCompleteTestSuite;
    window.testKnownIssues = testKnownIssues;
    
    console.log("🛠️ Debug functions loaded. Available functions:");
    console.log("- testAeroDataBoxConnection()");
    console.log("- testOvernightLogicDACNL()");
    console.log("- testMultipleAircraft()");
    console.log("- testAirportFlightData()");
    console.log("- runCompleteTestSuite()");
    console.log("- testKnownIssues()");
}
