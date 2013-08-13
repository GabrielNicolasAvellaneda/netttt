var Neural = (function (Neural) {
    "use strict";

    function getSizes(nodes) {
        return nodes.map(function (layer) {
            return layer.length;
        });
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

        this.nodes = sizes.map(function (size, i) {
            var layer = new Array(size);
            for (var j = 0; j < size; ++j) {
                layer[j] = {
                    input: 0,
                    threshold: (typeof nodes === 'undefined'
                        ? 1
                        : nodes[i][j].threshold
                    ),
                    weights: (typeof nodes === 'undefined'
                        ? new Array(i < sizes.length - 1 ? sizes[i + 1] : 1)
                        : nodes[i][j].weights.map(function (w) { return w; })
                    )
                };
            }
            return layer;
        });
    }

    Net.prototype.eachNode = function Net_eachNode(callback) {
        for (var layerIndex = 0; layerIndex < this.nodes.length; ++layerIndex
        ) {
            for (var index = 0; index < this.nodes[layerIndex].length; ++index
            ) {
                callback(
                    this.nodes[layerIndex][index],
                    layerIndex,
                    index,
                    this.nodes
                );
            }
        }
    };

    Net.prototype.getSizes = function Net_getSizes() {
        return getSizes(this.nodes);
    };

    Net.prototype.getThresholds = function Net_getThresholds() {
        return this.nodes.map(function (layer, layerIndex) {
            return layer.map(function (node) {
                return node.threshold;
            });
        });
    };

    Net.prototype.getWeights = function Net_getWeights() {
        return this.nodes.map(function (layer, layerIndex) {
            return layer.map(function (node) {
                return node.weights.map(function (w) {
                    return w;
                });
            });
        });
    };

    Net.prototype.setThresholds = function Net_setThresholds(thresholds) {
        this.eachNode(function (node, layerIndex, index) {
            node.threshold = thresholds[layerIndex][index];
        });
    };

    Net.prototype.setWeights = function Net_setWeights(weights) {
        this.eachNode(function (node, layerIndex, index) {
            node.weights = weights[layerIndex][index].map(function (w) {
                return w;
            });
        });
    };

    Net.prototype.reset = function Net_reset() {
        this.eachNode(function (node) {
            node.input = 0;
        });
    };

    Net.prototype.setInputs = function Net_setInputs(inputs) {
        this.nodes[0].forEach(function (node, index) {
            node.input = inputs[index];
        });
    };

    Net.prototype.run = function Net_run(inputs) {
        if (typeof inputs !== 'undefined') {
            this.setInputs(inputs);
        }

        this.eachNode(function (node, layerIndex, index, nodes) {
            if (layerIndex < nodes.length - 1 && node.input >= node.threshold
            ) {
                for (var i = 0; i < node.weights.length; ++i) {
                    nodes[layerIndex + 1][i].input += node.weights[i];
                }
            }
        });

        return this.getOutputs();
    };

    Net.prototype.getOutputs = function Net_getOutputs() {
        return this.nodes[this.nodes.length - 1].map(function (node, index) {
            return (node.input >= node.threshold ? node.weights[0] : 0);
        });
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

    Net.import = function Net_import(obj) { // "static"
        if (!Array.isArray(obj.thresholds) || !Array.isArray(obj.weights)) {
            throw new Error(
                "Neural.Net.import() needs an object with Array properties "
                + "thresholds and weights"
            );
        }

        var net = new Net(getSizes(obj.thresholds));
        net.setThresholds(obj.thresholds);
        net.setWeights(obj.weights);
        return net;
    };

    // TODO: some way to mutate a net's dimensions.

    Neural.Net = Net;

    return Neural;
}(Neural || {}));
