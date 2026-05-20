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

function formatDate(value) {
  return new Date(value).toLocaleString("vi-VN");
}

async function fetchOrders() {
  const response = await fetch("/api/orders");
  return response.json();
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersList.innerHTML = `
      <div class="bg-slate-50 rounded-xl p-6 text-center text-slate-500">
        Bạn chưa có đơn hàng nào. <a href="/" class="text-blue-600 hover:underline">Mua sắm ngay</a>
      </div>
    `;
    return;
  }

  ordersList.innerHTML = orders
    .map((order) => {
      const badgeClass = statusClassMap[order.status] || "bg-slate-100 text-slate-600";
      const cancelLabel = order.canRequestCancel ? "Gửi yêu cầu hủy" : "Hủy đơn";

      return `
        <details class="border border-slate-200 rounded-xl p-4">
          <summary class="cursor-pointer flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm text-slate-500">Mã đơn: <strong>${order.code}</strong></p>
              <p class="text-xs text-slate-400">${formatDate(order.createdAt)}</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs px-2 py-1 rounded-full ${badgeClass}">${order.statusLabel}</span>
              <span class="text-sm font-semibold text-blue-700">${formatter.format(order.total)}đ</span>
            </div>
          </summary>
          <div class="mt-4 space-y-4">
            <div class="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-slate-500">Người nhận</p>
                <p class="font-medium">${order.recipientName}</p>
                <p class="text-slate-500">${order.phone}</p>
              </div>
              <div>
                <p class="text-slate-500">Địa chỉ</p>
                <p class="font-medium">${order.address}</p>
              </div>
              <div>
                <p class="text-slate-500">Thanh toán</p>
                <p class="font-medium">${order.paymentMethod}</p>
              </div>
              <div>
                <p class="text-slate-500">Ghi chú</p>
                <p class="font-medium">${order.note || "Không có"}</p>
              </div>
            </div>

            <div>
              <h3 class="font-semibold mb-2">Sản phẩm</h3>
              <div class="space-y-2">
                ${order.items
                  .map(
                    (item) => `
                      <div class="flex items-center justify-between text-sm border border-slate-100 rounded-lg p-2">
                        <div>
                          <p class="font-medium">${item.name}</p>
                          <p class="text-xs text-slate-500">SL: ${item.quantity}</p>
                        </div>
                        <div class="font-semibold text-blue-700">${formatter.format(item.subtotal)}đ</div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>

            <div>
              <h3 class="font-semibold mb-2">Trạng thái đơn hàng</h3>
              <ul class="space-y-1 text-sm text-slate-600">
                ${order.statusHistory
                  .map((item) => {
                    const noteText = item.note ? ` • ${item.note}` : "";
                    const label = statusLabelMap[item.status] || item.status;
                    return `
                      <li>
                        <strong>${label}</strong>${noteText} (${formatDate(item.at)})
                      </li>
                    `;
                  })
                  .join("")}
              </ul>
            </div>

            ${
              order.canCancel || order.canRequestCancel
                ? `
                  <button
                    data-action="cancel"
                    data-order-id="${order.id}"
                    class="px-3 py-2 rounded-lg border border-red-500 text-red-600 text-sm hover:bg-red-50"
                    type="button"
                  >
                    ${cancelLabel}
                  </button>
                `
                : ""
            }
          </div>
        </details>
      `;
    })
    .join("");
}

ordersList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='cancel']");
  if (!button) return;
  const orderId = button.dataset.orderId;
  const response = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
  const data = await response.json();
  if (!response.ok) {
    ordersNotice.textContent = data.message || "Không thể hủy đơn";
    ordersNotice.classList.remove("hidden");
    return;
  }
  ordersNotice.textContent = "Cập nhật trạng thái đơn hàng thành công";
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
