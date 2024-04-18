import logging
import sys
from time import struct_time
from datetime import datetime
from logging import Formatter, StreamHandler
from zoneinfo import ZoneInfo

class LoggingClass:
    # ----------------------------------------------------------------------
    # Constant Definition
    # ----------------------------------------------------------------------
    LOG_FORMAT = '[%(asctime)s.%(msecs)03d JST] [%(levelname)s] [%(lineno)d行目] [関数名 : %(funcName)s] %(message)s'
    LOG_DATEFMT = '%Y/%m/%d %H:%M:%S'
    JST = ZoneInfo("Asia/Tokyo")
    LOG_LEVEL = ''

    # ----------------------------------------------------------------------
    # Logger Settings
    # ----------------------------------------------------------------------
    # Constructor
    def __init__(self, log_level='INFO'):
        self.LOG_LEVEL = log_level

        # Set log timestamp to JST
        def custom_time(*args) -> struct_time:
            return datetime.now(self.JST).timetuple()

        # Define log format
        fmt = Formatter(fmt=self.LOG_FORMAT, datefmt=self.LOG_DATEFMT)
        fmt.converter = custom_time

        # Define log output destination
        sh = StreamHandler(sys.stdout)
        sh.setLevel(self.LOG_LEVEL)
        sh.setFormatter(fmt)

        # Generate Logger object
        self.log = logging.getLogger('Logger_stdout')
        self.log.propagate = False
        self.log.addHandler(sh)
        self.log.setLevel(self.LOG_LEVEL)

    # Get Logger object
    def get_logger(self):
        return self.log