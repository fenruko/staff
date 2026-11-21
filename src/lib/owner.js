// The staff account that owns this Rift deployment. The UI uses it only to
// decide what to offer (for example, editing your own permissions); the bot's
// API is the source of truth and enforces the same rule server-side.
export const OWNER_USERNAME = "fenruko";

export function isOwnerAccount(user) {
  return typeof user?.username === "string" && user.username.toLowerCase() === OWNER_USERNAME;
}

// An account must keep Full access or staff.manage, otherwise nobody can reach
// the Staff page to give it back.
export function keepsStaffManagement(permissions) {
  return Array.isArray(permissions) && (permissions.includes("*") || permissions.includes("staff.manage"));
}
