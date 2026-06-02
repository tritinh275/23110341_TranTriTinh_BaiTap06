const formatter = new Intl.NumberFormat("vi-VN");
const cartContent = document.getElementById("cartContent");
const cartSummary = document.getElementById("cartSummary");
const checkoutBtn = document.getElementById("checkoutBtn");
const clearCartBtn = document.getElementById("clearCartBtn");

async function fetchCart() {
  const response = await fetch("/api/cart");
  return response.json();
}

function renderSummary(summary) {
  cartSummary.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:.5rem;font-size:.88rem;">
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--clr-muted);">Tạm tính</span>
        <strong>${formatter.format(summary.subtotal)}đ</strong>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--clr-muted);">Phí vận chuyển</span>
        <strong>${formatter.format(summary.shippingFee)}đ</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:1rem;padding-top:.5rem;border-top:1px solid var(--clr-border);margin-top:.25rem;">
        <span style="font-weight:700;">Tổng cộng</span>
        <strong style="color:var(--clr-primary);font-size:1.1rem;">${formatter.format(summary.total)}đ</strong>
      </div>
    </div>
  `;
}

function renderCart(data) {
  const items = data.items || [];
  if (!items.length) {
    cartContent.innerHTML = `
      <div style="text-align:center;padding:2.5rem 1rem;">
        <div style="font-size:3rem;margin-bottom:.75rem;">🛒</div>
        <p style="color:var(--clr-muted);margin-bottom:1rem;">Giỏ hàng của bạn đang trống.</p>
        <a href="/" class="btn btn-primary btn-sm">Tiếp tục mua sắm</a>
      </div>
    `;
    cartSummary.innerHTML = "";
    if (checkoutBtn) checkoutBtn.style.opacity = ".45";
    if (clearCartBtn) clearCartBtn.setAttribute("disabled", "disabled");
    return;
  }

  if (checkoutBtn) checkoutBtn.style.opacity = "";
  if (clearCartBtn) clearCartBtn.removeAttribute("disabled");

  cartContent.innerHTML = items
    .map(
      (item) => `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.name}" />
          <div class="item-info">
            <div class="item-name">${item.name}</div>
            <div class="item-price">${formatter.format(item.price)}đ</div>
            <div style="font-size:.75rem;color:var(--clr-muted);">Tạm tính: <strong style="color:var(--clr-primary-text);">${formatter.format(item.subtotal)}đ</strong></div>
          </div>
          <div class="qty-stepper">
            <button class="qty-btn" data-action="decrease" data-product-id="${item.productId}" type="button">−</button>
            <input class="qty-input" data-action="qty" data-product-id="${item.productId}" data-max="${item.stock}" type="number" min="1" value="${item.quantity}" />
            <button class="qty-btn" data-action="increase" data-product-id="${item.productId}" type="button">＋</button>
          </div>
          <button class="btn btn-danger btn-sm" data-action="remove" data-product-id="${item.productId}" type="button">Xóa</button>
        </div>
      `
    )
    .join("");

  renderSummary(data.summary);
}

async function loadCart() {
  const data = await fetchCart();
  renderCart(data);
  if (typeof window.refreshCartCount === "function") {
    window.refreshCartCount();
  }
}

async function updateQuantity(productId, quantity) {
  await fetch(`/api/cart/items/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity })
  });
  await loadCart();
}

async function removeItem(productId) {
  await fetch(`/api/cart/items/${productId}`, { method: "DELETE" });
  await loadCart();
}

async function clearCart() {
  await fetch("/api/cart", { method: "DELETE" });
  await loadCart();
}

cartContent.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const productId = Number(button.dataset.productId);
  const input = cartContent.querySelector(`input[data-action="qty"][data-product-id="${productId}"]`);
  if (!input) return;

  const max = Number(input.dataset.max) || 1;
  const current = Number(input.value) || 1;

  if (button.dataset.action === "decrease") {
    await updateQuantity(productId, Math.max(1, current - 1));
  }
  if (button.dataset.action === "increase") {
    await updateQuantity(productId, Math.min(max, current + 1));
  }
  if (button.dataset.action === "remove") {
    await removeItem(productId);
  }
});

cartContent.addEventListener("change", async (event) => {
  const input = event.target.closest('input[data-action="qty"]');
  if (!input) return;
  const productId = Number(input.dataset.productId);
  const max = Number(input.dataset.max) || 1;
  const quantity = Math.max(1, Math.min(Number(input.value) || 1, max));
  input.value = quantity;
  await updateQuantity(productId, quantity);
});

if (clearCartBtn) {
  clearCartBtn.addEventListener("click", async () => {
    await clearCart();
  });
}

loadCart();
