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

    var graphCtx = $graph[0].getContext('2d');
    var paused = false;
    var avgTime = 0;
    var lowestScore = Infinity;
    var highestScore = -Infinity;
    var runTimerId = undefined;

    scheduleRun();

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

    function update() {
        $current.text($current.data(paused ? 'paused' : 'unpaused')
            .replace('{generation}', generation.number.toString())
        );
        if (avgTime > 0) {
            $time.text($time.data('template').replace('{time}', avgTime.toFixed(1)));
        }
        $pauseButton.val($pauseButton.data(paused ? 'paused' : 'unpaused'));
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
        drawGraph(graphCtx, $graph.width(), $graph.height());

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

        var score = {
            top: generation.members[0].fitness,
            topTen: sumTopTen / 10,
            avg: sum / generation.members.length
        };
        ['top', 'topTen', 'avg'].forEach(function (s) {
            if (score[s] < lowestScore) {
                lowestScore = score[s];
            }
            if (score[s] > highestScore) {
                highestScore = score[s];
            }
        });
        scores.push(score);
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

    function drawGraph(ctx, width, height) {
        var yScale = height / (highestScore - lowestScore);
        var xStep = width / scores.length;

        ctx.save();

        ctx.clearRect(0, 0, width, height);
        [{s: '#44f', p: 'avg'}, {s: '#4f4', p: 'topTen'}, {s: '#f44', p: 'top'}].forEach(function (which) {
            ctx.strokeStyle = which.s;
            ctx.beginPath();
            ctx.moveTo(0, height);
            var x = 0;
            for (var i = 0; i < scores.length; ++i) {
                x += xStep;
                ctx.lineTo(x, height - (scores[i][which.p] - lowestScore) * yScale);
            }
            ctx.stroke();
        });

        // TODO: legend

        ctx.restore();
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
