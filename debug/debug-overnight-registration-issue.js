/**
 * DEBUG SCRIPT: Analyze Overnight Registration Detection Issue
 * 
 * This script helps identify why no aircraft registrations are being found
 * during overnight flight processing.
 * 
 * USAGE:
 * 1. Open browser console on hangar planner page
 * 2. Copy and paste this entire script
 * 3. Call: debugOvernightRegistrationIssue()
 */

window.debugOvernightRegistrationIssue = async function() {
    console.log(`🔍 === OVERNIGHT REGISTRATION DETECTION DEBUG ===`);
    
    // Get current parameters from UI
    const selectedAirport = document.getElementById("airportCodeInput")?.value?.trim()?.toUpperCase() || "MUC";
    const today = new Date().toISOString().substring(0, 10);
    const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().substring(0, 10);
    
    console.log(`🏢 Airport: ${selectedAirport}`);
    console.log(`📅 Today: ${today}`);
    console.log(`📅 Tomorrow: ${tomorrow}`);
    console.log(`📅 System Date: ${new Date().toISOString()}`);
    
    // Step 1: Get a sample of airport flights
    console.log(`📡 Getting sample flights from ${selectedAirport}...`);
    
    try {
        const sampleTimeWindow = `${today}T06:00/${today}T18:00`;
        const sampleFlights = await window.AeroDataBoxAPI.getAirportFlights(
            selectedAirport, 
            `${today}T06:00`, 
            `${today}T18:00`
        );
        
        console.log(`✅ Sample flights received:`, sampleFlights);
        
        if (!sampleFlights) {
            console.log(`❌ No flight data returned from API`);
            return;
        }
        
        // Extract flights array
        let flightsToAnalyze = [];
        if (Array.isArray(sampleFlights)) {
            flightsToAnalyze = sampleFlights;
        } else {
            if (sampleFlights.departures) flightsToAnalyze = flightsToAnalyze.concat(sampleFlights.departures);
            if (sampleFlights.arrivals) flightsToAnalyze = flightsToAnalyze.concat(sampleFlights.arrivals);
        }
        
        console.log(`📊 Total flights to analyze: ${flightsToAnalyze.length}`);
        
        if (flightsToAnalyze.length === 0) {
            console.log(`❌ No flights in response data structure`);
            return;
        }
        
        // Step 2: Analyze first 10 flights in detail
        console.log(`🔍 === DETAILED FLIGHT ANALYSIS ===`);
        
        for (let i = 0; i < Math.min(10, flightsToAnalyze.length); i++) {
            const flight = flightsToAnalyze[i];
            
            console.log(`\n🔍 FLIGHT ${i + 1} ANALYSIS:`);
            console.log(`   Flight Number: ${flight.number}`);
            console.log(`   Full Flight Object:`);
            console.dir(flight, { depth: 2 });
            
            // Test registration extraction
            const registration = flight.aircraft?.reg || 
                               flight.aircraft?.registration || 
                               flight.aircraft?.tail ||
                               flight.aircraftRegistration ||
                               flight.registration;
                               
            console.log(`   🆔 REGISTRATION EXTRACTION:`);
            console.log(`     - flight.aircraft?.reg: ${flight.aircraft?.reg}`);
            console.log(`     - flight.aircraft?.registration: ${flight.aircraft?.registration}`);
            console.log(`     - flight.aircraft?.tail: ${flight.aircraft?.tail}`);
            console.log(`     - flight.aircraftRegistration: ${flight.aircraftRegistration}`);
            console.log(`     - flight.registration: ${flight.registration}`);
            console.log(`     - EXTRACTED: ${registration}`);
            
            // Test date extraction
            const flightDate = flight.departure?.scheduledTime?.utc?.substring(0, 10) || 
                             flight.arrival?.scheduledTime?.utc?.substring(0, 10);
            const arrivalAirport = flight.arrival?.airport?.iata || flight.arrival?.airport?.icao;
            const departureAirport = flight.departure?.airport?.iata || flight.departure?.airport?.icao;
            const arrivalTime = flight.arrival?.scheduledTime?.utc;
            const departureTime = flight.departure?.scheduledTime?.utc;
            
            console.log(`   📅 DATE & AIRPORT EXTRACTION:`);
            console.log(`     - flightDate: ${flightDate}`);
            console.log(`     - arrivalAirport: ${arrivalAirport}`);
            console.log(`     - departureAirport: ${departureAirport}`);
            console.log(`     - arrivalTime: ${arrivalTime}`);
            console.log(`     - departureTime: ${departureTime}`);
            
            // Test overnight candidate filtering
            const isDay1Arrival = flightDate === today && arrivalAirport === selectedAirport && arrivalTime;
            const isDay2Departure = flightDate === tomorrow && departureAirport === selectedAirport && departureTime;
            
            console.log(`   🏨 OVERNIGHT CANDIDATE TEST:`);
            console.log(`     - isDay1Arrival: ${isDay1Arrival} (${flightDate} === ${today} && ${arrivalAirport} === ${selectedAirport} && ${!!arrivalTime})`);
            console.log(`     - isDay2Departure: ${isDay2Departure} (${flightDate} === ${tomorrow} && ${departureAirport} === ${selectedAirport} && ${!!departureTime})`);
            console.log(`     - passesFilter: ${isDay1Arrival || isDay2Departure}`);
            
            // If this would be an overnight candidate, check what happens
            if (isDay1Arrival || isDay2Departure) {
                console.log(`   ✅ OVERNIGHT CANDIDATE FOUND!`);
                if (registration) {
                    console.log(`     - Has direct registration: ${registration}`);
                } else {
                    console.log(`     - Needs flight number lookup: ${flight.number}`);
                }
            }
            
            console.log(`   ---`);
        }
        
        // Step 3: Summary statistics
        console.log(`\n📊 === SUMMARY STATISTICS ===`);
        let stats = {
            totalFlights: flightsToAnalyze.length,
            withDirectRegistration: 0,
            withoutRegistration: 0,
            day1Arrivals: 0,
            day2Departures: 0,
            overnightCandidates: 0,
            uniqueRegistrations: new Set(),
            flightNumbers: new Set()
        };
        
        flightsToAnalyze.forEach(flight => {
            const registration = flight.aircraft?.reg || 
                               flight.aircraft?.registration || 
                               flight.aircraft?.tail ||
                               flight.aircraftRegistration ||
                               flight.registration;
            
            const flightDate = flight.departure?.scheduledTime?.utc?.substring(0, 10) || 
                             flight.arrival?.scheduledTime?.utc?.substring(0, 10);
            const arrivalAirport = flight.arrival?.airport?.iata || flight.arrival?.airport?.icao;
            const departureAirport = flight.departure?.airport?.iata || flight.departure?.airport?.icao;
            const arrivalTime = flight.arrival?.scheduledTime?.utc;
            const departureTime = flight.departure?.scheduledTime?.utc;
            
            const isDay1Arrival = flightDate === today && arrivalAirport === selectedAirport && arrivalTime;
            const isDay2Departure = flightDate === tomorrow && departureAirport === selectedAirport && departureTime;
            
            if (isDay1Arrival) stats.day1Arrivals++;
            if (isDay2Departure) stats.day2Departures++;
            if (isDay1Arrival || isDay2Departure) {
                stats.overnightCandidates++;
                if (registration) {
                    stats.withDirectRegistration++;
                    stats.uniqueRegistrations.add(registration.toUpperCase());
                } else {
                    stats.withoutRegistration++;
                    if (flight.number) stats.flightNumbers.add(flight.number);
                }
            }
        });
        
        console.log(`📊 Flight Analysis Results:`);
        console.log(`   - Total flights: ${stats.totalFlights}`);
        console.log(`   - Day 1 arrivals to ${selectedAirport}: ${stats.day1Arrivals}`);
        console.log(`   - Day 2 departures from ${selectedAirport}: ${stats.day2Departures}`);
        console.log(`   - Total overnight candidates: ${stats.overnightCandidates}`);
        console.log(`   - With direct registration: ${stats.withDirectRegistration}`);
        console.log(`   - Without registration (need lookup): ${stats.withoutRegistration}`);
        console.log(`   - Unique registrations found: ${stats.uniqueRegistrations.size}`);
        console.log(`   - Flight numbers for lookup: ${stats.flightNumbers.size}`);
        
        if (stats.uniqueRegistrations.size > 0) {
            console.log(`🆔 Direct registrations found: [${Array.from(stats.uniqueRegistrations).join(', ')}]`);
        }
        
        if (stats.flightNumbers.size > 0) {
            console.log(`🔢 Flight numbers needing lookup: [${Array.from(stats.flightNumbers).slice(0, 10).join(', ')}${stats.flightNumbers.size > 10 ? '...' : ''}]`);
        }
        
        // Step 4: Recommendations
        console.log(`\n💡 === RECOMMENDATIONS ===`);
        
        if (stats.overnightCandidates === 0) {
            console.log(`❌ ISSUE: No overnight candidates found`);
            console.log(`   - Check if date filtering logic is correct`);
            console.log(`   - Verify that flights are being returned for the correct dates`);
            console.log(`   - Current system date might not match expected date range`);
        } else if (stats.withDirectRegistration === 0 && stats.withoutRegistration > 0) {
            console.log(`⚠️ ISSUE: Overnight candidates found but no direct registrations`);
            console.log(`   - All candidates need flight number lookup`);
            console.log(`   - Check if AeroDataBox API is returning registration data in aircraft fields`);
            console.log(`   - May need to adjust registration extraction logic`);
        } else if (stats.withDirectRegistration > 0) {
            console.log(`✅ SUCCESS: Found ${stats.withDirectRegistration} overnight candidates with direct registrations`);
            console.log(`   - System should be working for these aircraft`);
            console.log(`   - Check why they're not being processed further`);
        }
        
        console.log(`\n🔍 === DEBUG COMPLETE ===`);
        return stats;
        
    } catch (error) {
        console.error(`❌ Error during debug analysis:`, error);
    }
};

console.log(`🔧 Debug script loaded. Run: debugOvernightRegistrationIssue()`);
