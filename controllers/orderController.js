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
    const order = await Order.findById(req.params.id);

    if (order) {
      if (req.user.role !== 'admin') {
        return res.status(401).json({ message: 'Not authorized' });
      }

      order.status = req.body.status || order.status;
      const updatedOrder = await order.save();

      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
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
