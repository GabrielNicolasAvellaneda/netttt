"use strict";

var generation;
var top_;
var paused = false;
var workerCount = 4;
var mutationRate = 0.01;
var workers = [];

// TODO: use seedrandom? <https://github.com/davidbau/seedrandom>

$(function () {
    generation = NetTtt.Generation.newRandom();
    top_ = [0,1,2,3,4,5,6,7,8,9].map(function () {
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
    var $generationBest = $('#generation-best');
    var $generationTop = $('#generation-top-ten');
    var $generationAverage = $('#generation-average');
    var $leaders = top_.map(function (b, i) {
        return $('#leader-' + i.toString());
    });
    var $topExport = $('#top-export');

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

        if (!top_[0].individual) {
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
        run();
    }

    function setPaused(p) {
        if (p !== paused) {
            paused = p;
            run();
        }
    }

    function score() {
        var bestChanged = false;
        var genIndex = 0;
        var count = top_.length;
        for (var i = 0; i < count; ++i) {
            if (!top_[i].individual || top_[i].individual.compareTo(generation.individuals[genIndex]) < 0) {
                top_.splice(i, 0, {
                    individual: generation.individuals[genIndex++],
                    generation: generation.id
                });

                bestChanged = bestChanged || i === 0;
            }
        }
        if (top_.length != count) {
            top_ = top_.slice(0, count);
            topChanged(bestChanged);
        }

        var sumTopTen = 0;
        var sum = 0;
        generation.individuals.forEach(function (i, index) {
            if (index < 10) {
                sumTopTen += i.score;
            }
            sum += i.score;
        });

        lastGenerationChanged(generation.individuals[0], sumTopTen / 10,
            sum / generation.individuals.length
        );
    }

    function lastGenerationChanged(best, top, average) {
        $generationBest.text($generationBest.data('template')
            .replace('{score}', best.score.toString())
            .replace('{age}', best.age.toString())
        );
        $generationTop.text($generationTop.data('template')
            .replace('{score}', top.toFixed(1))
        );
        $generationAverage.text($generationAverage.data('template')
            .replace('{score}', average.toFixed(1))
        );
    }

    function topChanged(bestChanged) {
        $leaders.forEach(function (l, i) {
            l.text($leaders[0].data('template')
                .replace('{score}', top_[i].individual.score.toString())
                .replace('{age}', top_[i].individual.age.toString())
                .replace('{generation}', top_[i].generation.toString())
            );
        });

        if (bestChanged) {
            $topExport.text(JSON.stringify(top_[0].individual.export()));

            resetDemos();
        }
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
                ? new Ai.Neural(top_[0].individual.net)
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
