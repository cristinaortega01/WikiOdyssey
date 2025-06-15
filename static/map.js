let map;
let drawnRoutes = new Map();//Sotre all drawn routes
let routesWithResults = new Map();
let originMarkers = new Map();
let globalDataWithIndices = [];

// MAP INITIALIZATION
export function initMap() {
    map = L.map('map').setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    L.control.scale().addTo(map);
}

// COORDINATES 
export function extractCoordinates(coordinateObject) {
    //Converts coordinates from text format to numbers we can use
    const coordinateText = coordinateObject.value;
    const numbers = coordinateText.match(/^Point\((-?\d+\.\d+) (-?\d+\.\d+)\)$/);
    if (!numbers) return null;

    const lon = parseFloat(numbers[1]);
    const lat = parseFloat(numbers[2]);

    return { lat, lon };
}

export function createRouteName(startPoint, endPoint) {
    //unique name for each route with its coordinates
    return `${startPoint.lat},${startPoint.lon}→${endPoint.lat},${endPoint.lon}`;
}

// DATA PROCESSING
export function filterDuplicatesByItem(data) {
    const seen = new Set();

    return data.filter(item => {
        const itemURI = item.item?.value?.trim() || '';
        const originLabel = item.originLabel?.value?.trim().toLowerCase() || '';
        const destLabel = item.currentLocationLabel?.value?.trim().toLowerCase() || '';

        const key = `${itemURI}|${originLabel}|${destLabel}`;

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function assignFixedIndices(data) {
    return data.map((item, index) => {
        item.fixedIndex = index;
        return item;
    });
}

function groupByOrigin(data) {
    const groups = {};

    for (const item of data) {
        const origin = extractCoordinates(item.originCoordinates);
        const destination = extractCoordinates(item.currentLocationCoordinates);

        //If coordinates can't be converted, skip item
        if (!origin || !destination) continue;

        //To group by origin
        const originKey = `${origin.lat},${origin.lon}`;

        //Create the gorup if does not exist
        if (!groups[originKey]) {
            groups[originKey] = {
                originCoords: origin,
                originLabel: item.originLabel?.value || "Origin",
                destinations: []
            };
        }

        //Add destination to the group
        groups[originKey].destinations.push({
            coords: destination,
            label: item.currentLocationLabel?.value || "Destination",
            resultIndex: item.fixedIndex
        });
    }
    return Object.values(groups);
}

// ROUTE-RESULT
export function connectRouteToResult(data) {
    // Clear existing connections
    routesWithResults.clear();

    // Group results by route key
    data.forEach((item, index) => {
        const originCoords = extractCoordinates(item.originCoordinates);
        const currentCoords = extractCoordinates(item.currentLocationCoordinates);

        if (!originCoords || !currentCoords) return;

        const routeKey = createRouteName(originCoords, currentCoords);

        if (!routesWithResults.has(routeKey)) {
            routesWithResults.set(routeKey, new Set());
        }

        // Add this result index to the route
        routesWithResults.get(routeKey).add(index);
    });
}

export function addResultToRouteMapping(originCoords, currentCoords, resultIndex) {
    if (!originCoords || !currentCoords || resultIndex === undefined) return;

    const routeKey = createRouteName(originCoords, currentCoords);

    if (!routesWithResults.has(routeKey)) {
        routesWithResults.set(routeKey, new Set());
    }

    routesWithResults.get(routeKey).add(resultIndex);
}

// VISUAL ELEMENTS
function createMarker(coords, text) {
    return L.marker([coords.lat, coords.lon]).bindPopup(text);
}

function createLineWithArrow(drawnGroup, startPoint, endPoint, color = 'red') {
    const points = [
        [startPoint.lat, startPoint.lon],
        [endPoint.lat, endPoint.lon]
    ];

    const line = L.polyline(points, { color }).addTo(drawnGroup);

    //Add arrow at the end of the line
    const arrow = L.polylineDecorator(line, {
        patterns: [{
            offset: '100%',
            repeat: 0,
            symbol: L.Symbol.arrowHead({
                pixelSize: 15,
                polygon: false,
                pathOptions: { stroke: true, color: color, weight: 2 }
            })
        }]
    }).addTo(drawnGroup);

    return { line: line, arrow: arrow };
}

function changeLineColor(line, arrow, newColor, thickness = 3) {
    //Change style
    line.setStyle({ color: newColor, weight: thickness });

    if (arrow && arrow.options && arrow.options.patterns) {
        const patterns = arrow.options.patterns;
        patterns.forEach(pattern => {
            const symbol = pattern.symbol;
            if (symbol && symbol.options && symbol.options.pathOptions) {
                symbol.options.pathOptions.color = newColor;
            }
        });
        arrow.redraw(); //Redraw to show changes
    }
}

function generateRoutePopupContent(routeName, startLabel, endLabel, resultIndexes) {
    const maxToShow = 10;
    const shownIndexes = resultIndexes.slice(0, maxToShow);
    const resultCount = resultIndexes.length;

    const resultsHTML = shownIndexes.map(i => {
        const item = globalDataWithIndices[i];
        const itemLabel = item && item.itemLabel ? item.itemLabel.value : `Result ${i}`;

        return `
            <li>
                <a href="#" class="scroll-to-result" data-index="${i}">
                    ${itemLabel}
                </a>
            </li>
        `;
    }).join("");

    const moreNote = resultCount > maxToShow
        ? `<li style="list-style: none; color: #777;">…and ${resultCount - maxToShow} more</li>`
        : '';

    const removeButtonId = 'delete-route-btn';
    const container = document.createElement('div');
    container.innerHTML = `
        <div style="margin: 5px;">
            <p><strong>Route:</strong> ${startLabel} → ${endLabel}</p>
            <p><small>${resultCount} result(s) use this route</small></p>
            <ul style="max-height: 150px; overflow-y: auto; padding-left: 20px; margin-top: 5px;">
                ${resultsHTML}
                ${moreNote}
            </ul>
            <button id="${removeButtonId}" style="
                margin-top: 10px; 
                padding: 5px 10px; 
                background-color: #ff5c5c; 
                color: white; 
                border: none; 
                border-radius: 3px; 
                cursor: pointer;
            ">
                Delete Route
            </button>
        </div>
    `;

    // Add event listeners
    setTimeout(() => {
        const deleteButton = document.getElementById(removeButtonId);
        if (deleteButton) {
            deleteButton.onclick = function () {
                removeRouteFromMap(routeName);
                map.closePopup();
            };
        }

        container.querySelectorAll('.scroll-to-result').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const index = e.currentTarget.dataset.index;
                scrollToResult(index);
            });
        });
    }, 10);

    return container;
}

