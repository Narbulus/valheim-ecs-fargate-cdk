#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ValheimServerAwsCdkStack } from "../lib/valheim-server-aws-cdk-stack";

const app = new cdk.App();
new ValheimServerAwsCdkStack(app, "ValheimServerAwsCdkStack", {
  useFTP: false,
  useServerStatusAPI: true,
  useDiscordIntegration: true,
  discordWebhookURL:
    "https://discord.com/api/webhooks/935332416443252766/UGjkZWNBX7uFFauDGbHTDx3Jid_E0B2FNg-1HaDh91ysTHE82j4afzKOf4tvWgXkXmha",
});
