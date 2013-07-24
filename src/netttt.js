"use strict";

var NetTtt = (function (NetTtt) {
  function Individual(net) {
    this.net = net;
    this.wins = 0;
    this.losses = 0;
  }

  function play(x, o) {
    var players = {};
    players[Ttt.X] = x;
    players[Ttt.O] = o;

    var game = new Ttt.Game();
    var winner;
    do {
      var move = players[game.turn].getMove(game);
      if (move < 0 || move >= 9 || game.getPiece(move) !== 0)
        throw new Error("Invalid move " + move + " in " + game.toString());
      game.move(move);
    } while (!(winner = game.winner()));

    return winner;
  }

  Individual.prototype.match = function (opponent, myTurn) {
    var ai = new Ai.Neural(this.net);
    var x = (myTurn === Ttt.X ? ai : opponent);
    var o = (myTurn === Ttt.X ? opponent : ai);

    var winner = play(x, o);
    if (winner === myTurn)
      this.wins++;
    else if (winner !== Ttt.TIE)
      this.losses++;
  };

  Individual.prototype.tourney = function (opponent) {
    // TODO: play a number of games as each player.  Maybe play against the
    // smart ai first and count losses (and maybe count the number of turns
    // till losing, too, as a first metric), then count wins/losses against the
    // random ai.
  };

  function Generation(individuals) {
  }

  NetTtt.Individual = Individual;
  NetTtt.Generation = Generation;

  return NetTtt;
}(NetTtt || {}));
