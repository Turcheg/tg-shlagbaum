import { delay, logctx, seq } from "./utils.js";
import { v4 as uuidv4 } from "uuid";
import ewelink from "ewelink-api";
import { Context, Telegraf } from "telegraf";
import { Config, LoggerInterface, UserPermission } from "./types.js";
import Users, {
  PERMISSION_ADDUSERS,
  PERMISSION_CLOSE,
  PERMISSION_OPEN,
  PERMISSION_SUPERADMIN,
  PERMISSION_REPORT,
} from "./users.js";

interface AppState {
  inited: boolean;
  gate: {
    status: null;
  };
  ewelink: {
    status:
      | null
      | "transmitting"
      | "available"
      | "initing"
      | "active"
      | "error"
      | "closed";
  };
}
interface EwelinkCommandPayload {
  action: string;
  deviceid: string;
  apikey: string;
  userAgent: string;
  sequence: number;
  params: {
    cmd: string;
    rfChl: number;
  };
  selfApikey: string;
}

export default class App {
  state: AppState;
  config: Config;
  l: LoggerInterface;
  ewelink: ewelink;
  ewelink_ws: any;
  bot: Telegraf;
  users: Users;

  constructor(config: Config, logger: LoggerInterface) {
    this.config = config;
    this.l = logger;
    this.users = new Users(
      this.config.users_db_file,
      logger.child({ class: "Users" })
    );

    this.state = {
      inited: false,
      gate: {
        status: null,
      },
      ewelink: {
        status: null,
      },
    };
    const { email, password, region } = this.config.ewelink;
    this.ewelink = new ewelink({
      email,
      password,
      // @ts-ignore
      region,
    });
    this.bot = new Telegraf(this.config.tg.token);
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
        msg: "Incoming /start command",
      });
      return ctx.replyWithHTML(
        `ЗДРАСТВУЙТЕ!\n` +
          `АССАЛОМУ АЛАЙКУМ!\n---\n` +
          `/open - открыть шлагбаум/шлагбумни очиш\n` +
          `/close - закрыть шлагбаум/шлагбумни ёпиш\n` +
          `/myid - узнать персональный номер/шахсий номеризни билиш\n` +
          `<b>ВАЖНО!!! Перед закрытием визуально убедитесь, что нет помех.< /b>`
      );
    });
    this.bot.command("help", (ctx) => {
      this.l.trace({
        msg: "Incoming /help command",
        ctx: logctx(ctx),
      });
      ctx.replyWithHTML(
        `Этот бот нужен для открытия и закрытия шлагбаума\n` +
          `/open - открыть шлагбаум/шлагбумни очиш\n` +
          `/close - закрыть шлагбаум/шлагбумни ёпиш\n` +
          `/myid - узнать персональный номер/шахсий номеризни билиш\n` +
          `<b>ВАЖНО!!! Перед закрытием визуально убедитесь, что нет помех.</b>`
      );
    });
    this.bot.command("myid", (ctx) => {
      this.l.trace({
        msg: "Incoming /myid command",
        ctx: logctx(ctx),
      });
      ctx.replyWithHTML(`Ваш номер: <b>${ctx.message.from.id}</b>`);
    });
    this.bot.command("open", async (ctx) => {
      this.l.trace({
        msg: "Incoming /open command",
        ctx: logctx(ctx),
      });
      if (!this.isAuthorized(ctx.message.from.id, PERMISSION_OPEN)) {
        return ctx.replyWithHTML(
          `У вас нет доступа :( (<i>${ctx.message.from.id}</i>)`
        );
      }
      this.openGate(ctx);
    });
    this.bot.command("close", async (ctx) => {
      this.l.trace({
        msg: "Incoming /close command",
        ctx: logctx(ctx),
      });
      if (!this.isAuthorized(ctx.message.from.id, PERMISSION_CLOSE)) {
        return ctx.replyWithHTML(
          `У вас нет доступа :( (<i>${ctx.message.from.id}</i>)`
        );
      }
      this.closeGate(ctx);
    });
  }

  async openGate(ctx: Context) {
    this.l.trace({
      msg: "open Gate initiated",
      ctx: logctx(ctx),
    });
    const socketPromise = this.getSocket();
    // @ts-ignore
    let apikey = this.ewelink.apiKey;
    if (!apikey) {
      this.l.trace({
        msg: "apikey is undefined, try to get new",
        ctx: logctx(ctx),
      });
      await socketPromise;
      // @ts-ignore
      apikey = this.ewelink.apiKey;
    }
    const payload: EwelinkCommandPayload = {
      action: "update",
      deviceid: this.config.ewelink.cmd_device_id,
      apikey,
      userAgent: "app",
      sequence: seq(),
      params: {
        cmd: "transmit",
        rfChl: this.config.ewelink.cmd_open_ch,
      },
      selfApikey: apikey,
    };
    await this.ewelinkCommand(ctx, payload);
  }

  async closeGate(ctx: Context) {
    this.l.trace({
      msg: "close Gate initiated",
      ctx: logctx(ctx),
    });
    const socketPromise = this.getSocket();
    // @ts-ignore
    let apikey = this.ewelink.apiKey;
    if (!apikey) {
      this.l.trace({
        msg: "apikey is undefined, try to get new",
        ctx: logctx(ctx),
      });
      await socketPromise;
      // @ts-ignore
      apikey = this.ewelink.apiKey;
    }
    const payload: EwelinkCommandPayload = {
      action: "update",
      deviceid: this.config.ewelink.cmd_device_id,
      apikey,
      userAgent: "app",
      sequence: seq(),
      params: {
        cmd: "transmit",
        rfChl: this.config.ewelink.cmd_close_ch,
      },
      selfApikey: apikey,
    };
    await this.ewelinkCommand(ctx, payload);
  }

  async ewelinkCommand(ctx: Context, payload: EwelinkCommandPayload) {
    const l = this.l.child({
      job_id: uuidv4(),
    });
    l.info({
      msg: "Ewelink command initiated",
      ctx: logctx(ctx),
      payload,
    });

    let i = 0;

    while (this.state.ewelink.status === "transmitting") {
      l.info({
        msg: "It busy",
      });
      await delay(100);
      if (++i > 20) {
        this.l.info({
          msg: "Out of attemts - send busy to user",
        });
        return ctx.reply("Сейчас шлагбаум занят, повторите позже");
      }
    }
    this.state.ewelink.status = "transmitting";
    ctx.replyWithChatAction("typing");
    const ws = await this.getSocket();
    try {
      l.info({
        msg: "Sending to device",
        payload,
      });
      payload.sequence = seq();
      await ws.send(JSON.stringify(payload));
      await delay(750);
      payload.sequence = seq();
      await ws.send(JSON.stringify(payload));
      await delay(1000);
      return ctx.reply("Команда отправлена");
    } catch (e) {
      l.error({
        msg: "Exception",
        e,
      });
      return ctx.reply("Не могу, что-то не так");
    } finally {
      this.state.ewelink.status = "available";
    }
  }

  isAuthorized(tg_id: number, permission: UserPermission): boolean {
    if(this.users.userCan(tg_id, PERMISSION_SUPERADMIN)) {
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
    /* get all devices */
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

  ewelinkWsCallback(message: string | object) {
    if (typeof message === "string") {
      this.l.info({
        msg: "ws:in",
        str: message,
      });
    } else {
      this.l.info({
        msg: "ws:in",
        ...message,
      });
    }
    return;
  }
}
