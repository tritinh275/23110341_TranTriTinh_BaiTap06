const product = window.__PRODUCT__;

new Swiper(".productSwiper", {
  loop: product.images.length > 1,
  pagination: {
    el: ".swiper-pagination",
    clickable: true
  }
});

const qtyInput = document.getElementById("qtyInput");
const increaseQty = document.getElementById("increaseQty");
const decreaseQty = document.getElementById("decreaseQty");
const addToCartBtn = document.getElementById("addToCartBtn");
const cartMessage = document.getElementById("cartMessage");

function sanitizeQty(value) {
  const number = Number(value) || 1;
  return Math.max(1, Math.min(number, product.stock));
}

increaseQty.addEventListener("click", () => {
  qtyInput.value = sanitizeQty(Number(qtyInput.value) + 1);
});

decreaseQty.addEventListener("click", () => {
  qtyInput.value = sanitizeQty(Number(qtyInput.value) - 1);
});

qtyInput.addEventListener("input", () => {
  qtyInput.value = sanitizeQty(qtyInput.value);
});

function showCartMessage(message, isError = false) {
  if (!cartMessage) return;
  cartMessage.textContent = message;
  cartMessage.classList.remove("hidden");
  cartMessage.classList.toggle("text-red-600", isError);
  cartMessage.classList.toggle("text-green-600", !isError);
}

if (addToCartBtn) {
  addToCartBtn.addEventListener("click", async () => {
    const payload = {
      productId: product.id,
      quantity: sanitizeQty(qtyInput.value)
    };

    const response = await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      showCartMessage(data.message || "Không thể thêm vào giỏ hàng", true);
      return;
    }

    showCartMessage("Đã thêm vào giỏ hàng", false);
    if (typeof window.refreshCartCount === "function") {
      window.refreshCartCount();
    }
  });
}
