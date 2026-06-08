const formatter = new Intl.NumberFormat("vi-VN");
const productList = document.getElementById("productList");
const filterForm = document.getElementById("filterForm");
const resultCount = document.getElementById("resultCount");

const mainProductLoading = document.getElementById("mainProductLoading");
const mainProductSentinel = document.getElementById("mainProductSentinel");

const mainProductState = {
  page: 1,
  totalPages: Math.max(Math.ceil((window.__PRODUCTS_COUNT__ || 0) / (window.__PRODUCTS_LIMIT__ || 8)), 1),
  total: window.__PRODUCTS_COUNT__ || 0,
  isLoading: false,
  filters: {}
};

function setMainProductLoading(isLoading) {
  mainProductState.isLoading = isLoading;
  if (mainProductLoading) {
    mainProductLoading.style.display = isLoading ? "block" : "none";
  }
}

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
      <img src="${item.images[0]}" alt="${item.name}" loading="lazy" />
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
    ? `👁 ${formatter.format(item.viewCount)}`
    : `📦 ${formatter.format(item.soldCount)}`;
  const imgUrl = item.images && item.images.length > 0 ? item.images[0] : '';
  return `
    <a href="/products/${item.id}" style="display:flex;align-items:center;gap:.75rem;padding:.5rem;border-radius:10px;text-decoration:none;color:inherit;transition:all .15s;border:1px solid transparent;" onmouseover="this.style.background='var(--clr-bg)';this.style.borderColor='var(--clr-border)'" onmouseout="this.style.background='transparent';this.style.borderColor='transparent'">
      <span style="min-width:24px;height:24px;border-radius:50%;background:var(--clr-primary-faint);color:var(--clr-primary);font-size:.75rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${rank}</span>
      <img src="${imgUrl}" alt="${item.name}" style="width:48px;height:48px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--clr-border);" loading="lazy" />
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.15rem;">
        <span style="font-size:.82rem;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--clr-text);">${item.name}</span>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;">
          <span style="font-size:.8rem;font-weight:700;color:var(--clr-primary);">${formatter.format(item.price)}đ</span>
          <span style="font-size:.72rem;color:var(--clr-muted);white-space:nowrap;">${metric}</span>
        </div>
      </div>
    </a>
  `;
}

function renderProducts(items, append = false) {
  resultCount.textContent = `${mainProductState.total} sản phẩm`;
  if (!append) {
    productList.innerHTML = "";
  }
  if (!items.length && !append) {
    productList.innerHTML = `
      <div style="grid-column:1/-1;background:var(--clr-surface);border-radius:var(--radius-lg);padding:2rem;text-align:center;color:var(--clr-muted);border:1px dashed var(--clr-border);">
        Không tìm thấy sản phẩm phù hợp bộ lọc.
      </div>
    `;
    return;
  }
  if (append) {
    productList.insertAdjacentHTML("beforeend", items.map(productCard).join(""));
  } else {
    productList.innerHTML = items.map(productCard).join("");
  }
}

async function fetchFilteredProducts(params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`/api/products?${query.toString()}`);
  return response.json();
}

filterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const rawEntries = new FormData(filterForm).entries();
  const payload = {};
  for (const [key, value] of rawEntries) {
    if (value !== "") payload[key] = value;
  }
  if (!payload.sort) payload.sort = "newest";

  mainProductState.filters = payload;
  mainProductState.page = 1;
  mainProductState.total = 0;
  mainProductState.totalPages = 1;
  setMainProductLoading(true);

  try {
    const res = await fetchFilteredProducts({ ...payload, page: 1, limit: 8 });
    const items = res.data || [];
    const meta = res.meta || {};

    mainProductState.page = meta.page || 1;
    mainProductState.totalPages = meta.totalPages || 1;
    mainProductState.total = meta.total || 0;

    renderProducts(items, false);
  } catch (error) {
    console.error("Lỗi khi tải sản phẩm:", error);
  } finally {
    setMainProductLoading(false);
  }
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

async function loadMainProductPage(page, append = false) {
  if (mainProductState.isLoading) return;
  setMainProductLoading(true);
  try {
    const res = await fetchFilteredProducts({ ...mainProductState.filters, page: String(page), limit: "8" });
    const items = res.data || [];
    const meta = res.meta || {};

    mainProductState.page = meta.page || 1;
    mainProductState.totalPages = meta.totalPages || 1;
    mainProductState.total = meta.total || 0;

    renderProducts(items, append);
  } catch (error) {
    console.error("Lỗi khi tải thêm sản phẩm:", error);
  } finally {
    setMainProductLoading(false);
  }
}

const mainProductObserver = new IntersectionObserver(
  async (entries) => {
    const firstEntry = entries[0];
    if (!firstEntry?.isIntersecting) return;
    if (mainProductState.isLoading || mainProductState.page >= mainProductState.totalPages) return;
    await loadMainProductPage(mainProductState.page + 1, true);
  },
  { rootMargin: "250px 0px 250px 0px" }
);

if (mainProductSentinel) mainProductObserver.observe(mainProductSentinel);

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
