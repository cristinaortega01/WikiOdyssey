# WikiOdyssey

WikiOdyssey is a web application that allows users to visualise the movement of Wikidata items from their origin to their current location on an interactive world map using Leaflet.

FEATURES

🌍 Visualises data from Wikidata.

🧭 No manual querying, just start typing and select from available suggestions.

🎯 Filtering and sorting options for results displayed.

📋 List of results with more information.

🗺️ Interactive map showing item movement routes.

📍 Clickable results and map routes with popup info.


FILE STRUCTURE

app.py - Flask backend to serve the static files and proxy SPARQL queries to Wikidata

site.html – Main HTML layout.

main.js – Handles user interactions, search, and result display.

map.js – Map initialisation, route drawing, and interactivity.

style.css – Contains styles for the layout and components.


VIDEO DEMO

<video src="https://github.com/user-attachments/assets/862bf829-e5d8-4261-94bd-6bf4614ae874" width="352" height="720"></video>
