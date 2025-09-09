from src.database.db import Database
from pathlib import Path
from src.media.metadataExtract import MetaExtract
from os import fspath, getcwd
from src.utils.filehash import SHA1
from os.path import join as pathJoin
from os.path import basename
from src.media.thumbnails import ImgThumbnail, VidThumbnail
from src.media.mediatype import MediaType, GetMediaType
from src.utils.paths import CreatePath
import tomllib
from .app import Run
from src.database import schema
from collections import defaultdict


def thumbnailPath(hash: str, size: int) -> (str, str):
    return (
        f'{hash[:2]}/{hash[2:4]}/',
        f'{hash[4:]}-{size}.jpg'
    )


def initialize(config: dict):
    MEDIA_PATH = config["paths"]["media"]
    DATA_PATH = config["paths"]["data"]
    DATABASE_NAME = "gallery.db"
    THUMBNAIL_PATH = pathJoin(DATA_PATH, "thumbnails")
    THUMBNAIL_SIZES = config["media"]["thumbnail_size"]

    HASH_METHOD = SHA1

    CreatePath(DATA_PATH)
    db = Database(pathJoin(DATA_PATH, DATABASE_NAME))
    for statement in schema.CREATE_TABLES:
        db.exec(statement)
    COMMIT_BATCH_SIZE = config["database"]["commit_batch_size"]
    batchSize = 0

    # Recursively list all files
    for fpath in list(Path(MEDIA_PATH).rglob('*')):
        mediaPath = fspath(fpath)
        metadata = MetaExtract(mediaPath)
        # Not supported; skip
        if metadata is None:
            continue

        hash = HASH_METHOD(mediaPath)
        metadata['hash'] = hash
        metadata['path'] = mediaPath
        metadata['ratio'] = metadata['width'] / metadata['height']

        print("Generating thumbnail")
        for tSize in THUMBNAIL_SIZES:
            {
                MediaType.IMAGE: ImgThumbnail,
                MediaType.VIDEO: VidThumbnail
            }[GetMediaType(mediaPath)](
                # Arguments to thumbnailer
                mediaPath,
                pathJoin(
                    THUMBNAIL_PATH,
                    ''.join(thumbnailPath(hash, tSize))
                ),
                tSize
            )

        for statement in schema.INSERT_IMAGES:
            db.exec(statement, defaultdict(lambda: None, metadata))

        batchSize += 1
        # Write changes to disk in batch
        if batchSize >= COMMIT_BATCH_SIZE:
            db.commit()
            batchSize = 0
    # Last batch
    db.commit()


# Entry point
def main():
    with open("config/config.toml", "rb") as f:
        config = tomllib.load(f)

    init = False
    if init:
        initialize(config)
    else:
        CreatePath(config["paths"]["data"])
        db = Database(pathJoin(config["paths"]["data"], "gallery.db"))

        imgs = {
            'info': [],
            'path': {}
        }
        for row in db.exec(schema.GET_MEDIA_LIST):
            imgs['info'].append({
                'hash': row['hash'],
                'name': basename(row['path']),
                'aspectRatio': row['ratio'],
                'video': row['video'],
                'duration': row['duration']
            })
            imgs['path'][row['hash']] = {
                'thumbnail': ''.join(thumbnailPath(
                    row['hash'],
                    min(config["media"]["thumbnail_size"])
                )),
                'original': row['path']
            }

        thumbnailsFolder = pathJoin(config["paths"]["data"], "thumbnails")
        # Set to absolute path if is relative
        if not thumbnailsFolder.startswith('/'):
            thumbnailsFolder = pathJoin(getcwd(), thumbnailsFolder)

        Run(
            config['server']['host'], config['server']['port'],
            thumbnailsFolder, imgs
        )


if __name__ == "__main__":
    main()