function scrollToResult(index) {
    const target = document.querySelector(`.result-item[data-index="${index}"]`);
    if (target) {
        target.style.pointerEvents = 'none';
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            target.style.pointerEvents = '';
        }, 500);
    }
}

function createRoutePopup(routeName, startLabel, endLabel) {
    return function (clickEvent) {
        highlightResultsForRoute(routeName);

        const resultIndexes = routesWithResults.has(routeName)
            ? Array.from(routesWithResults.get(routeName))
            : [];

        const popupContent = generateRoutePopupContent(routeName, startLabel, endLabel, resultIndexes);

        L.popup()
            .setLatLng(clickEvent.latlng)
            .setContent(popupContent)
            .openOn(map);
    };
}


// HIGHLIGHT
//To highlight result boxes associated to a route
function highlightResultsForRoute(routeName) {
    document.querySelectorAll(".result-item").forEach(element => element.classList.remove("highlighted"));

    if (!routesWithResults.has(routeName)) return;

    const resultIndices = routesWithResults.get(routeName);
    resultIndices.forEach(index => {
        const resultBox = document.querySelector(`.result-item[data-index="${index}"]`);
        if (resultBox) {
            resultBox.classList.add("highlighted");
        }
    });

    // Scroll to first result
    const firstIndex = Array.from(resultIndices)[0];
    scrollToResult(firstIndex);
}

function highlightExistingRoute(routeName) {
    const routeGroup = drawnRoutes.get(routeName);
    if (routeGroup && routeGroup.staticLine) {
        //Make the line thicker temporarily
        changeLineColor(routeGroup.staticLine, routeGroup.arrow, 'yellow', 4);
        map.fitBounds(routeGroup.staticLine.getBounds());

        //Return to normal 
        setTimeout(() => {
            changeLineColor(routeGroup.staticLine, routeGroup.arrow, 'red', 3);
        }, 2000);

        //Highlight associated results and zoom to route
        highlightResultsForRoute(routeName);
    }
}

//Highligh a route when someone clicks the result box associated
export function highlightRouteOnMap(routeKey, originCoords, currentCoords, index, originLabel = "Origin", destLabel = "Destination") {
    //Highlight the result in the list 
    if (window.highlightResult) {
        window.highlightResult(index);
    }

    if (drawnRoutes.has(routeKey)) {
        highlightExistingRoute(routeKey);
    } else {
        //Create a new route with highlighting
        drawCompleteRoute(originCoords, currentCoords, originLabel, destLabel, index, true);
    }
}

