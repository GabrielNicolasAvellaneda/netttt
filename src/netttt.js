var NetTtt = (function (NetTtt) {
    "use strict";

    function Individual(net) {
        this.net = net;
        this.reset();
    }

    // We play three games as both X and O against both the random and smart
    // AIs.  This counts for all 6 wins against the random AI, and no losses
    // against the random AI (and of course no losses implies lasting all 9
    // turns).  See getScore() for how that adds up to 69.
    Individual.PERFECT_SCORE = 69;

    Individual.prototype.reset = function Individual_reset() {
        this.maxAge = 0;
        this.wins = 0;
        this.losses = 0;
    }

    Individual.prototype.getScore = function Individual_getScore() {
        return (this.wins - this.losses) * 10 + this.maxAge;
    };

    function play(x, o) {
        var players = {};
        players[Ttt.X] = x;
        players[Ttt.O] = o;

        var game = new Ttt.Game();
        var winner;
        var turns = 0;
        do {
            var move = players[game.turn].getMove(game);
            if (move < 0 || move >= 9 || game.getPiece(move) !== 0) {
                throw new Error(
                    "AI chose invalid move " + move + " in " + game.toString()
                );
            }

            game.move(move);
            ++turns;
        } while (!(winner = game.winner()));

        return {winner: winner, turns: turns};
    }

    Individual.prototype.score = function Individual_score(
        result, myTurn, vsSmart
    ) {
        if (vsSmart && result.turns > this.maxAge) {
            this.maxAge = result.turns;
        }

        if (result.winner === myTurn) {
            if (vsSmart) {
                throw new Error("Smart AI should never lose");
            }
            this.wins++;
        }
        else if (result.winner !== Ttt.TIE) {
            this.losses++;
        }
    };

    Individual.prototype.match = function Individual_match(opponent, myTurn) {
        var ai = new Ai.Neural(this.net);
        var x = (myTurn === Ttt.X ? ai : opponent);
        var o = (myTurn === Ttt.X ? opponent : ai);

        this.score(play(x, o), myTurn, opponent instanceof Ai.Smart);
    };

    Individual.prototype.tourney = function Individual_tourney() {
        // TODO: don't play against random till it's already good.  Instead,
        // play vs. a "dumb" Smart (depth 0 -- which may mean adding some code
        // to Net to not invoke negamax at all, just order by current
        // evaluation) and then the real Smart.  Or something.
        [new Ai.Random(), new Ai.Smart()].forEach(function (opponent) {
            for (var i = 0; i < 3; ++i) {
                this.match(opponent, Ttt.X);
                this.match(opponent, Ttt.O);
            }
        }, this);
        return this.getScore();
    };

    Individual.prototype.clone = function Individual_clone() {
        return new Individual(this.net.clone());
    };

    function realRand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function intRand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomizeValue(v, modifyChance, minPerturb, maxPerturb) {
        if (Math.random() < modifyChance)
            v += realRand(minPerturb, maxPerturb);
        return v;
    }

    function randomize(
        net, modifyChance, minThresh, maxThresh, minWeight, maxWeight
    ) {
        modifyChance = (typeof modifyChance === 'undefined'
            ? 0.001
            : modifyChance
        );
        minThresh = minThresh || -1000;
        maxThresh = maxThresh || 1000;
        minWeight = minWeight || -100;
        maxWeight = maxWeight || 100;

        net.eachNode(function (node, layer, index) {
            node.threshold = randomizeValue(
                node.threshold,
                modifyChance,
                minThresh,
                maxThresh
            );
            for (var i = 0; i < node.weights.length; ++i) {
                node.weights[i] = randomizeValue(
                    (typeof node.weights[i] === 'undefined'
                        ? 0
                        : node.weights[i]
                    ),
                    modifyChance, minWeight, maxWeight
                );
            }
        });
        return net;
    }

    // Return a Neural.Net() sizes param with 9 in/out neurons, and 1-3
    // internal layers of 3-36 nodes each.
    function randomSizes(minLayers, maxLayers, minNodes, maxNodes) {
        minLayers = minLayers || 1;
        maxLayers = maxLayers || 3;
        minNodes = minNodes || 3;
        maxNodes = maxNodes || 36;

        var sizes = [9];
        var internalLayers = intRand(minLayers, maxLayers);
        for (var i = 0; i < internalLayers; ++i) {
            sizes.push(intRand(minNodes, maxNodes));
        }
        sizes.push(9);
        return sizes;
    }

    Individual.newRandom = function Individual_newRandom() { // "static"
        return new Individual(randomize(new Neural.Net(randomSizes()), 1));
    }

    Individual.prototype.reproduce = function Individual_reproduce() {
        // TODO: small random chance of adding/removing a whole internal layer,
        // or a node within an internal layer (extra weights/thresholds made up
        // randomly?).

        return new Individual(randomize(this.net.clone()));
    };

    Individual.prototype.export = function Individual_export() {
        return this.net.export();
    };

    Individual.import = function Individual_import(i) { // "static"
        var net = Neural.Net.import(i);
        var sizes = net.getSizes();
        if (sizes.length < 1 || sizes[0] !== 9
            || sizes[sizes.length - 1] !== 9
        ) {
            throw new Error(
                "NetTtt.Individual.import() needs a Neural.Net.import() "
                + "object with input and output layer sizes of 9 nodes"
            );
        }

        return new Individual(net);
    };

    function Generation(number, individuals) {
        this.number = number;
        this.members = new Array(individuals.length);
        for (var i = 0; i < individuals.length; ++i) {
            this.members[i] = {
                individual: individuals[i],
                fitness: -Infinity
            };
        }
    }

    Generation.prototype.run = function Generation_run() {
        for (var i = 0; i < this.members.length; ++i) {
            this.members[i].fitness = this.members[i].individual.tourney();
        }

        this.members.sort(function (a, b) { // By fitness descending.
            return (b.fitness - a.fitness);
        });
    };

    Generation.prototype.getIndividuals = function Generation_getIndividuals()
    {
        var individuals = new Array(this.members.length);
        for (var i = 0; i < this.members.length; ++i) {
            individuals[i] = this.members[i].individual;
        }
        return individuals;
    };

    Generation.prototype.next = function Generation_next(
        oldIndividuals, clones, children
    ) {
        oldIndividuals = oldIndividuals || this.getIndividuals();
        clones = clones || 5;
        children = children || 10;

        var newIndividuals = [];
        var i;

        for (i = 0; i < clones; ++i) {
            newIndividuals.push(oldIndividuals[i].clone());
        }

        // Start with 10 children from the best, 9 from the second best, etc.,
        // until we're eventually just asking each node for one child and we
        // fill up on individuals.
        var reproducer = 0;
        while (newIndividuals.length < oldIndividuals.length) {
            for (i = 0; i < children; ++i) {
                newIndividuals.push(oldIndividuals[reproducer].reproduce());
            }
            if (children > 1) {
                --children;
            }
            ++reproducer;
        }

        return new Generation(this.number + 1, newIndividuals);
    }

    // "static"
    Generation.newRandom = function Generation_newRandom(imported, size) {
        imported = imported || [];
        size = size || 100;

        var individuals = new Array(size);
        var i;
        for (i = 0; i < imported.length; ++i) {
            individuals[i] = imported[i];
        }
        for (; i < size; ++i) {
            individuals[i] = Individual.newRandom();
        }
        return new Generation(0, individuals);
    }

    NetTtt.Individual = Individual;
    NetTtt.Generation = Generation;

    return NetTtt;
}(NetTtt || {}));
