import { Construct } from 'constructs';
import { CfnStreamConsumer } from './kinesis.generated';
import { Stream } from './stream';
import * as iam from '../../aws-iam';
import { ArnFormat, IResource, Resource, Stack } from '../../core';

const READ_OPERATIONS = [ // TODO
  'kinesis:DescribeStreamSummary',
  'kinesis:GetRecords',
  'kinesis:GetShardIterator',
  'kinesis:ListShards',
  'kinesis:SubscribeToShard',
  'kinesis:DescribeStream',
  'kinesis:ListStreams',
  'kinesis:DescribeStreamConsumer',
];

/**
 * A Kinesis Consumer
 */
export interface IConsumer extends IResource {
  /**
   * The ARN of the consumer.
   *
   * @attribute
   */
  readonly consumerArn: string;

  /**
   * The name of the consumer
   *
   * @attribute
   */
  readonly consumerName: string;

  /**
   * Grant read permissions for this consumer and its contents to an IAM
   * principal (Role/Group/User).
   */
  grantRead(grantee: iam.IGrantable): iam.Grant;

  /**
   * Grant the indicated permissions on this consumer to the provided IAM principal.
   */
  grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;
}

/**
 * A reference to a consumer. The easiest way to instantiate is to call
 * `consumer.export()`. Then, the consumer can use `Consumer.import(this, ref)` and
 * get a `Consumer`.
 */
export interface ConsumerAttributes {
  /**
   * The ARN of the consumer.
   */
  readonly consumerArn: string;
}

/**
 * Represents a Kinesis Consumer.
 */
abstract class ConsumerBase extends Resource implements IConsumer {
  /**
   * The ARN of the consumer.
   */
  public abstract readonly consumerArn: string;

  /**
   * The name of the consumer
   */
  public abstract readonly consumerName: string;

  /**
   * Grant read permissions for this consumer and its contents to an IAM
   * principal (Role/Group/User).
   */
  public grantRead(grantee: iam.IGrantable) {
    const ret = this.grant(grantee, ...READ_OPERATIONS);

    return ret;
  }

  /**
   * Grant the indicated permissions on this consumer to the given IAM principal (Role/Group/User).
   */
  public grant(grantee: iam.IGrantable, ...actions: string[]) {
    return iam.Grant.addToPrincipal({
      grantee,
      actions,
      resourceArns: [this.consumerArn],
      scope: this,
    });
  }

}

/**
 * Properties for a Kinesis Consumer
 */
export interface ConsumerProps {
  /**
   * Enforces a particular physical consumer name.
   * @default <generated>
   */
  readonly consumerName?: string;

  /**
   * The Kinesis stream to register the consumer against.
   */
  readonly stream: Stream;
}

/**
 * A Kinesis consumer. Can be encrypted with a KMS key.
 */
export class Consumer extends ConsumerBase {

  /**
   * Import an existing Kinesis Consumer provided an ARN
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name
   * @param consumerArn Consumer ARN (i.e. arn:aws:kinesis:<region>:<account-id>:stream/Foo/consumer/Bar/<timestamp>) TODO
   */
  public static fromConsumerArn(scope: Construct, id: string, consumerArn: string): IConsumer {
    return Consumer.fromConsumerAttributes(scope, id, { consumerArn });
  }

  /**
   * Creates a Consumer construct that represents an external consumer.
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param attrs Consumer import properties
   */
  public static fromConsumerAttributes(scope: Construct, id: string, attrs: ConsumerAttributes): IConsumer {
    class Import extends ConsumerBase {
      public readonly consumerArn = attrs.consumerArn;
      public readonly consumerName = Stack.of(scope).splitArn(attrs.consumerArn, ArnFormat.SLASH_RESOURCE_NAME).resourceName!; // TODO
    }

    return new Import(scope, id);
  }

  public readonly consumerArn: string;
  public readonly consumerName: string;

  private readonly consumer: CfnStreamConsumer;

  constructor(scope: Construct, id: string, props: ConsumerProps) {
    super(scope, id, {
      physicalName: props.consumerName,
    });

    this.consumer = new CfnStreamConsumer(this, 'Resource', {
      consumerName: props.consumerName || '', // TODO
      streamArn: props.stream.streamArn,
    });

    this.consumerArn = this.getResourceArnAttribute(this.consumer.attrConsumerArn, {
      service: 'kinesis',
      resource: 'stream', // TODO
      resourceName: this.physicalName,
    });
    this.consumerName = this.getResourceNameAttribute(this.consumer.ref);
  }
}
