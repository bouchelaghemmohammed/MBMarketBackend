const Order = require('../models/Order');
const Product = require('../models/Product');

exports.getOrders = async (req, res) => {
  try {
    let orders;
    if (req.user.role === 'admin') {
      orders = await Order.find({})
        .populate('userId', 'username email')
        .populate({ path: 'products.productId', populate: { path: 'sellerId', select: 'username email _id' } });
    } else {
      orders = await Order.find({ userId: req.user.id })
        .populate('userId', 'username email')
        .populate({ path: 'products.productId', populate: { path: 'sellerId', select: 'username email _id' } });
    }
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('userId', 'username email').populate('products.productId');
    
    if (order) {
      if (order.userId._id.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(401).json({ message: 'Not authorized to view this order' });
      }
      res.json(order);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { products, totalAmount } = req.body;

    if (products && products.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    } else {
      const order = new Order({
        userId: req.user.id,
        products,
        totalAmount
      });

      const createdOrder = await order.save();
      
      // Update stock and notify sellers
      for (const item of products) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock = Math.max(0, product.stock - item.quantity);
          await product.save();
          req.io.emit('product:updated', product);
          req.io.emit(`notification:${product.sellerId}`, { type: 'order', message: `Someone just bought ${item.quantity}x of your product: ${product.name}!` });
        }
      }

      // Real-time event: order:created
      req.io.emit('order:created', createdOrder);
      req.io.emit(`notification:${req.user.id}`, { type: 'order', message: `Your order #${createdOrder._id.toString().substring(0, 8)} was placed successfully!` });

      res.status(201).json(createdOrder);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({ path: 'products.productId', select: 'sellerId name' });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const { status } = req.body;
    const userId = req.user.id;

    const isBuyer  = order.userId.toString() === userId;
    const isSeller = order.products.some(
      item => item.productId && item.productId.sellerId && item.productId.sellerId.toString() === userId
    );
    const isAdmin  = req.user.role === 'admin';

    // Transition rules
    const sellerTransitions = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };
    const buyerTransitions  = { delivered: 'received' };

    if (isAdmin) {
      order.status = status;
    } else if (isSeller && sellerTransitions[order.status] === status) {
      order.status = status;
    } else if (isBuyer && buyerTransitions[order.status] === status) {
      order.status = status;
    } else {
      return res.status(403).json({ message: 'Not authorized to perform this status update' });
    }

    const updatedOrder = await order.save();

    // Broadcast to all connected clients (buyer + seller both refresh their views)
    req.io.emit('order:statusUpdated', { _id: updatedOrder._id, status: updatedOrder.status });

    // Notify buyer
    const buyerId = order.userId.toString();
    req.io.emit(`notification:${buyerId}`, {
      type: 'order',
      message: `Order #${updatedOrder._id.toString().slice(-8)} is now ${updatedOrder.status}`
    });

    // Notify every unique seller in this order (if it wasn't the seller who acted)
    const sellerIds = [...new Set(
      order.products
        .filter(item => item.productId?.sellerId)
        .map(item => item.productId.sellerId.toString())
    )];
    sellerIds.forEach(sid => {
      if (sid !== userId) {
        req.io.emit(`notification:${sid}`, {
          type: 'order',
          message: `Order #${updatedOrder._id.toString().slice(-8)} is now ${updatedOrder.status}`
        });
      }
    });

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSellerOrders = async (req, res) => {
  try {
    const sellerProducts = await Product.find({ sellerId: req.user.id }).select('_id');
    const sellerProductIds = sellerProducts.map(p => p._id);

    const orders = await Order.find({ 'products.productId': { $in: sellerProductIds } })
      .populate('userId', 'username email')
      .populate({ path: 'products.productId', populate: { path: 'sellerId', select: 'username email _id' } })
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      if (req.user.role !== 'admin') {
        return res.status(401).json({ message: 'Not authorized' });
      }

      await Order.deleteOne({ _id: order._id });
      res.json({ message: 'Order removed' });
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
