const ordersContainer = document.getElementById("orders-container");
// FORMAT CUSTOMER PHONE FOR WHATSAPP
function formatWhatsAppNumber(phone) {
    let number = phone.replace(/\D/g, "");

    if (number.startsWith("0")) {
        number = "254" + number.slice(1);
    }

    return number;
}
// PROTECT DASHBOARD FROM MALICIOUS HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(character) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}
async function loadOrders() {
    try {
       const response = await fetch("https://dapfarm.onrender.com/api/orders", {
    credentials: "include"
});
if (response.status === 401) {
    window.location.href = "login.html";
    return;
}

        if (!response.ok) {
            throw new Error("Failed to retrieve orders");
        }

        const orders = await response.json();
        // Calculate dashboard statistics
document.getElementById("total-orders").textContent = orders.length;

document.getElementById("pending-orders").textContent =
    orders.filter(order => order.status === "Pending").length;

document.getElementById("confirmed-orders").textContent =
    orders.filter(order => order.status === "Confirmed").length;

document.getElementById("delivered-orders").textContent =
    orders.filter(order => order.status === "Delivered").length;

// Calculate revenue from delivered orders
const revenue = orders
    .filter(order => order.status === "Delivered")
    .reduce(function(total, order) {
        return total + Number(order.total);
    }, 0);

console.log("Delivered orders:", orders.filter(order => order.status === "Delivered"));
console.log("Calculated revenue:", revenue);

document.getElementById("total-revenue").textContent =
    `KSh ${revenue.toLocaleString()}`;

        if (orders.length === 0) {
            ordersContainer.textContent = "No orders found.";
            return;
        }
ordersContainer.innerHTML = orders.map(function(order) {
    const items = typeof order.items === "string"
    ? JSON.parse(order.items)
    : order.items;
    const whatsappMessage = `
Hello ${order.customer_name}! 👋

Thank you for choosing DapFarm!

We have received your order #${order.id}.

ORDER DETAILS:
${items.map(item =>
    `${item.name} × ${item.quantity} = KSh ${(item.price * item.quantity).toLocaleString()}`
).join("\n")}

Total: KSh ${Number(order.total).toLocaleString()}

Delivery location: ${order.delivery_location}

We will contact you shortly to confirm your delivery.

Thank you for choosing DapFarm! 💚
`;

    return `
        <div class="order-card" data-status="${escapeHTML(order.status)}">
            <h3>Order #${escapeHTML(order.id)}</h3>

            <label>Order Status:</label>

            <select
                class="order-status status-${escapeHTML(order.status.toLowerCase())}"
                data-order-id="${escapeHTML(order.id)}">

                <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
                <option value="Confirmed" ${order.status === "Confirmed" ? "selected" : ""}>Confirmed</option>
                <option value="Delivered" ${order.status === "Delivered" ? "selected" : ""}>Delivered</option>
                <option value="Cancelled" ${order.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
            </select>

            <p>Customer: ${escapeHTML(order.customer_name)}</p>
            <p>Phone: ${escapeHTML(order.phone)}</p>
            <p>Location: ${escapeHTML(order.delivery_location)}</p>

<a
    class="contact-customer"
    href="https://wa.me/${formatWhatsAppNumber(order.phone)}?text=${encodeURIComponent(whatsappMessage)}"
    target="_blank"
    rel="noopener noreferrer">
    Contact Customer on WhatsApp
</a>

            <h4>Products:</h4>

            ${items.map(function(item) {
                return `
                    <p>${escapeHTML(item.name)} -
                    ${escapeHTML(item.quantity)} × KSh ${escapeHTML(item.price)}</p>
                `;
            }).join("")}
            ${order.status === "Delivered" ? `
    <button
        class="archive-order"
        data-order-id="${escapeHTML(order.id)}">
        Archive Order
    </button>
` : ""}

            <h4>Total: KSh ${escapeHTML(order.total)}</h4>
            <p>Date: ${escapeHTML(order.created_at)}</p>
        </div>
    `;
}).join("");

}catch (error) {
        console.error(error);
        ordersContainer.textContent = "Unable to load orders.";
    }
}
// Update order status when dropdown changes
ordersContainer.addEventListener("change", async function(event) {

    if (event.target.classList.contains("order-status")) {

        const orderId = event.target.dataset.orderId;
        const newStatus = event.target.value;
        event.target.className =
    `order-status status-${newStatus.toLowerCase()}`;

        try {
            const response = await fetch(
                `https://dapfarm.onrender.com/api/orders/${orderId}/status`,
                {
                    method: "PUT",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        status: newStatus
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message);
            }

            await loadOrders();

        } catch (error) {
            console.error(error);
            alert("Unable to update order status.");
        }
    }
});
// ARCHIVE DELIVERED ORDERS
ordersContainer.addEventListener("click", async function(event) {

    const button = event.target.closest(".archive-order");

    if (!button) return;

    const orderId = button.dataset.orderId;

    if (!confirm("Are you sure you want to archive this delivered order?")) {
        return;
    }

    try {
        const response = await fetch(
            `https://dapfarm.onrender.com/api/orders/${orderId}/archive`,
            {
                method: "PATCH",
                credentials: "include"
            }
        );
        if (response.status === 401) {
    window.location.href = "login.html";
    return;
}

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message);
        }

        await loadOrders();

    } catch (error) {
        console.error("Archive error:", error);
        alert(error.message || "Unable to archive order.");
    }
});

// Search customer orders
// Search and filter orders
const searchInput = document.getElementById("search-orders");
const statusFilter = document.getElementById("status-filter");

function filterOrders() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedStatus = statusFilter.value;

    const orderCards = document.querySelectorAll(".order-card");

    orderCards.forEach(function(card) {
        const orderDetails = card.textContent.toLowerCase();
        const orderStatus = card.dataset.status;

        const matchesSearch = orderDetails.includes(searchTerm);

        const matchesStatus =
            selectedStatus === "all" ||
            orderStatus === selectedStatus;

        card.style.display =
            matchesSearch && matchesStatus ? "block" : "none";
    });
}

searchInput.addEventListener("input", filterOrders);
statusFilter.addEventListener("change", filterOrders);
// Refresh orders button
const refreshButton = document.getElementById("refresh-orders");

refreshButton.addEventListener("click", function() {
    loadOrders();
});
const logoutButton = document.getElementById("logout-button");

logoutButton.addEventListener("click", async function() {
    try {
        const response = await fetch(
            "https://dapfarm.onrender.com/api/admin/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Unable to log out.");
        }

        window.location.href = "index.html";

    } catch (error) {
        alert(error.message);
    }
});
loadOrders();