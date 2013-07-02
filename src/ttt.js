// Can't use strict mode because I'm using octal literals.  Great.
//"use strict";

var Ttt = (function (Ttt) {
  var X = 1;
  var O = 3;
  var TIE = -1;

  function newBoard() {
    return 0;
  }

  function getPiece(board, square) {
    return ((board >> (square << 1)) & 3);
  }

  function move(board, square, piece) {
    return (board | (piece << (square << 1)));
  }

  function winner(board) {
    if ((board & 0000077) === 0000025) return X;
    if ((board & 0000077) === 0000077) return O;
    if ((board & 0007700) === 0002500) return X;
    if ((board & 0007700) === 0007700) return O;
    if ((board & 0770000) === 0250000) return X;
    if ((board & 0770000) === 0770000) return O;
    if ((board & 0030303) === 0010101) return X;
    if ((board & 0030303) === 0030303) return O;
    if ((board & 0141414) === 0040404) return X;
    if ((board & 0141414) === 0141414) return O;
    if ((board & 0606060) === 0202020) return X;
    if ((board & 0606060) === 0606060) return O;
    if ((board & 0601403) === 0200401) return X;
    if ((board & 0601403) === 0601403) return O;
    if ((board & 0031460) === 0010420) return X;
    if ((board & 0031460) === 0031460) return O;
    if ((board & 0252525) === 0252525) return TIE;
    return 0;
  }

  function Game() {
    this.board = newBoard();
    this.turn = X;
    this.history = [];
  }

  Game.prototype.getPiece = function (square) {
    return getPiece(this.board, square);
  };

  Game.prototype.move = function (square) {
    this.history.push(this.board);
    this.board = move(this.board, square, this.turn);
    this.turn ^= 2;
  };

  Game.prototype.undo = function () {
    this.board = this.history.pop();
    this.turn ^= 2;
  };

  Game.prototype.winner = function () {
    return winner(this.board);
  };

  function drawBoard(ctx) {
    ctx.beginPath();
    ctx.moveTo(0.333, 0.05);
    ctx.lineTo(0.333, 0.95);
    ctx.moveTo(0.666, 0.05);
    ctx.lineTo(0.666, 0.95);
    ctx.moveTo(0.05, 0.333);
    ctx.lineTo(0.95, 0.333);
    ctx.moveTo(0.05, 0.666);
    ctx.lineTo(0.95, 0.666);
    ctx.stroke();
  }

  function drawPiece(ctx, piece) {
    ctx.beginPath();
    if (piece == X) {
      ctx.moveTo(0.1, 0.1);
      ctx.lineTo(0.233, 0.233);
      ctx.moveTo(0.233, 0.1);
      ctx.lineTo(0.1, 0.233);
    } else {
      ctx.arc(0.1665, 0.1665, 0.0665, 0, Math.PI * 2, true);
    }
    ctx.stroke();
  }

  Game.prototype.draw = function (ctx, w, h, x, y, highlightSquare) {
    ctx.save();
    ctx.translate(x || 0, y || 0);
    ctx.scale(w, h);

    ctx.lineWidth = 0.05;
    ctx.lineCap = 'round';

    ctx.clearRect(0, 0, 1, 1);

    ctx.save();
    ctx.strokeStyle = '#222';
    drawBoard(ctx);
    ctx.restore();

    for (var i = 0; i < 9; ++i) {
      ctx.save();
      ctx.translate((i % 3) * 0.333, (i / 3 | 0) * 0.333);

      switch(this.getPiece(i)) {
      case X:
        ctx.strokeStyle = '#822';
        drawPiece(ctx, X);
        break;

      case O:
        ctx.strokeStyle = '#228';
        drawPiece(ctx, O);
        break;

      default:
        if (i === highlightSquare) {
          ctx.strokeStyle = (this.turn === X ? '#ecc' : '#cce');
          drawPiece(ctx, this.turn);
        }
        break;
      }

      ctx.restore();
    }

    ctx.restore();
  };

  Ttt.X = X;
  Ttt.O = O;
  Ttt.TIE = TIE;
  Ttt.Game = Game;

  return Ttt;
}(Ttt || {}));
