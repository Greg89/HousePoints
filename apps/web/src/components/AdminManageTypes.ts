export interface AdminUser {
  id: string;
  displayName: string;
  houseId?: string | null;
}

export interface AdminHouse {
  id: string;
  name: string;
  color?: string;
}
