import { ContainerDefinition } from "aws-cdk-lib/aws-ecs";

export function applyWebooks(
  containerDefinition: ContainerDefinition,
  discordWebhookURL: string
): void {
  containerDefinition.addEnvironment("DISCORD_WEBHOOK", discordWebhookURL);
  containerDefinition.addEnvironment(
    "PRE_START_HOOK",
    formatWebhookCommand("Server is starting up...")
  );
  containerDefinition.addEnvironment(
    "PRE_RESTART_HOOK",
    formatWebhookCommand("Restarting server")
  );
  containerDefinition.addEnvironment(
    "PRE_SERVER_SHUTDOWN_HOOK",
    formatWebhookCommand("Server is shutting down...")
  );
  containerDefinition.addEnvironment(
    "POST_SERVER_SHUTDOWN_HOOK",
    formatWebhookCommand("Server shut down")
  );
  containerDefinition.addEnvironment(
    "POST_SERVER_LISTENING_HOOK",
    formatWebhookCommand("Server is ready for players!")
  );
}

function formatWebhookCommand(message: string): string {
  return `curl -sfSL -X POST -H "Content-Type: application/json" -d "{\\"username\\":\\"Valheim\\",\\"content\\":\\"${message}\\"}" "$DISCORD_WEBHOOK"`;
}
