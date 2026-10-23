import type { DashboardUser } from "@/contexts/AuthContext"

export const MANAGER_PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  ORDERS_VIEW: "orders.view",
  ORDERS_MANAGE: "orders.manage",
  ORDERS_RECONCILE: "orders.reconcile",
  ORDERS_RECONCILIATION_VIEW: "orders.reconciliation.view",
  TRANSACTIONS_VIEW: "transactions.view",
  RESERVATIONS_VIEW: "reservations.view",
  RESERVATIONS_MANAGE: "reservations.manage",
  MENU_VIEW: "menu.view",
  MENU_MANAGE: "menu.manage",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_MANAGE: "inventory.manage",
  INVENTORY_RECEIVE: "inventory.receive",
  INVENTORY_WASTE: "inventory.waste",
  INVENTORY_ADJUST: "inventory.adjust",
  INVENTORY_RECIPE_MANAGE: "inventory.recipe.manage",
  INVENTORY_ROOM_USAGE_RECORD: "inventory.roomUsage.record",
  HOUSEKEEPING_VIEW: "housekeeping.view",
  HOUSEKEEPING_PERFORM: "housekeeping.perform",
  HOUSEKEEPING_ASSIGN: "housekeeping.assign",
  HOUSEKEEPING_MANAGE: "housekeeping.manage",
  SERVICE_POINTS_VIEW: "servicePoints.view",
  SERVICE_POINTS_MANAGE: "servicePoints.manage",
  STAFF_VIEW: "staff.view",
  STAFF_MANAGE: "staff.manage",
  ANALYTICS_VIEW: "analytics.view",
  FEEDBACK_VIEW: "feedback.view",
  CRM_VIEW: "crm.view",
  AI_ANALYST_VIEW: "aiAnalyst.view",
  SETTINGS_OPERATIONAL_MANAGE: "settings.operational.manage",
} as const

export type ManagerPermission = typeof MANAGER_PERMISSIONS[keyof typeof MANAGER_PERMISSIONS]

export const MANAGEMENT_ACCESS_AREAS = {
  DASHBOARD: "dashboard",
  ORDERS: "orders",
  RESERVATIONS: "reservations",
  TRANSACTIONS: "transactions",
  MENU: "menu",
  INVENTORY: "inventory",
  HOUSEKEEPING: "housekeeping",
  SERVICE_POINTS: "service_points",
  STAFF_MANAGEMENT: "staff_management",
  ANALYTICS: "analytics",
  FEEDBACK: "feedback",
  CRM: "crm",
  AI_ANALYST: "ai_analyst",
  BUSINESS_SETTINGS: "business_settings",
  BRANDING: "branding",
  PAYMENTS_AND_BILLING: "payments_billing",
} as const

export type ManagementAccessArea = typeof MANAGEMENT_ACCESS_AREAS[keyof typeof MANAGEMENT_ACCESS_AREAS]

export const MANAGEMENT_ACCESS_AREA_VALUES = Object.values(MANAGEMENT_ACCESS_AREAS)

