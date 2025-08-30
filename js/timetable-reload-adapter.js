(function () {
  function toDateStr(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function nextDateStr(dateStr) {
    try {
      const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + 1);
      return toDateStr(dt);
    } catch (e) {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      return toDateStr(t);
    }
  }

  // Simple pass-through reload that ensures AirportFlights renders arrivals and departures for the station
  function runTimetableReloadUsingThisPageInputs() {
    const airportEl = document.getElementById("airportCodeInput");
    const dateEl = document.getElementById("flightDateInput");
    const operatorEl = document.getElementById("operatorCodeInput");

    const airport = (airportEl?.value || "MUC").trim().toUpperCase();
    const selectedDate = dateEl?.value || toDateStr(new Date());

    // 12h window: 20:00 selected day to 08:00 next day (matches AirportFlights defaults)
    const startDateTime = `${selectedDate}T20:00`;
    const nextDate = nextDateStr(selectedDate);
    const endDateTime = `${nextDate}T08:00`;

    const operatorCode = (operatorEl?.value || '').trim();

    if (window.AirportFlights && typeof window.AirportFlights.displayAirportFlights === 'function') {
      window.AirportFlights.displayAirportFlights(airport, startDateTime, endDateTime, operatorCode);
    } else {
      console.warn('[Timetable-Adapter] AirportFlights.displayAirportFlights nicht verfügbar');
    }
  }

  function setup() {
    const btn = document.getElementById("showAirportFlightsBtn");
    if (!btn) return;

    // Delegate to AirportFlights to render ALL flights (arrivals + departures)
    btn.addEventListener("click", () => {
      // Short delay to avoid clashing with any other handlers
      setTimeout(runTimetableReloadUsingThisPageInputs, 0);
    });

    // Optional global utility for manual triggering
    window.reloadTimetableAllFlights = runTimetableReloadUsingThisPageInputs;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();

