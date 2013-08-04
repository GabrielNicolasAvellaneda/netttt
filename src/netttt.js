"use strict";

var NetTtt = (function (NetTtt) {
    // We play three games as both X and O against both the random and smart
    // AIs.  This counts for all 6 wins against the random AI, and no losses
    // against the random AI (and of course no losses implies lasting all 9
    // turns).  See getScore() for how that adds up to 69.
    var PERFECT_SCORE = 69;

    function Individual(net) {
        this.net = net;
        this.maxAge = 0;
        this.wins = 0;
        this.losses = 0;
    }

    Individual.prototype.getScore = function () {
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

    Individual.prototype.score = function (result, myTurn, vsSmart) {
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

    Individual.prototype.match = function (opponent, myTurn) {
        var ai = new Ai.Neural(this.net);
        var x = (myTurn === Ttt.X ? ai : opponent);
        var o = (myTurn === Ttt.X ? opponent : ai);

        this.score(play(x, o), myTurn, opponent instanceof Ai.Smart);
    };

    Individual.prototype.tourney = function () {
        var opponents = [new Ai.Random(), new Ai.Smart()];
        for (var o in opponents) {
            for (var i = 0; i < 3; ++i) {
                this.match(opponents[o], Ttt.X);
                this.match(opponents[o], Ttt.O);
            }
        }
        return this.getScore();
    };

    function Generation(individuals) {
        this.members = new Array(individuals.length);
        for (var i = 0; i < individuals.length; ++i) {
            this.members[i] = {
                individual: individuals[i],
                fitness = -Infinity
            };
        }
    }

    Generation.prototype.run = function () {
        for (var i = 0; i < this.members.length; ++i) {
            this.members[i].fitness = this.members[i].individual.tourney();
        }
        this.members.sort(function (a, b) { // By fitness descending.
            return (b.fitness - a.fitness);
        });
    };

    NetTtt.PERFECT_SCORE = PERFECT_SCORE;
    NetTtt.Individual = Individual;
    NetTtt.Generation = Generation;

    return NetTtt;
}(NetTtt || {}));
