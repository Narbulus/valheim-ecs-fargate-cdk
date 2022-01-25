import { AWSError, SecretsManager } from "aws-sdk";
import { GetSecretValueResponse } from "aws-sdk/clients/secretsmanager";
import { DiscordInteractions } from "slash-commands";
import { DiscordSecrets } from "@spenhand/discord-bot-cdk-construct";
import * as Stacks from "../configs/outputs.json";
import * as _ from "lodash";

const commands = [
  {
    name: "status",
    description: "Requests the current server status",
  },
  {
    name: "start",
    description: "Starts the server if it is not running",
  },
  {
    name: "stop",
    description: "Stops the server if it is running",
  },
];

const secretsManager = new SecretsManager({
  region: "us-west-2",
});

// We have to do this because I couldn't figure out how to export a consistent name
var secretId;
for (var key in Stacks.ValheimServerAwsCdkStack) {
  if (key.indexOf("discordSecretName") !== -1) {
    secretId = _.get(Stacks.ValheimServerAwsCdkStack, key);
    break;
  }
}

secretsManager.getSecretValue(
  {
    SecretId: secretId,
  },
  async (err?: AWSError, data?: GetSecretValueResponse) => {
    if (data?.SecretString) {
      try {
        const discordSecrets: DiscordSecrets = JSON.parse(data.SecretString);
        const interaction = new DiscordInteractions({
          applicationId: discordSecrets.clientId,
          authToken: discordSecrets.authToken,
          publicKey: discordSecrets.publicKey,
        });

        const inputArgs = process.argv.slice(2);

        switch (inputArgs[0]) {
          case "setup":
            commands.forEach(async (command) => {
              await interaction
                .createApplicationCommand(command)
                .then(() => {
                  console.log(`Created command ${command.name}!`);
                })
                .catch(console.log);
            });
            break;
          case "reset":
            const existingCommands = await interaction.getApplicationCommands();
            existingCommands.forEach(async (command) => {
              await interaction
                .deleteApplicationCommand(command.id)
                .then(() => {
                  console.log(`Deleted command ${command.name}!`);
                })
                .catch(console.error);
            });
            break;
        }
      } catch (exception) {
        console.log(`There was an error parsing the secret JSON: ${exception}`);
        console.log(
          "Please make sure that you have setup your secrets in the AWS console!"
        );
      }
    } else {
      console.log(
        'There was a problem retrieving your deployment results.\
    Make sure you\'ve run "npm run deploy" before running this command.'
      );
    }
  }
);
