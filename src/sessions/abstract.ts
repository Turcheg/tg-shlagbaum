import { Context } from "telegraf";

export abstract class Step {
  name: string = 'abstract';
  step_state: Record<string, any>;
  update: Context;
  constructor(step_state: Record<string, any>, update: Context) {
    this.step_state = step_state;
    this.update = update;
  }

  async init():Promise<void> {
    return;
  }
  async validate(): Promise<boolean> {
    return true;
  }
  async result(): Promise<Step | boolean> {
    return true;
  }

  public readonly process = async() => {
    try {
      await this.init();
      if(await this.validate()) {
        return await this.result();
      }
    } catch(e) {
      return false;
    }
  }


}