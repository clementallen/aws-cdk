import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as cdk from 'aws-cdk-lib';
import { ExpectedResult, IntegTest } from '@aws-cdk/integ-tests-alpha';

/*
 * Stack verification steps : // TODO
 * * aws stepfunctions start-execution --state-machine-arn <deployed state machine arn> : should return execution arn
 * * aws stepfunctions describe-execution --execution-arn <execution-arn generated before> : should return status as SUCCEEDED
 */
const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-kinesis-stream-consumer-integ');

const stream = new kinesis.Stream(stack, 'myStream');

new kinesis.Consumer(stack, 'myConsumer', { stream, consumerName: 'consumer-name' });

const testCase = new IntegTest(app, 'Consumer', {
  testCases: [stack],
});

// TODO: get working
const describe = testCase.assertions.awsApiCall('Kinesis', 'describeStreamConsumer', {
  'streamARN': stream.streamArn,
  'consumer name': 'consumer-name',
});

// assert the results
describe.expect(
  ExpectedResult.objectLike({
    consumerStatus: 'ACTIVE',
  }),
);

app.synth();
