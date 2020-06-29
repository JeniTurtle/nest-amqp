export class AmqpUtil {
  static getPublisherToken(exchange: string) {
    return `__AMQPPublisher${exchange}__`;
  }
}
