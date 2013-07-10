"use strict";

var Neural = (function (Neural) {
  function Net(sizes) {
    this.nodes = new Array(sizes.length);
    for (var i = 0; i < sizes.length; ++i)
      this.nodes[i] = new Array(sizes[i]);
    this.weights = new Array(sizes.length - 1);
    for (i = 0; i < sizes.length - 1; ++i)
      this.weights[i] = new Array(sizes[i] * sizes[i + 1]);
  }

  Net.prototype.reset = function () {
    for (var i = 0; i < this.nodes.length; ++i) {
      for (var j = 0; j < this.nodes[i].length; ++j)
        this.nodes[i][j] = 0;
    }
  };

  Net.prototype.setWeights = function (weights) {
    for (var i = 0; i < this.weights.length; ++i) {
      for (var j = 0; j < this.weights[i].length; ++j)
        this.weights[i][j] = weights[i][j];
    }
  };

  Net.prototype.setInputs = function (inputs) {
    for (var i = 0; i < this.nodes[0].length; ++i)
      this.nodes[0][i] = inputs[i];
  };

  Net.prototype.run = function () {
    for (var i = 0; i < this.nodes.length - 1; ++i) {
      for (var j = 0; j < this.nodes[i + 1].length; ++j) {
        var sum = 0;
        for (var k = 0; k < this.nodes[i].length; ++k) {
          if (this.nodes[i][k] >= 1)
            sum += this.nodes[i][k] * this.weights[i][j * this.nodes[i].length + k];
        }
        this.nodes[i + 1][j] = sum;
      }
    }
  };

  Net.prototype.getOutputs = function () {
    return this.nodes[this.nodes.length - 1];
  };

  Neural.Net = Net;

  return Neural;
}(Neural || {}));
