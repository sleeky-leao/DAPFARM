const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");

loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/admin/login",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ username, password })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message);
        }

        loginMessage.style.color = "green";
        loginMessage.textContent = "Login successful!";

        window.location.href = "admin.html";

    } catch (error) {
        loginMessage.style.color = "red";
        loginMessage.textContent = error.message;
    }
});