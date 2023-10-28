import { Match, Template } from '../../assertions';
import { Stack } from '../../core';
import { Stream, Consumer } from '../lib';

describe('Kinesis data stream consumer', () => {
  test('default consumer', () => {
    const stack = new Stack();
    const stream = new Stream(stack, 'MyStream', {});
    new Consumer(stack, 'MyConsumer', { stream, consumerName: 'consumer-name' }); // TODO: auto-generated name

    Template.fromStack(stack).templateMatches({
      Resources: {
        MyStream5C050E93: {
          Type: 'AWS::Kinesis::Stream',
          Properties: {
            ShardCount: 1,
            RetentionPeriodHours: 24,
            StreamEncryption: {
              'Fn::If': [
                'AwsCdkKinesisEncryptedStreamsUnsupportedRegions',
                {
                  Ref: 'AWS::NoValue',
                },
                {
                  EncryptionType: 'KMS',
                  KeyId: 'alias/aws/kinesis',
                },
              ],
            },
          },
        },
        MyConsumer023293B5: {
          Type: 'AWS::Kinesis::StreamConsumer',
          Properties: { ConsumerName: 'consumer-name', StreamARN: { 'Fn::GetAtt': ['MyStream5C050E93', 'Arn'] } },
        },
      },
      Conditions: {
        AwsCdkKinesisEncryptedStreamsUnsupportedRegions: {
          'Fn::Or': [
            {
              'Fn::Equals': [
                {
                  Ref: 'AWS::Region',
                },
                'cn-north-1',
              ],
            },
            {
              'Fn::Equals': [
                {
                  Ref: 'AWS::Region',
                },
                'cn-northwest-1',
              ],
            },
          ],
        },
      },
    });
  }),

  test('consumer from attributes has the expected consumerArn', () => {
    const stack = new Stack();
    const consumer = Consumer.fromConsumerAttributes(stack, 'MyConsumer', {
      consumerArn: 'arn:aws:kinesis:region:account-id:stream/stream-name/consumer/consumer-name:timestamp',
    });

    expect(consumer.consumerArn).toEqual(
      'arn:aws:kinesis:region:account-id:stream/stream-name/consumer/consumer-name:timestamp',
    );
  });

  test('consumer from attributes has the expected consumerName', () => {
    const stack = new Stack();
    const consumer = Consumer.fromConsumerAttributes(stack, 'MyConsumer', {
      consumerArn: 'arn:aws:kinesis:region:account-id:stream/stream-name/consumer/consumer-name:timestamp',
    });

    expect(consumer.consumerName).toEqual('consumer-name');
  });
});