export const MANAGEMENT_AREA_BY_PERMISSION: Record<ManagerPermission, ManagementAccessArea> = {
  [MANAGER_PERMISSIONS.DASHBOARD_VIEW]: MANAGEMENT_ACCESS_AREAS.DASHBOARD,
  [MANAGER_PERMISSIONS.ORDERS_VIEW]: MANAGEMENT_ACCESS_AREAS.ORDERS,
  [MANAGER_PERMISSIONS.ORDERS_MANAGE]: MANAGEMENT_ACCESS_AREAS.ORDERS,
  [MANAGER_PERMISSIONS.ORDERS_RECONCILE]: MANAGEMENT_ACCESS_AREAS.ORDERS,
  [MANAGER_PERMISSIONS.ORDERS_RECONCILIATION_VIEW]: MANAGEMENT_ACCESS_AREAS.ORDERS,
  [MANAGER_PERMISSIONS.TRANSACTIONS_VIEW]: MANAGEMENT_ACCESS_AREAS.TRANSACTIONS,
  [MANAGER_PERMISSIONS.RESERVATIONS_VIEW]: MANAGEMENT_ACCESS_AREAS.RESERVATIONS,
  [MANAGER_PERMISSIONS.RESERVATIONS_MANAGE]: MANAGEMENT_ACCESS_AREAS.RESERVATIONS,
  [MANAGER_PERMISSIONS.MENU_VIEW]: MANAGEMENT_ACCESS_AREAS.MENU,
  [MANAGER_PERMISSIONS.MENU_MANAGE]: MANAGEMENT_ACCESS_AREAS.MENU,
  [MANAGER_PERMISSIONS.INVENTORY_VIEW]: MANAGEMENT_ACCESS_AREAS.INVENTORY,
  [MANAGER_PERMISSIONS.INVENTORY_MANAGE]: MANAGEMENT_ACCESS_AREAS.INVENTORY,
  [MANAGER_PERMISSIONS.INVENTORY_RECEIVE]: MANAGEMENT_ACCESS_AREAS.INVENTORY,
  [MANAGER_PERMISSIONS.INVENTORY_WASTE]: MANAGEMENT_ACCESS_AREAS.INVENTORY,
  [MANAGER_PERMISSIONS.INVENTORY_ADJUST]: MANAGEMENT_ACCESS_AREAS.INVENTORY,
  [MANAGER_PERMISSIONS.INVENTORY_RECIPE_MANAGE]: MANAGEMENT_ACCESS_AREAS.INVENTORY,
  [MANAGER_PERMISSIONS.INVENTORY_ROOM_USAGE_RECORD]: MANAGEMENT_ACCESS_AREAS.INVENTORY,
  [MANAGER_PERMISSIONS.HOUSEKEEPING_VIEW]: MANAGEMENT_ACCESS_AREAS.HOUSEKEEPING,
  [MANAGER_PERMISSIONS.HOUSEKEEPING_PERFORM]: MANAGEMENT_ACCESS_AREAS.HOUSEKEEPING,
  [MANAGER_PERMISSIONS.HOUSEKEEPING_ASSIGN]: MANAGEMENT_ACCESS_AREAS.HOUSEKEEPING,
  [MANAGER_PERMISSIONS.HOUSEKEEPING_MANAGE]: MANAGEMENT_ACCESS_AREAS.HOUSEKEEPING,
  [MANAGER_PERMISSIONS.SERVICE_POINTS_VIEW]: MANAGEMENT_ACCESS_AREAS.SERVICE_POINTS,
  [MANAGER_PERMISSIONS.SERVICE_POINTS_MANAGE]: MANAGEMENT_ACCESS_AREAS.SERVICE_POINTS,
  [MANAGER_PERMISSIONS.STAFF_VIEW]: MANAGEMENT_ACCESS_AREAS.STAFF_MANAGEMENT,
  [MANAGER_PERMISSIONS.STAFF_MANAGE]: MANAGEMENT_ACCESS_AREAS.STAFF_MANAGEMENT,
  [MANAGER_PERMISSIONS.ANALYTICS_VIEW]: MANAGEMENT_ACCESS_AREAS.ANALYTICS,
  [MANAGER_PERMISSIONS.FEEDBACK_VIEW]: MANAGEMENT_ACCESS_AREAS.FEEDBACK,
  [MANAGER_PERMISSIONS.CRM_VIEW]: MANAGEMENT_ACCESS_AREAS.CRM,
  [MANAGER_PERMISSIONS.AI_ANALYST_VIEW]: MANAGEMENT_ACCESS_AREAS.AI_ANALYST,
  [MANAGER_PERMISSIONS.SETTINGS_OPERATIONAL_MANAGE]: MANAGEMENT_ACCESS_AREAS.BUSINESS_SETTINGS,
}

