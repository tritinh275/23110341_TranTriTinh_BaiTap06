const formatter = new Intl.NumberFormat("vi-VN");
const productList = document.getElementById("productList");
const filterForm = document.getElementById("filterForm");
const resultCount = document.getElementById("resultCount");

const categoryTabs = document.getElementById("categoryTabs");
const categoryProductList = document.getElementById("categoryProductList");
const categoryResultCount = document.getElementById("categoryResultCount");
const categoryLoading = document.getElementById("categoryLoading");
const categorySentinel = document.getElementById("categorySentinel");

const bestSellingList = document.getElementById("bestSellingList");
const mostViewedList = document.getElementById("mostViewedList");
const bestSellingPage = document.getElementById("bestSellingPage");
const mostViewedPage = document.getElementById("mostViewedPage");

function productCard(item) {
  return `
    <a class="product-card" href="/products/${item.id}">
      <img src="${item.images[0]}" alt="${item.name}" />
      <div class="card-body">
        <span class="card-badge">${item.category}</span>
        <span class="card-name">${item.name}</span>
        <span class="card-price">${formatter.format(item.price)}đ</span>
        <span class="card-original-price">${formatter.format(item.originalPrice)}đ</span>
        <span class="card-meta">★ ${item.rating} · Còn ${item.stock}</span>
      </div>
    </a>
  `;
}

function topCard(item, rank, mode) {
  const metric = mode === "most-viewed"
    ? `👁 ${formatter.format(item.viewCount)} lượt xem`
    : `📦 ${formatter.format(item.soldCount)} đã bán`;
  return `
    <a href="/products/${item.id}" style="display:flex;align-items:center;gap:.65rem;padding:.45rem .5rem;border-radius:8px;text-decoration:none;color:inherit;transition:background .15s;" onmouseover="this.style.background='var(--clr-bg)'" onmouseout="this.style.background='transparent'">
      <span style="min-width:22px;height:22px;border-radius:50%;background:var(--clr-primary-faint);color:var(--clr-primary);font-size:.7rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${rank}</span>
      <span style="flex:1;font-size:.82rem;font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</span>
      <span style="font-size:.72rem;color:var(--clr-muted);white-space:nowrap;">${metric}</span>
    </a>
  `;
}

function renderProducts(items) {
  resultCount.textContent = `${items.length} sản phẩm`;
  if (!items.length) {
    productList.innerHTML = `
      <div style="grid-column:1/-1;background:var(--clr-surface);border-radius:var(--radius-lg);padding:2rem;text-align:center;color:var(--clr-muted);border:1px dashed var(--clr-border);">
        Không tìm thấy sản phẩm phù hợp bộ lọc.
      </div>
    `;
    return;
  }
  productList.innerHTML = items.map(productCard).join("");
}

async function fetchFilteredProducts(params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`/api/products?${query.toString()}`);
  const data = await response.json();
  return data.data || [];
}

filterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const rawEntries = new FormData(filterForm).entries();
  const payload = {};
  for (const [key, value] of rawEntries) {
    if (value !== "") payload[key] = value;
  }
  if (!payload.sort) payload.sort = "newest";

  const items = await fetchFilteredProducts(payload);
  renderProducts(items);
});

const categories = window.__CATEGORIES__ || [];
const categoryState = {
  activeCategory: categories[0] || "",
  page: 1,
  totalPages: 1,
  total: 0,
  isLoading: false
};

function setCategoryLoading(isLoading) {
  categoryState.isLoading = isLoading;
  if (categoryLoading) categoryLoading.classList.toggle("hidden", !isLoading);
}

function setActiveCategoryButton(category) {
  if (!categoryTabs) return;
  const buttons = categoryTabs.querySelectorAll(".cat-tab");
  buttons.forEach((button) => {
    const isActive = button.dataset.category === category;
    button.classList.toggle("active", isActive);
  });
}

async function fetchCategoryProducts(category, page = 1, limit = 8) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await fetch(`/api/categories/${encodeURIComponent(category)}/products?${query.toString()}`);
  return response.json();
}

