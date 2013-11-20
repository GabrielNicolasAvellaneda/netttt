"use strict";

var generation;
var best;
var jumps;
var paused = false;
var workerCount = 4;
var mutationRate = 0.01;
var workers = [];

// TODO: use seedrandom? <https://github.com/davidbau/seedrandom>

$(function () {
    var STORAGE_KEY = 'netttt.state';

    var $current = $('#current');
    var $time = $('#time');
    var $pauseButton = $('#pause');
    var $resetButton = $('#reset');
    var $workers = $('#workers');
    var $mutation = $('#mutation');
    var $generationBest = $('#generation-best');
    var $generationAverage = $('#generation-average');
    var $jumps = $('#jumps');
    var $bestExport = $('#best-export');

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

    $workers.val(workerCount);
    $mutation.val(mutationRate);

    reset();

    function restore() {
        return (localStorage[STORAGE_KEY]
            ? NetTtt.Generation.import($.parseJSON(localStorage[STORAGE_KEY]))
            : null
        );
    }

    function save(generation) {
        localStorage[STORAGE_KEY] = JSON.stringify(generation.export());
    }

    function clear() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function reset() {
        generation = restore() || NetTtt.Generation.newRandom();
        best = null;
        jumps = [];

        updateScores(true);
        update();
        run();
    }

    function run() {
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

        if (paused && receivedCount === workers.length) {
            $resetButton.removeAttr('disabled');
        }
        else {
            $resetButton.attr('disabled', true);
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
        return generation.export({
            index: chunk,
            total: workers.length
        });
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

        generation = generation.next(mutationRate);
        save(generation);

        update();
        run();
    }

    function setPaused(p) {
        if (p !== paused) {
            paused = p;

            update();
            run();
        }
    }

    function score() {
        var bestChanged = false;
        if (!best || best.individual.compareTo(generation.individuals[0]) < 0) {
            best = {
                individual: generation.individuals[0],
                generation: generation.id
            };
            jumps.push(best);

            bestChanged = true;
        }

        var sum = 0;
        generation.individuals.forEach(function (i) {
            sum += i.score;
        });

        updateScores(bestChanged, generation.individuals[0],
            sum / generation.individuals.length
        );
    }

    function updateScores(bestChanged, generationBest, generationAverage) {
        $jumps.empty();
        $jumps.append(jumps.map(function (j) {
            return $($jumps.data('template')
                .replace('{score}', j.individual.score.toString())
                .replace('{age}', j.individual.age.toString())
                .replace('{id}', j.individual.id.toString())
                .replace('{generation}', j.generation.toString())
            );
        }));

        if (bestChanged) {
            $bestExport.text(best ? JSON.stringify(best.individual.export()) : '');

            resetDemos();
        }

        $generationBest.text(typeof generationBest === 'undefined'
            ? $generationBest.data('empty')
            : $generationBest.data('template')
                .replace('{score}', generationBest.score.toString())
                .replace('{age}', generationBest.age.toString())
                .replace('{id}', generationBest.id.toString())
        );
        $generationAverage.text(typeof generationAverage === 'undefined'
            ? $generationAverage.data('empty')
            : $generationAverage.data('template')
                .replace('{score}', generationAverage.toFixed(1))
        );
    }

    function resetDemos() {
        if (typeof demoTimerId !== 'undefined') {
            window.clearInterval(demoTimerId);
        }
        if (best) {
            demoTimerId = window.setInterval(updateDemos, 1000);
        }

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
                ? new Ai.Neural(best.individual.net)
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

    $resetButton.click(function (event) {
        clear();
        reset();
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
