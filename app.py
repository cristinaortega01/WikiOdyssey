import sys
from SPARQLWrapper import SPARQLWrapper, JSON
from flask import Flask, request, jsonify,  send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

endpoint_url = "https://query.wikidata.org/sparql"

@app.route("/")
def homepage():
     return send_from_directory("static", "site.html")

@app.route("/query", methods=["POST"])
def run_query():
    if request.method == 'POST':
        # Get the data from the JSON body of the request
        data = request.get_json()
        query_sparql = data.get("query")

        if not query_sparql:
            return jsonify({"error": "No query provided"}), 400
        
        try:
            user_agent = "WDQS-example Python/%s.%s" % (sys.version_info[0], sys.version_info[1])
            sparql = SPARQLWrapper(endpoint_url, agent=user_agent)
            sparql.setQuery(query_sparql)
            sparql.setReturnFormat(JSON)
            results = sparql.query().convert()

            # Accumulate all results in a list
            output = []
            for result in results["results"]["bindings"]:
                output.append(result)
            return jsonify(output)
        
        except Exception as e:
            return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run("localhost", 5000, debug=True)

