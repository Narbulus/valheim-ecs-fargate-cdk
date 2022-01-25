import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Arn, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import { DiscordBotConstruct } from "@spenhand/discord-bot-cdk-construct";
import { ContainerDefinition, FargateService } from "aws-cdk-lib/aws-ecs";
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface DiscordBotProps {
  region: string;
  service: FargateService;
  clusterArn: Arn;
  containerDefinition: ContainerDefinition;
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

    // Create the Commands Lambda.
    const discordCommandsLambda = new NodejsFunction(
      this,
      "discord-commands-lambda",
      {
        runtime: Runtime.NODEJS_14_X,
        bundling: {
          nodeModules: ["punycode"],
        },
        entry: path.join(__dirname, "./discord-bot.commands.ts"),
        environment: {
          REGION: props.region,
          SERVICE_NAME: props.service.serviceName,
          CLUSTER_ARN: props.clusterArn as string,
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

    const discordBot = new DiscordBotConstruct(this, "discord-bot-endpoint", {
      commandsLambdaFunction: discordCommandsLambda,
    });
  }
}
