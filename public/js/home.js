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
    <article class="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <img src="${item.images[0]}" alt="${item.name}" class="w-full h-44 object-cover" />
      <div class="p-3">
        <div class="text-xs text-slate-500 mb-1">${item.category}</div>
        <h3 class="font-semibold mb-1">${item.name}</h3>
        <div class="text-blue-700 font-bold">${formatter.format(item.price)}đ</div>
        <div class="text-xs text-slate-500 mt-1">Tồn: ${item.stock} | Đã bán: ${item.soldCount}</div>
        <a href="/products/${item.id}" class="inline-block mt-3 text-sm text-blue-600 hover:underline">Xem chi tiết</a>
      </div>
    </article>
  `;
}

function topCard(item, rank, mode) {
  const metric = mode === "most-viewed" ? `Lượt xem: ${formatter.format(item.viewCount)}` : `Đã bán: ${item.soldCount}`;
  return `
    <article class="border border-slate-200 rounded-lg p-3">
      <p class="text-xs text-slate-500 mb-1">#${rank} • ${item.category}</p>
      <h4 class="font-semibold mb-1">${item.name}</h4>
      <p class="text-sm text-slate-600">${metric}</p>
      <a href="/products/${item.id}" class="inline-block mt-2 text-sm text-blue-600 hover:underline">Xem chi tiết</a>
    </article>
  `;
}

function renderProducts(items) {
  resultCount.textContent = `${items.length} sản phẩm`;
  if (!items.length) {
    productList.innerHTML = `
      <div class="col-span-full bg-white rounded-xl p-6 text-center text-slate-500">
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
  const buttons = categoryTabs.querySelectorAll(".category-tab");
  buttons.forEach((button) => {
    const isActive = button.dataset.category === category;
    button.className = `category-tab px-3 py-1.5 rounded-full border text-sm ${
      isActive ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-300 text-slate-700"
    }`;
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
    const button = event.target.closest(".category-tab");
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
