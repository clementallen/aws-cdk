import { Construct } from 'constructs';
import * as events from '../../../aws-events';
import * as iam from '../../../aws-iam';
import * as sfn from '../../../aws-stepfunctions';
import * as cdk from '../../../core';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/**
 * An entry to be sent to EventBridge
 *
 * @see https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_PutEventsRequestEntry.html
 */
export interface EventBridgePutEventsEntry {
  /**
   * The event body
   *
   * Can either be provided as an object or as a JSON-serialized string
   * @example
   *
   * sfn.TaskInput.fromText('{"instance-id": "i-1234567890abcdef0", "state": "terminated"}');
   * sfn.TaskInput.fromObject({ Message: 'Hello from Step Functions' });
   * sfn.TaskInput.fromJsonPathAt('$.EventDetail');
   */
  readonly detail: sfn.TaskInput;

  /**
   * Used along with the source field to help identify the fields and values expected in the detail field
   *
   * For example, events by CloudTrail have detail type "AWS API Call via CloudTrail"
   * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-events.html
   */
  readonly detailType: string;

  /**
   * The event bus the entry will be sent to.
   *
   * @default - event is sent to account's default event bus
   */
  readonly eventBus?: events.IEventBus;

  /**
   * The service or application that caused this event to be generated
   *
   * Example value: `com.example.service`
   *
   * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-events.html
   */
  readonly source: string;
}

interface EventBridgePutEventsOptions {
  /**
   * The entries that will be sent. Minimum number of entries is 1 and maximum is 10,
   * unless [PutEvents API limit](https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_PutEvents.html#API_PutEvents_RequestSyntax) has changed.
   */
  readonly entries: EventBridgePutEventsEntry[];
}

/**
 * Properties for sending events with PutEvents using JSONPath
 */
export interface EventBridgePutEventsJsonPathProps extends sfn.TaskStateJsonPathBaseProps, EventBridgePutEventsOptions {}

/**
 * Properties for sending events with PutEvents using JSONata
 */
export interface EventBridgePutEventsJsonataProps extends sfn.TaskStateJsonataBaseProps, EventBridgePutEventsOptions {}

/**
 * Properties for sending events with PutEvents
 */
export interface EventBridgePutEventsProps extends sfn.TaskStateBaseProps, EventBridgePutEventsOptions {}

/**
 * A StepFunctions Task to send events to an EventBridge event bus
 */
export class EventBridgePutEvents extends sfn.TaskStateBase {
  /**
   * A StepFunctions Task using JSONPath to send events to an EventBridge event bus
   */
  public static jsonPath(scope: Construct, id: string, props: EventBridgePutEventsJsonPathProps) {
    return new EventBridgePutEvents(scope, id, props);
  }

  /**
   * A StepFunctions Task using JSONata to send events to an EventBridge event bus
   */
  public static jsonata(scope: Construct, id: string, props: EventBridgePutEventsJsonataProps) {
    return new EventBridgePutEvents(scope, id, {
      ...props,
      queryLanguage: sfn.QueryLanguage.JSONATA,
    });
  }

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EventBridgePutEventsProps) {
    super(scope, id, props);

    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, EventBridgePutEvents.SUPPORTED_INTEGRATION_PATTERNS);

    if (this.integrationPattern === sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN) {
      if (!sfn.FieldUtils.containsTaskToken(props.entries.map(entry => entry.detail))) {
        throw new cdk.ValidationError('Task Token is required in `entries`. Use JsonPath.taskToken to set the token.', this);
      }
    }

    this.validateEntries();

    this.taskPolicies = [
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: this.eventBusArns,
      }),
    ];
  }

  /**
   * Returns an array of EventBusArn strings based on this.props.entries
   */
  private get eventBusArns(): string[] {
    return this.props.entries
      .map(entry => {
        if (entry.eventBus) {
          // If an eventBus is provided, use the corresponding ARN
          return entry.eventBus.eventBusArn;
        } else {
          // If neither an eventBus nor eventBusName is provided,
          // format the ARN for the default event bus in the account.
          return cdk.Stack.of(this).formatArn({
            resource: 'event-bus',
            resourceName: 'default',
            arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
            service: 'events',
          });
        }
      });
  }

  /**
   * Provides the EventBridge put events service integration task configuration
   * @internal
   */
  protected _renderTask(topLevelQueryLanguage?: sfn.QueryLanguage): any {
    const queryLanguage = sfn._getActualQueryLanguage(topLevelQueryLanguage, this.props.queryLanguage);
    return {
      Resource: integrationResourceArn('events', 'putEvents', this.integrationPattern),
      ...this._renderParametersOrArguments({
        Entries: this.renderEntries(),
      }, queryLanguage),
    };
  }

  private renderEntries(): Object[] {
    // we should have validated all entries in validateEntries()
    return this.props.entries.map(entry => {
      return {
        Detail: entry.detail?.value,
        DetailType: entry.detailType,
        EventBusName: entry.eventBus?.eventBusArn,
        Source: entry.source,
      };
    });
  }

  private validateEntries(): void {
    if (this.props.entries.length <= 0) {
      throw new cdk.ValidationError('Value for property `entries` must be a non-empty array.', this);
    }
    if (this.props.entries.some(e => e.source.startsWith('aws.'))) {
      throw new cdk.ValidationError('Event source cannot start with "aws."', this);
    }
  }
}
