
const PERMISSION_OPEN = 1;
const PERMISSION_CLOSE = 2;
const PERMISSION_ADDUSERS = 4;
const PERMISSION_SUPERADMIN = 8;

let addPerm = function(permissions, permission) {
  return permissions | permission;
}
let removePerm = function(permissions, permission) {
  return permissions & ~permission;
}