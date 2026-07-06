import React, { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function emptySelection() {
  return { pizzaId: "margherita", size: "small", toppings: [] };
}

function money(value) {
  return `₪${Number(value || 0).toFixed(2)}`;
}

function App() {
  const [menu, setMenu] = useState({ pizzas: [], sizes: [], toppings: [] });
  const [selection, setSelection] = useState(emptySelection());
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ customerName: "", phone: "", deliveryAddress: "" });
  const [confirmation, setConfirmation] = useState(null);
  const [trackId, setTrackId] = useState("");
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [employeeOrders, setEmployeeOrders] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadMenu();
    refreshStaffScreens();
  }, []);

  async function loadMenu() {
    try {
      const response = await fetch(`${API_URL}/api/menu`);
      const data = await response.json();
      setMenu(data);
    } catch (error) {
      setMessage("Could not load menu. Make sure the server is running.");
    }
  }

  async function refreshStaffScreens() {
    try {
      const [newOrdersResponse, preparingOrdersResponse, readyOrdersResponse] = await Promise.all([
        fetch(`${API_URL}/api/orders?status=new`),
        fetch(`${API_URL}/api/orders?status=preparing`),
        fetch(`${API_URL}/api/orders?status=ready`)
      ]);
      const newOrders = await newOrdersResponse.json();
      const preparingOrders = await preparingOrdersResponse.json();
      const readyOrders = await readyOrdersResponse.json();
      setEmployeeOrders([...newOrders, ...preparingOrders]);
      setDeliveryOrders(readyOrders);
    } catch (error) {
      setMessage("Could not refresh orders. Make sure the server is running.");
    }
  }

  function findPizza(id) {
    return menu.pizzas.find((pizza) => pizza.id === id);
  }
  function findSize(id) {
    return menu.sizes.find((size) => size.id === id);
  }
  function findTopping(id) {
    return menu.toppings.find((topping) => topping.id === id);
  }

  function calculateEstimatedTotal() {
    return cart.reduce((sum, item) => {
      const pizza = findPizza(item.pizzaId);
      const size = findSize(item.size);
      const toppingsTotal = item.toppings.reduce((toppingSum, toppingId) => {
        const topping = findTopping(toppingId);
        return toppingSum + (topping ? topping.price : 0);
      }, 0);
      return sum + (pizza ? pizza.price : 0) + (size ? size.price : 0) + toppingsTotal;
    }, 0);
  }

  const estimatedTotal = useMemo(calculateEstimatedTotal, [cart, menu]);

  function toggleTopping(toppingId) {
    setSelection((current) => {
      if (current.toppings.includes(toppingId)) {
        return { ...current, toppings: current.toppings.filter((id) => id !== toppingId) };
      }
      return { ...current, toppings: [...current.toppings, toppingId] };
    });
  }

  function addToCart() {
    setMessage("");
    if (selection.toppings.length > 3) {
      setMessage("Each pizza can have up to 3 toppings.");
      return;
    }
    setCart((currentCart) => [...currentCart, selection]);
    setSelection(emptySelection());
  }

  function removeFromCart(indexToRemove) {
    setCart((currentCart) => currentCart.filter((_, index) => index !== indexToRemove));
  }

  async function checkout() {
    setMessage("");
    setConfirmation(null);
    if (cart.length === 0) {
      setMessage("Please add at least one pizza to the cart.");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customer.customerName,
          phone: customer.phone,
          deliveryAddress: customer.deliveryAddress,
          pizzas: cart
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.errors ? data.errors.join(", ") : data.message);
        return;
      }
      setConfirmation(data);
      setCart([]);
      setCustomer({ customerName: "", phone: "", deliveryAddress: "" });
      await refreshStaffScreens();
    } catch (error) {
      setMessage("Could not create order. Make sure the server is running.");
    }
  }

  async function trackOrder() {
    setMessage("");
    setTrackedOrder(null);
    if (!trackId.trim()) {
      setMessage("Please enter an order number.");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/orders/${trackId.trim()}`);
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message);
        return;
      }
      setTrackedOrder(data);
    } catch (error) {
      setMessage("Could not track order. Make sure the server is running.");
    }
  }

  async function updateOrderStatus(orderId, nextStatus) {
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message);
        return;
      }
      await refreshStaffScreens();
    } catch (error) {
      setMessage("Could not update order status. Make sure the server is running.");
    }
  }

  function renderCartItem(item, index) {
    const pizza = findPizza(item.pizzaId);
    const size = findSize(item.size);
    const toppings = item.toppings.map(findTopping).filter(Boolean);
    const itemPrice =
      (pizza ? pizza.price : 0) +
      (size ? size.price : 0) +
      toppings.reduce((sum, topping) => sum + topping.price, 0);
    return (
      <li key={`${item.pizzaId}-${item.size}-${index}`}>
        <strong>{pizza?.name}</strong> - {size?.name}
        {toppings.length > 0 && <span> | Toppings: {toppings.map((topping) => topping.name).join(", ")}</span>}
        <span> | {money(itemPrice)}</span>
        <button onClick={() => removeFromCart(index)}>Remove</button>
      </li>
    );
  }

  function renderOrderItems(order) {
    return (
      <ul>
        {order.pizzas.map((pizza, index) => (
          <li key={`${order.id}-${index}`}>
            {pizza.pizzaName} ({pizza.sizeName})
            {pizza.toppings.length > 0 && ` - ${pizza.toppings.map((topping) => topping.name).join(", ")}`}
            {" - "}
            {money(pizza.itemTotal)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="app">
      <h1>Pizza Restaurant Ordering System</h1>
      {message && <div className="message">{message}</div>}

      <section className="panel">
        <h2>Customer Screen</h2>
        <div data-testid="menu-list">
          <h3>Menu</h3>
          <div className="menu-grid">
            {menu.pizzas.map((pizza) => (
              <div className="menu-card" key={pizza.id}>
                <strong>{pizza.name}</strong>
                <span>{money(pizza.price)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <label>
            Pizza
            <select value={selection.pizzaId} onChange={(event) => setSelection({ ...selection, pizzaId: event.target.value })}>
              {menu.pizzas.map((pizza) => (
                <option key={pizza.id} value={pizza.id}>{pizza.name} - {money(pizza.price)}</option>
              ))}
            </select>
          </label>
          <label>
            Size
            <select value={selection.size} onChange={(event) => setSelection({ ...selection, size: event.target.value })}>
              {menu.sizes.map((size) => (
                <option key={size.id} value={size.id}>{size.name} + {money(size.price)}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend>Toppings</legend>
          {menu.toppings.map((topping) => (
            <label className="checkbox-label" key={topping.id}>
              <input type="checkbox" checked={selection.toppings.includes(topping.id)} onChange={() => toggleTopping(topping.id)} />
              {topping.name} + {money(topping.price)}
            </label>
          ))}
        </fieldset>

        <button onClick={addToCart}>Add Pizza to Cart</button>

        <div data-testid="cart" className="cart">
          <h3>Cart</h3>
          {cart.length === 0 ? <p>No pizzas in cart.</p> : <ul>{cart.map(renderCartItem)}</ul>}
        </div>

        <div data-testid="order-summary-panel" className="summary">
          <h3>Order Summary</h3>
          <p>Estimated total: {money(estimatedTotal)}</p>
          <p className="small-note">Final price is calculated again by the server after checkout.</p>
        </div>

        <div className="form-grid">
          <label>Customer Name<input value={customer.customerName} onChange={(event) => setCustomer({ ...customer, customerName: event.target.value })} /></label>
          <label>Phone<input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
          <label>Delivery Address<input value={customer.deliveryAddress} onChange={(event) => setCustomer({ ...customer, deliveryAddress: event.target.value })} /></label>
        </div>

        <button data-testid="checkout-button" onClick={checkout}>Mock Pay and Place Order</button>

        {confirmation && (
          <div data-testid="order-confirmation" className="confirmation">
            <h3>Order Confirmed</h3>
            <p>Order number: {confirmation.id}</p>
            <p>Status: {confirmation.status}</p>
            <p>Payment status: {confirmation.paymentStatus}</p>
            <p>Total price from server: {money(confirmation.totalPrice)}</p>
          </div>
        )}

        <div className="track-box">
          <h3>Track Order Status</h3>
          <input placeholder="Enter order number" value={trackId} onChange={(event) => setTrackId(event.target.value)} />
          <button onClick={trackOrder}>Track</button>
          {trackedOrder && <p>Order {trackedOrder.id} status: <strong>{trackedOrder.status}</strong></p>}
        </div>
      </section>

      <section className="panel">
        <h2>Restaurant Employee Screen</h2>
        <button onClick={refreshStaffScreens}>Refresh Orders</button>
        <div data-testid="employee-orders">
          {employeeOrders.length === 0 ? <p>No active orders.</p> : employeeOrders.map((order) => (
            <div className="order-card" key={order.id}>
              <h3>Order #{order.id}</h3>
              <p>Customer: {order.customerName}</p>
              <p>Status: {order.status}</p>
              <p>Total: {money(order.totalPrice)}</p>
              {renderOrderItems(order)}
              {order.status === "new" && <button onClick={() => updateOrderStatus(order.id, "preparing")}>Update to Preparing</button>}
              {order.status === "preparing" && <button onClick={() => updateOrderStatus(order.id, "ready")}>Update to Ready</button>}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Courier Screen</h2>
        <button onClick={refreshStaffScreens}>Refresh Ready Orders</button>
        <div data-testid="delivery-orders">
          {deliveryOrders.length === 0 ? <p>No orders ready for delivery.</p> : deliveryOrders.map((order) => (
            <div className="order-card" key={order.id}>
              <h3>Order #{order.id}</h3>
              <p>Customer: {order.customerName}</p>
              <p>Phone: {order.phone}</p>
              <p>Address: {order.deliveryAddress}</p>
              <button onClick={() => updateOrderStatus(order.id, "delivered")}>Mark as Delivered</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