function renderCategoryProducts(items, append = false) {
  if (!append) {
    categoryProductList.innerHTML = "";
  }
  if (!items.length && !append) {
    categoryProductList.innerHTML = `
      <div class="col-span-full bg-slate-50 rounded-xl p-5 text-center text-slate-500">
        Danh mục này chưa có sản phẩm.
      </div>
    `;
    return;
  }
  categoryProductList.insertAdjacentHTML("beforeend", items.map(productCard).join(""));
}

function updateCategoryCount() {
  categoryResultCount.textContent = `${categoryState.activeCategory}: ${categoryState.total} sản phẩm`;
}

async function loadCategoryPage(page, append = false) {
  if (!categoryState.activeCategory || categoryState.isLoading) return;
  setCategoryLoading(true);
  try {
    const response = await fetchCategoryProducts(categoryState.activeCategory, page, 8);
    const items = response.data || [];
    const meta = response.meta || {};
    categoryState.page = meta.page || 1;
    categoryState.totalPages = meta.totalPages || 1;
    categoryState.total = meta.total || 0;
    updateCategoryCount();
    renderCategoryProducts(items, append);
  } finally {
    setCategoryLoading(false);
  }
}

async function resetCategoryFeed(category) {
  categoryState.activeCategory = category;
  categoryState.page = 1;
  categoryState.totalPages = 1;
  categoryState.total = 0;
  setActiveCategoryButton(category);
  await loadCategoryPage(1, false);
}

if (categoryTabs) {
  categoryTabs.addEventListener("click", async (event) => {
    const button = event.target.closest(".cat-tab");
    if (!button) return;
    const category = button.dataset.category || "";
    if (!category || category === categoryState.activeCategory) return;
    await resetCategoryFeed(category);
  });
}

const lazyObserver = new IntersectionObserver(
  async (entries) => {
    const firstEntry = entries[0];
    if (!firstEntry?.isIntersecting) return;
    if (categoryState.isLoading || categoryState.page >= categoryState.totalPages) return;
    await loadCategoryPage(categoryState.page + 1, true);
  },
  { rootMargin: "250px 0px 250px 0px" }
);

if (categorySentinel) lazyObserver.observe(categorySentinel);

const topStates = {
  "best-selling": {
    page: 1,
    totalPages: 1,
    listEl: bestSellingList,
    pageEl: bestSellingPage
  },
  "most-viewed": {
    page: 1,
    totalPages: 1,
    listEl: mostViewedList,
    pageEl: mostViewedPage
  }
};

async function fetchTopProducts(type, page = 1, limit = 5) {
  const query = new URLSearchParams({ type, page: String(page), limit: String(limit) });
  const response = await fetch(`/api/products/top?${query.toString()}`);
  return response.json();
}

async function loadTopProducts(type, page = 1) {
  const state = topStates[type];
  const response = await fetchTopProducts(type, page, 5);
  const items = response.data || [];
  const meta = response.meta || {};
  state.page = meta.page || 1;
  state.totalPages = meta.totalPages || 1;
  const offset = (state.page - 1) * 5;
  state.listEl.innerHTML = items.map((item, index) => topCard(item, offset + index + 1, type)).join("");
  state.pageEl.textContent = `Trang ${state.page}/${state.totalPages}`;
}

document.querySelectorAll(".top-nav-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    const type = button.dataset.topType;
    const action = button.dataset.topAction;
    const state = topStates[type];
    if (!state) return;
    if (action === "prev" && state.page > 1) {
      await loadTopProducts(type, state.page - 1);
    }
    if (action === "next" && state.page < state.totalPages) {
      await loadTopProducts(type, state.page + 1);
    }
  });
});

renderProducts(window.__PRODUCTS__ || []);
loadTopProducts("best-selling", 1);
loadTopProducts("most-viewed", 1);
if (categoryTabs && categoryState.activeCategory) {
  resetCategoryFeed(categoryState.activeCategory);
}
