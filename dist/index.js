"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var tg_shlagbaum_exports = {};
__export(tg_shlagbaum_exports, {
  default: () => tg_shlagbaum_default
});
module.exports = __toCommonJS(tg_shlagbaum_exports);

// src/logger.ts
var import_pino = __toESM(require("pino"));
function wrap(logger2) {
  const { error, child } = logger2;
  function errorRearranger(...args) {
    if (typeof args[0] === "string" && args.length > 1) {
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg instanceof Error) {
          const [err] = args.splice(i, 1);
          args.unshift(err);
        }
      }
    }
    return error.apply(this, args);
  }
  function childModifier(...args) {
    const c = child.apply(this, args);
    c.error = errorRearranger;
    c.child = childModifier;
    return c;
  }
  logger2.error = errorRearranger;
  logger2.child = childModifier;
  return logger2;
}
function logger_default(opts) {
  return wrap((0, import_pino.default)(opts));
}

// src/config.ts
var getenv = (key) => {
  const ret = process.env[key];
  if (ret !== void 0) {
    return ret;
  }
  return "";
};
var config = {
  ewelink: {
    email: getenv("EWELINK_EMAIL"),
    password: getenv("EWELINK_PASSWORD"),
    region: getenv("EWELINK_REGION"),
    cmd_device_id: getenv("EWELINK_CMD_DEVICE_ID"),
    cmd_open_ch: Number(getenv("EWELINK_CMD_OPEN_CH")),
    cmd_close_ch: Number(getenv("EWELINK_CMD_CLOSE_CH"))
  },
  tg: {
    token: getenv("BOT_TOKEN"),
    journal: Number(getenv("JOURNAL_TG_ID"))
  },
  users_db_file: getenv("USERS_DB_FILE"),
  users: getenv("USERS"),
  logger: {
    level: getenv("LOG_LEVEL")
  }
};
var config_default = config;

// src/utils.ts
var delay = (ms) => {
  return new Promise((r) => {
    setTimeout(r, ms);
  });
};
var logctx = (ctx) => {
  if (ctx == null ? void 0 : ctx.update) {
    return { ...ctx.update };
  }
  return null;
};
var seq = () => {
  const timestamp = Math.floor(Number(new Date()) / 1e3);
  return String(Math.floor(timestamp * 1e3));
};

// src/app.ts
var import_uuid = require("uuid");
var import_ewelink_api = __toESM(require("ewelink-api"));
var import_telegraf = require("telegraf");
var import_events2 = __toESM(require("events"));

