import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as secretsManager from "aws-cdk-lib/aws-secretsmanager";
import * as efs from "aws-cdk-lib/aws-efs";
import { PasswordAuthenticatedFtp } from "./ftp/password-authenticated-ftp";
import { FtpUser } from "./ftp/ftp-user";
import { ServerApi } from "./api/server-api";
import { applyWebooks } from "./discord/apply-webhooks";
import { DiscordBot } from "./discord/discord-bot";

export interface ValheimServerProps extends cdk.StackProps {
  /**
   * Initialize an FTP transfer server
   */
  readonly useFTP?: boolean;

  readonly useServerStatusAPI?: boolean;

  readonly useDiscordWebhookIntegration?: boolean;
  readonly useDiscordBotIntegration?: boolean;
}

export class ValheimServerAwsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ValheimServerProps) {
    super(scope, id, props);

    // MUST BE DEFINED BEFORE RUNNING CDK DEPLOY! Key Value should be: VALHEIM_SERVER_PASS
    const valheimServerPass = secretsManager.Secret.fromSecretNameV2(
      this,
      "predefinedValheimServerPass",
      "valheimServerPass"
    );

    const vpc = new ec2.Vpc(this, "valheimVpc", {
      cidr: "10.0.0.0/24",
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "valheimPublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      maxAzs: 1,
    });
    const fargateCluster = new ecs.Cluster(this, "fargateCluster", {
      vpc: vpc,
    });

    const serverFileSystem = new efs.FileSystem(this, "valheimServerStorage", {
      vpc: vpc,
      encrypted: true,
    });

    if (props?.useFTP) {
      // an AWS Transfer server
      const ftp = new PasswordAuthenticatedFtp(this, `Ftp`, {
        protocol: "SFTP",
      });

      // You can specify password explicitly
      new FtpUser(this, `user`, {
        transferServerId: ftp.server.attrServerId,
        accessibleFS: serverFileSystem,
        password: "password",
      });
    }

    const serverVolumeConfig: ecs.Volume = {
      name: "valheimServerVolume",
      efsVolumeConfiguration: {
        fileSystemId: serverFileSystem.fileSystemId,
      },
    };

    const mountPoint: ecs.MountPoint = {
      containerPath: "/config",
      sourceVolume: serverVolumeConfig.name,
      readOnly: false,
    };

    const valheimTaskDefinition = new ecs.TaskDefinition(
      this,
      "valheimTaskDefinition",
      {
        compatibility: ecs.Compatibility.FARGATE,
        cpu: "2048",
        memoryMiB: "4096",
        volumes: [serverVolumeConfig],
        networkMode: ecs.NetworkMode.AWS_VPC,
      }
    );

    const container = valheimTaskDefinition.addContainer("valheimContainer", {
      image: ecs.ContainerImage.fromRegistry("lloesche/valheim-server"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "ValheimServer" }),
      environment: {
        SERVER_NAME: "ValheimWithFriends",
        SERVER_PORT: "2456",
        WORLD_NAME: "warzone",
        SERVER_PUBLIC: "true",
        UPDATE_INTERVAL: "900",
        BACKUPS_INTERVAL: "3600",
        BACKUPS_DIRECTORY: "/config/backups",
        BACKUPS_MAX_AGE: "3",
        BACKUPS_DIRECTORY_PERMISSIONS: "755",
        BACKUPS_FILE_PERMISSIONS: "644",
        BEPINEX: "true",
        CONFIG_DIRECTORY_PERMISSIONS: "755",
        WORLDS_DIRECTORY_PERMISSIONS: "755",
        WORLDS_FILE_PERMISSIONS: "644",
        DNS_1: "10.0.0.2",
        DNS_2: "10.0.0.2",
        STEAMCMD_ARGS: "validate",
      },
      secrets: {
        SERVER_PASS: ecs.Secret.fromSecretsManager(
          valheimServerPass,
          "VALHEIM_SERVER_PASS"
        ),
      },
    });

    container.addPortMappings(
      {
        containerPort: 2456,
        hostPort: 2456,
        protocol: ecs.Protocol.UDP,
      },
      {
        containerPort: 2457,
        hostPort: 2457,
        protocol: ecs.Protocol.UDP,
      },
      {
        containerPort: 2458,
        hostPort: 2458,
        protocol: ecs.Protocol.UDP,
      }
    );
    container.addMountPoints(mountPoint);
    if (props?.useDiscordWebhookIntegration) {
      applyWebooks(container, "FIXME");
    }

    const valheimService = new ecs.FargateService(this, "valheimService", {
      cluster: fargateCluster,
      taskDefinition: valheimTaskDefinition,
      desiredCount: 0,
      assignPublicIp: true,
      platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
    });

    serverFileSystem.connections.allowDefaultPortFrom(valheimService);
    valheimService.connections.allowFromAnyIpv4(
      new ec2.Port({
        protocol: ec2.Protocol.UDP,
        stringRepresentation: "valheimPorts",
        fromPort: 2456,
        toPort: 2458,
      })
    );

    if (props?.useServerStatusAPI) {
      new ServerApi(this, "ServerApi", {
        clusterArn: fargateCluster.clusterArn,
        containerDefinition: container,
        password: "doodle",
        region: this.region,
        service: valheimService,
      });
    }

    if (props?.useDiscordBotIntegration) {
      new DiscordBot(this, "DiscordBot", {
        clusterArn: fargateCluster.clusterArn,
        containerDefinition: container,
        region: this.region,
        service: valheimService,
      });
    }

    new cdk.CfnOutput(this, "serviceName", {
      value: valheimService.serviceName,
      exportName: "fargateServiceName",
    });

    new cdk.CfnOutput(this, "clusterArn", {
      value: fargateCluster.clusterName,
      exportName: "fargateClusterName",
    });

    new cdk.CfnOutput(this, "EFSId", {
      value: serverFileSystem.fileSystemId,
    });
  }
}
