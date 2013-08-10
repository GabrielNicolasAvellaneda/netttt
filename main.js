"use strict";

var generation;
var best = [];
var scores = [];

// TODO: use seedrandom? <https://github.com/davidbau/seedrandom>

$(function () {
    generation = NetTtt.Generation.newRandom();
    var i;
    for (i = 0; i < 10; ++i) {
        best[i] = {fitness: -Infinity};
    }

    var $current = $('#current');
    var $time = $('#time');
    var $pauseButton = $('#pause');
    var $graph = $('#graph');
    var $leaders = [];
    for (i = 0; i < 10; ++i) {
        $leaders[i] = $('#leader-' + i);
    }
    var $topExport = $('#top-export');

    var paused = false;
    var avgTime = 0;
    var runTimerId = undefined;

    scheduleRun();

    function update() {
        $current.text($current.data(paused ? 'paused' : 'unpaused')
            .replace('{generation}', generation.number.toString())
        );
        if (avgTime > 0) {
            $time.text($time.data('template').replace('{time}', avgTime.toFixed(1)));
        }
        $pauseButton.val($pauseButton.data(paused ? 'paused' : 'unpaused'));
    }

    function scheduleRun() {
        if (typeof runTimerId === 'undefined' && !paused) {
            runTimerId = window.setInterval(run, 100);
        }

        update();
    }

    function cancelRun() {
        if (typeof runTimerId !== 'undefined') {
            window.clearInterval(runTimerId);
            runTimerId = undefined;
        }
    }

    function time(f) {
        var t1 = window.performance.now();
        f();
        var t2 = window.performance.now();
        return t2 - t1;
    }

    function run() {
        cancelRun();

        var ms = time(function () {
            generation.run();
        });
        avgTime = (ms + avgTime * generation.number) / (generation.number + 1);

        score();
        drawGraph();

        generation = generation.next();

        scheduleRun();
    }

    function score() {
        var anyChanged = false;
        var genIndex = 0;
        var i;
        for (i = 0; i < 10; ++i) {
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

        var sumTopTen = 0;
        var sum = 0;
        for (i = 0; i < generation.members.length; ++i) {
            if (i < 10) {
                sumTopTen += generation.members[i].fitness;
            }
            sum += generation.members[i].fitness;
        }

        scores.push({
            top: generation.members[0].fitness,
            topTen: sumTopTen / 10,
            avg: sum / generation.members.length
        });
    }

    function bestChanged() {
        for (var i = 0; i < 10; ++i) {
            $leaders[i].text(
                $leaders[0].data('template')
                .replace('{score}', best[i].fitness.toString())
                .replace('{generation}', best[i].generation.toString())
            );
        }

        $topExport.text(JSON.stringify(best[0].individual.export()));
    }

    function drawGraph() {
        // TODO
    }

    function setPaused(p) {
        if (p !== paused) {
            paused = p;
            cancelRun();
            scheduleRun();
        }
    }

    $pauseButton.click(function (event) {
        setPaused(!paused);
    });

    // TODO: look into why the score is so level.  Maybe keep <= instead of <?
    // TODO: export selector to choose among the top 10.

    // TODO: use parallel.js to do work in the background.
});