export const CO_OWNER_ACCESS_GROUPS: Array<{
  label: string
  areas: Array<{ key: ManagementAccessArea; label: string }>
}> = [
  {
    label: "Operations",
    areas: [
      { key: MANAGEMENT_ACCESS_AREAS.DASHBOARD, label: "Dashboard / Operations" },
      { key: MANAGEMENT_ACCESS_AREAS.ORDERS, label: "Orders" },
      { key: MANAGEMENT_ACCESS_AREAS.RESERVATIONS, label: "Reservations" },
      { key: MANAGEMENT_ACCESS_AREAS.TRANSACTIONS, label: "Transactions" },
      { key: MANAGEMENT_ACCESS_AREAS.MENU, label: "Menu" },
      { key: MANAGEMENT_ACCESS_AREAS.INVENTORY, label: "Inventory" },
      { key: MANAGEMENT_ACCESS_AREAS.HOUSEKEEPING, label: "Housekeeping" },
      { key: MANAGEMENT_ACCESS_AREAS.SERVICE_POINTS, label: "Service Points" },
    ],
  },
  {
    label: "Management",
    areas: [
      { key: MANAGEMENT_ACCESS_AREAS.STAFF_MANAGEMENT, label: "Staff Management" },
      { key: MANAGEMENT_ACCESS_AREAS.ANALYTICS, label: "Analytics" },
      { key: MANAGEMENT_ACCESS_AREAS.FEEDBACK, label: "Feedback" },
      { key: MANAGEMENT_ACCESS_AREAS.CRM, label: "Guests / CRM" },
      { key: MANAGEMENT_ACCESS_AREAS.AI_ANALYST, label: "AI Business Analyst" },
      { key: MANAGEMENT_ACCESS_AREAS.BUSINESS_SETTINGS, label: "Business Settings" },
      { key: MANAGEMENT_ACCESS_AREAS.BRANDING, label: "Branding" },
    ],
  },
  {
    label: "Financial",
    areas: [
      { key: MANAGEMENT_ACCESS_AREAS.PAYMENTS_AND_BILLING, label: "Payments & Billing" },
    ],
  },
]

export const MANAGER_PERMISSION_VALUES = Object.values(MANAGER_PERMISSIONS)

export const MANAGER_PERMISSION_DEPENDENCIES: Partial<Record<ManagerPermission, ManagerPermission>> = {
  [MANAGER_PERMISSIONS.ORDERS_MANAGE]: MANAGER_PERMISSIONS.ORDERS_VIEW,
  [MANAGER_PERMISSIONS.RESERVATIONS_MANAGE]: MANAGER_PERMISSIONS.RESERVATIONS_VIEW,
  [MANAGER_PERMISSIONS.MENU_MANAGE]: MANAGER_PERMISSIONS.MENU_VIEW,
  [MANAGER_PERMISSIONS.INVENTORY_MANAGE]: MANAGER_PERMISSIONS.INVENTORY_VIEW,
  [MANAGER_PERMISSIONS.INVENTORY_RECEIVE]: MANAGER_PERMISSIONS.INVENTORY_VIEW,
  [MANAGER_PERMISSIONS.INVENTORY_WASTE]: MANAGER_PERMISSIONS.INVENTORY_VIEW,
  [MANAGER_PERMISSIONS.INVENTORY_ADJUST]: MANAGER_PERMISSIONS.INVENTORY_VIEW,
  [MANAGER_PERMISSIONS.INVENTORY_RECIPE_MANAGE]: MANAGER_PERMISSIONS.INVENTORY_VIEW,
  [MANAGER_PERMISSIONS.HOUSEKEEPING_PERFORM]: MANAGER_PERMISSIONS.HOUSEKEEPING_VIEW,
  [MANAGER_PERMISSIONS.HOUSEKEEPING_ASSIGN]: MANAGER_PERMISSIONS.HOUSEKEEPING_VIEW,
  [MANAGER_PERMISSIONS.HOUSEKEEPING_MANAGE]: MANAGER_PERMISSIONS.HOUSEKEEPING_VIEW,
  [MANAGER_PERMISSIONS.SERVICE_POINTS_MANAGE]: MANAGER_PERMISSIONS.SERVICE_POINTS_VIEW,
  [MANAGER_PERMISSIONS.STAFF_MANAGE]: MANAGER_PERMISSIONS.STAFF_VIEW,
}

