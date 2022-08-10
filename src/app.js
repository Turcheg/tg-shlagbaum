import { delay } from './utils.js';
import { v4 as uuidv4 } from 'uuid';

export default class App {
  state = {};
  config;
  l;
  ewelink;
  ewelink_ws;
  bot;
  users;

  constructor(config, logger) {
    this.config = config;
    this.l = logger;

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
      region,
    });
    this.bot = new Telegraf(this.config.tg.token);
    this.users = this.config.users
      .split(',')
      .map((s) => s.trim())
      .map((s) => s * 1);
  }

  async run() {
    return;
  }

  async init() {
    await Promise.all([this.initEwelink(), this.initBot()]);
    process.once('SIGINT', () => {
      this.bot.stop('SIGINT');
      this;
    });
    process.once('SIGTERM', () => {
      this.bot.stop('SIGTERM');
    });

    this.inited = true;
    return;
  }

  async initBot() {
    this.bot.start((ctx) => {
      this.l.trace({
        msg: 'Incoming /start command',
      });
      return ctx.replyWithHTML(
        `ЗДРАСТВУЙТЕ!<br />` +
          `АССАЛОМУ АЛАЙКУМ!<br />---<br />` +
          `/open - открыть шлагбаум/шлагбумни очиш<br />` +
          `/close - закрыть шлагбаум/шлагбумни ёпиш<br />` +
          `/myid - узнать персональный номер/шахсий номеризни билиш<br />` +
          `<b>ВАЖНО!!! Перед закрытием визуально убедитесь, что нет помех.< /b>`
      );
    });
    this.bot.command('help', (ctx) => {
      this.l.trace({
        msg: 'Incoming /help command',
        ctx,
      });
      ctx.<br />(
        `Этот бот нужен для открытия и закрытия шлагбаума<br />`
        `/open - открыть шлагбаум/шлагбумни очиш<br />` +
        `/close - закрыть шлагбаум/шлагбумни ёпиш<br />` +
        `/myid - узнать персональный номер/шахсий номеризни билиш<br />` +
        `<b>ВАЖНО!!! Перед закрытием визуально убедитесь, что нет помех.</b>`
      );
    });
    this.bot.command('myid', (ctx) => {
      this.l.trace({
        msg: 'Incoming /myid command',
        ctx,
      });
      ctx.replyWithHTML(`Ваш номер: <b>${ctx.message.from.id}</b>`);
    });
    this.bot.command('open', async (ctx) => {
      this.l.trace({
        msg: 'Incoming /open command',
        ctx,
      });
      if (!this.isAuthorized(ctx.message.from.id)) {
        return ctx.replyWithHTML(`У вас нет доступа :( (<i>${ctx.message.from.id}</i>)`);
      }
      this.openGate(ctx);
    });
    this.bot.command('close', async (ctx) => {
      this.l.trace({
        msg: 'Incoming /close command',
        ctx,
      });
      if (!this.isAuthorized(ctx.message.from.id)) {
        return ctx.replyWithHTML(`У вас нет доступа :( (<i>${ctx.message.from.id}</i>)`);
      }
      this.closeGate(ctx);
    });
  }

  async openGate(ctx) {
    this.l.trace({
      msg: 'open Gate initiated',
      ctx,
    });
    const socketPromise = this.getSocket();
    let apikey = this.ewelink.apiKey;
    if (!apikey) {
      this.l.trace({
        msg: 'apikey is undefined, try to get new',
        ctx,
      });
      await socketPromise;
      apikey = this.ewelink.apiKey;
    }
    const payload = {
      action: 'update',
      deviceid: this.config.ewelink.cmd_device_id,
      apikey,
      userAgent: 'app',
      sequence: this.config.ewelink.cmd_open_seq,
      params: {
        cmd: 'transmit',
        rfChl: this.config.ewelink.cmd_open_ch,
      },
      selfApikey: apikey,
    };
    await this.ewelinkCommand(ctx, payload);
  }

  async closeGate(ctx) {
    this.l.trace({
      msg: 'close Gate initiated',
      ctx,
    });
    const socketPromise = this.getSocket();
    let apikey = this.ewelink.apiKey;
    if (!apikey) {
      this.l.trace({
        msg: 'apikey is undefined, try to get new',
        ctx,
      });
      await socketPromise;
      apikey = this.ewelink.apiKey;
    }
    const payload = {
      action: 'update',
      deviceid: this.config.ewelink.cmd_device_id,
      apikey,
      userAgent: 'app',
      sequence: this.config.ewelink.cmd_close_seq,
      params: {
        cmd: 'transmit',
        rfChl: this.config.ewelink.cmd_close_ch,
      },
      selfApikey: apikey,
    };
    await this.ewelinkCommand(ctx, payload);
  }

  async ewelinkCommand(ctx, payload) {
    const l = this.l.child({
      job_id: uuidv4(),
    });
    l.info({
      msg: 'Ewelink command initiated',
      ctx,
      payload,
    });

    let i = 0;

    while (this.state.ewelink.status === 'transmitting') {
      l.info({
        msg: 'It busy',
      });
      await delay(100);
      if (++i > 20) {
        this.l.info({
          msg: 'Out of attemts - send busy to user',
        });
        return ctx.reply('Сейчас шлагбаум занят, повторите позже');
      }
    }
    this.state.ewelink.status = 'transmitting';
    ctx.replyWithChatAction('typing');
    const ws = await this.getSocket();
    try {
      l.info({
        msg: 'Sending to device',
        payload,
      });
      await ws.send(payload);
      return ctx.reply('Команда отправлена');
    } catch (e) {
      let e_msg = '';
      l.error({
        msg: 'Exception',
        e,
      });
      return ctx.reply('Не могу, что-то не так');
    } finally {
      this.state.ewelink.status = 'available';
    }
  }

  isAuthorized(id) {
    return this.users.includes(id);
  }

  async initEwelink() {
    let i = 0;
    while (this.state.ewelink.status === 'initing') {
      await delay(100);
      if (++i > 20) {
        throw new Error('Unable to connect ewelink');
      }
    }
    if (this.state.ewelink.status === 'active') {
      return;
    }
    this.state.ewelink.status = 'initing';
    /* get all devices */
    await this.ewelink.getDevices();
    if (this.ewelink_ws) {
      await this.ewelink_ws.close();
      this.ewelink_ws = null;
    }
    this.ewelink_ws = await this.ewelink.openWebSocket(
      this.ewelinkWsCallback.bind(this)
    );
    this.ewelink_ws.onError.addEventListener(() => {
      this.state.ewelink.status = 'error';
    });
    this.ewelink_ws.onClose.addEventListener(() => {
      this.state.ewelink.status = 'closed';
    });
    this.state.ewelink.status = 'active';
    return;
  }

  async getSocket() {
    if (this.state.ewelink.status !== 'active') {
      await this.initEwelink();
    }
    if (this.state.ewelink.status === 'active') {
      return this.ewelink_ws;
    }
    throw new Error('Unable to get socket');
  }

  ewelinkWsCallback(message) {
    this.logger.info({
      msg: 'ws:in',
      ...message,
    });
    return;
  }
}
