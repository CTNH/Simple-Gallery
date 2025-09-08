import sqlite3
from src.database import schema
from collections import defaultdict


class Database:
    def __init__(self, dbfile: str):
        self.conn = sqlite3.connect(dbfile)
        self.curs = self.conn.cursor()
        for statement in schema.CREATE_TABLES:
            self.curs.execute(statement)

    # Deconstructor
    def __del__(self):
        self.conn.close()

    def addImage(self, metadata: dict):
        for statement in schema.INSERT_IMAGES:
            try:
                self.curs.execute(
                    statement,
                    # Default to None if no key
                    defaultdict(lambda: None, metadata)
                )
            except Exception:
                print(f"INSERT FAILED: {metadata['path']}")

    def commit(self):
        self.conn.commit()

    def getImages(self) -> tuple:
        self.curs.execute(schema.GET_IMAGES)
        return self.curs.fetchall()
