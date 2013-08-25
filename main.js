"use strict";

var generation;
var best;
var scores = [];
var paused = false;
var workerCount = 4;
var matchesPerTourney = 600;
var mutationRate = 0.01;
var clonesPerGeneration = 5;
var workers = [];

// TODO: use seedrandom? <https://github.com/davidbau/seedrandom>

$(function () {
    generation = NetTtt.Generation.newRandom();
    best = [0,1,2,3,4,5,6,7,8,9].map(function () {
        return {score: -Infinity};
    });

    var $current = $('#current');
    var $time = $('#time');
    var $pauseButton = $('#pause');
    var $workers = $('#workers');
    var $matches = $('#matches');
    var $mutation = $('#mutation');
    var $clones = $('#clones');
    var $graph = $('#graph');
    var $leaders = best.map(function (b, i) {
        return $('#leader-' + i.toString());
    });
    var $exportSizes = $('#export-sizes');
    var $topExport = $('#top-export');

    var graphCtx = $graph[0].getContext('2d');
    var receivedCount = 0;
    var beginTime = 0;
    var endTime = 0;
    var demos = [
        {
            ctx: $('#x-random-demo-board')[0].getContext('2d'),
            player: Ttt.X,
            opponent: new Ai.Random(),
            game: null
        },
        {
            ctx: $('#x-smart-demo-board')[0].getContext('2d'),
            player: Ttt.X,
            opponent: new Ai.Smart(),
            game: null
        },
        {
            ctx: $('#o-random-demo-board')[0].getContext('2d'),
            player: Ttt.O,
            opponent: new Ai.Random(),
            game: null
        },
        {
            ctx: $('#o-smart-demo-board')[0].getContext('2d'),
            player: Ttt.O,
            opponent: new Ai.Smart(),
            game: null
        }
    ];
    var demoTimerId = undefined;

    firstRun();

    function firstRun() {
        $workers.val(workerCount);
        $matches.val(matchesPerTourney);
        $mutation.val(mutationRate);
        $clones.val(clonesPerGeneration);

        run();
    }

    function run() {
        update();

        if (paused) {
            return;
        }

        adjustWorkers();

        receivedCount = 0;
        beginTime = window.performance.now();

        workers.forEach(function (w, i) {
            w.postMessage(exportGeneration(i));
        });
    }

    function adjustWorkers() {
        if (workers.length > workerCount) {
            var excess = workers.length - workerCount;
            workers.splice(-excess, excess);
        }
        else if (workers.length < workerCount) {
            for (var i = workers.length; i < workerCount; ++i) {
                workers[i] = new Worker('main.worker.js');

                workers[i].onmessage = function (event) {
                    process(event.data);
                };
            }
        }
    }

    function update() {
        $current.text($current.data(paused ? (receivedCount < workers.length ? 'pausing' : 'paused') : 'unpaused')
            .replace('{generation}', generation.id.toString())
        );
        if (endTime > beginTime) {
            $time.text($time.data('template').replace('{time}', Math.round(endTime - beginTime)));
        }
        $pauseButton.val($pauseButton.data(paused ? 'paused' : 'unpaused'));
        if (paused && receivedCount < workers.length) {
            $pauseButton.attr('disabled', true);
        }
        else {
            $pauseButton.removeAttr('disabled');
        }

        if (typeof best[0].individual === 'undefined') {
            drawDemos();
        }
    }

    function exportGeneration(chunk) {
        var size = generation.members.length / workers.length;
        return {
            generation: generation.id,
            individuals: generation.members.slice(
                Math.round(chunk * size), Math.round((chunk + 1) * size)
            ).map(function (m) { return m.individual.export(); }),
            params: {
                matchesPerTourney: matchesPerTourney
            }
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

        score();
        drawGraph(graphCtx, $graph.width(), $graph.height());

        generation = generation.next(mutationRate, clonesPerGeneration);

        run();
    }

    function setPaused(p) {
        if (p !== paused) {
            paused = p;
            run();
        }
    }

    function score() {
        var topChanged = false;
        var genIndex = 0;
        var count = best.length;
        for (var i = 0; i < count; ++i) {
            if (best[i].score <= generation.members[genIndex].score) {
                best.splice(i, 0, generation.members[genIndex++]);
                best[i].generation = generation.id;

                if (i === 0) {
                    topChanged = true;
                }
            }
        }
        if (best.length != count) {
            best = best.slice(0, count);
            bestChanged(topChanged);
        }

        var sumTopTen = 0;
        var sum = 0;
        generation.members.forEach(function (m, i) {
            if (i < 10) {
                sumTopTen += m.score;
            }
            sum += m.score;
        });

        scores.push({
            top: generation.members[0].score,
            topTen: sumTopTen / 10,
            avg: sum / generation.members.length
        });
    }

    function bestChanged(topChanged) {
        $leaders.forEach(function (l, i) {
            l.text($leaders[0].data('template')
                .replace('{score}', best[i].score.toFixed(1))
                .replace('{generation}', best[i].generation.toString())
            );
        });

        if (topChanged) {
            $topExport.text(JSON.stringify(best[0].individual.export()));
            var sizes = best[0].individual.net.getSizes().slice(1, -1);
            $exportSizes.text(
                $exportSizes.data('template')
                .replace('{sizes}', sizes.toString())
            );

            resetDemos();
        }
    }

    function drawGraph(ctx, width, height) {
        var top = NetTtt.Individual.SCORE_MAX + 1;
        var bottom = NetTtt.Individual.SCORE_MIN - 1;
        var length = Math.min(scores.length, 200);
        var yScale = height / (top - bottom);
        var xStep = width / length;

        ctx.save();

        ctx.lineWidth = 2;

        ctx.clearRect(0, 0, width, height);
        [{s: '#44f', p: 'avg'}, {s: '#4f4', p: 'topTen'}, {s: '#f44', p: 'top'}].forEach(function (which) {
            ctx.strokeStyle = which.s;
            ctx.beginPath();

            var start = Math.max(scores.length - length, 0);
            ctx.moveTo(0, height - (start === 0 ? 0 : (scores[start - 1][which.p] - bottom) * yScale));
            var x = 0;
            for (var i = start; i < scores.length; ++i) {
                x += xStep;
                ctx.lineTo(x, height - (scores[i][which.p] - bottom) * yScale);
            }

            ctx.stroke();
        });

        // TODO: scale so the lines aren't so flat, add a legend

        ctx.restore();
    }

    function resetDemos() {
        if (typeof demoTimerId !== 'undefined') {
            window.clearInterval(demoTimerId);
        }
        demoTimerId = window.setInterval(updateDemos, 1000);

        demos.forEach(function (d) {
            d.game = new Ttt.Game();
        });
        drawDemos();
    }

    function updateDemos() {
        demos.forEach(function (d) {
            if (d.game.winner()) {
                d.game = new Ttt.Game();
                return;
            }

            var ai = (d.game.turn === d.player
                ? new Ai.Neural(best[0].individual.net)
                : d.opponent
            );
            d.game.move(ai.getMove(d.game));
        });
        drawDemos();
    }

    function drawDemos() {
        demos.forEach(function (d) {
            (d.game ? d.game : new Ttt.Game()).draw(d.ctx);
        });
    }

    $pauseButton.click(function (event) {
        setPaused(!paused);
    });

    function inputChanged($item, parse, min, max, _default) {
        var x = parse($item.val());
        if (isNaN(x)) {
            x = _default;
        }
        else if (x < min) {
            x = min;
        }
        else if (x > max) {
            x = max;
        }
        $item.val(x);
        return x;
    }

    function parseInt10(s) {
        return parseInt(s, 10);
    }

    $workers.change(function (event) {
        workerCount = inputChanged($workers, parseInt10, 1, 16, 4);
    });

    $matches.change(function (event) {
        matchesPerTourney = inputChanged($matches, parseInt10, 10, 9999, 600);
    });

    $mutation.change(function (event) {
        mutationRate = inputChanged($mutation, parseFloat, 0.0001, 1, 0.01);
    });

    $clones.change(function (event) {
        clonesPerGeneration = inputChanged($clones, parseInt10, 0, 20, 5);
    });
});
