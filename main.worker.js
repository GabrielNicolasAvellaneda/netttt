(function (global) {
    "use strict";

    importScripts('src/ttt.js', 'src/neural.js', 'src/ai.js', 'src/netttt.js');

    global.onmessage = function (event) {
        var result = process(event.data);
        postMessage(result);
    };

    function process(data) {
        var generation = importGeneration(data);
        generation.run(data.params.matchesPerTourney);
        return exportResult(generation);
    }

    function importGeneration(data) {
        var id = data.generation;
        var exports = data.individuals;

        return new NetTtt.Generation(id, exports.map(function (e) {
            return NetTtt.Individual.import(e);
        }));
    }

    function exportResult(generation) {
        return {
            generation: generation.id,
            scores: generation.individuals.map(function (i) {
                return {
                    id: i.id,
                    age: i.age,
                    score: i.score
                };
            })
        };
    }
}(this));
