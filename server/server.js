const express = require("express");
const cors = require("cors");
const menu = require("./menu");
const { PERSONAL_RULE_DIGIT, validateAndPriceOrder } = require("./rules");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const orders = [];
let nextOrderNumber = 1001;

const VALID_STATUSES = ["new", "preparing", "ready", "delivered"];
const ALLOWED_TRANSITIONS = {
  new: ["preparing"],
  preparing: ["ready"],
  ready: ["delivered"],
  delivered: []
};

function findOrder(id) {
  return orders.find((order) => order.id === id);
}

app.get("/", (req, res) => {
  res.json({
    message: "Pizza Ordering API is running",
    endpoints: [
      "GET /api/menu",
      "POST /api/orders",
      "GET /api/orders/:id",
      "GET /api/orders?status=<status>",
      "PATCH /api/orders/:id/status"
    ],
    activePersonalRuleDigit: PERSONAL_RULE_DIGIT
  });
});

app.get("/api/menu", (req, res) => {
  res.status(200).json(menu);
});

app.post("/api/orders", (req, res) => {
  const result = validateAndPriceOrder(req.body);
  if (!result.valid) return res.status(400).json({ message: "Invalid order", errors: result.errors });

  const id = String(nextOrderNumber++);
  const order = {
    id,
    customerName: req.body.customerName.trim(),
    phone: req.body.phone.trim(),
    deliveryAddress: req.body.deliveryAddress.trim(),
    pizzas: result.priceDetails.pizzas,
    subtotal: result.priceDetails.subtotal,
    discount: result.priceDetails.discount,
    deliveryFee: result.priceDetails.deliveryFee,
    totalPrice: result.priceDetails.totalPrice,
    status: "new",
    paymentStatus: "paid",
    createdAt: new Date().toISOString()
  };

  orders.push(order);
  return res.status(201).json(order);
});

app.get("/api/orders", (req, res) => {
  const { status } = req.query;
  if (!status) return res.status(200).json(orders);
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status filter", validStatuses: VALID_STATUSES });
  }
  return res.status(200).json(orders.filter((order) => order.status === status));
});

app.get("/api/orders/:id", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  return res.status(200).json(order);
});

app.patch("/api/orders/:id/status", (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status", validStatuses: VALID_STATUSES });
  }

  if (!ALLOWED_TRANSITIONS[order.status].includes(status)) {
    return res.status(409).json({ message: `Illegal status transition from ${order.status} to ${status}` });
  }

  order.status = status;
  return res.status(200).json(order);
});

app.listen(PORT, () => {
  console.log(`Pizza Ordering API running on port ${PORT}`);
  console.log(`Active personal rule digit: ${PERSONAL_RULE_DIGIT}`);
});
