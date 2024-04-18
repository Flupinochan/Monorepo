import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as logs from "aws-cdk-lib/aws-logs";
// import * as ec2 from 'aws-cdk-lib/aws-ec2'; // Snapshot Test用
import path = require("path");
import { Duration } from "aws-cdk-lib";

import { Parameters } from "./parameters";

const param = new Parameters();

export class MonorepoProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CodeCommit
    const repo = new codecommit.Repository(this, "CodeCommit", {
      repositoryName: param.codeCommit.repositoryName,
      description: param.codeCommit.description,
      code: codecommit.Code.fromZipFile(
        "lib/codecommit/monorepo-target-example-s3.zip",
        param.codePipeline.branchName
      ),
    });

    // Deploy Target S3 A
    const deployS3A = new s3.Bucket(this, "S3_DeployTargetA", {
      bucketName: param.deployTargetS3A.s3Name,
    });

    // Deploy Target S3 B
    const deployS3B = new s3.Bucket(this, "S3_DeployTargetB", {
      bucketName: param.deployTargetS3B.s3Name,
    });

    // Lambda
    const lambdaRole = new iam.Role(this, "Lambda_IAMRole", {
      roleName: param.lambda.roleName,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        codebuildPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["codecommit:*", "codepipeline:*", "logs:*"],
              resources: ["*"],
            }),
          ],
        }),
      },
    });
    const lambdaLogGroup = new logs.LogGroup(this, "Lambda_CloudWatchLogs", {
      logGroupName: param.lambda.logGroupName,
      retention: logs.RetentionDays.ONE_DAY,
      logGroupClass: logs.LogGroupClass.STANDARD,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const fn = new lambda.Function(this, "Lambda", {
      functionName: param.lambda.functionName,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "index.lambda_handler",
      role: lambdaRole,
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda-code")),
      timeout: Duration.minutes(15),
      logGroup: lambdaLogGroup,
      environment: {
        S3_SYNC_DIR_LIST: param.lambda.S3Sync_dir_list,
        CODEPIPELINE: param.codePipeline.pipelineName,
        LOG_LEVEL: "DEBUG",
      },
    });

    // CodeBuild
    const buildRole = new iam.Role(this, "CodeBuild_IAMRole", {
      roleName: param.codebuildProject.roleName,
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
      inlinePolicies: {
        codebuildPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "codecommit:*",
                "codebuild:*",
                "codepipeline:*",
                "logs:*",
                "s3:*",
                "iam:*",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });
    const codebuildLogGroup = new logs.LogGroup(
      this,
      "CodeBuild_CloudWatchLogs",
      {
        logGroupName: param.codebuildProject.logGroupName,
        retention: logs.RetentionDays.ONE_DAY,
        logGroupClass: logs.LogGroupClass.STANDARD,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );
    const codebuildProject = new codebuild.PipelineProject(this, `CodeBuild`, {
      projectName: param.codebuildProject.projectName,
      role: buildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      logging: {
        cloudWatch: {
          logGroup: codebuildLogGroup,
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          build: {
            commands: [
              "echo ${sourceDirectoryName}",
              "echo ${deployS3BucketName}",
              "aws s3 sync ${sourceDirectoryName} s3://${deployS3BucketName} --delete",
            ],
          },
        },
      }),
    });

    // CodePipeline
    const pipelineRole = new iam.Role(this, "CodePipeline_IAMRole", {
      roleName: param.codePipeline.roleName,
      assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AWSCodePipeline_FullAccess"
        ),
      ],
    });
    const pipelineActionRole = new iam.Role(
      this,
      "CodePipelineAction_IAMRole",
      {
        roleName: param.codePipeline.actionRoleName,
        assumedBy: new iam.AccountPrincipal(param.env.account),
        inlinePolicies: {
          codepipelineActionPolicy: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  "codecommit:*",
                  "codebuild:*",
                  "codepipeline:*",
                  "logs:*",
                  "s3:*",
                ],
                resources: ["*"],
              }),
            ],
          }),
        },
      }
    );
    const artifactS3 = new s3.Bucket(this, "S3_CodePipelineArtifact", {
      bucketName: param.codePipeline.artifactS3Name,
    });
    const sourceOutput = new codepipeline.Artifact();
    const sourceDirectoryName = new codepipeline.Variable({
      variableName: "sourceDirectoryName",
      description: "Receive from Lambda",
      defaultValue: "default",
    });
    const deployS3BucketName = new codepipeline.Variable({
      variableName: "deployS3BucketName",
      description: "Receive from Lambda",
      defaultValue: "default",
    });
    const pipeline = new codepipeline.Pipeline(this, "CodePipeline", {
      pipelineName: param.codePipeline.pipelineName,
      artifactBucket: artifactS3,
      pipelineType: codepipeline.PipelineType.V2,
      executionMode: codepipeline.ExecutionMode.QUEUED,
      role: pipelineRole,
      // setting default pipeline valiables
      variables: [sourceDirectoryName, deployS3BucketName],
      stages: [
        {
          stageName: "source",
          actions: [
            new codepipeline_actions.CodeCommitSourceAction({
              actionName: "SourceCodeCommit",
              role: pipelineActionRole,
              repository: repo,
              branch: param.codePipeline.branchName,
              output: sourceOutput,
              runOrder: 1,
              customEventRule: {
                ruleName: param.eventBridge.ruleName,
                eventPattern: {
                  detailType: ["CodeCommit Repository State Change"],
                  resources: [repo.repositoryArn],
                  source: ["aws.codecommit"],
                  detail: {
                    referenceType: ["branch"],
                    event: ["referenceCreated", "referenceUpdated"],
                    referenceName: [param.codePipeline.branchName],
                  },
                },
                target: new targets.LambdaFunction(fn),
              },
            }),
          ],
        },
        {
          stageName: "Build",
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: "BuildS3",
              role: pipelineActionRole,
              input: sourceOutput,
              runOrder: 2,
              project: codebuildProject,
              // CodePipeline変数は、CodeBuild側ではなく、CodePipeline内のBuildステージで設定する必要がある
              environmentVariables: {
                sourceDirectoryName: {
                  value: "#{variables.sourceDirectoryName}",
                  type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                },
                deployS3BucketName: {
                  value: "#{variables.deployS3BucketName}",
                  type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                },
              },
            }),
          ],
        },
      ],
    });

    // Snapshot Test用
    // const vpc = new ec2.Vpc(this, 'VPC');
  }
}
