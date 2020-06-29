import { Provider } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { AmqpAsyncConfig, AmqpConfig } from './amqp.interface';
import { AMQP_OPTION, AMQP_SERVICE } from './amqp.constants';
import { AmqpService } from './amqp.service';

export function createOptionsProvider(
  amqpOption: AmqpConfig,
): Provider<AmqpConfig> {
  return {
    provide: AMQP_OPTION,
    useValue: amqpOption,
  };
}

export function createAsyncOptionsProvider(
  options: AmqpAsyncConfig,
): Provider {
  return {
    provide: AMQP_OPTION,
    useFactory: options.useFactory,
    inject: options.inject || [],
  };
}

export function createAmqpServiceProvider() {
  return {
    provide: AMQP_SERVICE,
    useFactory: async (
      discoveryService: DiscoveryService,
      metadataScanner: MetadataScanner,
      reflector: Reflector,
      amqpConfig: AmqpConfig,
    ) => {
      const amqpService = new AmqpService(
        discoveryService,
        metadataScanner,
        reflector,
        amqpConfig,
      );
      await amqpService.amqpInit();
      return amqpService;
    },
    inject: [
      DiscoveryService,
      MetadataScanner,
      Reflector,
      AMQP_OPTION,
    ],
  };
}
