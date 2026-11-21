import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { isOwnerAccount, keepsStaffManagement } from "../src/lib/owner";

const state = vi.hoisted(() => ({ user: null }));

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({ user: state.user, hasPermission: () => true }),
}));

vi.mock("../src/lib/api", () => ({
  api: {
    listStaff: vi.fn(),
    permissionCatalog: vi.fn(),
    updateStaff: vi.fn(),
    createStaff: vi.fn(),
    deleteStaff: vi.fn(),
    searchMembers: vi.fn(async () => ({ members: [] })),
  },
}));

import { api } from "../src/lib/api";
import StaffPage from "../src/pages/StaffPage";

const CATALOG = [
  { key: "staff.manage", label: "Manage staff", category: "Staff" },
  { key: "diagnostics.view", label: "View dashboard diagnostics", category: "Dashboard" },
  { key: "economy.view", label: "View economy", category: "Economy" },
];

const OWNER = { id: 1, username: "fenruko", role: "Founder", permissions: ["*"], totp_enabled: true, last_login: 1 };
const MIRA = { id: 2, username: "mira", role: "Support", permissions: ["staff.manage", "economy.view"], totp_enabled: false, last_login: 1 };

class ResizeObserverStub {
  constructor(callback) { this.callback = callback; }
  observe(element) {
    element.getBoundingClientRect = () => ({ width: 400, height: 200, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} });
    this.callback([{ target: element, contentRect: { width: 400, height: 200 } }], this);
  }
  unobserve() {} disconnect() {}
}

beforeAll(() => {
  window.ResizeObserver = ResizeObserverStub;
  window.matchMedia = window.matchMedia || (() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});

// No global auto-cleanup in this setup, so unmount between tests ourselves.
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  api.listStaff.mockResolvedValue([OWNER, MIRA]);
  api.permissionCatalog.mockResolvedValue(CATALOG);
  api.updateStaff.mockResolvedValue({ ok: true });
});

async function openEditorFor(username) {
  render(<StaffPage />);
  const row = (await screen.findByText(username, { selector: "td" })).closest("tr");
  fireEvent.click(within(row).getByText("Edit"));
  return screen.findByText(`Edit ${username}`);
}

describe("owner helpers", () => {
  it("recognises only the fenruko account", () => {
    expect(isOwnerAccount({ username: "fenruko" })).toBe(true);
    expect(isOwnerAccount({ username: "Fenruko" })).toBe(true);
    expect(isOwnerAccount({ username: "mira" })).toBe(false);
    expect(isOwnerAccount(null)).toBe(false);
  });

  it("requires Full access or staff.manage to be kept", () => {
    expect(keepsStaffManagement(["*"])).toBe(true);
    expect(keepsStaffManagement(["staff.manage"])).toBe(true);
    expect(keepsStaffManagement(["economy.view"])).toBe(false);
    expect(keepsStaffManagement([])).toBe(false);
  });
});

describe("Staff permissions editor", () => {
  it("lets the owner edit and save their own permissions", async () => {
    state.user = OWNER;
    await openEditorFor("fenruko");
    expect(screen.getByText(/You're the owner, so you can edit your own permissions/)).toBeTruthy();
    expect(screen.queryByText(/You can't edit your own permissions/)).toBeNull();

    const fullAccess = screen.getByLabelText(/Full access/);
    expect(fullAccess.disabled).toBe(false);
    fireEvent.click(fullAccess); // turn Full access off
    fireEvent.click(screen.getByLabelText("Manage staff"));
    fireEvent.click(screen.getByLabelText("View dashboard diagnostics"));
    fireEvent.click(screen.getByText("Save changes"));

    await waitFor(() => expect(api.updateStaff).toHaveBeenCalledTimes(1));
    const [id, payload] = api.updateStaff.mock.calls[0];
    expect(id).toBe(1);
    expect(payload.permissions).toEqual(["staff.manage", "diagnostics.view"]);
  });

  it("stops the owner from removing their own staff access", async () => {
    state.user = OWNER;
    await openEditorFor("fenruko");
    fireEvent.click(screen.getByLabelText(/Full access/)); // off, nothing else selected
    fireEvent.click(screen.getByText("Save changes"));
    expect(await screen.findByText(/you'd lock yourself out of this page/)).toBeTruthy();
    expect(api.updateStaff).not.toHaveBeenCalled();
  });

  it("keeps everyone else locked out of their own permissions", async () => {
    state.user = MIRA;
    await openEditorFor("mira");
    expect(screen.getByText(/You can't edit your own permissions/)).toBeTruthy();
    expect(screen.getByLabelText("Manage staff").disabled).toBe(true);
    fireEvent.click(screen.getByText("Save changes"));
    await waitFor(() => expect(api.updateStaff).toHaveBeenCalledTimes(1));
    expect(api.updateStaff.mock.calls[0][1]).not.toHaveProperty("permissions");
  });

  it("still lets the owner edit someone else's permissions", async () => {
    state.user = OWNER;
    await openEditorFor("mira");
    expect(screen.queryByText(/You can't edit your own permissions/)).toBeNull();
    fireEvent.click(screen.getByLabelText("View dashboard diagnostics"));
    fireEvent.click(screen.getByText("Save changes"));
    await waitFor(() => expect(api.updateStaff).toHaveBeenCalledTimes(1));
    expect(api.updateStaff.mock.calls[0][1].permissions).toEqual(["staff.manage", "economy.view", "diagnostics.view"]);
  });
});
