"use strict";

var NetTtt = (function (NetTtt) {
  function Individual(net) {
    this.net = net;
    this.wins = 0;
    this.losses = 0;
  }

  function play(aiX, aiO) {
    var ais = {};
    ais[Ttt.X] = aiX;
    ais[Ttt.O] = aiO;

    var game = new Ttt.Game();
    var winner;
    do {
      var move = ais[game.turn].getMove(game);
      if (move < 0 || move >= 9 || game.getPiece(move) !== 0)
        return 0;
      game.move(move);
    } while (!(winner = game.winner()));

    return winner;
  }

  Individual.prototype.compete = function (ai, times) {
    times = times || 1;
    // TODO: play as X, play as O, tally wins/losses.  Rank first on losses,
    // then use wins as tie-breaker.
  };

  function Generation(individuals) {
  }

  NetTtt.Individual = Individual;
  NetTtt.Generation = Generation;

  return NetTtt;
}(NetTtt || {}));
