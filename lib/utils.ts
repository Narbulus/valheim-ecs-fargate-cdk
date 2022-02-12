import { SecretsManager } from "aws-sdk";
import * as config from "../config.json";
const secretsManager = new SecretsManager();

/**
 * Cached secrets so we can reduce warm start times.
 * TODO type these
 */
let __secrets: any | undefined = undefined;

export async function getSecret(fieldName: string): Promise<any | undefined> {
  if (!__secrets) {
    try {
      const secretValue = await secretsManager
        .getSecretValue({
          SecretId: config.configSecretName,
        })
        .promise();
      if (secretValue.SecretString) {
        __secrets = JSON.parse(secretValue.SecretString);
      }
    } catch (exception) {
      console.log(`Unable to get secrets: ${exception}`);
    }
  }
  return __secrets[fieldName];
}
