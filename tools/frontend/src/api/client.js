const API_BASE = "";

async function request(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : { "Content-Type": "application/json", ...(options.headers || {}) };
  const url = `${API_BASE}${path}`;
  let res;
  try {
    res = await fetch(url, {
      headers,
      ...options,
    });
  } catch (err) {
    const method = options.method || "GET";
    const msg = err?.message || "network error";
    throw new Error(`[${method}] ${url} 网络失败: ${msg}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const method = options.method || "GET";
    throw new Error(data.error || `[${method}] ${url} 请求失败 (${res.status})`);
  }
  return data;
}

export const api = {
  base: API_BASE,
  health: () => request("/health"),
  cleanUpload: async (files) => {
    const form = new FormData();
    files.forEach((f, idx) => {
      const real = f?.originFileObj || f;
      const name = real?.name || f?.name || `upload_${idx}.bin`;
      form.append("files", real, name);
    });
    return request("/clean/upload", { method: "POST", body: form });
  },
  cleanPreview: (paths) =>
    request("/clean/preview", { method: "POST", body: JSON.stringify({ paths }) }),
  cleanRun: (paths) =>
    request("/clean/run", { method: "POST", body: JSON.stringify({ paths }) }),
  cleanResult: (taskId) => request(`/clean/result/${taskId}`),
  penetrationOptions: (entryType, q = "") =>
    request(`/penetration/options?entryType=${encodeURIComponent(entryType)}&q=${encodeURIComponent(q)}`),
  runPenetration: (payload) =>
    request("/penetration/run", { method: "POST", body: JSON.stringify(payload) }),
  getPenetration: (taskId) => request(`/penetration/graph/${taskId}`),
  runProfile: (payload) =>
    request("/profile/run", { method: "POST", body: JSON.stringify(payload || {}) }),
  getProfile: (taskId) => request(`/profile/result/${taskId}`),
  generateReport: (payload) =>
    request("/report/generate", { method: "POST", body: JSON.stringify(payload || {}) }),
};
