import { connect, ConfirmChannel, Connection } from "amqplib";
import {
  Injectable,
  Provider,
  Logger,
  LoggerService,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { AMQP_CONSUMER_METADATA } from "./amqp.constants";
import { AmqpConfig } from "./amqp.interface";

function defaultDecode(data: Buffer) {
  return JSON.parse(data.toString());
}

@Injectable()
export class AmqpService implements OnApplicationBootstrap {
  public static amqpProviders: Provider[];

  private logger: Logger | LoggerService;
  private needReconnect = true;
  private reconnectTimer: NodeJS.Timeout;
  private _connection: Connection;
  private _channel: ConfirmChannel;

  get connection() {
    return this._connection;
  }

  get channel() {
    return this._channel;
  }

  get config() {
    return this.amqpConfig;
  }

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly amqpConfig: AmqpConfig
  ) {
    this.logger = amqpConfig.logger || new Logger(AmqpService.name);
  }

  async amqpInit() {
    await this.connect();
    await this.createChannel();
  }

  onApplicationBootstrap() {
    this.explore();
  }

  async amqpDestroy() {
    this.needReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this._connection) {
      try {
        await this._connection.close();
      } catch (err) {}
      this._connection = null;
    }
  }

  private async connect() {
    this._connection = await connect(this.amqpConfig.connection);
    this._connection.once("close", this.onConnectionClose.bind(this));
    this._connection.on("error", (err) => this.logger.error(err));
  }

  async createChannel() {
    try {
      // 默认开启confirm模式
      this._channel = await this._connection.createConfirmChannel();
      this._channel.on("close", () => this.onChannelClose());
      this._channel.on("error", (error) => this.onChannelError(error));
    } catch (err) {
      setTimeout(() => {
        this.createChannel();
      }, 1000);
    }
  }

  private explore() {
    const providers: InstanceWrapper[] = this.discoveryService.getProviders();
    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (instance) {
        this.initConsumer(instance);
      }
    }
  }

  private initConsumer(instance: any) {
    this.metadataScanner.scanFromPrototype(
      instance,
      Object.getPrototypeOf(instance),
      async (key) => {
        const queueName: string = this.reflector.get(
          AMQP_CONSUMER_METADATA,
          instance[key]
        );
        if (!queueName) {
          return;
        }
        const queueMetadata = this.amqpConfig.queues.find(
          (option) => option.queue === queueName
        );
        const exchangeMetadate = this.amqpConfig.exchanges.find(
          (option) => option.exchange === queueMetadata.exchange
        );
        const { exchange, type, options: exchangeOptions } = exchangeMetadate;
        const {
          nackOptions = {},
          options: queueOptions,
          patterns,
          consume = {},
          decode = defaultDecode,
        } = queueMetadata;
        await this._channel.assertExchange(
          exchange,
          type || "direct",
          exchangeOptions
        );
        const queue = await this._channel.assertQueue(queueName, queueOptions);
        if (exchangeMetadate.type !== "fanout") {
          if (patterns instanceof Array) {
            for (const pattern of patterns) {
              await this._channel.bindQueue(queue.queue, exchange, pattern);
            }
          } else {
            await this._channel.bindQueue(queue.queue, exchange, patterns);
          }
        } else {
          await this._channel.bindQueue(queue.queue, exchange, "");
        }
        await this._channel.prefetch(1);
        await this._channel.consume(
          queue.queue,
          async (msg) => {
            this.logger.log(
              `Received AMQP Message: { Exchange: ${exchange}, Queue: ${queue.queue}, Function: ${instance[key].name} }`
            );
            try {
              await instance[key](
                decode(msg.content),
                msg.fields,
                msg.properties
              );
              this._channel.ack(msg);
            } catch (err) {
              this._channel.nack(msg, nackOptions.allUpTo, nackOptions.requeue);
              this.logger.error(err);
            }
          },
          {
            ...consume,
            noAck: consume.noAck === true ? true : false,
          }
        );
        this.logger.log(
          `[Consumer -> exchange: ${exchange} queue: ${queue.queue}] initialized`
        );
      }
    );
  }

  onConnectionClose() {
    if (this.needReconnect) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = undefined;
        this.amqpInit().catch(() => {
          this.onConnectionClose();
        });
      }, 3000);
    }
  }

  async closeChannel() {
    if (!this._channel) {
      return;
    }
    try {
      await this._channel.close();
    } catch (err) {
      // this.logger.error(err);
    }
    this._channel = null;
  }

  async onChannelError(error) {
    error && this.logger.error(error);
  }

  async onChannelClose() {
    await this.closeChannel();
    setTimeout(() => {
      this.createChannel();
    }, 3000);
  }
}
