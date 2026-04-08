function UpdateNodes(destroyQueue, nodes, nonVisibleNodes, serverVersion) {
    this.destroyQueue = destroyQueue;
    this.nodes = nodes;
    this.nonVisibleNodes = nonVisibleNodes;
    this.serverVersion = serverVersion;
}

module.exports = UpdateNodes;

UpdateNodes.prototype.build = function () {
    var nodesLength = 0;
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (typeof node == "undefined") continue;
        if (this.serverVersion == 1)
            nodesLength = nodesLength + 20 + (node.getName().length * 2);
        else
            nodesLength = nodesLength + 16 + (node.getName().length * 2);
    }

    var buf = new ArrayBuffer(3 + (this.destroyQueue.length * 12) + (this.nonVisibleNodes.length * 4) + nodesLength + 8);
    var view = new DataView(buf);
    view.setUint8(0, 16, true);
    view.setUint16(1, this.destroyQueue.length, true);
    var offset = 3;

    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];
        if (!node) continue;
        var killer = 0;
        if (node.getKiller()) killer = node.getKiller().nodeId;
        view.setUint32(offset, killer, true);
        view.setUint32(offset + 4, node.nodeId, true);
        offset += 8;
    }

    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (typeof node == "undefined") continue;
        if (this.serverVersion == 1) {
            view.setUint32(offset, node.nodeId, true);
            view.setInt32(offset + 4, node.position.x, true);
            view.setInt32(offset + 8, node.position.y, true);
            view.setUint16(offset + 12, node.getSize(), true);
            view.setUint8(offset + 14, node.color.r, true);
            view.setUint8(offset + 15, node.color.g, true);
            view.setUint8(offset + 16, node.color.b, true);
            view.setUint8(offset + 17, node.spiked, true);
            offset += 18;
        } else {
            view.setUint32(offset, node.nodeId, true);
            view.setUint16(offset + 4, node.position.x, true);
            view.setUint16(offset + 6, node.position.y, true);
            view.setUint16(offset + 8, node.getSize(), true);
            view.setUint8(offset + 10, node.color.r, true);
            view.setUint8(offset + 11, node.color.g, true);
            view.setUint8(offset + 12, node.color.b, true);
            view.setUint8(offset + 13, node.spiked, true);
            offset += 14;
        }

        var name = node.getName();
        if (name) {
            for (var j = 0; j < name.length; j++) {
                var c = name.charCodeAt(j);
                if (c) view.setUint16(offset, c, true);
                offset += 2;
            }
        }
        view.setUint16(offset, 0, true);
        offset += 2;
    }

    var len = this.nonVisibleNodes.length + this.destroyQueue.length;
    view.setUint32(offset, 0, true);
    view.setUint32(offset + 4, len, true);
    offset += 8;

    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];
        if (!node) continue;
        view.setUint32(offset, node.nodeId, true);
        offset += 4;
    }
    for (var i = 0; i < this.nonVisibleNodes.length; i++) {
        var node = this.nonVisibleNodes[i];
        if (!node) continue;
        view.setUint32(offset, node.nodeId, true);
        offset += 4;
    }
    return buf;
};

