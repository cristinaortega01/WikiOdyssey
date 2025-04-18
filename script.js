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

let currentMotionPolyline = null;
let currentDestinationMarker = null;
let currentArrowDecorator = null;

// Handle the form submission for SPARQL query
document.getElementById("query-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const sparql = document.getElementById("sparql").value;
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

function animateRoute(originCoordObj, currentCoordObj) {

    var originCoords = extractCoordinates(originCoordObj)
    var currentCoords = extractCoordinates(currentCoordObj)

    if (!originCoords || !currentCoords) return;

    //We only mark origin
    const originMarker = L.marker([originCoords.lat, originCoords.lon])
        .bindPopup("Origin")
        .addTo(map);

    originMarker.on("click", function () {
        removeRouteAndDestination();

        currentMotionPolyline = L.motion.polyline(
            [
                [originCoords.lat, originCoords.lon],
                [currentCoords.lat, currentCoords.lon]
            ],
            {
                color: 'red',               // Color for the animated line
                weight: 4,                  // Line thickness
                opacity: 0.8,
                duration: 3000,             // Duration in milliseconds
                easing: L.Motion.Ease.easeInOut  // Easing function for smooth transition
            }
        ).addTo(map);


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
                }).addTo(map);
            }
        }, 10);

        currentMotionPolyline.motionStart();

        currentDestinationMarker = L.marker([currentCoords.lat, currentCoords.lon])
            .bindPopup("Destination")
            .addTo(map);

        currentDestinationMarker.on("click", removeRouteAndDestination);
        currentMotionPolyline.on("click", removeRouteAndDestination);
    });
}

function addRoute(data) {
    var uniqueData = filterDuplicatesByItem(data);

    uniqueData.forEach(item => {
        animateRoute(item.originCoordinates, item.currentLocationCoordinates);
    });
}

function removeRouteAndDestination() {
    if (currentMotionPolyline) {
        map.removeLayer(currentMotionPolyline);
        currentMotionPolyline = null;
    }
    if (currentDestinationMarker) {
        map.removeLayer(currentDestinationMarker);
        currentDestinationMarker = null;
    }
    if (currentArrowDecorator) {
        map.removeLayer(currentArrowDecorator);
        currentArrowDecorator = null;
    }
}