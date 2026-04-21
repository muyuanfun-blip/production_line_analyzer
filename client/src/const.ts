export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Local-only auth: always redirect to the built-in login page.
export const getLoginUrl = (_returnPath?: string) => "/login";
