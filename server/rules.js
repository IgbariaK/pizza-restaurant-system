const menu = require("./menu");

// Change this value according to the last digit of the ID of the submitting student.
// You can also run the server with: RULE_DIGIT=5 npm start
const PERSONAL_RULE_DIGIT = process.env.RULE_DIGIT || "0";

function getMenuItem(collection, id) {
  return collection.find((item) => item.id === id);
}

function validateBasicOrderInput(body) {
  const errors = [];

  if (!body || typeof body !== "object") {
    return ["Request body is missing or invalid"];
  }

  const { customerName, phone, deliveryAddress, pizzas } = body;

  if (!customerName || typeof customerName !== "string" || customerName.trim().length === 0) {
    errors.push("customerName is required");
  }

  if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
    errors.push("phone is required");
  }

  if (!deliveryAddress || typeof deliveryAddress !== "string" || deliveryAddress.trim().length === 0) {
    errors.push("deliveryAddress is required");
  }

  if (!Array.isArray(pizzas) || pizzas.length === 0) {
    errors.push("pizzas must contain at least one pizza");
  }

  return errors;
}

function normalizeAndValidatePizzas(pizzas) {
  const errors = [];
  const normalizedPizzas = [];

  pizzas.forEach((item, index) => {
    const pizza = getMenuItem(menu.pizzas, item.pizzaId);
    const size = getMenuItem(menu.sizes, item.size);
    const toppings = Array.isArray(item.toppings) ? item.toppings : [];

    if (!pizza) errors.push(`Pizza number ${index + 1} has an invalid pizzaId`);
    if (!size) errors.push(`Pizza number ${index + 1} has an invalid size`);
    if (!Array.isArray(item.toppings)) errors.push(`Pizza number ${index + 1} toppings must be an array`);
    if (toppings.length > 3) errors.push(`Pizza number ${index + 1} cannot have more than 3 toppings`);

    const selectedToppings = [];
    toppings.forEach((toppingId) => {
      const topping = getMenuItem(menu.toppings, toppingId);
      if (!topping) {
        errors.push(`Pizza number ${index + 1} has an invalid topping: ${toppingId}`);
      } else {
        selectedToppings.push(topping);
      }
    });

    if (pizza && size) {
      normalizedPizzas.push({
        pizzaId: pizza.id,
        pizzaName: pizza.name,
        pizzaPrice: pizza.price,
        sizeId: size.id,
        sizeName: size.name,
        sizePrice: size.price,
        toppings: selectedToppings.map((topping) => ({
          id: topping.id,
          name: topping.name,
          price: topping.price
        }))
      });
    }
  });

  return { errors, normalizedPizzas };
}

function calculatePizzaSubtotal(normalizedPizzas) {
  return normalizedPizzas.reduce((sum, pizza) => {
    const toppingsPrice = pizza.toppings.reduce((toppingSum, topping) => toppingSum + topping.price, 0);
    return sum + pizza.pizzaPrice + pizza.sizePrice + toppingsPrice;
  }, 0);
}

function applyPersonalRule(normalizedPizzas) {
  const errors = [];
  let discount = 0;
  let deliveryFee = 0;

  if (PERSONAL_RULE_DIGIT === "0") {
    normalizedPizzas.forEach((pizza, index) => {
      if (pizza.toppings.length > 2) {
        errors.push(`Personal rule: pizza number ${index + 1} cannot have more than 2 toppings`);
      }
    });
  }

  if (PERSONAL_RULE_DIGIT === "1") {
    const subtotal = calculatePizzaSubtotal(normalizedPizzas);
    deliveryFee = subtotal > 100 ? 0 : 10;
  }

  if (PERSONAL_RULE_DIGIT === "2") {
    const subtotal = calculatePizzaSubtotal(normalizedPizzas);
    deliveryFee = subtotal < 80 ? 15 : 0;
  }

  if (PERSONAL_RULE_DIGIT === "3") {
    normalizedPizzas.forEach((pizza, index) => {
      const hasExtraCheese = pizza.toppings.some((topping) => topping.id === "extra_cheese");
      if (pizza.sizeId === "small" && hasExtraCheese) {
        errors.push(`Personal rule: small pizza number ${index + 1} cannot include Extra Cheese`);
      }
    });
  }

  if (PERSONAL_RULE_DIGIT === "4") {
    normalizedPizzas.forEach((pizza, index) => {
      if (pizza.sizeId === "large" && pizza.toppings.length === 0) {
        errors.push(`Personal rule: large pizza number ${index + 1} must include at least one topping`);
      }
    });
  }

  if (PERSONAL_RULE_DIGIT === "5" && normalizedPizzas.length > 5) {
    errors.push("Personal rule: an order cannot contain more than five pizzas");
  }

  if (PERSONAL_RULE_DIGIT === "6") {
    const counts = {};
    normalizedPizzas.forEach((pizza) => {
      const key = `${pizza.pizzaId}_${pizza.sizeId}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    Object.keys(counts).forEach((key) => {
      if (counts[key] > 2) {
        errors.push("Personal rule: the same pizza in the same size cannot appear more than twice");
      }
    });
  }

  if (PERSONAL_RULE_DIGIT === "7") {
    normalizedPizzas.forEach((pizza, index) => {
      const hasCorn = pizza.toppings.some((topping) => topping.id === "corn");
      if (pizza.pizzaId === "pepperoni" && hasCorn) {
        errors.push(`Personal rule: Pepperoni pizza number ${index + 1} cannot include Corn`);
      }
    });
  }

  if (PERSONAL_RULE_DIGIT === "8") {
    normalizedPizzas.forEach((pizza, index) => {
      const ids = pizza.toppings.map((topping) => topping.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        errors.push(`Personal rule: pizza number ${index + 1} cannot include the same topping twice`);
      }
    });
  }

  if (PERSONAL_RULE_DIGIT === "9" && normalizedPizzas.length >= 3) {
    const basePizzaPrice = normalizedPizzas.reduce((sum, pizza) => sum + pizza.pizzaPrice, 0);
    discount = basePizzaPrice * 0.05;
  }

  return { errors, discount, deliveryFee };
}

function calculateTotal(normalizedPizzas) {
  const subtotal = calculatePizzaSubtotal(normalizedPizzas);
  const ruleResult = applyPersonalRule(normalizedPizzas);
  const total = subtotal + ruleResult.deliveryFee - ruleResult.discount;

  const detailedPizzas = normalizedPizzas.map((pizza) => {
    const toppingsPrice = pizza.toppings.reduce((sum, topping) => sum + topping.price, 0);
    const itemTotal = pizza.pizzaPrice + pizza.sizePrice + toppingsPrice;
    return { ...pizza, itemTotal };
  });

  return {
    pizzas: detailedPizzas,
    subtotal,
    discount: ruleResult.discount,
    deliveryFee: ruleResult.deliveryFee,
    totalPrice: Number(total.toFixed(2))
  };
}

function validateAndPriceOrder(body) {
  const basicErrors = validateBasicOrderInput(body);
  if (basicErrors.length > 0) return { valid: false, errors: basicErrors };

  const { errors: pizzaErrors, normalizedPizzas } = normalizeAndValidatePizzas(body.pizzas);
  if (pizzaErrors.length > 0) return { valid: false, errors: pizzaErrors };

  const personalRuleResult = applyPersonalRule(normalizedPizzas);
  if (personalRuleResult.errors.length > 0) return { valid: false, errors: personalRuleResult.errors };

  return { valid: true, priceDetails: calculateTotal(normalizedPizzas) };
}

module.exports = { PERSONAL_RULE_DIGIT, validateAndPriceOrder };
