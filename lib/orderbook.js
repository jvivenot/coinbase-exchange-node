var RBTree = require('bintrees').RBTree;
var assert = require('assert');
var _ = {assign: require('lodash.assign')}

var Orderbook = function() {
  var self = this;

  // Orders hashed by ID
  self._ordersByID = {};

  self._bids = new RBTree(function(a, b) {
    return Math.round(a.price*100) - Math.round(b.price*100);
  });

  self._asks = new RBTree(function(a, b) {
    return Math.round(a.price*100) - Math.round(b.price*100);
  });
};

_.assign(Orderbook.prototype, new function() {
  var prototype = this;

  prototype._getTree = function(side) {
    return side == 'buy' ? this._bids : this._asks;
  };

  prototype.state = function(book) {
    var self = this;

    if (book) {

      book.bids.forEach(function(order) {
        order = {
          id: order[2],
          side: 'buy',
          price: parseFloat(order[0]),
          size: parseFloat(order[1])
        }
        self.add(order);
      });

      book.asks.forEach(function(order) {
        order = {
          id: order[2],
          side: 'sell',
          price: parseFloat(order[0]),
          size: parseFloat(order[1])
        }
        self.add(order);
      });

    } else {

      book = {
        asks: [],
        bids: []
      };

      self._bids.reach(function(bid) {
        bid.orders.forEach(function(order) {
          book.bids.push(order);
        });
      });

      self._asks.each(function(ask) {
        ask.orders.forEach(function(order) {
          book.asks.push(order);
        });
      });

      return book;
    }
  };

  prototype.getDepth = function(maxdepth) {
    var self = this;
    maxdepth = maxdepth || 0;
    book = {
      asks: [],
      bids: []
    };

    var curdepth = 0;
    var it = self._bids.iterator();
    var bid;
    while((bid = it.prev()) !== null) {
      if (maxdepth && curdepth >= maxdepth)
        break;
      size = bid.orders.reduce(function(s,o) {
          return s + o.size;
      }, 0);
      book.bids.push([bid.price, size]);
      curdepth++;
    }

    curdepth = 0;
    var it = self._asks.iterator();
    var ask;
    while((ask = it.next()) !== null) {
      if (maxdepth && curdepth >= maxdepth)
        break;
      size = ask.orders.reduce(function(s,o) {
          return s + o.size;
      }, 0);
      book.asks.push([ask.price, size]);
      curdepth++;
    }

    return book;
  };

  prototype.get = function(orderId) {
    return this._ordersByID[orderId]
  };

  prototype.add = function(order) {
    var self = this;

    order = {
      id: order.order_id || order.id,
      side: order.side,
      price: parseFloat(order.price),
      size: parseFloat(order.size || order.remaining_size),
    };

    var tree = self._getTree(order.side);
    var node = tree.find({price: order.price});

    if (!node) {
      node = {
        price: order.price,
        orders: []
      }
      tree.insert(node);
    }

    node.orders.push(order);
    self._ordersByID[order.id] = order;
  };

  prototype.remove = function(orderId) {
    var self = this;
    var order = self.get(orderId);

    if (!order) {
      return;
    }

    var tree = self._getTree(order.side);
    var node = tree.find({price: order.price});
    assert(node);
    var orders = node.orders;

    orders.splice(orders.indexOf(order), 1);

    if (orders.length === 0) {
      tree.remove(node);
    }

    delete self._ordersByID[order.id];
  };

  prototype.match = function(match) {
    var self = this;

    var size = parseFloat(match.size);
    var price = parseFloat(match.price);
    var tree = self._getTree(match.side);
    var node = tree.find({price: price});
    assert(node);

    var order = node.orders[0];
    assert.equal(order.id, match.maker_order_id);

    order.size = order.size - size;
    self._ordersByID[order.id] = order;

    if (order.size <= 0) {
      self.remove(order.id);
    }
  };

  prototype.change = function(change) {
    var self = this;

    var size = parseFloat(change.new_size);
    var price = parseFloat(change.price);
    var order = self.get(change.order_id);
    if (order) {
        var tree = self._getTree(change.side);
        var node = tree.find({price: price});
        assert(node);
        var nodeOrder = node.orders[node.orders.indexOf(order)];
        assert.equal(order.size, change.old_size);

        nodeOrder.size = size;
        self._ordersByID[nodeOrder.id] = nodeOrder;
    }
  };

});


module.exports = exports = Orderbook;
