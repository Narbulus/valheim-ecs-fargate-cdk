"use strict";

import { APIGatewayProxyHandler } from "aws-lambda";
import { getResponse, updateServerConfiguration } from "./utils";

const REGION = process.env.REGION;
const SERVICE_NAME = process.env.SERVICE_NAME;
const CLUSTER_ARN = process.env.CLUSTER_ARN;
const PASSWORD = process.env.PASSWORD;

const handler: APIGatewayProxyHandler = async (event, context, callback) => {
  if (!REGION || !SERVICE_NAME || !CLUSTER_ARN) {
    return {
      statusCode: 500,
      headers: {},
      body: "Lambda environment not bootstrapped correctly",
    };
  }

  const { action, key } = event.headers;
  if (!action || !key) {
    return getResponse(400, "Missing required parameters");
  } else if (!(action == "start" || "stop")) {
    return getResponse(400, "Action must be either START or STOP");
  }
  const startServer = action == "start";

  if (key == PASSWORD) {
    if (startServer) {
      console.log("Starting service ");
    } else {
      console.log("Stopping service ");
    }

    const updateSuccess = await updateServerConfiguration(
      REGION,
      SERVICE_NAME,
      CLUSTER_ARN,
      startServer ? 1 : 0
    );

    if (!updateSuccess) {
      return getResponse(500, "Update request failed");
    }

    return getResponse(200, "Server update successful");
  }

  return getResponse(400, "Authentication failed");
};

exports.handler = handler;
