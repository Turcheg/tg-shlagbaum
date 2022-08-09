import {delay} from './utils.js';
class App {
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
      }
    }
    const { email, password, region } = this.config.ewelink;
    this.ewelink = new ewelink({
      email, password, region
    });
    this.bot = new Telegraf(this.config.tg.token);
    this.users = this.config.users.split(',')
      .map(s => s.trim())
      .map(s => s*1);
  }

  async init() {
    await Promise.all([this.initEwelink(), this.initBot()]);
    process.once("SIGINT", () => {
      this.bot.stop("SIGINT")
      this
    });
    process.once("SIGTERM", () => {
      this.bot.stop("SIGTERM")
    });
    
    this.inited = true;
    return;
  }

  async initBot() {
    this.bot.start((ctx) => {
      this.l.trace({
        msg: "Incoming /start command",
      });
      return ctx.reply(
        `ЗДРАСТВУЙТЕ!\n` +
        `АССАЛОМУ АЛАЙКУМ!\n---\n` +
        `/open - открыть шлагбаум/шлагбумни очиш\n` +
        `/close - закрыть шлагбаум/шлагбумни ёпиш\n` + 
        `/myid - узнать персональный номер/шахсий номеризни билиш\n`
      );
    });
    this.bot.command("myid", (ctx) => {
      ctx.reply(`Ваш номер: ${ctx.message.from.id}`);
    });
    this.bot.command("open", async (ctx) => {
      if(!this.isAuthorized(ctx.message.from.id)) {
        return ctx.reply(`У вас нет доступа :( (${ctx.message.from.id})`);
      }
      this.openGate(ctx);
    });
    this.bot.command("close", async (ctx) => {
      if(!this.isAuthorized(ctx.message.from.id)) {
        return ctx.reply(`У вас нет доступа :( (${ctx.message.from.id})`);
      }
      this.closeGate(ctx);
    })
  }

  async openGate(ctx) {
    const ws = await this.getSocket();
    const apikey = this.ewelink.apiKey;
    const payload = {
      "action": "update",
      deviceid: this.config.ewelink.cmd_device_id,
      apikey,
      "userAgent": "app",
      "sequence": this.config.ewelink.cmd_open_seq,
      "params": {
        "cmd": "transmit",
        "rfChl": this.config.ewelink.cmd_open_ch
      },
      "selfApikey": apikey
    };
    await this.ewelinkCommand(ctx, payload);
  }

  async closeGate(ctx) {
    const ws = await this.getSocket();
    const apikey = this.ewelink.apiKey;
    const payload = {
      "action": "update",
      deviceid: this.config.ewelink.cmd_device_id,
      apikey,
      "userAgent": "app",
      "sequence": this.config.ewelink.cmd_close_seq,
      "params": {
        "cmd": "transmit",
        "rfChl": this.config.ewelink.cmd_close_ch
      },
      "selfApikey": apikey
    };
    await this.ewelinkCommand(ctx, payload);
  }


  async ewelinkCommand(ctx, payload) {
    let i = 0;
    while(this.state.ewelink.status === 'transmitting') {
      await delay(100);
      if(++i > 20) {
        ctx.reply("Сейчас шлагбаум занят")ж
      }
    }
    this.state.ewelink.status = 'transmitting'
    ctx.replyWithChatAction('typing');
    const ws = await this.getSocket();
    try {
      await ws.send(payload)
      return ctx.reply('Готово') 
    } catch(e) {
      return ctx.reply('Не могу, что-то не так')
    }

  }



  isAuthorized(id) {
    return this.users.includes(id);
  }

  async initEwelink() {
    let i = 0;
    while(this.state.ewelink.status === 'initing') {
      await delay(100);
      if(++i > 20) {
        throw new Error('Unable to connect ewelink');
      }
    }
    if(this.state.ewelink.status === 'active') {
      return;
    }
    this.state.ewelink.status = 'initing';
    /* get all devices */
    await this.ewelink.getDevices();
    if (this.ewelink_ws) {
      await this.ewelink_ws.close();
      this.ewelink_ws = null;
    }
    this.ewelink_ws = await this.ewelink.openWebSocket(this.ewelinkWsCallback.bind(this));
    this.ewelink_ws.onError.addEventListener(() => {
      this.state.ewelink.status = 'error';
    })
    this.ewelink_ws.onClose.addEventListener(() => {
      this.state.ewelink.status = 'closed';
    })
    this.state.ewelink.status = 'active';
    return;
  }

  async getSocket() {
    if(this.state.ewelink.status !== 'active') {
      await this.initEwelink();
    }
    if(this.state.ewelink.status === 'active') {
      return this.ewelink_ws;
    }
    throw new Error('Unable to get socket');
  }

  ewelinkWsCallback(message) {
    this.logger.info({
      msg: 'ws:in',
      ...message
    })
    return;
  }
}