export const MANAGER_PERMISSION_GROUPS: Array<{
  label: string
  permissions: Array<{ key: ManagerPermission; label: string }>
}> = [
  {
    label: "Housekeeping",
    permissions: [
      { key: MANAGER_PERMISSIONS.HOUSEKEEPING_VIEW, label: "View Housekeeping" },
      { key: MANAGER_PERMISSIONS.HOUSEKEEPING_PERFORM, label: "Perform Housekeeping" },
      { key: MANAGER_PERMISSIONS.HOUSEKEEPING_ASSIGN, label: "Assign Housekeeping" },
      { key: MANAGER_PERMISSIONS.HOUSEKEEPING_MANAGE, label: "Manage Housekeeping Operations" },
    ],
  },
  {
    label: "General",
    permissions: [{ key: MANAGER_PERMISSIONS.DASHBOARD_VIEW, label: "Dashboard" }],
  },
  {
    label: "Orders",
    permissions: [
      { key: MANAGER_PERMISSIONS.ORDERS_VIEW, label: "View Orders" },
      { key: MANAGER_PERMISSIONS.ORDERS_MANAGE, label: "Manage Orders" },
    ],
  },
  {
    label: "Reservations",
    permissions: [
      { key: MANAGER_PERMISSIONS.RESERVATIONS_VIEW, label: "View Reservations" },
      { key: MANAGER_PERMISSIONS.RESERVATIONS_MANAGE, label: "Manage Reservations" },
    ],
  },
  {
    label: "Menu & Service",
    permissions: [
      { key: MANAGER_PERMISSIONS.MENU_VIEW, label: "View Menu" },
      { key: MANAGER_PERMISSIONS.MENU_MANAGE, label: "Manage Menu" },
      { key: MANAGER_PERMISSIONS.SERVICE_POINTS_VIEW, label: "View Service Points" },
      { key: MANAGER_PERMISSIONS.SERVICE_POINTS_MANAGE, label: "Manage Service Points" },
    ],
  },
  {
    label: "Inventory",
    permissions: [
      { key: MANAGER_PERMISSIONS.INVENTORY_VIEW, label: "View Inventory" },
      { key: MANAGER_PERMISSIONS.INVENTORY_MANAGE, label: "Manage Inventory Items" },
      { key: MANAGER_PERMISSIONS.INVENTORY_RECEIVE, label: "Receive Inventory" },
      { key: MANAGER_PERMISSIONS.INVENTORY_WASTE, label: "Record Inventory Waste" },
      { key: MANAGER_PERMISSIONS.INVENTORY_ADJUST, label: "Adjust Inventory" },
      { key: MANAGER_PERMISSIONS.INVENTORY_RECIPE_MANAGE, label: "Manage Ingredient Recipes" },
      { key: MANAGER_PERMISSIONS.INVENTORY_ROOM_USAGE_RECORD, label: "Record Room Usage" },
    ],
  },
  {
    label: "Team",
    permissions: [
      { key: MANAGER_PERMISSIONS.STAFF_VIEW, label: "View Staff" },
      { key: MANAGER_PERMISSIONS.STAFF_MANAGE, label: "Manage Operational Staff" },
    ],
  },
  {
    label: "Insights",
    permissions: [
      { key: MANAGER_PERMISSIONS.TRANSACTIONS_VIEW, label: "View Transactions" },
      { key: MANAGER_PERMISSIONS.ANALYTICS_VIEW, label: "View Analytics" },
      { key: MANAGER_PERMISSIONS.FEEDBACK_VIEW, label: "View Customer Feedback" },
      { key: MANAGER_PERMISSIONS.CRM_VIEW, label: "View Guests / CRM" },
      { key: MANAGER_PERMISSIONS.AI_ANALYST_VIEW, label: "View AI Business Analyst" },
    ],
  },
  {
    label: "Operations",
    permissions: [
      { key: MANAGER_PERMISSIONS.SETTINGS_OPERATIONAL_MANAGE, label: "Manage Operational Settings" },
    ],
  },
]

const PRIMARY_OWNER_BYPASS_ROLES = new Set(["owner", "restaurant_owner", "admin"])
const STAFF_PERMISSION_ROLES = new Set(["manager", "housekeeping"])

