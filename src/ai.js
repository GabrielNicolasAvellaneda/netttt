"use strict";

var Ai = (function (Ai) {
  function Random() {
  }

  Random.prototype.getMove = function (game) {
    var moves = game.validMoves();
    return moves[Math.floor(Math.random() * moves.length)];
  };

  function sign(piece) {
    return (piece === 0 ? 0 : (piece === Ttt.X ? 1 : -1));
  }

  function nearWin(a, b, c) {
    a = sign(a);
    b = sign(b);
    c = sign(c);
    var sum = a + b + c;
    return (Math.abs(sum) === 2 ? (sum > 0 ? 1 : -1) : 0);
  }

  function countNearWins(board) {
    var pieces = Ttt.toArray(board);
    var nearWins = 0;

    for (var i = 0; i < 3; ++i) {
      nearWins += nearWin(pieces[i * 3 + 0], pieces[i * 3 + 1], pieces[i * 3 + 2]);
      nearWins += nearWin(pieces[i + 0], pieces[i + 3], pieces[i + 6]);
    }
    nearWins += nearWin(pieces[0], pieces[4], pieces[8]);
    nearWins += nearWin(pieces[2], pieces[4], pieces[6]);
    return nearWins;
  }

  // We give a winning position a high score, then count the number of ways a
  // player could win at the current position.
  function evaluate(board, winner) {
    if (typeof winner === 'undefined')
      winner = Ttt.winner(board);
    if (winner)
      return sign(winner === Ttt.TIE ? 0 : winner) * 100;

    return countNearWins(board) * 10;
  }

  function topScoring(moves, evaluator) {
    var max = -Infinity;
    var top = [];

    for (var move in moves) {
      move = moves[move];

      var value = evaluator(move);

      if (value > max) {
        max = value;
        top = [move];
      } else if (value === max) {
        top.push(move);
      }
    }

    return {score: max, moves: top};
  }

  function resolveTies(board, moves, turn) {
    var top = topScoring(moves, function (move) {
      return sign(turn) * evaluate(Ttt.move(board, move, turn));
    }).moves;
    return top[Math.floor(Math.random() * top.length)];
  }

  function Smart(maxDepth) {
    this.maxDepth = maxDepth || 9;
  }

  // Basic negamax implementation, with a few modifications (see
  // <http://en.wikipedia.org/wiki/Negamax> or
  // <http://www.hamedahmadi.com/gametree/>).  We don't use alpha-beta pruning
  // because we don't just want to find the first valid move with the best
  // score, we want to find all valid moves with the same (and best) score, so
  // we can choose among them randomly.  We actually choose randomly among the
  // best-scoring moves that immediately evaluate to the highest value board,
  // so that e.g. we favor an immediate win over a win just around the corner.
  // Adding a random element keeps the opponent on their toes a little more
  // than something entirely predictable.  Because we also use this to instruct
  // us as to which move to make, if we're at the top level we return the move
  // itself instead of the score of the best move.
  Smart.prototype.negamax = function (board, turn, depth) {
    // TODO: keep a map of boards -> their value for each search, so we don't
    // constantly re-evaluate the same thing.
    var winner = Ttt.winner(board);
    if (depth === this.maxDepth || winner)
      return sign(turn) * evaluate(board, winner);

    // TODO: use symmetry (at least for the first two moves) to avoid searching
    // the full set of valid moves.
    var that = this;
    var topScore = topScoring(Ttt.validMoves(board), function (move) {
      return -that.negamax(
        Ttt.move(board, move, turn),
        (turn === Ttt.X ? Ttt.O : Ttt.X),
        depth + 1
      );
    });

    return (depth ? topScore.score : resolveTies(board, topScore.moves, turn));
  }

  Smart.prototype.getMove = function (game) {
    return this.negamax(game.board, game.turn, 0, -Infinity, Infinity);
  };

  Ai.Random = Random;
  Ai.Smart = Smart;
  Ai.evaluate = evaluate;

  return Ai;
}(Ai || {}));
