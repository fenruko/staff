/* Runtime configuration, edited in place; no build step needed.
 *   apiBase      Base URL of the bot's API (no trailing slash).
 *   dashboardUrl Where users appeal blacklists (legacy /appeal/<token> links redirect here).
 *   demo         true = use the in-browser mock backend (sign in as "demo"). */
window.STAFF_CONFIG = {
  apiBase: "https://api.rift.cool",
  dashboardUrl: "https://dash.rift.cool",
  demo: false,
};