export function hasManagementArea(
  user: Pick<DashboardUser, "role" | "permissions" | "coOwnerRestrictions" | "managementAccessAreas"> | null | undefined,
  area: ManagementAccessArea,
) {
  if (!user) return false
  if (PRIMARY_OWNER_BYPASS_ROLES.has(user.role)) return true
  if (Array.isArray(user.managementAccessAreas)) {
    return user.managementAccessAreas.includes(area)
  }
  if (user.role === "co_owner") {
    return !(user.coOwnerRestrictions || []).includes(area)
  }
  if (user.role === "manager") {
    return (user.permissions || []).some((permission) => (
      MANAGEMENT_AREA_BY_PERMISSION[permission as ManagerPermission] === area
    ))
  }
  return false
}

export function hasManagementPermission(
  user: Pick<DashboardUser, "role" | "permissions" | "coOwnerRestrictions" | "managementAccessAreas"> | null | undefined,
  permission: string,
) {
  if (!user) return false
  if (PRIMARY_OWNER_BYPASS_ROLES.has(user.role)) return true
  if (user.role === "co_owner") {
    const area = MANAGEMENT_AREA_BY_PERMISSION[permission as ManagerPermission]
    return Boolean(area && hasManagementArea(user, area))
  }
  return STAFF_PERMISSION_ROLES.has(user.role) && (user.permissions || []).includes(permission)
}

export function toggleManagerPermission(
  current: string[],
  permission: ManagerPermission,
): string[] {
  const next = new Set(current)

  if (next.has(permission)) {
    next.delete(permission)
    for (const [managePermission, viewPermission] of Object.entries(MANAGER_PERMISSION_DEPENDENCIES)) {
      if (viewPermission === permission) next.delete(managePermission)
    }
  } else {
    next.add(permission)
    const dependency = MANAGER_PERMISSION_DEPENDENCIES[permission]
    if (dependency) next.add(dependency)
  }

  return MANAGER_PERMISSION_VALUES.filter((key) => next.has(key))
}

const FIRST_PAGE_BY_PERMISSION: Array<[ManagerPermission, string]> = [
  [MANAGER_PERMISSIONS.DASHBOARD_VIEW, "/owner/dashboard"],
  [MANAGER_PERMISSIONS.ORDERS_VIEW, "/owner/orders"],
  [MANAGER_PERMISSIONS.TRANSACTIONS_VIEW, "/owner/transactions"],
  [MANAGER_PERMISSIONS.RESERVATIONS_VIEW, "/owner/reservations"],
  [MANAGER_PERMISSIONS.HOUSEKEEPING_VIEW, "/housekeeping"],
  [MANAGER_PERMISSIONS.MENU_VIEW, "/owner/menu"],
  [MANAGER_PERMISSIONS.INVENTORY_VIEW, "/owner/inventory"],
  [MANAGER_PERMISSIONS.SERVICE_POINTS_VIEW, "/owner/service-points"],
  [MANAGER_PERMISSIONS.STAFF_VIEW, "/owner/staff"],
  [MANAGER_PERMISSIONS.ANALYTICS_VIEW, "/owner/analytics"],
  [MANAGER_PERMISSIONS.FEEDBACK_VIEW, "/owner/feedback"],
  [MANAGER_PERMISSIONS.CRM_VIEW, "/owner/guests"],
  [MANAGER_PERMISSIONS.AI_ANALYST_VIEW, "/owner/ai-business-analyst"],
  [MANAGER_PERMISSIONS.SETTINGS_OPERATIONAL_MANAGE, "/owner/settings"],
]

