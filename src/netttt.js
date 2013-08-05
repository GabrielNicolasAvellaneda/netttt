"use strict";

var NetTtt = (function (NetTtt) {
    // We play three games as both X and O against both the random and smart
    // AIs.  This counts for all 6 wins against the random AI, and no losses
    // against the random AI (and of course no losses implies lasting all 9
    // turns).  See getScore() for how that adds up to 69.
    var PERFECT_SCORE = 69;

    function Individual(net) {
        this.net = net;
        this.reset();
    }

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
                throw new Error("AI chose invalid move " + move + " in " + game.toString());
            }

            game.move(move);
            ++turns;
        } while (!(winner = game.winner()));

        return {winner: winner, turns: turns};
    }

    Individual.prototype.score = function Individual_score(result, myTurn, vsSmart) {
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
        var opponents = [new Ai.Random(), new Ai.Smart()];
        for (var o in opponents) {
            for (var i = 0; i < 3; ++i) {
                this.match(opponents[o], Ttt.X);
                this.match(opponents[o], Ttt.O);
            }
        }
        return this.getScore();
    };

    // Resets and returns this instance (cheaper than an actual clone).
    Individual.prototype.clone = function Individual_clone() {
        this.reset();
        return this;
    };

    function realRand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function intRand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    Individual.prototype.reproduce = function Individual_reproduce() {
        // TODO: small random chance of adding/removing a whole internal layer,
        // or a node within an internal layer (extra weights/thresholds made up
        // randomly).  Random chance to slightly perturb each weight/threshold.
    };

    // TODO: import/export?
    // TODO: use seedrandom? <https://github.com/davidbau/seedrandom>

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

    Generation.prototype.getIndividuals = function Generation_getIndividuals() {
        var individuals = new Array(this.members.length);
        for (var i = 0; i < this.members.length; ++i) {
            individuals[i] = this.members[i].individual;
        }
        return individuals;
    };

    Generation.prototype.next = function Generation_next(oldIndividuals, clones, contributors) {
        clones = clones || 5;
        contributors = contributors || 10;
        oldIndividuals = oldIndividuals || this.getIndividuals();

        var children = oldIndividuals.length / contributors;
        var lastChildren = children - clones;

        var newIndividuals = [];
        var i;
        for (i = 0; i < clones; ++i) {
            newIndividuals.push(oldIndividuals[i].clone());
        }

        for (i = 0; i < contributors - 1; ++i) {
            for (var j = 0; j < children; ++j) {
                newIndividuals.push(oldIndividuals[i].reproduce());
            }
        }
        for (i = 0; i < lastChildren; ++i) {
            newIndividuals.push(oldIndividuals[contributors - 1].reproduce());
        }

        return new Generation(this.number + 1, newIndividuals);
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

    // Return an array of weights for the right sizes, with each value in the
    // range [-100,100).
    function randomWeights(sizes, minWeight, maxWeight) {
        minWeight = minWeight || -100;
        maxWeight = maxWeight || 100;

        var weights = new Array(sizes.length);
        for (var i = 0; i < sizes.length; ++i) {
            weights[i] = new Array(sizes[i]);
            var count = (i < sizes.length - 1 ? sizes[i + 1] : 1);
            for (var j = 0; j < sizes[i]; ++j) {
                weights[i][j] = new Array(count);
                for (var k = 0; k < count; ++k) {
                    weights[i][j][k] = realRand(minWeight, maxWeight);
                }
            }
        }
        return weights;
    }

    // Return an array of thresholds for the right sizes, each value in the
    // range [-1000,1000).
    function randomThresholds(sizes, minThresh, maxThresh) {
        minThresh = minThresh || -1000;
        maxThresh = maxThresh || 1000;

        var thresholds = new Array(sizes.length);
        for (var i = 0; i < sizes.length; ++i) {
            thresholds[i] = new Array(sizes[i]);
            for (var j = 0; j < sizes[i]; ++j) {
                thresholds[i][j] = realRand(minThresh, maxThresh);
            }
        }
        return thresholds;
    }

    function newRandomNet() {
        var sizes = randomSizes();
        var n = new Neural.Net(sizes);
        n.setWeights(randomWeights(sizes));
        n.setThresholds(randomThresholds(sizes));
        return n;
    }

    function newRandomGeneration(imported, size) {
        imported = imported || [];
        size = size || 100;

        // TODO: incorporate imported.
        var individuals = new Array(size);
        for (var i = 0; i < size; ++i) {
            individuals[i] = new Individual(newRandomNet());
        }
        return new Generation(0, individuals);
    }

    NetTtt.PERFECT_SCORE = PERFECT_SCORE;
    NetTtt.Individual = Individual;
    NetTtt.Generation = Generation;
    NetTtt.newRandomGeneration = newRandomGeneration;

    return NetTtt;
}(NetTtt || {}));