// ROUTES
function drawCompleteRoute(startCoords, endCoords, startLabel = "Origin", endLabel = "Destination", resultIndex = null, shouldHighlight = false) {
    const routeName = createRouteName(startCoords, endCoords);

    //If the route already exists, remove it completely first
    if (drawnRoutes.has(routeName)) {
        removeRouteFromMap(routeName);
    }

    //Create a new group for this route 
    const routeGroup = L.layerGroup();

    //Create destination marker only 
    const destMarker = createMarker(endCoords, endLabel);
    routeGroup.addLayer(destMarker);

    //Add the line with arrow
    const { line: staticLine, arrow } = createLineWithArrow(routeGroup, startCoords, endCoords, 'red');

    //Add popup handler
    const popupHandler = createRoutePopup(routeName, startLabel, endLabel);
    staticLine.on('click', popupHandler);

    //Add the complete group to the map
    routeGroup.addTo(map);

    //Store references
    routeGroup.staticLine = staticLine;
    routeGroup.arrow = arrow;
    drawnRoutes.set(routeName, routeGroup);

    //Handle highlighting
    if (shouldHighlight) {
        changeLineColor(staticLine, arrow, 'yellow', 4);
        map.fitBounds(staticLine.getBounds());

        setTimeout(() => {
            changeLineColor(staticLine, arrow, 'red', 3);
        }, 500);
    }
}

function removeRouteFromMap(routeName) {
    const routeGroup = drawnRoutes.get(routeName);
    if (routeGroup) {
        // Make sure to remove all layers in the group
        routeGroup.eachLayer(layer => {
            map.removeLayer(layer);
        });
        map.removeLayer(routeGroup);

        // Clean up our tracking maps
        drawnRoutes.delete(routeName);

    } else {
        console.log(`Route ${routeName} not found in drawnRoutes`);
    }
}

function handleOriginMarkerClick(originCoords, originLabel, destinations) {
    return function () {
        destinations.forEach((destination, i) => {
            const routeName = createRouteName(originCoords, destination.coords);
            drawCompleteRoute(
                originCoords,
                destination.coords,
                originLabel,
                destination.label,
                destination.resultIndex
            );
        });
    };
}

function updateOriginMarkerDestinations(originKey, originCoords, originLabel, existingData, newDestinations) {
    const mergedDestinations = [...existingData.destinations];
    newDestinations.forEach(newDest => {
        const exists = mergedDestinations.some(dest =>
            dest.coords.lat === newDest.coords.lat && dest.coords.lon === newDest.coords.lon
        );
        if (!exists) {
            mergedDestinations.push(newDest);
        }
    });

    //Update destination
    existingData.destinations = mergedDestinations;

    //Remove and reassign click event with updated destinations
    existingData.marker.off('click');
    existingData.marker.on('click', handleOriginMarkerClick(originCoords, originLabel, mergedDestinations));

    console.log(`Updated existing origin marker at ${originKey} with ${mergedDestinations.length} destinations`);
    return existingData.marker;
}

//For origin with multiple results
function createOriginMarkerWithRoutes(originCoords, destinationList, originLabel = "Origin") {
    if (!originCoords || !destinationList.length) return null;

    const originKey = `${originCoords.lat},${originCoords.lon}`;

    if (originMarkers.has(originKey)) {
        const existingData = originMarkers.get(originKey);
        return updateOriginMarkerDestinations(originKey, originCoords, originLabel, existingData, destinationList);
    }

    const originMarker = createMarker(originCoords, originLabel).addTo(map);

    // Assign click event
    originMarker.on('click', handleOriginMarkerClick(originCoords, originLabel, destinationList));

    // Store in markers map
    originMarkers.set(originKey, {
        marker: originMarker,
        destinations: [...destinationList]  // copia para evitar referencias externas
    });

    return originMarker;
}

// CLEANUP
export function clearAllRoutesOnly() {
    for (const [routeName, routeGroup] of drawnRoutes.entries()) {
        map.removeLayer(routeGroup);
    }
    drawnRoutes.clear();
}

export function clearAllOriginMarkers() {
    for (const [originKey, originData] of originMarkers.entries()) {
        map.removeLayer(originData.marker);
    }
    originMarkers.clear();
}

export function clearMap() {
    map.eachLayer(function (layer) {
        if (!(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });

    L.control.scale().addTo(map);
    drawnRoutes.clear();
    routesWithResults.clear();
    originMarkers.clear();
    globalDataWithIndices = [];
    console.log('Map cleared');
}

// MAIN FUNCTIONS
export function addRoute(data) {
    if (!Array.isArray(data) || data.length === 0) {
        console.warn('addRoutes: No valid data provided');
        return;
    }

    clearAllOriginMarkers();

    //process data
    const uniqueData = filterDuplicatesByItem(data);
    const dataWithIndices = assignFixedIndices(uniqueData)
    const groupedData = groupByOrigin(dataWithIndices);

    // Store processed data globally for popup access
    globalDataWithIndices = dataWithIndices;

    connectRouteToResult(dataWithIndices);

    groupedData.forEach(group => {
        createOriginMarkerWithRoutes(
            group.originCoords,
            group.destinations,
            group.originLabel
        );
    });
}