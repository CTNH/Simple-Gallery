import sqlite3
from src.database import schema
from pathlib import Path
from src.media.metadataExtract import MetaExtract
from src.utils.filehash import SHA1
from os import fspath
from collections import defaultdict


class Database:
    def __init__(self, dbfile: str):
        self.conn = sqlite3.connect(dbfile)
        self.curs = self.conn.cursor()
        self.curs.execute(schema.CREATE_TABLES)

    def addImage(self, metadata: dict):
        self.curs.execute(
            schema.INSERT_IMAGES(),
            # Default to None if no key
            defaultdict(lambda: None, metadata)
        )

    def commit(self):
        self.conn.commit()

