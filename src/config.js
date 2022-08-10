export default {
  ewelink: {
    email: process.env.EWELINK_EMAIL,
    password: process.env.EWELINK_PASSWORD,
    region: process.env.EWELINK_REGION,
    cmd_device_id: EWELINK_CMD_DEVICE_ID,
    cmd_open_seq: EWELINK_CMD_OPEN_SEQ,
    cmd_open_ch: EWELINK_CMD_OPEN_CH,
    cmd_close_seq: EWELINK_CMD_CLOSE_SEQ,
    cmd_close_ch: EWELINK_CMD_CLOSE_CH,
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
