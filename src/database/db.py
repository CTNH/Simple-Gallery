import sqlite3


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

    def commit(self):
        self.conn.commit()

    def exec(self, statement: str, param: dict = None) -> dict:
        try:
            if param is None:
                self.curs.execute(statement)
            else:
                self.curs.execute(statement, param)
            res = self.curs.fetchall()
            return {} if res == [] else res
        except Exception as e:
            print(f"Failed to execute: {statement}")
            return {'DB_EXEC_ERR': e}