// src/users.ts
var import_fs = __toESM(require("fs"));
var import_events = __toESM(require("events"));
var import_debounce = __toESM(require("lodash/debounce"));
var PERMISSION_OPEN = 1;
var PERMISSION_CLOSE = 2;
var PERMISSION_ADDUSERS = 4;
var PERMISSION_REPORT = 8;
var PERMISSION_SUPERADMIN = -1;
var permissions = [
  [PERMISSION_OPEN, "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u0448\u043B\u0430\u0433\u0431\u0430\u0443\u043C"],
  [PERMISSION_CLOSE, "\u0417\u0430\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u0448\u043B\u0430\u0433\u0431\u0430\u0443\u043C"],
  [PERMISSION_ADDUSERS, "\u0414\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u0439 \u0448\u043B\u0430\u0433\u0431\u0430\u0443\u043C"],
  [PERMISSION_REPORT, "\u041F\u043E\u043B\u0443\u0447\u0430\u0442\u044C \u043E\u0442\u0447\u0435\u0442\u044B"],
  [PERMISSION_SUPERADMIN, "\u0421\u0443\u043F\u0435\u0440\u0430\u0434\u043C\u0438\u043D"]
];
var Users = class {
  constructor(filename, logger2) {
    this.filename = filename;
    this.l = logger2;
    this.db = /* @__PURE__ */ new Map();
    this.events = new import_events.default();
    const abort = new AbortController();
    try {
      this.loadFromFile();
      const watcher = import_fs.default.watch(this.filename, {
        persistent: true,
        signal: abort.signal
      });
      const debounced = (0, import_debounce.default)((eventType) => {
        try {
          this.loadFromFile();
        } catch (e) {
        }
      }, 100);
      watcher.on("change", debounced);
      process.once("SIGINT", () => {
        abort.abort();
      });
      process.once("SIGTERM", () => {
        abort.abort();
      });
    } catch (e) {
      this.l.error("Error in Users.constructor", e);
      throw e;
    }
  }
  loadFromFile() {
    this.l.trace({
      msg: "Trying to load file",
      filename: this.filename
    });
    const json = import_fs.default.readFileSync(this.filename, {
      encoding: "utf-8"
    });
    const cont = JSON.parse(json);
    if (!Array.isArray(cont)) {
      throw new Error("Parsed JSON string is not array");
    }
    const before = this.db.size;
    this.db.clear();
    for (let i = 0, to = cont.length; i < to; i++) {
      const [tg_id, name, address, permissions2] = cont[i];
      this.db.set(tg_id, { tg_id, name, address, permissions: permissions2 });
    }
    const after = this.db.size;
    this.events.emit("load", {
      before,
      after
    });
    return;
  }
  saveToFile(pretty = true) {
    const arr = [];
    this.db.forEach((v) => {
      arr.push([v.tg_id, v.name, v.address, v.permissions]);
    });
    let cont = "";
    if (pretty) {
      cont = JSON.stringify(arr, null, "  ");
    } else {
      cont = JSON.stringify(arr);
    }
    import_fs.default.writeFileSync(this.filename, cont);
    return;
  }
  getAllPermissions() {
    return permissions;
  }
  getUserPermissions(tg_id) {
    const user = this.db.get(tg_id);
    if (!user) {
      return [];
    }
    const user_permissions = user.permissions;
    return this.getAllPermissions().filter((per) => {
      const [permission] = per;
      return this.permissionsCan(user_permissions, permission);
    });
  }
  getUserPermissionsText(tg_id) {
    return this.getUserPermissions(tg_id).map((v) => v[1]);
  }
  permValid(permission) {
    return permissions.map((v) => v[0]).includes(permission);
  }
  permissionsCan(permissions2, permission) {
    if (permissions2 === PERMISSION_SUPERADMIN) {
      return true;
    }
    if (!this.permValid(permission)) {
      throw new Error("Permission is not valid");
    }
    return (permissions2 & permission) > 0;
  }
  userCan(tg_id, permission) {
    const user = this.db.get(tg_id);
    if (!user)
      return false;
    const permissions2 = user.permissions;
    return this.permissionsCan(permissions2, permission);
  }
  addUser(tg_id, name, address, permissions2) {
    this.db.set(tg_id, { tg_id, name, address, permissions: permissions2 });
  }
  removeUser(tg_id) {
    this.db.delete(tg_id);
  }
  getUser(tg_id) {
    return this.db.get(tg_id);
  }
};

