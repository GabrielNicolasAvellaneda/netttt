"use strict";

var Neural = (function (Neural) {
    function Net(sizes) {
        this.nodes = new Array(sizes.length);
        for (var i = 0; i < sizes.length; ++i) {
            this.nodes[i] = new Array(sizes[i]);
            for (var j = 0; j < sizes[i]; ++j) {
                this.nodes[i][j] = {
                    input: 0,
                    threshold: 1,
                    weights: new Array(i < sizes.length - 1 ? sizes[i + 1] : 1)
                };
            }
        }
    }

    Net.prototype.getSizes = function Net_getSizes() {
        var sizes = new Array(this.nodes.length);
        for (var i = 0; i < this.nodes.length; ++i) {
            sizes[i] = this.nodes[i].length;
        }
        return sizes;
    };

    Net.prototype.setThresholds = function Net_setThresholds(thresholds) {
        for (var i = 0; i < this.nodes.length; ++i) {
            for (var j = 0; j < this.nodes[i].length; ++j) {
                this.nodes[i][j].threshold = thresholds[i][j];
            }
        }
    };

    Net.prototype.setWeights = function Net_setWeights(weights) {
        for (var i = 0; i < this.nodes.length; ++i) {
            for (var j = 0; j < this.nodes[i].length; ++j) {
                for (var k = 0; k < this.nodes[i][j].weights.length; ++k) {
                    this.nodes[i][j].weights[k] = weights[i][j][k];
                }
            }
        }
    };

    Net.prototype.reset = function Net_reset() {
        for (var i = 0; i < this.nodes.length; ++i) {
            for (var j = 0; j < this.nodes[i].length; ++j) {
                this.nodes[i][j].input = 0;
            }
        }
    };

    Net.prototype.setInputs = function Net_setInputs(inputs) {
        for (var i = 0; i < this.nodes[0].length; ++i) {
            this.nodes[0][i].input = inputs[i];
        }
    };

    Net.prototype.run = function Net_run(inputs) {
        if (typeof inputs !== 'undefined') {
            this.setInputs(inputs);
        }

        for (var i = 0; i < this.nodes.length - 1; ++i) {
            for (var j = 0; j < this.nodes[i].length; ++j) {
                if (this.nodes[i][j].input >= this.nodes[i][j].threshold) {
                    for (var k = 0; k < this.nodes[i][j].weights.length; ++k) {
                        this.nodes[i + 1][k].input += this.nodes[i][j].weights[k];
                    }
                }
            }
        }

        return this.getOutputs();
    };

    Net.prototype.getOutputs = function Net_getOutputs() {
        var col = this.nodes.length - 1;
        var outputs = new Array(this.nodes[col].length);
        for (var i = 0; i < this.nodes[col].length; ++i) {
            outputs[i] = (
                this.nodes[col][i].input >= this.nodes[col][i].threshold
                ? this.nodes[col][i].weights[0]
                : 0
            );
        }
        return outputs;
    };

    Neural.Net = Net;

    return Neural;
}(Neural || {}));