export function getFirstPermittedManagementPath(user: DashboardUser | null | undefined) {
  if (!user) return "/login"
  if (user.role === "housekeeping") {
    return hasManagementPermission(user, MANAGER_PERMISSIONS.HOUSEKEEPING_VIEW)
      ? "/housekeeping"
      : "/login"
  }
  if (PRIMARY_OWNER_BYPASS_ROLES.has(user.role)) return "/owner/dashboard"
  if (user.role === "co_owner") {
    const firstCoOwnerPage: Array<[ManagementAccessArea, string]> = [
      [MANAGEMENT_ACCESS_AREAS.DASHBOARD, "/owner/dashboard"],
      [MANAGEMENT_ACCESS_AREAS.ORDERS, "/owner/orders"],
      [MANAGEMENT_ACCESS_AREAS.RESERVATIONS, "/owner/reservations"],
      [MANAGEMENT_ACCESS_AREAS.HOUSEKEEPING, "/housekeeping"],
      [MANAGEMENT_ACCESS_AREAS.TRANSACTIONS, "/owner/transactions"],
      [MANAGEMENT_ACCESS_AREAS.MENU, "/owner/menu"],
      [MANAGEMENT_ACCESS_AREAS.INVENTORY, "/owner/inventory"],
      [MANAGEMENT_ACCESS_AREAS.SERVICE_POINTS, "/owner/service-points"],
      [MANAGEMENT_ACCESS_AREAS.STAFF_MANAGEMENT, "/owner/staff"],
      [MANAGEMENT_ACCESS_AREAS.ANALYTICS, "/owner/analytics"],
      [MANAGEMENT_ACCESS_AREAS.FEEDBACK, "/owner/feedback"],
      [MANAGEMENT_ACCESS_AREAS.CRM, "/owner/guests"],
      [MANAGEMENT_ACCESS_AREAS.AI_ANALYST, "/owner/ai-business-analyst"],
      [MANAGEMENT_ACCESS_AREAS.BUSINESS_SETTINGS, "/owner/settings"],
      [MANAGEMENT_ACCESS_AREAS.BRANDING, "/owner/branding"],
      [MANAGEMENT_ACCESS_AREAS.PAYMENTS_AND_BILLING, "/owner/billing"],
    ]
    return firstCoOwnerPage.find(([area]) => hasManagementArea(user, area))?.[1]
      || "/owner/access-denied"
  }
  const match = FIRST_PAGE_BY_PERMISSION.find(([permission]) => hasManagementPermission(user, permission))
  return match?.[1] || "/owner/access-denied"
}

export type ManagementPageAccess = {
  requiredPermission?: ManagerPermission
  requiredRole?: "owner" | "primary_owner"
  requiredArea?: ManagementAccessArea
}

export function resolveManagementPageAccess(pathname: string): ManagementPageAccess {
  if (pathname.startsWith("/owner/settings/team-access") || pathname.startsWith("/owner/confirm-email")) {
    return { requiredRole: "primary_owner" }
  }
  if (pathname.startsWith("/owner/billing")) {
    return { requiredArea: MANAGEMENT_ACCESS_AREAS.PAYMENTS_AND_BILLING }
  }
  if (pathname.startsWith("/owner/branding")) {
    return { requiredArea: MANAGEMENT_ACCESS_AREAS.BRANDING }
  }
  if (pathname.startsWith("/owner/property-profile")) {
    return { requiredArea: MANAGEMENT_ACCESS_AREAS.BUSINESS_SETTINGS }
  }

  const permissionRoutes: Array<[string, ManagerPermission]> = [
    ["/owner/dashboard", MANAGER_PERMISSIONS.DASHBOARD_VIEW],
    ["/owner/orders", MANAGER_PERMISSIONS.ORDERS_VIEW],
    ["/owner/transactions", MANAGER_PERMISSIONS.TRANSACTIONS_VIEW],
    ["/owner/reservations", MANAGER_PERMISSIONS.RESERVATIONS_VIEW],
    ["/owner/menu", MANAGER_PERMISSIONS.MENU_VIEW],
    ["/owner/inventory", MANAGER_PERMISSIONS.INVENTORY_VIEW],
    ["/owner/service-points", MANAGER_PERMISSIONS.SERVICE_POINTS_VIEW],
    ["/owner/staff", MANAGER_PERMISSIONS.STAFF_VIEW],
    ["/owner/analytics", MANAGER_PERMISSIONS.ANALYTICS_VIEW],
    ["/owner/feedback", MANAGER_PERMISSIONS.FEEDBACK_VIEW],
    ["/owner/guests", MANAGER_PERMISSIONS.CRM_VIEW],
    ["/owner/ai-business-analyst", MANAGER_PERMISSIONS.AI_ANALYST_VIEW],
    ["/owner/settings", MANAGER_PERMISSIONS.SETTINGS_OPERATIONAL_MANAGE],
  ]

  const match = permissionRoutes.find(([route]) => pathname === route || pathname.startsWith(`${route}/`))
  return match ? { requiredPermission: match[1] } : {}
}
