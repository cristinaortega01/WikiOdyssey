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

async function getWikidataId(searchTerm){
    const itemSearch = encodeURIComponent(searchTerm);
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${itemSearch}&language=en&format=json&origin=*`;
    try{
        const response = await fetch(url);
        const dataToJson = await response.json();

        if (dataToJson.search && dataToJson.search.length > 0){ //from json answer structure
            const datalist = document.getElementById("wikidata-suggestions");
            datalist.innerHTML = ""; //clear previous suggestions

            dataToJson.search.forEach(item => { //for each item returned, we create an option element
                const option = document.createElement("option");
                option.value = item.label // set the visible text for the option
                option.setAttribute("data-id",item.id);
                datalist.append(option);
            });
            return dataToJson.search[0].id;

        }else {
            console.log("No results found for:", searchTerm);
            return null;
        }
    }catch(error){
        console.error("Error fetching from Wikidata:", error);
        return null
    }

}

document.getElementById("item-wikidata").addEventListener("input", function() {
    const searchTerm = this.value.trim();

    // Fetch suggestions only if the search term is longer than 2 characters
    if (searchTerm.length > 2) {
        getWikidataId(searchTerm);
    } else {
        document.getElementById("wikidata-suggestions").innerHTML = ""; // Clear suggestions if the search term is short
    }
});

// Handle the form submission for SPARQL query
class SPARQLQueryDispatcher{
    constructor( endpoint ) {
		this.endpoint = endpoint;
	}

	query( sparqlQuery ) {
		const fullUrl = this.endpoint + '?query=' + encodeURIComponent( sparqlQuery );
		const headers = { 'Accept': 'application/sparql-results+json' };

		return fetch( fullUrl, { headers } ).then( body => body.json() );
	}
}

const endpointUrl = 'https://query.wikidata.org/sparql';

document.getElementById("query-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const searchTerm = document.getElementById("item-wikidata").value.trim();
    const sortOption = document.getElementById("sort-options").value;
    const dataList = document.getElementById("wikidata-suggestions");
    const selectedOption = Array.from(dataList.options).find(option => option.value === searchTerm);

    if (selectedOption) {
        const termId = selectedOption.getAttribute("data-id");

        const sparqlQuery = buildQuery(termId, sortOption);
        //fetch data
        const res = await fetch("/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: sparqlQuery })
        });

        const data = await res.json();
        console.log(data)
        document.getElementById("results").textContent = JSON.stringify(data, null, 2);
        clearMap();
        addRoute(data);
    }else{
        alert("Please select a valid Wikidata item from the suggestions.");
    }
});

function buildQuery(termId, sortOption){
    let sparqlQuery= `SELECT ?item ?itemLabel 
       ?currentLocation ?currentLocationLabel ?currentLocationCoordinates
       ?origin ?originLabel ?originCoordinates
    WHERE {
        ?item wdt:P31 wd:${termId};        
                wdt:P276 ?currentLocation; 
                wdt:P495 ?origin.          
        ?currentLocation wdt:P625 ?currentLocationCoordinates. 
        ?origin wdt:P625 ?originCoordinates. 

        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`
    ;

    sparqlQuery += `LIMIT 5`

    let sortedSparql = sparqlQuery;
    if (sortOption === 'ascending'){
        sortedSparql += "ORDER BY ?label";
    } else if (sortOption === 'descending'){
        sortedSparql += "ORDER BY DESC(?label)";
    }
    // No sorting for the "None" option (empty value)

    return sparqlQuery;
}

function clearMap () {
    map.eachLayer(function (layer) {
        const isBaseMap = layer == openStreetMapLayer;
        const isScaleBar = layer == scale;

        if (!isBaseMap && !isScaleBar) {
            map.removeLayer(layer);
        }
    });

}

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
                currentArrowDecorator.on("click", removeRoute);
            }
        }, 10);

        currentMotionPolyline.motionStart();

        currentDestinationMarker = createDestinationMarker(currentCoords).addTo(route);

        function removeRoute() {
            map.removeLayer(route)
        }
      
        currentDestinationMarker.on("click", removeRoute);
        currentMotionPolyline.on("click",  removeRoute);
    });
}

function addRoute(data) {
    var uniqueData = filterDuplicatesByItem(data);

    uniqueData.forEach(item => {
        animateRoute(item.originCoordinates, item.currentLocationCoordinates);
    });
}

