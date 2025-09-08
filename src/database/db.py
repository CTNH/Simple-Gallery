import sqlite3
from src.database import schema
from collections import defaultdict


class Database:
    def __init__(self, dbfile: str):
        self.conn = sqlite3.connect(dbfile)
        self.curs = self.conn.cursor()
        for statement in schema.CREATE_TABLES:
            self.curs.execute(statement)

    def addImage(self, metadata: dict):
        for statement in schema.INSERT_IMAGES:
            self.curs.execute(
                statement,
                # Default to None if no key
                defaultdict(lambda: None, metadata)
            )

    def commit(self):
        self.conn.commit()

