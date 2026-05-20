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
    <div class="flex flex-col gap-2 text-sm">
      <div class="flex items-center justify-between">
        <span>Tạm tính</span>
        <strong>${formatter.format(summary.subtotal)}đ</strong>
      </div>
      <div class="flex items-center justify-between">
        <span>Phí vận chuyển</span>
        <strong>${formatter.format(summary.shippingFee)}đ</strong>
      </div>
      <div class="flex items-center justify-between text-base">
        <span>Tổng cộng</span>
        <strong class="text-blue-700">${formatter.format(summary.total)}đ</strong>
      </div>
    </div>
  `;
}

function renderCart(data) {
  const items = data.items || [];
  if (!items.length) {
    cartContent.innerHTML = `
      <div class="bg-slate-50 rounded-xl p-6 text-center text-slate-500">
        Giỏ hàng đang trống. <a href="/" class="text-blue-600 hover:underline">Tiếp tục mua sắm</a>
      </div>
    `;
    cartSummary.innerHTML = "";
    if (checkoutBtn) checkoutBtn.classList.add("pointer-events-none", "opacity-50");
    if (clearCartBtn) clearCartBtn.setAttribute("disabled", "disabled");
    return;
  }

  if (checkoutBtn) checkoutBtn.classList.remove("pointer-events-none", "opacity-50");
  if (clearCartBtn) clearCartBtn.removeAttribute("disabled");

  cartContent.innerHTML = items
    .map(
      (item) => `
        <div class="flex flex-col md:flex-row md:items-center gap-4 border border-slate-200 rounded-xl p-4">
          <img src="${item.image}" alt="${item.name}" class="w-full md:w-24 h-24 object-cover rounded-lg" />
          <div class="flex-1">
            <h3 class="font-semibold mb-1">${item.name}</h3>
            <p class="text-sm text-slate-500">Giá: ${formatter.format(item.price)}đ • Tồn: ${item.stock}</p>
            <p class="text-sm text-slate-500">Tạm tính: ${formatter.format(item.subtotal)}đ</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              data-action="decrease"
              data-product-id="${item.productId}"
              class="w-8 h-8 rounded-full border border-slate-300 hover:bg-slate-50"
              type="button"
            >
              -
            </button>
            <input
              data-action="qty"
              data-product-id="${item.productId}"
              data-max="${item.stock}"
              type="number"
              min="1"
              class="w-16 text-center border rounded-lg px-2 py-1"
              value="${item.quantity}"
            />
            <button
              data-action="increase"
              data-product-id="${item.productId}"
              class="w-8 h-8 rounded-full border border-slate-300 hover:bg-slate-50"
              type="button"
            >
              +
            </button>
          </div>
          <button
            data-action="remove"
            data-product-id="${item.productId}"
            class="text-red-600 text-sm hover:underline"
            type="button"
          >
            Xóa
          </button>
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
