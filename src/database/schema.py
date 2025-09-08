IMG_TABLE = "images"
IMGPATH_TABLE = "images_path"

CREATE_TABLES = [
    f"""
        CREATE TABLE IF NOT EXISTS {IMG_TABLE} (
            hash TEXT PRIMARY KEY,
            date INTEGER,
            size INTEGER NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            maker TEXT,
            model TEXT
        );
    """,
    f"""
        CREATE TABLE IF NOT EXISTS {IMGPATH_TABLE} (
            path TEXT PRIMARY KEY,
            hash TEXT NOT NULL,
            FOREIGN KEY (hash) REFERENCES {IMG_TABLE}(hash)
        );
    """
]

INSERT_IMAGES = [
    f"""
        INSERT INTO {IMG_TABLE} VALUES (
            :hash,
            :DateTime,
            :size,
            :width, :height,
            :Make, :Model
        )
    """,
    f"""
        INSERT INTO {IMGPATH_TABLE} VALUES (
            :path,
            :hash
        )
    """
]
