const formatter = new Intl.NumberFormat("vi-VN");
const ordersList = document.getElementById("ordersList");
const ordersNotice = document.getElementById("ordersNotice");

const statusClassMap = {
  new: "bg-blue-50 text-blue-600",
  confirmed: "bg-green-50 text-green-600",
  preparing: "bg-amber-50 text-amber-600",
  shipping: "bg-indigo-50 text-indigo-600",
  delivered: "bg-emerald-50 text-emerald-600",
  canceled: "bg-red-50 text-red-600",
  cancel_requested: "bg-orange-50 text-orange-600"
};

const statusLabelMap = {
  new: "Đơn hàng mới",
  confirmed: "Đã xác nhận đơn",
  preparing: "Shop đang chuẩn bị hàng",
  shipping: "Đang giao hàng",
  delivered: "Đã giao thành công",
  canceled: "Đã hủy đơn",
  cancel_requested: "Đã gửi yêu cầu hủy"
};

const nextStatusLabelMap = {
  new: "Xác nhận đơn",
  confirmed: "Bắt đầu chuẩn bị hàng",
  preparing: "Bàn giao cho shipper",
  shipping: "Xác nhận đã giao"
};

function formatDate(value) {
  return new Date(value).toLocaleString("vi-VN");
}

async function fetchOrders() {
  const response = await fetch("/api/orders");
  return response.json();
}

const STEPS = [
  { key: "new",       label: "Đặt hàng" },
  { key: "confirmed", label: "Xác nhận" },
  { key: "preparing", label: "Chuẩn bị" },
  { key: "shipping",  label: "Đang giao" },
  { key: "delivered", label: "Đã giao" }
];

const STATUS_FLOW = ["new", "confirmed", "preparing", "shipping", "delivered"];

