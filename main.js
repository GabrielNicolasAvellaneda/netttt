"use strict";

var generation;
var best;
var scores = [];
var workerCount = 4;
var workers = [];

// TODO: use seedrandom? <https://github.com/davidbau/seedrandom>

$(function () {
    generation = NetTtt.Generation.newRandom();
    best = [0,1,2,3,4,5,6,7,8,9].map(function () {
        return {score: -Infinity};
    });
    for (var i = 0; i < workerCount; ++i) {
        workers[i] = new Worker('main.worker.js');

        workers[i].onmessage = function (event) {
            process(event.data);
        };
    }

    var $current = $('#current');
    var $time = $('#time');
    var $pauseButton = $('#pause');
    var $graph = $('#graph');
    var $leaders = best.map(function (b, i) {
        return $('#leader-' + i);
    });
    var $topExport = $('#top-export');

    var graphCtx = $graph[0].getContext('2d');
    var paused = false;
    var receivedCount = 0;
    var beginTime = 0;
    var endTime = 0;
    var avgTime = 0;
    var lowestScore = Infinity;
    var highestScore = -Infinity;

    run();

    function update() {
        $current.text($current.data(paused ? 'paused' : 'unpaused')
            .replace('{generation}', generation.id.toString())
        );
        if (avgTime > 0) {
            $time.text($time.data('template').replace('{time}', avgTime.toFixed(1)));
        }
        $pauseButton.val($pauseButton.data(paused ? 'paused' : 'unpaused'));
    }

    function run() {
        update();

        if (paused) {
            return;
        }

        receivedCount = 0;
        beginTime = window.performance.now();

        workers.forEach(function (w, i) {
            w.postMessage(exportGeneration(i));
        });
    }

    function exportGeneration(chunk) {
        var size = generation.members.length / workers.length;
        return {
            generation: generation.id,
            individuals: generation.members.slice(
                Math.round(chunk * size), Math.round((chunk + 1) * size)
            ).map(function (m) { return m.individual.export(); })
        };
    }

    function process(data) {
        if (data.generation !== generation.id) {
            throw new Error("Worker shenanigans");
        }

        data.scores.forEach(function (s) {
            generation.members[s.id].score = s.score;
        });

        if (++receivedCount === workers.length) {
            finishRun();
        }
    }

    function finishRun() {
        generation.members.forEach(function (m) {
            if (m.score === -Infinity) {
                throw new Error("Received incomplete result");
            }
        });

        generation.order();

        endTime = window.performance.now();
        var duration = endTime - beginTime;
        avgTime = (duration + avgTime * generation.id) / (generation.id + 1);

        score();
        drawGraph(graphCtx, $graph.width(), $graph.height());

        generation = generation.next();

        run();
    }

    function score() {
        var genIndex = 0;
        var count = best.length;
        for (var i = 0; i < count; ++i) {
            if (best[i].score < generation.members[genIndex].score) {
                best.splice(i, 0, generation.members[genIndex++]);
                best[i].generation = generation.id;
            }
        }
        if (best.length != count) {
            best = best.slice(0, count);
            bestChanged();
        }

        var sumTopTen = 0;
        var sum = 0;
        generation.members.forEach(function (m, i) {
            if (i < 10) {
                sumTopTen += m.score;
            }
            sum += m.score;
        });

        var score = {
            top: generation.members[0].score,
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
        $leaders.forEach(function (l, i) {
            l.text($leaders[0].data('template')
                .replace('{score}', best[i].score.toString())
                .replace('{generation}', best[i].generation.toString())
            );
        });

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
            scores.forEach(function (score) {
                x += xStep;
                ctx.lineTo(x, height - (score[which.p] - lowestScore) * yScale);
            });
            ctx.stroke();
        });

        // TODO: legend

        ctx.restore();
    }

    function setPaused(p) {
        if (p !== paused) {
            paused = p;
            run();
        }
    }

    $pauseButton.click(function (event) {
        setPaused(!paused);
    });

    // TODO: look into why the score is so level.  Maybe keep <= instead of <?
    // Also maybe randomize with smaller values (10/100, not 100/1000)?
    // TODO: export selector to choose among the top 10.
});
