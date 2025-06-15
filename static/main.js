import {
    clearMap,
    clearAllRoutesOnly,
    addRoute,
    createRouteName,
    extractCoordinates,
    connectRouteToResult,
    highlightRouteOnMap,
    initMap,
    filterDuplicatesByItem,
    assignFixedIndices,
} from './map.js'
import {
    getValidSuggestions,
    buildQuery
} from './query.js'

let debounceTimeout;
let processedData = [];

// DOM ELEMENTS
const elements = {
    inputBox: document.getElementById("input-box"),
    autocompleteResults: document.getElementById("autocomplete-results"),
    resultBox: document.querySelector(".result-box"),
    resultsBox: document.querySelector('.results-box'),
    resultsContainer: document.getElementById("results"),
    queryForm: document.getElementById("query-form"),
    clearRoutesBtn: document.getElementById('clear-routes-btn'),
    limitOptions: document.getElementById("limit-options"),
    sortOptions: document.getElementById("sort-options"),
    infoIcon: document.getElementById('info-icon'),
    infoTooltip: document.getElementById('info-tooltip')
};

// SEARCH FUNCTIONALITY 
function handleSearchInput(event) {
    const searchTerm = event.target.value.trim();
    
    // Clear any previous search timeout
    clearTimeout(debounceTimeout);

    // Wait 400ms before searching (prevents too many requests while typing)
    debounceTimeout = setTimeout(() => {
        if (searchTerm.length > 2) {
            getValidSuggestions(searchTerm);
        } else {
            clearAutocompleteResults();
        }
    }, 400);
}

// QUERY EXECUTION 
async function handleFormSubmission(event) {
    event.preventDefault();

    const termId = elements.inputBox.dataset.id;
    const limit = elements.limitOptions.value;
    const sortOption = elements.sortOptions.value;

    // Make sure user selected something from the dropdown
    if (!termId) {
        showAlert("Please select an option from the suggestions.");
        return;
    }

    try {
        // Get data from server
        const rawData = await fetchDataFromServer(termId, sortOption, limit);
        
        // Clean up and process the data
        const cleanData = processRawData(rawData);
        
        showResults(cleanData);
        
    } catch (error) {
        console.error('Query failed:', error);
    }
}

async function fetchDataFromServer(termId, sortOption, limit) {
    const query = buildQuery(termId, sortOption, limit);
    
    const response = await fetch("/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });

    if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
    }

    return response.json();
}

function processRawData(data) {
    // Remove duplicates and add index numbers
    const filtered = filterDuplicatesByItem(data);
    const withIndices = assignFixedIndices(filtered);
    
    // Store for later use
    processedData = withIndices;
    window.dataWithIndices = withIndices; 
    
    return withIndices;
}

function showResults(data) {
    // Clear everything from previous search
    clearMap();
    
    // Show the new results
    displayResultsList(data);
    
    // Add routes to map
    addRoute(data);
    connectRouteToResult(data);
}

// RESULTS DISPLAY 
function displayResultsList(data) {
    // Build HTML for all results
    const html = data
        .map((item, index) => createResultHTML(item, index))
        .join("");
    
    // Show the results
    elements.resultsContainer.innerHTML = html;
    elements.resultsBox.style.display = 'block';
    
    // Make results clickable
    makeResultsClickable(data);
}

function createResultHTML(item, index) {
    const label = item.itemLabel?.value || 'Unknown';
    const origin = item.originLabel?.value || 'Unknown';
    const current = item.currentLocationLabel?.value || 'Unknown';
    const url = item.item?.value || '#';

    return `
        <div class="result-item" data-index="${index}">
            <p><span class="label">Label:</span> ${label}</p>
            <p><span class="label">Origin:</span> ${origin}</p>
            <p><span class="label">Current Location:</span> ${current}</p>
            <p><span class="label">URL:</span> <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>
        </div>
    `;
}

function makeResultsClickable(data) {
    // Remove old click handlers
    document.querySelectorAll(".result-item").forEach(item => {
        item.replaceWith(item.cloneNode(true));
    });

    // Add new click handlers
    document.querySelectorAll(".result-item").forEach(item => {
        item.addEventListener("click", () => handleResultClick(item, data));
    });
}

function handleResultClick(clickedItem, data) {
    const index = parseInt(clickedItem.getAttribute("data-index"));
    const item = data[index];

    if (!item) return;

    // Get coordinates for both locations
    const originCoords = extractCoordinates(item.originCoordinates);
    const currentCoords = extractCoordinates(item.currentLocationCoordinates);
    
    if (!originCoords || !currentCoords) return;

    // Show route on map
    const routeKey = createRouteName(originCoords, currentCoords);
    const originName = item.originLabel?.value || 'Origin';
    const currentName = item.currentLocationLabel?.value || 'Destination';

    highlightRouteOnMap(routeKey, originCoords, currentCoords, index, originName, currentName);
}

function highlightResult(index) {
    // Remove all existing highlights
    clearResultHighlights();

    // Highlight the specific result
    const resultItem = document.querySelector(`.result-item[data-index="${index}"]`);
    if (resultItem) {
        resultItem.classList.add("highlighted");
        resultItem.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

function clearResultHighlights() {
    document.querySelectorAll(".result-item").forEach(item => 
        item.classList.remove("highlighted")
    );
}

function clearAutocompleteResults() {
    elements.autocompleteResults.innerHTML = "";
    elements.resultBox.style.display = "none";
}

function showAlert(message) {
    alert(message);
}

// EVENTS
function setupAllEventListeners() {
    // Search input - trigger search as user types
    elements.inputBox.addEventListener("input", handleSearchInput);

    // Form submission - execute the main query
    elements.queryForm.addEventListener("submit", handleFormSubmission);

    // Clear routes button
    elements.clearRoutesBtn.addEventListener('click', clearAllRoutesOnly);

    // Info tooltip toggle
    elements.infoIcon.addEventListener('click', () => {
        elements.infoTooltip.classList.toggle('hidden');
    });

    // Handle clicks outside elements
    setupOutsideClickHandlers();
}

function setupOutsideClickHandlers() {
    document.addEventListener('click', (event) => {
        // Hide info tooltip when clicking elsewhere
        const clickedInfo = event.target.closest('#info-icon') || event.target.closest('#info-tooltip');
        if (!clickedInfo) {
            elements.infoTooltip.classList.add('hidden');
        }

        // Hide search suggestions when clicking elsewhere
        const clickedSearch = event.target.closest(".search-box");
        if (!clickedSearch) {
            elements.resultBox.style.display = "none";
        }

        // Clear result highlights when clicking in empty areas
        const clickedResult = event.target.closest(".result-item");
        const clickedRoute = event.target.closest("path");
        const clickedPopup = event.target.closest(".leaflet-popup");

        if (!clickedResult && !clickedRoute && !clickedPopup) {
            clearResultHighlights();
        }
    });
}

// APP INITIALIZATION
function initializeApp() {
    initMap();
    setupAllEventListeners();
    window.highlightResult = highlightResult;
}

initializeApp();