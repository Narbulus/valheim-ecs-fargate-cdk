import * as cdk from "aws-cdk-lib";
import * as transfer from "aws-cdk-lib/aws-transfer";
import * as agw from "aws-cdk-lib/aws-apigateway";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { ContainerDefinition, FargateService } from "aws-cdk-lib/aws-ecs";
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface ServerApiProps {
  region: string;
  service: FargateService;
  clusterArn: cdk.Arn;
  containerDefinition: ContainerDefinition;
  /**
   * Password for the server status API
   */
  readonly password: string;
}

export class ServerApi extends Construct {
  readonly server: transfer.CfnServer;

  constructor(scope: Construct, id: string, props: ServerApiProps) {
    super(scope, id);

    const service = props.service;
    const apiLog = new logs.LogGroup(this, "ServerStatusAPILogs");
    const api = new agw.RestApi(this, `ServerRestAPI`, {
      deployOptions: {
        accessLogDestination: new agw.LogGroupLogDestination(apiLog),
        accessLogFormat: agw.AccessLogFormat.jsonWithStandardFields(),
      },
    });
    const lambdaEnv = {
      REGION: props.region,
      SERVICE_NAME: service.serviceName as string,
      CLUSTER_ARN: props.clusterArn as string,
    };

    const serverStatusHandler = new lambda.NodejsFunction(this, "status", {
      environment: lambdaEnv,
    });
    const ecsStatusPolicy = new Policy(this, "ecsStatusPolicy", {
      statements: [
        new PolicyStatement({
          resources: ["*"],
          effect: Effect.ALLOW,
          actions: [
            "ecs:ListTasks",
            "ecs:DescribeTasks",
            "ec2:DescribeNetworkInterfaces",
          ],
        }),
      ],
    });
    serverStatusHandler.role?.attachInlinePolicy(ecsStatusPolicy);

    const serverUpdateHandler = new lambda.NodejsFunction(this, "update", {
      environment: {
        ...lambdaEnv,
        PASSWORD: props.password,
      },
    });
    const ecsUpdatePolicy = new Policy(this, "ecsUpdatePolicy", {
      statements: [
        new PolicyStatement({
          resources: [service.serviceArn],
          effect: Effect.ALLOW,
          actions: ["ecs:UpdateService"],
        }),
      ],
    });
    serverUpdateHandler.role?.attachInlinePolicy(ecsUpdatePolicy);

    const route = api.root;
    route.addMethod("GET", new agw.LambdaIntegration(serverStatusHandler));
    route.addMethod("POST", new agw.LambdaIntegration(serverUpdateHandler));
  }
}
