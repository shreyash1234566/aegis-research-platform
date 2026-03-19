export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
const normalizeOAuthPortalUrl = (rawUrl: string): string => {
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  return `https://${rawUrl}`;
};

export const getLoginUrl = (): string | null => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL?.trim();
  const appId = import.meta.env.VITE_APP_ID?.trim();

  if (!oauthPortalUrl || !appId) {
    console.error(
      "[Auth] Missing VITE_OAUTH_PORTAL_URL or VITE_APP_ID. Login URL cannot be generated."
    );
    return null;
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  try {
    const url = new URL("/app-auth", normalizeOAuthPortalUrl(oauthPortalUrl));
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (error) {
    console.error(
      "[Auth] Invalid VITE_OAUTH_PORTAL_URL. Login URL cannot be generated.",
      error
    );
    return null;
  }
};
