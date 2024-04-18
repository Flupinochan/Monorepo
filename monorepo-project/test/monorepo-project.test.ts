import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import { Capture, Match, Template } from "aws-cdk-lib/assertions";

import { MonorepoProjectStack } from "../lib/monorepo-project-stack";
import { Parameters } from "../lib/parameters";

// Example
const sum = (x: number, y: number): number => {
  return x + y;
};
describe("Example Test", () => {
  test("sum関数のテスト", () => {
    expect(sum(1, 2)).toBe(3);
  });
});

// MonorepoProjectStack Test
describe("MonorepoProjectStack Test", () => {
  // bin/monorepo-project.ts と同じようにコードを記載する
  // 仮でテスト構築し、その仮で作成したリソースに対して検証テストする (mockしたリソースに対するテスト?)
  // ただし、CloudFormation Templateの書式に合わせる
  const param = new Parameters();
  const app = new cdk.App();
  const stack = new MonorepoProjectStack(app, "MonorepoProjectStack", {
    env: {
      account: param.env.account,
      region: param.env.region,
    },
  });
  const template = Template.fromStack(stack);

  test("AWS::CodeCommit::Repository が1つ作成されていることをテスト", () => {
    template.resourceCountIs("AWS::CodeCommit::Repository", 1);
  });

  test("CodeCommitの名前や説明が正しいかテスト", () => {
    template.hasResourceProperties("AWS::CodeCommit::Repository", {
      RepositoryName: param.codeCommit.repositoryName,
      RepositoryDescription: param.codeCommit.description,
    });
  });

  test("Lambda用CloudWatch Logsのプロパティテスト", () => {
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: param.lambda.logGroupName,
      RetentionInDays: logs.RetentionDays.ONE_DAY,
      LogGroupClass: logs.LogGroupClass.STANDARD,
    });
  });

  // テストする際は、変換されたCFnテンプレートに対してテストされる
  // そのため、CDKで、roleNameと定義していても、CFnでは、RoleName(Rが大文字)のため、
  // テストでは、RoleNameでテストする
  // cdk synthしたCFnをもとにテストすると良い
  // Match.objectLike() は、いずれかに一致すればTrue
  test("Lambda用IAMRoleテスト", () => {
    template.hasResourceProperties(
      "AWS::IAM::Role",
      Match.objectLike({
        RoleName: param.lambda.roleName,
        Policies: [
          {
            PolicyName: "codebuildPolicy",
            PolicyDocument: {
              Statement: [
                {
                  Effect: "Allow",
                  Action: ["codecommit:*", "codepipeline:*", "logs:*"],
                  Resource: "*",
                },
              ],
            },
          },
        ],
      })
    );
  });

  // Captureの使用例 (ただし、以下はあまり意味がないテスト)
  test("作成されたEventBridge Rule名が、paramで定義したEventBridge Rule名と一致するかテスト", () => {
    const eventBridgeRuleNameCapture = new Capture();
    // 作成されたEventBridge Rule名を取得 (以下は、Nameの値がキャプチャされる)
    template.hasResourceProperties("AWS::Events::Rule", {
      Name: eventBridgeRuleNameCapture,
    });
    // paramで定義したEventBridge Rule名と一致するかテスト
    expect(eventBridgeRuleNameCapture.asString()).toEqual(
      param.eventBridge.ruleName
    );
  });

  // test/__snapshots__/monorepo-project.test.ts.snap に、SnapshotとしてCFnテンプレートが生成される
  // 2度目以降のテストでは、上記CFnテンプレートと比較され、異なればテストが失敗する
  // tsc -wしておくこと! jsファイルから作成されたCFnテンプレートに対して、Snapshotが取得されるため
  // cdk diffは、実際にデプロイされているリソースとのテストのため、異なる
  test("Snapshot", () => {
    expect(template.toJSON()).toMatchSnapshot();
  });
});
