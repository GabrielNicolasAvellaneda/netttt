var NetTtt = (function (NetTtt) {
    "use strict";

    function play(x, o) {
        var players = {};
        players[Ttt.X] = x;
        players[Ttt.O] = o;

        var game = new Ttt.Game();
        var winner;
        do {
            var move = players[game.turn].getMove(game);
            if (move < 0 || move >= 9 || game.getPiece(move) !== 0) {
                throw new Error(
                    "AI chose invalid move " + move.toString()
                    + " in " + game.toString()
                );
            }

            game.move(move);
        } while (!(winner = game.winner()));

        return winner;
    }

    var testBoards = generateTestBoards();

    function generateTestBoards(boards, visited, game) {
        boards = boards || [[], [], [], [], [], [], [], [], []];
        visited = visited || {};
        game = game || new Ttt.Game();

        if (visited[game.board] || game.winner())
            return boards;

        var emptySquares = game.emptySquares();

        boards[9 - emptySquares.length].push({
            board: game.board,
            rightMoves: null
        });
        visited[game.board] = true;

        emptySquares.forEach(function (move) {
            game.move(move);
            generateTestBoards(boards, visited, game);
            game.undo();
        });

        return boards;
    }

    // Both scaled by number of matches played.
    var WIN_SCORE = 1000;
    var LOSS_SCORE = -5000;

    function Individual(id, net) {
        this.id = id;
        this.net = net;
        this.age = -Infinity;
        this.score = -Infinity;
    }

    Individual.SCORE_MIN = LOSS_SCORE;
    Individual.SCORE_MAX = WIN_SCORE;

    // Descending by age, then score.
    Individual.compare = function Individual_compare(a, b) { // "static"
        if (a.age !== b.age) {
            return b.age - a.age;
        }
        return b.score - a.score;
    };

    Individual.prototype.compareTo = function Individual_compareTo(other) {
        return Individual.compare(this, other);
    };

    Individual.prototype.match = function Individual_match(turn, matches) {
        var me = new Ai.Neural(this.net);
        var opponent = new Ai.Random();
        var x = (turn === Ttt.X ? me : opponent);
        var o = (turn === Ttt.X ? opponent : me);

        var winner = play(x, o);

        if (winner === turn) {
            this.score += WIN_SCORE / matches;
        }
        else if (winner !== Ttt.TIE) {
            this.score += LOSS_SCORE / matches;
        }
    };

    Individual.prototype.tourney = function Individual_tourney(matches) {
        matches = matches || 600;

        this.age = 0;
        this.score = 0;

        [
            {turn: Ttt.X, matches: Math.round(matches / 2)},
            {turn: Ttt.O, matches: matches - Math.round(matches / 2)}
        ].forEach(function (obj) {
            for (var i = 0; i < obj.matches; ++i) {
                this.match(obj.turn, matches);
            }
        }, this);
    };

    Individual.prototype.clone = function Individual_clone(id) {
        return new Individual(id, this.net.clone());
    };

    function realRand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function intRand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomizeValue(v, modifyChance, minPerturb, maxPerturb) {
        if (Math.random() < modifyChance) {
            v += realRand(minPerturb, maxPerturb);
        }
        return v;
    }

    function randomize(
        net, modifyChance, minThresh, maxThresh, minWeight, maxWeight
    ) {
        // TODO: change this so at low chances, we still modify at least one
        // part of a node.
        modifyChance = (typeof modifyChance === 'undefined'
            ? 0.01
            : modifyChance
        );
        minThresh = minThresh || -100;
        maxThresh = maxThresh || 100;
        minWeight = minWeight || -10;
        maxWeight = maxWeight || 10;

        net.eachNode(function (node) {
            node.threshold = randomizeValue(
                node.threshold, modifyChance, minThresh, maxThresh
            );
            for (var i = 0; i < node.weights.length; ++i) {
                node.weights[i] = randomizeValue(
                    node.weights[i] || 0, modifyChance, minWeight, maxWeight
                );
            }
        });
        return net;
    }

    Individual.newRandom = function Individual_newRandom(id) { // "static"
        var sizes = [18, 27, 9, 1];
        return new Individual(id, randomize(new Neural.Net(sizes), 1));
    }

    Individual.prototype.reproduce = function Individual_reproduce(
        id, mutationRate
    ) {
        // TODO: small random chance of adding/removing a whole internal layer,
        // or a node within an internal layer (extra weights/thresholds made up
        // randomly?).

        return new Individual(id, randomize(this.net.clone(), mutationRate));
    };

    Individual.prototype.export = function Individual_export() {
        return {
            id: this.id,
            net: this.net.export()
        };
    };

    Individual.import = function Individual_import(obj) { // "static"
        if (typeof obj.id === 'undefined' || typeof obj.net === 'undefined') {
            throw new Error(
                "NetTtt.Individual.import() needs an object with properties "
                + "id and net"
            );
        }

        var id = obj.id;
        var net = Neural.Net.import(obj.net);
        var sizes = net.getSizes();
        if (sizes.length < 1 || sizes[0] !== 18
            || sizes[sizes.length - 1] !== 1
        ) {
            throw new Error(
                "NetTtt.Individual.import() needs a Neural.Net.import() "
                + "object with 18 input layer nodes and 1 output layer node"
            );
        }

        return new Individual(id, net);
    };

    function Generation(id, individuals) {
        this.id = id || 0;
        // Allow the individuals to specify their own ids so our workers don't
        // munge the ids from the main thread.
        this.individuals = individuals;
    }

    Generation.prototype.run = function Generation_run(matchesPerTourney) {
        this.individuals.forEach(function (i) {
            i.tourney(matchesPerTourney);
        });
    };

    Generation.prototype.order = function Generation_order() {
        this.individuals.sort(Individual.compare);
    };

    Generation.prototype.next = function Generation_next(
        mutationRate, clones, children, id, oldIndividuals
    ) {
        mutationRate = mutationRate || 0.05;
        clones = clones || 5;
        children = children || 10;
        id = id || this.id + 1;
        oldIndividuals = oldIndividuals || this.individuals;

        var newIndividuals = [];
        var i;

        for (i = 0; i < clones; ++i) {
            newIndividuals.push(
                oldIndividuals[i].clone(newIndividuals.length)
            );
        }

        // Start with 10 children from the best, 9 from the second best, etc.,
        // until we're eventually just asking each node for one child and we
        // fill up on individuals.
        var reproducer = 0;
        while (newIndividuals.length < oldIndividuals.length) {
            for (i = 0;
                i < children && newIndividuals.length < oldIndividuals.length;
                ++i
            ) {
                newIndividuals.push(
                    oldIndividuals[reproducer].reproduce(
                        newIndividuals.length, mutationRate
                    )
                );
            }
            if (children > 1) {
                --children;
            }
            ++reproducer;
        }

        return new Generation(id, newIndividuals);
    }

    // "static"
    Generation.newRandom = function Generation_newRandom(id, imported, size) {
        id = id || 0;
        imported = imported || [];
        size = size || 100;

        var individuals = new Array(size);
        var i;
        for (i = 0; i < imported.length; ++i) {
            individuals[i] = imported[i];
            individuals[i].id = i;
        }
        for (; i < size; ++i) {
            individuals[i] = Individual.newRandom(i);
        }
        return new Generation(id, individuals);
    }

    NetTtt.play = play;
    NetTtt.Individual = Individual;
    NetTtt.Generation = Generation;

    return NetTtt;
}(NetTtt || {}));
