import { DiscoveryModule, ModuleRef } from '@nestjs/core';
import { OnModuleDestroy, Module, DynamicModule, Global } from '@nestjs/common';
import { AMQP_SERVICE } from './amqp.constants';
import { AmqpAsyncConfig, AmqpConfig } from './amqp.interface';
import { Publisher } from './publisher.service';
import { AmqpService } from './amqp.service';
import {
  createAsyncOptionsProvider,
  createOptionsProvider,
  createAmqpServiceProvider,
} from './amqp.provider';
import { createPublishersForDecorated } from './amqp.decorator';

@Global()
@Module({})
export class AmqpModule implements OnModuleDestroy {
  constructor(private readonly moduleRef: ModuleRef) {}

  static forRoot(options: AmqpConfig): DynamicModule {
    const optionsProvider = createOptionsProvider(options);
    const decorated = createPublishersForDecorated();
    const amqpService = createAmqpServiceProvider();
    const providers = [optionsProvider, amqpService, Publisher, ...decorated];
    return {
      module: AmqpModule,
      imports: [DiscoveryModule],
      providers,
      exports: providers,
    };
  }

  static forRootAsync(options: AmqpAsyncConfig): DynamicModule {
    const optionsProvider = createAsyncOptionsProvider(options);
    const decorated = createPublishersForDecorated();
    const amqpService = createAmqpServiceProvider();
    const providers = [optionsProvider, amqpService, Publisher, ...decorated];
    return {
      module: AmqpModule,
      imports: [DiscoveryModule],
      providers,
      exports: providers,
    };
  }

  onModuleDestroy() {
    const amqpService: AmqpService = this.moduleRef.get(AMQP_SERVICE, {
      strict: false,
    });
    amqpService.amqpDestroy();
  }
}
