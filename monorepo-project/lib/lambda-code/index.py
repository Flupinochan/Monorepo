# EventBirdgeのイベント構成 => https://docs.aws.amazon.com/ja_jp/codecommit/latest/userguide/monitoring-events.html#referenceUpdated
# CodeCommitのリポジトリチェック用API => https://docs.aws.amazon.com/ja_jp/codecommit/latest/APIReference/API_GetDifferences.html

import os
import sys
import boto3
from botocore.exceptions import ClientError, BotoCoreError
from botocore.config import Config

from LoggingClass import LoggingClass

# ----------------------------------------------------------------------
# 定数定義 (Lambda環境変数)
# ----------------------------------------------------------------------
try:
    # 検索対象のCodeCommit内のディレクトリのリスト (CodeCommitのディレクトリとS3が1対1を想定)
    S3_SYNC_DIR_LIST: list[str] = os.environ['S3_SYNC_DIR_LIST'].split(',')
    CODEPIPELINE = os.environ['CODEPIPELINE']
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "DEBUG")
except KeyError as ke:
    raise Exception("Lambda 環境変数が設定されていません : {}".format(ke))

# ----------------------------------------------------------------------
# グローバル変数定義
# ----------------------------------------------------------------------
config = Config(
    region_name='ap-northeast-3',
    retries={
        'max_attempts': 3,
        'mode': 'standard'
    }
)
codecommit_client = boto3.client('codecommit', config=config)
codepipeline_client = boto3.client('codepipeline', config=config)

# ----------------------------------------------------------------------
# ロガー設定
# ----------------------------------------------------------------------
logger = LoggingClass(LOG_LEVEL)
log = logger.get_logger()

# ----------------------------------------------------------------------
# メイン処理
# ----------------------------------------------------------------------
def main(repository_name, before_commitId, after_commitId):
    for dir in S3_SYNC_DIR_LIST:
        check_dir, flag = commit_check(repository_name, before_commitId, after_commitId, dir)
        execute_codepipeline(check_dir, flag)

# ----------------------------------------------------------------------
# CodeCommitをチェック
# ----------------------------------------------------------------------
def commit_check(repository_name, before_commitId, after_commitId, check_dir):
    try:
        flag = False
        # 対象ディレクトリおよび配下のディレクトリを再帰的にチェック
        paginator = codecommit_client.get_paginator('get_differences')
        response_iterator = paginator.paginate(
            repositoryName=repository_name,
            beforeCommitSpecifier=before_commitId,
            afterCommitSpecifier=after_commitId,
            beforePath=check_dir,
            afterPath=check_dir,
        )
        # response['differences']が空の場合は、変更がないディレクトリ
        for response in response_iterator:
            if response['differences']:
                flag = True
        if flag:
            log.debug(f'{check_dir} に変更がありました')
        else:
            log.debug(f'{check_dir} に変更はありませんでした')
        log.info("{}() 処理終了".format(sys._getframe().f_code.co_name))
        return check_dir, flag
    except Exception as ex:
        log.error("{}() でエラーが発生しました".format(sys._getframe().f_code.co_name))
        log.error(f'エラー内容: {ex}')
        raise


# ----------------------------------------------------------------------
# CodePipelineを実行
# ----------------------------------------------------------------------
def execute_codepipeline(check_dir, flag):
    try:
        target_s3_name = check_dir
        if flag:
            # CodeCommitディレクトリ名とS3名を一致させていない場合、以下のif文でtarget_s3_nameを変更する
            if check_dir == "dirA":
                target_s3_name = "monorepo-target-example-s3-a"
            elif check_dir == "dirB":
                target_s3_name = "monorepo-target-example-s3-b"
            # ディレクトリ作成時は、実行されないことに注意
            codepipeline_client.start_pipeline_execution(
                name=CODEPIPELINE,
                variables=[
                    {
                        'name': "sourceDirectoryName",
                        'value': check_dir
                    },
                    {
                        'name': "deployS3BucketName",
                        'value': target_s3_name
                    },
                ],
            )
        log.info("{}() 処理終了".format(sys._getframe().f_code.co_name))
    except Exception as ex:
        log.error("{}() でエラーが発生しました".format(sys._getframe().f_code.co_name))
        log.error(f'エラー内容: {ex}')
        raise

# ----------------------------------------------------------------------
# エントリーポイント (EventBridgeがトリガー)
# ----------------------------------------------------------------------
def lambda_handler(event, context):
    log.info('Lambda実行開始')

    repository_name = event['detail']['repositoryName']
    before_commitId = event['detail']['oldCommitId']
    after_commitId = event['detail']['commitId']

    try:
        main(repository_name, before_commitId, after_commitId)
    except ClientError as ce:
        ce_error_message = ce.response['Error']['Message']
        log.error("AWS APIでエラーが発生しました")
        log.error(ce_error_message, exc_info=True)
    except BotoCoreError as bce:
        bce_error_message = str(bce)
        log.error("Boto3でエラーが発生しました")
        log.error(bce_error_message, exc_info=True)
    except Exception as ex:
        ex_error_message = str(ex)
        log.error("予期せぬエラーが発生しました。書式ミスの可能性があります")
        log.error(ex_error_message, exc_info=True)
    finally:
        log.info('Lambda実行終了')