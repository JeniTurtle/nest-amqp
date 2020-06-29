import { FactoryProvider, Logger, LoggerService } from '@nestjs/common';
import { Options } from 'amqplib';

export interface ExchangeOptions {
  exchange: string;
  type?: string;
  options?: Options.AssertExchange;
  publish?: Options.Publish;
  encode?: (data: Buffer) => Buffer;
}

export interface QueueOptions {
  queue: string;
  exchange: string;
  options?: Options.AssertQueue;
  consume?: Options.Consume;
  nackOptions?: { allUpTo?: boolean; requeue?: boolean };
  decode?: Function;
  patterns: string | string[];
}

export interface PublishParams {
  msg: any;
  routingKey?: string;
  publishOptions?: Options.Publish;
  encode?: (data: any) => Buffer;
  callback?: (err: any) => void;
}

export interface AmqpConfig {
  connection: Options.Connect;
  exchanges: ExchangeOptions[];
  queues: QueueOptions[];
  logger?: Logger | LoggerService;
}

export interface AmqpAsyncConfig {
  name?: string;
  useFactory: (...args: any[]) => Promise<AmqpConfig> | AmqpConfig;
  inject?: FactoryProvider['inject'];
}
