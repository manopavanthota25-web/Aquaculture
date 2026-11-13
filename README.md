# AquaSmart – Location-Based Smart Aquaculture Recommendation System

AquaSmart is a student-level web application that helps fish farmers make preliminary aquaculture decisions using pond details, location-based weather information, manually entered water-quality parameters, and a rule-based fish recommendation engine.

## Technology Stack

- **HTML5** – Page structure
- **CSS3** – Styling and responsive layout
- **Vanilla JavaScript** – Application logic, API calls, and LocalStorage
- **Open-Meteo Geocoding API** – Converts location names to coordinates
- **Open-Meteo Weather API** – Fetches real-time weather data
- **Browser LocalStorage** – Saves and retrieves pond information

No frameworks, no backend servers, no databases, and no external libraries are used.

## Project Structure

```
AquaSmart/
├── index.html       – Main HTML file with all five sections
├── style.css        – All application styles (responsive, professional design)
├── script.js        – All application logic (forms, APIs, recommendations, storage)
├── README.md        – This file
└── assets/          – Image assets (logo, pond photo, fish photo)
```

## How to Run

### Option 1: VS Code Live Server (recommended)

1. Open the project folder in VS Code.
2. Right-click `index.html` and select **"Open with Live Server"**.
3. The application opens in your browser at `http://127.0.0.1:5500`.

### Option 2: Direct file open

1. Double-click `index.html` to open it in any modern browser.
2. The app works fully offline except for the weather API calls (which require internet).

### Option 3: npm + Vite (development server)

```bash
npm install
npm run dev
```

Then open the URL shown in the terminal (typically `http://localhost:5173`).

## Features

### 1. Home
- AquaSmart branding with navigation bar
- Introduction to the application
- Feature overview cards
- Quick navigation buttons

### 2. Pond Registration
- Form to collect: pond name, village/district, area, depth, water type, pH, dissolved oxygen (optional), and salinity (optional)
- Full input validation with inline error messages
- Save pond details to browser LocalStorage
- View, edit, and delete saved ponds

### 3. Weather Dashboard
- Enter any location name to fetch real-time weather
- Uses Open-Meteo Geocoding API to convert the location to coordinates
- Uses Open-Meteo Weather API to retrieve temperature, humidity, rainfall, wind speed, and weather conditions
- Displays data in clean dashboard cards
- Error handling for unknown locations or API failures

### 4. Fish Recommendations
- Rule-based engine evaluates five candidate species: Rohu, Catla, Mrigal, Tilapia, and Common Carp
- Compares pond conditions (pH, dissolved oxygen, salinity, depth, area, water type) against verified species requirements
- Incorporates current weather temperature into the assessment
- Each recommendation shows:
  - Suitability status (Highly Recommended / Recommended / Marginally Suitable / Not Recommended)
  - Reasons for the recommendation
  - Relevant pond conditions
  - Warnings for unsuitable conditions
  - Missing information notes when optional data is not provided
- Explicit disclaimer that recommendations are preliminary and not guaranteed

### 5. Pond Management
- General best-practice suggestions for:
  - Water-quality monitoring
  - Pond maintenance
  - Weather monitoring
  - Feeding practices
  - Consulting local aquaculture experts

## Fish Species Reference Data

| Species      | Scientific Name       | Water Type         | pH Range  | DO Min (mg/L) | Salinity Max (ppt) | Temp Range (°C) |
|-------------|----------------------|--------------------|-----------|---------------|--------------------|-----------------|
| Rohu        | Labeo rohita         | Freshwater         | 6.5–8.5   | 4             | 2                  | 22–33           |
| Catla       | Catla catla          | Freshwater         | 6.5–8.5   | 4             | 2                  | 25–33           |
| Mrigal      | Cirrhinus mrigala    | Freshwater         | 6.5–8.5   | 4             | 2                  | 22–33           |
| Tilapia     | Oreochromis niloticus| Fresh & Brackish   | 5.5–9.0   | 3             | 35                 | 20–35           |
| Common Carp | Cyprinus carpio      | Fresh & Brackish   | 6.0–9.0   | 3             | 7                  | 18–30           |

## How to Export / Download the Project as ZIP

1. If using VS Code: Right-click the project folder in the Explorer panel and select **"Compress to ZIP"** (requires an extension like "Zip & Unzip").
2. Alternatively, use your file explorer:
   - **Windows**: Right-click the folder → "Send to" → "Compressed (zipped) folder"
   - **macOS**: Right-click the folder → "Compress"
   - **Linux**: Run `zip -r AquaSmart.zip AquaSmart/` in a terminal
3. If using the Bolt web interface: Use the **Download** button in the project menu to export all files as a ZIP archive.

## File Descriptions

| File         | Purpose                                                                 |
|--------------|-------------------------------------------------------------------------|
| `index.html` | Contains the full HTML structure: navigation, all five sections, forms. |
| `style.css`  | All visual styling: colours, layout, responsive breakpoints, cards.    |
| `script.js`  | All logic: form validation, LocalStorage, weather API, recommendation. |
| `README.md`  | Documentation and instructions.                                        |
| `assets/`    | Folder for image assets.                                                |

## Browser Compatibility

Works in all modern browsers: Chrome, Firefox, Edge, Safari, and Opera. Requires JavaScript enabled and an internet connection for weather data.

## Disclaimer

AquaSmart provides **preliminary rule-based recommendations only**. It does not use AI, machine learning, or IoT sensors. Always consult local aquaculture experts and fisheries departments before making stocking decisions.

## License

This is a B.Tech academic project. Free to use for educational purposes.
