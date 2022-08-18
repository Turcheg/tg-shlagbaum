import { Config } from "./types";

const getenv = (key:string):string => {
  let ret = process.env[key];
  if(ret !== undefined) {
    return ret;
  }
  return '';
}

const config: Config = {
  ewelink: {
    email: getenv('EWELINK_EMAIL'),
    password: getenv('EWELINK_PASSWORD'),
    region: getenv('EWELINK_REGION'),
    cmd_device_id: getenv('EWELINK_CMD_DEVICE_ID'),
    cmd_open_ch: Number(getenv('EWELINK_CMD_OPEN_CH')),
    cmd_close_ch: Number(getenv('EWELINK_CMD_CLOSE_CH')),
  },
  tg: {
    token: getenv('BOT_TOKEN'),
    journal: Number(getenv('JOURNAL_TG_ID')),
  },
  users_db_file: getenv('USERS_DB_FILE'),
  users: getenv('USERS'),
  logger: {
    level: getenv('LOG_LEVEL'),
  },
}
export default config;
