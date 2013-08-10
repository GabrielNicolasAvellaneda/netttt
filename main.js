"use strict";

var generation;
var best = [];

$(function () {
    var i;
    for (i = 0; i < 10; ++i) {
        best[i] = {fitness: -Infinity};
    }
    generation = NetTtt.Generation.newRandom();

    var status = $('#status');
    var graph = $('#graph');
    var leaders = [];
    for (i = 0; i < 10; ++i) {
        leaders[i] = $('#leader-' + i);
    }
    var topExport = $('#top-export');
    var runTimerId;

    scheduleRun();

    function scheduleRun() {
        if (typeof runTimerId === 'undefined') {
            runTimerId = window.setInterval(run, 100);
        }
    }

    function cancelRun() {
        if (typeof runTimerId !== 'undefined') {
            window.clearInterval(runTimerId);
            runTimerId = undefined;
        }
    }

    function run() {
        cancelRun();

        status.text(status.data('template').replace('{generation}', generation.number.toString()));

        generation.run();
        score();
        drawGraph();

        generation = generation.next();

        scheduleRun();
    }

    function score() {
        var anyChanged = false;
        var genIndex = 0;
        for (var i = 0; i < 10; ++i) {
            if (best[i].fitness < generation.members[genIndex].fitness) {
                best.splice(i, 0, generation.members[genIndex++]);
                best[i].generation = generation.number;
                anyChanged = true;
            }
        }

        if (anyChanged) {
            best = best.slice(0, 10);
            bestChanged();
        }
    }

    function bestChanged() {
        for (var i = 0; i < 10; ++i) {
            leaders[i].text(
                leaders[0].data('template')
                .replace('{score}', best[i].fitness.toString())
                .replace('{generation}', best[i].generation.toString())
            );
        }

        topExport.text(JSON.stringify(best[0].individual.export()));
    }

    function drawGraph() {
        // TODO
    }

    // TODO: 1-generation timer.
    // TODO: look into why the score is so level.  Maybe keep <= instead of <?
    // TODO: export selector to choose among the top 10.

    // TODO: use parallel.js to do work in the background.
});
