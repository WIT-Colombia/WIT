const localUrls = {
  landing: "http://127.0.0.1:5175",
  usuario: "http://127.0.0.1:5173",
  business: "http://127.0.0.1:5174",
  admin: "http://127.0.0.1:5176",
  api: "http://127.0.0.1:3000",
} as const;

const productionUrls = {
  landing: "https://xamuko.com",
  usuario: "https://user.xamuko.com",
  business: "https://business.xamuko.com",
  admin: "https://admin.xamuko.com",
  api: "https://api.xamuko.com",
} as const;

const isLocalDevelopment = typeof window !== "undefined" &&\n  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");\n\nexport const publicUrls = isLocalDevelopment ? localUrls : productionUrls;

export const apiBaseUrl = `${publicUrls.api}/api/v1`;
