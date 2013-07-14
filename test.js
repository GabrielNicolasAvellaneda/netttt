"use strict";

module("Ttt");

test("new board is empty", function () {
  var b = Ttt.newBoard();
  ok(Ttt.isEmpty(b), "empty");
  for (var i = 0; i < 9; ++i)
    strictEqual(Ttt.getPiece(b, i), 0, "getPiece(" + i + ") is blank");
  deepEqual(Ttt.toArray(b), [0, 0, 0, 0, 0, 0, 0, 0, 0], "blank toArray");
  deepEqual(Ttt.validMoves(b), [0, 1, 2, 3, 4, 5, 6, 7, 8], "all moves valid");
  strictEqual(Ttt.winner(b), 0, "no winner yet");
});

test("making moves is internally consistent", function () {
  var square = 4;
  var piece = Ttt.X;
  var b = Ttt.move(Ttt.newBoard(), square, piece);
  ok(!Ttt.isEmpty(b), "not empty");
  strictEqual(Ttt.getPiece(b, square), piece, "getPiece returns correct piece");
  deepEqual(Ttt.toArray(b), [0, 0, 0, 0, piece, 0, 0, 0, 0], "toArray has correct piece");
  deepEqual(Ttt.validMoves(b), [0, 1, 2, 3, 5, 6, 7, 8], "same move isn't valid");
  strictEqual(Ttt.winner(b), 0, "no winner yet");
});

test("win conditions", function () {
  var b;
  for (var piece in [Ttt.X, Ttt.O]) {
    piece = [Ttt.X, Ttt.O][piece];

    for (var i = 0; i < 3; ++i) {
      b = Ttt.newBoard();
      b = Ttt.move(b, i * 3 + 0, piece);
      b = Ttt.move(b, i * 3 + 1, piece);
      b = Ttt.move(b, i * 3 + 2, piece);
      strictEqual(Ttt.winner(b), piece, (piece === Ttt.X ? "X" : "O") + " wins, horizontal " + i)

      b = Ttt.newBoard();
      b = Ttt.move(b, i + 0, piece);
      b = Ttt.move(b, i + 3, piece);
      b = Ttt.move(b, i + 6, piece);
      strictEqual(Ttt.winner(b), piece, (piece === Ttt.X ? "X" : "O") + " wins, vertical " + i)
    }

    b = Ttt.newBoard();
    b = Ttt.move(b, 0, piece);
    b = Ttt.move(b, 4, piece);
    b = Ttt.move(b, 8, piece);
    strictEqual(Ttt.winner(b), piece, (piece === Ttt.X ? "X" : "O") + " wins, diagonal 0")

    b = Ttt.newBoard();
    b = Ttt.move(b, 2, piece);
    b = Ttt.move(b, 4, piece);
    b = Ttt.move(b, 6, piece);
    strictEqual(Ttt.winner(b), piece, (piece === Ttt.X ? "X" : "O") + " wins, diagonal 1")
  }

  b = Ttt.newBoard();
  b = Ttt.move(b, 0, Ttt.X);
  b = Ttt.move(b, 1, Ttt.O);
  b = Ttt.move(b, 2, Ttt.X);
  b = Ttt.move(b, 3, Ttt.X);
  b = Ttt.move(b, 4, Ttt.O);
  b = Ttt.move(b, 5, Ttt.O);
  b = Ttt.move(b, 6, Ttt.O);
  b = Ttt.move(b, 7, Ttt.X);
  b = Ttt.move(b, 8, Ttt.X);
  strictEqual(Ttt.winner(b), Ttt.TIE, "cat's game");
});

test("Game logic", function () {
  var g = new Ttt.Game();
  strictEqual(g.board, Ttt.newBoard(), "new Game has new board");
  strictEqual(g.turn, Ttt.X, "X goes first");
  deepEqual(g.history, [], "no history yet");
  g.move(4);
  strictEqual(g.board, Ttt.move(Ttt.newBoard(), 4, Ttt.X), "Game's board correct after one move");
  strictEqual(g.turn, Ttt.O, "O goes second");
  deepEqual(g.history, [Ttt.newBoard()], "history is empty board");
  g.move(0);
  strictEqual(g.turn, Ttt.X, "X goes third");
  deepEqual(g.history, [Ttt.newBoard(), Ttt.move(Ttt.newBoard(), 4, Ttt.X)], "history updated");
  g.undo();
  strictEqual(g.board, Ttt.move(Ttt.newBoard(), 4, Ttt.X), "board undone");
  strictEqual(g.turn, Ttt.O, "turn undone");
  deepEqual(g.history, [Ttt.newBoard()], "history undone");
});

module("Ai");

test("Smart", function () {
  var a = new Ai.Smart();
  var g = new Ttt.Game();
  strictEqual(a.getMove(g), 4, "center first");
  g.move(0);
  g.move(3);
  g.move(1);
  strictEqual(a.getMove(g), 2, "blocks an immediate threat");
  g.move(4);
  strictEqual(a.getMove(g), 2, "goes for a win over blocking");
});

module("Neural");

test("xor", function () {
  var n = new Neural.Net([2, 3, 1]);
  deepEqual(n.getSizes(), [2, 3, 1], "correct sizes");
  n.setWeights([[[1, 0.5, 0], [0, 0.5, 1]], [[1], [-2], [1]], [[1]]]);
  deepEqual(n.run([0, 0]), [0], "0^0 == 0");
  n.reset();
  deepEqual(n.run([0, 1]), [1], "0^1 == 1");
  n.reset();
  deepEqual(n.run([1, 0]), [1], "1^0 == 1");
  n.reset();
  deepEqual(n.run([1, 1]), [0], "1^1 == 0");
});
