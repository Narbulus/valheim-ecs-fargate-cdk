import * as cdk from "aws-cdk-lib";
import * as transfer from "aws-cdk-lib/aws-transfer";
import * as agw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "@aws-cdk/aws-lambda-python-alpha";
import * as logs from "aws-cdk-lib/aws-logs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface PasswordAuthenticatedFtpProps {
  /**
   * Protocol for Transfer server
   *
   * @default - "SFTP"
   */
  readonly protocol?: "SFTP" | "FTP";
}

export class PasswordAuthenticatedFtp extends Construct {
  readonly server: transfer.CfnServer;

  constructor(
    scope: Construct,
    id: string,
    props: PasswordAuthenticatedFtpProps
  ) {
    super(scope, id);

    const protocol = props.protocol ?? "SFTP";

    const apiLog = new logs.LogGroup(this, "TransferServiceAuthApiLogs");
    const api = new agw.RestApi(this, `TransferServiceAuthApi`, {
      deployOptions: {
        accessLogDestination: new agw.LogGroupLogDestination(apiLog),
        accessLogFormat: agw.AccessLogFormat.jsonWithStandardFields(),
      },
    });

    const authHandler = new lambda.PythonFunction(this, `AuthHandler`, {
      entry: "lib/ftp/custom-authorizer",
      runtime: Runtime.PYTHON_3_9,
    });

    const route = api.root
      .addResource("servers")
      .addResource("{serverId}")
      .addResource("users")
      .addResource("{username}")
      .addResource("config");
    route.addMethod("GET", new agw.LambdaIntegration(authHandler), {
      authorizationType: agw.AuthorizationType.IAM,
    });

    const loggingRole = new iam.Role(this, `LoggingRole`, {
      assumedBy: new iam.ServicePrincipal("transfer.amazonaws.com"),
    });
    loggingRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSTransferLoggingAccess"
      )
    );

    const authenticationRole = new iam.Role(this, `AuthenticationRole`, {
      assumedBy: new iam.ServicePrincipal("transfer.amazonaws.com"),
    });
    authenticationRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [api.arnForExecuteApi()],
        actions: ["execute-api:Invoke"],
      })
    );

    const server = new transfer.CfnServer(this, "Server", {
      endpointType: "PUBLIC",
      protocols: [protocol],
      loggingRole: loggingRole.roleArn,
      identityProviderType: "API_GATEWAY",
      identityProviderDetails: {
        url: api.url,
        invocationRole: authenticationRole.roleArn,
      },
      domain: "EFS",
    });

    // cannot use inline policy due to circular dependency
    const authHandlerPolicy = new iam.Policy(this, "AuthHandlerPolicy", {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: [
            cdk.Stack.of(this).formatArn({
              service: "secretsmanager",
              resource: `secret:ftpSecret/${server.attrServerId}/*`,
            }),
          ],
          actions: ["secretsmanager:GetSecretValue"],
        }),
      ],
    });

    authHandlerPolicy.attachToRole(authHandler.role!);

    this.server = server;
  }
}
