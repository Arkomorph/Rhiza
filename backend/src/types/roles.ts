export const ROLES = ['super_admin', 'admin_bureau', 'admin_local', 'contributeur', 'lecteur'] as const;
export type Role = typeof ROLES[number];

const ROLE_RANK: Record<Role, number> = {
  super_admin: 4,
  admin_bureau: 3,
  admin_local: 2,
  contributeur: 1,
  lecteur: 0,
};

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole];
}
