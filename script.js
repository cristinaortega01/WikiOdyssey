// Initialize the map
var map = L.map('map').setView([0, 0], 1);

var openStreetMapLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

let osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
});

var scale = L.control.scale().addTo(map);

let motionPolylines = [];
let destinationMarkers = [];
let arrowDecorators = [];

// Handle the form submission for SPARQL query
document.getElementById("query-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const sparql = document.getElementById("sparql").value;
    const sortOption = document.getElementById("sort-options").value;

    let sortedSparql = sparql;
    if (sortOption === 'ascending'){
        sortedSparql += "ORDER BY ?label";
    } else if (sortOption === 'descending'){
        sortedSparql += "ORDER BY DESC(?label)";
    }
    // No sorting for the "None" option (empty value)



    const res = await fetch("/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sparql })
    });
    const data = await res.json();

    console.log(data)

    document.getElementById("results").textContent = JSON.stringify(data, null, 2);
    addRoute(data);

});


function extractCoordinates(coordObject) {
    var coordString = coordObject.value;
    var match = coordString.match(/^Point\((-?\d+\.\d+) (-?\d+\.\d+)\)$/);

    if (match) {
        // Extract longitude and latitude
        var lon = parseFloat(match[1]);  // Longitude
        var lat = parseFloat(match[2]);  // Latitude
        return { lat: lat, lon: lon };
    }
    console.log("Origin Coordinates:", originCoords);
    console.log("Current Coordinates:", currentCoords);
}

// Function to filter out duplicate items
function filterDuplicatesByItem(data) {
    let seenItems = new Set();
    let uniqueItems = [];

    data.forEach(function (item) {
        let itemURI = item.item.value; // Extract the URI for the current item

        if (!seenItems.has(itemURI)) {
            seenItems.add(itemURI); // Mark this URI as "seen"
            uniqueItems.push(item); // Add the current item to the list of unique items
        }
    });

    return uniqueItems;
}

function createOriginMarker(coords) {
    return L.marker([coords.lat, coords.lon])
        .bindPopup("Origin")
        .addTo(map);
}

function createDestinationMarker(coords) {
    return L.marker([coords.lat, coords.lon])
        .bindPopup("Destination")
        .addTo(map);
}

function createMotionPolyline (start, end){
    return L.motion.polyline(
        [
            [start.lat, start.lon],
            [end.lat, end.lon]
        ],
        {
            color: 'red',
            weight: 4,
            opacity: 0.8,
            duration: 3000,
            easing: L.Motion.Ease.easeInOut
        }
    ).addTo(map);
}

function animateRoute(originCoordObj, currentCoordObj) {

    var originCoords = extractCoordinates(originCoordObj)
    var currentCoords = extractCoordinates(currentCoordObj)

    if (!originCoords || !currentCoords) return;

    //We only mark origin
    const originMarker = createOriginMarker(originCoords);

    let currentArrowDecorator;

    originMarker.on("click", function () {
        const route = L.layerGroup().addTo(map);
        const currentMotionPolyline = createMotionPolyline(originCoords, currentCoords).addTo(route);

        setTimeout(() => {
            const latlngs = currentMotionPolyline.getLatLngs();
            if (latlngs.length) {
                const staticPolyline = L.polyline(latlngs);
                currentArrowDecorator = L.polylineDecorator(staticPolyline, {
                    patterns: [
                        {
                            offset: '100%',
                            repeat: 0,
                            symbol: L.Symbol.arrowHead({
                                pixelSize: 15,
                                polygon: false,
                                pathOptions: { stroke: true, color: 'red', weight: 2 }
                            })
                        }
                    ]
                }).addTo(route);
            }
        }, 10);

        currentMotionPolyline.motionStart();

        currentDestinationMarker = createDestinationMarker(currentCoords).addTo(route);
      
        currentDestinationMarker.on("click", map.removeLayer(route));
        currentMotionPolyline.on("click",  map.removeLayer(route));
        currentArrowDecorator.on("click", map.removeLayer(route));
    });
}

function addRoute(data) {
    var uniqueData = filterDuplicatesByItem(data);

    uniqueData.forEach(item => {
        animateRoute(item.originCoordinates, item.currentLocationCoordinates);
    });
}

