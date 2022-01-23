/* 
This code was created from sample code provided for the AWS SDK for JavaScript version 3 (v3),
which is available at https://github.com/aws/aws-sdk-js-v3. This example is in the 'AWS SDK for JavaScript v3 Developer Guide' at
https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/using-lambda-function-prep.html.
Purpose:
This function queries the server status of an ecs container, and if it's running returns the public ip
Inputs (into code):
- REGION
- SERVICE_ARN - service arn or name of the ecs service
- CLUSTER_ARN  - cluster arn or name of the ecs cluster
*/
"use strict";

import { getCurrentServerIP, getResponse } from "./utils";
import { APIGatewayProxyHandler } from "aws-lambda";

const REGION = process.env.REGION;
const SERVICE_NAME = process.env.SERVICE_NAME;
const CLUSTER_ARN = process.env.CLUSTER_ARN;

const handler: APIGatewayProxyHandler = async (event, context, callback) => {
  if (!REGION || !SERVICE_NAME || !CLUSTER_ARN) {
    return {
      statusCode: 500,
      headers: {},
      body: "Lambda environment not bootstrapped correctly",
    };
  }

  const publicIp = await getCurrentServerIP(REGION, SERVICE_NAME, CLUSTER_ARN);
  if (!publicIp) {
    return getResponse(200, "No running instances");
  }

  return getResponse(200, "Server status request successful", { ip: publicIp });
};

exports.handler = handler;
