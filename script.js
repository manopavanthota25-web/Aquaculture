/* ===== AquaSmart – Application Logic ===== */

(function () {
  "use strict";

  /* ---------- Constants & Config ---------- */

  // Open-Meteo API endpoints
  const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
  const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

  // LocalStorage key
  const STORAGE_KEY = "aquaSmart_ponds";

  /* ---------- Fish Species Database (rule-based) ----------
   * Each species has verified requirement ranges gathered from
   * standard aquaculture reference materials (CIFA, FAO).
   * The recommendation engine compares pond data + weather
   * against these ranges and produces a suitability score.
   */
  const FISH_SPECIES = [
    {
      name: "Rohu",
      scientificName: "Labeo rohita",
      waterType: "freshwater",
      phRange: [6.5, 8.5],
      doRange: [4, 12],
      salinityMax: 2,
      tempRange: [22, 33],
      depthMin: 1.0,
      areaMin: 0.05,
      description:
        "A major Indian carp, herbivorous and fast-growing. Best suited to freshwater ponds with moderate depth.",
    },
    {
      name: "Catla",
      scientificName: "Catla catla",
      waterType: "freshwater",
      phRange: [6.5, 8.5],
      doRange: [4, 12],
      salinityMax: 2,
      tempRange: [25, 33],
      depthMin: 1.5,
      areaMin: 0.1,
      description:
        "A surface feeder among Indian major carps. Requires deeper ponds and grows rapidly with supplementary feed.",
    },
    {
      name: "Mrigal",
      scientificName: "Cirrhinus mrigala",
      waterType: "freshwater",
      phRange: [6.5, 8.5],
      doRange: [4, 12],
      salinityMax: 2,
      tempRange: [22, 33],
      depthMin: 1.0,
      areaMin: 0.05,
      description:
        "A bottom-feeder among Indian major carps. Tolerates slightly lower oxygen and adapts well to varied pond conditions.",
    },
    {
      name: "Tilapia",
      scientificName: "Oreochromis niloticus",
      waterType: "both",
      phRange: [5.5, 9.0],
      doRange: [3, 15],
      salinityMax: 35,
      tempRange: [20, 35],
      depthMin: 0.8,
      areaMin: 0.02,
      description:
        "A hardy, fast-growing fish tolerant of brackish and freshwater. Suitable for small ponds and high-density farming.",
    },
    {
      name: "Common Carp",
      scientificName: "Cyprinus carpio",
      waterType: "both",
      phRange: [6.0, 9.0],
      doRange: [3, 12],
      salinityMax: 7,
      tempRange: [18, 30],
      depthMin: 0.8,
      areaMin: 0.02,
      description:
        "A hardy bottom-feeder that adapts to a wide range of water conditions. Tolerates cooler temperatures better than Indian carps.",
    },
  ];

  /* ---------- Utility Helpers ---------- */

  /**
   * Show a temporary toast message at the bottom of the screen.
   * @param {string} message - The message to display.
   * @param {"success"|"error"|"info"} type - Message style.
   */
  function showToast(message, type) {
    var existing = document.querySelector(".toast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.className = "toast toast-" + (type || "info");
    toast.textContent = message;
    document.body.appendChild(toast);

    // Force reflow then add show class
    void toast.offsetWidth;
    toast.classList.add("show");

    setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 3000);
  }

  /**
   * Escape user-provided text before inserting into innerHTML.
   * Prevents XSS from pond names or locations.
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format a number for display, removing unnecessary trailing zeros.
   * @param {number} num
   * @returns {string}
   */
  function formatNumber(num) {
    if (num === null || num === undefined || num === "") return "—";
    return parseFloat(num).toString();
  }

  /* ---------- Navigation ---------- */

  /**
   * Show the section with the given id and hide all others.
   * Updates the active state of navigation links.
   * @param {string} sectionId
   */
  function showSection(sectionId) {
    var sections = document.querySelectorAll(".page-section");
    for (var i = 0; i < sections.length; i++) {
      sections[i].classList.remove("active");
    }

    var target = document.getElementById(sectionId);
    if (target) {
      target.classList.add("active");
    }

    var links = document.querySelectorAll(".nav-link");
    for (var j = 0; j < links.length; j++) {
      links[j].classList.remove("active");
      if (links[j].getAttribute("data-section") === sectionId) {
        links[j].classList.add("active");
      }
    }

    // Close mobile menu if open
    var navLinks = document.getElementById("navLinks");
    if (navLinks) navLinks.classList.remove("open");
    var toggle = document.getElementById("navToggle");
    if (toggle) toggle.setAttribute("aria-expanded", "false");

    // Scroll to top of content
    window.scrollTo(0, 0);
  }

  /**
   * Set up all navigation event listeners.
   */
  function initNavigation() {
    var navLinks = document.querySelectorAll(".nav-link");
    for (var i = 0; i < navLinks.length; i++) {
      navLinks[i].addEventListener("click", function (e) {
        e.preventDefault();
        var sectionId = this.getAttribute("data-section");
        showSection(sectionId);
      });
    }

    // Hero buttons with data-nav attribute
    var heroBtns = document.querySelectorAll("[data-nav]");
    for (var j = 0; j < heroBtns.length; j++) {
      heroBtns[j].addEventListener("click", function (e) {
        e.preventDefault();
        showSection(this.getAttribute("data-nav"));
      });
    }

    // Mobile hamburger toggle
    var toggle = document.getElementById("navToggle");
    var linksContainer = document.getElementById("navLinks");
    if (toggle && linksContainer) {
      toggle.addEventListener("click", function () {
        var isOpen = linksContainer.classList.toggle("open");
        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
    }
  }

  /* ---------- LocalStorage Helpers ---------- */

  /**
   * Read all saved ponds from LocalStorage.
   * @returns {Array<Object>}
   */
  function getPonds() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("Failed to parse saved ponds:", e);
      return [];
    }
  }

  /**
   * Save the ponds array to LocalStorage.
   * @param {Array<Object>} ponds
   */
  function savePonds(ponds) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ponds));
    } catch (e) {
      console.error("Failed to save ponds:", e);
      showToast("Unable to save data. Storage may be full.", "error");
    }
  }

  /**
   * Generate a simple unique id for a pond.
   * @returns {string}
   */
  function generateId() {
    return "pond_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  }

  /* ---------- Pond Form Validation ---------- */

  /**
   * Validate a single form field and show / clear its error message.
   * @param {HTMLInputElement|HTMLSelectElement} field
   * @returns {boolean} true if valid
   */
  function validateField(field) {
    var errorSpan = document.getElementById("err-" + field.id);
    var value = field.value.trim();
    var isValid = true;
    var msg = "";

    field.classList.remove("input-error");

    // Required check
    if (field.hasAttribute("required") && value === "") {
      msg = "This field is required.";
      isValid = false;
    }

    // Number validations
    if (isValid && value !== "") {
      var numVal = parseFloat(value);

      if (field.id === "pondArea") {
        if (isNaN(numVal) || numVal <= 0) {
          msg = "Area must be a positive number.";
          isValid = false;
        }
      } else if (field.id === "pondDepth") {
        if (isNaN(numVal) || numVal < 0.1) {
          msg = "Depth must be at least 0.1 metres.";
          isValid = false;
        }
      } else if (field.id === "ph") {
        if (isNaN(numVal) || numVal < 0 || numVal > 14) {
          msg = "pH must be between 0 and 14.";
          isValid = false;
        }
      } else if (field.id === "dissolvedOxygen" && value !== "") {
        if (isNaN(numVal) || numVal < 0) {
          msg = "Dissolved oxygen cannot be negative.";
          isValid = false;
        }
      } else if (field.id === "salinity" && value !== "") {
        if (isNaN(numVal) || numVal < 0) {
          msg = "Salinity cannot be negative.";
          isValid = false;
        }
      }
    }

    if (!isValid) {
      field.classList.add("input-error");
      if (errorSpan) errorSpan.textContent = msg;
    } else {
      if (errorSpan) errorSpan.textContent = "";
    }

    return isValid;
  }

  /**
   * Validate the entire pond form.
   * @returns {boolean}
   */
  function validateForm() {
    var fields = [
      document.getElementById("pondName"),
      document.getElementById("location"),
      document.getElementById("pondArea"),
      document.getElementById("pondDepth"),
      document.getElementById("waterType"),
      document.getElementById("ph"),
      document.getElementById("dissolvedOxygen"),
      document.getElementById("salinity"),
    ];

    var allValid = true;
    for (var i = 0; i < fields.length; i++) {
      if (!validateField(fields[i])) {
        allValid = false;
      }
    }
    return allValid;
  }

  /**
   * Collect form data into a pond object.
   * @returns {Object|null}
   */
  function collectFormData() {
    var pondName = document.getElementById("pondName").value.trim();
    var location = document.getElementById("location").value.trim();
    var pondArea = document.getElementById("pondArea").value.trim();
    var pondDepth = document.getElementById("pondDepth").value.trim();
    var waterType = document.getElementById("waterType").value;
    var ph = document.getElementById("ph").value.trim();
    var doRaw = document.getElementById("dissolvedOxygen").value.trim();
    var salRaw = document.getElementById("salinity").value.trim();

    if (!pondName || !location || !pondArea || !pondDepth || !waterType || !ph) {
      return null;
    }

    return {
      id: generateId(),
      pondName: pondName,
      location: location,
      pondArea: parseFloat(pondArea),
      pondDepth: parseFloat(pondDepth),
      waterType: waterType,
      ph: parseFloat(ph),
      dissolvedOxygen: doRaw ? parseFloat(doRaw) : null,
      salinity: salRaw ? parseFloat(salRaw) : null,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Clear all form fields and error messages.
   */
  function resetForm() {
    var form = document.getElementById("pondForm");
    if (form) form.reset();

    var errorSpans = document.querySelectorAll(".error-msg");
    for (var i = 0; i < errorSpans.length; i++) {
      errorSpans[i].textContent = "";
    }

    var inputs = form.querySelectorAll("input, select");
    for (var j = 0; j < inputs.length; j++) {
      inputs[j].classList.remove("input-error");
    }

    // Reset to save mode
    document.getElementById("saveBtn").style.display = "";
    document.getElementById("updateBtn").style.display = "none";
    document.getElementById("updateBtn").removeAttribute("data-edit-id");
  }

  /**
   * Populate the form with data from a saved pond (for editing).
   * @param {Object} pond
   */
  function fillFormWithPond(pond) {
    document.getElementById("pondName").value = pond.pondName || "";
    document.getElementById("location").value = pond.location || "";
    document.getElementById("pondArea").value = pond.pondArea || "";
    document.getElementById("pondDepth").value = pond.pondDepth || "";
    document.getElementById("waterType").value = pond.waterType || "";
    document.getElementById("ph").value = pond.ph || "";
    document.getElementById("dissolvedOxygen").value =
      pond.dissolvedOxygen != null ? pond.dissolvedOxygen : "";
    document.getElementById("salinity").value =
      pond.salinity != null ? pond.salinity : "";

    // Switch to update mode
    document.getElementById("saveBtn").style.display = "none";
    var updateBtn = document.getElementById("updateBtn");
    updateBtn.style.display = "";
    updateBtn.setAttribute("data-edit-id", pond.id);

    showSection("pond-registration");
    showToast("Pond loaded for editing. Make changes and click Update.", "info");
  }

  /* ---------- Saved Ponds List Rendering ---------- */

  /**
   * Render the list of saved ponds in the Pond Registration section.
   */
  function renderSavedPonds() {
    var container = document.getElementById("savedPondsList");
    if (!container) return;

    var ponds = getPonds();

    if (ponds.length === 0) {
      container.innerHTML =
        '<p class="empty-state">No ponds saved yet. Fill in the form above and click "Save Pond Details".</p>';
      refreshPondDropdown();
      return;
    }

    var html = "";
    for (var i = 0; i < ponds.length; i++) {
      var p = ponds[i];
      var badgeClass = p.waterType === "brackish" ? "badge-brackish" : "badge-freshwater";
      var badgeLabel = p.waterType === "brackish" ? "Brackish Water" : "Freshwater";

      html +=
        '<div class="pond-item">' +
        '<div class="pond-item-info">' +
        "<h4>" + escapeHtml(p.pondName) + "</h4>" +
        "<p>Location: " + escapeHtml(p.location) + "</p>" +
        "<p>Area: " + formatNumber(p.pondArea) + " ha | Depth: " + formatNumber(p.pondDepth) + " m</p>" +
        "<p>pH: " + formatNumber(p.ph) +
        (p.dissolvedOxygen != null ? " | DO: " + formatNumber(p.dissolvedOxygen) + " mg/L" : "") +
        (p.salinity != null ? " | Salinity: " + formatNumber(p.salinity) + " ppt" : "") +
        "</p>" +
        '<span class="pond-item-badge ' + badgeClass + '">' + badgeLabel + "</span>" +
        "</div>" +
        '<div class="pond-item-actions">' +
        '<button class="btn btn-secondary" data-edit="' + p.id + '">Edit</button>' +
        '<button class="btn btn-danger" data-delete="' + p.id + '">Delete</button>' +
        "</div>" +
        "</div>";
    }

    container.innerHTML = html;

    // Attach event listeners to Edit and Delete buttons
    var editBtns = container.querySelectorAll("[data-edit]");
    for (var e = 0; e < editBtns.length; e++) {
      editBtns[e].addEventListener("click", function () {
        var pondId = this.getAttribute("data-edit");
        var pond = findPondById(pondId);
        if (pond) fillFormWithPond(pond);
      });
    }

    var delBtns = container.querySelectorAll("[data-delete]");
    for (var d = 0; d < delBtns.length; d++) {
      delBtns[d].addEventListener("click", function () {
        var pondId = this.getAttribute("data-delete");
        deletePond(pondId);
      });
    }

    refreshPondDropdown();
  }

  /**
   * Find a pond by its id.
   * @param {string} id
   * @returns {Object|null}
   */
  function findPondById(id) {
    var ponds = getPonds();
    for (var i = 0; i < ponds.length; i++) {
      if (ponds[i].id === id) return ponds[i];
    }
    return null;
  }

  /**
   * Delete a pond by id, then re-render.
   * @param {string} id
   */
  function deletePond(id) {
    var ponds = getPonds();
    var filtered = ponds.filter(function (p) {
      return p.id !== id;
    });
    savePonds(filtered);
    renderSavedPonds();
    showToast("Pond deleted successfully.", "success");
  }

  /**
   * Update an existing pond in the array.
   * @param {Object} updatedPond
   */
  function updatePondInList(updatedPond) {
    var ponds = getPonds();
    for (var i = 0; i < ponds.length; i++) {
      if (ponds[i].id === updatedPond.id) {
        ponds[i] = updatedPond;
        break;
      }
    }
    savePonds(ponds);
  }

  /**
   * Refresh the pond dropdown selector on the Recommendations page.
   */
  function refreshPondDropdown() {
    var select = document.getElementById("selectPond");
    if (!select) return;

    var ponds = getPonds();
    select.innerHTML = '<option value="">-- Choose a pond --</option>';

    for (var i = 0; i < ponds.length; i++) {
      var opt = document.createElement("option");
      opt.value = ponds[i].id;
      opt.textContent = ponds[i].pondName + " (" + ponds[i].location + ")";
      select.appendChild(opt);
    }
  }

  /* ---------- Weather API ---------- */

  /**
   * Geocode a location name to coordinates using Open-Meteo Geocoding API.
   * @param {string} locationName
   * @returns {Promise<Object>} Resolves with {latitude, longitude, name, country}
   */
  function geocodeLocation(locationName) {
    var url =
      GEOCODING_API +
      "?name=" +
      encodeURIComponent(locationName) +
      "&count=1&language=en&format=json";

    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Geocoding API returned status " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (!data.results || data.results.length === 0) {
          throw new Error("Location not found. Please try a different name.");
        }
        var result = data.results[0];
        return {
          latitude: result.latitude,
          longitude: result.longitude,
          name: result.name,
          country: result.country || "",
          admin1: result.admin1 || "",
        };
      });
  }

  /**
   * Fetch weather data from Open-Meteo Weather API.
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<Object>}
   */
  function fetchWeather(latitude, longitude) {
    var url =
      WEATHER_API +
      "?latitude=" +
      latitude +
      "&longitude=" +
      longitude +
      "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
      "&timezone=auto";

    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Weather API returned status " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (!data.current) {
          throw new Error("Weather data unavailable for this location.");
        }
        return data.current;
      });
  }

  /**
   * Convert WMO weather code to a human-readable description.
   * @param {number} code
   * @returns {string}
   */
  function weatherCodeToText(code) {
    var map = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Depositing rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      56: "Light freezing drizzle",
      57: "Dense freezing drizzle",
      61: "Slight rain",
      63: "Moderate rain",
      65: "Heavy rain",
      66: "Light freezing rain",
      67: "Heavy freezing rain",
      71: "Slight snowfall",
      73: "Moderate snowfall",
      75: "Heavy snowfall",
      77: "Snow grains",
      80: "Slight rain showers",
      81: "Moderate rain showers",
      82: "Violent rain showers",
      85: "Slight snow showers",
      86: "Heavy snow showers",
      95: "Thunderstorm",
      96: "Thunderstorm with slight hail",
      99: "Thunderstorm with heavy hail",
    };
    return map[code] || "Unknown conditions";
  }

  /**
   * Handle the "Get Weather" button click.
   */
  function handleWeatherSearch() {
    var locationInput = document.getElementById("weatherLocation");
    var msgSpan = document.getElementById("weatherSearchMsg");
    var resultsDiv = document.getElementById("weatherResults");
    var location = locationInput.value.trim();

    msgSpan.textContent = "";
    msgSpan.className = "search-msg";

    if (!location) {
      msgSpan.textContent = "Please enter a location name.";
      msgSpan.classList.add("error");
      return;
    }

    // Show loading state
    resultsDiv.innerHTML =
      '<div class="loading"><span class="spinner"></span>Fetching weather data...</div>';

    geocodeLocation(location)
      .then(function (geo) {
        return fetchWeather(geo.latitude, geo.longitude).then(function (weather) {
          renderWeatherResults(geo, weather);
        });
      })
      .catch(function (error) {
        resultsDiv.innerHTML = "";
        msgSpan.textContent =
          error.message ||
          "Unable to fetch weather data. Please check the location and try again.";
        msgSpan.classList.add("error");
      });
  }

  /**
   * Render weather data into dashboard cards.
   * @param {Object} geo - Geocoded location info
   * @param {Object} weather - Current weather from API
   */
  function renderWeatherResults(geo, weather) {
    var resultsDiv = document.getElementById("weatherResults");
    var msgSpan = document.getElementById("weatherSearchMsg");

    var locationLabel = geo.name;
    if (geo.admin1) locationLabel += ", " + geo.admin1;
    if (geo.country) locationLabel += ", " + geo.country;

    msgSpan.textContent = "Weather data loaded successfully.";
    msgSpan.classList.add("success");

    var temp = weather.temperature_2m;
    var humidity = weather.relative_humidity_2m;
    var precip = weather.precipitation;
    var windSpeed = weather.wind_speed_10m;
    var conditionText = weatherCodeToText(weather.weather_code);

    var html =
      '<div class="weather-location-banner">' +
      "<h3>" + escapeHtml(locationLabel) + "</h3>" +
      "<p>" + escapeHtml(conditionText) + "</p>" +
      "</div>" +
      '<div class="weather-card">' +
      '<div class="weather-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg></div>' +
      '<div class="weather-label">Temperature</div>' +
      '<div class="weather-value">' + formatNumber(temp) + '<span class="weather-unit"> °C</span></div>' +
      "</div>" +
      '<div class="weather-card">' +
      '<div class="weather-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></div>' +
      '<div class="weather-label">Humidity</div>' +
      '<div class="weather-value">' + formatNumber(humidity) + '<span class="weather-unit"> %</span></div>' +
      "</div>" +
      '<div class="weather-card">' +
      '<div class="weather-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 13v8"/><path d="M8 13v8"/><path d="M12 15v8"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg></div>' +
      '<div class="weather-label">Rainfall</div>' +
      '<div class="weather-value">' + formatNumber(precip) + '<span class="weather-unit"> mm</span></div>' +
      "</div>" +
      '<div class="weather-card">' +
      '<div class="weather-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg></div>' +
      '<div class="weather-label">Wind Speed</div>' +
      '<div class="weather-value">' + formatNumber(windSpeed) + '<span class="weather-unit"> km/h</span></div>' +
      "</div>" +
      '<div class="weather-card" style="grid-column: 1 / -1;">' +
      '<div class="weather-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></div>' +
      '<div class="weather-label">Current Conditions</div>' +
      '<div class="weather-value" style="font-size:1.125rem;">' + escapeHtml(conditionText) + "</div>" +
      "</div>";

    resultsDiv.innerHTML = html;
  }

  /* ---------- Fish Recommendation Engine ---------- */

  /**
   * Generate rule-based recommendations for a pond.
   * Fetches current weather for the pond location and compares
   * each species' requirements against the pond conditions.
   * @param {Object} pond - The saved pond object
   * @returns {Promise<Array<Object>>}
   */
  function generateRecommendations(pond) {
    return geocodeLocation(pond.location)
      .then(function (geo) {
        return fetchWeather(geo.latitude, geo.longitude).then(function (weather) {
          var temp = weather.temperature_2m;

          var results = [];
          for (var i = 0; i < FISH_SPECIES.length; i++) {
            results.push(evaluateSpecies(FISH_SPECIES[i], pond, temp));
          }

          // Sort: excellent > suitable > marginal > unsuitable
          var order = { excellent: 0, suitable: 1, marginal: 2, unsuitable: 3 };
          results.sort(function (a, b) {
            return order[a.status] - order[b.status];
          });

          return { results: results, weather: weather, geo: geo };
        });
      })
      .catch(function (error) {
        // If weather fails, still generate recommendations from pond data only
        var results = [];
        for (var i = 0; i < FISH_SPECIES.length; i++) {
          results.push(evaluateSpecies(FISH_SPECIES[i], pond, null));
        }

        var order = { excellent: 0, suitable: 1, marginal: 2, unsuitable: 3 };
        results.sort(function (a, b) {
          return order[a.status] - order[b.status];
        });

        return { results: results, weather: null, geo: null, weatherError: error.message };
      });
  }

  /**
   * Evaluate a single species against the pond conditions.
   * @param {Object} species - Species requirements from FISH_SPECIES
   * @param {Object} pond - Pond data
   * @param {number|null} temperature - Current air temperature from weather API, or null
   * @returns {Object} Recommendation result
   */
  function evaluateSpecies(species, pond, temperature) {
    var reasons = [];
    var warnings = [];
    var missingInfo = [];
    var score = 0;
    var checks = 0;

    // 1. Water type check
    checks++;
    if (species.waterType === "both") {
      reasons.push("Suitable for both freshwater and brackish water ponds.");
      score++;
    } else if (species.waterType === pond.waterType) {
      reasons.push("Water type matches (" + pond.waterType + ").");
      score++;
    } else {
      warnings.push(
        "This species prefers " + species.waterType + " but your pond is " + pond.waterType + "."
      );
    }

    // 2. pH check
    checks++;
    if (pond.ph >= species.phRange[0] && pond.ph <= species.phRange[1]) {
      reasons.push(
        "pH " + formatNumber(pond.ph) + " is within the ideal range (" +
        species.phRange[0] + "–" + species.phRange[1] + ")."
      );
      score++;
    } else {
      warnings.push(
        "pH " + formatNumber(pond.ph) + " is outside the ideal range of " +
        species.phRange[0] + "–" + species.phRange[1] + "."
      );
    }

    // 3. Dissolved oxygen check (optional field)
    if (pond.dissolvedOxygen != null) {
      checks++;
      if (pond.dissolvedOxygen >= species.doRange[0]) {
        reasons.push(
          "Dissolved oxygen " + formatNumber(pond.dissolvedOxygen) + " mg/L meets the minimum (" +
          species.doRange[0] + " mg/L)."
        );
        score++;
      } else {
        warnings.push(
          "Dissolved oxygen " + formatNumber(pond.dissolvedOxygen) + " mg/L is below the minimum of " +
          species.doRange[0] + " mg/L."
        );
      }
    } else {
      missingInfo.push("Dissolved oxygen not provided — suitability assessment is incomplete.");
    }

    // 4. Salinity check (optional field)
    if (pond.salinity != null) {
      checks++;
      if (pond.salinity <= species.salinityMax) {
        reasons.push(
          "Salinity " + formatNumber(pond.salinity) + " ppt is within tolerance (max " +
          species.salinityMax + " ppt)."
        );
        score++;
      } else {
        warnings.push(
          "Salinity " + formatNumber(pond.salinity) + " ppt exceeds the maximum tolerance of " +
          species.salinityMax + " ppt."
        );
      }
    } else {
      // For brackish water, salinity info is more critical
      if (pond.waterType === "brackish" && species.waterType !== "brackish" && species.waterType !== "both") {
        missingInfo.push("Salinity not provided — cannot confirm suitability for brackish conditions.");
      } else {
        missingInfo.push("Salinity not provided — tolerance not assessed.");
      }
    }

    // 5. Temperature check (from weather API)
    if (temperature != null) {
      checks++;
      if (temperature >= species.tempRange[0] && temperature <= species.tempRange[1]) {
        reasons.push(
          "Current temperature " + formatNumber(temperature) + " °C is within the ideal range (" +
          species.tempRange[0] + "–" + species.tempRange[1] + " °C)."
        );
        score++;
      } else if (temperature < species.tempRange[0]) {
        warnings.push(
          "Current temperature " + formatNumber(temperature) + " °C is below the ideal range of " +
          species.tempRange[0] + "–" + species.tempRange[1] + " °C."
        );
      } else {
        warnings.push(
          "Current temperature " + formatNumber(temperature) + " °C is above the ideal range of " +
          species.tempRange[0] + "–" + species.tempRange[1] + " °C."
        );
      }
    } else {
      missingInfo.push("Weather data unavailable — temperature suitability not assessed.");
    }

    // 6. Depth check
    checks++;
    if (pond.pondDepth >= species.depthMin) {
      reasons.push("Pond depth " + formatNumber(pond.pondDepth) + " m meets the minimum (" + species.depthMin + " m).");
      score++;
    } else {
      warnings.push("Pond depth " + formatNumber(pond.pondDepth) + " m is below the recommended minimum of " + species.depthMin + " m.");
    }

    // 7. Area check
    checks++;
    if (pond.pondArea >= species.areaMin) {
      reasons.push("Pond area " + formatNumber(pond.pondArea) + " ha is sufficient (min " + species.areaMin + " ha).");
      score++;
    } else {
      warnings.push("Pond area " + formatNumber(pond.pondArea) + " ha is below the recommended minimum of " + species.areaMin + " ha.");
    }

    // Determine overall status
    var ratio = score / checks;
    var hasWarning = warnings.length > 0;
    var hasMissing = missingInfo.length > 0;
    var status;

    if (ratio >= 0.85 && !hasWarning) {
      status = "excellent";
    } else if (ratio >= 0.6 && (!hasWarning || ratio >= 0.7)) {
      status = "suitable";
    } else if (ratio >= 0.4) {
      status = "marginal";
    } else {
      status = "unsuitable";
    }

    // If critical missing info exists, cap at "suitable" (don't promise excellent)
    if (hasMissing && status === "excellent") {
      status = "suitable";
    }

    return {
      species: species,
      status: status,
      score: score,
      checks: checks,
      reasons: reasons,
      warnings: warnings,
      missingInfo: missingInfo,
      pondConditions: {
        waterType: pond.waterType,
        ph: pond.ph,
        dissolvedOxygen: pond.dissolvedOxygen,
        salinity: pond.salinity,
        pondDepth: pond.pondDepth,
        pondArea: pond.pondArea,
        temperature: temperature,
      },
    };
  }

  /**
   * Render the recommendation results into the DOM.
   * @param {Object} pond
   * @param {Object} recData - { results, weather, geo, weatherError }
   */
  function renderRecommendations(pond, recData) {
    var container = document.getElementById("recommendationResults");
    var results = recData.results;
    var weatherError = recData.weatherError;

    var html = "";

    // Weather info banner (or error)
    if (recData.geo && recData.weather) {
      var temp = recData.weather.temperature_2m;
      var humidity = recData.weather.relative_humidity_2m;
      var precip = recData.weather.precipitation;
      var conditionText = weatherCodeToText(recData.weather.weather_code);

      var locLabel = recData.geo.name;
      if (recData.geo.admin1) locLabel += ", " + recData.geo.admin1;

      html +=
        '<div class="weather-location-banner" style="flex-direction:column;align-items:flex-start;gap:0.25rem;">' +
        "<h3>Weather for " + escapeHtml(locLabel) + "</h3>" +
        "<p>" + escapeHtml(conditionText) + " | Temp: " + formatNumber(temp) + "°C | Humidity: " +
        formatNumber(humidity) + "% | Rain: " + formatNumber(precip) + " mm</p>" +
        "</div>";
    } else if (weatherError) {
      html +=
        '<div class="rec-warning" style="margin-bottom:0;">' +
        "Could not fetch weather data (" + escapeHtml(weatherError) + "). " +
        "Recommendations are based on pond data only — temperature suitability was not assessed." +
        "</div>";
    }

    // Disclaimer
    html +=
      '<div class="rec-disclaimer">' +
      "These are preliminary rule-based recommendations and do not guarantee suitability. " +
      "Always consult a local aquaculture expert before stocking." +
      "</div>";

    // Recommendation cards
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var statusLabel = {
        excellent: "Highly Recommended",
        suitable: "Recommended",
        marginal: "Marginally Suitable",
        unsuitable: "Not Recommended",
      };
      var cardClass = "rec-" + r.status;
      var badgeClass = "status-" + r.status;

      html += '<div class="rec-card ' + cardClass + '">';
      html += '<div class="rec-card-header">';
      html += "<div><h4>" + escapeHtml(r.species.name) + "</h4>";
      html += '<span class="rec-sci-name">' + escapeHtml(r.species.scientificName) + "</span></div>";
      html += '<span class="rec-status-badge ' + badgeClass + '">' + statusLabel[r.status] + "</span>";
      html += "</div>";

      html += '<div class="rec-details">';
      html += "<p>" + escapeHtml(r.species.description) + "</p>";
      html += "</div>";

      // Conditions grid
      html += '<div class="rec-conditions-grid">';
      html += '<div class="rec-condition-chip"><strong>Water Type</strong>' + escapeHtml(r.pondConditions.waterType) + "</div>";
      html += '<div class="rec-condition-chip"><strong>pH</strong>' + formatNumber(r.pondConditions.ph) + "</div>";
      html += '<div class="rec-condition-chip"><strong>DO (mg/L)</strong>' + formatNumber(r.pondConditions.dissolvedOxygen) + "</div>";
      html += '<div class="rec-condition-chip"><strong>Salinity (ppt)</strong>' + formatNumber(r.pondConditions.salinity) + "</div>";
      html += '<div class="rec-condition-chip"><strong>Depth (m)</strong>' + formatNumber(r.pondConditions.pondDepth) + "</div>";
      html += '<div class="rec-condition-chip"><strong>Temp (°C)</strong>' + formatNumber(r.pondConditions.temperature) + "</div>";
      html += "</div>";

      // Reasons
      if (r.reasons.length > 0) {
        html += '<div class="rec-reason"><strong>Why recommended:</strong><ul>';
        for (var j = 0; j < r.reasons.length; j++) {
          html += "<li>" + escapeHtml(r.reasons[j]) + "</li>";
        }
        html += "</ul></div>";
      }

      // Warnings
      if (r.warnings.length > 0) {
        for (var w = 0; w < r.warnings.length; w++) {
          html += '<div class="rec-warning">⚠ ' + escapeHtml(r.warnings[w]) + "</div>";
        }
      }

      // Missing info
      if (r.missingInfo.length > 0) {
        for (var m = 0; m < r.missingInfo.length; m++) {
          html += '<div class="rec-missing-info">ℹ ' + escapeHtml(r.missingInfo[m]) + "</div>";
        }
      }

      html += "</div>";
    }

    container.innerHTML = html;
  }

  /**
   * Handle the "Generate Recommendations" button click.
   */
  function handleGenerateRecommendations() {
    var select = document.getElementById("selectPond");
    var pondId = select.value;
    var container = document.getElementById("recommendationResults");

    if (!pondId) {
      container.innerHTML =
        '<p class="empty-state">Please select a saved pond first.</p>';
      showToast("Please select a pond first.", "error");
      return;
    }

    var pond = findPondById(pondId);
    if (!pond) {
      container.innerHTML =
        '<p class="empty-state">Selected pond not found. It may have been deleted.</p>';
      return;
    }

    container.innerHTML =
      '<div class="loading"><span class="spinner"></span>Fetching weather data and generating recommendations...</div>';

    generateRecommendations(pond)
      .then(function (recData) {
        renderRecommendations(pond, recData);
      })
      .catch(function (error) {
        container.innerHTML =
          '<div class="rec-warning">An error occurred: ' + escapeHtml(error.message) + "</div>";
      });
  }

  /* ---------- Event Listeners Setup ---------- */

  /**
   * Set up all event listeners for the application.
   */
  function initEventListeners() {
    // Navigation
    initNavigation();

    // Pond form submission
    var form = document.getElementById("pondForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();

        if (!validateForm()) {
          showToast("Please fix the errors in the form.", "error");
          return;
        }

        var pond = collectFormData();
        if (!pond) {
          showToast("Could not collect form data.", "error");
          return;
        }

        var ponds = getPonds();
        ponds.push(pond);
        savePonds(ponds);

        renderSavedPonds();
        resetForm();
        showToast("Pond saved successfully!", "success");
      });
    }

    // Update button
    var updateBtn = document.getElementById("updateBtn");
    if (updateBtn) {
      updateBtn.addEventListener("click", function () {
        if (!validateForm()) {
          showToast("Please fix the errors in the form.", "error");
          return;
        }

        var editId = this.getAttribute("data-edit-id");
        if (!editId) return;

        var existing = findPondById(editId);
        if (!existing) {
          showToast("Pond not found.", "error");
          return;
        }

        // Update fields
        existing.pondName = document.getElementById("pondName").value.trim();
        existing.location = document.getElementById("location").value.trim();
        existing.pondArea = parseFloat(document.getElementById("pondArea").value);
        existing.pondDepth = parseFloat(document.getElementById("pondDepth").value);
        existing.waterType = document.getElementById("waterType").value;
        existing.ph = parseFloat(document.getElementById("ph").value);
        var doRaw = document.getElementById("dissolvedOxygen").value.trim();
        var salRaw = document.getElementById("salinity").value.trim();
        existing.dissolvedOxygen = doRaw ? parseFloat(doRaw) : null;
        existing.salinity = salRaw ? parseFloat(salRaw) : null;

        updatePondInList(existing);
        renderSavedPonds();
        resetForm();
        showToast("Pond updated successfully!", "success");
      });
    }

    // Reset button
    var resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        resetForm();
      });
    }

    // Real-time field validation on blur
    var formFields = document.querySelectorAll("#pondForm input, #pondForm select");
    for (var i = 0; i < formFields.length; i++) {
      formFields[i].addEventListener("blur", function () {
        validateField(this);
      });
      // Clear error on input
      formFields[i].addEventListener("input", function () {
        if (this.classList.contains("input-error")) {
          validateField(this);
        }
      });
    }

    // Weather search
    var fetchWeatherBtn = document.getElementById("fetchWeatherBtn");
    if (fetchWeatherBtn) {
      fetchWeatherBtn.addEventListener("click", handleWeatherSearch);
    }

    var weatherInput = document.getElementById("weatherLocation");
    if (weatherInput) {
      weatherInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleWeatherSearch();
        }
      });
    }

    // Generate recommendations
    var generateRecsBtn = document.getElementById("generateRecsBtn");
    if (generateRecsBtn) {
      generateRecsBtn.addEventListener("click", handleGenerateRecommendations);
    }
  }

  /* ---------- App Initialization ---------- */

  /**
   * Initialize the application on page load.
   */
  function init() {
    initEventListeners();
    renderSavedPonds();
    // Show home section by default
    showSection("home");
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
