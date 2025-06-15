const spinner = document.getElementById('spinner');

export async function getValidSuggestions(searchTerm) {
    const endpointUrl = 'https://query.wikidata.org/sparql';
    const query = `
    SELECT DISTINCT ?class ?classLabel WHERE {
        ?item wdt:P31 ?class;
            wdt:P276 ?location;
            ?originProp ?origin.
        FILTER(?originProp IN (wdt:P495, wdt:P1071, wdt:P189))
        
      ?class rdfs:label ?classLabel.
      FILTER(CONTAINS(LCASE(?classLabel), "${searchTerm.toLowerCase()}")).
      FILTER(LANG(?classLabel) = "en")
    }
    LIMIT 10
    `;

    // show spinner, clear out old list
    spinner.classList.remove('hidden');
    document.getElementById("autocomplete-results").innerHTML = "";

    try {
        const url = endpointUrl + '?query=' + encodeURIComponent(query);
        const response = await fetch(url, {
            headers: { 'Accept': 'application/sparql-results+json' }
        });
        const json = await response.json();

        const autocomplete = document.getElementById("autocomplete-results");
        autocomplete.innerHTML = ""; // clear previous suggestions

        json.results.bindings.forEach(({ classLabel, class: classIRI }) => {
            const li = document.createElement("li");
            li.textContent = classLabel.value;
            li.dataset.id = classIRI.value.split("/").pop();

            li.addEventListener("click", () => {
                const input = document.getElementById("input-box");
                input.value = li.textContent;
                input.dataset.id = li.dataset.id;
                document.querySelector(".result-box").style.display = "none";
            });

            autocomplete.appendChild(li);
        });
        
        document.querySelector(".result-box").style.display =
            json.results.bindings.length ? "block" : "none";
    } catch (error) {
        console.error("SPARQL autocomplete error:", error);
    } finally {
        // always hide spinner when done (whether success or error)
        spinner.classList.add('hidden');
    }
}

export function buildQuery(termId, sortOption, limit) {
    let sparqlQuery = `SELECT ?item ?itemLabel 
       ?currentLocation ?currentLocationLabel ?currentLocationCoordinates
       ?origin ?originLabel ?originCoordinates
    WHERE {
        ?item wdt:P31 wd:${termId};        
                wdt:P276 ?currentLocation; 
                ?originProp ?origin.
        FILTER(?originProp IN (wdt:P495, wdt:P1071, wdt:P189))

        ?currentLocation wdt:P625 ?currentLocationCoordinates. 
        ?origin wdt:P625 ?originCoordinates. 

        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`
        ;

    if (sortOption === 'ascending') {
        sparqlQuery += "ORDER BY ?itemLabel";
    } else if (sortOption === 'descending') {
        sparqlQuery += "ORDER BY DESC(?itemLabel)";
    }
    // No sorting for the "None" option (empty value)

    if (limit !== "") {
    sparqlQuery += ` LIMIT ${limit}`;
}

    return sparqlQuery;
}