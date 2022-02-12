import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Arn, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import { ContainerDefinition, FargateService } from "aws-cdk-lib/aws-ecs";
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import {
  Cors,
  LambdaIntegration,
  RequestValidator,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";

export interface DiscordBotProps {
  region: string;
  service: FargateService;
  clusterArn: Arn;
  containerDefinition: ContainerDefinition;
  configurationSecret: ISecret;
}

/**
 * Creates a sample Discord bot endpoint that can be used.
 */
export class DiscordBot extends Construct {
  /**
   * The constructor for building the stack.
   * @param {Construct} scope The Construct scope to create the stack in.
   * @param {string} id The ID of the stack to use.
   */
  constructor(scope: Construct, id: string, props: DiscordBotProps) {
    super(scope, id);
    const configurationSecret = props.configurationSecret;

    // Create the Commands Lambda.
    const discordCommandsLambda = new NodejsFunction(
      this,
      "discord-commands-lambda",
      {
        runtime: Runtime.NODEJS_14_X,
        entry: path.join(__dirname, "./discord-bot.commands.ts"),
        environment: {
          REGION: props.region,
          SERVICE_NAME: props.service.serviceName,
          CLUSTER_ARN: props.clusterArn as string,
          SECRET_NAME: configurationSecret.secretName,
        },
        handler: "handler",
        timeout: Duration.seconds(60),
        memorySize: 512,
      }
    );
    const discordBotPolicy = new Policy(this, "discordBotPolicy", {
      statements: [
        new PolicyStatement({
          resources: ["*"],
          effect: Effect.ALLOW,
          actions: [
            "ecs:ListTasks",
            "ecs:DescribeTasks",
            "ec2:DescribeNetworkInterfaces",
            "ecs:UpdateService",
          ],
        }),
      ],
    });
    discordCommandsLambda.role?.attachInlinePolicy(discordBotPolicy);
    props.configurationSecret.grantRead(discordCommandsLambda);

    // Create the Lambda for handling Interactions from our Discord bot.
    const discordBotLambda = new NodejsFunction(this, "discord-bot-lambda", {
      runtime: Runtime.NODEJS_14_X,
      entry: path.join(__dirname, "./discord-bot.validator.ts"),
      handler: "handler",
      environment: {
        SECRET_NAME: configurationSecret.secretName,
        COMMAND_LAMBDA_ARN: discordCommandsLambda.functionArn,
      },
      timeout: Duration.seconds(3),
    });
    discordCommandsLambda.addEnvironment(
      "DISCORD_BOT_API_KEY_NAME",
      configurationSecret.secretName
    );

    configurationSecret.grantRead(discordBotLambda);
    configurationSecret.grantRead(discordCommandsLambda);
    discordCommandsLambda.grantInvoke(discordBotLambda);

    // Create our API Gateway
    const discordBotAPI = new RestApi(this, "discord-bot-api", {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
      },
    });
    const discordBotAPIValidator = new RequestValidator(
      this,
      "discord-bot-api-validator",
      {
        restApi: discordBotAPI,
        validateRequestBody: true,
        validateRequestParameters: true,
      }
    );

    // User authentication endpoint configuration
    const discordBotEventItems = discordBotAPI.root.addResource("event", {
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
      },
    });

    // Transform our requests and responses as appropriate.
    const discordBotIntegration: LambdaIntegration = new LambdaIntegration(
      discordBotLambda,
      {
        proxy: false,
        requestTemplates: {
          "application/json":
            '{\r\n\
              "timestamp": "$input.params(\'x-signature-timestamp\')",\r\n\
              "signature": "$input.params(\'x-signature-ed25519\')",\r\n\
              "jsonBody" : $input.json(\'$\')\r\n\
            }',
        },
        integrationResponses: [
          {
            statusCode: "200",
          },
          {
            statusCode: "401",
            selectionPattern: ".*[UNAUTHORIZED].*",
            responseTemplates: {
              "application/json": "invalid request signature",
            },
          },
        ],
      }
    );

    // Add a POST method for the Discord APIs.
    discordBotEventItems.addMethod("POST", discordBotIntegration, {
      apiKeyRequired: false,
      requestValidator: discordBotAPIValidator,
      methodResponses: [
        {
          statusCode: "200",
        },
        {
          statusCode: "401",
        },
      ],
    });
  }
}
