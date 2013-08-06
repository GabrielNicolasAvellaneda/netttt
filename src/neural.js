"use strict";

var Neural = (function (Neural) {
    function getSizes(nodes) {
        var sizes = new Array(nodes.length);
        for (var i = 0; i < nodes.length; ++i) {
            sizes[i] = nodes[i].length;
        }
        return sizes;
    }

    function Net(sizesOrNodes) {
        var sizes, nodes;
        if (Array.isArray(sizesOrNodes) && Array.isArray(sizesOrNodes[0])) {
            sizes = getSizes(sizesOrNodes);
            nodes = sizesOrNodes;
        }
        else {
            sizes = sizesOrNodes;
        }

        this.nodes = new Array(sizes.length);
        for (var i = 0; i < sizes.length; ++i) {
            this.nodes[i] = new Array(sizes[i]);
            for (var j = 0; j < sizes[i]; ++j) {
                this.nodes[i][j] = {
                    input: 0,
                    threshold: (typeof(nodes) === 'undefined' ? 1 : nodes[i][j].threshold),
                    weights: new Array(i < sizes.length - 1 ? sizes[i + 1] : 1)
                };
                if (typeof(nodes) !== 'undefined') {
                    for (var k = 0; k < this.nodes[i][j].weights.length; ++k) {
                        this.nodes[i][j].weights[k] = nodes[i][j].weights[k];
                    }
                }
            }
        }
    }

    Net.prototype.eachNode = function Net_eachNode(f) {
        for (var layer = 0; layer < this.nodes.length; ++layer) {
            for (var index = 0; index < this.nodes[layer].length; ++index) {
                f(this.nodes[layer][index], layer, index);
            }
        }
    };

    Net.prototype.getSizes = function Net_getSizes() {
        return getSizes(this.nodes);
    };

    Net.prototype.getThresholds = function Net_getThresholds() {
        var thresholds = new Array(this.nodes.length);
        var that = this;
        this.eachNode(function (n, layer, index) {
            if (typeof(thresholds[layer]) === 'undefined') {
                thresholds[layer] = new Array(that.nodes[layer].length);
            }
            thresholds[layer][index] = n.threshold;
        });
        return thresholds;
    };

    Net.prototype.getWeights = function Net_getWeights() {
        var weights = new Array(this.nodes.length);
        var that = this;
        this.eachNode(function (n, layer, index) {
            if (typeof(weights[layer]) === 'undefined') {
                weights[layer] = new Array(that.nodes[layer].length);
            }
            weights[layer][index] = new Array(n.weights.length);
            for (var i = 0; i < n.weights.length; ++i) {
                weights[layer][index][i] = n.weights[i];
            }
        });
        return weights;
    };

    Net.prototype.setThresholds = function Net_setThresholds(thresholds) {
        this.eachNode(function (n, layer, index) {
            n.threshold = thresholds[layer][index];
        });
    };

    Net.prototype.setWeights = function Net_setWeights(weights) {
        this.eachNode(function (n, layer, index) {
            for (var i = 0; i < n.weights.length; ++i) {
                n.weights[i] = weights[layer][index][i];
            }
        });
    };

    Net.prototype.reset = function Net_reset() {
        this.eachNode(function (n, layer, index) {
            n.input = 0;
        });
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

        var that = this;
        this.eachNode(function (n, layer, index) {
            if (layer < that.nodes.length - 1 && n.input >= n.threshold) {
                for (var i = 0; i < n.weights.length; ++i) {
                    that.nodes[layer + 1][i].input += n.weights[i];
                }
            }
        });

        return this.getOutputs();
    };

    Net.prototype.getOutputs = function Net_getOutputs() {
        var layer = this.nodes.length - 1;
        var outputs = new Array(this.nodes[layer].length);
        for (var i = 0; i < this.nodes[layer].length; ++i) {
            outputs[i] = (
                this.nodes[layer][i].input >= this.nodes[layer][i].threshold
                ? this.nodes[layer][i].weights[0]
                : 0
            );
        }
        return outputs;
    };

    Net.prototype.clone = function Net_clone() {
        return new Net(this.nodes);
    };

    Net.prototype.export = function Net_export() {
        return {
            thresholds: this.getThresholds(),
            weights: this.getWeights()
        };
    };

    Net.import = function Net_import(exp) { // "static"
        var n = new Net(getSizes(exp.thresholds));
        n.setThresholds(exp.thresholds);
        n.setWeights(exp.weights);
        return n;
    };

    // TODO: some way to mutate a net's dimensions.

    Neural.Net = Net;

    return Neural;
}(Neural || {}));
