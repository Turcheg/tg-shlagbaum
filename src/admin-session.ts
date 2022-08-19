import { Context } from "telegraf";
import App from "./app";
import { LoggerInterface, UserFieldTgId } from "./types";
import Sessions from './sessions'

type AdminSessionState = {
  loading: boolean;
  current_step: string;
  step_data: Record<string, any>;
} | null;

export default class AdminSession {
  app: App;
  user_id: UserFieldTgId;
  state: AdminSessionState = null;
  l: LoggerInterface;

  constructor(app: App, user_tg_id: UserFieldTgId, logger: LoggerInterface) {
    this.app = app;
    this.user_id = user_tg_id;
    this.l = logger;
  }

  async initSession(command: string, ctx: Context) {
    if(this.state !== null) {
      return this.udpateSession();
    }
    this.getSessionClassFromCommand(command)
  }
  
  getSessionClassFromCommand(command: string) {
    return Sessions[command] ?? undefined
  }

  async updateSession()
  {

  }
}