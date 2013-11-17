"use strict";

var generation;
var best;
var scores = [];
var paused = false;
var workerCount = 4;
var mutationRate = 0.01;
var workers = [];

// TODO: use seedrandom? <https://github.com/davidbau/seedrandom>

$(function () {
    generation = NetTtt.Generation.newRandom();
    best = [0,1,2,3,4,5,6,7,8,9].map(function () {
        return {
            individual: null,
            generation: -1
        };
    });

    var $current = $('#current');
    var $time = $('#time');
    var $pauseButton = $('#pause');
    var $workers = $('#workers');
    var $mutation = $('#mutation');
    var $graph = $('#graph');
    var $leaders = best.map(function (b, i) {
        return $('#leader-' + i.toString());
    });
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
        $mutation.val(mutationRate);

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

        if (!best[0].individual) {
            drawDemos();
        }
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

    function exportGeneration(chunk) {
        var size = generation.individuals.length / workers.length;
        return {
            generation: generation.id,
            individuals: generation.individuals.slice(
                Math.round(chunk * size), Math.round((chunk + 1) * size)
            ).map(function (i) { return i.export(); })
        };
    }

    function process(data) {
        if (data.generation !== generation.id) {
            throw new Error("Worker shenanigans");
        }

        data.scores.forEach(function (s) {
            generation.individuals[s.id].age = s.age;
            generation.individuals[s.id].score = s.score;
        });

        if (++receivedCount === workers.length) {
            finishRun();
        }
    }

    function finishRun() {
        generation.individuals.forEach(function (i) {
            if (i.age === -Infinity || i.score === -Infinity) {
                throw new Error("Received incomplete result");
            }
        });

        generation.order();

        endTime = window.performance.now();

        score();
        drawGraph(graphCtx, $graph.width(), $graph.height());

        generation = generation.next(mutationRate);

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
            if (!best[i].individual || best[i].individual.compareTo(generation.individuals[genIndex]) < 0) {
                best.splice(i, 0, {
                    individual: generation.individuals[genIndex++],
                    generation: generation.id
                });

                topChanged = topChanged || i === 0;
            }
        }
        if (best.length != count) {
            best = best.slice(0, count);
            bestChanged(topChanged);
        }

        var sumTopTen = 0;
        var sum = 0;
        generation.individuals.forEach(function (i, index) {
            if (index < 10) {
                sumTopTen += i.score;
            }
            sum += i.score;
        });

        scores.push({
            top: generation.individuals[0].score,
            topTen: sumTopTen / 10,
            avg: sum / generation.individuals.length
        });
    }

    function bestChanged(topChanged) {
        $leaders.forEach(function (l, i) {
            l.text($leaders[0].data('template')
                .replace('{score}', best[i].individual.score.toFixed(1))
                .replace('{age}', best[i].individual.age.toString())
                .replace('{generation}', best[i].generation.toString())
            );
        });

        if (topChanged) {
            $topExport.text(JSON.stringify(best[0].individual.export()));

            resetDemos();
        }
    }

    function drawGraph(ctx, width, height) {
        var top = NetTtt.Individual.SCORE_MAX + 1;
        var bottom = -1;
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
        // TODO: instead of showing individual points, when enough generations
        // have passed show each point as an average of however many points.
        // That way you can still see the general shape of the whole history
        // even after thousands of generations.

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

    $mutation.change(function (event) {
        mutationRate = inputChanged($mutation, parseFloat, 0.0001, 0.1, 0.01);
    });
});
