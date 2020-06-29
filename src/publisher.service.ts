import * as lodash from 'lodash';
import { ConfirmChannel } from 'amqplib';
import { Inject, Injectable, Scope, Logger, LoggerService } from '@nestjs/common';
import { AmqpService } from './amqp.service';
import { AMQP_SERVICE } from './amqp.constants';
import { ExchangeOptions, AmqpConfig, PublishParams } from './amqp.interface';

function defaultEncode(msg: any) {
  return Buffer.from(JSON.stringify(msg));
}

@Injectable({ scope: Scope.TRANSIENT })
export class Publisher {
  private logger: Logger | LoggerService;
  private amqpConfig: AmqpConfig;
  private channel: ConfirmChannel;
  private exchangeOptions: ExchangeOptions;

  constructor(
    @Inject(AMQP_SERVICE) private readonly amqpService: AmqpService,
  ) {
    this.amqpConfig = this.amqpService.config;
    this.channel = this.amqpService.channel;
    this.logger = this.amqpConfig.logger || new Logger(AmqpService.name);
  }

  async setExchange(exchange: string) {
    this.exchangeOptions = this.amqpConfig.exchanges.find(
      option => option.exchange === exchange,
    );
    const { type, options } = this.exchangeOptions;
    await this.channel.assertExchange(exchange, type || 'direct', options);
    this.logger.log(`[Publisher -> exchange:${exchange}] initialized`);
  }
  publish(params: PublishParams | string) {
    const { publish: publishConfig, exchange } = this.exchangeOptions;
    const content: string = lodash.isString(params) ? params : params.msg;
    const encodeFn = this.exchangeOptions.encode || defaultEncode;
    const data: PublishParams = lodash.isString(params)
      ? {
          msg: content,
          routingKey: '',
          encode: encodeFn,
          publishOptions: publishConfig,
        }
      : params;
    const {
      msg,
      routingKey = '',
      encode = encodeFn,
      publishOptions = publishConfig,
      callback,
    } = data;
    return this.channel.publish(
      exchange,
      routingKey,
      encode(msg),
      publishOptions,
      callback,
    );
  }
}
