# CDK Manual

use Code Whisperer!!<br>

https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/cli.html<br>
https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html

## CDK のインストール

```bash
npm install -g aws-cdk             # install latest version
npm install -g aws-cdk@X.YY.Z      # install specific version
```

## TypeScript のインストール (アップデート)

```bash
npm install -g typescript
npm update -g typescript
```

## TypeScript CDK Project の作成

```bash
mkdir monorepo-project
cd monorepo-project
cdk init app --language typescript
```

## bootstrap を実行 (CloudFormation 実行用サービスロールを作成)

```bash
cdk bootstrap
```

## monorepo-project.ts にデプロイ先の環境を記述

```bash
vi bin/monorepo-project.ts
```

## monorepo-project-stack.ts に構築するリソースを記述

```bash
vi lib/monorepo-project-stack.ts
```

## CloudFormation Stack のデプロイ

```bash
cdk deploy
```

以降は、必要に応じて実施する

## CloudFormation Stack の削除

```bash
cdk destroy
```

## CloudFormation テンプレートの生成

metadata なしも可能

```bash
cdk synth
cdk synth --no-version-reporting --no-path-metadata
```

## デプロイされている CloudFormation Stack と diff する

```bash
cdk diff
```

# テスト

https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions.Template.html<br>
TypeScript は、Jest というテストフレームワークを使用する<br>
大きく分けて 2 種類ある<br>
・Snapshot による CFn テンプレート差分テスト<br>
・Assertion (Match や Capture) を使用して、テスト構築した (mock) リソースに対する検証テスト

```bash
# test/monorepo-project.test.ts にテスト用コードを記載する
# jest.config.js が設定ファイル
# とりあえず、以下をimportしておけばok
# @aws-cdk/assert もある
import { Capture, Match, Template } from "@aws-cdk/assertions";
npm test # テスト実行コマンド
```

## Jest

以下の形式で記載する<br>
テストには、Assertion や Matcher が使用できる<br>
describe('見出し', () => {});<br>
test('テスト名 1', () => {});<br>
test('テスト名 2', () => {});<br>
Assertion や Matcher で、テスト構築したリソースを Template したものに対して検証するテストが行える<br>

```typescript
// example
const sum = (x: number, y: number): number => {
  return x + y;
};

test("sum Test", () => {
  expect(sum(1, 2)).toBe(3);
});
```

## Assertion (Fine-grained Assertions) テスト

```typescript
test("MonorepoProjectStack Assertion Test", () => {
  // bin/monorepo-project.ts と同じようにコードを記載する
  const param = new Parameters();
  const app = new cdk.App();
  const stack = new MonorepoProjectStack(app, "MonorepoProjectStack", {
    env: {
      account: param.env.account,
      region: param.env.region,
    },
  });

  const assert = Template.fromStack(stack);
  // AWS::CodeCommit::Repository が1つ作成されていることをテスト
  assert.resourceCountIs("AWS::CodeCommit::Repository", 1);
});
```

## Matcher テスト

Assertion にさらに正規表現などで、複雑な検証テストが可能<br>

```typescript
const sum = (x: number, y: number): number => {
  return x + y;
};

test("adds 1 + 2 to equal 3", () => {
  expect(sum(1, 2)).toBe(3);
});
```

```typescript
// logicalIdに指定した (AWS::IAM::Role) が props として存在することを確認するテスト
// template.hasResourceProperties(logicalId, props)
// Match.objectEquals(props) は、propsのオブジェクトであることをテストする
// Match.anyValue() は、任意の値が入ることをテストする

template.hasResourceProperties(
  "AWS::IAM::Role",
  Match.objectEquals({
    AssumeRolePolicyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: {
            Service: {
              "Fn::Join": ["", ["states.", Match.anyValue(), ".amazonaws.com"]],
            },
          },
        },
      ],
    },
  })
);
```

## Capture

A が B に利用される場合に使用する<br>
事前に作成した IAMRole が Lambda の Role として設定されていることを確認する場合など<br>
以下の URL の例のとおり、指定したキーの値を Capture している<br>
https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions.Capture.html

## Snapshot テスト

以前取得した CFn テンプレート(Snapshot)と現在構築する CFn テンプレートが一致することを検証するテスト<br>
何も変更されていないことを確認するテスト<br>
初回テスト時に、Snapshot が取得され、以降テストした際の CFn テンプレートと比較検証される<br>
`-u` を使用すれば、Snapshot をリセットできる

```typescript
npm test -- -u
// 以下でも良い
jest -u
```
