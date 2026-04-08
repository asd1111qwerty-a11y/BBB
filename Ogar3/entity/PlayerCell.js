var Cell = require('./Cell');

function PlayerCell() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    this.cellType = 0;
    this.recombineTicks = 0; // Ticks until the cell can recombine with other cells 
    this.ignoreCollision = false;// This is used by player cells so that they dont cause any problems when splitting
    this.restoreCollisionTicks = 0;
}

module.exports = PlayerCell;
PlayerCell.prototype = new Cell();

// Main Functions

PlayerCell.prototype.visibleCheck = function (box, centerPos) {
    // Use old fashioned checking method if cell is small
    if (this.mass < 100) {
        return this.collisionCheck(box.bottomY, box.topY, box.rightX, box.leftX);
    }

    // Checks if this cell is visible to the player
    var cellSize = this.getSize();
    var lenX = cellSize + box.width >> 0; // Width of cell + width of the box (Int)
    var lenY = cellSize + box.height >> 0; // Height of cell + height of the box (Int)

    return (this.abs(this.position.x - centerPos.x) < lenX) && (this.abs(this.position.y - centerPos.y) < lenY);
};


PlayerCell.prototype.calcMergeTime = function (base, same) {
    if (same) {
        this.recombineTicks = base;
    } else {
        this.recombineTicks = base + ((0.02 * this.mass) >> 0); // Int (30 sec + (.02 * mass))
    }
};

// Movement


// Override


PlayerCell.prototype.onConsume = function (consumer, gameServer) {
    if (!consumer.owner.nofood) {
        consumer.addMass(this.mass);
    }

};

PlayerCell.prototype.onAdd = function (gameServer) {
    // Add to special player node list
    gameServer.nodesPlayer.push(this);
    // Gamemode actions
    gameServer.gameMode.onCellAdd(this);
};

PlayerCell.prototype.onRemove = function (gameServer) {
    var index;
    // Remove from player cell list
    index = this.owner.cells.indexOf(this);
    if (index != -1) {
        this.owner.cells.splice(index, 1);
    }
    // Remove from special player controlled node list
    index = gameServer.nodesPlayer.indexOf(this);
    if (index != -1) {
        gameServer.nodesPlayer.splice(index, 1);
    }
    // Gamemode actions
    gameServer.gameMode.onCellRemove(this);
};



PlayerCell.prototype.moveDone = function (gameServer) {
    this.setCollisionOff(false);
};

// Lib

PlayerCell.prototype.abs = function (x) {
    return x < 0 ? -x : x;
};

PlayerCell.prototype.getDist = function (x1, y1, x2, y2) {
    var xs = x2 - x1;
    xs = xs * xs;

    var ys = y2 - y1;
    ys = ys * ys;

    return Math.sqrt(xs + ys);
};

