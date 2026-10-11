// Read-only smoke check of the public deployment; no account or real token is used.
const { randomBytes } = require("node:crypto");
const frontend = "https://task-it-gamma-six.vercel.app";
const get = (url, options = {}) => fetch(url, { signal: AbortSignal.timeout(60000), ...options });

(async () => {
  const root = await get(frontend);
  const rootHtml = await root.text();
  const route = await get(`${frontend}/invitations/${randomBytes(32).toString("hex")}`);
  const routeHtml = await route.text();
  const scripts = [...rootHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => new URL(match[1], frontend));
  const bundles = await Promise.all(scripts.filter((url) => url.origin === frontend).map(async (url) => (await get(url)).text()));
  const bundle = bundles.join("\n");
  const apiUrls = [...new Set([...bundle.matchAll(/baseURL:\s*["'`]([^"'`]+)["'`]/g)].map((match) => match[1]))];
  const backendApi = apiUrls.find((url) => /^https:\/\/[^/]+\.onrender\.com\/api\/?$/.test(url));
  const result = {
    frontend, rootStatus: root.status, invitationRouteStatus: route.status,
    invitationRouteServesSameApp: route.ok && routeHtml === rootHtml,
    deployedBundleHasInvitationRoute: bundle.includes("/invitations/:token"), apiUrls,
  };
  if (backendApi) {
    const health = await get(new URL("/", backendApi));
    result.renderBackend = new URL(backendApi).origin;
    result.backendStatus = health.status;
    const profile = await get(`${backendApi.replace(/\/$/, "")}/auth/profile`, { headers: { Origin: frontend } });
    result.protectedApiStatus = profile.status;
    result.allowedFrontendOrigin = profile.headers.get("access-control-allow-origin");
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.invitationRouteServesSameApp || !result.deployedBundleHasInvitationRoute || !backendApi) process.exitCode = 1;
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
