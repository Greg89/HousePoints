import type { UserRole } from "@housepoints/contracts";

export interface AdminUser {
  id: string;
  displayName: string;
  email?: string | null;
  role: UserRole;
  houseId?: string | null;
}

export interface AdminHouse {
  id: string;
  name: string;
  color?: string;
  description?: string | null;
}
