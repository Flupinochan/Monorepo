interface Env {
  account: string;
  region: string;
}

interface CodeCommitParameters {
  repositoryName: string;
  description: string;
}

interface S3Parameters {
  s3Name: string;
}

interface LambdaParameters {
  functionName: string;
  roleName: string;
  logGroupName: string;
  S3Sync_dir_list: string;
}

interface CodePipelineParameters {
  pipelineName: string;
  branchName: string;
  artifactS3Name: string;
  roleName: string;
  actionRoleName: string;
}

interface EventBridgeParameters {
  ruleName: string;
}

interface CodeBuildParameters {
  projectName: string;
  roleName: string;
  logGroupName: string;
}

export class Parameters {
  env: Env = {
    account: "99999999999",
    region: "ap-northeast-3",
  };

  codeCommit: CodeCommitParameters = {
    repositoryName: "Monorepo",
    description: "Monorepo",
  };

  deployTargetS3A: S3Parameters = {
    s3Name: "monorepo-target-example-s3-a",
  };

  deployTargetS3B: S3Parameters = {
    s3Name: "monorepo-target-example-s3-b",
  };

  lambda: LambdaParameters = {
    functionName: "triggerMonorepoPipeline-lambda",
    roleName: "lambdaIAMRole-triggerMonorepoPipeline-lambda",
    logGroupName: "triggerMonorepoPipeline-lambda-logs",
    S3Sync_dir_list:
      "monorepo-target-example-s3-a,monorepo-target-example-s3-b",
  };

  codebuildProject: CodeBuildParameters = {
    projectName: "monorepo-codebuild",
    roleName: "codebuildIAMRole-monorepo",
    logGroupName: "monorepo-codebuild-logs",
  };

  codePipeline: CodePipelineParameters = {
    pipelineName: "monorepo-pipeline",
    branchName: "main",
    artifactS3Name: "monorepo-pipeline-artifact",
    roleName: "pipelineIAMRole-monorepo",
    actionRoleName: "pipelineActionIAMRole-monorepo",
  };

  eventBridge: EventBridgeParameters = {
    ruleName: "triggerMonorepoPipeline-lambda-rule",
  };
}
