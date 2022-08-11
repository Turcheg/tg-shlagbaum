import fs from 'fs';

import { UserPermission, UserPermissionName, User, UserDbElements } from './types';

export const PERMISSION_OPEN: UserPermission = 1;
export const PERMISSION_CLOSE: UserPermission = 2;
export const PERMISSION_ADDUSERS: UserPermission = 4;
export const PERMISSION_REPORT: UserPermission = 8;
export const PERMISSION_SUPERADMIN: UserPermission = 16;

const permissions: UserPermissionName[] = [
  [PERMISSION_OPEN, 'Открывать шлагбаум'],
  [PERMISSION_CLOSE, 'Закрывать шлагбаум'],
  [PERMISSION_ADDUSERS, 'Добавлять пользователей шлагбаум'],
  [PERMISSION_REPORT, 'Получать отчеты'],
  [PERMISSION_SUPERADMIN, 'Суперадмин'],
];

export default class Users {
  l: any;
  filename: string;
  db: Map<number, User>;
  constructor(filename: string, logger: any) {
    this.filename = filename;
    this.l = logger;
    this.db = new Map();
    try {
      this.loadFromFile();
    } catch (e) {
      this.l.error('Error in Users.constructor', e);
      throw e;
    }
  }

  loadFromFile(): void {
    const json = fs.readFileSync(this.filename, {
      encoding: 'utf-8',
    });
    const cont: UserDbElements = JSON.parse(json);
    if (!Array.isArray(cont)) {
      throw new Error('Parsed JSON string is not array');
    }
    this.db.clear();
    for (let i = 0, to = cont.length; i < to; i++) {
      const [tg_id, name, address, permissions] = cont[i];
      this.db.set(tg_id, { tg_id, name, address, permissions });
    }
    return;
  }

  saveToFile(pretty: boolean = true): void {
    let arr: UserDbElements = [];
    this.db.forEach((v) => {
      arr.push([v.tg_id, v.name, v.address, v.permissions]);
    });
    let cont: string = '';
    if (pretty) {
      cont = JSON.stringify(arr, null, '  ');
    } else {
      cont = JSON.stringify(arr);
    }
    fs.writeFileSync(this.filename, cont);
    return;
  }

  getAllPermissions(): UserPermissionName[] {
    return permissions;
  }

  getUserPermissions(tg_id: number): UserPermissionName[] {
    const user = this.db.get(tg_id);
    if (!user) {
      return [];
    }
    let user_permissions = user.permissions;
    return this.getAllPermissions().filter((per) => {
      let [permission] = per;
      return this.permissionsCan(user_permissions, permission);
    });
  }
  getUserPermissionsText(tg_id: number): string[] {
    return this.getUserPermissions(tg_id).map((v) => v[1]);
  }

  permValid(permission: UserPermission): boolean {
    return permissions.map((v) => v[0]).includes(permission);
  }

  permissionsCan(permissions: number, permission: UserPermission): boolean {
    if (permissions >= PERMISSION_SUPERADMIN) {
      return true;
    }
    if (!this.permValid(permission)) {
      throw new Error('Permission is not valid');
    }
    return (permissions & permission) > 0;
  }

  userCan(tg_id: number, permission: UserPermission): boolean {
    const user = this.db.get(tg_id);
    if (!user) return false;
    const permissions = user.permissions;
    return this.permissionsCan(permissions, permission);
  }

  addUser(
    tg_id: number,
    name: string,
    address: string,
    permissions: number
  ): void {
    this.db.set(tg_id, { tg_id, name, address, permissions });
  }

  removeUser(tg_id: number): void {
    this.db.delete(tg_id);
  }

  getUser(tg_id: number): User | undefined {
    return this.db.get(tg_id)
  }
}