// src/app.ts
var App = class {
  constructor(config2, logger2) {
    this.config = config2;
    this.l = logger2;
    this._socket = new import_events2.default();
    this.users = new Users(
      this.config.users_db_file,
      logger2.child({ class: "Users" })
    );
    this.users.events.on("load", ({ before, after }) => {
      if (before) {
        this.sysJournal(
          `<b>\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0430 \u0431\u0430\u0437\u0430 \u0434\u0430\u043D\u043D\u044B\u0445</b>
\u0411\u044B\u043B\u043E: <b>${before}</b>
\u0421\u0442\u0430\u043B\u043E: <b>${after}</b>`
        );
      }
    });
    this.journal_tg_id = this.config.tg.journal;
    this.state = {
      inited: false,
      gate: {
        status: null
      },
      ewelink: {
        status: null
      }
    };
    const { email, password, region } = this.config.ewelink;
    this.ewelink = new import_ewelink_api.default({
      email,
      password,
      region
    });
    this.bot = new import_telegraf.Telegraf(this.config.tg.token);
  }
  async run() {
    await this.bot.launch();
    return;
  }
  async init() {
    await Promise.all([this.initEwelink(), this.initBot()]);
    process.once("SIGINT", () => {
      this.bot.stop("SIGINT");
      if (this.ewelink_ws) {
        this.ewelink_ws.close();
      }
      this;
    });
    process.once("SIGTERM", () => {
      this.bot.stop("SIGTERM");
      if (this.ewelink_ws) {
        this.ewelink_ws.close();
      }
    });
    this.state.inited = true;
    return;
  }
  async initBot() {
    this.bot.start((ctx) => {
      this.l.trace({
        msg: "Incoming /start command"
      });
      return ctx.replyWithHTML(
        `\u0417\u0414\u0420\u0410\u0421\u0422\u0412\u0423\u0419\u0422\u0415!
\u0410\u0421\u0421\u0410\u041B\u041E\u041C\u0423 \u0410\u041B\u0410\u0419\u041A\u0423\u041C!
---
/open - \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0448\u043B\u0430\u0433\u0431\u0430\u0443\u043C/\u0448\u043B\u0430\u0433\u0431\u0443\u043C\u043D\u0438 \u043E\u0447\u0438\u0448
/close - \u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0448\u043B\u0430\u0433\u0431\u0430\u0443\u043C/\u0448\u043B\u0430\u0433\u0431\u0443\u043C\u043D\u0438 \u0451\u043F\u0438\u0448
/myid - \u0443\u0437\u043D\u0430\u0442\u044C \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440/\u0448\u0430\u0445\u0441\u0438\u0439 \u043D\u043E\u043C\u0435\u0440\u0438\u0437\u043D\u0438 \u0431\u0438\u043B\u0438\u0448
<b>\u0412\u0410\u0416\u041D\u041E!!! \u041F\u0435\u0440\u0435\u0434 \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u0435\u043C \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044C, \u0447\u0442\u043E \u043D\u0435\u0442 \u043F\u043E\u043C\u0435\u0445.< /b>`
      );
    });
    this.bot.command("help", (ctx) => {
      this.l.trace({
        msg: "Incoming /help command",
        ctx: logctx(ctx)
      });
      ctx.replyWithHTML(
        `\u042D\u0442\u043E\u0442 \u0431\u043E\u0442 \u043D\u0443\u0436\u0435\u043D \u0434\u043B\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F \u0438 \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F \u0448\u043B\u0430\u0433\u0431\u0430\u0443\u043C\u0430
/open - \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0448\u043B\u0430\u0433\u0431\u0430\u0443\u043C/\u0448\u043B\u0430\u0433\u0431\u0443\u043C\u043D\u0438 \u043E\u0447\u0438\u0448
/close - \u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0448\u043B\u0430\u0433\u0431\u0430\u0443\u043C/\u0448\u043B\u0430\u0433\u0431\u0443\u043C\u043D\u0438 \u0451\u043F\u0438\u0448
/myid - \u0443\u0437\u043D\u0430\u0442\u044C \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440/\u0448\u0430\u0445\u0441\u0438\u0439 \u043D\u043E\u043C\u0435\u0440\u0438\u0437\u043D\u0438 \u0431\u0438\u043B\u0438\u0448
<b>\u0412\u0410\u0416\u041D\u041E!!! \u041F\u0435\u0440\u0435\u0434 \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u0435\u043C \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044C, \u0447\u0442\u043E \u043D\u0435\u0442 \u043F\u043E\u043C\u0435\u0445.</b>`
      );
    });
    this.bot.command("myid", (ctx) => {
      this.l.trace({
        msg: "Incoming /myid command",
        ctx: logctx(ctx)
      });
      ctx.replyWithHTML(`\u0412\u0430\u0448 \u043D\u043E\u043C\u0435\u0440: <b>${ctx.message.from.id}</b>`);
    });
    this.bot.command("open", async (ctx) => {
      this.l.trace({
        msg: "Incoming /open command",
        ctx: logctx(ctx)
      });
      if (!this.isAuthorized(ctx.message.from.id, PERMISSION_OPEN)) {
        return ctx.replyWithHTML(
          `\u0423 \u0432\u0430\u0441 \u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 :( (<i>${ctx.message.from.id}</i>)`
        );
      }
      this.openGate(ctx);
    });
    this.bot.command("close", async (ctx) => {
      this.l.trace({
        msg: "Incoming /close command",
        ctx: logctx(ctx)
      });
      if (!this.isAuthorized(ctx.message.from.id, PERMISSION_CLOSE)) {
        return ctx.replyWithHTML(
          `\u0423 \u0432\u0430\u0441 \u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 :( (<i>${ctx.message.from.id}</i>)`
        );
      }
      this.closeGate(ctx);
    });
  }
  journal(type, ctx, result) {
    var _a, _b;
    if (this.journal_tg_id && ((_b = (_a = ctx.message) == null ? void 0 : _a.from) == null ? void 0 : _b.id)) {
      const user_id = ctx.message.from.id;
      const user = this.users.getUser(user_id);
      const send = (m) => ctx.telegram.sendMessage(this.journal_tg_id, m, {
        parse_mode: "HTML"
      });
      if (!user) {
        send(
          `\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043F\u044B\u0442\u0430\u0435\u0442\u0441\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C: <b>${type}</b>
<pre>${JSON.stringify(logctx(ctx), null, 2)}</pre>`
        );
        return true;
      }
      send(
        `\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C <a href="tg://user?id=${user.tg_id}">${user.name}</a> \u0438\u0437 <b>${user.address}</b> \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u043B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435:
<b><u>${type}</u></b> - ${result ? "<i>\u0443\u0441\u043F\u0435\u0448\u043D\u043E</i>" : "<b>\u041E\u0428\u0418\u0411\u041A\u0410</b>"}`
      );
      return true;
    }
    return false;
  }
  sysJournal(message) {
    if (this.journal_tg_id) {
      const send = (m) => {
        this.bot.telegram.sendMessage(this.journal_tg_id, m, {
          parse_mode: "HTML"
        });
      };
      send(`<u>\u0441\u0438\u0441\u0442\u0435\u043C\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435</u>
` + message);
      return true;
    }
    return false;
  }
  async openGate(ctx) {
    this.l.trace({
      msg: "open Gate initiated",
      ctx: logctx(ctx)
    });
    await this.getSocket();
    const payload = {
      action: "update",
      deviceid: this.config.ewelink.cmd_device_id,
      userAgent: "app",
      params: {
        cmd: "transmit",
        rfChl: this.config.ewelink.cmd_open_ch
      }
    };
    const result = await this.ewelinkCommand(ctx, payload);
    this.journal("\u041E\u0442\u043A\u0440\u044B\u0442\u044C", ctx, result);
  }
  async closeGate(ctx) {
    this.l.trace({
      msg: "close Gate initiated",
      ctx: logctx(ctx)
    });
    const payload = {
      action: "update",
      deviceid: this.config.ewelink.cmd_device_id,
      userAgent: "app",
      params: {
        cmd: "transmit",
        rfChl: this.config.ewelink.cmd_close_ch
      }
    };
    const result = await this.ewelinkCommand(ctx, payload);
    this.journal("\u0417\u0430\u043A\u0440\u044B\u0442\u044C", ctx, result);
  }
  async ewelinkCommand(ctx, payload) {
    const l = this.l.child({
      job_id: (0, import_uuid.v4)()
    });
    l.info({
      msg: "Ewelink command initiated",
      ctx: logctx(ctx),
      payload
    });
    if (this.state.ewelink.status === "transmitting") {
      ctx.reply("\u0421\u0435\u0439\u0447\u0430\u0441 \u0448\u043B\u0430\u0433\u0431\u0430\u0443\u043C \u0437\u0430\u043D\u044F\u0442, \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u0437\u0436\u0435");
      return false;
    }
    this.state.ewelink.status = "transmitting";
    ctx.replyWithChatAction("typing");
    try {
      l.info({
        msg: "Sending to device",
        payload
      });
      await this.wsSend(payload);
      ctx.reply("\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430");
      return true;
    } catch (e) {
      ctx.reply("\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441\u043E \u0448\u043B\u0430\u0433\u0431\u0430\u0443\u043C\u043E\u043C");
      return false;
    } finally {
      this.state.ewelink.status = "available";
    }
  }
  async wsSend(payload, timeout_ms = 5e3) {
    const ws = await this.getSocket();
    const sequence = seq();
    payload.apikey = this.ewelink.apiKey;
    payload.selfApikey = payload.apikey;
    payload.sequence = sequence;
    const response = new Promise((res, rej) => {
      this._socket.once(`seq:${sequence}`, (message) => {
        if ((message == null ? void 0 : message.error) === 0) {
          res(true);
        }
        rej({
          code: (message == null ? void 0 : message.error) ?? -1,
          message: `${(message == null ? void 0 : message.reason) ?? "Unknown ewelink command error"}`
        });
      });
    });
    await ws.send(JSON.stringify(payload));
    const timeout = new Promise((res, rej) => {
      setTimeout(() => {
        rej({
          code: -2,
          message: `${timeout_ms} Timeout`
        });
      }, timeout_ms);
    });
    return Promise.race([response, timeout]);
  }
  isAuthorized(tg_id, permission) {
    if (this.users.userCan(tg_id, PERMISSION_SUPERADMIN)) {
      return true;
    }
    return this.users.userCan(tg_id, permission);
  }
  async initEwelink() {
    let i = 0;
    while (this.state.ewelink.status === "initing") {
      await delay(100);
      if (++i > 20) {
        throw new Error("Unable to connect ewelink");
      }
    }
    if (this.state.ewelink.status === "active") {
      return;
    }
    this.state.ewelink.status = "initing";
    await this.ewelink.getDevices();
    if (!this.ewelink_ws) {
      this.ewelink_ws = await this.ewelink.openWebSocket(
        this.ewelinkWsCallback.bind(this)
      );
      this.ewelink_ws.onError.addListener(() => {
        this.state.ewelink.status = "error";
      });
      this.ewelink_ws.onClose.addListener(() => {
        this.state.ewelink.status = "closed";
      });
    }
    this.state.ewelink.status = "active";
    return;
  }
  async getSocket() {
    if (this.state.ewelink.status !== "active") {
      await this.initEwelink();
    }
    if (this.state.ewelink.status === "active") {
      return this.ewelink_ws;
    }
    throw new Error("Unable to get socket");
  }
  ewelinkWsCallback(message) {
    if (typeof message === "string") {
      this.l.info({
        msg: "ws:in",
        str: message
      });
      this._socket.emit("message", message);
    } else {
      this.l.info({
        msg: "ws:in",
        ...message
      });
      if (message == null ? void 0 : message.sequence) {
        this._socket.emit(`seq:${message.sequence}`, message);
      }
      if ((message == null ? void 0 : message.error) && (message == null ? void 0 : message.error) > 0) {
        this._socket.emit(`err`, message);
      }
      if (message == null ? void 0 : message.action) {
        this._socket.emit(`action:${message.action}`, message);
      }
    }
    return;
  }
};

// index.ts
var logger = logger_default(config_default.logger);
var app = new App(config_default, logger);
(async function() {
  try {
    await app.init();
    logger.info("Init completed");
    app.run();
    logger.info("App is running");
  } catch (e) {
    logger.error("Exception occured on top thread", e);
    process.exit(1);
  }
})();
var tg_shlagbaum_default = {};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
//# sourceMappingURL=index.js.map