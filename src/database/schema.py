IMG_TABLE = "images"

CREATE_TABLES = f"""
    CREATE TABLE IF NOT EXISTS {IMG_TABLE} (
        hash TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        date INTEGER,
        size INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        maker TEXT,
        model TEXT
    );
"""


def INSERT_IMAGES() -> str:
    return f"""
        INSERT INTO {IMG_TABLE} VALUES (
            :sha1,
            :path,
            :DateTime,
            :size,
            :width, :height,
            :Make, :Model
        )
    """
