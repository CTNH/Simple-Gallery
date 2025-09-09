import sqlite3
from src.database import schema
from collections import defaultdict


def dictFactory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d


class Database:
    def __init__(self, dbfile: str):
        self.conn = sqlite3.connect(dbfile)
        self.conn.row_factory = dictFactory
        self.curs = self.conn.cursor()

    # Deconstructor
    def __del__(self):
        print("Closing database connection")
        self.conn.close()

    def createTables(self):
        for statement in schema.CREATE_TABLES:
            try:
                self.curs.execute(statement)
            except Exception:
                print(f"Database create table failed: {statement}")

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
