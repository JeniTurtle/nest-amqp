<h1 align="center">Nestjs AMQP</h1>

<p align="center">RabbitMQ component for NestJs.</p>

## Features

- Automatic consumption with annotations.
- Depend on `@jiaxinjiang/nest-config` module configuration information.

### Installation

**Yarn**
```bash
yarn add @jiaxinjiang/nest-amqp
```

**NPM**
```bash
npm install @jiaxinjiang/nest-amqp --save
```

### Getting Started

You can use it with `@jiaxinjiang/nest-remote-config`.

Directory structure:

```bash
├── env
│   ├── env
│   ├── env.dev
│   ├── env.prod
│   ├── env.test
├── src
│   ├── app
│       ├── app.module.ts
│       ├── consumer.service.ts
│       ├── publiser.service.ts
│   ├── config
│       ├── amqp.config.ts
│       ├── nacos.config.ts
```

AMQP configuration file:

```ts
// amqp.config

import { Options } from 'amqplib';
import { ExchangeOptions, QueueOptions } from '@jiaxinjiang/nest-amqp';

export default {
  vhostName: {
    // @ts-ignore
    connection: {
      protocol: 'amqp',
      hostname: '${rabbitmq.host}', // Get from Nacos;
      port: '${rabbitmq.port}', // Get from Nacos;
      username: '${rabbitmq.username}', // Get from Nacos;
      password: '${rabbitmq.password}', // Get from Nacos;
      locale: 'en_US',
      frameMax: 0,
      heartbeat: 0,
      vhost: '${rabbitmq.virtualHost}', // Get from Nacos;
    } as Options.Connect,
    exchanges: [
      {
        exchange: 'testExchagne',
        type: 'direct',
        options: {
          durable: true,
        },
      },
    ] as ExchangeOptions[],
    queues: [
      {
        queue: 'testQueue',
        exchange: 'testExchagne',
        nackOptions: { requeue: false },
        patterns: 'testRouting',
      },
    ] as QueueOptions[],
  },
};
```

Register the module in app.module.ts

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@jiaxinjiang/nest-config';
import { RemoteConfigModule } from '@jiaxinjiang/nest-remote-config';
import { LoggerModule } from '@jiaxinjiang/nest-logger';
import { LoggerModule } from '@jiaxinjiang/nest-amqp';

@Module({
    imports: [
        LoggerModule.forRoot(),
        RemoteConfigModule.forRoot(),
        ConfigModule,
        AmqpModule.forRootAsync({
          useFactory: (configService: ConfigService, logger: LoggerProvider) => {
            const options: AmqpConfig = configService.get('amqp')['vhostName'];
            if (!options.connection.vhost) {
              options.connection.vhost = name;
            }
            options.logger = logger.setContext('AmqpModule');
            return options;
          },
          inject: [RemoteConfigService, LoggerProvider],
        }),
    ],
})
export class AppModule {}
```

Consumption:

```ts
// consumer.service.ts

import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Consume } from '@shared/amqp';

@Injectable()
export class ConsumerService {
  constructor() {}

  @Consume('testQueue')
  async consume(content, fields, properties) {
    console.log(message, fields, properties);
  }
}
```

Publish:

```ts
// publisher.service.ts

import { InjectPubliser, Publisher } from '@shared/amqp';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PublisherService {
  constructor(
    @InjectPubliser('testExchange')
    private readonly testPublisher: Publisher,
  ) {}

  push() {
    return this.testPublisher.publish({
      msg: { a: 123 },
      routingKey: 'testRouting',
    });
  }
}

```