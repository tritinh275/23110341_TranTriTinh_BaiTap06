async function loadCartCount() {
  const cartCount = document.getElementById("cartCount");
  if (!cartCount) return;
  const response = await fetch("/api/cart");
  if (!response.ok) return;
  const data = await response.json();
  const count = data.summary?.totalQuantity || 0;
  cartCount.textContent = String(count);
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  });
}

window.refreshCartCount = loadCartCount;
loadCartCount();
