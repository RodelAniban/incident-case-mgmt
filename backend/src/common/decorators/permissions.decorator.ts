import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions';

export const PERMISSIONS_KEY = 'permissions';

/** Marks a route as requiring one or more permissions (ANY match passes). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
