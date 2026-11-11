// SELECT HTML ELEMENTS
const cartButton = document.getElementById("cart-button");
const cartCount = document.getElementById("cart-count");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const checkoutButton = document.getElementById("checkout-button");

const addToCartButtons = document.querySelectorAll(".add-to-cart");


// CREATE AN EMPTY CART
let cart = [];


// ADD PRODUCTS TO CART
addToCartButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        const productName = button.dataset.name;
        const productPrice = Number(button.dataset.price);

        // CHECK WHETHER PRODUCT ALREADY EXISTS
        const existingProduct = cart.find(function(item) {
            return item.name === productName;
        });

        if (existingProduct) {
            existingProduct.quantity++;
        } else {

            cart.push({
                name: productName,
                price: productPrice,
                quantity: 1
            });

        }

        updateCart();

    });

});


// UPDATE THE SHOPPING CART
function updateCart() {

    cartItems.innerHTML = "";

    let total = 0;
    let count = 0;

    if (cart.length === 0) {

        cartItems.innerHTML = "<p>Your cart is empty.</p>";

    }

    cart.forEach(function(item, index) {

        const itemTotal = item.price * item.quantity;

        total += itemTotal;
        count += item.quantity;

        const productElement = document.createElement("div");

        productElement.classList.add("cart-item");

        productElement.innerHTML = `
            <p>
                ${item.name} -
                KSh ${item.price} x ${item.quantity}
            </p>

            <button onclick="changeQuantity(${index}, -1)">-</button>

            <button onclick="changeQuantity(${index}, 1)">+</button>

            <button onclick="removeProduct(${index})">Remove</button>
        `;

        cartItems.appendChild(productElement);

    });

    cartCount.textContent = count;
    cartTotal.textContent = total;

}


// CHANGE PRODUCT QUANTITY
function changeQuantity(index, amount) {

    cart[index].quantity += amount;

    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }

    updateCart();

}


// REMOVE PRODUCT FROM CART
function removeProduct(index) {

    cart.splice(index, 1);

    updateCart();

}


// SCROLL TO SHOPPING CART
cartButton.addEventListener("click", function() {

    document.getElementById("cart").scrollIntoView({
        behavior: "smooth"
    });

});

// PLACE ORDER

const checkoutForm = document.getElementById("checkout-form");

checkoutForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (cart.length === 0) {
        alert("Your shopping cart is empty!");
        return;
    }

    const customerName = document.getElementById("customer-name").value.trim();
    const customerPhone = document.getElementById("customer-phone").value.trim();
    const deliveryLocation = document.getElementById("delivery-location").value.trim();

    const order = {
        customerName: customerName,
        phone: customerPhone,
        deliveryLocation: deliveryLocation,
        items: cart.map(function(item) {
            return {
                name: item.name,
                quantity: item.quantity
            };
        })
    };

    try {
        const response = await fetch("https://dapfarm.onrender.com/api/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(order)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Order failed!");
        }

        alert(`Your order has been received successfully!\nOrder number: ${result.orderId}`);

        cart = [];
        updateCart();
        checkoutForm.reset();

    } catch (error) {
        console.error("Order error:", error);
        alert(error.message || "Unable to submit your order. Please try again.");
    }
});
// INITIAL CART DISPLAY
updateCart();