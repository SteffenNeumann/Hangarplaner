(function () {
  function toDateStr(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate() + 0).padStart(2, "0");
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

  // Small utility: debounce frequent input events to avoid excessive API calls
  function debounce(fn, delay) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
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

  // Autorun logic: configurable via URL (?autorun=0/false/off to disable)
  function autorunTimetableOnce() {
    try {
      // Prevent double execution
      if (window.__timetableAutorunDone) return;

      const params = new URLSearchParams(window.location.search || '');
      const p = (params.get('autorun') || '').toLowerCase();
      const enabled = !(p === '0' || p === 'false' || p === 'off');
      if (!enabled) return;

      // Wait for dependencies in a lightweight retry loop
      let attempts = 0;
      const maxAttempts = 30; // up to ~7.5s at 250ms
      const tryRun = () => {
        // Prefer calling the public helper if present
        if (typeof window.reloadTimetableAllFlights === 'function') {
          window.__timetableAutorunDone = true;
          // Slight delay so any late UI defaults (like date) apply
          return setTimeout(window.reloadTimetableAllFlights, 200);
        }
        // Fallback: call the local runner if AirportFlights is ready
        if (window.AirportFlights && typeof window.AirportFlights.displayAirportFlights === 'function') {
          window.__timetableAutorunDone = true;
          return setTimeout(runTimetableReloadUsingThisPageInputs, 200);
        }
        if (attempts++ < maxAttempts) return setTimeout(tryRun, 250);
        // Give up quietly after timeout
        console.warn('[Timetable-Adapter] Autorun skipped: dependencies not ready');
      };
      tryRun();
    } catch (e) {
      // Do not throw during page load
      console.warn('[Timetable-Adapter] Autorun error:', e);
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

    // Instant filter for Airline Code: live-update on input with a short debounce
    const operatorInput = document.getElementById("operatorCodeInput");
    if (operatorInput) {
      const handler = debounce(() => {
        if (typeof window.reloadTimetableAllFlights === 'function') {
          window.reloadTimetableAllFlights();
        } else {
          runTimetableReloadUsingThisPageInputs();
        }
      }, 400);
      // Use change (not input) to avoid heavy API reloads on each keystroke; instant UI filter handles live typing
      operatorInput.addEventListener('change', handler);
    }

    // Optional global utility for manual triggering
    window.reloadTimetableAllFlights = runTimetableReloadUsingThisPageInputs;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){
      setup();
      autorunTimetableOnce();
    });
  } else {
    setup();
    autorunTimetableOnce();
  }
})();

