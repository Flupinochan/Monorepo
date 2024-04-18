#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MonorepoProjectStack } from "../lib/monorepo-project-stack";

import { Parameters } from "../lib/parameters";

const param = new Parameters();

const app = new cdk.App();
new MonorepoProjectStack(app, "MonorepoProjectStack", {
  env: {
    account: param.env.account,
    region: param.env.region,
  },
});
