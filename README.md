# Pizza Restaurant Ordering System

## Students


| Student | Full Name | ID |
|---|---|---|
| 1 | Khaled Igbaria | 211669700 |

## Repository Link

https://github.com/IgbariaK/pizza-restaurant-system.git

## Project Description

This project is a simple pizza restaurant ordering system.

The system includes:

- A customer screen for viewing the menu, building an order, making a mock payment, and tracking order status.
- A restaurant employee screen for viewing active orders and updating the order status.
- A courier screen for viewing orders ready for delivery and marking them as delivered.

The project uses:

- Server: Node.js, Express, REST API
- Client: React with Vite
- Data storage: In-memory array only, no database

## Project Structure

```text
pizza_app_REPLACE_WITH_STUDENT_ID
├── server
│   ├── package.json
│   ├── server.js
│   ├── menu.js
│   └── rules.js
├── client
│   ├── package.json
│   ├── index.html
│   └── src
│       ├── main.jsx
│       ├── App.jsx
│       └── App.css
└── README.md
```

## How to Run the Server

Open a terminal in the `server` folder:

```bash
cd server
npm install
npm start
```

The server runs on:

```text
http://localhost:3001
```

The server uses the environment variable `PORT`. If `PORT` is not defined, it uses port `3001`.

Optional development command:

```bash
npm run dev
```

## How to Run the Client

Open a second terminal in the `client` folder:

```bash
cd client
npm install
npm run dev
```

The client usually runs on:

```text
http://localhost:5173
```

## API Endpoints

### Get Menu

```http
GET /api/menu
```

### Create Order

```http
POST /api/orders
```

The request body must include these fields:

```json
{
  "customerName": "Customer Name",
  "phone": "0500000000",
  "deliveryAddress": "Address",
  "pizzas": [
    {
      "pizzaId": "margherita",
      "size": "medium",
      "toppings": ["olives", "corn"]
    }
  ]
}
```

### Get Order by ID

```http
GET /api/orders/:id
```

### Filter Orders by Status

```http
GET /api/orders?status=new
```

Valid statuses:

```text
new, preparing, ready, delivered
```

### Update Order Status

```http
PATCH /api/orders/:id/status
```

Request body:

```json
{
  "status": "preparing"
}
```

## Order Status Flow

The legal order status flow is:

```text
new → preparing → ready → delivered
```

The server does not allow skipping a status.  
For example, changing directly from `new` to `ready` returns an error.

## Where the Price Is Calculated and Why

The final total price is calculated on the server in `server/rules.js`.

This is important because the server must be the source of truth.  
The client can show an estimated price, but the client is not trusted because users can change browser data. Therefore, the server recalculates the price using the menu prices and the valid choices sent in the order.

## Personal Rule

The active personal rule is configured in:

```text
server/rules.js
```

Current default:

```text
PERSONAL_RULE_DIGIT = 0
```

Rule for last digit `0`:

```text
I am alone on this
```

The rule is checked on the server during order validation. If a pizza has more than two toppings, the server returns status code `400`.


## Changes from Exercise 1

A small implementation change was made from the original planning:

- The class diagram had separate user roles, but in this implementation there is no real login system because the assignment does not require authentication.
- The UI is divided into three sections on one page: customer, restaurant employee, and courier.
- Orders are stored in memory instead of a database, according to the assignment instructions.

## Required Test IDs

The client includes the required `data-testid` attributes:

- `data-testid="menu-list"`
- `data-testid="cart"`
- `data-testid="order-summary-panel"`
- `data-testid="checkout-button"`
- `data-testid="order-confirmation"`
- `data-testid="employee-orders"`
- `data-testid="delivery-orders"`

## Questions and Answers

### Question 1: What is the difference between the client side and the server side in this system?

The client side is the React interface that the users see and use in the browser.  
The server side is the Express REST API that validates orders, calculates prices, saves orders in memory, and updates order statuses.

### Question 2: Where is the total price calculated and why?

The total price is calculated on the server in `server/rules.js`.  
This is done because the server is the source of truth and should not trust prices sent from the browser.

### Question 3: What happens when a customer sends an invalid order?

The server rejects the order and returns status code `400` with a clear error message.  
For example, this happens if the customer name is missing, the address is missing, no pizzas were selected, or an invalid pizza, size, or topping was sent.

### Question 4: What happens after the mock payment succeeds?

After the mock payment succeeds, the client sends the order to the server.  
The server creates the order, sets the payment status to `paid`, sets the order status to `new`, saves it in memory, and returns an order confirmation with the order number.

### Question 5: What is the personal rule that applies to us?

The current default rule is the rule for last digit `0`:  
A customer can choose up to two toppings for each pizza.

This rule is implemented in `server/rules.js`.

### Question 6: What was the most challenging part of the exercise?

The most challenging part was managing the correct order status flow and making sure the server rejects illegal status changes.

### Question 7: What is one design decision you made and why?

One design decision was to calculate the final price only on the server.  
This keeps the logic safe and consistent because the client only sends the selected pizzas, sizes, and toppings, not the final trusted price.
