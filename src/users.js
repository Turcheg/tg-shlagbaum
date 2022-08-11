import fs from 'fs';

export const PERMISSION_OPEN = 1;
export const PERMISSION_CLOSE = 2;
export const PERMISSION_ADDUSERS = 4;
export const PERMISSION_SUPERADMIN = 8;

export default class Users {
  l;
  filename;
  db;
  constructor(filename, logger) {
    this.filename = filename;
    this.l = logger;
    try {
      this.loadFromFile(contents);
    } catch (e) {
      this.l('Error in Users.constructor', e);
      throw e;
    }
  }

  loadFromFile() {
    const json = fs.readFileSync(this.filename, {
      encoding: 'utf-8',
    });
    const cont = JSON.parse(json);
    if (!Array.isArray(cont)) {
      throw new Error('Parsed JSON string is not array');
    }
    this.db = new Map();
    for (let i = 0, to = cont.length; i < to; i++) {
      const [tg_id, name, address, permissions] = cont[i];
      this.db.set(tg_id, { tg_id, name, address, permissions });
    }
    return;
  }

  saveToFile(pretty = true) {
    let arr = [];
    this.db.forEach((v, k) => {
      arr.push([v.tg_id, v.name, v.address, v.permissions]);
    });
    let cont = '';
    if (pretty) {
      cont = JSON.stringify(arr, null, '  ');
    } else {
      cont = JSON.stringify(arr);
    }
    fs.writeFileSync(this.filename, cont);
    return;
  }

  can(tg_id, permission) {
    
  }
}
