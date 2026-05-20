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
        <div class="flex items-center gap-3 border border-slate-200 rounded-xl p-3">
          <img src="${item.image}" alt="${item.name}" class="w-16 h-16 rounded-lg object-cover" />
          <div class="flex-1">
            <h3 class="font-semibold text-sm">${item.name}</h3>
            <p class="text-xs text-slate-500">SL: ${item.quantity}</p>
          </div>
          <div class="text-sm font-semibold text-blue-700">${formatter.format(item.subtotal)}đ</div>
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
    placeOrderBtn.removeAttribute("disabled");
  }
});

loadCheckout();
