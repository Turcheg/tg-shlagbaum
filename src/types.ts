import { Logger, LoggerOptions } from "pino";

export type UserPermission = 1 | 2 | 4 | 8 | -1;
export type UserPermissionName = [UserPermission, string];
export type UserFieldTgId = number;
export type UserFieldName = string;
export type UserFieldAddress = string;
export type UserFieldPermissions = number;

export type UserDbElement = [
  UserFieldTgId,
  UserFieldName,
  UserFieldAddress,
  UserFieldPermissions
];
export type UserDbElements = UserDbElement[];
export interface User {
  tg_id: number;
  name: string;
  address: string;
  permissions: number;
}
export interface EwelinkConfig {
  email: string;
  password: string;
  region: string;
  cmd_device_id: string;
  cmd_open_ch: number;
  cmd_close_ch: number;
}
export interface TgConfig {
  token: string;
  journal: number;
}
export interface Config {
  ewelink: EwelinkConfig;
  tg: TgConfig;
  users: string;
  logger: LoggerOptions;
  users_db_file: string;
}
export interface LoggerNoop {
  error: () => void;
  info: () => void;
  trace: () => void;
  debug: () => void;
  warn: () => void;
  child: () => LoggerNoop;
}

export type LoggerInterface = Logger | LoggerNoop;


export interface EwelinkSocketMessage {
  action?: string;
  error?: number;
  sequence?: string;
  reason?: string;
}