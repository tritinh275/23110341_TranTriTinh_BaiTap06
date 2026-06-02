const formatter = new Intl.NumberFormat("vi-VN");
const checkoutItems = document.getElementById("checkoutItems");
const checkoutSummary = document.getElementById("checkoutSummary");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutContent = document.getElementById("checkoutContent");
const checkoutEmpty = document.getElementById("checkoutEmpty");
const checkoutError = document.getElementById("checkoutError");
const placeOrderBtn = document.getElementById("placeOrderBtn");

const recipientNameInput = document.getElementById("recipientName");
const phoneInput = document.getElementById("phone");
const addressInput = document.getElementById("address");
const noteInput = document.getElementById("note");

async function fetchCart() {
  const response = await fetch("/api/cart");
  return response.json();
}

async function fetchMe() {
  const response = await fetch("/api/auth/me");
  if (!response.ok) return null;
  const data = await response.json();
  return data.user;
}

function renderSummary(summary) {
  checkoutSummary.innerHTML = `
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
        <strong style="color:var(--clr-primary);font-size:1.15rem;">${formatter.format(summary.total)}đ</strong>
      </div>
    </div>
  `;
}

function renderCheckout(data) {
  const items = data.items || [];
  if (!items.length) {
    checkoutContent.classList.add("hidden");
    checkoutEmpty.classList.remove("hidden");
    placeOrderBtn.setAttribute("disabled", "disabled");
    return;
  }

  checkoutContent.classList.remove("hidden");
  checkoutEmpty.classList.add("hidden");
  placeOrderBtn.removeAttribute("disabled");

  checkoutItems.innerHTML = items
    .map(
      (item) => `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.name}" />
          <div class="item-info">
            <div class="item-name">${item.name}</div>
            <div style="font-size:.75rem;color:var(--clr-muted);">SL: ${item.quantity}</div>
          </div>
          <div class="item-price">${formatter.format(item.subtotal)}đ</div>
        </div>
      `
    )
    .join("");
  renderSummary(data.summary);
}

async function loadCheckout() {
  const [cartData, user] = await Promise.all([fetchCart(), fetchMe()]);
  renderCheckout(cartData);
  if (user?.fullName && recipientNameInput) {
    recipientNameInput.value = user.fullName;
  }
}

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  checkoutError.classList.add("hidden");

  const payload = {
    recipientName: recipientNameInput.value.trim(),
    phone: phoneInput.value.trim(),
    address: addressInput.value.trim(),
    note: noteInput.value.trim(),
    paymentMethod: "COD"
  };

  placeOrderBtn.textContent = "⏳ Đang xử lý...";
  placeOrderBtn.setAttribute("disabled", "disabled");
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      checkoutError.textContent = data.message || "Không thể đặt hàng";
      checkoutError.classList.remove("hidden");
      return;
    }
    if (typeof window.refreshCartCount === "function") {
      window.refreshCartCount();
    }
    const code = data.data?.code || "";
    window.location.href = `/orders?created=${encodeURIComponent(code)}`;
  } finally {
    placeOrderBtn.textContent = "✅ Xác nhận đặt hàng";
    placeOrderBtn.removeAttribute("disabled");
  }
});

loadCheckout();
