import { Request } from 'express';
import { dbStore, User } from '../store';

// Helper to get the actual company owner ID (since collaborators act on behalf of their parent company)
export function getCompanyOwnerId(u: User): string {
  return u.role === 'collaborator' && u.companyId ? u.companyId : u.id;
}

// Helper to check standard tokens or custom header for simulating session roles
export function getCurrentUser(req: Request): User | undefined {
  const userId = req.headers['x-user-id'] || 'usr_client1'; // default backup
  let u = dbStore.users.find(u => u.id === userId);

  if (!u) {
    // Check if the user is a collaborator (subaccount)
    const sub = dbStore.subAccounts.find(s => s.id === userId);
    if (sub) {
      const parentCompany = dbStore.users.find(usr => usr.id === sub.companyId);
      u = {
        id: sub.id,
        name: sub.name,
        email: sub.email,
        password: sub.password || '',
        role: 'collaborator',
        status: sub.status || 'active',
        color: parentCompany?.color || '#3b82f6',
        companyId: sub.companyId,
        permissions: sub.permissions,
        phone: parentCompany?.phone,
        address: parentCompany?.address,
      };
    }
  }

  if (u && u.role === 'driver') {
    const drv = dbStore.drivers.find(d => d.userId === u.id);
    if (drv) {
      u.baseFee = drv.baseFee;
      u.perKmFee = drv.perKmFee;
      u.zone = drv.zone;
      u.driverStatus = drv.status;
      u.photo = drv.photo;
      u.rating = drv.rating;
    }
  }
  return u;
}
