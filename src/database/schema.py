MEDIA_TABLE = "media"
MEDIA_PATH_TABLE = "media_path"

CREATE_TABLES = [
    f"""
        CREATE TABLE IF NOT EXISTS {MEDIA_TABLE} (
            hash TEXT PRIMARY KEY,
            date INTEGER,
            size INTEGER NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            ratio REAL NOT NULL,
            video INTEGER NOT NULL,
            duration TEXT
        );
    """,
    f"""
        CREATE TABLE IF NOT EXISTS {MEDIA_PATH_TABLE} (
            path TEXT PRIMARY KEY,
            hash TEXT NOT NULL,
            FOREIGN KEY (hash) REFERENCES {MEDIA_TABLE}(hash)
        );
    """
]

INSERT_IMAGES = [
    f"""
        INSERT INTO {MEDIA_TABLE} VALUES (
            :hash,
            :DateTime,
            :size,
            :width, :height, :ratio,
            :video, :duration
        )
    """,
    f"""
        INSERT INTO {MEDIA_PATH_TABLE} VALUES (
            :path,
            :hash
        )
    """
]

GET_MEDIA_LIST = f"""
    SELECT
        p.path, i.hash,
        i.ratio,
        i.video, i.duration
    FROM {MEDIA_PATH_TABLE} p JOIN {MEDIA_TABLE} i ON p.hash = i.hash
    ORDER BY p.path;
"""
