import { delay, logctx, seq } from "./utils";
import { v4 as uuidv4 } from "uuid";
import ewelink from "ewelink-api";
import { Context, Telegraf } from "telegraf";
import {
  Config,
  LoggerInterface,
  UserPermission,
  EwelinkSocketMessage,
} from "./types";
import EventEmitter from "events";
import Users, {
  PERMISSION_ADDUSERS,
  PERMISSION_CLOSE,
  PERMISSION_OPEN,
  PERMISSION_SUPERADMIN,
  PERMISSION_REPORT,
} from "./users";

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
  apikey?: string;
  userAgent: string;
  sequence?: string;
  params: {
    cmd: string;
    rfChl: number;
  };
  selfApikey?: string;
}

export default class App {
  state: AppState;
  config: Config;
  l: LoggerInterface;
  ewelink: ewelink;
  ewelink_ws: any;
  bot: Telegraf;
  users: Users;
  _socket: EventEmitter;
  journal_tg_id: number;

  constructor(config: Config, logger: LoggerInterface) {
    this.config = config;
    this.l = logger;
    this._socket = new EventEmitter();
    this.users = new Users(
      this.config.users_db_file,
      logger.child({ class: "Users" })
    );
    this.users.events.on("load", ({ before, after }) => {
      if (before) {
        this.sysJournal(
          `<b>Изменена база данных</b>\n` +
            `Было: <b>${before}</b>\n` +
            `Стало: <b>${after}</b>`
        );
      }
    });
    this.journal_tg_id = this.config.tg.journal;

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

  /**
   * Запись в журнал важных событий
   *
   * @param type string - Открытие, закрытие
   * @param ctx Context - контекст телеграм соощения
   */
  journal(type: string, ctx: Context, result: boolean): boolean {
    if (this.journal_tg_id && ctx.message?.from?.id) {
      let user_id = ctx.message.from.id;
      let user = this.users.getUser(user_id);
      let send = (m: string) =>
        ctx.telegram.sendMessage(this.journal_tg_id, m, {
          parse_mode: "HTML",
        });
      if (!user) {
        send(
          `Неизвестный пользователь пытается выполнить: <b>${type}</b>\n` +
            `<pre>${JSON.stringify(logctx(ctx), null, 2)}</pre>`
        );
        return true;
      }
      send(
        `Пользователь <a href="tg://user?id=${user.tg_id}">${user.name}</a>` +
          ` из <b>${user.address}</b> выполнил действие:\n` +
          `<b><u>${type}</u></b> - ${
            result ? "<i>успешно</i>" : "<b>ОШИБКА</b>"
          }`
      );
      return true;
    }
    return false;
  }
  sysJournal(message: string): boolean {
    if (this.journal_tg_id) {
      let send = (m: string) => {
        this.bot.telegram.sendMessage(this.journal_tg_id, m, {
          parse_mode: "HTML",
        });
      };
      send(`<u>системное сообщение</u>\n` + message);
      return true;
    }
    return false;
  }

  async openGate(ctx: Context) {
    this.l.trace({
      msg: "open Gate initiated",
      ctx: logctx(ctx),
    });
    const socketPromise = this.getSocket();
    // @ts-ignore
    const payload: EwelinkCommandPayload = {
      action: "update",
      deviceid: this.config.ewelink.cmd_device_id,
      userAgent: "app",
      params: {
        cmd: "transmit",
        rfChl: this.config.ewelink.cmd_open_ch,
      },
    };
    const result = await this.ewelinkCommand(ctx, payload);
    this.journal("Открыть", ctx, result);
  }

  async closeGate(ctx: Context) {
    this.l.trace({
      msg: "close Gate initiated",
      ctx: logctx(ctx),
    });

    const payload: EwelinkCommandPayload = {
      action: "update",
      deviceid: this.config.ewelink.cmd_device_id,
      userAgent: "app",
      params: {
        cmd: "transmit",
        rfChl: this.config.ewelink.cmd_close_ch,
      },
    };
    const result = await this.ewelinkCommand(ctx, payload);
    this.journal("Закрыть", ctx, result);
  }

  async ewelinkCommand(
    ctx: Context,
    payload: EwelinkCommandPayload
  ): Promise<boolean> {
    const l = this.l.child({
      job_id: uuidv4(),
    });
    l.info({
      msg: "Ewelink command initiated",
      ctx: logctx(ctx),
      payload,
    });

    if (this.state.ewelink.status === "transmitting") {
      ctx.reply("Сейчас шлагбаум занят, повторите позже");
      return false;
    }
    this.state.ewelink.status = "transmitting";
    ctx.replyWithChatAction("typing");
    try {
      l.info({
        msg: "Sending to device",
        payload,
      });

      await this.wsSend(payload);
      ctx.reply("Команда отправлена");
      return true;
    } catch (e) {
      ctx.reply("Нет связи со шлагбаумом");
      return false;
    } finally {
      this.state.ewelink.status = "available";
    }
  }

  async wsSend(
    payload: EwelinkCommandPayload,
    timeout_ms: number = 5000
  ): Promise<true> {
    let ws = await this.getSocket();
    let sequence = seq();
    // @ts-ignore
    payload.apikey = this.ewelink.apiKey;
    payload.selfApikey = payload.apikey;
    payload.sequence = sequence;

    const response: Promise<true> = new Promise((res, rej) => {
      this._socket.once(`seq:${sequence}`, (message: EwelinkSocketMessage) => {
        if (message?.error === 0) {
          res(true);
        }
        rej({
          code: message?.error ?? -1,
          message: `${message?.reason ?? "Unknown ewelink command error"}`,
        });
      });
    });
    await ws.send(JSON.stringify(payload));
    const timeout: Promise<true> = new Promise((res, rej) => {
      setTimeout(() => {
        rej({
          code: -2,
          message: `${timeout_ms} Timeout`,
        });
      }, timeout_ms);
    });
    return Promise.race([response, timeout]);
  }

  isAuthorized(tg_id: number, permission: UserPermission): boolean {
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

  ewelinkWsCallback(message: string | EwelinkSocketMessage) {
    if (typeof message === "string") {
      this.l.info({
        msg: "ws:in",
        str: message,
      });
      this._socket.emit("message", message);
    } else {
      this.l.info({
        msg: "ws:in",
        ...message,
      });
      if (message?.sequence) {
        this._socket.emit(`seq:${message.sequence}`, message);
      }
      if (message?.error && message?.error > 0) {
        this._socket.emit(`err`, message);
      }
      if (message?.action) {
        this._socket.emit(`action:${message.action}`, message);
      }
    }
    return;
  }
}