function renderStepper(currentStatus) {
  if (currentStatus === "canceled" || currentStatus === "cancel_requested") {
    const col = currentStatus === "canceled" ? "#dc2626" : "#ea580c";
    const lbl = currentStatus === "canceled" ? "Đã hủy đơn" : "Yêu cầu hủy đang xử lý";
    return `<div style="font-size:.82rem;font-weight:600;color:${col};padding:.4rem .85rem;border-radius:99px;background:#fee2e2;display:inline-block;">✕ ${lbl}</div>`;
  }
  const currentIdx = STATUS_FLOW.indexOf(currentStatus);
  const steps = STEPS.map((step, idx) => {
    const done   = idx < currentIdx;
    const active = idx === currentIdx;
    const cls    = done ? "done" : active ? "active" : "";
    const icon   = done ? "✓" : idx + 1;
    return `<div class="status-step ${cls}"><div class="step-dot">${icon}</div><div class="step-label">${step.label}</div></div>`;
  }).join("");
  return `<div class="status-stepper">${steps}</div>`;
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersList.innerHTML = `
      <div class="panel" style="text-align:center;padding:3rem 1rem;">
        <div style="font-size:3rem;margin-bottom:.75rem;">📦</div>
        <p style="color:var(--clr-muted);margin-bottom:1rem;">Bạn chưa có đơn hàng nào.</p>
        <a href="/" class="btn btn-primary btn-sm">Mua sắm ngay</a>
      </div>
    `;
    return;
  }

  ordersList.innerHTML = orders
    .map((order) => {
      const cancelLabel = order.canRequestCancel ? "Gửi yêu cầu hủy" : "Hủy đơn";
      return `
        <details class="panel" style="padding:1.1rem 1.25rem;">
          <summary style="cursor:pointer;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem;list-style:none;">
            <div>
              <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--clr-primary-light);margin-bottom:.2rem;">Mã đơn hàng</div>
              <div style="font-size:.95rem;font-weight:700;">${order.code}</div>
              <div style="font-size:.74rem;color:var(--clr-muted);margin-top:.1rem;">${formatDate(order.createdAt)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:.65rem;">
              <span style="font-size:.74rem;font-weight:600;padding:.22rem .7rem;border-radius:99px;background:var(--clr-primary-faint);color:var(--clr-primary-text);border:1px solid var(--clr-border);">${order.statusLabel}</span>
              <span style="font-size:1.05rem;font-weight:800;color:var(--clr-primary);">${formatter.format(order.total)}đ</span>
              <span style="font-size:.8rem;color:var(--clr-muted);">▾</span>
            </div>
          </summary>

          <div style="margin-top:1.1rem;display:flex;flex-direction:column;gap:1.25rem;">
            <div>
              <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--clr-text-soft);margin-bottom:.6rem;">Theo dõi trạng thái</div>
              ${renderStepper(order.status)}
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.55rem;">
              <div class="stat-chip"><span>Người nhận</span><strong>${order.recipientName}</strong></div>
              <div class="stat-chip"><span>Điện thoại</span><strong>${order.phone}</strong></div>
              <div class="stat-chip"><span>Thanh toán</span><strong>${order.paymentMethod}</strong></div>
              <div class="stat-chip" style="grid-column:1/-1;"><span>Địa chỉ</span><strong>${order.address}</strong></div>
              ${order.note ? `<div class="stat-chip"><span>Ghi chú</span><strong>${order.note}</strong></div>` : ""}
            </div>

            <div>
              <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--clr-text-soft);margin-bottom:.5rem;">Sản phẩm đặt mua</div>
              <div style="display:flex;flex-direction:column;gap:.35rem;">
                ${order.items.map((item) => `
                  <div style="display:flex;align-items:center;justify-content:space-between;font-size:.82rem;padding:.42rem .65rem;border-radius:var(--radius-sm);background:var(--clr-bg);border:1px solid var(--clr-border);">
                    <div><div style="font-weight:600;">${item.name}</div><div style="font-size:.72rem;color:var(--clr-muted);">SL: ${item.quantity}</div></div>
                    <div style="font-weight:700;color:var(--clr-primary);">${formatter.format(item.subtotal)}đ</div>
                  </div>
                `).join("")}
              </div>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:.5rem;">
              ${nextStatusLabelMap[order.status] ? `<button data-action="advance" data-order-id="${order.id}" class="btn btn-outline btn-sm" type="button">${nextStatusLabelMap[order.status]}</button>` : ""}
              ${order.canCancel || order.canRequestCancel ? `<button data-action="cancel" data-order-id="${order.id}" class="btn btn-danger btn-sm" type="button">${cancelLabel}</button>` : ""}
            </div>
          </div>
        </details>
      `;
    })
    .join("");
}

ordersList.addEventListener("click", async (event) => {
  const cancelBtn = event.target.closest("button[data-action='cancel']");
  const advanceBtn = event.target.closest("button[data-action='advance']");
  const button = cancelBtn || advanceBtn;
  if (!button) return;

  const orderId = button.dataset.orderId;
  let response;

  if (cancelBtn) {
    response = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
  } else {
    response = await fetch(`/api/orders/${orderId}/status`, { method: "PATCH" });
  }

  const data = await response.json();
  if (!response.ok) {
    ordersNotice.style.cssText = "background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;";
    ordersNotice.textContent = data.message || "Cập nhật thất bại";
    ordersNotice.classList.remove("hidden");
    return;
  }
  ordersNotice.style.cssText = "";
  ordersNotice.textContent = cancelBtn
    ? "Đã cập nhật trạng thái hủy đơn"
    : `Đơn hàng chuyển sang: ${data.data?.statusLabel || "trạng thái mới"}`;
  ordersNotice.classList.remove("hidden");
  await loadOrders();
});

async function loadOrders() {
  const data = await fetchOrders();
  renderOrders(data.data || []);
}

const createdCode = new URLSearchParams(window.location.search).get("created");
if (createdCode) {
  ordersNotice.textContent = `Đặt hàng thành công. Mã đơn: ${createdCode}`;
  ordersNotice.classList.remove("hidden");
}

loadOrders();
