import Users, {
  PERMISSION_OPEN,
  PERMISSION_CLOSE,
  PERMISSION_ADDUSERS,
  PERMISSION_REPORT,
  PERMISSION_SUPERADMIN,
} from './users';
import { logger_noop } from '../tests/helpers';
import path from 'path';

const assets_path = path.resolve(__dirname, '../tests/assets');

describe('User class tests', function () {
  let users: Users;
  beforeAll(function () {
    users = new Users(path.resolve(assets_path, 'users.json'), logger_noop, false);
  });
  it('Should initiate class without exceptions', function () {
    expect(users).toBeInstanceOf(Users);
  });
  it('Should save to file without exceptions', function () {
    users.saveToFile();
  });

  it('Should get all permissions in respectful way', function () {
    const permissions = users.getAllPermissions();
    const shouldHave = [
      PERMISSION_OPEN,
      PERMISSION_CLOSE,
      PERMISSION_ADDUSERS,
      PERMISSION_REPORT,
      PERMISSION_SUPERADMIN,
    ];
    expect(permissions).toHaveLength(shouldHave.length);
    expect(
      permissions.map((v):number => v[0]).reduce((p, v) => p + v, 0)
    ).toEqual(
      shouldHave.reduce((p, v) => p + v, 0)
    );
  });

  it('Should add and remove users correctly', function() {
    // users.addPermission()
  })

  it('Should calculate permissions correctly', function () {
    expect(
      users.getUserPermissions(137).reduce((p, v) => p + v[0], 0)
    ).toEqual(15);
    expect(users.userCan(137, PERMISSION_OPEN)).toBeTruthy();
  });
  
});
