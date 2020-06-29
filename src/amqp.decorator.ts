import { Provider, SetMetadata, Inject } from '@nestjs/common';
import { AMQP_CONSUMER_METADATA } from './amqp.constants';
import { Publisher } from './publisher.service';

const decoratedTokenPrefix = 'AmqpPubliser:';
const decoratedPublishers = new Set<string>();

function createDecoratedPublisherProvider(
  exchange: string,
): Provider<Promise<Publisher>> {
  return {
    provide: `${decoratedTokenPrefix}${exchange}`,
    useFactory: async (publisher: Publisher) => {
      await publisher.setExchange(exchange);
      return publisher;
    },
    inject: [Publisher],
  };
}

export function InjectPubliser(context: string) {
  decoratedPublishers.add(context);
  return Inject(`${decoratedTokenPrefix}${context}`);
}

export function createPublishersForDecorated() {
  return [...decoratedPublishers.values()].map(exchange =>
    createDecoratedPublisherProvider(exchange),
  );
}

export function Consume(queue: string) {
  return SetMetadata(AMQP_CONSUMER_METADATA, queue);
}
