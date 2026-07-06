import React, { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const ROLE_LABELS = {
  customer: "Client",
  employee: "Restaurant Employee",
  courier: "Courier"
};

function emptySelection() {
  return { pizzaId: "margherita", size: "small", toppings: [] };
}

function money(value) {
  return `₪${Number(value || 0).toFixed(2)}`;
}

function App() {
  const [activeRole, setActiveRole] = useState(null);
  const [menu, setMenu] = useState({ pizzas: [], sizes: [], toppings: [], drinks: [] });
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
  }, []);

  useEffect(() => {
    if (activeRole === "employee" || activeRole === "courier") {
      refreshStaffScreens();
    }
  }, [activeRole]);

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
      setMessage("");
    } catch (error) {
      setMessage("Could not refresh orders. Make sure the server is running.");
    }
  }

  function chooseRole(role) {
    setActiveRole(role);
    setMessage("");
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

  function findDrink(id) {
    return menu.drinks.find((drink) => drink.id === id);
  }

  function calculateEstimatedTotal() {
    return cart.reduce((sum, item) => {
      if (item.type === "drink") {
        const drink = findDrink(item.drinkId);
        return sum + (drink ? drink.price : 0);
      }

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
    setCart((currentCart) => [...currentCart, { ...selection, type: "pizza" }]);
    setSelection(emptySelection());
  }

  function addDrinkToCart(drinkId) {
    setMessage("");
    setCart((currentCart) => [...currentCart, { type: "drink", drinkId }]);
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
            .filter((item) => item.type === "pizza")
            .map(({ pizzaId, size, toppings }) => ({ pizzaId, size, toppings })),
          drinks: cart.filter((item) => item.type === "drink").map((item) => item.drinkId)
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
        setMessage(data.message || "The server rejected the status update.");
        return;
      }
      setMessage("");
      await refreshStaffScreens();
    } catch (error) {
      setMessage("Could not update order status. Make sure the server is running.");
    }
  }

  function renderCartItem(item, index) {
    if (item.type === "drink") {
      const drink = findDrink(item.drinkId);
      return (
        <li key={`${item.drinkId}-${index}`}>
          <strong>{drink?.name}</strong>
          <span> | {money(drink?.price)}</span>
          <button onClick={() => removeFromCart(index)}>Remove</button>
        </li>
      );
    }

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
        {order.drinks?.map((drink, index) => (
          <li key={`${order.id}-drink-${index}`}>
            {drink.name} - {money(drink.price)}
          </li>
        ))}
      </ul>
    );
  }

  function renderLanding() {
    return (
      <section className="landing">
        <h1>Pizza Restaurant Ordering System</h1>
        <p>What kind of user are you?</p>
        <div className="role-grid">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <button className="role-card" key={role} onClick={() => chooseRole(role)}>
              {label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  function renderNav() {
    if (!activeRole) return null;
    return (
      <header className="topbar">
        <h1>Pizza Restaurant Ordering System</h1>
        <nav aria-label="User pages">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <button
              className={activeRole === role ? "nav-button active" : "nav-button"}
              key={role}
              onClick={() => chooseRole(role)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
    );
  }

  function renderCustomerPage() {
    return (
      <section className="panel">
        <h2>Client Page</h2>
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
          <h3>Drinks</h3>
          <div className="menu-grid">
            {menu.drinks.map((drink) => (
              <div className="menu-card" key={drink.id}>
                <strong>{drink.name}</strong>
                <span>{money(drink.price)}</span>
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

        <div className="drink-actions">
          <h3>Add Drinks</h3>
          {menu.drinks.map((drink) => (
            <button key={drink.id} onClick={() => addDrinkToCart(drink.id)}>
              Add {drink.name} ({money(drink.price)})
            </button>
          ))}
        </div>

        <div data-testid="cart" className="cart">
          <h3>Cart</h3>
          {cart.length === 0 ? <p>No items in cart.</p> : <ul>{cart.map(renderCartItem)}</ul>}
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
    );
  }

  function renderEmployeePage() {
    return (
      <section className="panel">
        <h2>Restaurant Employee Page</h2>
        <button onClick={refreshStaffScreens}>Refresh Orders</button>
        <div data-testid="employee-orders">
          {employeeOrders.length === 0 ? <p>No active orders.</p> : employeeOrders.map((order) => (
            <div className="order-card" key={order.id}>
              <h3>Order #{order.id}</h3>
              <p>Customer: {order.customerName}</p>
              <p>Phone: {order.phone}</p>
              <p>Address: {order.deliveryAddress}</p>
              <p>Status: {order.status}</p>
              <p>Total: {money(order.totalPrice)}</p>
              {renderOrderItems(order)}
              {order.status === "new" && <button onClick={() => updateOrderStatus(order.id, "preparing")}>Start Preparing</button>}
              {order.status === "preparing" && <button onClick={() => updateOrderStatus(order.id, "ready")}>Mark Ready</button>}
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderCourierPage() {
    return (
      <section className="panel">
        <h2>Courier Page</h2>
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
    );
  }

  function renderActivePage() {
    if (activeRole === "customer") return renderCustomerPage();
    if (activeRole === "employee") return renderEmployeePage();
    if (activeRole === "courier") return renderCourierPage();
    return renderLanding();
  }

  return (
    <main className="app">
      {renderNav()}
      {message && <div className="message">{message}</div>}
      {renderActivePage()}
    </main>
  );
}

export default App;
