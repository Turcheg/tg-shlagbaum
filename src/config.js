export default {
  ewelink: {
    email: process.env.EWELINK_EMAIL,
    password: process.env.EWELINK_PASSWORD,
    region: process.env.EWELINK_REGION,
    cmd_device_id: process.env.EWELINK_CMD_DEVICE_ID,
    cmd_open_ch: process.env.EWELINK_CMD_OPEN_CH*1,
    cmd_close_ch: process.env.EWELINK_CMD_CLOSE_CH*1,
  },
  tg: {
    token: process.env.BOT_TOKEN,
    chat_id: process.env.CHAT_ID,
  },
  users: process.env.USERS,
  logger: {
    level: process.env.LOG_LEVEL,
  },
};
