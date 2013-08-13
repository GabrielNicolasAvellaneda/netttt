var Ai = (function (Ai) {
    "use strict";

    function Random() {
    }

    function arrayRand(a) {
        return a[Math.floor(Math.random() * a.length)];
    }

    Random.prototype.getMove = function Random_getMove(game) {
        return arrayRand(game.validMoves());
    };

    function sign(piece) {
        return (piece === 0 ? 0 : (piece === Ttt.X ? 1 : -1));
    }

    function countScoringMoves(board, scorer) {
        var pieces = Ttt.toArray(board);
        var scoringMoves = 0;

        for (var i = 0; i < 3; ++i) {
            scoringMoves += scorer(
                pieces[i * 3 + 0],
                pieces[i * 3 + 1],
                pieces[i * 3 + 2]
            );
            scoringMoves += scorer(
                pieces[i + 0],
                pieces[i + 3],
                pieces[i + 6]
            );
        }
        scoringMoves += scorer(pieces[0], pieces[4], pieces[8]);
        scoringMoves += scorer(pieces[2], pieces[4], pieces[6]);

        return scoringMoves;
    }

    function countNearWins(board) {
        return countScoringMoves(board, function (a, b, c) {
            var sum = sign(a) + sign(b) + sign(c);
            return (Math.abs(sum) === 2 ? (sum > 0 ? 1 : -1) : 0);
        });
    }

    function countNearWinsForPlayer(board, player) {
        return countScoringMoves(board, function (a, b, c) {
            var sum = sign(a) + sign(b) + sign(c);
            return (Math.abs(sum) === 2 && sum / 2 === sign(player) ? 1 : 0);
        });
    }

    function countPotentialWins(board) {
        return countScoringMoves(board, function (a, b, c) {
            a = sign(a);
            b = sign(b);
            c = sign(c);
            var sum = a + b + c;
            return (Math.abs(sum) === 1 && (!a || !b || !c) ? sum : 0);
        });
    }

    function Smart(maxDepth) {
        // Default to whole game (2 in first moves table + 7 is the whole 9).
        this.maxDepth = maxDepth || 7;
    }

    // We give a winning position a high score, then count the number of ways a
    // player could win at the current position.
    Smart.evaluate = function Smart_evaluate(board, winner) { // "static"
        if (typeof winner === 'undefined') {
            winner = Ttt.winner(board);
        }
        if (winner) {
            return sign(winner === Ttt.TIE ? 0 : winner) * 100;
        }

        return countNearWins(board) * 10 + countPotentialWins(board);
    };

    function topScoring(moves, evaluator) {
        var max = -Infinity;
        var top = [];

        moves.forEach(function (move) {
            var value = evaluator(move);

            if (value > max) {
                max = value;
                top = [move];
            }
            else if (value === max) {
                top.push(move);
            }
        });

        return {
            score: max,
            moves: top
        };
    }

    function blocksOpponent(board, move, turn) {
        var opponent = (turn === Ttt.X ? Ttt.O : Ttt.X);
        return (countNearWinsForPlayer(Ttt.move(board, move, turn), opponent)
            < countNearWinsForPlayer(board, opponent)
        );
    }

    // The moves are all equal as far as negamax is concerned, so we've got to
    // choose the best one to play now.  If any moves are are an immediate win,
    // we simply pick among them randomly.  Otherwise, we choose moves blocking
    // an opponent's win, then we just pick the square with the highest
    // evaluation.  If there are still moves that are equivalent after all
    // that, we pick randomly.  Adding a random element keeps the opponent on
    // their toes a little more than something entirely predictable.
    function resolveTies(board, moves, turn) {
        if (moves.length > 1) {
            var win = false;
            moves = topScoring(moves, function (move) {
                if (Ttt.winner(Ttt.move(board, move, turn)) === turn) {
                    win = true;
                    return 1;
                }
                return 0;
            }).moves;
            if (win) {
                return arrayRand(moves);
            }
        }

        if (moves.length > 1) {
            moves = topScoring(moves, function (move) {
                return (blocksOpponent(board, move, turn) ? 1 : 0);
            }).moves;
        }

        if (moves.length > 1) {
            moves = topScoring(moves, function (move) {
                return (sign(turn)
                    * Smart.evaluate(Ttt.move(board, move, turn))
                );
            }).moves;
        }

        return arrayRand(moves);
    }

    // Basic negamax implementation, with a few modifications (see
    // <http://en.wikipedia.org/wiki/Negamax> or
    // <http://www.hamedahmadi.com/gametree/>).  We don't use alpha-beta
    // pruning because we don't just want to find the first valid move with the
    // best score, we want to find all valid moves with the same (and best)
    // score, so we can choose among them.  We pick from the best scoring moves
    // with a simple heuristic (see resolveTies()).  Because we also use this
    // to instruct us as to which move to make, if we're at the top level we
    // return the move itself instead of the score of the best move.
    Smart.prototype.negamax = function Smart_negamax(board, turn, depth) {
        var winner = Ttt.winner(board);
        if (depth === this.maxDepth || winner) {
            return sign(turn) * Smart.evaluate(board, winner);
        }

        var that = this;
        var topScore = topScoring(Ttt.validMoves(board), function (move) {
            return -that.negamax(
                Ttt.move(board, move, turn),
                (turn === Ttt.X ? Ttt.O : Ttt.X),
                depth + 1
            );
        });

        return (depth
            ? topScore.score
            : resolveTies(board, topScore.moves, turn)
        );
    };

    // A small lookup table for the second move, so we don't have to go through
    // the whole algorithm just to pick the corners or the middle.
    function getSecondMove(board) {
        if (Ttt.getPiece(board, 4)) {
            return arrayRand([0, 2, 6, 8]);
        }
        return 4;
    }

    Smart.prototype.getMove = function Smart_getMove(game) {
        if (Ttt.isEmpty(game.board)) {
            return 4;
        }
        if (Ttt.validMoves(game.board).length === 8) {
            return getSecondMove(game.board);
        }

        return this.negamax(game.board, game.turn, 0);
    };

    function Neural(net) {
        this.net = net;
    }

    function getInputs(game) {
        var inputs = new Array(9);
        for (var i = 0; i < 9; ++i) {
            var piece = game.getPiece(i);
            inputs[i] = (piece === 0 ? 0 : (piece === game.turn ? 1 : -1));
        }
        return inputs;
    }

    Neural.prototype.getMove = function Neural_getMove(game) {
        this.net.reset();
        var outputs = this.net.run(getInputs(game));

        return arrayRand(topScoring(game.validMoves(), function (move) {
            return outputs[move];
        }).moves);
    };

    Ai.Random = Random;
    Ai.Smart = Smart;
    Ai.Neural = Neural;

    return Ai;
}(Ai || {}));
